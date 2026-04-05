// --- Firebase設定（画像から取得した本物の値） ---
const firebaseConfig = {
  apiKey: "AIzaSyDwBUd2D1Mt8HlZbh9Mvpi95JP6P0F7S7E",
  authDomain: "gsranking.firebaseapp.com",
  projectId: "gsranking",
  storageBucket: "gsranking.firebasestorage.app",
  messagingSenderId: "876090875752",
  appId: "1:876090875752:web:7841b486506842230ec0dd",
  measurementId: "G-M1Y9F13D2E"
};

// Firebase初期化
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore(); 

const SOUND_PATH = "sound/"; 
const POSTS = ["1", "2", "3", "4", "4.5", "5", "6", "7", "8", "9"];
const INPUT_FILES = {
  "1":"input_1.mp3", "2":"input_2.mp3", "3":"input_3.mp3", "4":"input_4.mp3", 
  "4.5":"input_4.5.mp3", "5":"input_5.mp3", "6":"input_6.mp3", "7":"input_7.mp3", 
  "8":"input_8.mp3", "9":"input_9.mp3", "C":"input_clear.mp3", "Enter":"kettei.mp3" 
};

let playerInput = "", currentAudio = null, isGameStarted = false, currentCorrectAnswer = "", gameMode = "practice", score = 0;

document.addEventListener("DOMContentLoaded", () => {
    // 準備ボタン
    document.getElementById("leftRightBtn")?.addEventListener("click", () => { unlockAudio(); playSound('zunda_check.mp3'); });
    document.getElementById("hintBtn")?.addEventListener("click", () => { unlockAudio(); playSound('hint.mp3'); });

    // モード開始
    document.getElementById("btnStartTraining")?.addEventListener("click", () => startGame("practice"));
    document.getElementById("btnStartPro")?.addEventListener("click", () => startGame("championship"));

    // 選手権への切り替え（練習モード中）
    document.getElementById("btnSwitchToPro")?.addEventListener("click", () => {
        stopCurrentAudio();
        startGame("championship");
    });

    // キー入力
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => handleKeyInput(btn.getAttribute("data-key")));
    });

    // スコア送信
    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
    
    // もどるボタン
    ["btnReturnToTop", "btnReturnFromGame"].forEach(id => {
        document.getElementById(id)?.addEventListener("click", () => {
            playSound('return.mp3', () => location.reload());
        });
    });

    // --- 音声入力の実装 ---
    const voiceBtn = document.getElementById("voiceInputBtn");
    const nameInput = document.getElementById("nameInput");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition && voiceBtn) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;

        voiceBtn.addEventListener("click", () => {
            recognition.start();
            voiceBtn.textContent = "👂 聴いています...";
            voiceBtn.style.background = "#FF0000";
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            nameInput.value = transcript.substring(0, 10);
            
            // 認識結果を音声で確認
            const uttr = new SpeechSynthesisUtterance(nameInput.value + "、と入力しました。");
            uttr.lang = "ja-JP";
            window.speechSynthesis.speak(uttr);
        };

        recognition.onend = () => {
            voiceBtn.textContent = "🎤 音声入力";
            voiceBtn.style.background = "#444";
        };

        recognition.onerror = () => {
            alert("音声認識に失敗しました。もう一度試してください。");
            voiceBtn.textContent = "🎤 音声入力";
            voiceBtn.style.background = "#444";
        };
    } else if (voiceBtn) {
        // 対応していないブラウザではボタンを隠す
        voiceBtn.style.display = "none";
    }
});

function startGame(selectedMode) {
    unlockAudio();
    gameMode = selectedMode;
    score = 0;
    isGameStarted = true;
    document.getElementById("setupArea").classList.add("hidden");
    document.getElementById("modeSelectionArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.add("hidden");
    document.getElementById("gamePlayArea").classList.remove("hidden");

    // ゲーム開始時、最初のボタンにフォーカスを当てる（スクリーンリーダー用）
    const firstKey = document.querySelector(".key");
    if (firstKey) firstKey.focus();

    const startSound = (gameMode === "practice") ? "start_training.mp3" : "start_pro.mp3";
    playSound(startSound, () => setTimeout(nextQuestion, 1000));
}

function nextQuestion() {
    playerInput = "";
    updateDisplay();
    currentCorrectAnswer = POSTS[Math.floor(Math.random() * POSTS.length)];
    playSound(`quiz_${currentCorrectAnswer}.mp3`);
}

function handleKeyInput(key) {
    if (!isGameStarted) return;
    if (key === "C") {
        playerInput = "";
        playSound("input_clear.mp3");
    } else if (key === "Enter") {
        if (playerInput !== "") {
            playSound("kettei.mp3", () => { setTimeout(checkAnswer, 300); });
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
            playSound(`answer_${currentCorrectAnswer}.mp3`, () => {
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
function updateDisplay() { const d = document.getElementById("currentInput"); if (d) d.textContent = playerInput; }
function unlockAudio() { 
    const silent = new Audio();
    silent.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    silent.play().catch(e => {}); 
}

async function showRanking() {
    const list = document.getElementById("rankingList");
    if (!list) return;
    list.innerHTML = "読み込み中...";
    try {
        const snapshot = await db.collection("GSRanking").orderBy("score", "desc").limit(10).get();
        list.innerHTML = "";
        let i = 1;
        snapshot.forEach((doc) => {
            const d = doc.data();
            let rank = i === 1 ? "🥇 " : i === 2 ? "🥈 " : i === 3 ? "🥉 " : i + "位: ";
            list.innerHTML += `<p>${rank}${d.name}様 - ${d.score}点</p>`;
            i++;
        });
    } catch (e) { list.innerHTML = "取得失敗"; console.error(e); }
}

async function submitScore() {
    const nameInput = document.getElementById("nameInput");
    const name = (nameInput && nameInput.value) ? nameInput.value : "ななしさん";
    try {
        await db.collection("GSRanking").add({ 
            name: name, 
            score: score, 
            date: firebase.firestore.FieldValue.serverTimestamp() 
        });
        document.getElementById("scoreSubmitArea").style.display = "none";
        showRanking();
    } catch (e) { alert("登録失敗"); console.error(e); }
}