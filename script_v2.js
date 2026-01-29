// --- Firebase設定（ご自身のもので埋めてください） ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

const SOUND_PATH = "sound/"; 
const POSTS = ["1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];

// 音声ファイル割り当て
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

    // 停止・戻る
    document.getElementById("stopBtn")?.addEventListener("click", () => playSound('stop_play.mp3'));
    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
    document.getElementById("btnReturnToTop")?.addEventListener("click", () => {
        playSound('return.mp3', () => location.reload());
    });
});

function startGame(selectedMode) {
    unlockAudio();
    gameMode = selectedMode;
    score = 0;
    isGameStarted = true;
    
    // 画面切り替え
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
    // quiz_4.5.mp3 などの形式（ドット入り対応）
    const quizFile = `quiz_${currentCorrectAnswer}.mp3`;
    playSound(quizFile);
}

function handleKeyInput(key) {
    if (!isGameStarted) return;
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

function stopCurrentAudio() { if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; } }
function updateDisplay() { document.getElementById("currentInput").textContent = playerInput; }
function unlockAudio() { const silent = new Audio(SOUND_PATH + "input_1.mp3"); silent.volume = 0.1; silent.play().catch(e => {}); }

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
            i++;
        });
    } catch (e) { list.innerHTML = "取得失敗"; }
}

async function submitScore() {
    const name = document.getElementById("nameInput").value || "ななしさん";
    try {
        await db.collection("ranking").add({ name: name, score: score, date: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById("scoreSubmitArea").style.display = "none";
        showRanking();
    } catch (e) { alert("登録失敗"); }
}