/* script_v2.js - 全ボタン音声修正最終版 */

// --- 定数と設定 ---
const SOUND_PATH = "sound/"; 
const TOTAL_QUESTIONS = 3; 

// --- 音声ファイル一覧（名前はexact） ---
const QUIZ_FILES = {
    "0":"quiz_0.mp3", "1":"quiz_1.mp3", "2":"quiz_2.mp3", "3":"quiz_3.mp3", 
    "4":"quiz_4.mp3", "4.5":"quiz_45.mp3", "5":"quiz_5.mp3", "6":"quiz_6.mp3", 
    "7":"quiz_7.mp3", "8":"quiz_8.mp3", "9":"quiz_9.mp3", ".": "quiz_dot.mp3"
};
const ANSWER_FILES = {
    "0":"answer_0.mp3","1":"answer_1.mp3","2":"answer_2.mp3","3":"answer_3.mp3",
    "4":"answer_4.mp3","4.5":"answer_45.mp3","5":"answer_5.mp3","6":"answer_6.mp3",
    "7":"answer_7.mp3","8":"answer_8.mp3","9":"answer_9.mp3", ".": "answer_dot.mp3"
};
const seikaiFile = "seikai.mp3";
const noFile = "no.mp3";

// ★修正点: ルール音声ファイル一覧 (zunda_rule005.mp3まで)
const ruleFiles = ["zunda_rule001.mp3", "zunda_rule002.mp3", "zunda_rule003.mp3", "zunda_rule004.mp3", "zunda_rule005.mp3"];
const INPUT_FILES = {
    "C": "input_c.mp3", 
    "0": "input_0.mp3", "1": "input_1.mp3", "2": "input_2.mp3", "3": "input_3.mp3", 
    "4": "input_4.mp3", "5": "input_5.mp3", "6": "input_6.mp3", "7": "input_7.mp3", 
    "8": "input_8.mp3", "9": "input_9.mp3", ".": "input_dot.mp3", 
    "ENTER": "input_enter.mp3", 
    "RETRY": "retry_btn.mp3", 
    "RULE": "rule_btn.mp3", 
    "CHECK": "check_btn.mp3", 
    "HINT_L": "hint_l.mp3",   
    "HINT_R": "hint_r.mp3",   
    "RANKING": "ranking_btn.mp3", 
    "CLOSE": "close_ranking.mp3",
    "STOP": "stop_btn.mp3" 
};
const gameClearFile = "desutasha.mp3"; 
const nameInputPromptFile = "name_input_prompt.mp3"; 
const gameEndMessageFile = "game_end_message.mp3"; 

// --- グローバル変数 ---
let questionIndex = 0; 
let score = 0; 
let correctAnswer; 
let playerInput = ""; 
let isPlaying = false; 
let currentAudio = null; 

// --- DOM要素 ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn"); 
const ruleBtn = document.getElementById("ruleBtn");
const checkBtn = document.getElementById("checkBtn");
const hintLBtn = document.getElementById("hintBtn"); 
const hintRBtn = document.getElementById("hintBellBtn"); 
const rankingBtn = document.getElementById("rankingBtn");
const retryBtn = document.getElementById("retryBtn"); 
const nameSubmitBtn = document.getElementById("nameSubmitBtn"); 

const messageDisplay = document.getElementById("result");     
const currentQDisplay = document.getElementById("questionLabel");
const inputDisplay = document.getElementById("currentInput");   
const scoreDisplay = document.getElementById("scoreDisplay");
const inputKeys = document.querySelectorAll(".key, .confirm");

const rankingWrap = document.getElementById("rankingWrap");
const rankingList = document.getElementById("rankingList");
const closeRankingBtn = document.getElementById("closeRankingBtn");
const ruleWrap = document.getElementById("ruleWrap"); 
const closeRuleBtn = document.getElementById("closeRuleBtn"); 
const keypadWrap = document.getElementById("keypadWrap");
const nameInputWrap = document.getElementById("nameInputWrap");
const nameInput = document.getElementById("nameInput");

const mainSection = document.getElementById("mainGame");
const controlsRow1 = document.querySelector(".control-row-1");
const controlsRow2 = document.querySelector(".control-row-2");


// --- オーディオ関連のヘルパー関数 ---

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    isPlaying = false;
}

function playAudioElement(filename, bypassCheck = false) {
    return new Promise((resolve, reject) => {
        if (isPlaying && !bypassCheck) {
            console.log("Audio is already playing, skipping new audio.");
            resolve();
            return;
        }

        if (rankingWrap && ruleWrap && (rankingWrap.style.display === 'flex' || ruleWrap.style.display === 'flex')) {
            if (filename !== INPUT_FILES["CLOSE"]) {
                 resolve();
                 return;
            }
        }
        
        stopAudio(); 

        const audio = new Audio(SOUND_PATH + filename);
        currentAudio = audio; 
        isPlaying = true;
        
        audio.oncanplaythrough = () => {
            audio.play().then(() => {
                console.log(`Audio played: ${filename}`);
            }).catch(e => {
                console.error(`Audio playback failed for ${filename}:`, e);
                isPlaying = false;
                currentAudio = null; 
                reject(e);
            });
        };

        audio.onended = () => {
            isPlaying = false;
            currentAudio = null; 
            resolve();
        };

        audio.onerror = (e) => {
            console.error(`Audio loading error for ${filename}:`, e);
            isPlaying = false;
            currentAudio = null; 
            reject(e);
        };
        
        audio.load();
    });
}

async function playAudioSequence(filenames) {
    for (const filename of filenames) {
        try {
            await playAudioElement(filename);
            await new Promise(r => setTimeout(r, 200)); 
        } catch (e) {
            console.error("Sequence audio playback interrupted:", e);
            break; 
        }
    }
}

// --- ゲームロジック ---
function updateUI() {
    if (messageDisplay) messageDisplay.textContent = "";
    if (scoreDisplay) scoreDisplay.textContent = "";
    if (inputDisplay) inputDisplay.textContent = playerInput || "___";
    
    if (startBtn) startBtn.style.display = 'none';
    if (keypadWrap) keypadWrap.style.display = 'none';
    const retryWrap = document.getElementById("retryWrap");
    if (retryWrap) retryWrap.style.display = 'none';
    if (nameInputWrap) nameInputWrap.style.display = 'none';
    
    if (rankingWrap) rankingWrap.style.display = 'none';
    if (ruleWrap) ruleWrap.style.display = 'none';

    if (keypadWrap) keypadWrap.setAttribute('aria-hidden', 'true');
    if (retryWrap) retryWrap.setAttribute('aria-hidden', 'true');
    if (nameInputWrap) nameInputWrap.setAttribute('aria-hidden', 'true');

    if (questionIndex === 0) {
        if (startBtn) startBtn.style.display = 'block';
        if (currentQDisplay) currentQDisplay.textContent = "問題を再生するにはスタートを押してください";
        
        if (controlsRow1) controlsRow1.style.display = 'flex';
        if (controlsRow2) controlsRow2.style.display = 'flex';
        
    } 
    else if (questionIndex <= TOTAL_QUESTIONS) {
        if (keypadWrap) keypadWrap.style.display = 'flex';
        if (keypadWrap) keypadWrap.setAttribute('aria-hidden', 'false');
        if (currentQDisplay) currentQDisplay.textContent = `第 ${questionIndex} 問 / ${TOTAL_QUESTIONS} 問`;

        if (controlsRow1) controlsRow1.style.display = 'none';
        if (controlsRow2) controlsRow2.style.display = 'none';
    } 
    else {
        if (nameInputWrap) nameInputWrap.style.display = 'block';
        if (nameInputWrap) nameInputWrap.setAttribute('aria-hidden', 'false');
        
        if (currentQDisplay) currentQDisplay.textContent = `結果: ${score} / ${TOTAL_QUESTIONS} 点`;
        if (scoreDisplay) scoreDisplay.textContent = `あなたのスコア: ${score} / ${TOTAL_QUESTIONS} 点`;

        if (controlsRow1) controlsRow1.style.display = 'flex';
        if (controlsRow2) controlsRow2.style.display = 'flex';
        
        if(retryWrap && retryWrap.style.display === 'block') {
            if (nameInputWrap) nameInputWrap.style.display = 'none';
            if (retryWrap) retryWrap.style.display = 'block';
            if (retryWrap) retryWrap.setAttribute('aria-hidden', 'false');
        }
    }
}
function generateQuestion() {
    let num = (Math.random() * 10).toFixed(1);
    if (num.endsWith(".0")) {
        num = num.substring(0, num.length - 2);
    }
    return num;
}
function nextQuestion() {
    questionIndex++;
    if (questionIndex > TOTAL_QUESTIONS) {
        endGame();
        return;
    }
    correctAnswer = generateQuestion();
    playerInput = "";
    updateUI();
    playQuestionAudio(correctAnswer).catch(e => console.error("Question audio sequence failed:", e));
}
function playQuestionAudio(answer) {
    const parts = answer.split('.');
    let filenames = [];
    if (parts[0] !== "") {
        filenames.push(QUIZ_FILES[parts[0]]);
    }
    if (answer.includes('.')) {
        filenames.push(QUIZ_FILES['.']);
        if (parts.length > 1 && parts[1] !== "") {
            filenames.push(QUIZ_FILES[parts[1]]);
        }
    }
    return playAudioSequence(filenames);
}
function confirmAnswer() {
    if (isPlaying) {
        if (messageDisplay) messageDisplay.textContent = "音声再生中です。しばらくお待ちください。";
        return;
    }
    if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) {
        if (messageDisplay) messageDisplay.textContent = "ゲームが開始されていません。";
        return;
    }
    if (playerInput === "") {
        if (messageDisplay) messageDisplay.textContent = "数値を入力してください。";
        return;
    }
    if (playerInput === correctAnswer) {
        score++;
        if (messageDisplay) messageDisplay.textContent = "正解！次の問題に進みます。";
        playAudioElement(seikaiFile).then(() => {
            nextQuestion(); 
        }).catch(e => console.error("Seikai audio failed:", e));
    } else {
        if (messageDisplay) messageDisplay.textContent = `残念。正解は ${correctAnswer} でした。`;
        playAudioElement(noFile).then(() => {
            return playAnswerAudio(correctAnswer);
        }).then(() => {
            nextQuestion();
        }).catch(e => console.error("No/Answer audio failed:", e));
    }
    playAudioElement(INPUT_FILES["ENTER"], true).catch(e => console.error("Input audio failed", e));
}
function playAnswerAudio(answer) {
    const parts = answer.split('.');
    let filenames = [];
    if (parts[0] !== "") {
        filenames.push(ANSWER_FILES[parts[0]]);
    }
    if (answer.includes('.')) {
        filenames.push(ANSWER_FILES['.']);
        if (parts.length > 1 && parts[1] !== "") {
            filenames.push(ANSWER_FILES[parts[1]]);
        }
    }
    return playAudioSequence(filenames);
}
function endGame() {
    updateUI();
    if (messageDisplay) messageDisplay.textContent = `ゲーム終了！${TOTAL_QUESTIONS}問中${score}問正解でした。`;
    const endAudioFile = (score === TOTAL_QUESTIONS) ? gameClearFile : gameEndMessageFile;
    playAudioElement(endAudioFile).then(() => {
        showNameInputPrompt();
    }).catch(e => console.error("Game end audio failed:", e));
}
function showNameInputPrompt() {
    playAudioElement(nameInputPromptFile).catch(e => console.error("Name input prompt audio failed:", e));
    if (nameInput) nameInput.focus();
}
function handleNameSubmit() {
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (name.length === 0) {
        if (messageDisplay) messageDisplay.textContent = "名前を入力してください。";
        playAudioElement(noFile).catch(e => console.error("No audio failed:", e));
        return;
    }
    if (messageDisplay) messageDisplay.textContent = `${name} さん、スコア${score}/${TOTAL_QUESTIONS}をランキングに登録しました！`;
    const retryWrap = document.getElementById("retryWrap");
    playAudioElement(seikaiFile).then(() => {
        if (nameInputWrap) nameInputWrap.style.display = 'none';
        if (nameInputWrap) nameInputWrap.setAttribute('aria-hidden', 'true');
        if (retryWrap) retryWrap.style.display = 'block'; 
        if (retryWrap) retryWrap.setAttribute('aria-hidden', 'false');
    }).catch(e => console.error("Seikai audio failed:", e));
}
function startGame() {
    if (isPlaying) return;
    score = 0;
    questionIndex = 0;
    playerInput = "";
    if (nameInput) nameInput.value = ""; 
    if (messageDisplay) messageDisplay.textContent = "ゲームを開始します。";
    // ゲーム開始時はルール音声 (5ファイル) を再生
    playAudioSequence(ruleFiles).then(() => {
        nextQuestion();
    }).catch(e => console.error("Rule audio sequence failed:", e));
    updateUI();
}
function retryGame() {
    playAudioElement(INPUT_FILES["RETRY"], true).catch(e => console.error("Input audio failed", e));
    startGame();
}


// --- イベントリスナー ---

if (startBtn) startBtn.addEventListener("click", startGame);

if (stopBtn) stopBtn.addEventListener("click", () => {
    if (isPlaying && INPUT_FILES["STOP"]) {
        playAudioElement(INPUT_FILES["STOP"], true).then(() => {
            stopAudio();
        }).catch(e => console.error("Stop audio failed:", e));
    } else {
        stopAudio();
    }
});

if (retryBtn) retryBtn.addEventListener("click", retryGame);

if (nameSubmitBtn) nameSubmitBtn.addEventListener("click", handleNameSubmit);

// ★ルールボタン (ruleBtn) の音声シーケンス
if (ruleBtn) ruleBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RULE"], true).then(() => {
        if (ruleWrap) {
            ruleWrap.style.display = 'flex';
            ruleWrap.setAttribute('aria-hidden', 'false');
        }
        // rule_btn.mp3 の後にルール音声 5 ファイルを再生
        return playAudioSequence(ruleFiles); 
    }).catch(e => console.error("Rule button action failed:", e));
});

// ★イヤホンの左右の確認ボタン (checkBtn) の音声シーケンス
if (checkBtn) checkBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["CHECK"], true).then(() => {
        // check_btn.mp3 の後に zunda_check.mp3 を再生
        return playAudioElement("zunda_check.mp3");
    }).catch(e => console.error("Check audio sequence failed:", e));
});

// ★ヒントLボタン (hintBtn) の音声シーケンス
if (hintLBtn) hintLBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_L"], true).then(() => {
        // hint_l.mp3 の後に zunda_rule005.mp3 -> hint.mp3 を再生
        return playAudioSequence(["zunda_rule005.mp3", "hint.mp3"]);
    }).catch(e => console.error("Hint L audio failed:", e));
});

// ★ヒント／鈴のみボタン (hintBellBtn/hintRBtn) の音声シーケンス
if (hintRBtn) hintRBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_R"], true).then(() => {
        // hint_r.mp3 の後に hint.mp3 のみを再生
        return playAudioElement("hint.mp3");
    }).catch(e => console.error("Hint R audio failed:", e));
});

if (rankingBtn) rankingBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RANKING"], true).catch(e => console.error("Input audio failed", e));
    
    if (rankingList) rankingList.innerHTML = `
        <p>（ランキング機能は現在開発中です）</p>
        <p>1位: 9.9（ダミー）</p>
        <p>2位: 9.8（ダミー）</p>
    `;
    if (rankingWrap) {
        rankingWrap.style.display = 'flex';
        rankingWrap.setAttribute('aria-hidden', 'false');
    }
});

if (closeRankingBtn) closeRankingBtn.addEventListener("click", () => {
    playAudioElement(INPUT_FILES["CLOSE"], true).catch(e => console.error("Input audio failed", e));
    if (rankingWrap) {
        rankingWrap.style.display = 'none';
        rankingWrap.setAttribute('aria-hidden', 'true');
    }
});

if (closeRuleBtn) closeRuleBtn.addEventListener("click", () => {
    playAudioElement(INPUT_FILES["CLOSE"], true).catch(e => console.error("Input audio failed", e));
    if (ruleWrap) {
        ruleWrap.style.display = 'none';
        ruleWrap.setAttribute('aria-hidden', 'true');
    }
});

if (inputKeys) inputKeys.forEach(btn => {
    btn.addEventListener("click", () => {
        if (isPlaying) return;
        const k = btn.getAttribute("data-key");
        handleKeyInput(k);
    });
});

document.addEventListener("keydown", (e)=>{
    const key = e.key;
    if (nameInput && document.activeElement === nameInput) {
        if (key === "Enter") {
            e.preventDefault(); 
            handleNameSubmit();
        }
        return;
    }
    
    if (["0","1","2","3","4","5","6","7","8","9",".", "c", "C"].includes(key)){
        handleKeyInput(key.toUpperCase());
    } 
    else if (key === "Enter"){
        if (questionIndex > 0 && questionIndex <= TOTAL_QUESTIONS) confirmAnswer();
    }
});


function handleKeyInput(k) {
    if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;

    if (k === "ENTER") {
        confirmAnswer();
        return;
    }

    if (k === "C") {
        playerInput = ""; 
        const inputFilename = INPUT_FILES["C"];
        if (inputFilename) {
            playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
        }
    } 
    else {
        if (!isNaN(parseInt(k))) {
            if (playerInput.length < 3 || (playerInput.includes('.') && playerInput.length < 5)) {
                playerInput += k;
            }
        } 
        else if (k === ".") {
            if (!playerInput.includes('.') && playerInput.length > 0 && playerInput.length < 3) {
                playerInput += k;
            }
        }
        
        const inputFilename = INPUT_FILES[k];
        if (inputFilename) {
            playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
        }
    }

    updateUI();
}

document.addEventListener("DOMContentLoaded", updateUI);