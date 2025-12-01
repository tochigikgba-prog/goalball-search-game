/* script.js
 - FIX：モバイル環境で2問目以降の出題音声が流れない問題に対応するため、回答判定後の待ち時間(1.5秒)を削除し、次の問題への遷移を高速化。
*/

const SOUND_PATH = "sound/";

// --- 音声ファイル一覧（名前はexact） ---
const QUIZ_FILES = {
  "0":"quiz_0.mp3", "1":"quiz_1.mp3", "2":"quiz_2.mp3", "3":"quiz_3.mp3", 
  "4":"quiz_4.mp3", "4.5":"quiz_45.mp3", "5":"quiz_5.mp3", "6":"quiz_6.mp3", 
  "7":"quiz_7.mp3", "8":"quiz_8.mp3", "9":"quiz_9.mp3"
};
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

// 入力数字の音声ファイルマップ
const INPUT_FILES = {
  "0": "input_0.mp3", "1": "input_1.mp3", "2": "input_2.mp3", "3": "input_3.mp3",
  "4": "input_4.mp3", "5": "input_5.mp3", "6": "input_6.mp3", "7": "input_7.mp3",
  "8": "input_8.mp3", "9": "input_9.mp3", ".": "input_dot.mp3",
  "C": "input_clear.mp3" 
};

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
let playingButton = null;
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
  Object.values(INPUT_FILES).forEach(preload); 
}
preloadAll();

// ----- II. 再生ユーティリティ -----
function playAudioElement(filename, isInput = false, buttonElement = null){
  return new Promise((resolve, reject) => {
    if (!filename) { resolve(); return; }
    
    if (!isInput && isPlaying) {
        stopAll(); 
    } 
    
    let a;
    if (audioMap[filename]) {
      try { a = audioMap[filename].cloneNode(true); } catch (e) { a = new Audio(SOUND_PATH + filename); }
    } else {
      a = new Audio(SOUND_PATH + filename);
    }
    a.preload = "auto";
    
    try { a.pause(); a.currentTime = 0; } catch(e){}
    
    if (!isInput) {
        currentAudio = a;
        isPlaying = true;
        playingButton = buttonElement;
    }
    
    const onEnded = () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onErr);
      if (currentAudio === a) {
          currentAudio = null;
          isPlaying = false;
          playingButton = null;
      }
      resolve();
    };
    const onErr = (ev) => {
      a.removeEventListener("error", onErr);
      a.removeEventListener("ended", onEnded);
      if (currentAudio === a) {
          currentAudio = null;
          isPlaying = false;
          playingButton = null;
      }
      console.error("audio error", filename, ev);
      resolve(); 
    };
    
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onErr);
    
    a.play().then(() => {
    }).catch(err => {
      onErr(err); 
    });
  });
}

async function playSequence(files, gap = 500, buttonElement = null){
  stopAll(); 
  
  for (const f of files){
    if (stopRequested) break;
    await playAudioElement(f, false, buttonElement);
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
  playingButton = null; 
  stopRequested = false; 
}

function disableControlsDuringPlayback(disabled){
  const controls = [ruleBtn, checkBtn, stopBtn, hintBtn, hintBellBtn, startBtn, retryBtn, ...document.querySelectorAll("#keypad button")];
  controls.forEach(el=>{
    if (el && el.id !== 'stopBtn' && !el.closest('#keypad')) {
        el.disabled = disabled; 
    }
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
    if(startBtn) startBtn.setAttribute("aria-expanded", show ? "true" : "false");
  }
}

// --- IV. ゲームフロー ---
async function startGame(){
  if (isPlaying && playingButton === startBtn) {
      return; 
  }
  
  stopAll(); 

  // reset
  score = 0;
  questionIndex = 0;
  playerInput = "";
  if(resultDiv) resultDiv.textContent = "";
  if(scoreDisplay) scoreDisplay.textContent = "";
  if(retryWrap) retryWrap.style.display = "none";
  if(a11yStatus) a11yStatus.textContent = "ゲームを開始します。";

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
  
  stopAll(); 

  const q = gameQueue[questionIndex];
  if(questionLabel) questionLabel.textContent = `問題 ${questionIndex+1} / ${TOTAL_QUESTIONS}`;
  if(currentInput) currentInput.textContent = "あなたの回答：なし";
  playerInput = "";
  if(resultDiv) resultDiv.textContent = "";
  if(a11yStatus) a11yStatus.textContent = `問題 ${questionIndex+1}、再生します。`;
  
  const filename = QUIZ_FILES[q];
  if (!filename){ console.error("no quiz file mapping for", q); 
    disableControlsDuringPlayback(false);
    questionIndex++;
    return;
  }
  
  disableControlsDuringPlayback(true);
  
  await playAudioElement(filename, false, startBtn); 
  
  disableControlsDuringPlayback(false); 
  questionIndex++;
}

async function confirmAnswer(){
  if (isPlaying && playingButton === startBtn) return;
  if (playerInput === "") {
    if(a11yStatus) a11yStatus.textContent = "回答を入力してください。";
    return;
  }
  
  const currentQIndex = questionIndex - 1;
  if (currentQIndex < 0 || !gameQueue[currentQIndex]) { return; }
  
  if (audioMap[enterSound]) {
      await playAudioElement(enterSound, true); 
  }
  
  const expected = gameQueue[currentQIndex];
  const a = (playerInput || "").trim();
  const b = (expected || "").trim();
  
  disableControlsDuringPlayback(true);
  
  if (a === b){
    score++;
    if(resultDiv) resultDiv.textContent = "正解！";
    if(a11yStatus) a11yStatus.textContent = "正解です！";
    await playAudioElement(seikaiFile, false, startBtn); 
  } else {
    if(resultDiv) resultDiv.textContent = `不正解... 正解は ${b}`;
    if(a11yStatus) a11yStatus.textContent = `不正解です。正解は ${b} でした。`;
    await playAudioElement(noFile, false, startBtn);
    const ansFile = ANSWER_FILES[b] || QUIZ_FILES[b];
    if (ansFile) {
        await playAudioElement(ansFile, false, startBtn);
    }
  }
  
  disableControlsDuringPlayback(false); 
  
  if (questionIndex < TOTAL_QUESTIONS){
    // ★ 修正: 回答判定後の待ち時間を削除し、すぐに次の問題再生へ
    // await new Promise(r=>setTimeout(r,1500)); 
    nextQuestion(); 
  } else {
    endGame(); 
  }
}

async function endGame(){
  showKeypad(false);
  if(questionLabel) questionLabel.textContent = "ゲーム終了";
  if(resultDiv) resultDiv.textContent = "";
  
  disableControlsDuringPlayback(true);
  
  if (score >= 2) {
      if (audioMap[gameSuccessFile]) {
          await playAudioElement(gameSuccessFile, false, startBtn);
      }
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点です。お見事！`;
  } else {
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点です。再挑戦ボタンで再び遊べます。`;
  }
  
  disableControlsDuringPlayback(false); 
  
  if(scoreDisplay) scoreDisplay.textContent = `あなたのスコア： ${score} / ${TOTAL_QUESTIONS}`;
  if(retryWrap) retryWrap.style.display = "block";
}


// --- V. イベントリスナー ---
async function handleAuxButton(button, files, gap = 500){
  if (isPlaying && playingButton === button) {
      stopAll(); 
      if(a11yStatus) a11yStatus.textContent = "再生を停止しました";
      return;
  }
  
  if (isPlaying && playingButton === startBtn) return;
  
  stopRequested = false;
  
  if(a11yStatus) a11yStatus.textContent = `${button.textContent} の再生を開始します。`;
  await playSequence(files, gap, button);
  if(!isPlaying) { 
    if(a11yStatus) a11yStatus.textContent = `${button.textContent} の再生が完了しました。`;
  }
}

ruleBtn && ruleBtn.addEventListener("click", () => handleAuxButton(ruleBtn, ruleFiles));
checkBtn && checkBtn.addEventListener("click", () => handleAuxButton(checkBtn, [checkFile], 0));
hintBtn && hintBtn.addEventListener("click", () => handleAuxButton(hintBtn, hintSeqFiles));
hintBellBtn && hintBellBtn.addEventListener("click", () => handleAuxButton(hintBellBtn, hintBellFiles));

stopBtn && stopBtn.addEventListener("click", () => {
  stopAll();
  disableControlsDuringPlayback(false); 
  if(resultDiv) resultDiv.textContent = "再生を停止しました";
  if(a11yStatus) a11yStatus.textContent = "再生を停止しました";
});

startBtn && startBtn.addEventListener("click", startGame);
retryBtn && retryBtn.addEventListener("click", startGame);

// キーパッド入力処理
document.querySelectorAll("#keypad .key, #keypad .confirm").forEach(btn=>{
  btn.addEventListener("click",(e)=>{
    const k = btn.getAttribute("data-key");
    handleKeyInput(k);
  });
});

document.addEventListener("keydown", (e)=>{
  const key = e.key;
  if (["0","1","2","3","4","5","6","7","8","9",".", "c", "C"].includes(key)){
    handleKeyInput(key.toUpperCase());
  } else if (key === "Enter"){
    if (questionIndex>0) confirmAnswer();
  }
});

function handleKeyInput(k){
  if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
  
  if (k === "Enter"){
    confirmAnswer();
    return;
  }
  
  // クリアボタンの処理
  if (k === "C") {
      playerInput = ""; 
      
      const inputFilename = INPUT_FILES["C"];
      if (inputFilename) {
          playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
      }
      
      if(currentInput) currentInput.textContent = `あなたの回答：なし`;
      if(a11yStatus) a11yStatus.textContent = `入力がクリアされました。`;
      return; 
  }
  
  // 数字・ピリオドの処理
  if (k === "." && playerInput.includes(".")) return;
  if (!["0","1","2","3","4","5","6","7","8","9","."].includes(k)) return;
  
  const inputFilename = INPUT_FILES[k];
  if (inputFilename) {
      playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
  }
  
  playerInput += k;
  if(currentInput) currentInput.textContent = `あなたの回答：${playerInput}`;
  if(a11yStatus) a11yStatus.textContent = `入力: ${playerInput.split('').join(' ')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    showKeypad(false);
});
