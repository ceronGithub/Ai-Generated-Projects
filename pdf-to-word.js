// =============================================
// pdf-to-word.js — Convert PDF to Word (.docx)
//
// Strategy: Extract text from each PDF page via
// PDF.js, build a DOCX file using docx.js
// (loaded from CDN). Each page becomes a section.
//
// Public API:
//   PDFToWord.convert(files, onProgress)
//   → Promise<Array<{ file, filename, blob, pages }>>
// =============================================

const PDFToWord = (() => {
  'use strict';

  // Minimal DOCX builder without external lib —
  // builds a valid Open XML .docx as a ZIP using JSZip.
  // Each paragraph becomes a <w:p> element.

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildDocx(pages) {
    // pages = Array<string[]>  (each string = a paragraph line)
    if (!window.JSZip) throw new Error('JSZip is required for Word export.');

    const zip = new JSZip();

    // ── [Content_Types].xml ───────────────────────────────────────────────
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // ── _rels/.rels ───────────────────────────────────────────────────────
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`);

    // ── word/_rels/document.xml.rels ──────────────────────────────────────
    zip.folder('word').folder('_rels').file('document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    // ── Build paragraphs ──────────────────────────────────────────────────
    let bodyXml = '';
    for (let pi = 0; pi < pages.length; pi++) {
      if (pi > 0) {
        // Page break between pages
        bodyXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      }
      for (const line of pages[pi]) {
        const text = esc(line);
        if (!text.trim()) {
          bodyXml += `<w:p/>`;
        } else {
          bodyXml += `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
        }
      }
    }

    // ── word/document.xml ─────────────────────────────────────────────────
    zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink"
  xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:oel="http://schemas.microsoft.com/office/2019/extlst"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"
  xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"
  xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"
  xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"
  xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  // ── Text extraction (same Y-grouping as Excel) ────────────────────────────

  const Y_TOL = 4;

  async function extractPageLines(pdf, pageNum) {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });

    const rowMap = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const screenY = Math.round(vp.height - item.transform[5]);
      let key = null;
      for (const [k] of rowMap) {
        if (Math.abs(k - screenY) <= Y_TOL) { key = k; break; }
      }
      if (key === null) key = screenY;
      if (!rowMap.has(key)) rowMap.set(key, []);
      rowMap.get(key).push({ str: item.str.trim(), x: item.transform[4] });
    }

    return [...rowMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map(i => i.str).join('  ')
      );
  }

  // ── Main convert ──────────────────────────────────────────────────────────

  async function convert(files, onProgress) {
    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const buf   = await file.arrayBuffer();
        const pdf   = await pdfjsLib.getDocument({ data: buf }).promise;
        const pages = [];

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          pages.push(await extractPageLines(pdf, pi));
        }

        const docxBytes = await buildDocx(pages);
        const blob      = new Blob([docxBytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        results.push({
          file,
          filename: file.name.replace(/\.pdf$/i, '') + '.docx',
          blob,
          pages: pdf.numPages,
        });

      } catch (err) {
        results.push({ file, filename: file.name, blob: null, error: err.message });
      }

      if (onProgress) onProgress(fi + 1, files.length);
    }

    return results;
  }

  return { convert };
})();
