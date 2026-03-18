// =============================================
// pdf-to-ppt.js — Convert PDF to PowerPoint (.pptx)
//
// Strategy: Render each PDF page to a canvas,
// encode as base64 JPEG, then embed as a
// full-slide image in a minimal PPTX file
// built via JSZip.
//
// Public API:
//   PDFToPPT.convert(files, onProgress)
//   → Promise<Array<{ file, filename, blob, pages }>>
// =============================================

const PDFToPPT = (() => {
  'use strict';

  const SCALE  = 1.5;
  const JPEG_Q = 0.88;

  // Standard slide dimensions (EMU — English Metric Units)
  // 10 inches wide × 7.5 inches tall @ 914400 EMU/inch
  const SLIDE_W = 9144000;
  const SLIDE_H = 6858000;

  function dataURLtoBase64(dataURL) {
    return dataURL.split(',')[1];
  }

  async function renderPageToJpeg(pdf, pageNum) {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas   = document.createElement('canvas');
    canvas.width   = Math.round(viewport.width);
    canvas.height  = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return {
      b64:    dataURLtoBase64(canvas.toDataURL('image/jpeg', JPEG_Q)),
      width:  canvas.width,
      height: canvas.height,
    };
  }

  async function buildPptx(slides) {
    // slides = Array<{ b64: string, width: number, height: number }>
    if (!window.JSZip) throw new Error('JSZip is required for PowerPoint export.');

    const zip = new JSZip();

    // ── [Content_Types].xml ──────────────────────────────────────────────
    let slideContentTypes = '';
    for (let i = 0; i < slides.length; i++) {
      slideContentTypes += `
  <Override PartName="/ppt/slides/slide${i + 1}.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/_rels/slide${i + 1}.xml.rels"
    ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`;
    }

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels"  ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"   ContentType="application/xml"/>
  <Default Extension="jpeg"  ContentType="image/jpeg"/>
  <Default Extension="jpg"   ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideContentTypes}
</Types>`);

    // ── _rels/.rels ──────────────────────────────────────────────────────
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="ppt/presentation.xml"/>
</Relationships>`);

    // ── ppt/presentation.xml ─────────────────────────────────────────────
    const slideIdList = slides.map((_, i) =>
      `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
    ).join('\n    ');

    zip.folder('ppt').file('presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>
  <p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>
</p:presentation>`);

    // ── ppt/_rels/presentation.xml.rels ─────────────────────────────────
    const presRels = slides.map((_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    ).join('\n  ');

    zip.folder('ppt').folder('_rels').file('presentation.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`);

    // ── One slide per page ───────────────────────────────────────────────
    const slideFolder    = zip.folder('ppt').folder('slides');
    const slideRelsFolder = slideFolder.folder('_rels');
    const mediaFolder    = zip.folder('ppt').folder('media');

    for (let i = 0; i < slides.length; i++) {
      const { b64 } = slides[i];
      const imgName  = `image${i + 1}.jpg`;

      // Embed JPEG
      mediaFolder.file(imgName, b64, { base64: true });

      // Slide XML — image fills the entire slide
      slideFolder.file(`slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Page ${i + 1}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`);

      // Slide rels
      slideRelsFolder.file(`slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgName}"/>
</Relationships>`);
    }

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  // ── Main convert ──────────────────────────────────────────────────────────

  async function convert(files, onProgress) {
    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const buf    = await file.arrayBuffer();
        const pdf    = await pdfjsLib.getDocument({ data: buf }).promise;
        const slides = [];

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          slides.push(await renderPageToJpeg(pdf, pi));
          if (onProgress) onProgress(
            (fi * pdf.numPages + pi),
            files.length * pdf.numPages
          );
        }

        const pptxBytes = await buildPptx(slides);
        const blob      = new Blob([pptxBytes], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        });

        results.push({
          file,
          filename: file.name.replace(/\.pdf$/i, '') + '.pptx',
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
