/* email.js — Compose email with real sending via EmailJS, images served from Cloudflare R2 */
(function () {

  const EMAILJS_PUBLIC_KEY  = 'cUR1LKEI711O_10So';
  const EMAILJS_SERVICE_ID  = 'service_vixkwte';
  const EMAILJS_TEMPLATE_ID = 'template_myq5r3j';

  // R2 Worker URL lives in js/r2-config.js (loaded before this file) so
  // attachments.js and email.js never drift out of sync on which Worker
  // they're pointed at.

  const sdk = document.createElement('script');
  sdk.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  sdk.onload = () => emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  document.head.appendChild(sdk);

  const btnSend    = document.getElementById('btnSend');
  const btnDiscard = document.getElementById('btnDiscard');
  const toast      = document.getElementById('sentToast');

  const fields = {
    from:    document.getElementById('emailFrom'),
    to:      document.getElementById('emailTo'),
    subject: document.getElementById('emailSubject'),
    body:    document.getElementById('emailBody'),
  };

  let toastTimer = null;
  let isSending  = false;

  btnSend.addEventListener('click', async () => {
    if (isSending) return;

    const to   = fields.to.value.trim();
    const body = fields.body.value.trim();

    if (!to)               { shakeField(fields.to); return; }
    if (!isValidEmail(to)) { shakeField(fields.to); return; }

    // Guard: R2 Worker URL not configured yet
    if (window.R2_WORKER_URL === 'YOUR_WORKER_URL_HERE') {
      showToast('R2 Worker URL not set — see js/r2-config.js setup instructions', true);
      return;
    }

    isSending = true;
    btnSend.style.opacity = '0.7';
    btnSend.style.pointerEvents = 'none';

    // ── Collect selected images (auto-select all if none chosen) ──
    let selected = (typeof window.getSelectedImages === 'function')
      ? window.getSelectedImages() : [];

    if (selected.length === 0) {
      selected = [...document.querySelectorAll('.attach-item[data-key]')].map(el => ({
        key:   el.dataset.key,
        title: el.dataset.title,
        url:   el.querySelector('img').src,
      }));
    }

    // ── Step 1: Build image blocks straight from each card's R2 URL ──
    // Images are already hosted on Cloudflare R2 — uploaded the moment they
    // were added/replaced in the House Rules gallery — so sending no longer
    // compresses or re-uploads anything here, it just references the URLs.
    btnSend.innerHTML = `Preparing <span style="opacity:.6">(${selected.length} images)</span>`;
    const imgBlocks = selected
      .filter(item => item.url)
      .map(item =>
        `<td style="padding:6px;text-align:center;vertical-align:top;width:25%;">` +
        `<img src="${item.url}" alt="${item.title}" width="200" ` +
        `style="width:200px;max-width:200px;border-radius:8px;display:block;margin:0 auto;" /><br/>` +
        `<span style="font-size:10px;color:#666;text-transform:uppercase;` +
        `letter-spacing:0.06em;font-family:Arial,sans-serif;">${item.title}</span>` +
        `</td>`
      );

    // ── Step 2: Build HTML rows (3 per row) ──
    let tableRows = '';
    for (let i = 0; i < imgBlocks.length; i += 3) {
      const row = imgBlocks.slice(i, i + 3);
      // Pad last row if needed
      while (row.length < 3) row.push('<td></td>');
      tableRows += `<tr>${row.join('')}</tr>`;
    }

    const imagesSection = imgBlocks.length > 0 ? `
<br/>
<hr style="border:none;border-top:2px solid #e8e8e8;margin:20px 0 16px;" />
<p style="font-size:13px;font-weight:700;color:#222;font-family:Arial,sans-serif;
          text-transform:uppercase;letter-spacing:0.1em;margin:0 0 14px;">
  &#128204; House Rules &mdash; ${imgBlocks.length} Card${imgBlocks.length !== 1 ? 's' : ''}
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-collapse:collapse;max-width:660px;">
  ${tableRows}
</table>` : '';

    // ── Step 3: Closing text (set by booking.js) ──
    // Parse closing: make "We kindly request..." bold, preserve newlines as <br/>
    const rawClosing = (window._emailClosing || '');
    const closingHtml = rawClosing
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/(We kindly request an acknowledgment of this transaction\.)/g, '<strong>$1</strong>')
      .replace(/\n/g,'<br/>');
    const closingSection = closingHtml ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.9;margin:16px 0 0;">${closingHtml}</p>` : '';

    // ── Step 4: Full HTML body ──
    const bd = window._bookingDetails || {};

    // Build bold booking details block (all bold, each on new line)
    const boldDetails = bd.guestName ? `
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
  <tr><td style="padding:0 0 6px;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;"><strong>Booking Details:</strong></td></tr>
  <tr><td style="padding:0 0 4px;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;"><strong>Your Check-in time is ${bd.checkinStr} and Check-out is ${bd.checkoutStr}.</strong></td></tr>
  <tr><td style="padding:0 0 4px;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;"><strong>Date of booking: ${bd.dateBooking}</strong></td></tr>
  <tr><td style="padding:0 0 0;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;"><strong>Upon check-in, please provide one valid ID and settle the balance.</strong></td></tr>
</table>` : '';

    // Process message body - replace placeholder with bold HTML block
    let rawBody = (body || '(no message)');
    let htmlBodyContent = '';

    if (rawBody.includes('BOOKING_DETAILS_PLACEHOLDER')) {
      const parts = rawBody.split('BOOKING_DETAILS_PLACEHOLDER');
      const before = parts[0].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
      const after  = parts[1].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
      htmlBodyContent = `<p style="margin:0 0 12px;font-size:15px;">${before}</p>${boldDetails}<p style="margin:0 0 12px;font-size:15px;">${after}</p>`;
    } else {
      const safeBody = rawBody.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
      htmlBodyContent = `<p style="margin:0 0 12px;font-size:15px;">${safeBody}</p>`;
    }

    const htmlBody =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;` +
      `line-height:1.7;max-width:660px;">` +
      htmlBodyContent +
      imagesSection +
      closingSection +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0 10px;" />` +
      `<p style="font-size:11px;color:#999;margin:0 0 4px;">` +
      `Victoria&#39;s Haven Resort</p>` +
      `<p style="font-size:11px;color:#999;margin:0 0 4px;">` +
      `official.victoriashaven@gmail.com</p>` +
      `<p style="font-size:10px;color:#bbb;margin:0;">` +
      `This is a booking confirmation you requested. If this wasn&#39;t you, please disregard this message.</p>` +
      `</div>`;

    // ── Step 5: Send via EmailJS ──
    btnSend.innerHTML = 'Sending...';

    const params = {
      to_email:   to,
      from_email: fields.from.value,
      from_name:  "Victoria's Haven",
      reply_to:   fields.from.value,
      subject:    fields.subject.value,
      message:    htmlBody,
    };

    console.log(`Sending: ${imgBlocks.length} images referenced from R2 | body: ${(htmlBody.length/1024).toFixed(1)}KB`);

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);

      // ── Show success modal so the confirmation is unmissable ──────────
      // Populate the recipient line so the user can confirm who received it.
      const successOverlay   = document.getElementById('successModalOverlay');
      const successRecipient = document.getElementById('successModalRecipient');
      const successDoneBtn   = document.getElementById('successModalDoneBtn');
      if (successOverlay && successRecipient) {
        successRecipient.textContent = `Sent to: ${to}  ·  ${imgBlocks.length} image${imgBlocks.length !== 1 ? 's' : ''} included`;
        successOverlay.style.display = 'flex';
      }

      clearForm();
      if (typeof window.clearSelectedImages === 'function') window.clearSelectedImages();

      // ── Done button closes modal then returns to booking form ─────────
      // Defined inline so it captures the current `to` value in its closure.
      function handleSuccessDone() {
        if (successOverlay) successOverlay.style.display = 'none';
        if (successDoneBtn) successDoneBtn.removeEventListener('click', handleSuccessDone);
        returnToBookingForm();
      }
      if (successDoneBtn) {
        // Remove any prior listener before attaching so it never double-fires
        successDoneBtn.removeEventListener('click', handleSuccessDone);
        successDoneBtn.addEventListener('click', handleSuccessDone);
      }

      // ── Also auto-close and return after 6 seconds if user does nothing ─
      setTimeout(() => {
        if (successOverlay && successOverlay.style.display !== 'none') {
          handleSuccessDone();
        }
      }, 6000);
    } catch (err) {
      console.error('EmailJS error:', err);
      let msg = 'Failed to send';
      if (err.text && err.text.toLowerCase().includes('size'))       msg = 'Size limit — reduce images selected';
      else if (err.text && err.text.toLowerCase().includes('recip')) msg = 'Set "To Email" = {{to_email}} in EmailJS template';
      else if (err.status === 401)  msg = 'Invalid EmailJS Public Key';
      else if (err.status === 404)  msg = 'Service or Template ID not found';
      else if (err.text)            msg = err.text;
      showToast(msg, true);
    } finally {
      isSending = false;
      btnSend.innerHTML = 'Send <span>\u2192</span>';
      btnSend.style.opacity = '';
      btnSend.style.pointerEvents = '';
    }
  });

  btnDiscard.addEventListener('click', () => {
    clearForm();
    if (typeof window.clearSelectedImages === 'function') window.clearSelectedImages();
    showToast('Draft discarded', false);
  });

  function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  function clearForm() {
    fields.to.value = '';
    fields.body.value = '';
    fields.body.style.height = '';
    fields.to.focus();
  }

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.style.background  = isError ? 'rgba(239,68,68,0.1)'  : 'rgba(34,197,94,0.1)';
    toast.style.borderColor = isError ? 'rgba(239,68,68,0.3)'  : 'rgba(34,197,94,0.3)';
    toast.style.color       = isError ? '#ef4444' : '#22c55e';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function shakeField(input) {
    input.style.animation = 'none';
    requestAnimationFrame(() => { input.style.animation = 'shake 0.4s ease'; });
    setTimeout(() => input.style.animation = '', 400);
    input.focus();
  }

  const s = document.createElement('style');
  s.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}';
  document.head.appendChild(s);

  /* ── returnToBookingForm ─────────────────────────────────────────────────
     Resets every booking field and switches back from the compose step to the
     booking form. Extracted into a named function so both the success-modal
     Done button and the 6-second auto-close can call the same code path. */
  function returnToBookingForm() {
    const compose = document.getElementById('composeStep');
    const booking = document.getElementById('bookingForm');
    if (!compose || !booking) return;
    compose.style.display = 'none';
    booking.style.display = '';
    window.scrollTo(0, 0);
    ['bGuestName','bCheckinDate','bCheckinTime','bDownPayment','bBalance',
     'bDatePayment','bRefNumber','bEmailTo'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'bCheckinTime') { el.value = '16:00'; return; }
      if (id === 'bDatePayment') {
        const t = new Date();
        el.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
        return;
      }
      el.value = '';
    });
    document.querySelectorAll('.tour-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('bDateDisplay').textContent = 'Select a date and tour type';
    document.getElementById('bCheckoutDisplay').textContent = 'Check-out: —';
    document.getElementById('bookingError').textContent = '';
    window._bookingDetails = null;
    window._emailClosing = null;
    if (typeof window.resetMainCalendarSelection === 'function') {
      window.resetMainCalendarSelection();
    }
  }

  fields.body.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.max(200, this.scrollHeight) + 'px';
  });

  [fields.from, fields.subject].forEach(el => {
    el.addEventListener('keydown', e => e.preventDefault());
  });

})();

/* ══════════════════════════════════════════════════════════════════════════
 * ERROR REPORT MODAL (Task 3)
 *
 * Manages the floating bug-report button and its modal.
 *
 * DATA FLOW:
 *   1. User clicks floatingErrorBtn → error modal opens
 *   2. User types a description, attaches files or pastes screenshots
 *   3. Attached images are compressed to a data URL and kept in memory
 *   4. On send: images are embedded as base64 <img> in the HTML email body
 *   5. EmailJS sends to developerceron@gmail.com using the same service/template
 *   6. Modal closes and attachment list is cleared on success
 *
 * WHY SAME TEMPLATE: The existing EmailJS template uses {to_email} as the
 * recipient variable, so we can redirect the send to the developer without
 * creating a second template.
 * ══════════════════════════════════════════════════════════════════════════ */
(function () {

  const EMAILJS_PUBLIC_KEY  = 'cUR1LKEI711O_10So';
  const EMAILJS_SERVICE_ID  = 'service_vixkwte';
  const EMAILJS_TEMPLATE_ID = 'template_myq5r3j';

  // Pre-configured addresses — never editable by the user in this modal
  const REPORT_FROM    = 'official.victoriashaven@gmail.com';
  const REPORT_TO      = 'developerceron@gmail.com';
  const REPORT_SUBJECT = 'Emailer automation request';

  /* DOM references — all obtained once after DOMContentLoaded to be safe */
  const floatingBtn  = document.getElementById('floatingErrorBtn');
  const overlay      = document.getElementById('errorModalOverlay');
  const closeBtn     = document.getElementById('errorModalCloseBtn');
  const cancelBtn    = document.getElementById('errorModalCancelBtn');
  const sendBtn      = document.getElementById('errorModalSendBtn');
  const description  = document.getElementById('errorModalDescription');
  const attachStrip  = document.getElementById('errorModalAttachStrip');
  const attachBtn    = document.getElementById('errorModalAttachBtn');
  const attachCount  = document.getElementById('errorModalAttachCount');
  const fileInput    = document.getElementById('errorModalFileInput');

  if (!floatingBtn || !overlay) return; // guard — elements must be in the DOM

  /* ── In-memory list of attached images (data URLs) ───────────────────── */
  let errorAttachments = []; // [{ dataUrl: string, name: string }]

  /* ── Open / close helpers ──────────────────────────────────────────────── */
  function openErrorModal() {
    overlay.style.display = 'flex';
    description.focus();
  }

  function closeErrorModal() {
    overlay.style.display = 'none';
  }

  /* ── Wire open/close ─────────────────────────────────────────────────── */
  floatingBtn.addEventListener('click', openErrorModal);
  closeBtn.addEventListener('click', closeErrorModal);
  cancelBtn.addEventListener('click', closeErrorModal);

  // Close when clicking the backdrop (outside the modal box)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeErrorModal();
  });

  /* ── Compress an image file to a JPEG data URL before attaching ─────────
     Keeps emails well under EmailJS size limits even with multiple images. */
  function compressToDataUrl(file, maxPx, quality) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const ratio   = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
          const canvas  = document.createElement('canvas');
          canvas.width  = Math.round(img.naturalWidth  * ratio);
          canvas.height = Math.round(img.naturalHeight * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── Add an attachment from a data URL ──────────────────────────────────
     Renders a thumbnail in the strip and appends to errorAttachments array. */
  function addAttachment(dataUrl, name) {
    const index = errorAttachments.length;
    errorAttachments.push({ dataUrl, name });

    const thumb = document.createElement('div');
    thumb.className = 'errorAttachThumb';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = name;
    thumb.appendChild(img);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'errorAttachRemove';
    removeBtn.innerHTML = '✕';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', function () {
      // Remove this attachment from the array and re-render the strip
      const pos = errorAttachments.indexOf(errorAttachments[index]);
      errorAttachments.splice(index, 1);
      thumb.remove();
      updateAttachCount();
    });
    thumb.appendChild(removeBtn);

    attachStrip.appendChild(thumb);
    updateAttachCount();
  }

  function updateAttachCount() {
    const n = document.querySelectorAll('.errorAttachThumb').length;
    attachCount.textContent = n > 0 ? `${n} file${n !== 1 ? 's' : ''} attached` : '';
  }

  /* ── File picker ─────────────────────────────────────────────────────── */
  attachBtn.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', async function () {
    for (const file of Array.from(fileInput.files)) {
      if (file.type.startsWith('image/')) {
        // Compress images before adding
        const dataUrl = await compressToDataUrl(file, 800, 0.78);
        addAttachment(dataUrl, file.name);
      } else {
        // Non-image file — show as a named placeholder tile, not a thumbnail
        addAttachment(
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23222"/><text x="50%" y="55%" font-size="9" fill="%23aaa" text-anchor="middle" font-family="monospace">' + encodeURIComponent(file.name.slice(-6)) + '</text></svg>',
          file.name
        );
      }
    }
    // Reset so selecting the same file again still fires 'change'
    fileInput.value = '';
  });

  /* ── Clipboard paste — captures Ctrl+V / ⌘V anywhere in the modal ──────
     Only processes image items from the clipboard (screenshots). Non-image
     clipboard data (text, files) is ignored so normal paste still works. */
  overlay.addEventListener('paste', async function (e) {
    const items = Array.from((e.clipboardData || window.clipboardData).items || []);
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault(); // Prevent the image data from appearing in the textarea
      const file   = item.getAsFile();
      const dataUrl = await compressToDataUrl(file, 800, 0.78);
      addAttachment(dataUrl, 'screenshot-' + Date.now() + '.jpg');
    }
  });

  /* ── Send report ─────────────────────────────────────────────────────── */
  sendBtn.addEventListener('click', async function () {
    const desc = description.value.trim();

    if (!desc && errorAttachments.length === 0) {
      description.focus();
      description.style.borderColor = 'rgba(239,68,68,0.6)';
      setTimeout(() => { description.style.borderColor = ''; }, 2000);
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    // Build the image blocks from attached data URLs
    const thumbRows = errorAttachments
      .filter(a => a.dataUrl.startsWith('data:image/'))
      .map(a =>
        `<td style="padding:6px;text-align:center;vertical-align:top;">` +
        `<img src="${a.dataUrl}" alt="${a.name}" width="180" ` +
        `style="width:180px;border-radius:6px;display:block;margin:0 auto;" /><br/>` +
        `<span style="font-size:10px;color:#888;">${a.name}</span></td>`
      );

    let imageTable = '';
    if (thumbRows.length > 0) {
      let rows = '';
      for (let i = 0; i < thumbRows.length; i += 3) {
        const row = thumbRows.slice(i, i + 3);
        while (row.length < 3) row.push('<td></td>');
        rows += `<tr>${row.join('')}</tr>`;
      }
      imageTable =
        `<br/><hr style="border:none;border-top:1px solid #e8e8e8;margin:16px 0;"/>` +
        `<p style="font-size:12px;font-weight:700;color:#222;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">` +
        `📎 Attachments — ${thumbRows.length} image${thumbRows.length !== 1 ? 's' : ''}` +
        `</p>` +
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
        `${rows}</table>`;
    }

    const safeDesc = (desc || '(no description provided)')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');

    const htmlBody =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;max-width:660px;">` +
      `<p style="margin:0 0 8px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">` +
      `Error / Issue Report — VH-Mailer Automation</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:0 0 16px;"/>` +
      `<p style="margin:0 0 12px;">${safeDesc}</p>` +
      imageTable +
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0 10px;"/>` +
      `<p style="font-size:11px;color:#999;margin:0;">Victoria's Haven Resort — VH-Mailer Automation System</p>` +
      `</div>`;

    // Ensure EmailJS is initialised before sending (the SDK loads async)
    if (typeof emailjs !== 'undefined') {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    }

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email:   REPORT_TO,
        from_email: REPORT_FROM,
        from_name:  "VH-Mailer Automation",
        reply_to:   REPORT_FROM,
        subject:    REPORT_SUBJECT,
        message:    htmlBody,
      });

      // Reset and close on success
      description.value  = '';
      errorAttachments   = [];
      attachStrip.innerHTML = '';
      updateAttachCount();
      closeErrorModal();

      // Show a brief confirmation via the existing toast mechanism if available
      const toast = document.getElementById('sentToast');
      if (toast) {
        toast.textContent  = 'Issue report sent ✓';
        toast.style.background  = 'rgba(34,197,94,0.1)';
        toast.style.borderColor = 'rgba(34,197,94,0.3)';
        toast.style.color       = '#22c55e';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
      }
    } catch (err) {
      // Keep modal open — show error inline so the user's content isn't lost
      description.style.borderColor = 'rgba(239,68,68,0.6)';
      sendBtn.textContent = 'Failed — try again';
      setTimeout(() => {
        description.style.borderColor = '';
        sendBtn.textContent = 'Send Report →';
        sendBtn.disabled = false;
      }, 3000);
      return;
    }

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Report →';
  });

})();