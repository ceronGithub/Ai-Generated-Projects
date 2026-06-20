/* preview.js — Live email preview panel */
(function () {

  const btnToggle  = document.getElementById('btnTogglePreview');
  const previewBody = document.getElementById('previewBody');
  const previewFrame = document.getElementById('previewFrame');
  const previewCard  = document.getElementById('emailPreview');
  const emailBody    = document.getElementById('emailBody');

  let isOpen = false;

  // ── Toggle open/close ──
  btnToggle.addEventListener('click', () => {
    isOpen = !isOpen;
    previewBody.style.display = isOpen ? '' : 'none';
    btnToggle.textContent     = isOpen ? 'Hide Preview ▴' : 'Show Preview ▾';
    previewCard.classList.toggle('open', isOpen);
    if (isOpen) renderPreview();
  });

  // ── Auto-update preview when message changes ──
  emailBody.addEventListener('input', () => {
    if (isOpen) renderPreview();
  });

  // Also update when booking details are set (called from booking.js)
  window.refreshEmailPreview = function () {
    if (isOpen) renderPreview();
    // If closed, open it automatically when proceeding to compose
    if (!isOpen) {
      isOpen = true;
      previewBody.style.display = '';
      btnToggle.textContent = 'Hide Preview ▴';
      previewCard.classList.add('open');
      renderPreview();
    }
  };

  // Soft refresh — updates the preview content only if it's already open.
  // Used after minor in-place changes (like replacing a house-rules image)
  // where we never want to force the preview panel open on its own.
  window.refreshEmailPreviewIfOpen = function () {
    if (isOpen) renderPreview();
  };

  function renderPreview() {
    const bd      = window._bookingDetails || {};
    const closing = window._emailClosing   || '';
    const body    = emailBody.value.trim() || '';
    const to      = document.getElementById('emailTo').value.trim() || '—';
    const subject = document.getElementById('emailSubject').value.trim();

    // ── Booking details bold block ──
    let bookingBlock = '';
    if (bd.guestName) {
      bookingBlock = `
        <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
          <tr><td style="padding:0 0 5px;font-size:15px;color:#1a1a1a;"><strong>Booking Details:</strong></td></tr>
          <tr><td style="padding:0 0 4px;font-size:15px;color:#1a1a1a;"><strong>Your Check-in time is ${bd.checkinStr} and Check-out is ${bd.checkoutStr}.</strong></td></tr>
          <tr><td style="padding:0 0 4px;font-size:15px;color:#1a1a1a;"><strong>Date of booking: ${bd.dateBooking}</strong></td></tr>
          <tr><td style="padding:0 0 0;font-size:15px;color:#1a1a1a;"><strong>Upon check-in, please provide one valid ID and settle the balance.</strong></td></tr>
        </table>`;
    }

    // ── Parse message body: split on BOOKING_DETAILS_PLACEHOLDER ──
    let bodyHtml = '';
    if (body.includes('BOOKING_DETAILS_PLACEHOLDER')) {
      const parts = body.split('BOOKING_DETAILS_PLACEHOLDER');
      bodyHtml =
        `<p style="font-size:15px;white-space:pre-wrap;margin:0 0 12px;">${escHtml(parts[0])}</p>` +
        bookingBlock +
        `<p style="font-size:15px;white-space:pre-wrap;margin:0 0 12px;">${escHtml(parts[1] || '')}</p>`;
    } else if (body) {
      bodyHtml = `<p style="font-size:15px;white-space:pre-wrap;margin:0 0 12px;">${escHtml(body)}</p>`;
    } else {
      bodyHtml = `<p style="color:#999;font-size:14px;font-style:italic;">No message yet...</p>`;
    }

    // ── House rules thumbnails (selected) ──
    const selected = (typeof window.getSelectedImages === 'function')
      ? window.getSelectedImages() : [];

    let imagesSection = '';
    if (selected.length > 0) {
      let cells = '';
      selected.forEach(item => {
        const imgEl = document.querySelector(`.attach-item[data-index="${item.index}"] img`);
        const src   = imgEl ? imgEl.src : '';
        cells += `<td style="padding:4px;text-align:center;vertical-align:top;width:25%;">
          <img src="${src}" style="width:140px;height:140px;object-fit:cover;border-radius:6px;display:block;margin:0 auto;" />
          <div style="font-size:9px;color:#777;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">${item.title}</div>
        </td>`;
      });
      // Rows of 4
      let rows = '';
      const arr = cells.match(/<td[\s\S]*?<\/td>/g) || [];
      for (let i = 0; i < arr.length; i += 4) {
        const row = arr.slice(i, i + 4);
        while (row.length < 4) row.push('<td></td>');
        rows += `<tr>${row.join('')}</tr>`;
      }
      imagesSection = `
        <hr style="border:none;border-top:2px solid #e8e8e8;margin:20px 0 16px;" />
        <p style="font-size:12px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">
          📌 House Rules — ${selected.length} Card${selected.length !== 1 ? 's' : ''}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
    }

    // ── Closing ──
    const closingHtml = closing
      ? `<p style="font-size:14px;white-space:pre-wrap;margin:16px 0 0;">${
          escHtml(closing)
            .replace(/(We kindly request an acknowledgment of this transaction\.)/g, '<strong>$1</strong>')
        }</p>`
      : '';

    // ── Full preview HTML ──
    previewFrame.innerHTML = `
      <!-- Email meta bar -->
      <div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#555;">
        <div><strong>To:</strong> ${escHtml(to)}</div>
        <div style="margin-top:3px;"><strong>Subject:</strong> ${escHtml(subject)}</div>
        <div style="margin-top:3px;"><strong>From:</strong> official.victoriashaven@gmail.com</div>
      </div>
      <!-- Email body -->
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;max-width:600px;">
        ${bodyHtml}
        ${imagesSection}
        ${closingHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0 10px;" />
        <p style="font-size:11px;color:#aaa;margin:0;">Sent via Victoria's Haven · official.victoriashaven@gmail.com</p>
      </div>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  // Refresh preview when attachments change
  document.addEventListener('click', e => {
    if (e.target.closest('.attach-item') || e.target.id === 'btnSelectAll' || e.target.id === 'btnClearAll') {
      setTimeout(() => { if (isOpen) renderPreview(); }, 50);
    }
  });

})();