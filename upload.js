document.getElementById('pdf-input').onchange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const idx = uploadedFiles.push(file) - 1;
        const li = document.createElement('li');
        li.innerHTML = `<span>${file.name}</span> <button class="cosmic-btn" style="padding:2px 5px; font-size:10px;" onclick="viewPdf(${idx})">VIEW</button>`;
        document.getElementById('file-registry').appendChild(li);
    });
};