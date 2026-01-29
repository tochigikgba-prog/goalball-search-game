// --- Firebase設定（お手元の本物の設定に書き換えてください） ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
};

// 初期化
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore(); 

const SOUND_PATH = "sound/"; 
const POSTS = ["1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];

const INPUT_FILES = {
  "1":"input_1.mp3", "2":"input_2.mp3", "3":"input_3.mp3", "4":"input_4.mp3", 
  "4.5":"input_4.5.mp3", "5":"input_5.mp3", "6":"input_6.mp3", "7":"input_7.mp3", 
  "8":"input_8.mp3", "9":"input_9.mp3", "C":"input_clear.mp3", 
  "Enter":"kettei.mp3" 
};

let playerInput = "";
let currentAudio = null;
let isGameStarted = false;
let currentCorrectAnswer = "";
let gameMode = "practice"; 
let score = 0;

document.addEventListener("DOMContentLoaded", () => {
    // 準備ボタン
    document.getElementById("leftRightBtn")?.addEventListener("click", () => { unlockAudio(); playSound('zunda_check.mp3'); });
    document.getElementById("hintBtn")?.addEventListener("click", () => { unlockAudio(); playSound('hint.mp3'); });

    // モード開始
    document.getElementById("btnStartTraining")?.addEventListener("click", () => startGame("practice"));
    document.getElementById("btnStartPro")?.addEventListener("click", () => startGame("championship"));

    // キーパッド
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => handleKeyInput(btn.getAttribute("data-key")));
    });

    // 停止・登録
    document.getElementById("stopBtn")?.addEventListener("click", () => playSound('stop_play.mp3'));
    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
    
    // トップページにもどるボタン（複数対応）
    const returnButtons = ["btnReturnToTop", "btnReturnFromGame"];
    returnButtons.forEach(id => {
        document.getElementById(id)?.addEventListener("click", () => {
            playSound('return.mp3', () => location.reload());
        });
    });
});

function startGame(selectedMode) {
    unlockAudio();
    gameMode = selectedMode;
    score = 0;
    isGameStarted = true;
    document.getElementById("setupArea").classList.add("hidden");
    document.getElementById("modeSelectionArea").classList.add("hidden");
    document.getElementById("gamePlayArea").classList.remove("hidden");
    const startSound = (gameMode === "practice") ? "start_training.mp3" : "start_pro.mp3";
    playSound(startSound, () => setTimeout(nextQuestion, 1000));
}

function nextQuestion() {
    playerInput = "";
    updateDisplay();
    currentCorrectAnswer = POSTS[Math.floor(Math.random() * POSTS.length)];
    const quizFile = `quiz_${currentCorrectAnswer}.mp3`;
    playSound(quizFile);
}

function handleKeyInput(key) {
    if (!isGameStarted) return;
    if (key === "C") {
        playerInput = "";
        playSound("input_clear.mp3");
    } else if (key === "Enter") {
        if (playerInput !== "") {
            // 決定音を鳴らしてから判定へ
            playSound("kettei.mp3", () => {
                setTimeout(checkAnswer, 300);
            });
        }
    } else {
        playerInput = key; 
        if (INPUT_FILES[key]) playSound(INPUT_FILES[key]);
    }
    updateDisplay();
}

function checkAnswer() {
    if (playerInput === currentCorrectAnswer) {
        score++;
        playSound("seikai.mp3", () => setTimeout(nextQuestion, 800));
    } else {
        playSound("no.mp3", () => {
            const answerFile = `answer_${currentCorrectAnswer}.mp3`;
            playSound(answerFile, () => {
                if (gameMode === "championship") endGame();
                else setTimeout(nextQuestion, 1000);
            });
        });
    }
}

function endGame() {
    isGameStarted = false;
    document.getElementById("gamePlayArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    showRanking(); 
    if (score > 0) document.getElementById("scoreSubmitArea").style.display = "block";
}

function playSound(fileName, onEndedCallback = null) {
    stopCurrentAudio();
    currentAudio = new Audio(SOUND_PATH + fileName);
    currentAudio.play().catch(e => console.log("再生失敗:", fileName));
    if (onEndedCallback) currentAudio.onended = onEndedCallback;
}

function stopCurrentAudio() { 
    if (currentAudio) { 
        currentAudio.pause(); 
        currentAudio.currentTime = 0; 
    } 
}

function updateDisplay() { 
    const display = document.getElementById("currentInput");
    if (display) display.textContent = playerInput; 
}

function unlockAudio() { 
    const silent = new Audio();
    silent.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    silent.play().catch(e => {}); 
}

// 省略なしのランキング表示機能
async function showRanking() {
    const list = document.getElementById("rankingList");
    if (!list) return;
    list.innerHTML = "読み込み中...";
    try {
        const snapshot = await db.collection("ranking").orderBy("score", "desc").limit(10).get();
        list.innerHTML = "";
        let i = 1;
        snapshot.forEach((doc) => {
            const d = doc.data();
            list.innerHTML += `<p>${i}位: ${d.name}様 - ${d.score}点</p>`;
            i++;
        });
    } catch (e) { 
        list.innerHTML = "ランキングの取得に失敗しました。"; 
        console.error(e);
    }
}

// 省略なしのスコア登録機能
async function submitScore() {
    const nameInput = document.getElementById("nameInput");
    const name = nameInput ? nameInput.value : "ななしさん";
    try {
        await db.collection("ranking").add({ 
            name: name, 
            score: score, 
            date: firebase.firestore.FieldValue.serverTimestamp() 
        });
        const submitArea = document.getElementById("scoreSubmitArea");
        if (submitArea) submitArea.style.display = "none";
        showRanking();
    } catch (e) { 
        alert("登録に失敗しました。"); 
        console.error(e);
    }
}