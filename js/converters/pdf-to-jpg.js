// =============================================
// pdf-to-jpg.js — Convert PDF pages to JPG images
//
// Renders each page to canvas at high DPI,
// encodes as JPEG, wraps in a ZIP for download.
//
// Public API:
//   PDFToJPG.convert(files, onProgress)
//   → Promise<Array<{ file, filename, blob, pages, images }>>
//   images = Array<{ filename, blob }>  (one per page)
// =============================================

const PDFToJPG = (() => {
  'use strict';

  const SCALE  = 2.0;   // 192 dpi — high quality
  const JPEG_Q = 0.92;

  async function convert(files, onProgress) {
    const results = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      try {
        const buf    = await file.arrayBuffer();
        const pdf    = await pdfjsLib.getDocument({ data: buf }).promise;
        const images = [];
        const baseName = file.name.replace(/\.pdf$/i, '');

        for (let pi = 1; pi <= pdf.numPages; pi++) {
          const page     = await pdf.getPage(pi);
          const viewport = page.getViewport({ scale: SCALE });
          const canvas   = document.createElement('canvas');
          canvas.width   = Math.round(viewport.width);
          canvas.height  = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

          const jpgBlob = await new Promise(res =>
            canvas.toBlob(res, 'image/jpeg', JPEG_Q)
          );

          const suffix   = pdf.numPages === 1 ? '' : `_p${pi}`;
          images.push({
            filename: `${baseName}${suffix}.jpg`,
            blob:     jpgBlob,
            page:     pi,
          });

          if (onProgress) onProgress(
            fi * pdf.numPages + pi,
            files.length * pdf.numPages
          );
        }

        // If multiple pages, bundle into a ZIP
        let outBlob, outName;
        if (images.length === 1) {
          outBlob = images[0].blob;
          outName = images[0].filename;
        } else if (window.JSZip) {
          const zip = new JSZip();
          for (const img of images) {
            const buf = await img.blob.arrayBuffer();
            zip.file(img.filename, buf);
          }
          outBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          outName = `${baseName}_pages.zip`;
        } else {
          // No JSZip — return first page only
          outBlob = images[0].blob;
          outName = images[0].filename;
        }

        results.push({
          file,
          filename: outName,
          blob:     outBlob,
          pages:    pdf.numPages,
          images,
        });

      } catch (err) {
        results.push({ file, filename: file.name, blob: null, images: [], error: err.message });
      }

      if (onProgress) onProgress(fi + 1, files.length);
    }

    return results;
  }

  return { convert };
})();
