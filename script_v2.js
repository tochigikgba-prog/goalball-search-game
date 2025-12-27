/* script_v2.js */

const SOUND_PATH = "sound/";

// 音声ファイルの設定
// 作成された4.5ボタン用の音声や、ドット（点）の音声をここに追加してください
const INPUT_FILES = {
  "0":"0.mp3", "1":"1.mp3", "2":"2.mp3", "3":"3.mp3", "4":"4.mp3",
  "5":"5.mp3", "6":"6.mp3", "7":"7.mp3", "8":"8.mp3", "9":"9.mp3",
  ".":"dot.mp3", "C":"clear.mp3", "4.5":"quiz_45.mp3", "Enter":"confirm.mp3"
};

let playerInput = "";
let currentAudio = null;

// 画面上のボタン（マウス/タップ）の処理
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    const k = btn.getAttribute("data-key");
    handleKeyInput(k);
  });
});

// PCテンキー・キーボード入力の処理
document.addEventListener("keydown", (e) => {
  const key = e.key;
  
  // 数字キー、ドット、Cキーの判定
  if (/^[0-9]$/.test(key) || key === "." || key.toLowerCase() === "c") {
    // ドットの二重入力防止
    if (key === "." && playerInput.includes(".")) return;
    handleKeyInput(key.toUpperCase());
  } else if (key === "Enter") {
    handleKeyInput("Enter");
  } else if (key === "Backspace") {
    // 1文字消去が必要な場合はここ
    playerInput = playerInput.slice(0, -1);
    updateDisplay();
  }
});

/**
 * 全ての入力を集約して処理する関数
 * @param {string} k - 入力された値 ("0"-"9", ".", "4.5", "C", "Enter")
 */
function handleKeyInput(k) {
  const a11y = document.getElementById("a11yStatus");

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
    confirmAnswer(); // ここに既存の判定処理を繋ぐ
  } else if (k === "4.5") {
    // 画面の「4.5」ボタンを押した時のみ実行（一発入力）
    playerInput = "4.5";
    playSound(INPUT_FILES["4.5"]);
  } else {
    // 通常の数字とドットの入力
    playerInput += k;
    playSound(INPUT_FILES[k]);
  }

  updateDisplay();
}

// 画面表示と読み上げの更新
function updateDisplay() {
  const display = document.getElementById("currentInput");
  const a11y = document.getElementById("a11yStatus");
  
  display.textContent = playerInput;
  
  // スクリーンリーダーへの動的な通知
  if (playerInput !== "") {
    a11y.textContent = playerInput + " を入力中";
  }
}

// 音声を再生する共通関数
function playSound(filename) {
  if (!filename) return;
  
  // 再生中の音があれば止める（連打対応）
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  
  currentAudio = new Audio(SOUND_PATH + filename);
  currentAudio.play().catch(err => console.log("再生失敗:", err));
}

// 既存の判定ロジックへの橋渡し
function confirmAnswer() {
  console.log("確定された回答:", playerInput);
  // ここに既存の questionIndex 増減や正解チェックのコードを記述します
  // 例: if(playerInput === correctAns) { ... }
}

// その他の初期化（ルールボタンなど）は既存のコードをそのまま利用してください