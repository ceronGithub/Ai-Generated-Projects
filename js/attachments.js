/* attachments.js — House Rules image selection */
(function () {

  const grid    = document.getElementById('attachGrid');
  const summary = document.getElementById('attachSummary');
  const btnAll  = document.getElementById('btnSelectAll');
  const btnClr  = document.getElementById('btnClearAll');

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
  document.querySelectorAll('.attach-item').forEach(function(el) {
    el.classList.add('selected');
  });
  updateSummary();

  /* ── Replace image (simple upload, stays in place) ─────────────────────
     Each .attach-item has its own hidden <input type="file"> + a small
     replace button (handled in the click listener above, which opens that
     card's own file picker — never a shared/global one, so the right card
     always gets the right file). Once a file is chosen here, it's read as
     a base64 data URL and swapped directly into that card's <img src> —
     the card stays exactly where it is in the grid, selection state is
     untouched, and the live email preview (if open) picks up the new
     image automatically since preview.js reads straight from the DOM
     img.src at send/preview time. */
  grid.addEventListener('change', function (e) {
    var fileInput = e.target.closest('.attach-replace-input');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;

    var file = fileInput.files[0];
    var item = fileInput.closest('.attach-item');
    var img  = item.querySelector('img');

    // Read the chosen file as a base64 data URL so it's embedded the same
    // way the original house-rules images are stored (no external hosting
    // needed, works immediately in the live preview and the sent email).
    var reader = new FileReader();
    reader.onload = function (evt) {
      img.src = evt.target.result;

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
    };
    reader.readAsDataURL(file);
  });

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