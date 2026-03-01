let num1, num2, correctAnswer;
let scoreCorrect = 0;
let scoreErrors = 0;
let isReviewing = false;

const resultArea = document.getElementById('result-area');
const mathProblem = document.getElementById('math-problem');
const answerInput = document.getElementById('answer-input');
const statusText = document.getElementById('status-text');
const correctAnswerDisplay = document.getElementById('correct-answer-display');
const visualExplanation = document.getElementById('visual-explanation');
const logicHint = document.getElementById('logic-hint');
const actionBtn = document.getElementById('action-btn');

function handleGameStep() {
    if (!isReviewing) submitAnswer();
    else startNewRound();
}

function startNewRound() {
    isReviewing = false;
    num1 = Math.floor(Math.random() * 12) + 1;
    num2 = Math.floor(Math.random() * 12) + 1;
    correctAnswer = num1 * num2;

    mathProblem.innerText = `${num1} × ${num2}`;
    answerInput.value = '';
    answerInput.disabled = false;
    actionBtn.innerText = "SUBMIT";
    
    resultArea.classList.replace('visible', 'invisible');
    visualExplanation.innerHTML = '';
    
    setTimeout(() => answerInput.focus(), 10);
}

function submitAnswer() {
    const userVal = parseInt(answerInput.value);
    if (isNaN(userVal)) return;

    isReviewing = true;
    answerInput.disabled = true;
    actionBtn.innerText = "NEXT ROUND";

    const isCorrect = userVal === correctAnswer;

    // Generate Visual Pills
    visualExplanation.innerHTML = '';
    for (let i = 0; i < num2; i++) {
        const pill = document.createElement('span');
        pill.className = 'math-pill';
        pill.innerText = num1;
        visualExplanation.appendChild(pill);
        if (i < num2 - 1) {
            const plus = document.createElement('span');
            plus.innerText = '+';
            plus.style.alignSelf = 'center';
            visualExplanation.appendChild(plus);
        }
    }

    if (isCorrect) {
        scoreCorrect++;
        document.getElementById('correct-count').innerText = scoreCorrect;
        statusText.innerText = "PERFECT!";
        statusText.style.color = "#22c55e";
        logicHint.innerText = "Great job!";
    } else {
        scoreErrors++;
        document.getElementById('incorrect-count').innerText = scoreErrors;
        statusText.innerText = "NOT QUITE!";
        statusText.style.color = "#ef4444";
        logicHint.innerText = `Multiplication is adding ${num1} exactly ${num2} times.`;
    }

    correctAnswerDisplay.innerText = `${num1} × ${num2} = ${correctAnswer}`;
    resultArea.classList.replace('invisible', 'visible');
}

actionBtn.addEventListener('click', handleGameStep);
window.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleGameStep(); });

startNewRound();