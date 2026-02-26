const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

let uploadedFiles = [];
let capturedResults = [];
let activeKeywords = [];
let speed = 0.5;

function updateClock() {
    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay()) ? "Weekend" : "Weekday";
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const date = now.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('datetime-display').innerText = `${isWeekend} | ${date} | ${time}`;
}
setInterval(updateClock, 1000);

document.getElementById('theme-toggle').onclick = () => {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
};

// Starfield Logic
const starCanvas = document.getElementById('starfield-canvas');
const sCtx = starCanvas.getContext('2d');
let stars = [];
function initStars() {
    starCanvas.width = window.innerWidth; starCanvas.height = window.innerHeight;
    stars = Array.from({length: 400}, () => ({
        x: Math.random() * starCanvas.width - starCanvas.width/2,
        y: Math.random() * starCanvas.height - starCanvas.height/2,
        z: Math.random() * starCanvas.width,
        o: Math.random()
    }));
}
function animateStars() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    sCtx.fillStyle = isLight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    sCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);
    stars.forEach(s => {
        s.z -= speed; if (s.z <= 0) s.z = starCanvas.width;
        const x = (s.x / s.z) * starCanvas.width + (starCanvas.width / 2);
        const y = (s.y / s.z) * starCanvas.height + (starCanvas.height / 2);
        sCtx.beginPath(); sCtx.arc(x, y, (1 - s.z / starCanvas.width) * 2.5, 0, Math.PI * 2);
        sCtx.fillStyle = isLight ? `rgba(0,0,0,${s.o})` : `rgba(255,255,255,${s.o})`;
        sCtx.fill();
    });
    requestAnimationFrame(animateStars);
}
initStars(); animateStars();