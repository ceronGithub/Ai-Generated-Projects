// ============================================================
// extract-all.js  —  Smart Extract All engine
// ============================================================
//
// Detects the type of each PDF and applies the correct extractor:
//
//   TYPE 1 · TRANSACTION HISTORY REPORT  (SMC Skyway)
//     Detected by: "TRANSACTION HISTORY REPORT" in text
//     Output: one card per transaction row
//     Fields: Ref No, Tag Number, Plate, Date, Time,
//             E-SI No, Zone, Entry, Exit, Toll Fee
//
//   TYPE 2 · SMC SALES INVOICE  (TPLEX / SIDC / MMSS3 / SKYWAY / SLEX)
//     Detected by: "SALES INVOICE NUMBER:" in text
//     Output: one card per invoice with all key fields
//     Fields: Invoice No, Company, Date, Time, Customer Name,
//             TIN, Address, Entry, Exit, Vatable Sales, VAT, Total Amount
//
//   TYPE 3 · GENERIC INVOICE / DOCUMENT
//     Fallback for all other PDFs
//     Output: key label→value pairs extracted per page
//     (same as previous Extract All behaviour via KeywordHandler.extractFields)
//
// Public API (window.ExtractAll):
//   ExtractAll.process(pdfData)   → enrichedPdfData  (adds .docType + .structured)
//   ExtractAll.render(pdfData, files, listEl, actionsEl)   → void
//   ExtractAll.exportExcel(pdfData)   → triggers download
//
// Minimal changes to existing files:
//   app.js       → call ExtractAll.process(pdfData) before renderExtractAll
//   ui-manager.js→ renderExtractAll receives enrichedPdfData and delegates to ExtractAll.render
//
// ============================================================

window.ExtractAll = (() => {

  // ─── UTILITIES ──────────────────────────────────────────────────────────────

  const esc = str => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function strip(str) {
    if (!str) return '';
    let s = String(str);
    s = s.replace(/^[\s:;#\-–—|\/\\*•·]+/, '');
    s = s.replace(/[\s:;#\-–—|\/\\*•·,]+$/, '');
    return s.trim();
  }

  function toTitleCase(str) {
    if (!str) return '';
    return String(str)
      .split(' ')
      .map(word => {
        if (!word) return word;
        const letters = word.replace(/[^a-zA-Z]/g, '');
        if (!letters) return word;
        if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // Format "02/01/2026  16:41:37" → "02/01/2026  16:41:37" (keep as-is, already clean)
  function cleanDate(str) {
    return (str || '').replace(/\s{2,}/g, ' ').trim();
  }

  // Normalize PHP amount — "45.00" → "₱45.00" | "Php 99.00" → "₱99.00"
  function phpAmount(str) {
    if (!str) return '';
    const s = String(str).replace(/Php\s*/i, '').trim();
    return '₱' + s;
  }

  // ─── DOCUMENT TYPE DETECTION ─────────────────────────────────────────────────

  /**
   * detectType(text) → 'transaction' | 'salesinvoice' | 'generic'
   *
   * Runs on the FULL concatenated text of all pages of a PDF.
   */
  function detectType(fullText) {
    if (/TRANSACTION\s+HISTORY\s+REPORT/i.test(fullText)) return 'transaction';
    if (/SALES\s+INVOICE\s+NUMBER\s*:/i.test(fullText))    return 'salesinvoice';
    return 'generic';
  }

  // ─── TYPE 1: TRANSACTION HISTORY REPORT PARSER ───────────────────────────────
  //
  // pdfminer / PDF.js extracts the two-column layout in reading order:
  //   ┌─ LEFT column (transaction rows) ─┐  ┌─ RIGHT column (toll fees) ─┐
  //   Ref No. : XXXXXXXXX                   45.00
  //   date  time  ESI  zone  entry  exit     Total : Php 45.00
  //   ...                                    35.00
  //                                          Total : Php 35.00
  //
  // All LEFT-column content is emitted first, then all RIGHT-column content.
  // Strategy:
  //   1. Split on blank lines into tokens
  //   2. Collect all Ref/IER entries in order → build leg groups
  //   3. Collect all "Total : Php XX" lines in order
  //   4. ZIP refs → totals (1:1 guaranteed by PDF layout)
  //   5. Parse header fields (account, period, etc.)

  const REF_RE   = /^(Ref No\.|IER No\.)\s*:\s*(\S+)/;
  const DATE_RE  = /^(\d{2}\/\d{2}\/\d{4})\s{1,}(\d{1,2}:\d{2}:\d{2})\s*$/;
  const TOTAL_RE = /^Total\s*:\s*Php\s*([\d,]+\.?\d*)/;
  const USAGE_RE = /^Total Usage:\s*Php\s*([\d,]+\.?\d*)/i;
  const TAG_RE   = /^TagNumber\s*:\s*(\S+)\s+Plate Number\s*:\s*(\S+)/;

  function parseTransactionHistory(fullText) {
    const lines = fullText.split('\n').map(l => l.trim());

    // ── Header ──────────────────────────────────────────────────────────────
    const header = {};
    for (const l of lines) {
      if (/^Printed Date\s*:/.test(l))  header.printedDate  = l.replace(/^Printed Date\s*:\s*/, '').trim();
      if (/^Period\s*:/.test(l))         header.period        = l.replace(/^Period\s*:\s*/, '').trim();
      if (/^Grand Total Usage/.test(l))  header.grandTotal    = l.replace(/^Grand Total Usage:\s*Php\s*/, '').trim();
    }

    // Account fields are in 2-column layout — labels on left, values right
    // Values appear after the colon-only lines in order: AccountNo, AccountName, TIN, Address
    const colonIdx = lines.reduce((acc, l, i) => { if (l === ':') acc.push(i); return acc; }, []);
    // First 4 colons correspond to account label fields
    const afterColon = colonIdx.slice(0, 4).map(i => {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j]) return lines[j];
      }
      return '';
    });
    if (afterColon[0]) header.accountNumber = afterColon[0];
    if (afterColon[1]) header.accountName   = afterColon[1];
    if (afterColon[2]) header.tin           = afterColon[2];
    if (afterColon[3]) header.address       = afterColon[3];

    // ── Transactions ─────────────────────────────────────────────────────────
    // The 2-column PDF layout means "Total : Php" lines for a tag section can
    // overflow into the line range of the NEXT tag section.
    // Fix: collect ALL refs globally and ALL totals globally, then zip them.
    // Both lists are in the same document order → 1-to-1 alignment guaranteed.

    const allRefs    = [];   // {tag, plate, type, ref, legs:[]}
    const allTotals  = [];   // string amounts in order

    let currentTag   = '';
    let currentPlate = '';
    let curRef       = null;
    let curLegs      = [];

    function flushRef() {
      if (curRef !== null) {
        allRefs.push({ tag: currentTag, plate: currentPlate,
                       ref: curRef.ref, type: curRef.type, legs: [...curLegs] });
        curRef = null; curLegs = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      const mTag = TAG_RE.exec(l);
      if (mTag) {
        flushRef();
        currentTag = mTag[1]; currentPlate = mTag[2];
        continue;
      }

      const mRef = REF_RE.exec(l);
      if (mRef) {
        flushRef();
        curRef  = { ref: mRef[2], type: mRef[1].startsWith('IER') ? 'IER' : 'Ref' };
        curLegs = [];
        continue;
      }

      const mDate = DATE_RE.exec(l);
      if (mDate && curRef !== null) {
        const fields = [];
        let j = i + 1;
        while (j < lines.length && fields.length < 4) {
          if (lines[j]) {
            if (DATE_RE.test(lines[j]) || REF_RE.test(lines[j]) || TAG_RE.test(lines[j])) break;
            fields.push(lines[j]);
          }
          j++;
        }
        curLegs.push({
          date:  mDate[1],
          time:  mDate[2],
          esi:   fields[0] ?? '',
          zone:  fields[1] ?? '',
          entry: fields[2] ?? '',
          exit:  fields[3] ?? '',
        });
        continue;
      }

      const mTotal = TOTAL_RE.exec(l);
      if (mTotal) {
        allTotals.push(mTotal[1]);
        continue;
      }
    }
    flushRef();

    // Global zip: allRefs[i] ↔ allTotals[i]
    const transactions = allRefs.map((r, idx) => ({
      ...r,
      total: allTotals[idx] ?? '',
    }));

    return { header, transactions };
  }

  // ─── TYPE 2: SMC SALES INVOICE PARSER ────────────────────────────────────────
  //
  // Extracts all key fields from an SMC toll sales invoice.
  // Handles the 2-column interleaved label layout.
  //
  // Returns a flat object: { invoiceNo, company, date, time, customerName,
  //   tin, address, entry, exit, vatableSales, vat, totalAmount }

  function parseSalesInvoice(fullText) {
    const t = fullText.replace(/\s+/g, ' ');  // collapse to single-space flat text

    function grab(pattern) {
      const m = pattern.exec(t);
      return m ? strip(m[1]) : '';
    }

    // Invoice number
    const invoiceNo = grab(/SALES\s+INVOICE\s+NUMBER\s*:\s*([A-Z0-9]+)/i);

    // Company name — first non-empty line of the PDF (before address lines)
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const company = lines[0] ?? '';

    // Date — match DD/MM/YYYY or MM/DD/YYYY
    const date = grab(/Date\s*:\s*(?:Time\s*)?(?:[:]\s*)?(\d{2}\/\d{2}\/\d{4})/i)
              || grab(/(\d{2}\/\d{2}\/\d{4})/);

    // Time — HH:MM:SS
    const time = (() => {
      const m = /\b(\d{2}:\d{2}:\d{2})\b/.exec(t);
      return m ? m[1] : '';
    })();

    // Customer Name — after "Customer Name :"
    const customerName = grab(/Customer\s+Name\s*:\s*([\w\s\-,./]+?)(?=\s*(?:TIN|Business Style|Address|Entry|Exit|\d{3}-\d{3}|$))/i);

    // TIN — customer TIN (the short format 006-977-514-000, not the company 00000 TIN)
    const tin = (() => {
      // Find all TIN-format numbers: NNN-NNN-NNN-NNN (no trailing zeros of 5 digits)
      const tins = [...t.matchAll(/\b(\d{3}-\d{3}-\d{3}-\d{3})\b/g)].map(m => m[1]);
      return tins[tins.length - 1] ?? ''; // last one is the customer TIN
    })();

    // Address — after "Address :"
    const address = grab(/Address\s*:\s*([\w\s,.\-/]+?)(?=\s*(?:Entry|Exit|THIS SERVES|Vatable|"THIS|$))/i);

    // Entry
    const entry = grab(/Entry\s*:\s*([\w\s\-/,.()']+?)(?=\s*(?:Exit\s*:|THIS SERVES|"THIS|Vatable|$))/i);

    // Exit
    const exit = grab(/Exit\s*:\s*([\w\s\-/,.()']+?)(?=\s*(?:THIS SERVES|"THIS|Vatable|$))/i);

    // Vatable Sales — first decimal in the series after "Vatable Sales"
    const vatableSales = (() => {
      const m = /Vatable\s+Sales[\s\S]{0,80}?(\d+\.\d{2})/.exec(t);
      return m ? m[1] : '';
    })();

    // VAT — last decimal before "Total Amount"
    const vat = (() => {
      const seg = t.match(/VAT\b([\s\S]{0,200})Total Amount/i);
      if (!seg) return '';
      const nums = [...seg[1].matchAll(/(\d+\.\d{2})/g)].map(m => m[1]);
      return nums[nums.length - 1] ?? '';
    })();

    // Total Amount
    const totalAmount = grab(/Total\s+Amount\s*(?:Php\s*)?([\d,]+\.?\d*)/i);

    return {
      invoiceNo:    strip(invoiceNo),
      company:      strip(company),
      date:         strip(date),
      time:         strip(time),
      customerName: strip(customerName),
      tin:          strip(tin),
      address:      strip(address),
      entry:        strip(entry),
      exit:         strip(exit),
      vatableSales: strip(vatableSales),
      vat:          strip(vat),
      totalAmount:  strip(totalAmount),
    };
  }

  // ─── TYPE 3: GENERIC DOCUMENT PARSER ─────────────────────────────────────────
  //
  // Falls back to KeywordHandler.extractFields() per page — existing behaviour.

  function parseGeneric(pdfPageText) {
    if (window.KeywordHandler && KeywordHandler.extractFields) {
      return KeywordHandler.extractFields(pdfPageText);
    }
    return [];
  }

  // ─── PROCESS: enrich pdfData with .docType + .structured ─────────────────────

  /**
   * process(pdfData) → enrichedPdfData
   *
   * pdfData: [{file, pages:[{page, text}]}, ...]
   * Returns same structure with added .docType and .structured per file.
   */
  function process(pdfData) {
    return pdfData.map(entry => {
      const { file, pages } = entry;

      // Build full text from all pages for type detection
      const fullText = pages.map(p => p.text).join('\n');

      const docType = detectType(fullText);
      let structured = null;

      if (docType === 'transaction') {
        structured = parseTransactionHistory(fullText);
      } else if (docType === 'salesinvoice') {
        structured = parseSalesInvoice(fullText);
      }
      // generic: structured stays null — handled per-page in render

      return { ...entry, docType, structured };
    });
  }

  // ─── CARD BUILDERS ────────────────────────────────────────────────────────────

  function makeViewBtn() {
    return `<button class="result-view-btn" title="View PDF">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <ellipse cx="6.5" cy="6.5" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="6.5" cy="6.5" r="1.8" fill="currentColor"/>
      </svg>
    </button>`;
  }

  function makeRemoveBtn() {
    return `<button class="result-remove-btn" title="Remove this result">✕</button>`;
  }

  function makeMetaBar(pageNum, filename) {
    return `<div class="result-meta">
      <span class="page-badge">Page ${pageNum}</span>
      <span class="result-filename">${esc(filename)}</span>
      ${makeViewBtn()}
      ${makeRemoveBtn()}
    </div>`;
  }

  // ── Transaction History row card ──
  function makeTransactionCard(tx, pageNum, file) {
    const item = document.createElement('div');
    item.className = 'result-item ea-transaction-card';

    const legsHtml = tx.legs.map(leg => `
      <div class="ea-tx-leg">
        <div class="ea-tx-row">
          <span class="ea-tx-label">Date / Time</span>
          <span class="ea-tx-value">${esc(cleanDate(leg.date + '  ' + leg.time))}</span>
        </div>
        <div class="ea-tx-row">
          <span class="ea-tx-label">E-SI No.</span>
          <span class="ea-tx-value">${esc(leg.esi)}</span>
        </div>
        <div class="ea-tx-row">
          <span class="ea-tx-label">Zone</span>
          <span class="ea-tx-value">${esc(leg.zone)}</span>
        </div>
        <div class="ea-tx-row">
          <span class="ea-tx-label">Entry</span>
          <span class="ea-tx-value">${esc(toTitleCase(leg.entry))}</span>
        </div>
        ${leg.exit ? `<div class="ea-tx-row">
          <span class="ea-tx-label">Exit</span>
          <span class="ea-tx-value">${esc(toTitleCase(leg.exit))}</span>
        </div>` : ''}
      </div>`).join('');

    item.innerHTML = `
      ${makeMetaBar(pageNum, file.name)}
      <div class="ea-tx-header">
        <span class="ea-tx-ref">${esc(tx.type)} No. ${esc(tx.ref)}</span>
        <span class="ea-tx-tag">🏷 ${esc(tx.tag)}</span>
        <span class="ea-tx-plate">🚘 ${esc(tx.plate)}</span>
      </div>
      ${legsHtml}
      <div class="ea-tx-footer">
        <span class="ea-tx-fee-label">Toll Fee</span>
        <span class="ea-tx-fee">${esc(phpAmount(tx.total))}</span>
      </div>`;

    if (window.PDFViewer) {
      item.querySelector('.result-view-btn')
          .addEventListener('click', () => PDFViewer.open(file, pageNum));
    }
    item.querySelector('.result-remove-btn')
        .addEventListener('click', () => item.remove());
    return item;
  }

  // ── Transaction History header summary card ──
  function makeTransactionHeaderCard(header, pageNum, file) {
    const rows = [
      ['Account Number', header.accountNumber],
      ['Account Name',   header.accountName],
      ['TIN',            header.tin],
      ['Address',        header.address],
      ['Period',         header.period],
      ['Printed Date',   header.printedDate],
      ['Grand Total Usage', header.grandTotal ? phpAmount(header.grandTotal) : ''],
    ].filter(([, v]) => v);

    const item = document.createElement('div');
    item.className = 'result-item ea-summary-card';
    item.innerHTML = `
      ${makeMetaBar(pageNum, file.name)}
      <div class="ea-summary-title">📄 Transaction History Report</div>
      ${rows.map(([label, val]) => `
        <div class="ea-tx-row">
          <span class="ea-tx-label">${esc(label)}</span>
          <span class="ea-tx-value">${esc(val)}</span>
        </div>`).join('')}`;

    if (window.PDFViewer) {
      item.querySelector('.result-view-btn')
          .addEventListener('click', () => PDFViewer.open(file, pageNum));
    }
    item.querySelector('.result-remove-btn')
        .addEventListener('click', () => item.remove());
    return item;
  }

  // ── SMC Sales Invoice card ──
  function makeSalesInvoiceCard(fields, pageNum, file) {
    const rows = [
      ['Invoice No.',    fields.invoiceNo],
      ['Company',        fields.company],
      ['Date',           fields.date],
      ['Time',           fields.time],
      ['Customer Name',  fields.customerName],
      ['TIN',            fields.tin],
      ['Address',        fields.address],
      ['Entry',          fields.entry],
      ['Exit',           fields.exit],
      ['Vatable Sales',  fields.vatableSales ? phpAmount(fields.vatableSales) : ''],
      ['VAT',            fields.vat          ? phpAmount(fields.vat)          : ''],
      ['Total Amount',   fields.totalAmount   ? phpAmount(fields.totalAmount)  : ''],
    ].filter(([, v]) => v);

    const item = document.createElement('div');
    item.className = 'result-item ea-invoice-card';
    item.innerHTML = `
      ${makeMetaBar(pageNum, file.name)}
      <div class="ea-summary-title">🧾 Sales Invoice</div>
      ${rows.map(([label, val]) => `
        <div class="result-keyword">${esc(label)}</div>
        <div class="result-text">${esc(val)}</div>`).join('')}`;

    if (window.PDFViewer) {
      item.querySelector('.result-view-btn')
          .addEventListener('click', () => PDFViewer.open(file, pageNum));
    }
    item.querySelector('.result-remove-btn')
        .addEventListener('click', () => item.remove());
    return item;
  }

  // ── Generic field card (existing behaviour) ──
  function makeGenericCard(label, value, pageNum, file) {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      ${makeMetaBar(pageNum, file.name)}
      <div class="result-keyword">${esc(strip(label))}</div>
      <div class="result-text">${esc(strip(value))}</div>`;

    if (window.PDFViewer) {
      item.querySelector('.result-view-btn')
          .addEventListener('click', () => PDFViewer.open(file, pageNum));
    }
    item.querySelector('.result-remove-btn')
        .addEventListener('click', () => item.remove());
    return item;
  }

  // ── Raw text fallback card (no fields detected) ──
  function makeRawCard(pageText, pageNum, file) {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      ${makeMetaBar(pageNum, file.name)}
      <div class="result-keyword">Raw Text</div>
      <div class="result-text">${esc(pageText) || '<em>(no text)</em>'}</div>`;

    if (window.PDFViewer) {
      item.querySelector('.result-view-btn')
          .addEventListener('click', () => PDFViewer.open(file, pageNum));
    }
    item.querySelector('.result-remove-btn')
        .addEventListener('click', () => item.remove());
    return item;
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  /**
   * render(enrichedPdfData, listEl)
   *
   * Builds and appends all result cards into listEl.
   * enrichedPdfData comes from process().
   */
  function render(enrichedPdfData, listEl) {
    for (const { file, pages, docType, structured } of enrichedPdfData) {

      // ── Transaction History Report ────────────────────────────────────────
      if (docType === 'transaction' && structured) {
        const { header, transactions } = structured;

        // Header summary card (page 1)
        if (Object.keys(header).length) {
          listEl.appendChild(makeTransactionHeaderCard(header, 1, file));
        }

        // One card per transaction
        transactions.forEach(tx => {
          listEl.appendChild(makeTransactionCard(tx, 1, file));
        });
        continue;
      }

      // ── SMC Sales Invoice ─────────────────────────────────────────────────
      if (docType === 'salesinvoice' && structured) {
        listEl.appendChild(makeSalesInvoiceCard(structured, 1, file));
        continue;
      }

      // ── Generic / Fallback (per page) ─────────────────────────────────────
      for (const p of pages) {
        const fields = parseGeneric(p.text);
        if (fields.length === 0) {
          listEl.appendChild(makeRawCard(p.text, p.page, file));
        } else {
          for (const { label, value } of fields) {
            listEl.appendChild(makeGenericCard(label, value, p.page, file));
          }
        }
      }
    }
  }

  // ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────

  /**
   * exportExcel(enrichedPdfData)
   *
   * Builds an XLSX using SheetJS — one sheet per document type:
   *   "Transactions"  — all Transaction History rows
   *   "Invoices"      — all Sales Invoice fields
   *   "Fields"        — all generic fields
   */
  function exportExcel(enrichedPdfData) {
    if (!window.XLSX) {
      alert('Excel export requires the SheetJS library.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Transaction rows sheet ───────────────────────────────────────────────
    const txRows = [];
    for (const { file, docType, structured } of enrichedPdfData) {
      if (docType !== 'transaction' || !structured) continue;
      const { header, transactions } = structured;
      transactions.forEach(tx => {
        tx.legs.forEach((leg, idx) => {
          txRows.push({
            'File':          file.name,
            'Account Number':header.accountNumber ?? '',
            'Account Name':  header.accountName   ?? '',
            'TIN':           header.tin            ?? '',
            'Period':        header.period         ?? '',
            'Tag Number':    tx.tag,
            'Plate Number':  tx.plate,
            'Ref / IER No.': tx.ref,
            'Ref Type':      tx.type,
            'Leg #':         idx + 1,
            'Date':          leg.date,
            'Time':          leg.time,
            'E-SI No.':      leg.esi,
            'Zone':          leg.zone,
            'Entry':         leg.entry,
            'Exit':          leg.exit,
            'Toll Fee (₱)':  idx === 0 ? tx.total : '',  // fee once per group
          });
        });
      });
    }
    if (txRows.length) {
      const ws = XLSX.utils.json_to_sheet(txRows);
      ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(Object.keys(txRows[0]).length - 1)}1` };
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    }

    // ── Sales Invoice sheet ──────────────────────────────────────────────────
    const invRows = [];
    for (const { file, docType, structured } of enrichedPdfData) {
      if (docType !== 'salesinvoice' || !structured) continue;
      invRows.push({
        'File':           file.name,
        'Invoice No.':    structured.invoiceNo,
        'Company':        structured.company,
        'Date':           structured.date,
        'Time':           structured.time,
        'Customer Name':  structured.customerName,
        'TIN':            structured.tin,
        'Address':        structured.address,
        'Entry':          structured.entry,
        'Exit':           structured.exit,
        'Vatable Sales':  structured.vatableSales,
        'VAT':            structured.vat,
        'Total Amount':   structured.totalAmount,
      });
    }
    if (invRows.length) {
      const ws = XLSX.utils.json_to_sheet(invRows);
      ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(Object.keys(invRows[0]).length - 1)}1` };
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    }

    // ── Generic fields sheet ─────────────────────────────────────────────────
    const genRows = [];
    for (const { file, pages, docType } of enrichedPdfData) {
      if (docType !== 'generic') continue;
      for (const p of pages) {
        const fields = parseGeneric(p.text);
        for (const { label, value } of fields) {
          genRows.push({
            'File':  file.name,
            'Page':  p.page,
            'Label': strip(label),
            'Value': strip(value),
          });
        }
      }
    }
    if (genRows.length) {
      const ws = XLSX.utils.json_to_sheet(genRows);
      ws['!autofilter'] = { ref: 'A1:D1' };
      XLSX.utils.book_append_sheet(wb, ws, 'Fields');
    }

    if (!wb.SheetNames.length) {
      alert('No data to export.');
      return;
    }

    XLSX.writeFile(wb, 'extract_all.xlsx');
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  return { process, render, exportExcel };

})();