const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeHelp = document.querySelector('.close-help');

helpBtn.onclick = () => helpModal.style.display = 'flex';
closeHelp.onclick = () => helpModal.style.display = 'none';
window.onclick = (e) => { if (e.target === helpModal) helpModal.style.display = 'none'; };