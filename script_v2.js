/* script.js */

// --- 定数と設定 ---
const SOUND_PATH = "sound/";
const TOTAL_QUESTIONS = 3; // 全問題数

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
const ruleFiles = ["zunda_rule001.mp3", "zunda_rule002.mp3", "zunda_rule003.mp3", "zunda_rule004.mp3"];
const INPUT_FILES = {
    "C": "input_c.mp3", // Cボタン（クリア）
    "0": "input_0.mp3", // 0
    "1": "input_1.mp3", // 1
    "2": "input_2.mp3", // 2
    "3": "input_3.mp3", // 3
    "4": "input_4.mp3", // 4
    "5": "input_5.mp3", // 5
    "6": "input_6.mp3", // 6
    "7": "input_7.mp3", // 7
    "8": "input_8.mp3", // 8
    "9": "input_9.mp3", // 9
    ".": "input_dot.mp3", // .
    "ENTER": "input_enter.mp3", // 確定ボタン
    "RETRY": "retry_btn.mp3", // 再挑戦ボタン
    "RULE": "rule_btn.mp3", // ルールボタン
    "CHECK": "check_btn.mp3", // イヤホン確認ボタン
    "HINT_L": "hint_l.mp3", // ヒントLボタン
    "HINT_R": "hint_r.mp3", // ヒントRボタン
    "RANKING": "ranking_btn.mp3", // ランキングボタン
    "CLOSE": "close_ranking.mp3" // ランキングを閉じるボタン
};
const gameClearFile = "desutasha.mp3"; // ゲームクリア時の音声ファイル

// --- グローバル変数 ---
let questionIndex = 0; // 現在の問題番号 (1からTOTAL_QUESTIONSまで, 0は未開始)
let score = 0; // 正解数
let correctAnswer; // 現在の問題の正解
let playerInput = ""; // プレイヤーが入力中の数字
let isPlaying = false; // 音声再生中フラグ

// --- DOM要素 ---
const startBtn = document.getElementById("startBtn");
const ruleBtn = document.getElementById("ruleBtn");
const checkBtn = document.getElementById("checkBtn");
const hintLBtn = document.getElementById("hintLBtn");
const hintRBtn = document.getElementById("hintRBtn");
const rankingBtn = document.getElementById("rankingBtn");
const currentQDisplay = document.getElementById("currentQ");
const inputDisplay = document.getElementById("inputDisplay");
const messageDisplay = document.getElementById("message");
const keypad = document.getElementById("keypad");
const inputKeys = document.querySelectorAll(".key, .confirm");
const retryWrap = document.getElementById("retryWrap");
const retryBtn = document.getElementById("retryBtn");
const scoreDisplay = document.getElementById("scoreDisplay");
const rankingWrap = document.getElementById("rankingWrap");
const rankingList = document.getElementById("rankingList");
const closeRankingBtn = document.getElementById("closeRankingBtn");
const keypadWrap = document.getElementById("keypadWrap");

// ゲームのメインセクションとコントロールセクション
const mainSection = document.getElementById("mainGame");
const controlsRow1 = document.querySelector(".control-row-1");
const controlsRow2 = document.querySelector(".control-row-2");


// --- オーディオ関連のヘルパー関数 ---

// Audioオブジェクトを生成し、再生を行う
function playAudioElement(filename, bypassCheck = false) {
    return new Promise((resolve, reject) => {
        if (isPlaying && !bypassCheck) {
            console.log("Audio is already playing, skipping new audio.");
            resolve();
            return;
        }

        const audio = new Audio(SOUND_PATH + filename);
        isPlaying = true;
        
        audio.oncanplaythrough = () => {
            audio.play().then(() => {
                console.log(`Audio played: ${filename}`);
            }).catch(e => {
                console.error(`Audio playback failed for ${filename}:`, e);
                isPlaying = false;
                reject(e);
            });
        };

        audio.onended = () => {
            isPlaying = false;
            resolve();
        };

        audio.onerror = (e) => {
            console.error(`Audio loading error for ${filename}:`, e);
            isPlaying = false;
            reject(e);
        };
        
        // エラーを防ぐため、念の為ロードを開始
        audio.load();
    });
}

// 複数のオーディオファイルを順番に再生
async function playAudioSequence(filenames) {
    for (const filename of filenames) {
        try {
            await playAudioElement(filename);
            await new Promise(r => setTimeout(r, 200)); // ファイル間の短いディレイ
        } catch (e) {
            console.error("Sequence audio playback interrupted:", e);
            break; 
        }
    }
}

// --- ゲームロジック ---

// UIを更新する関数
function updateUI() {
    // スコアとメッセージの表示をリセット
    messageDisplay.textContent = "";
    scoreDisplay.textContent = "";
    inputDisplay.textContent = playerInput || "___";
    
    // ゲーム開始前
    if (questionIndex === 0) {
        startBtn.style.display = 'block';
        keypadWrap.style.display = 'none';
        retryWrap.style.display = 'none';
        currentQDisplay.textContent = "問題を再生するにはスタートを押してください";
        
        // コントロールを表示
        controlsRow1.style.display = 'flex';
        controlsRow2.style.display = 'flex';
        
    } 
    // ゲーム中
    else if (questionIndex <= TOTAL_QUESTIONS) {
        startBtn.style.display = 'none';
        keypadWrap.style.display = 'flex';
        retryWrap.style.display = 'none';
        currentQDisplay.textContent = `第 ${questionIndex} 問 / ${TOTAL_QUESTIONS} 問`;

        // コントロールを非表示 (ゲームに集中させるため)
        controlsRow1.style.display = 'none';
        controlsRow2.style.display = 'none';
    } 
    // ゲーム終了後
    else {
        startBtn.style.display = 'none';
        keypadWrap.style.display = 'none';
        retryWrap.style.display = 'block';
        currentQDisplay.textContent = `結果: ${score} / ${TOTAL_QUESTIONS} 点`;
        scoreDisplay.textContent = `あなたのスコア: ${score} / ${TOTAL_QUESTIONS} 点`;
        
        // コントロールを表示
        controlsRow1.style.display = 'flex';
        controlsRow2.style.display = 'flex';
    }
}

// 問題を生成する
function generateQuestion() {
    // 0から9.9までのランダムな数値を生成し、小数点第1位に丸める
    let num = (Math.random() * 10).toFixed(1);
    // ただし、最後の桁が .0 の場合は整数にする (例: 5.0 -> 5)
    if (num.endsWith(".0")) {
        num = num.substring(0, num.length - 2);
    }
    return num;
}

// 次の問題に進む
function nextQuestion() {
    // 問題番号をインクリメント
    questionIndex++;
    
    // 全問終了
    if (questionIndex > TOTAL_QUESTIONS) {
        endGame();
        return;
    }
    
    // 新しい問題の生成
    correctAnswer = generateQuestion();
    playerInput = "";
    updateUI();
    
    // 問題の音声再生
    playQuestionAudio(correctAnswer).catch(e => console.error("Question audio sequence failed:", e));
}

// 問題の音声を再生する
function playQuestionAudio(answer) {
    const parts = answer.split('.');
    let filenames = [];
    
    for (const part of parts) {
        // 例外処理: 少数点第1位が0の場合 (例: 5.0) は整数として処理されるため、
        // partsは一つになる。この処理は不要だが、将来的な拡張性のために残す。
        if (part !== "") {
            filenames.push(QUIZ_FILES[part]);
        }
    }
    
    // 小数点がある場合のみ ".mp3" のファイルを追加
    if (answer.includes('.')) {
        filenames.push(QUIZ_FILES['.']);
    }
    
    return playAudioSequence(filenames);
}

// 回答を確定する
function confirmAnswer() {
    if (isPlaying) {
        messageDisplay.textContent = "音声再生中です。しばらくお待ちください。";
        return;
    }
    
    if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) {
        messageDisplay.textContent = "ゲームが開始されていません。";
        return;
    }

    if (playerInput === "") {
        messageDisplay.textContent = "数値を入力してください。";
        return;
    }

    // 入力値と正解が一致するか確認
    if (playerInput === correctAnswer) {
        // 正解
        score++;
        messageDisplay.textContent = "正解！次の問題に進みます。";
        playAudioElement(seikaiFile).then(() => {
            // 正解の音声を再生した後、次の問題へ
            nextQuestion(); 
        }).catch(e => console.error("Seikai audio failed:", e));

    } else {
        // 不正解
        messageDisplay.textContent = `残念。正解は ${correctAnswer} でした。`;
        // 不正解の音声を再生
        playAudioElement(noFile).then(() => {
            // 不正解の音声を再生した後、正解の値を読み上げ
            return playAnswerAudio(correctAnswer);
        }).then(() => {
            // 正解の読み上げ後、次の問題へ
            nextQuestion();
        }).catch(e => console.error("No/Answer audio failed:", e));
    }
    
    // 確定ボタンの音声再生（結果が出る前）
    playAudioElement(INPUT_FILES["ENTER"], true).catch(e => console.error("Input audio failed", e));
}

// 正解の値を読み上げる
function playAnswerAudio(answer) {
    const parts = answer.split('.');
    let filenames = [];
    
    for (const part of parts) {
        if (part !== "") {
            filenames.push(ANSWER_FILES[part]);
        }
    }
    
    if (answer.includes('.')) {
        filenames.push(ANSWER_FILES['.']);
    }

    return playAudioSequence(filenames);
}

// ゲーム終了処理
function endGame() {
    updateUI();
    // 修正: スコアがTOTAL_QUESTIONS（3問）に等しい場合のみ「デスターシャ！」を再生
    if (score === TOTAL_QUESTIONS) {
        playAudioElement(gameClearFile).catch(e => console.error("Game clear audio failed:", e));
    } else {
        messageDisplay.textContent = `ゲーム終了！${TOTAL_QUESTIONS}問中${score}問正解でした。`;
    }
}

// ゲームをリセットして開始
function startGame() {
    if (isPlaying) return;
    score = 0;
    questionIndex = 0;
    messageDisplay.textContent = "ゲームを開始します。";
    updateUI();
    
    // ルール音声を再生後、最初の問題へ
    playAudioSequence(ruleFiles).then(() => {
        // ルール音声が終わったら、最初の問題へ
        nextQuestion();
    }).catch(e => console.error("Rule audio sequence failed:", e));
}

// 再挑戦ボタンの処理
function retryGame() {
    playAudioElement(INPUT_FILES["RETRY"], true).catch(e => console.error("Input audio failed", e));
    startGame();
}

// --- イベントリスナー ---

// スタートボタン
startBtn.addEventListener("click", startGame);

// 再挑戦ボタン
retryBtn.addEventListener("click", retryGame);

// ルールボタン
ruleBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RULE"], true).catch(e => console.error("Input audio failed", e));
    playAudioSequence(ruleFiles).catch(e => console.error("Rule audio sequence failed:", e));
});

// イヤホン確認ボタン
checkBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["CHECK"], true).then(() => {
        // LとRの音声を再生
        return playAudioSequence(["check_l.mp3", "check_r.mp3"]);
    }).catch(e => console.error("Check audio sequence failed:", e));
});

// ヒントLボタン
hintLBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_L"], true).then(() => {
        return playAudioElement("hint_l_sound.mp3");
    }).catch(e => console.error("Hint L audio failed:", e));
});

// ヒントRボタン
hintRBtn.addEventListener("click", () => {
    if (isPlaying || questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;
    playAudioElement(INPUT_FILES["HINT_R"], true).then(() => {
        return playAudioElement("hint_r_sound.mp3");
    }).catch(e => console.error("Hint R audio failed:", e));
});

// ランキングボタン
rankingBtn.addEventListener("click", () => {
    if (isPlaying) return;
    playAudioElement(INPUT_FILES["RANKING"], true).catch(e => console.error("Input audio failed", e));
    // ここにランキング表示ロジック（ダミー）
    rankingList.innerHTML = `
        <p>（ランキング機能は現在開発中です）</p>
        <p>1位: 9.9（ダミー）</p>
        <p>2位: 9.8（ダミー）</p>
    `;
    rankingWrap.style.display = 'block';
});

// ランキングを閉じるボタン
closeRankingBtn.addEventListener("click", () => {
    playAudioElement(INPUT_FILES["CLOSE"], true).catch(e => console.error("Input audio failed", e));
    rankingWrap.style.display = 'none';
});

// テンキーボタンと確定ボタンのイベントリスナー
inputKeys.forEach(btn => {
    btn.addEventListener("click", () => {
        if (isPlaying) return;
        const k = btn.getAttribute("data-key");
        handleKeyInput(k);
    });
});

// キーボード入力のイベントリスナー
document.addEventListener("keydown", (e)=>{
    const key = e.key;
    // 数字、小数点、Cのチェック
    if (["0","1","2","3","4","5","6","7","8","9",".", "c", "C"].includes(key)){
        handleKeyInput(key.toUpperCase());
    } 
    // Enterキーのチェック
    else if (key === "Enter"){
        // 修正: ゲーム中（1問目〜最終問）のみ確定できるようにする
        if (questionIndex > 0 && questionIndex <= TOTAL_QUESTIONS) confirmAnswer();
    }
});


// テンキーやキーボードからの入力を処理するコア関数
function handleKeyInput(k) {
    // ゲーム未開始または終了後は入力を受け付けない
    if (questionIndex === 0 || questionIndex > TOTAL_QUESTIONS) return;

    // 確定ボタン/Enterキー
    if (k === "ENTER") {
        confirmAnswer();
        return;
    }

    // クリアボタン/Cキー
    if (k === "C") {
        playerInput = ""; 
        const inputFilename = INPUT_FILES["C"];
        if (inputFilename) {
            playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
        }
    } 
    // 数字または小数点
    else {
        // 0-9の数字
        if (!isNaN(parseInt(k))) {
            // 入力値が3桁未満の場合のみ追加（整数部が2桁まで）
            if (playerInput.length < 3 || (playerInput.includes('.') && playerInput.length < 5)) {
                playerInput += k;
            }
        } 
        // 小数点
        else if (k === ".") {
            // 既に小数点がない、かつ最大長に達していない場合のみ追加
            if (!playerInput.includes('.') && playerInput.length > 0 && playerInput.length < 3) {
                playerInput += k;
            }
        }
        
        // 入力音声の再生
        const inputFilename = INPUT_FILES[k];
        if (inputFilename) {
            playAudioElement(inputFilename, true).catch(e => console.error("Input audio failed", e)); 
        }
    }

    updateUI();
}

// 起動時の初期化
document.addEventListener("DOMContentLoaded", updateUI);