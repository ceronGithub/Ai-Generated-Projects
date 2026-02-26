const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('pdf-input');

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
};

fileInput.onchange = (e) => handleFiles(e.target.files);

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type === "application/pdf") uploadedFiles.push(file);
    });
    if (typeof refreshFileList === 'function') refreshFileList();
}