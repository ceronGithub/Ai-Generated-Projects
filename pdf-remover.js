function removeFile(index) {
    uploadedFiles.splice(index, 1);
    capturedResults = [];
    document.getElementById('results-output').innerHTML = "File removed. New scan required.";
    document.getElementById('download-btn').style.display = 'none';
    refreshFileList();
}

function refreshFileList() {
    const list = document.getElementById('file-registry');
    list.innerHTML = "";
    uploadedFiles.forEach((file, idx) => {
        const li = document.createElement('li');
        li.style.borderBottom = "1px solid var(--accent)";
        li.style.padding = "10px 0";
        li.innerHTML = `
            <span style="font-size: 0.8rem; display: block; margin-bottom:5px;">${file.name}</span>
            <button class="cosmic-btn" style="padding:2px 8px; font-size:10px;" onclick="viewPdf(${idx})">VIEW</button>
            <button class="cosmic-btn" style="padding:4px 8px; font-size:10px; background:#ff4d4d; color:#fff;" onclick="removeFile(${idx})">REMOVE</button>
        `;
        list.appendChild(li);
    });
}