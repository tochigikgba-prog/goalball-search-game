// ==========================================
// 1. 初期設定・変数
// ==========================================
let score = 0;
let practiceCount = 0;   
let practiceCorrect = 0; 
let currentCorrectAnswer = null;
let gameMode = ""; 

// 出題されるボールの位置（0〜9、および4.5）
const ballPositions = [0, 1, 2, 3, 4, 4.5, 5, 6, 7, 8, 9];

// Firebaseの初期化（あなたのプロジェクト設定を反映しました）
const firebaseConfig = {
    apiKey: "AIzaSyDwBUd2D1Mt8HlZbh9Mvpi95JP6P0F7S7E",
    authDomain: "gsranking.firebaseapp.com",
    projectId: "gsranking",
    storageBucket: "gsranking.firebasestorage.app",
    messagingSenderId: "876090875752",
    appId: "1:876090875752:web:7841b486506842230ec0dd",
    measurementId: "G-M1Y9F13D2E"
};

// Firebaseの初期化実行
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 2. モード開始・左右確認処理
// ==========================================

/**
 * 左右確認ボタン
 */
function checkSound() {
    const soundPath = "sound/zunda_check.mp3";
    console.log("左右確認再生開始: " + soundPath);
    
    const status = document.getElementById("statusArea");
    if (status) status.innerText = "ずんだもんが左右を確認中...";

    playSound(soundPath, () => {
        if (status) status.innerText = "準備ができたらモードを選んでね";
    });
}

function startPractice() {
    gameMode = "practice";
    score = 0;
    practiceCount = 0;
    practiceCorrect = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    nextQuestion();
}

function startChampionship() {
    gameMode = "championship";
    score = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    
    // 選手権開始の音
    playSound("sound/start_pro.mp3", () => {
        nextQuestion();
    });
}

// ==========================================
// 3. ゲーム進行ロジック
// ==========================================

function nextQuestion() {
    if (gameMode === "practice" && practiceCount >= 5) {
        finishPractice();
        return;
    }

    const randomIndex = Math.floor(Math.random() * ballPositions.length);
    currentCorrectAnswer = ballPositions[randomIndex];
    
    playSound(`sound/question_${currentCorrectAnswer}.mp3`);
    
    document.getElementById("statusArea").innerText = "ボールはどこ？";
    document.getElementById("currentInput").innerText = "-"; 
}

function inputKey(num) {
    document.getElementById("currentInput").innerText = num;
    playSound(`sound/input_${num}.mp3`, () => {
        checkAnswer(num);
    });
}

function checkAnswer(playerInput) {
    if (parseFloat(playerInput) === currentCorrectAnswer) {
        if (gameMode === "practice") practiceCorrect++;
        score++;
        
        playSound("sound/seikai.mp3", () => {
            if (gameMode === "practice") practiceCount++;
            setTimeout(nextQuestion, 800);
        });
    } else {
        playSound("sound/no.mp3", () => {
            playSound(`sound/answer_${currentCorrectAnswer}.mp3`, () => {
                if (gameMode === "practice") {
                    practiceCount++;
                    setTimeout(nextQuestion, 1000);
                } else {
                    endGame(); 
                }
            });
        });
    }
}

// ==========================================
// 4. 終了処理・音声入力
// ==========================================

function finishPractice() {
    const statusArea = document.getElementById("statusArea");
    statusArea.innerText = `練習終了！成績：5問中 ${practiceCorrect}問 正解`;

    playSound("sound/otsukare.mp3", () => {
        playSound(`sound/input_${practiceCorrect}.mp3`, () => {
            playSound("sound/correct_is.mp3", () => {
                setTimeout(() => {
                    location.reload(); 
                }, 4000);
            });
        });
    });
}

function endGame() {
    document.getElementById("gameArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;
    
    if (score > 0) {
        document.getElementById("scoreSubmitArea").style.display = "block";
    }
    
    loadRanking();
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("お使いのブラウザは音声入力に対応していません。");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';

    recognition.onstart = () => {
        const status = document.getElementById("statusArea");
        if (status) status.innerText = "お名前をどうぞ...";
    };

    recognition.onresult = (event) => {
        const voiceName = event.results[0][0].transcript;
        document.getElementById("nameInput").value = voiceName;
        const status = document.getElementById("statusArea");
        if (status) status.innerText = "聞き取り完了：" + voiceName;
    };

    recognition.start();
}

// ==========================================
// 5. 音声再生のコア関数
// ==========================================

function playSound(file, callback) {
    const audio = new Audio(file);
    audio.play().then(() => {
        if (callback) {
            audio.onended = callback;
        }
    }).catch(e => {
        console.error("再生エラー:", file, e);
        if (callback) callback();
    });
}

// ==========================================
// 6. ランキング処理（Firebase）
// ==========================================

async function submitScore() {
    const nameInput = document.getElementById("nameInput");
    const name = nameInput.value || "ななし";
    try {
        await db.collection("rankings").add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById("scoreSubmitArea").style.display = "none";
        loadRanking();
    } catch (e) {
        console.error("スコア送信エラー:", e);
        alert("送信に失敗しました。Firestoreのルールを確認してください。");
    }
}

async function loadRanking() {
    try {
        const snapshot = await db.collection("rankings")
            .orderBy("score", "desc")
            .limit(10)
            .get();
        
        let html = "<h3>TOP 10</h3>";
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `<p>${data.name}: ${data.score}点</p>`;
        });
        document.getElementById("rankingList").innerHTML = html;
    } catch (e) {
        console.error("ランキング読み取りエラー:", e);
    }
}