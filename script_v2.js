/* script_v2.js */

// --- 定数と設定 ---
// 注意: このパスの下に音声ファイルが必要です (例: sound/seikai.mp3)
const SOUND_PATH = "sound/"; 
const TOTAL_QUESTIONS = 3; // 全問題数

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
const ruleFiles = ["zunda_rule001.mp3", "zunda_rule002.mp3", "zunda_rule003.mp3", "zunda_rule004.mp3"];
const INPUT_FILES = {
    "C": "input_c.mp3", "0": "input_0.mp3", "1": "input_1.mp3", "2": "input_2.mp3", 
    "3": "input_3.mp3", "4": "input_4.mp3", "5": "input_5.mp3", "6": "input_6.mp3", 
    "7": "input_7.mp3", "8": "input_8.mp3", "9": "input_9.mp3", ".": "input_dot.mp3", 
    "ENTER": "input_enter.mp3", "RETRY": "retry_btn.mp3", "RULE": "rule_btn.mp3", 
    "CHECK": "check_btn.mp3", "HINT_L": "hint_l.mp3", "HINT_R": "hint_r.mp3", 
    "RANKING": "ranking_btn.mp3", "CLOSE": "close_ranking.mp3",
    "STOP": "stop_btn.mp3" // 再生停止ボタンの音声
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
let currentAudio = null; // ★追加: 現在再生中のAudioオブジェクトを保持

// --- DOM要素 ---
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn"); 
const ruleBtn = document.getElementById("ruleBtn");
const checkBtn = document.getElementById("checkBtn");
// ★修正: HTMLの元のIDに合わせて要素を取得
const hintLBtn = document.getElementById("hintBtn"); 
const hintRBtn = document.getElementById("hintBellBtn"); 
const rankingBtn = document.getElementById("rankingBtn"); 

// Statusセクション内の要素
const questionLabel = document.getElementById("questionLabel"); 
const currentInput = document.getElementById("currentInput");   
const messageDisplay = document.getElementById("result");     
const currentQDisplay = document.getElementById("questionLabel");
const inputDisplay = document.getElementById("currentInput");   

const keypad = document.getElementById("keypad");
const inputKeys = document.querySelectorAll(".key, .confirm");
const retryWrap = document.getElementById("retryWrap");
const retryBtn = document.getElementById("retryBtn");
const scoreDisplay = document.getElementById("scoreDisplay");

// --- モーダル関連の新しいDOM要素 ---
const rankingWrap = document.getElementById("rankingWrap");
const rankingList = document.getElementById("rankingList");
const closeRankingBtn = document.getElementById("closeRankingBtn");
const ruleWrap = document.getElementById("ruleWrap"); 
const closeRuleBtn = document.getElementById("closeRuleBtn"); 

const keypadWrap = document.getElementById("keypadWrap");

// 名前入力関連のDOM要素
const nameInputWrap = document.getElementById("nameInputWrap");
const nameInput = document.getElementById("nameInput");
const nameSubmitBtn = document.getElementById("nameSubmitBtn");

// ゲームのメインセクションとコントロールセクション
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
        // ... (オーディオ再生ロジックは変更なし。ただし、HTMLの要素がないとエラーになるため、
        // rankingWrap, ruleWrapのチェックはこれらの要素がHTMLにあることが前提です)
        if (isPlaying && !bypassCheck) {
            console.log("Audio is already playing, skipping new audio.");
            resolve();
            return;
        }

        // モーダルが開いている場合のチェック（要素がない場合はスキップ）
        if (rankingWrap && ruleWrap && (rankingWrap.style.display === 'flex' || ruleWrap.style.display === 'flex')) {
            if (filename !== INPUT_FILES["CLOSE"] && filename !== INPUT_FILES["RANKING"] && filename !== INPUT_FILES["RULE"]) {
                 resolve();
                 return;
            }
        }

        stopAudio(); // 新しい音声を再生する前に、念のため既存の音声を停止

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

// ... (省略: generateQuestion, nextQuestion, playQuestionAudio, confirmAnswer, playAnswerAudio, endGame, showNameInputPrompt, handleNameSubmit, startGame, retryGame)
// ★注意: 上記の関数は前回のコードで定義されていることが前提です。

// --- イベントリスナー (安全な実装) ---

// スタートボタン
if (startBtn) startBtn.addEventListener("click", startGame);

// 再生停止ボタン
if (stopBtn) stopBtn.addEventListener("click", () => {
    if (currentAudio) {
        playAudioElement(INPUT_FILES["STOP"], true).then(() => {
            stopAudio();
        }).catch(e => console.error("Stop audio failed:", e));
    }
});


// 再挑戦ボタン
if (retryBtn) retryBtn.addEventListener("click", retryGame);

// 名前登録ボタン
if (nameSubmitBtn) nameSubmitBtn.addEventListener("click", handleNameSubmit);

// ルールボタン
if (ruleBtn) ruleBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RULE"], true).catch(e => console.error("Input audio failed", e));
    
    // ルールモーダルを表示
    if (ruleWrap) {
        ruleWrap.style.display = 'flex';
        ruleWrap.setAttribute('aria-hidden', 'false');
    }
});

// イヤホン確認ボタン
if (checkBtn) checkBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["CHECK"], true).then(() => {
        // LとRの音声を再生 (ファイル名は想定)
        return playAudioSequence(["check_l.mp3", "check_r.mp3"]); 
    }).catch(e => console.error("Check audio sequence failed:", e));
});

// ヒントLボタン (元の #hintBtn)
if (hintLBtn) hintLBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_L"] || "default_hint_l.mp3", true).then(() => {
        return playAudioElement("hint_l_sound.mp3");
    }).catch(e => console.error("Hint L audio failed:", e));
});

// ヒントRボタン (元の #hintBellBtn)
if (hintRBtn) hintRBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_R"] || "default_hint_r.mp3", true).then(() => {
        return playAudioElement("hint_r_sound.mp3");
    }).catch(e => console.error("Hint R audio failed:", e));
});

// ランキングボタン
if (rankingBtn) rankingBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RANKING"], true).catch(e => console.error("Input audio failed", e));
    
    // ランキングモーダルを表示 (ランキング表示ロジックは省略)
    if (rankingWrap) {
        rankingWrap.style.display = 'flex';
        rankingWrap.setAttribute('aria-hidden', 'false');
        // FireStoreの取得処理など...
    }
});

// ランキングを閉じるボタン
if (closeRankingBtn) closeRankingBtn.addEventListener("click", () => {
    playAudioElement(INPUT_FILES["CLOSE"], true).catch(e => console.error("Input audio failed", e));
    if (rankingWrap) {
        rankingWrap.style.display = 'none';
        rankingWrap.setAttribute('aria-hidden', 'true');
    }
});

// ルールを閉じるボタン
if (closeRuleBtn) closeRuleBtn.addEventListener("click", () => {
    playAudioElement(INPUT_FILES["CLOSE"], true).catch(e => console.error("Input audio failed", e));
    if (ruleWrap) {
        ruleWrap.style.display = 'none';
        ruleWrap.setAttribute('aria-hidden', 'true');
    }
});


// テンキーボタンと確定ボタンのイベントリスナー
if (inputKeys) inputKeys.forEach(btn => {
    btn.addEventListener("click", () => {
        if (isPlaying) return;
        const k = btn.getAttribute("data-key");
        handleKeyInput(k);
    });
});

// ... (省略: キーボード入力のイベントリスナー、handleKeyInput関数)
// 起動時の初期化
document.addEventListener("DOMContentLoaded", updateUI);