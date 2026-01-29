// --- Firebase設定（ご自身のプロジェクトのものを貼り付けてください） ---
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
  "Enter":"kettei.mp3" // 決定音を kettei.mp3 に固定
};

let playerInput = "";
let currentAudio = null;
let isGameStarted = false;
let currentCorrectAnswer = "";
let gameMode = "practice"; 
let score = 0;

document.addEventListener("DOMContentLoaded", () => {
    // 準備ボタン（音の重なりを防ぐため unlockAudio を実行してから playSound）
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
        // トップページにもどる際に return.mp3 を再生
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