/* email.js — Compose email with real sending via EmailJS + ImgBB image hosting */
(function () {

  const EMAILJS_PUBLIC_KEY  = 'cUR1LKEI711O_10So';
  const EMAILJS_SERVICE_ID  = 'service_vixkwte';
  const EMAILJS_TEMPLATE_ID = 'template_myq5r3j';

  // ── ImgBB free API key — get yours free at https://api.imgbb.com ──
  // 1. Go to https://api.imgbb.com
  // 2. Sign up free
  // 3. Copy your API key and paste it below
  const IMGBB_API_KEY = 'cfdf8e00fe53e07fdd4d498d23a65c74';

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

  // ── Compress image to tiny JPEG via Canvas ──
  function compressImage(imgEl, maxPx, quality) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ratio  = Math.min(maxPx / imgEl.naturalWidth, maxPx / imgEl.naturalHeight, 1);
      canvas.width  = Math.round(imgEl.naturalWidth  * ratio);
      canvas.height = Math.round(imgEl.naturalHeight * ratio);
      canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      // return raw base64 without the data:image/jpeg;base64, prefix
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    });
  }

  // ── Upload base64 image to ImgBB, returns a public https:// URL ──
  async function uploadToImgBB(base64, name) {
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64);
    form.append('name', name);
    const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error));
    return json.data.url; // real https:// URL
  }

  btnSend.addEventListener('click', async () => {
    if (isSending) return;

    const to   = fields.to.value.trim();
    const body = fields.body.value.trim();

    if (!to)               { shakeField(fields.to); return; }
    if (!isValidEmail(to)) { shakeField(fields.to); return; }

    // Guard: ImgBB key not set
    if (IMGBB_API_KEY === 'YOUR_IMGBB_API_KEY') {
      showToast('Add your ImgBB API key in email.js to send images', true);
      return;
    }

    isSending = true;
    btnSend.style.opacity = '0.7';
    btnSend.style.pointerEvents = 'none';

    // ── Collect selected images (auto-select all if none chosen) ──
    let selected = (typeof window.getSelectedImages === 'function')
      ? window.getSelectedImages() : [];

    if (selected.length === 0) {
      selected = [...document.querySelectorAll('.attach-item')].map(el => ({
        index: el.dataset.index,
        title: el.dataset.title,
      }));
    }

    // ── Step 1: Compress ──
    btnSend.innerHTML = `Compressing <span style="opacity:.6">(${selected.length} images)</span>`;
    const compressed = [];
    for (const item of selected) {
      const imgEl = document.querySelector(`.attach-item[data-index="${item.index}"] img`);
      if (!imgEl) continue;
      const b64 = await compressImage(imgEl, 800, 0.75);
      compressed.push({ ...item, b64 });
    }

    // ── Step 2: Upload to ImgBB ──
    btnSend.innerHTML = `Uploading <span style="opacity:.6">(0 / ${compressed.length})</span>`;
    const imgBlocks = [];
    for (let i = 0; i < compressed.length; i++) {
      const item = compressed[i];
      btnSend.innerHTML = `Uploading <span style="opacity:.6">(${i + 1} / ${compressed.length})</span>`;
      try {
        const url = await uploadToImgBB(item.b64, `house-rule-${item.index}-${item.title}`);
        imgBlocks.push(
          `<td style="padding:6px;text-align:center;vertical-align:top;width:25%;">` +
          `<img src="${url}" alt="${item.title}" width="200" ` +
          `style="width:200px;max-width:200px;border-radius:8px;display:block;margin:0 auto;" /><br/>` +
          `<span style="font-size:10px;color:#666;text-transform:uppercase;` +
          `letter-spacing:0.06em;font-family:Arial,sans-serif;">${item.title}</span>` +
          `</td>`
        );
      } catch(e) {
        console.warn('Upload failed for', item.title, e);
      }
    }

    // ── Step 3: Build HTML rows (3 per row) ──
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

    // ── Step 3b: Closing text (set by booking.js) ──
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
  <tr><td style="padding:0 0 6px;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;"><strong>IMPORTANT:</strong></td></tr>
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
      `<p style="font-size:11px;color:#aaa;margin:0;">` +
      `Sent via Victoria&#39;s Haven &bull; official.victoriashaven@gmail.com</p>` +
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

    console.log(`Sending: ${imgBlocks.length} images uploaded | body: ${(htmlBody.length/1024).toFixed(1)}KB`);

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
      showToast(`Sent with ${imgBlocks.length} house rule image${imgBlocks.length !== 1 ? 's' : ''} ✓`, false);
      clearForm();
      if (typeof window.clearSelectedImages === 'function') window.clearSelectedImages();
      // ── Auto-return to New Booking form after 2 seconds ──
      setTimeout(() => {
        const compose = document.getElementById('composeStep');
        const booking = document.getElementById('bookingForm');
        if (compose && booking) {
          compose.style.display = 'none';
          booking.style.display = '';
          window.scrollTo(0, 0);
          // Reset all booking form inputs
          ['bGuestName','bCheckinDate','bCheckinTime','bDownPayment','bBalance',
           'bDatePayment','bRefNumber','bEmailTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = id === 'bCheckinTime' ? '16:00' : '';
          });
          document.querySelectorAll('.tour-btn').forEach(b => b.classList.remove('active'));
          document.getElementById('bDateDisplay').textContent = 'Select a date and tour type';
          document.getElementById('bCheckoutDisplay').textContent = 'Check-out: —';
          document.getElementById('bookingError').textContent = '';
          window._bookingDetails = null;
          window._emailClosing = null;
        }
      }, 2000);
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

  fields.body.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.max(200, this.scrollHeight) + 'px';
  });

  [fields.from, fields.subject].forEach(el => {
    el.addEventListener('keydown', e => e.preventDefault());
  });

})();