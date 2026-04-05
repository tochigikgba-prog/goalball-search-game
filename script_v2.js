// ==========================================
// 1. 初期設定・変数
// ==========================================
let score = 0;
let practiceCount = 0;   // 練習の実施回数
let practiceCorrect = 0; // 練習の正解数
let currentCorrectAnswer = null;
let gameMode = ""; // "practice" or "championship"

// Firebaseの初期化（ご自身の設定に置き換えてください）
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 2. モード開始処理
// ==========================================

// 練習モード開始
function startPractice() {
    gameMode = "practice";
    score = 0;
    practiceCount = 0;
    practiceCorrect = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    
    // 練習開始の合図（もしあれば）
    nextQuestion();
}

// 選手権モード開始
function startChampionship() {
    gameMode = "championship";
    score = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    
    playSound("sound/start_pro.mp3", () => {
        nextQuestion();
    });
}

// ==========================================
// 3. ゲーム進行ロジック
// ==========================================

function nextQuestion() {
    // 練習モード：5問終わったら終了処理へ
    if (gameMode === "practice" && practiceCount >= 5) {
        finishPractice();
        return;
    }

    // 問題作成（1〜9のランダム）
    currentCorrectAnswer = Math.floor(Math.random() * 9) + 1;
    
    // 出題音の再生（例：question_3.mp3など）
    playSound(`sound/question_${currentCorrectAnswer}.mp3`);
    
    // 状態表示のリセット
    document.getElementById("statusArea").innerText = "数字を入力してください...";
    
    // ボイスオーバー用に最初のボタンにフォーカス（アクセシビリティ）
    const firstKey = document.querySelector(".key");
    if (firstKey) firstKey.focus();
}

function inputKey(num) {
    // 入力された数字の音を鳴らす（input_1.mp3など）
    playSound(`sound/input_${num}.mp3`, () => {
        checkAnswer(num);
    });
}

function checkAnswer(playerInput) {
    if (playerInput === currentCorrectAnswer) {
        // 正解
        if (gameMode === "practice") {
            practiceCorrect++;
        }
        score++;
        
        playSound("sound/seikai.mp3", () => {
            if (gameMode === "practice") practiceCount++;
            setTimeout(nextQuestion, 800);
        });
    } else {
        // 不正解
        playSound("sound/no.mp3", () => {
            // 正解を教える音を鳴らす（例：answer_3.mp3）
            playSound(`sound/answer_${currentCorrectAnswer}.mp3`, () => {
                if (gameMode === "practice") {
                    practiceCount++;
                    setTimeout(nextQuestion, 1000);
                } else {
                    // 選手権は一回ミスで終了
                    endGame();
                }
            });
        });
    }
}

// ==========================================
// 4. 終了処理
// ==========================================

// 練習モード終了（音声パズル）
function finishPractice() {
    const statusArea = document.getElementById("statusArea");
    statusArea.innerText = `練習終了！成績は 5問中 ${practiceCorrect}問 正解でした。`;

    // 1. お疲れ様（導入）
    playSound("sound/otsukare.mp3", () => {
        // 2. 正解数（input_0.mp3 〜 input_5.mp3 を使用）
        playSound(`sound/input_${practiceCorrect}.mp3`, () => {
            // 3. 締めの言葉（選手権への誘い）
            playSound("sound/correct_is.mp3", () => {
                setTimeout(() => {
                    location.reload(); 
                }, 3000);
            });
        });
    });
}

// 選手権モード終了
function endGame() {
    document.getElementById("gameArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;
    
    // スコアが0より大きければ名前入力表示
    if (score > 0) {
        document.getElementById("scoreSubmitArea").classList.remove("hidden");
    }
    
    loadRanking();
}

// ==========================================
// 5. ユーティリティ（音声・ランキング）
// ==========================================

function playSound(file, callback) {
    const audio = new Audio(file);
    audio.play().catch(e => console.log("Audio play error:", e));
    if (callback) {
        audio.onended = callback;
    }
}

// ランキング保存・読み込み処理（Firebase）
async function submitScore() {
    const name = document.getElementById("nameInput").value || "ななし";
    await db.collection("rankings").add({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("scoreSubmitArea").classList.add("hidden");
    loadRanking();
}

async function loadRanking() {
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
}

function resetGame() {
    location.reload();
}