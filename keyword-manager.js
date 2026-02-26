const tagContainer = document.getElementById('tag-container');
const keywordInput = document.getElementById('keyword-search');

keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = keywordInput.value.trim().toLowerCase();
        if (val && !activeKeywords.includes(val)) {
            activeKeywords.push(val);
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `<span>${val}</span><span class="remove-tag" onclick="removeTag('${val}', this)">&times;</span>`;
            tagContainer.insertBefore(tag, keywordInput);
        }
        keywordInput.value = '';
    }
});

function removeTag(text, element) {
    activeKeywords = activeKeywords.filter(k => k !== text);
    element.parentElement.remove();
}