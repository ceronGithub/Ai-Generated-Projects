/* attachments.js — House Rules image selection */
(function () {

  const grid    = document.getElementById('attachGrid');
  const summary = document.getElementById('attachSummary');
  const btnAll  = document.getElementById('btnSelectAll');
  const btnClr  = document.getElementById('btnClearAll');
  const addCard  = document.getElementById('attachAddCard');
  const addInput = document.getElementById('attachAddInput');

  // ── Persistence layer ──────────────────────────────────────────────────
  // House-rules images live as embedded base64 in index.html, but the
  // browser can't rewrite that file from JavaScript. So replaced/added
  // photos are saved to localStorage instead — on every future page load
  // (future bookings), saved overrides are re-applied over the defaults
  // baked into the HTML, making the change persist for this browser/device.
  const STORAGE_PREFIX   = 'vhHouseRuleImage_';   // + index  → base64 src override for an existing/added card
  const STORAGE_TITLE_PREFIX = 'vhHouseRuleTitle_'; // + index → custom title for an added card
  const STORAGE_ADDED_LIST   = 'vhHouseRuleAddedIndexes'; // JSON array of indexes that are user-added (not original 17)

  function getAddedIndexes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_ADDED_LIST) || '[]');
    } catch (_) { return []; }
  }

  function saveAddedIndexes(arr) {
    try { localStorage.setItem(STORAGE_ADDED_LIST, JSON.stringify(arr)); } catch (_) { /* storage full or blocked — ignore */ }
  }

  function saveImageOverride(index, dataUrl) {
    try { localStorage.setItem(STORAGE_PREFIX + index, dataUrl); } catch (e) {
      console.warn('[attachments] Could not save image (storage full?)', e);
    }
  }

  function saveTitleOverride(index, title) {
    try { localStorage.setItem(STORAGE_TITLE_PREFIX + index, title); } catch (_) { /* ignore */ }
  }

  function loadImageOverride(index) {
    try { return localStorage.getItem(STORAGE_PREFIX + index); } catch (_) { return null; }
  }

  function loadTitleOverride(index) {
    try { return localStorage.getItem(STORAGE_TITLE_PREFIX + index); } catch (_) { return null; }
  }

  // ── Compress an image file to a smaller base64 JPEG before saving ───────
  // Keeps localStorage usage reasonable (it has a ~5-10MB ceiling per
  // origin) and keeps emails fast to send. Mirrors the same approach
  // email.js already uses for outgoing attachments.
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

  // Single click handler for the grid — checks the replace button FIRST and
  // returns early so clicking it never also toggles the card's selection.
  // (Two separate listeners on the same element both still run on stopPropagation;
  // only an early return here reliably prevents the selection toggle below.)
  grid.addEventListener('click', function(e) {
    var replaceBtn = e.target.closest('.attach-replace-btn');
    if (replaceBtn) {
      var replaceItem = replaceBtn.closest('.attach-item');
      var fileInput = replaceItem.querySelector('.attach-replace-input');
      if (fileInput) fileInput.click();
      return; // do not fall through to selection toggle
    }

    var item = e.target.closest('.attach-item');
    if (!item) return;
    item.classList.toggle('selected');
    updateSummary();
  });

  // Select all
  btnAll.addEventListener('click', function() {
    document.querySelectorAll('.attach-item').forEach(function(el) {
      el.classList.add('selected');
    });
    updateSummary();
  });

  // Clear all
  btnClr.addEventListener('click', function() {
    document.querySelectorAll('.attach-item').forEach(function(el) {
      el.classList.remove('selected');
    });
    updateSummary();
  });

  // ── AUTO-SELECT ALL on page load ──
  // (Saved overrides are restored further below, right before this runs,
  // so newly-rebuilt "added" cards are included in the initial selection.)
  restoreSavedOverrides();
  document.querySelectorAll('.attach-item[data-index]').forEach(function(el) {
    el.classList.add('selected');
  });
  updateSummary();

  /* ── Replace image (simple upload, stays in place AND saved) ───────────
     Each .attach-item has its own hidden <input type="file"> + a small
     replace button (handled in the click listener above, which opens that
     card's own file picker — never a shared/global one, so the right card
     always gets the right file). Once a file is chosen here, it's
     compressed, swapped into that card's <img src> immediately, AND saved
     to localStorage keyed by the card's index — so the next time this
     page loads (the next booking), the saved override is re-applied over
     the original embedded image automatically. */
  grid.addEventListener('change', function (e) {
    var fileInput = e.target.closest('.attach-replace-input');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;

    var file  = fileInput.files[0];
    var item  = fileInput.closest('.attach-item');
    var img   = item.querySelector('img');
    var index = item.dataset.index;

    compressImageFile(file, 900, 0.8).then(function (dataUrl) {
      img.src = dataUrl;

      // Persist so the replacement is still there on the next booking,
      // not just for the rest of this page session.
      saveImageOverride(index, dataUrl);

      // Reset the input so choosing the same file again still fires 'change'
      fileInput.value = '';

      // Brief visual confirmation that the swap worked — card stays in place
      item.classList.remove('replaced');
      // Force reflow so the animation can re-trigger on repeated replacements
      void item.offsetWidth;
      item.classList.add('replaced');

      // Keep the live email preview in sync if it's currently open —
      // never force it open just because a thumbnail was swapped.
      if (typeof window.refreshEmailPreviewIfOpen === 'function') {
        window.refreshEmailPreviewIfOpen();
      }
    }).catch(function (err) {
      console.warn('[attachments] Image replace failed:', err);
    });
  });

  /* ── Add new photo (new card, also saved) ───────────────────────────────
     Clicking the dashed "+ Add Photo" card opens its own file picker.
     A new .attach-item card is built, inserted just before the Add card
     so it keeps appearing last, selected by default, and saved to
     localStorage (image + a generated index) so it persists across
     reloads and shows up again on future bookings. */
  if (addCard && addInput) {
    addCard.addEventListener('click', function () {
      addInput.click();
    });

    addInput.addEventListener('change', function () {
      if (!addInput.files || !addInput.files[0]) return;
      var file = addInput.files[0];

      compressImageFile(file, 900, 0.8).then(function (dataUrl) {
        // New index = one higher than the current highest index in the grid,
        // so it never collides with an existing card.
        var existingIndexes = [...document.querySelectorAll('.attach-item[data-index]')]
          .map(function (el) { return parseInt(el.dataset.index, 10); })
          .filter(function (n) { return !isNaN(n); });
        var newIndex = (existingIndexes.length ? Math.max.apply(null, existingIndexes) : 0) + 1;
        var title = 'Custom Rule ' + newIndex;

        var newItem = buildAttachItem(newIndex, title, dataUrl, true);
        addCard.parentNode.insertBefore(newItem, addCard);

        // Persist the new card so it reappears on future bookings too.
        saveImageOverride(newIndex, dataUrl);
        saveTitleOverride(newIndex, title);
        var added = getAddedIndexes();
        added.push(newIndex);
        saveAddedIndexes(added);

        // Reset input so adding another photo right after still fires 'change'
        addInput.value = '';

        updateSummary();
        if (typeof window.refreshEmailPreviewIfOpen === 'function') {
          window.refreshEmailPreviewIfOpen();
        }
      }).catch(function (err) {
        console.warn('[attachments] Add photo failed:', err);
      });
    });
  }

  /* ── Build a new .attach-item card element (used for added photos) ───── */
  function buildAttachItem(index, title, dataUrl, selected) {
    var div = document.createElement('div');
    div.className = 'attach-item' + (selected ? ' selected' : '');
    div.dataset.index = String(index);
    div.dataset.title = title;

    var img = document.createElement('img');
    img.src = dataUrl;
    img.alt = title;
    div.appendChild(img);

    var check = document.createElement('div');
    check.className = 'attach-check';
    check.innerHTML = '&#10003;';
    div.appendChild(check);

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

  /* ── Restore saved overrides on page load ───────────────────────────────
     Runs once at init, before the user does anything. Re-applies any
     image/title that was saved to localStorage from a previous session:
       1. Existing cards (index 1–17) — swap the <img src> if a saved
          override exists for that index.
       2. User-added cards from previous sessions — rebuild those cards
          and insert them before the Add Photo card. */
  function restoreSavedOverrides() {
    // 1. Re-apply overrides on the original 17 cards
    document.querySelectorAll('.attach-item[data-index]').forEach(function (el) {
      var index = el.dataset.index;
      var savedImg = loadImageOverride(index);
      if (savedImg) {
        var img = el.querySelector('img');
        if (img) img.src = savedImg;
      }
    });

    // 2. Rebuild any previously user-added cards
    var addedIndexes = getAddedIndexes();
    if (addedIndexes.length && addCard) {
      addedIndexes.forEach(function (index) {
        var savedImg = loadImageOverride(index);
        if (!savedImg) return; // was saved but data missing/cleared — skip
        var title = loadTitleOverride(index) || ('Custom Rule ' + index);
        var newItem = buildAttachItem(index, title, savedImg, true);
        addCard.parentNode.insertBefore(newItem, addCard);
      });
    }
  }

  // Expose to email.js
  window.getSelectedImages = function() {
    return getSelected().map(function(el) {
      return {
        index: el.dataset.index,
        title: el.dataset.title,
        file:  'rule' + el.dataset.index + '.png'
      };
    });
  };

  window.clearSelectedImages = function() {
    document.querySelectorAll('.attach-item').forEach(function(el) {
      el.classList.remove('selected');
    });
    updateSummary();
  };

})();