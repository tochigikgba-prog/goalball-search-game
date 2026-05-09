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

// 「どこ？」のファイルリスト
const whereSounds = [
    "sounds/where_1.mp3",
    "sounds/where_2.mp3",
    "sounds/where_3.mp3",
    "sounds/where_4.mp3",
    "sounds/where_5.mp3"
];

// Firebaseの初期化
const firebaseConfig = {
    apiKey: "AIzaSyDwBUd2D1Mt8HlZbh9Mvpi95JP6P0F7S7E",
    authDomain: "gsranking.firebaseapp.com",
    projectId: "gsranking",
    storageBucket: "gsranking.firebasestorage.app",
    messagingSenderId: "876090875752",
    appId: "1:876090875752:web:7841b486506842230ec0dd",
    measurementId: "G-M1Y9F13D2E"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 2. モード開始・左右確認処理
// ==========================================

function checkSound() {
    const soundPath = "sound/zunda_check.mp3";
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
    
    document.getElementById("statusArea").innerText = "試合開始...";
    document.getElementById("currentInput").innerText = "-"; 

    // 1. 試合開始セット（クワイエット〜鈴の音）を再生
    // ※ファイル名ルール: sound/set_0.mp3 等と仮定しています
    // 修正後
playSound(`sound/quiz_${currentCorrectAnswer}.mp3`, () => {
        
        // 2. 終わったらランダムに「どこ？」を再生
        const randomDoko = whereSounds[Math.floor(Math.random() * whereSounds.length)];
        playSound(randomDoko, () => {
            
            // 3. 「どこ？」が終わったらマイク起動！
            startAnswerListening();
        });
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

// 名前入力用の音声認識
function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("音声入力非対応です"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.onresult = (event) => {
        document.getElementById("nameInput").value = event.results[0][0].transcript;
        document.getElementById("statusArea").innerText = "聞き取り完了：" + event.results[0][0].transcript;
    };
    recognition.start();
}

// 【追加】回答を聞き取るための音声認識関数
function startAnswerListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { console.log("音声認識非対応"); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    document.getElementById("statusArea").innerText = "回答をどうぞ！";

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // 数字だけを抜き出す
        const num = parseFloat(transcript.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
            document.getElementById("currentInput").innerText = num;
            checkAnswer(num);
        } else {
            document.getElementById("statusArea").innerText = "数字が聞き取れませんでした…";
            setTimeout(nextQuestion, 1000); // 再挑戦用に次へ
        }
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
        alert("送信に失敗しました。");
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