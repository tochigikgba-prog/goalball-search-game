// ==========================================
// 1. 初期設定・変数
// ==========================================
let score = 0;
let practiceCount = 0;   
let practiceCorrect = 0; 
let currentCorrectAnswer = null;
let gameMode = ""; 
let currentAudio = null; // 現在再生中の音声を保持

// 出題されるボールの位置
const ballPositions = [0, 1, 2, 3, 4, 4.5, 5, 6, 7, 8, 9];

// 「どこ？」のファイルリスト（soundフォルダ）
const whereSounds = [
    "sound/where_1.mp3",
    "sound/where_2.mp3",
    "sound/where_3.mp3",
    "sound/where_4.mp3",
    "sound/where_5.mp3"
];

// ファイル名用にインデックスを正規化（4.5 -> 45 など）
function fileIdFor(n) {
    return String(n).replace('.', '');
}

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
// 2. アクセシビリティ・スマホ操作強化（新機能なのだ！）
// ==========================================

function setupGlobalControls() {
    // A. 画面全体のタップ対応（スマホ・PC共通）
    document.body.addEventListener('click', (e) => {
        // 音が鳴っている時、かつボタン以外の場所を触ったら停止
        if (currentAudio && e.target.tagName !== 'BUTTON') {
            console.log("画面タップで停止したのだ！");
            stopAllSounds();
        }
    }, true);

    // B. キーボード対応（PC用：スペースキーで停止）
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && currentAudio) {
            console.log("スペースキーで停止したのだ！");
            stopAllSounds();
            e.preventDefault(); // 画面スクロール防止
        }
    });
}

// ==========================================
// 3. モード開始・再生コントロール
// ==========================================

function stopAllSounds() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    const status = document.getElementById("statusArea");
    if (status && gameMode === "") {
        status.innerText = "音を止めたのだ。モードを選んでね。";
    }
}

function checkSound() {
    const status = document.getElementById("statusArea");
    if (status) status.innerText = "ずんだもんが左右を確認中...（画面タップで停止）";
    playSound("sound/zunda_check.mp3", () => {
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
    playSound("sound/start_pro.mp3", () => {
        nextQuestion();
    });
}

// ==========================================
// 4. ゲーム進行ロジック
// ==========================================

function nextQuestion() {
    if (gameMode === "practice" && practiceCount >= 5) {
        finishPractice();
        return;
    }

    const randomIndex = Math.floor(Math.random() * ballPositions.length);
    currentCorrectAnswer = ballPositions[randomIndex];
    
    document.getElementById("statusArea").innerText = "よく聴くのだ...";
    document.getElementById("currentInput").innerText = "-"; 

    // 1. 試合セット（quiz_X.mp3）を再生
    playSound(`sound/quiz_${fileIdFor(currentCorrectAnswer)}.mp3`, () => {
        // 2. 終わったらランダムに「どこ？」を再生
        const randomDoko = whereSounds[Math.floor(Math.random() * whereSounds.length)];
        playSound(randomDoko, () => {
            // 3. マイク起動
            startAnswerListening();
        });
    });
}

function checkAnswer(playerInput) {
    if (parseFloat(playerInput) === currentCorrectAnswer) {
        if (gameMode === "practice") practiceCorrect++;
        score++;
        // 正解時のバイブレーション（スマホのみ）
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        
        playSound("sound/seikai.mp3", () => {
            if (gameMode === "practice") practiceCount++;
            setTimeout(nextQuestion, 800);
        });
    } else {
        // 不正解時のバイブレーション（スマホのみ）
        if (navigator.vibrate) navigator.vibrate(500);

        playSound("sound/no.mp3", () => {
            playSound(`sound/answer_${fileIdFor(currentCorrectAnswer)}.mp3`, () => {
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
// 5. 音声入力処理
// ==========================================

function startAnswerListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    document.getElementById("statusArea").innerText = "どこなのだ？（番号を言ってね）";

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript || '';

        // Normalize common Japanese number words (kanji/hiragana/katakana) to digits
        function normalizeJapaneseNums(s) {
            const mapChars = {
                '０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9',
                '〇':'0','零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'
            };
            let out = s;
            // replace kanji/zenkaku digits
            out = out.split('').map(ch => mapChars[ch] !== undefined ? mapChars[ch] : ch).join('');
            // replace kana words for 0-9 (simple common ones)
            const kanaMap = {
                'いち':'1','に':'2','さん':'3','よん':'4','し':'4','ご':'5','ろく':'6','なな':'7','しち':'7','はち':'8','きゅう':'9','く':'9','ぜろ':'0','れい':'0',
                'イチ':'1','ニ':'2','サン':'3','ヨン':'4','シ':'4','ゴ':'5','ロク':'6','ナナ':'7','シチ':'7','ハチ':'8','キュウ':'9','ク':'9','ゼロ':'0'
            };
            // replace kana tokens (longer first)
            Object.keys(kanaMap).sort((a,b)=>b.length-a.length).forEach(k => {
                out = out.replace(new RegExp(k,'g'), kanaMap[k]);
            });
            return out;
        }

        let normalized = transcript;
        normalized = normalized.replace(/\s+/g, '');
        normalized = normalizeJapaneseNums(normalized);
        // Treat '点'/'てん'/'テン' as decimal point
        normalized = normalized.replace(/[点てんテン]/g, '.');
        // Keep only digits and dot
        let cleaned = normalized.replace(/[^0-9.]/g, '');

        let num = parseFloat(cleaned);

        // If recognition returned an integer like 45 but current correct answer is 4.5 (file id 45), adjust
        if ((isNaN(num) || Number.isInteger(num)) && currentCorrectAnswer != null) {
            const expectedFileId = fileIdFor(currentCorrectAnswer);
            const onlyDigits = cleaned.replace(/\./g, '');
            if (onlyDigits === expectedFileId) {
                num = currentCorrectAnswer;
                cleaned = String(currentCorrectAnswer);
            }
        }

        if (!isNaN(num)) {
            // Display with decimal if needed
            const display = String(cleaned).includes('.') ? String(num) : String(num);
            document.getElementById("currentInput").innerText = display;
            checkAnswer(num);
        } else {
            document.getElementById("statusArea").innerText = "聞き取れなかったのだ。もう一度！";
            setTimeout(startAnswerListening, 1000);
        }
    };
    recognition.start();
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.onresult = (event) => {
        document.getElementById("nameInput").value = event.results[0][0].transcript;
    };
    recognition.start();
}

// ==========================================
// 6. コア関数・ランキング
// ==========================================

function playSound(file, callback) {
    stopAllSounds();
    currentAudio = new Audio(file);
    currentAudio.play().then(() => {
        if (callback) {
            currentAudio.onended = () => {
                currentAudio = null;
                callback();
            };
        }
    }).catch(e => {
        console.error("再生エラー:", file, e);
        if (callback) callback();
    });
}

function finishPractice() {
    document.getElementById("statusArea").innerText = `練習終了！5問中 ${practiceCorrect}問 正解なのだ！`;
    playSound("sound/otsukare.mp3", () => {
        setTimeout(() => { location.reload(); }, 4000);
    });
}

function endGame() {
    document.getElementById("gameArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;
    if (score > 0) document.getElementById("scoreSubmitArea").style.display = "block";
    loadRanking();
}

async function submitScore() {
    const name = document.getElementById("nameInput").value || "ななし";
    await db.collection("rankings").add({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("scoreSubmitArea").style.display = "none";
    loadRanking();
}

async function loadRanking() {
    const snapshot = await db.collection("rankings").orderBy("score", "desc").limit(10).get();
    let html = "<h3>TOP 10</h3>";
    snapshot.forEach(doc => {
        const data = doc.data();
        html += `<p>${data.name}: ${data.score}点</p>`;
    });
    document.getElementById("rankingList").innerHTML = html;
}

// 読み込み完了時にコントロールをセットアップ
window.addEventListener('load', setupGlobalControls);