/* script_v2.js - ゴールボールサーチゲーム完全版 (Firestore対応) */

// --- 【重要】ここにお手持ちの Firebase Config を貼り付けてください ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "gsranking.firebaseapp.com",
  projectId: "gsranking",
  storageBucket: "gsranking.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase初期化 (Firestoreを使用)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); 

// --- 設定・定数 ---
const SOUND_PATH = "sound/";
const POSTS = ["0", "1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];

// 音声ファイル割り当て
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

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");
    startBtn.addEventListener("click", () => {
        unlockAudio(); // iOS/Safari対策
        
        // モード選択の取得
        const modeRadio = document.querySelector('input[name="gameMode"]:checked');
        gameMode = modeRadio ? modeRadio.value : "practice";
        
        score = 0;
        isGameStarted = true;
        
        // 画面の表示・非表示
        document.querySelector(".mode-selection").style.display = "none";
        startBtn.parentElement.style.display = "none";
        document.getElementById("rankingArea").style.display = "none";
        
        nextQuestion();
    });

    // キーパッドボタン
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => handleKeyInput(btn.getAttribute("data-key")));
    });

    document.getElementById("stopBtn")?.addEventListener("click", stopCurrentAudio);
    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
});

// --- ゲーム進行 ---

function nextQuestion() {
    playerInput = "";
    updateDisplay();
    // ランダムに正解を決定
    currentCorrectAnswer = POSTS[Math.floor(Math.random() * POSTS.length)];
    // クイズ音声 (quiz_4.mp3等)
    const quizFile = `quiz_${currentCorrectAnswer.replace('.', '')}.mp3`;
    playSound(quizFile);
}

function handleKeyInput(key) {
    if (!isGameStarted && key !== "Enter") {
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
        // 【正解】
        score++;
        playSound("seikai.mp3", () => {
            setTimeout(nextQuestion, 800);
        });
    } else {
        // 【不正解】 no.mp3 -> answer_X.mp3 の連続再生
        playSound("no.mp3", () => {
            const answerFile = `answer_${currentCorrectAnswer.replace('.', '')}.mp3`;
            playSound(answerFile, () => {
                if (gameMode === "championship") {
                    endGame();
                } else {
                    setTimeout(nextQuestion, 1000);
                }
            });
        });
    }
}

// --- Firestore連携 ---

async function endGame() {
    isGameStarted = false;
    document.getElementById("rankingArea").style.display = "block";
    showRanking(); 
    if (score > 0) {
        document.getElementById("scoreSubmitArea").style.display = "block";
    }
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
    } catch (e) {
        console.error(e);
        rankingList.innerHTML = "取得できませんでした。";
    }
}

async function submitScore() {
    const nameInput = document.getElementById("nameInput");
    const name = nameInput.value || "ななしさん";
    try {
        await db.collection("ranking").add({
            name: name,
            score: score,
            date: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById("scoreSubmitArea").style.display = "none";
        showRanking();
    } catch (e) {
        alert("登録失敗");
    }
}

// --- 音声再生関数（強化版） ---
function playSound(fileName, onEndedCallback = null) {
    stopCurrentAudio();
    
    // GitHub Pages用にパスを補正（ドットスラッシュを追加）
    const audioPath = "./" + SOUND_PATH + fileName;
    console.log("再生試行:", audioPath); // デバッグ用

    currentAudio = new Audio(audioPath);
    
    // 読み込み完了を待ってから再生
    currentAudio.addEventListener('canplaythrough', () => {
        currentAudio.play().then(() => {
            console.log("再生成功:", fileName);
        }).catch(e => {
            console.error("再生失敗:", fileName, e);
            // 失敗した場合はアラートで通知（デバッグ用）
            // alert("音がブロックされました。画面のどこかをクリックしてください。");
        });
    }, { once: true });

    if (onEndedCallback) {
        currentAudio.onended = onEndedCallback;
    }
}

// iOS/ブラウザ制限解除
function unlockAudio() {
    // 実際に存在する短い音ファイルを指定してください
    const audioPath = "./" + SOUND_PATH + "confirm.mp3";
    const silent = new Audio(audioPath);
    silent.volume = 0.1; // 完全無音だと解除されない場合があるため極小音量
    silent.play().then(() => {
        console.log("オーディオロック解除成功");
    }).catch(e => console.log("ロック解除失敗:", e));
}