// =============================================
// pdf-locker.js — Password-protect a PDF file
//
// Implements PDF 1.4 Standard Security Handler
// (RC4-128 encryption) entirely in the browser.
//
// BUG FIX: Objects now written in strict ascending
// numeric order (1,2,3,4…) so every xrefs[n] entry
// is populated before the xref table is serialised.
// The old code wrote Catalog/Pages/Encrypt AFTER
// the page/image/stream objects, leaving xrefs[1-3]
// undefined → "offset is out of bounds".
//
// Public API:
//   PDFLocker.lock(file, userPassword)
//   → Promise<{ filename, blob }>
// =============================================

const PDFLocker = (() => {
  'use strict';

  // ── MD5 (pure JS) ─────────────────────────────────────────────────────────

  function md5(bytes) {
    const msg    = Array.from(bytes);
    const bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 0; i < 8; i++) msg.push((bitLen >>> (i * 8)) & 0xff);

    let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

    const T = Array.from({ length: 64 }, (_, i) =>
      Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0
    );
    const S = [
      7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
      5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
      4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
      6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
    ];

    const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
    const add  = (...args) => args.reduce((s, v) => (s + v) >>> 0, 0);

    for (let i = 0; i < msg.length; i += 64) {
      const W = [];
      for (let j = 0; j < 16; j++) {
        W[j] = (msg[i+j*4] | (msg[i+j*4+1]<<8) |
                (msg[i+j*4+2]<<16) | (msg[i+j*4+3]<<24)) >>> 0;
      }
      let aa = a, bb = b, cc = c, dd = d;
      for (let j = 0; j < 64; j++) {
        let f, g;
        if      (j < 16) { f = (b & c) | (~b & d); g = j; }
        else if (j < 32) { f = (d & b) | (~d & c); g = (5*j+1)%16; }
        else if (j < 48) { f = b ^ c ^ d;            g = (3*j+5)%16; }
        else              { f = c ^ (b | ~d);          g = (7*j)%16;  }
        f = add(f, a, W[g], T[j]);
        a = d; d = c; c = b;
        b = add(b, rotl(f, S[j]));
      }
      a = add(a, aa); b = add(b, bb); c = add(c, cc); d = add(d, dd);
    }

    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) {
      out[i]    = (a >>> i*8) & 0xff;
      out[i+4]  = (b >>> i*8) & 0xff;
      out[i+8]  = (c >>> i*8) & 0xff;
      out[i+12] = (d >>> i*8) & 0xff;
    }
    return out;
  }

  // ── RC4 ───────────────────────────────────────────────────────────────────

  function rc4(key, data) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 0xff;
      [S[i], S[j]] = [S[j], S[i]];
    }
    const out = new Uint8Array(data.length);
    let x = 0, y = 0;
    for (let i = 0; i < data.length; i++) {
      x = (x + 1) & 0xff;
      y = (y + S[x]) & 0xff;
      [S[x], S[y]] = [S[y], S[x]];
      out[i] = data[i] ^ S[(S[x] + S[y]) & 0xff];
    }
    return out;
  }

  // ── PDF 1.4 Standard Security Handler (RC4-128) ───────────────────────────

  const PAD = new Uint8Array([
    0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,
    0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,
    0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,
    0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A,
  ]);

  function padPassword(pw) {
    const b   = new TextEncoder().encode(pw).slice(0, 32);
    const out = new Uint8Array(32);
    out.set(b);
    out.set(PAD.slice(b.length), b.length);
    return out;
  }

  function computeOwnerHash(ownerPw, userPw) {
    const op  = padPassword(ownerPw || userPw);
    let   key = md5(op);
    for (let i = 0; i < 50; i++) key = md5(key);
    return rc4(key, padPassword(userPw));
  }

  function computeEncryptionKey(userPw, ownerHash, permissions, fileId) {
    const up     = padPassword(userPw);
    const digest = new Uint8Array([
      ...up, ...ownerHash,
      permissions & 0xff,
      (permissions >>> 8)  & 0xff,
      (permissions >>> 16) & 0xff,
      (permissions >>> 24) & 0xff,
      ...fileId,
    ]);
    let key = md5(digest);
    for (let i = 0; i < 50; i++) key = md5(key);
    return key; // 16 bytes = 128-bit
  }

  function computeUserHash(encKey, fileId) {
    // Input = PAD (32 bytes) + fileId (16 bytes) = 48 bytes
    // RC4 output is also 48 bytes — we only keep first 32 per PDF spec §3.5.2
    let hash = rc4(encKey, new Uint8Array([...PAD, ...fileId]));
    // Truncate to 32 bytes before the 19 extra RC4 passes
    hash = hash.slice(0, 32);
    for (let i = 1; i <= 19; i++) {
      hash = rc4(new Uint8Array(encKey.map(b => b ^ i)), hash);
    }
    // hash is now exactly 32 bytes
    return hash;
  }

  // Per-object encryption key  (PDF spec §3.5)
  function objectKey(encKey, objNum) {
    const buf = new Uint8Array(encKey.length + 5);
    buf.set(encKey);
    buf[encKey.length]     =  objNum        & 0xff;
    buf[encKey.length + 1] = (objNum >>  8) & 0xff;
    buf[encKey.length + 2] = (objNum >> 16) & 0xff;
    buf[encKey.length + 3] = 0; // generation lo
    buf[encKey.length + 4] = 0; // generation hi
    return md5(buf).slice(0, Math.min(encKey.length + 5, 16));
  }

  function toHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function encStr(str) { return new TextEncoder().encode(str); }

  function dataURLtoBytes(dataURL) {
    const bin = atob(dataURL.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  // ── Encrypted PDF builder ─────────────────────────────────────────────────
  //
  // CRITICAL: objects must be written in STRICT ASCENDING order so that
  // xrefs[1], xrefs[2], xrefs[3] … are all defined before the xref table
  // loop runs.  The old code wrote pages/xobjs/streams first, leaving
  // xrefs[1..3] undefined → "offset is out of bounds" crash.
  //
  // Object layout (ascending):
  //   1          → Catalog
  //   2          → Pages
  //   3          → /Encrypt dictionary
  //   4 … 3+N    → Page objects
  //   4+N … 3+2N → Image XObjects  (RC4-encrypted JPEG)
  //   4+2N… 3+3N → Page content streams  (RC4-encrypted)

  function buildEncryptedPDF(pages, encKey, ownerHash, userHash, fileId, permissions) {
    const parts  = [];
    const xrefs  = [];   // xrefs[objNum] = byte offset
    let   offset = 0;

    function write(chunk) {
      if (typeof chunk === 'string') chunk = encStr(chunk);
      parts.push(chunk);
      offset += chunk.length;
    }
    function startObj(n) { xrefs[n] = offset; write(`${n} 0 obj\n`); }
    function endObj()    { write('endobj\n'); }

    const N          = pages.length;
    const catalogObj = 1;
    const pagesObj   = 2;
    const encryptObj = 3;
    const pageBase   = 4;
    const xobjBase   = 4 + N;
    const streamBase = 4 + 2 * N;
    const totalObj   = 3 + 3 * N;

    write('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    // ── Object 1: Catalog ─────────────────────────────────────────────────
    startObj(catalogObj);
    write(`<< /Type /Catalog /Pages ${pagesObj} 0 R /Encrypt ${encryptObj} 0 R >>\n`);
    endObj();

    // ── Object 2: Pages ───────────────────────────────────────────────────
    startObj(pagesObj);
    write(`<< /Type /Pages /Kids [${
      Array.from({ length: N }, (_, i) => `${pageBase + i} 0 R`).join(' ')
    }] /Count ${N} >>\n`);
    endObj();

    // ── Object 3: /Encrypt dictionary ────────────────────────────────────
    startObj(encryptObj);
    write(
      `<< /Filter /Standard\n` +
      `   /V 2 /R 3 /Length 128\n` +
      `   /P ${permissions}\n` +
      `   /O <${toHex(ownerHash)}>\n` +
      `   /U <${toHex(userHash)}>\n` +
      `>>\n`
    );
    endObj();

    // ── Objects 4 … 3+N: Page objects ────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      startObj(pageBase + i);
      write(
        `<< /Type /Page /Parent ${pagesObj} 0 R\n` +
        `   /MediaBox [0 0 ${width} ${height}]\n` +
        `   /Contents ${streamBase + i} 0 R\n` +
        `   /Resources << /XObject << /Im${i} ${xobjBase + i} 0 R >> >>\n` +
        `>>\n`
      );
      endObj();
    }

    // ── Objects 4+N … 3+2N: Image XObjects (RC4-encrypted JPEG) ─────────
    for (let i = 0; i < N; i++) {
      const { jpegBytes, width, height } = pages[i];
      const objNum   = xobjBase + i;
      const oKey     = objectKey(encKey, objNum);
      const encJpeg  = rc4(oKey, jpegBytes);

      startObj(objNum);
      write(
        `<< /Type /XObject /Subtype /Image\n` +
        `   /Width ${width} /Height ${height}\n` +
        `   /ColorSpace /DeviceRGB /BitsPerComponent 8\n` +
        `   /Filter /DCTDecode /Length ${encJpeg.length}\n` +
        `>>\nstream\n`
      );
      parts.push(encJpeg);
      offset += encJpeg.length;
      write('\nendstream\n');
      endObj();
    }

    // ── Objects 4+2N … 3+3N: Content streams (RC4-encrypted) ────────────
    for (let i = 0; i < N; i++) {
      const { width, height } = pages[i];
      const objNum    = streamBase + i;
      const plain     = encStr(`q ${width} 0 0 ${height} 0 0 cm /Im${i} Do Q\n`);
      const oKey      = objectKey(encKey, objNum);
      const encStream = rc4(oKey, plain);

      startObj(objNum);
      write(`<< /Length ${encStream.length} >>\nstream\n`);
      parts.push(encStream);
      offset += encStream.length;
      write('\nendstream\n');
      endObj();
    }

    // ── Cross-reference table ─────────────────────────────────────────────
    // All xrefs[1..totalObj] are now defined — safe to iterate.
    const xrefOffset = offset;
    write(`xref\n0 ${totalObj + 1}\n`);
    write('0000000000 65535 f \n');
    for (let n = 1; n <= totalObj; n++) {
      if (xrefs[n] === undefined) {
        throw new Error(`Internal error: xref missing for object ${n}`);
      }
      write(String(xrefs[n]).padStart(10, '0') + ' 00000 n \n');
    }

    // ── Trailer ───────────────────────────────────────────────────────────
    write(
      `trailer\n` +
      `<< /Size ${totalObj + 1}\n` +
      `   /Root ${catalogObj} 0 R\n` +
      `   /Encrypt ${encryptObj} 0 R\n` +
      `   /ID [<${toHex(fileId)}><${toHex(fileId)}>]\n` +
      `>>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`
    );

    // ── Concatenate all byte chunks ───────────────────────────────────────
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out   = new Uint8Array(total);
    let   pos   = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ── Main lock function ────────────────────────────────────────────────────

  async function lock(file, userPassword) {
    const RENDER_SCALE = 2.0;
    const JPEG_Q       = 0.92;
    const PERMISSIONS  = -3904;  // allow printing; deny modification / copy

    // Random 16-byte file ID (spec requires unique per document)
    const fileId = crypto.getRandomValues(new Uint8Array(16));

    // Derive all crypto material
    const ownerHash = computeOwnerHash(userPassword, userPassword);
    const encKey    = computeEncryptionKey(userPassword, ownerHash, PERMISSIONS, fileId);
    const userHash  = computeUserHash(encKey, fileId);

    // Render every page via PDF.js
    const buf   = await file.arrayBuffer();
    const pdf   = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];

    for (let pi = 1; pi <= pdf.numPages; pi++) {
      const page     = await pdf.getPage(pi);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas   = document.createElement('canvas');
      canvas.width   = Math.round(viewport.width);
      canvas.height  = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pages.push({
        jpegBytes: dataURLtoBytes(canvas.toDataURL('image/jpeg', JPEG_Q)),
        width:     canvas.width,
        height:    canvas.height,
      });
    }

    const pdfBytes = buildEncryptedPDF(pages, encKey, ownerHash, userHash, fileId, PERMISSIONS);
    const blob     = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      filename: file.name.replace(/\.pdf$/i, '') + '_locked.pdf',
      blob,
    };
  }

  return { lock };
})();
