/* script_v2.js - 音声フォルダ指定・GitHub構成対応版 */

// --- Firebase設定（自分のものに書き換えてください） ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

// --- 設定・定数 ---
// 音声ファイルは sound フォルダの中にあるため指定
const SOUND_PATH = "sound/"; 
const POSTS = ["0", "1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];

const INPUT_FILES = {
  "0":"input_0.mp3", "1":"input_1.mp3", "2":"input_2.mp3", "3":"input_3.mp3", 
  "4":"input_4.mp3", "5":"input_5.mp3", "6":"input_6.mp3", "7":"input_7.mp3", 
  "8":"input_8.mp3", "9":"input_9.mp3", "4.5":"quiz_45.mp3",
  "C":"input_clear.mp3", "Enter":"enter.mp3"
};

let playerInput = "";
let currentAudio = null;
let isGameStarted = false;
let currentCorrectAnswer = "";
let gameMode = "practice"; 
let score = 0;

document.addEventListener("DOMContentLoaded", () => {
    // 準備ボタン
    document.getElementById("leftRightBtn")?.addEventListener("click", () => {
        unlockAudio();
        playSound('enter.mp3'); 
    });
    document.getElementById("hintBtn")?.addEventListener("click", () => {
        unlockAudio();
        playSound('hint.mp3'); 
    });

    // モード開始ボタン
    document.getElementById("modePractice")?.addEventListener("click", () => startGame("practice"));
    document.getElementById("modeChamp")?.addEventListener("click", () => startGame("championship"));

    // キーパッド
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
    if (!isGameStarted) {
        if (INPUT_FILES[key]) playSound(INPUT_FILES[key]);
        return;
    }
    if (key === "C") {
        playerInput = "";
        playSound("input_clear.mp3");
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
        playSound("seikai.mp3", () => {
            setTimeout(nextQuestion, 800);
        });
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
    const rankingList = document.getElementById("rankingList");
    rankingList.innerHTML = "読み込み中...";
    try {
        const snapshot = await db.collection("ranking").orderBy("score", "desc").limit(10).get();
        rankingList.innerHTML = "";
        let i = 1;
        snapshot.forEach((doc) => {
            const data = doc.data();
            rankingList.innerHTML += `<p>${i}位: ${data.name}様 - ${data.score}点</p>`;
            i++;
        });
    } catch (e) { rankingList.innerHTML = "取得できませんでした。"; }
}

async function submitScore() {
    const name = document.getElementById("nameInput").value || "ななしさん";
    try {
        await db.collection("ranking").add({
            name: name,
            score: score,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById("scoreSubmitArea").style.display = "none";
        showRanking();
    } catch (e) { alert("登録失敗"); }
}

function playSound(fileName, onEndedCallback = null) {
    stopCurrentAudio();
    // ここで sound/ フォルダを参照するように修正
    const audioPath = SOUND_PATH + fileName;
    currentAudio = new Audio(audioPath);
    currentAudio.play().catch(e => console.log("再生失敗:", fileName));
    if (onEndedCallback) currentAudio.onended = onEndedCallback;
}

function stopCurrentAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
}

function updateDisplay() {
    document.getElementById("currentInput").textContent = playerInput;
}

function unlockAudio() {
    const silent = new Audio(SOUND_PATH + "enter.mp3");
    silent.volume = 0.1;
    silent.play().catch(e => {});
}