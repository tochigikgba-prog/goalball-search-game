/* script.js
 - 前提：すべての音声ファイルは sound/ フォルダにある
 - 事前プリロード（Audio要素を作る）
 - 再生は await を使って順次再生（重ならない）
 - 再生停止は現在のAudioを停止する
*/

const SOUND_PATH = "sound/";

// --- 音声ファイル一覧（名前はexact） ---
const QUIZ_FILES = {
  "0":"quiz_0.mp3",
  "1":"quiz_1.mp3",
  "2":"quiz_2.mp3",
  "3":"quiz_3.mp3",
  "4":"quiz_4.mp3",
  "4.5":"quiz_45.mp3",
  "5":"quiz_5.mp3",
  "6":"quiz_6.mp3",
  "7":"quiz_7.mp3",
  "8":"quiz_8.mp3",
  "9":"quiz_9.mp3"
};

// answer file mapping (不正解時に流す)
const ANSWER_FILES = {
  "0":"answer_0.mp3","1":"answer_1.mp3","2":"answer_2.mp3","3":"answer_3.mp3",
  "4":"answer_4.mp3","4.5":"answer_45.mp3","5":"answer_5.mp3","6":"answer_6.mp3",
  "7":"answer_7.mp3","8":"answer_8.mp3","9":"answer_9.mp3"
};

const seikaiFile = "seikai.mp3";
const noFile = "no.mp3";
const ruleFiles = ["zunda_rule001.mp3","zunda_rule002.mp3","zunda_rule003.mp3","zunda_rule004.mp3","zunda_rule005.mp3"];
const hintSeqFiles = ["hint_01.mp3","hint.mp3"];
const hintBellFiles = ["hint.mp3"];
const checkFile = "zunda_check.mp3";
const enterSound = "enter.mp3";

// --- UI要素 ---
const ruleBtn = document.getElementById("ruleBtn");
const checkBtn = document.getElementById("checkBtn");
const stopBtn = document.getElementById("stopBtn");
const hintBtn = document.getElementById("hintBtn");
const hintBellBtn = document.getElementById("hintBellBtn");
const startBtn = document.getElementById("startBtn");
const keypad = document.getElementById("keypad");
const keypadWrap = document.getElementById("keypadWrap");
const currentInput = document.getElementById("currentInput");
const questionLabel = document.getElementById("questionLabel");
const resultDiv = document.getElementById("result");
const retryWrap = document.getElementById("retryWrap");
const retryBtn = document.getElementById("retryBtn");
const scoreDisplay = document.getElementById("scoreDisplay");

let audioMap = {}; // プリロードしたAudio要素を保存
let currentAudio = null; // 現在再生中のAudio
let isPlaying = false; // 何か再生中（ロック）
let gameQueue = []; // 今回の3問のファイル名
let questionIndex = 0;
let playerInput = ""; // 文字列継続（4 . 5 の順）
let score = 0;
const TOTAL_QUESTIONS = 3;

// ----- ヘルパー：プリロード -----
function preload(filename){
  const path = SOUND_PATH + filename;
  const a = new Audio(path);
  a.preload = "auto";
  audioMap[filename] = a;
}

// preload all used files
function preloadAll(){
  // quiz files
  Object.values(QUIZ_FILES).forEach(preload);
  // answers
  Object.values(ANSWER_FILES).forEach(preload);
  // feedback etc.
  [seikaiFile,noFile,enterSound,checkFile].forEach(f=>preload(f));
  ruleFiles.forEach(preload);
  hintSeqFiles.forEach(preload);
  hintBellFiles.forEach(preload);
}
preloadAll();

// ----- 再生ユーティリティ（await） -----
function playAudioElement(filename){
  return new Promise((resolve, reject) => {
    if (!filename) {
      console.error("playAudioElement: filename is falsy", filename);
      resolve();
      return;
    }
    // Use a fresh Audio instance cloned from preloaded element when available,
    // to avoid listener duplication or other side-effects on shared Audio objects.
    let a;
    if (audioMap[filename]) {
      try {
        a = audioMap[filename].cloneNode(true);
      } catch (e) {
        a = new Audio(SOUND_PATH + filename);
      }
    } else {
      a = new Audio(SOUND_PATH + filename);
    }
    a.preload = "auto";
    // reset
    try { a.pause(); a.currentTime = 0; } catch(e){}
    currentAudio = a;
    isPlaying = true;
    const onEnded = () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onErr);
      currentAudio = null;
      isPlaying = false;
      resolve();
    };
    const onErr = (ev) => {
      a.removeEventListener("error", onErr);
      a.removeEventListener("ended", onEnded);
      isPlaying = false;
      currentAudio = null;
      console.error("audio error", filename, ev);
      resolve(); // resolve to not block flow
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onErr);
    a.play().catch(err => {
      console.warn("play promise rejected", err);
      onEnded();
    });
  });
}

// play multiple files in sequence with gap(ms)
async function playSequence(files, gap = 500){
  // prevent overlap
  if (isPlaying) return;
  for (const f of files){
    if (stopRequested) break;
    await playAudioElement(f);
    // gap
    if (gap > 0 && !stopRequested){
      await new Promise(r => setTimeout(r, gap));
    }
  }
}

// stop controller
let stopRequested = false;
function stopAll(){
  stopRequested = true;
  if (currentAudio){
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch(e){}
  }
  isPlaying = false;
  // reset flag briefly then allow new playback
  setTimeout(()=>{ stopRequested=false; }, 50);
}

// --- UI動作制御：重ならないようにする ---
// Note: keep stopBtn enabled so user can interrupt playback.
function disableControlsDuringPlayback(disabled){
  const controls = [ruleBtn, checkBtn, hintBtn, hintBellBtn, startBtn, ...document.querySelectorAll("#keypad button")];
  controls.forEach(el=>{
    if (el) el.disabled = disabled;
  });
}

// --- Play handlers ---
ruleBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(ruleFiles, 500);
  disableControlsDuringPlayback(false);
});

checkBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence([checkFile], 0);
  disableControlsDuringPlayback(false);
});

hintBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(hintSeqFiles, 500); // hint_01 -> hint
  disableControlsDuringPlayback(false);
});

hintBellBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(hintBellFiles, 500); // hint only
  disableControlsDuringPlayback(false);
});

// Consolidated stop handler: always available to interrupt playback
stopBtn.addEventListener("click", () => {
  stopAll();
  disableControlsDuringPlayback(false);
  resultDiv.textContent = "再生を停止しました";
});

// --- Game flow helpers ---
function pick3Questions(){
  // pick 3 random with replacement but ensure not all 3 identical
  const keys = Object.keys(QUIZ_FILES); // string keys like "0","1","4.5",...
  let picks;
  do {
    picks = [keys[Math.floor(Math.random()*keys.length)],
             keys[Math.floor(Math.random()*keys.length)],
             keys[Math.floor(Math.random()*keys.length)]];
  } while (picks[0] === picks[1] && picks[1] === picks[2]);
  return picks;
}

// show keypad helper
function showKeypad(show){
  const el = document.getElementById("keypad");
  if (show){
    el.setAttribute("aria-hidden","false");
  } else {
    el.setAttribute("aria-hidden","true");
  }
  // also visually hide wrapper if needed
  keypadWrap.style.display = show ? "block" : "none";
}

// speak helper (for Q3 audio feedback)
function speak(text){
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){}
}

// start game or retry
startBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);

async function startGame(){
  if (isPlaying) return;
  // reset
  score = 0;
  questionIndex = 0;
  playerInput = "";
  resultDiv.textContent = "";
  scoreDisplay.textContent = "";
  retryWrap.style.display = "none";

  // prepare queue
  gameQueue = pick3Questions();
  console.log("picked questions", gameQueue);
  showKeypad(true); // display keypad now (Q1 choice)
  document.getElementById("keypad").setAttribute("aria-hidden","false");
  // Wait 0.5s then play first question
  await new Promise(r=>setTimeout(r, 500));
  nextQuestion();
}

async function nextQuestion(){
  if (questionIndex >= TOTAL_QUESTIONS) {
    endGame();
    return;
  }
  const q = gameQueue[questionIndex];
  questionLabel.textContent = `問題 ${questionIndex+1}`;
  currentInput.textContent = "あなたの回答：なし";
  playerInput = "";
  resultDiv.textContent = "";
  // play quiz audio (use QUIZ_FILES)
  const filename = QUIZ_FILES[q];
  if (!filename){
    console.error("no quiz file mapping for", q);
    return;
  }
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playAudioElement(filename);
  disableControlsDuringPlayback(false);
  questionIndex++;
}

// confirm answer (Enter)
async function confirmAnswer(){
  if (isPlaying) return; // wait until any audio finished
  if (playerInput === "") return;
  // Ensure at least one question has been played
  const currentQIndex = questionIndex - 1;
  if (currentQIndex < 0 || !gameQueue[currentQIndex]) {
    // no question available yet; ignore confirm
    console.warn("confirmAnswer called before a question was played");
    return;
  }
  // play enter sound
  if (audioMap[enterSound]) await playAudioElement(enterSound);
  // check
  const expected = gameQueue[currentQIndex];
  const a = (playerInput || "").trim();
  const b = (expected || "").trim();
  if (a === b){
    score++;
    resultDiv.textContent = "正解！";
    speak("正解です");
    await playAudioElement(seikaiFile);
  } else {
    resultDiv.textContent = `不正解... 正解は ${b}`;
    speak("不正解です。正解を再生します");
    await playAudioElement(noFile);
    const ansFile = ANSWER_FILES[b] || QUIZ_FILES[b];
    if (ansFile) await playAudioElement(ansFile);
  }
  // after feedback, if more questions remain, small pause then nextQuestion
  if (questionIndex < TOTAL_QUESTIONS){
    await new Promise(r=>setTimeout(r,1500));
    nextQuestion();
  } else {
    endGame();
  }
}

// end game
function endGame(){
  showKeypad(false);
  questionLabel.textContent = "ゲーム終了";
  resultDiv.textContent = "";
  // display score above retry
  scoreDisplay.textContent = `あなたのスコア： ${score} / ${TOTAL_QUESTIONS}`;
  retryWrap.style.display = "block";
  // speak final
  speak(`ゲーム終了。あなたのスコアは ${score} 点です。再挑戦ボタンで再び遊べます。`);
}

// keypad input handling
document.querySelectorAll("#keypad .key").forEach(btn=>{
  btn.addEventListener("click",(e)=>{
    const k = btn.getAttribute("data-key");
    handleKeyInput(k);
  });
});

document.addEventListener("keydown", (e)=>{
  const key = e.key;
  if (["0","1","2","3","4","5","6","7","8","9","."].includes(key)){
    handleKeyInput(key);
  } else if (key === "Enter"){
    // only confirm when a question has been played at least once in this cycle
    if (questionIndex>0) confirmAnswer();
  }
});

function handleKeyInput(k){
  if (isPlaying) return; // block while playback
  if (k === "Enter"){
    confirmAnswer();
    return;
  }
  // append: allow building numbers like 4 . 5 -> "4.5"
  // But prevent repeated dots
  if (k === "." && playerInput.includes(".")) return;
  playerInput += k;
  currentInput.textContent = `あなたの回答：${playerInput}`;
}

// When page loaded, keypad initially hidden
showKeypad(false);