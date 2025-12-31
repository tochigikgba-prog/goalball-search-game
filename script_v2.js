/* script_v2.js - ゴールボールサーチゲーム完全版 */

const SOUND_PATH = "sound/";

// 入力確認・操作用の音声ファイル
const INPUT_FILES = {
  "0":"0.mp3", "1":"1.mp3", "2":"2.mp3", "3":"3.mp3", "4":"4.mp3", "5":"5.mp3",
  "6":"6.mp3", "7":"7.mp3", "8":"8.mp3", "9":"9.mp3", "4.5":"quiz_45.mp3",
  "C":"clear.mp3", "Enter":"confirm.mp3"
};

// 判定・正解告知用の音声ファイル
const JUDGE_FILES = {
  "SUCCESS": "seikai.mp3", //
  "NO": "no.mp3",          //
  "ANSWERS": {
    "0": "answer_0.mp3",   //
    "1": "answer_1.mp3",   //
    "2": "answer_2.mp3",   //
    "3": "answer_3.mp3",   //
    "4": "answer_4.mp3",   //
    "4.5": "answer_45.mp3",//
    "5": "answer_5.mp3",   //
    "6": "answer_6.mp3",   //
    "7": "answer_7.mp3",   //
    "8": "answer_8.mp3",   // 8の音声ファイルがあればここへ
    "9": "answer_9.mp3"    // 9の音声ファイルがあればここへ
  }
};

let playerInput = "";
let currentAudio = null;
let isGameStarted = false;
let currentCorrectAnswer = "";

// ページ読み込み時の初期化
document.addEventListener("DOMContentLoaded", () => {
    // スタートボタンのイベント
    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            isGameStarted = true;
            nextQuestion();
        });
    }

    // 各数字ボタン（キー）のイベント
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", () => {
            const k = btn.getAttribute("data-key");
            handleKeyInput(k);
        });
    });

    // ヒントボタン：今の問題をもう一度聞く
    const hintBtn = document.getElementById("hintBtn");
    if (hintBtn) {
        hintBtn.addEventListener("click", () => {
            if (!isGameStarted) return;
            playQuestionSound(currentCorrectAnswer);
        });
    }