/* script_v2.js */

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
// 修正後
const ruleFiles = ["zunda_rule001.mp3", "zunda_rule002.mp3", "zunda_rule003.mp3", "zunda_rule004.mp3", "zunda_rule005.mp3"];
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

// --- ランキング定数（Firebase用） ---
const RANKING_COLLECTION_NAME = 'ranking'; 

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

// ランキング関連のUI要素
const postGameControls = document.getElementById("postGameControls"); 
const rankingWrap = document.getElementById("rankingWrap");
const rankingList = document.getElementById("rankingList");
const closeRankingBtn = document.getElementById("closeRankingBtn"); 


let audioMap = {}; 
let currentAudio = null; 
let isPlaying = false; 
let playingButton = null;
let gameQueue = []; 
let questionIndex = 0;
let playerInput = ""; 
let score = 0;
let startTime = 0; // タイム計測用の変数
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
  const controls = [ruleBtn, checkBtn, stopBtn, hintBtn, hintBellBtn, startBtn, retryBtn, closeRankingBtn, 
                     ...document.querySelectorAll("#postGameControls button"), 
                     ...document.querySelectorAll("#keypad button")];
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

// ★ ランキング関連の関数 (Firebase Firestore対応) ★

async function getRankingData() {
    // db オブジェクトは index.html で定義されている
    if (typeof db === 'undefined') {
        console.error("Firebase Firestore (db) が初期化されていません。index.html の設定を確認してください。");
        return [];
    }
    
    try {
        // Firestoreの 'ranking' コレクションからデータを取得
        const snapshot = await db.collection(RANKING_COLLECTION_NAME)
            .orderBy('score', 'desc') // スコアが高い順
            .orderBy('time', 'asc')   // タイムが短い順
            .limit(100) // 上位100件
            .get();
        
        const data = [];
        snapshot.forEach(doc => {
            const entry = doc.data();
            data.push({
                score: entry.score,
                time: entry.time,
                name: entry.name,
                timestamp: entry.timestamp 
            });
        });

        return data; 
    } catch (e) {
        console.error("Failed to read ranking data from Firestore", e);
        return [];
    }
}

async function saveScoreToRanking(score, timeTaken) {
    if (typeof db === 'undefined') {
        alert("ランキングの登録に失敗しました。\n\n【原因】\nFirebase Firestore (db) が初期化されていません。index.html の設定を確認してください。");
        return;
    }

    let playerName = prompt("グローバルランキングに登録します。\nお名前（匿名可）を入力してください。", "匿名");
    
    if (playerName === null) {
        return; 
    }
    playerName = playerName.trim() === "" ? "匿名" : playerName.trim();
    
    const newEntry = {
        score: score,
        time: timeTaken, 
        name: playerName,
        // ランキングのソートに使うため、タイムスタンプを保存
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        // Firestoreの 'ranking' コレクションにデータを追加
        await db.collection(RANKING_COLLECTION_NAME).add(newEntry);

        console.log("Score saved successfully to Firebase Firestore.");
    } catch (e) {
        console.error("Failed to write score to Firestore", e);
        alert("ランキングの登録に失敗しました。\n\n【原因の可能性】\n1. index.html の firebaseConfig が間違っている\n2. Firestoreのセキュリティルールが正しく設定されていない（公開済みか）\n\n設定を確認してから再度お試しください。");
    }
}

async function displayRanking(show) {
    if (show) {
        if (retryWrap) retryWrap.style.display = 'none'; 
        if (postGameControls) postGameControls.style.display = 'none'; 
        
        rankingWrap.style.display = 'block';
        rankingList.innerHTML = '<p>ランキングデータを読み込み中...</p>';
        disableControlsDuringPlayback(true); 
        
        const data = await getRankingData(); 
        let html = '';

        if (data.length === 0) {
            rankingList.innerHTML = '<p>ランキングデータの取得に失敗しました。Firebaseの設定（特にルール）を確認してください。</p>';
        } else {
             html = '<table><thead><tr><th>順位</th><th>プレイヤー</th><th>スコア</th><th>タイム</th></tr></thead><tbody>';
             data.forEach((entry, index) => {
                const timeStr = entry.time ? `${entry.time}秒` : 'N/A';
                const playerName = entry.name || '匿名';
                html += `<tr>
                            <td>${index + 1}</td>
                            <td>${playerName}</td> 
                            <td>${entry.score} / ${TOTAL_QUESTIONS}</td>
                            <td>${timeStr}</td>
                        </tr>`;
            });
            html += '</tbody></table>';
            rankingList.innerHTML = html;
        }
        disableControlsDuringPlayback(false); 
        
    } else {
        rankingWrap.style.display = 'none';
        
        if (questionIndex >= TOTAL_QUESTIONS) {
              if (retryWrap) retryWrap.style.display = 'block'; 
              if (postGameControls) postGameControls.style.display = 'flex'; 
        }
    }
}

function generateShareText(score, total, time) {
    const timeStr = time ? ` (${time}秒)` : '';
    return `🎯 ゴールボールサーチゲームの結果を発表！\n\nスコア: ${score} / ${total}${timeStr}\n\n私も${score}点取れたよ！みんなも挑戦してみてね！\n#ゴールボールサーチゲーム #視覚障害者スポーツ #ゴールボール #KGBA\n`;
}

function shareToX(score, total, time) {
    const text = generateShareText(score, total, time);
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank');
}

function shareToInstagram(score, total, time) {
    const shareText = generateShareText(score, total, time).replace(/\n/g, ' '); 
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert("✅ 投稿用テキストがクリップボードにコピーされました！\n\n【次のステップ】\n1. Instagramが起動したら、ストーリーズ編集画面で指を長押ししてテキストをペーストしてください。\n2. スタンプ機能で「リンク」を選び、ゲームのURLを手動で追加してください。");
            
            window.open("instagram://story", '_blank');
        }).catch(err => {
            console.error('クリップボードへのコピーに失敗:', err);
            alert("クリップボードへのコピーに失敗しました。以下のテキストを直接コピーしてください:\n\n" + shareText);
        });
    } else {
          alert("お使いのブラウザではクリップボードへの自動コピーができません。以下のテキストを長押ししてコピーしてください:\n\n" + shareText);
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
  startTime = Date.now(); 
  if(resultDiv) resultDiv.textContent = "";
  if(scoreDisplay) scoreDisplay.textContent = "";
  if(retryWrap) retryWrap.style.display = "none";
  if(rankingWrap) rankingWrap.style.display = "none"; 
  if(postGameControls) postGameControls.style.display = 'none'; 
  if(postGameControls) postGameControls.innerHTML = ''; 
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
    nextQuestion(); 
  } else {
    endGame(); 
  }
}

async function endGame(){
  const timeTaken = Math.floor((Date.now() - startTime) / 1000); 
  
  showKeypad(false);
  if(questionLabel) questionLabel.textContent = "ゲーム終了";
  if(resultDiv) resultDiv.textContent = "";
  
  disableControlsDuringPlayback(true);
  
  await saveScoreToRanking(score, timeTaken);
  
  if (score >= 2) {
      if (audioMap[gameSuccessFile]) {
          await playAudioElement(gameSuccessFile, false, startBtn);
      }
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点、タイムは ${timeTaken} 秒です。お見事！`;
  } else {
      if(a11yStatus) a11yStatus.textContent = `ゲーム終了。あなたのスコアは ${score} 点です。再挑戦ボタンで再び遊べます。`;
  }
  
  disableControlsDuringPlayback(false); 
  
  if(scoreDisplay) scoreDisplay.textContent = `あなたのスコア： ${score} / ${TOTAL_QUESTIONS} (タイム: ${timeTaken}秒)`;
  if(retryWrap) retryWrap.style.display = "block";
  
  if(postGameControls) postGameControls.innerHTML = ''; 
  
  const createButton = (id, text, className) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = text;
    btn.className = className;
    btn.type = 'button';
    postGameControls.appendChild(btn);
    return btn;
  };
  
  const showRankingBtn = createButton('showRankingBtn', '🏆 ランキングを見る', 'show-ranking-btn');
  const shareXBtn = createButton('shareXBtn', 'X (旧 Twitter) でシェア', 'social-share share-x');
  const shareInstaBtn = createButton('shareInstaBtn', '📸 ストーリーズでシェア', 'social-share share-insta');
  
  if(postGameControls) postGameControls.style.display = 'flex'; 

  showRankingBtn.addEventListener("click", () => displayRanking(true));
  shareXBtn.addEventListener("click", () => shareToX(score, TOTAL_QUESTIONS, timeTaken));
  shareInstaBtn.addEventListener("click", () => shareToInstagram(score, TOTAL_QUESTIONS, timeTaken));
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

closeRankingBtn && closeRankingBtn.addEventListener("click", () => displayRanking(false));


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