/* script.js
 - 前提：すべての音声ファイルは sound/ フォルダにある
 - 機能：4.5を含む小数点入力、キーパッド/Enterでの決定、3問中2問以上で成功音源再生。
 - 修正点：speak()を削除し、用意された音声ファイルのみを使用。成功音源(game_success.mp3)のロジック追加。
 - FIX：endGame後にボタンの無効化状態を解除。
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

// answer file mapping (不正解時に流す正解の音)
const ANSWER_FILES = {
  "0":"answer_0.mp3","1":"answer_1.mp3","2":"answer_2.mp3","3":"answer_3.mp3",
  "4":"answer_4.mp3","4.5":"answer_45.mp3","5":"answer_5.mp3","6":"answer_6.mp3",
  "7":"answer_7.mp3","8":"answer_8.mp3","9":"answer_9.mp3"
};

const seikaiFile = "seikai.mp3";
const noFile = "no.mp3";
const ruleFiles = ["zunda_rule001.mp3","zunda_rule002.mpuzunda_rule003.mp3","zunda_rule004.mp3","zunda_rule005.mp3"];
const hintSeqFiles = ["hint_01.mp3","hint.mp3"];
const hintBellFiles = ["hint.mp3"];
const checkFile = "zunda_check.mp3";
const enterSound = "enter.mp3";
const gameSuccessFile = "game_success.mp3"; 

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
const a11yStatus = document.getElementById("a11yStatus"); 

let audioMap = {}; 
let currentAudio = null; 
let isPlaying = false; 
let gameQueue = []; 
let questionIndex = 0;
let playerInput = ""; 
let score = 0;
const TOTAL_QUESTIONS = 3;

// ----- I. 初期化とプリロード -----
function preload(filename){
  const path = SOUND_PATH + filename;
  const a = new Audio(path);
  a.preload = "auto";
  audioMap[filename] = a;
}

function preloadAll(){
  Object.values(QUIZ_FILES).forEach(preload);
  Object.values(ANSWER_FILES).forEach(preload);
  [seikaiFile,noFile,enterSound,checkFile,gameSuccessFile].forEach(f=>preload(f)); 
  ruleFiles.forEach(preload);
  hintSeqFiles.forEach(preload);
  hintBellFiles.forEach(preload);
}
preloadAll();

// ----- II. 再生ユーティリティ -----
function playAudioElement(filename){
  return new Promise((resolve, reject) => {
    if (!filename) { resolve(); return; }
    let a;
    if (audioMap[filename]) {
      try { a = audioMap[filename].cloneNode(true); } catch (e) { a = new Audio(SOUND_PATH + filename); }
    } else {
      a = new Audio(SOUND_PATH + filename);
    }
    a.preload = "auto";
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
      resolve(); 
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onErr);
    a.play().catch(err => {
      console.warn("play promise rejected", err);
      onEnded();
    });
  });
}

async function playSequence(files, gap = 500){
  if (isPlaying) return;
  for (const f of files){
    if (stopRequested) break;
    await playAudioElement(f);
    if (gap > 0 && !stopRequested){
      await new Promise(r => setTimeout(r, gap));
    }
  }
}

let stopRequested = false;
function stopAll(){
  stopRequested = true;
  if (currentAudio){
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch(e){}
  }
  isPlaying = false;
  setTimeout(()=>{ stopRequested=false; }, 50);
}

function disableControlsDuringPlayback(disabled){
  const controls = [ruleBtn, checkBtn, hintBtn, hintBellBtn, startBtn, retryBtn, ...document.querySelectorAll("#keypad button")];
  controls.forEach(el=>{
    if (el) el.disabled = disabled;
  });
}

// --- III. ゲームフローヘルパー ---
function pick3Questions(){
  const keys = Object.keys(QUIZ_FILES); 
  let picks;
  do {
    picks = [keys[Math.floor(Math.random()*keys.length)],
             keys[Math.floor(Math.random()*keys.length)],
             keys[Math.floor(Math.random()*keys.length)]];
  } while (picks[0] === picks[1] && picks[1] === picks[2]);
  return picks;
}

function showKeypad(show){
  if(keypad) {
      keypad.setAttribute("aria-hidden", show ? "false" : "true");
  }
  if(keypadWrap) {
    keypadWrap.style.display = show ? "flex" : "none"; 
    keypadWrap.setAttribute("aria-hidden", show ? "false" : "true");
    if(startBtn) startBtn.setAttribute("aria-expanded", show ? "true" : "false");
  }
}

// --- IV. ゲームフロー ---
async function startGame(){
  if (isPlaying) return;
  // reset
  score = 0;
  questionIndex = 0;
  playerInput = "";
  if(resultDiv) resultDiv.textContent = "";
  if(scoreDisplay) scoreDisplay.textContent = "";
  if(retryWrap) retryWrap.style.display = "none";
  if(a11yStatus) a11yStatus.textContent = "ゲームを開始します。";

  // prepare queue
  gameQueue = pick3Questions();
  showKeypad(true); 
  await new Promise(r=>setTimeout(r, 500));
  nextQuestion();
}

async function nextQuestion(){
  if (questionIndex >= TOTAL_QUESTIONS) {
    endGame();
    return;
  }
  const q = gameQueue[questionIndex];
  if(questionLabel) questionLabel.textContent = `問題 ${questionIndex+1} / ${TOTAL_QUESTIONS}`;
  if(currentInput) currentInput.textContent = "あなたの回答：なし";
  playerInput = "";
  if(resultDiv) resultDiv.textContent = "";
  if(a11yStatus) a11yStatus.textContent = `問題 ${questionIndex+1}、再生します。`;
  
  const filename = QUIZ_FILES[q];
  if (!filename){ console.error("no quiz file mapping for", q); return; }
  
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playAudioElement(filename);
  disableControlsDuringPlayback(false);
  questionIndex++;
}

async function confirmAnswer(){
  if (isPlaying) return; 
  if (playerInput === "") {
    if(a11yStatus) a11yStatus.textContent = "回答を入力してください。";
    return;
  }
  
  const currentQIndex = questionIndex - 1;
  if (currentQIndex < 0 || !gameQueue[currentQIndex]) { return; }
  
  if (audioMap[enterSound]) await playAudioElement(enterSound);
  
  const expected = gameQueue[currentQIndex];
  const a = (playerInput || "").trim();
  const b = (expected || "").trim();
  
  disableControlsDuringPlayback(true);
  
  if (a === b){
    score++;
    if(resultDiv) resultDiv.textContent = "正解！";
    if(a11yStatus) a11yStatus.textContent = "正解です！";
    await playAudioElement(seikaiFile);
  } else {
    if(resultDiv) resultDiv.textContent = `不正解... 正解は ${b}`;
    if(a11yStatus) a11yStatus.textContent = `不正解です。正解は ${b} でした。`;
    await playAudioElement(noFile);
    const ansFile = ANSWER_FILES[b] || QUIZ_FILES[b];
    if (ansFile) await playAudioElement(ansFile);
  }
  
  if (questionIndex < TOTAL_QUESTIONS){
    await new Promise(r=>setTimeout(r,1500));
    nextQuestion();
  } else {
    endGame();
  }
}

async function endGame(){
  showKeypad(false);
  if(questionLabel) questionLabel.textContent = "ゲーム終了";
  if(resultDiv) resultDiv.textContent = "";
  
  if (score >= 2) {
      if (audioMap[gameSuccessFile]) {
          await playAudioElement(gameSuccessFile);
      }
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点です。お見事！`;
  } else {
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点です。再挑戦ボタンで再び遊べます。`;
  }
  
  if(scoreDisplay) scoreDisplay.textContent = `あなたのスコア： ${score} / ${TOTAL_QUESTIONS}`;
  if(retryWrap) retryWrap.style.display = "block";
  
  // ★ FIX: 再挑戦ボタンを含む全てのコントロールを有効に戻す
  disableControlsDuringPlayback(false); 
}


// --- V. イベントリスナー ---
ruleBtn && ruleBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(ruleFiles, 500);
  disableControlsDuringPlayback(false);
});

checkBtn && checkBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence([checkFile], 0);
  disableControlsDuringPlayback(false);
});

hintBtn && hintBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(hintSeqFiles, 500); 
  disableControlsDuringPlayback(false);
});

hintBellBtn && hintBellBtn.addEventListener("click", async () => {
  if (isPlaying) return;
  disableControlsDuringPlayback(true);
  stopRequested = false;
  await playSequence(hintBellFiles, 500); 
  disableControlsDuringPlayback(false);
});

stopBtn && stopBtn.addEventListener("click", () => {
  stopAll();
  disableControlsDuringPlayback(false);
  if(resultDiv) resultDiv.textContent = "再生を停止しました";
  if(a11yStatus) a11yStatus.textContent = "再生を停止しました";
});

startBtn && startBtn.addEventListener("click", startGame);
retryBtn && retryBtn.addEventListener("click", startGame);

// キーパッド入力処理
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
    if (questionIndex>0) confirmAnswer();
  }
});

function handleKeyInput(k){
  if (isPlaying) return; 
  if (k === "Enter"){
    confirmAnswer();
    return;
  }
  
  if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
  
  if (k === "." && playerInput.includes(".")) return;
  if (!["0","1","2","3","4","5","6","7","8","9","."].includes(k)) return;
  
  playerInput += k;
  if(currentInput) currentInput.textContent = `あなたの回答：${playerInput}`;
  if(a11yStatus) a11yStatus.textContent = `入力: ${playerInput.split('').join(' ')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    showKeypad(false);
});