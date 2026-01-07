/* script_v2.js - 音声確認・即スタート・Firestore完全版 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "gsranking.firebaseapp.com",
  projectId: "gsranking",
  storageBucket: "gsranking.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

const SOUND_PATH = "sound/";
const POSTS = ["0", "1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];
const INPUT_FILES = {
  "0":"0.mp3", "1":"1.mp3", "2":"2.mp3", "3":"3.mp3", "4":"4.mp3", "5":"5.mp3",
  "6":"6.mp3", "7":"7.mp3", "8":"8.mp3", "9":"9.mp3", "4.5":"quiz_45.mp3",
  "C":"clear.mp3", "Enter":"confirm.mp3"
};

let playerInput = "";
let currentAudio = null;
let isGameStarted = false;
let currentCorrectAnswer = "";
let gameMode = "practice"; 
let score = 0;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("modePractice")?.addEventListener("click", () => startGame("practice"));
    document.getElementById("modeChamp")?.addEventListener("click", () => startGame("championship"));
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => handleKeyInput(btn.getAttribute("data-key")));
    });
    document.getElementById("stopBtn")?.addEventListener("click", stopCurrentAudio);
    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
});

function startGame(selectedMode) {
    unlockAudio();
    gameMode = selectedMode;
    score = 0;
    isGameStarted = true;
    document.querySelector(".mode-selection").style.display = "none";
    document.querySelector(".setup-section").style.display = "none";
    document.getElementById("rankingArea").style.display = "none";
    nextQuestion();
}

function nextQuestion() {
    playerInput = "";
    updateDisplay();
    currentCorrectAnswer = POSTS[Math.floor(Math.random() * POSTS.length)];
    const quizFile = `quiz_${currentCorrectAnswer.replace('.', '')}.mp3`;
    playSound(quizFile);
}

function handleKeyInput(key) {
    // 開始前でも音出し確認を可能にする
    if (!isGameStarted) {
        if (INPUT_FILES[key]) playSound(INPUT_FILES[key]);
        return;
    }
    if (key === "C") {
        playerInput = "";
        playSound("clear.mp3");
    } else if (key === "Enter") {
        checkAnswer();
    } else {
        playerInput = key; 
        if (INPUT_FILES[key]) playSound(INPUT_FILES[key]);
    }
    updateDisplay();
}

function checkAnswer() {
    if (playerInput === "") return;
    if (playerInput === currentCorrectAnswer) {
        score++;
        playSound("seikai.mp3", () => { setTimeout(nextQuestion, 800); });
    } else {
        playSound("no.mp3", () => {
            const answerFile = `answer_${currentCorrectAnswer.replace('.', '')}.mp3`;
            playSound(answerFile, () => {
                if (gameMode === "championship") endGame();
                else setTimeout(nextQuestion, 1000);
            });
        });
    }
}

async function endGame() {
    isGameStarted = false;
    document.getElementById("rankingArea").style.display = "block";
    showRanking(); 
    if (score > 0) document.getElementById("scoreSubmitArea").style.display = "block";
}

async function showRanking() {
    const list = document.getElementById("rankingList");
    list.innerHTML = "読み込み中...";
    try {
        const snapshot = await db.collection("ranking").orderBy("score", "desc").limit(10).get();
        list.innerHTML = "";
        let i = 1;
        snapshot.forEach((doc) => {
            const d = doc.data();
            list.innerHTML += `<p>${i}位: ${d.name}様 - ${d.score}点</p>`;