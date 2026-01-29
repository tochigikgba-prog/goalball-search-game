// Firebase設定
const firebaseConfig = { /* ご自身のAPIキー等 */ };
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
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
    // 左右確認・ヒント（unlockAudioで音の通り道を確保）
    document.getElementById("leftRightBtn")?.addEventListener("click", () => { unlockAudio(); playSound('zunda_check.mp3'); });
    document.getElementById("hintBtn")?.addEventListener("click", () => { unlockAudio(); playSound('hint.mp3'); });

    // モード開始
    document.getElementById("btnStartTraining")?.addEventListener("click", () => startGame("practice"));
    document.getElementById("btnStartPro")?.addEventListener("click", () => startGame("championship"));

    // 選手権への切り替え
    document.getElementById("btnSwitchToPro")?.addEventListener("click", () => {
        stopCurrentAudio();
        startGame("championship");
    });

    // キーパッド入力
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => handleKeyInput(btn.getAttribute("data-key")));
    });

    document.getElementById("nameSubmitBtn")?.addEventListener("click", submitScore);
    
    // もどるボタン
    ["btnReturnToTop", "btnReturnFromGame"].forEach(id => {
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
    document.getElementById("rankingArea").classList.add("hidden");
    document.getElementById("gamePlayArea").classList.remove("hidden");

    // モードに応じた開始音
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
            // 正解の音（answer_x.mp3）を鳴らす
            playSound(`answer_${currentCorrectAnswer}.mp3`, () => {
                if (gameMode === "championship") endGame();
                else setTimeout(nextQuestion, 1000); // 練習なら次へ
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
    } catch (e) { list.innerHTML = "取得失敗"; }
}

async function submitScore() {
    const name = document.getElementById("nameInput")?.value || "ななしさん";
    try {
        await db.collection("GSRanking").add({ name: name, score: score, date: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById("scoreSubmitArea").style.display = "none";
        showRanking();
    } catch (e) { alert("登録失敗"); }
}