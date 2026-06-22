/* attachments.js — House Rules image gallery, backed entirely by Cloudflare R2
 *
 * No more embedded base64 and no more localStorage overrides. On page load
 * this fetches the current image list straight from R2 (via the Worker's
 * GET /list) and builds the grid from that. Adding or replacing a photo
 * uploads directly to R2 (via POST /upload) and swaps the card's <img src>
 * to the new public CDN URL — so the change is live for every visitor
 * immediately, not just saved to this one browser.
 */
(function () {

  const grid    = document.getElementById('attachGrid');
  const summary = document.getElementById('attachSummary');
  const status  = document.getElementById('attachStatus');
  const btnAll  = document.getElementById('btnSelectAll');
  const btnClr  = document.getElementById('btnClearAll');
  const addCard  = document.getElementById('attachAddCard');
  const addInput = document.getElementById('attachAddInput');

  // ── Compress an image file to a smaller JPEG data URL before uploading ──
  // Keeps uploads fast and well under the Worker's 5MB limit.
  function compressImageFile(file, maxPx, quality) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          const ratio  = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1);
          canvas.width  = Math.round(img.naturalWidth  * ratio);
          canvas.height = Math.round(img.naturalHeight * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = evt.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Upload a compressed data URL straight to R2 via the Worker ──────────
  // Returns the public CDN URL + R2 object key for the new file.
  async function uploadDataUrlToR2(dataUrl, title) {
    const base64     = dataUrl.split(',')[1];
    const byteString = atob(base64);
    const byteArray  = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    const form = new FormData();
    form.append('file', blob, (title || 'house-rule') + '.jpg');
    form.append('title', title || 'House Rule');

    const res = await fetch(window.R2_WORKER_URL + '/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed: ' + (await res.text()));

    const json = await res.json();
    if (!json.success || !json.url) throw new Error('R2 Worker returned no URL');
    return { url: json.url, key: json.key };
  }

  function getSelected() {
    return [...document.querySelectorAll('.attach-item.selected')];
  }

  function updateSummary() {
    const sel = getSelected();
    if (sel.length === 0) {
      summary.textContent = 'No images selected';
      summary.classList.remove('has-items');
    } else {
      const names = sel.map(el => el.dataset.title).join(', ');
      summary.textContent = sel.length + ' selected: ' + names;
      summary.classList.add('has-items');
    }
  }

  // ── Status line above the summary — loading / error+retry / empty state ─
  function setStatus(text, isError, retryFn) {
    status.innerHTML = '';
    status.classList.toggle('error', !!isError);
    if (!text) return;
    const span = document.createElement('span');
    span.textContent = text;
    status.appendChild(span);
    if (isError && typeof retryFn === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'attach-retry';
      btn.textContent = 'Retry';
      btn.addEventListener('click', retryFn);
      status.appendChild(btn);
    }
  }

  function showSkeletons(count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'attach-item skeleton';
      grid.insertBefore(el, addCard);
    }
  }

  function removeSkeletons() {
    grid.querySelectorAll('.attach-item.skeleton').forEach(el => el.remove());
  }

  // Single click handler for the grid — checks the replace and delete buttons
  // FIRST and returns early so clicking them never also toggles card selection.
  grid.addEventListener('click', function(e) {
    // Short-circuit for the delete button — its own listener handles the action
    if (e.target.closest('.attach-delete-btn')) return;

    var replaceBtn = e.target.closest('.attach-replace-btn');
    if (replaceBtn) {
      var replaceItem = replaceBtn.closest('.attach-item');
      var fileInput = replaceItem.querySelector('.attach-replace-input');
      if (fileInput) fileInput.click();
      return; // do not fall through to selection toggle
    }

    var item = e.target.closest('.attach-item');
    if (!item || item === addCard) return;
    item.classList.toggle('selected');
    updateSummary();
  });

  // Select all
  btnAll.addEventListener('click', function() {
    document.querySelectorAll('.attach-item[data-key]').forEach(function(el) {
      el.classList.add('selected');
    });
    updateSummary();
  });

  // Clear all
  btnClr.addEventListener('click', function() {
    document.querySelectorAll('.attach-item[data-key]').forEach(function(el) {
      el.classList.remove('selected');
    });
    updateSummary();
  });

  // ── Load the gallery straight from R2 on page load ──
  loadGallery();

  /* ── loadGallery
     Fetches the current house-rules image list from R2 (via the Worker's
     GET /list), clears any previous cards, and rebuilds the grid from the
     response — every image auto-selected by default. Shows a pulsing
     skeleton while loading and a retry option if the fetch fails. */
  async function loadGallery() {
    setStatus('Loading house rules…');
    grid.querySelectorAll('.attach-item[data-key]').forEach(el => el.remove());
    showSkeletons(6);

    try {
      const res = await fetch(window.R2_WORKER_URL + '/list');
      if (!res.ok) throw new Error('Worker returned ' + res.status);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'List failed');

      removeSkeletons();

      if (json.images.length === 0) {
        setStatus('No house rule images yet — click "+ Add Photo" to upload the first one.');
        updateSummary();
        return;
      }

      json.images.forEach(function (img) {
        var item = buildAttachItem(img.key, img.title, img.url, true);
        addCard.parentNode.insertBefore(item, addCard);
      });

      setStatus('');
      updateSummary();
    } catch (err) {
      console.warn('[attachments] Failed to load gallery from R2:', err);
      removeSkeletons();
      setStatus('Failed to load house rules.', true, loadGallery);
      updateSummary();
    }
  }

  /* ── Replace image (uploads to R2, swaps in place) ──────────────────────
     Each .attach-item has its own hidden <input type="file"> + a small
     replace button (handled in the click listener above, which opens that
     card's own file picker — never a shared/global one). Once a file is
     chosen, it's compressed, uploaded to R2 under the card's existing
     title, and the card's <img src> + data-key are swapped to the new
     object — live for every visitor, not just this browser. */
  grid.addEventListener('change', function (e) {
    var fileInput = e.target.closest('.attach-replace-input');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;

    var file  = fileInput.files[0];
    var item  = fileInput.closest('.attach-item');
    var img   = item.querySelector('img');
    var title = item.dataset.title;

    item.classList.add('uploading');

    compressImageFile(file, 900, 0.8)
      .then(function (dataUrl) { return uploadDataUrlToR2(dataUrl, title); })
      .then(function (result) {
        img.src = result.url;
        item.dataset.key = result.key;

        // Reset the input so choosing the same file again still fires 'change'
        fileInput.value = '';
        item.classList.remove('uploading');

        // Brief visual confirmation that the swap worked — card stays in place
        item.classList.remove('replaced');
        void item.offsetWidth; // force reflow so the animation can re-trigger
        item.classList.add('replaced');

        // Keep the live email preview in sync if it's currently open —
        // never force it open just because a thumbnail was swapped.
        if (typeof window.refreshEmailPreviewIfOpen === 'function') {
          window.refreshEmailPreviewIfOpen();
        }
      })
      .catch(function (err) {
        console.warn('[attachments] Image replace failed:', err);
        item.classList.remove('uploading');
        setStatus('Upload failed — please try again.', true);
        setTimeout(function () { setStatus(''); }, 4000);
      });
  });

  /* ── Add new photo (uploads to R2, new card) ─────────────────────────────
     Clicking the dashed "+ Add Photo" card opens its own file picker. The
     file is compressed, uploaded to R2 under an auto-generated title, and
     a new .attach-item card is built from the returned URL, inserted just
     before the Add card so it keeps appearing last and selected by default. */
  if (addCard && addInput) {
    addCard.addEventListener('click', function () {
      addInput.click();
    });

    addInput.addEventListener('change', function () {
      if (!addInput.files || !addInput.files[0]) return;
      var file = addInput.files[0];

      var existingCount = document.querySelectorAll('.attach-item[data-key]').length;
      var title = 'Custom Rule ' + (existingCount + 1);

      addCard.classList.add('uploading');

      compressImageFile(file, 900, 0.8)
        .then(function (dataUrl) { return uploadDataUrlToR2(dataUrl, title); })
        .then(function (result) {
          var newItem = buildAttachItem(result.key, title, result.url, true);
          addCard.parentNode.insertBefore(newItem, addCard);

          // Reset input so adding another photo right after still fires 'change'
          addInput.value = '';
          addCard.classList.remove('uploading');

          updateSummary();
          if (typeof window.refreshEmailPreviewIfOpen === 'function') {
            window.refreshEmailPreviewIfOpen();
          }
        })
        .catch(function (err) {
          console.warn('[attachments] Add photo failed:', err);
          addCard.classList.remove('uploading');
          setStatus('Upload failed — please try again.', true);
          setTimeout(function () { setStatus(''); }, 4000);
        });
    });
  }

  /* ── deleteFromR2 ───────────────────────────────────────────────────────
     Calls the Worker's DELETE /delete?key={key} endpoint to permanently
     remove the image from the R2 bucket. Throws on failure so the caller
     can handle the error state without leaving the card in a broken state. */
  async function deleteFromR2(key) {
    var res = await fetch(window.R2_WORKER_URL + '/delete?key=' + encodeURIComponent(key), {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed: ' + (await res.text()));
    var json = await res.json();
    if (!json.success) throw new Error(json.message || 'R2 delete returned failure');
  }

  /* ── Build a new .attach-item card element from an R2 image ───────────── */
  function buildAttachItem(key, title, url, selected) {
    var div = document.createElement('div');
    div.className = 'attach-item' + (selected ? ' selected' : '');
    div.dataset.key = key;
    div.dataset.title = title;

    var img = document.createElement('img');
    img.src = url;
    img.alt = title;
    div.appendChild(img);

    var check = document.createElement('div');
    check.className = 'attach-check';
    check.innerHTML = '&#10003;';
    div.appendChild(check);

    // ── Delete button (top-left corner, red trash icon) ────────────────
    // Calls deleteFromR2() to remove the image from the bucket permanently,
    // then animates and removes the card from the DOM on success.
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'attach-delete-btn';
    deleteBtn.title = 'Delete image';
    deleteBtn.innerHTML = '&#128465;'; // 🗑 trash icon
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation(); // Prevent card selection toggle when clicking delete

      var cardKey   = div.dataset.key;
      var cardTitle = div.dataset.title;

      if (!window.confirm('Delete "' + cardTitle + '" from house rules? This cannot be undone.')) return;

      div.classList.add('deleting');

      deleteFromR2(cardKey)
        .then(function () {
          setTimeout(function () {
            div.remove();
            updateSummary();
            var remaining = document.querySelectorAll('.attach-item[data-key]').length;
            if (remaining === 0) {
              setStatus('No house rule images yet — click "+ Add Photo" to upload the first one.');
            }
            if (typeof window.refreshEmailPreviewIfOpen === 'function') {
              window.refreshEmailPreviewIfOpen();
            }
          }, 300); // Wait for the CSS deletion animation to finish
        })
        .catch(function (err) {
          div.classList.remove('deleting');
          setStatus('Delete failed — please try again.', true);
          setTimeout(function () { setStatus(''); }, 4000);
        });
    });
    div.appendChild(deleteBtn);

    var replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'attach-replace-btn';
    replaceBtn.title = 'Replace image';
    replaceBtn.innerHTML = '&#8635;';
    div.appendChild(replaceBtn);

    var replaceInput = document.createElement('input');
    replaceInput.type = 'file';
    replaceInput.className = 'attach-replace-input';
    replaceInput.accept = 'image/*';
    replaceInput.hidden = true;
    div.appendChild(replaceInput);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'attach-name';
    nameSpan.textContent = title;
    div.appendChild(nameSpan);

    return div;
  }

  // Expose to email.js / preview.js — both just need title + the live R2 URL.
  window.getSelectedImages = function() {
    return getSelected().map(function(el) {
      return {
        key:   el.dataset.key,
        title: el.dataset.title,
        url:   el.querySelector('img').src,
      };
    });
  };

  window.clearSelectedImages = function() {
    document.querySelectorAll('.attach-item[data-key]').forEach(function(el) {
      el.classList.remove('selected');
    });
    updateSummary();
  };

})();
