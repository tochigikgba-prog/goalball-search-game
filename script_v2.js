/* script_v2.js - 判定ロジック・音声連携統合版 */

const SOUND_PATH = "sound/";

// 入力確認用の音声ファイル
const INPUT_FILES = {
  "0":"0.mp3", "1":"1.mp3", "2":"2.mp3", "3":"3.mp3", "4":"4.mp3",
  "5":"5.mp3", "6":"6.mp3", "7":"7.mp3", "8":"8.mp3", "9":"9.mp3",
  ".":"dot.mp3", 
  "C":"clear.mp3", 
  "4.5":"quiz_45.mp3", 
  "Enter":"confirm.mp3"
};

// 判定・回答用の音声ファイル
const JUDGE_FILES = {
  "SUCCESS": "seikai.mp3",
  "NO": "no.mp3",
  // 正解を教える時の音声リスト
  "ANSWERS": {
    "0": "answer_0.mp3", "1": "answer_1.mp3", "2": "answer_2.mp3",
    "3": "answer_3.mp3", "4": "answer_4.mp3", "4.5": "answer_45.mp3",
    "5": "answer_5.mp3", "6": "answer_6.mp3", "7": "answer_7.mp3",
    "8": "answer_8.mp3", "9": "answer_9.mp3"
  }
};

let playerInput = "";
let currentAudio = null;

// ★現在出題中の正解（ゲーム開始時や次問移行時に更新してください）
let currentCorrectAnswer = "4.5"; 

// 画面上のボタン処理
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    const k = btn.getAttribute("data-key");
    handleKeyInput(k);
  });
});

// PCキーボード・テンキーの処理
document.addEventListener("keydown", (e) => {
  const key = e.key;
  if (/^[0-9]$/.test(key) || key === "." || key.toLowerCase() === "c") {
    if (key === "." && playerInput.includes(".")) return;
    handleKeyInput(key.toUpperCase());
  } 
  else if (key === "/" || key === "*") {
    handleKeyInput("4.5");
    e.preventDefault(); 
  } 
  else if (key === "Enter") {
    handleKeyInput("Enter");
  } 
  else if (key === "Backspace") {
    playerInput = playerInput.slice(0, -1);
    updateDisplay();
  }
});

/**
 * 入力を処理する関数
 */
function handleKeyInput(k) {
  const a11y = document.getElementById("a11yStatus");
  if (navigator.vibrate) navigator.vibrate(40); 

  if (k === "C") {
    playerInput = "";
    playSound(INPUT_FILES["C"]);
    a11y.textContent = "クリアしました";
  } else if (k === "Enter") {
    if (playerInput === "") {
        a11y.textContent = "数字を入力してください";
        return;
    }
    playSound(INPUT_FILES["Enter"]);
    confirmAnswer(); 
  } else if (k === "4.5") {
    playerInput = "4.5";
    playSound(INPUT_FILES["4.5"]);
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  } else {
    playerInput += k;
    playSound(INPUT_FILES[k]);
  }
  updateDisplay();
}

/**
 * 【判定ロジック】正解・不正解の音声を制御
 */
function confirmAnswer() {
  const a11y = document.getElementById("a11yStatus");

  if (playerInput === currentCorrectAnswer) {
    // 【正解】seikai.mp3 を再生
    playSound(JUDGE_FILES["SUCCESS"]);
    a11y.textContent = "正解です！";
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
  } else {
    // 【不正解】no.mp3 を再生し、終わったら answer_X.mp3 を再生
    a11y.textContent = "不正解です。正解は " + currentCorrectAnswer + " でした。";
    if (navigator.vibrate) navigator.vibrate(400); 

    playJudgementSequentially(JUDGE_FILES["NO"], JUDGE_FILES["ANSWERS"][currentCorrectAnswer]);
  }

  playerInput = "";
  updateDisplay();
}

/**
 * 2つの音声を順番に再生する（不正解時用）
 */
function playJudgementSequentially(firstFile, secondFile) {
  if (currentAudio) {
    currentAudio.pause();
  }

  // 1つ目の音（no.mp3）
  currentAudio = new Audio(SOUND_PATH + firstFile);
  currentAudio.play();

  // 1つ目が終わったら2つ目（answer_X.mp3）を流す
  currentAudio.onended = () => {
    currentAudio = new Audio(SOUND_PATH + secondFile);
    currentAudio.play();
  };
}

function updateDisplay() {
  const display = document.getElementById("currentInput");
  const a11y = document.getElementById("a11yStatus");
  display.textContent = playerInput;
  if (playerInput !== "") a11y.textContent = playerInput + " を入力中";
}

function playSound(filename) {
  if (!filename) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  currentAudio = new Audio(SOUND_PATH + filename);
  currentAudio.play().catch(err => console.log("再生失敗:", err));
}