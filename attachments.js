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

  // Toggle on click
  grid.addEventListener('click', function(e) {
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