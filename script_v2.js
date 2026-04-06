// ==========================================
// 1. 初期設定・変数
// ==========================================
let score = 0;
let practiceCount = 0;   
let practiceCorrect = 0; 
let currentCorrectAnswer = null;
let gameMode = ""; 

// Firebaseの初期化（ご自身の設定に書き換えてください）
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
    
    // 選手権開始の音（soundフォルダ内）
    playSound("sound/start_pro.mp3", () => {
        nextQuestion();
    });
}

// ==========================================
// 3. ゲーム進行ロジック
// ==========================================

function nextQuestion() {
    // 練習モード：5問終わったら終了
    if (gameMode === "practice" && practiceCount >= 5) {
        finishPractice();
        return;
    }

    currentCorrectAnswer = Math.floor(Math.random() * 9) + 1;
    
    // 出題音（soundフォルダ内）
    playSound(`sound/question_${currentCorrectAnswer}.mp3`);
    
    document.getElementById("statusArea").innerText = "数字を入力してください...";
    
    const firstKey = document.querySelector(".key");
    if (firstKey) firstKey.focus();
}

// HTMLのボタンから呼ばれる関数
function inputKey(num) {
    // 入力した数字の音（soundフォルダ内の input_1.mp3 など）
    playSound(`sound/input_${num}.mp3`, () => {
        checkAnswer(num);
    });
}

function checkAnswer(playerInput) {
    if (playerInput === currentCorrectAnswer) {
        if (gameMode === "practice") {
            practiceCorrect++;
        }
        score++;
        
        // 正解音（sound/seikai.mp3）
        playSound("sound/seikai.mp3", () => {
            if (gameMode === "practice") practiceCount++;
            setTimeout(nextQuestion, 800);
        });
    } else {
        // 不正解音（sound/no.mp3）
        playSound("sound/no.mp3", () => {
            // 正解を教える音（sound/answer_X.mp3）
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
// 4. 終了処理
// ==========================================

// 練習モード終了時の音声ガイド
function finishPractice() {
    const statusArea = document.getElementById("statusArea");
    statusArea.innerText = `練習終了！成績は 5問中 ${practiceCorrect}問 正解でした。`;

    // 音声を順番に再生
    playSound("sound/otsukare.mp3", () => {
        playSound(`sound/input_${practiceCorrect}.mp3`, () => {
            playSound("sound/correct_is.mp3", () => {
                setTimeout(() => {
                    location.reload(); 
                }, 3000);
            });
        });
    });
}

function endGame() {
    document.getElementById("gameArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;
    
    if (score > 0) {
        document.getElementById("scoreSubmitArea").classList.remove("hidden");
    }
    
    loadRanking();
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
        // エラー（ファイルがない、ブロックされた等）でも次へ進める
        if (callback) callback();
    });
}

// ==========================================
// 6. ランキング処理（Firebase）
// ==========================================

async function submitScore() {
    const name = document.getElementById("nameInput").value || "ななし";
    try {
        await db.collection("rankings").add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById("scoreSubmitArea").classList.add("hidden");
        loadRanking();
    } catch (e) {
        console.error("スコア送信エラー:", e);
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

function resetGame() {
    location.reload();
}