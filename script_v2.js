// ==========================================
// 1. 初期設定・変数
// ==========================================
// グローバルエラー表示（デバッグ用）
window.addEventListener('error', (ev) => {
    try {
        const status = document.getElementById('statusArea');
        if (status) status.innerText = 'エラー発生: ' + (ev.message || ev.error || 'unknown');
    } catch (e) { /* ignore */ }
    console.error('Unhandled error', ev);
});
window.addEventListener('unhandledrejection', (ev) => {
    try {
        const status = document.getElementById('statusArea');
        if (status) status.innerText = 'エラー(Promise): ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason));
    } catch (e) { /* ignore */ }
    console.error('Unhandled rejection', ev);
});
let score = 0;
let practiceCount = 0;   
let practiceCorrect = 0; 
let currentCorrectAnswer = null;
let gameMode = ""; 
let currentAudio = null; // 現在再生中の音声を保持
let activeRecognition = null; // 音声認識を停止するための参照
let rankingsUnsub = null; // リアルタイム購読の解除関数
let lastAudioEndedAt = 0; // 直前の音声再生が終わった時刻（エコー誤認識対策）
const ECHO_GUARD_MS = 500; // 音声終了直後、この時間内の認識結果は誤認識とみなして無視する

// 出題されるボールの位置
const ballPositions = [0, 1, 2, 3, 4, 4.5, 5, 6, 7, 8, 9];

// 「どこ？」のファイルリスト（soundフォルダ）
const whereSounds = [
    "sound/where_1.mp3",
    "sound/where_2.mp3",
    "sound/where_3.mp3",
    "sound/where_4.mp3",
    "sound/where_5.mp3"
];

// ファイル名用にインデックスを正規化（4.5 -> 45 など）
function fileIdFor(n) {
    return String(n).replace('.', '');
}

// 音声テキストを正規化して数字に変換する（成功->number, 失敗->null）
function normalizeJapaneseNums(s) {
    if (!s) return '';
    const mapChars = {
        '０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9',
        '〇':'0','零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'
    };
    let out = s;
    out = out.split('').map(ch => mapChars[ch] !== undefined ? mapChars[ch] : ch).join('');
    const kanaMap = {
        'いち':'1','に':'2','さん':'3','よん':'4','し':'4','ご':'5','ろく':'6','なな':'7','しち':'7','はち':'8','きゅう':'9','く':'9','ぜろ':'0','れい':'0',
        'イチ':'1','ニ':'2','サン':'3','ヨン':'4','シ':'4','ゴ':'5','ロク':'6','ナナ':'7','シチ':'7','ハチ':'8','キュウ':'9','ク':'9','ゼロ':'0'
    };
    Object.keys(kanaMap).sort((a,b)=>b.length-a.length).forEach(k => {
        out = out.replace(new RegExp(k,'g'), kanaMap[k]);
    });
    return out;
}

function parseSpokenNumber(transcript) {
    if (!transcript) return null;
    let normalized = transcript.replace(/\s+/g, '');
    normalized = normalizeJapaneseNums(normalized);
    normalized = normalized.replace(/[点てんテン]/g, '.');
    let cleaned = normalized.replace(/[^0-9.]/g, '');
    let num = parseFloat(cleaned);
    if ((isNaN(num) || Number.isInteger(num)) && currentCorrectAnswer != null) {
        const expectedFileId = fileIdFor(currentCorrectAnswer);
        const onlyDigits = cleaned.replace(/\./g, '');
        if (onlyDigits === expectedFileId) {
            return currentCorrectAnswer;
        }
    }
    return isNaN(num) ? null : num;
}

// Firebaseの初期化
const firebaseConfig = {
    apiKey: "AIzaSyDwBUd2D1Mt8HlZbh9Mvpi95JP6P0F7S7E",
    authDomain: "gsranking.firebaseapp.com",
    projectId: "gsranking",
    storageBucket: "gsranking.firebasestorage.app",
    messagingSenderId: "876090875752",
    appId: "1:876090875752:web:7841b486506842230ec0dd",
    measurementId: "G-M1Y9F13D2E"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 2. アクセシビリティ・スマホ操作強化（新機能なのだ！）
// ==========================================

function setupGlobalControls() {
    // A. 画面全体のタップ対応（スマホ・PC共通）
    document.body.addEventListener('click', (e) => {
        // 音が鳴っている時、かつボタン以外の場所を触ったら停止
        if (currentAudio && e.target.tagName !== 'BUTTON') {
            console.log("画面タップで停止したのだ！");
            stopAllSounds();
        }
    }, true);

    // B. キーボード対応（PC用：スペースキーで停止）
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && currentAudio) {
            console.log("スペースキーで停止したのだ！");
            stopAllSounds();
            e.preventDefault(); // 画面スクロール防止
        }
    });
    // 初期状態ではトップなので戻るボタンを非表示にする
    setBackButtonVisible(false);
}

// ==========================================
// 3. モード開始・再生コントロール
// ==========================================

function stopAllSounds() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (activeRecognition) {
        activeRecognition.abort();
        activeRecognition = null;
    }
    const status = document.getElementById("statusArea");
    if (status && gameMode === "") {
        status.innerText = "音を止めたのだ。モードを選んでね。";
    }
}

function goHome() {
    stopAllSounds();
    gameMode = "";
    const mode = document.getElementById("modeSelection");
    const game = document.getElementById("gameArea");
    const ranking = document.getElementById("rankingArea");
    if (game) game.classList.add("hidden");
    if (ranking) ranking.classList.add("hidden");
    if (mode) mode.classList.remove("hidden");
    setAnswerButtonsVisible(false);
    stopRankingRealtime();
    const status = document.getElementById("statusArea");
    if (status) status.innerText = "タイトルに戻ったのだ。モードを選んでね。";
}

function setBackButtonVisible(show) {
    const b = document.getElementById('backButton');
    if (!b) return;
    b.style.display = show ? 'inline-block' : 'none';
}

function setAnswerButtonsVisible(show) {
    const buttons = document.getElementById('answerButtons');
    if (!buttons) return;
    buttons.classList.toggle('hidden', !show);
}

function inputAnswer(value) {
    setAnswerButtonsVisible(false);
    document.getElementById('currentInput').innerText = String(value).includes('.') ? String(value) : String(value);
    checkAnswer(value);
}

function checkSound() {
    const status = document.getElementById("statusArea");
    if (status) status.innerText = "ずんだもんが左右を確認中...（画面タップで停止）";
    playSound("sound/zunda_check.mp3", () => {
        if (status) status.innerText = "準備ができたらモードを選んでね";
    });
}

let backHintAnnounced = false; // 「もどる」の案内をこのセッションで既に話したか

// 「もどる」と言えば戻れることを、最初の一回だけ音声で案内する
// 1. 録音済みのreturn.wavを再生 → 2. 失敗したらTTSで代用
function announceBackHintOnce(callback) {
    if (backHintAnnounced) {
        console.log('[戻る案内] 既にこのセッションで案内済みのためスキップ');
        callback();
        return;
    }
    backHintAnnounced = true;
    console.log('[戻る案内] sound/return.wav の再生を試みます');

    stopAllSounds();
    currentAudio = new Audio('sound/return.wav');
    currentAudio.play().then(() => {
        console.log('[戻る案内] return.wav 再生開始に成功');
        currentAudio.onended = () => {
            console.log('[戻る案内] return.wav 再生終了');
            currentAudio = null;
            lastAudioEndedAt = Date.now();
            callback();
        };
    }).catch(err => {
        console.warn('[戻る案内] return.wav の再生に失敗、TTSにフォールバックします:', err);
        currentAudio = null;
        if (typeof window.speechSynthesis === 'undefined') {
            console.warn('[戻る案内] このブラウザは音声合成(speechSynthesis)に非対応です');
            callback();
            return;
        }
        try {
            const msg = new SpeechSynthesisUtterance('困ったときは、いつでも「もどる」と言うと戻れます。');
            msg.lang = 'ja-JP';
            msg.onend = callback;
            msg.onerror = (e) => { console.warn('[戻る案内] TTSのonerror', e); callback(); };
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(msg);
        } catch (e) {
            console.warn('[戻る案内] TTSも失敗', e);
            callback();
        }
    });
}

function startPractice() {
    gameMode = "practice";
    score = 0;
    practiceCount = 0;
    practiceCorrect = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    setBackButtonVisible(true);
    announceBackHintOnce(() => nextQuestion());
}

function startChampionship() {
    gameMode = "championship";
    score = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    setBackButtonVisible(true);
    announceBackHintOnce(() => {
        playSound("sound/start_pro.mp3", () => {
            nextQuestion();
        });
    });
}

// ==========================================
// 4. ゲーム進行ロジック
// ==========================================

function nextQuestion() {
    if (gameMode === "practice" && practiceCount >= 5) {
        finishPractice();
        return;
    }

    // 前の問題のマイクが万一残っていた場合に備え、念のため確実に止めておく
    stopAllSounds();

    const randomIndex = Math.floor(Math.random() * ballPositions.length);
    currentCorrectAnswer = ballPositions[randomIndex];
    
    document.getElementById("statusArea").innerText = "よく聴くのだ...";
    document.getElementById("currentInput").innerText = "-"; 

    // 1. 試合セット（quiz_X.mp3）を再生
    playSound(`sound/quiz_${fileIdFor(currentCorrectAnswer)}.mp3`, () => {
        // 2. 終わったらランダムに「どこ？」を再生
        const randomDoko = whereSounds[Math.floor(Math.random() * whereSounds.length)];
        playSound(randomDoko, () => {
            // 3. マイク起動
            startAnswerListening();
            setAnswerButtonsVisible(true);
            const hint = document.getElementById('answerModeHint');
            if (hint) hint.innerText = '音声かボタンで答えてね！';
        });
    });
}

function checkAnswer(playerInput) {
    if (parseFloat(playerInput) === currentCorrectAnswer) {
        if (gameMode === "practice") practiceCorrect++;
        score++;
        // 正解時のバイブレーション（スマホのみ）
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        
        playSound("sound/seikai.mp3", () => {
            if (gameMode === "practice") practiceCount++;
            setTimeout(nextQuestion, 800);
        });
    } else {
        // 不正解時のバイブレーション（スマホのみ）
        if (navigator.vibrate) navigator.vibrate(500);

        playSound("sound/no.mp3", () => {
            playSound(`sound/answer_${fileIdFor(currentCorrectAnswer)}.mp3`, () => {
                if (gameMode === "practice") {
                    practiceCount++;
                    setTimeout(nextQuestion, 1000);
                } else {
                    endGame(); 
                }
            });
        });
    }
}

// ==========================================
// 5. 音声入力処理
// ==========================================

async function requestMicrophoneAccess() {
    const status = document.getElementById("statusArea");
    const hint = document.getElementById('answerModeHint');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return true;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err) {
        console.warn('Microphone permission denied', err);
        if (status) status.innerText = "マイクの許可が必要です。ブラウザの設定で許可するか、ボタンで答えてね。";
        setAnswerButtonsVisible(true);
        if (hint) hint.innerText = 'マイクを許可できない場合、ボタンで答えてね。';
        return false;
    }
}

async function startAnswerListening(retryCount = 0) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const status = document.getElementById("statusArea");
    const hint = document.getElementById('answerModeHint');
    if (!SpeechRecognition) {
        if (status) status.innerText = "音声認識が利用できません。ボタンで答えてね。";
        setAnswerButtonsVisible(true);
        if (hint) hint.innerText = 'ボタンで番号を選択してね！';
        return;
    }

    if (status) status.innerText = "どこなのだ？（番号を言ってね）";
    if (hint) hint.innerText = '音声かボタンで答えてね！';

    const permissionGranted = await requestMicrophoneAccess();
    if (!permissionGranted) {
        return;
    }

    const doRecognition = () => {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
        recognition.maxAlternatives = 5;

        let handled = false;

        // 直前の音声（説明・正解/不正解の声）のスピーカー音をマイクが拾って
        // 誤認識してしまう「音声フィードバック」を防ぐためのガード
        const isEchoWindow = () => {
            return currentAudio !== null || (Date.now() - lastAudioEndedAt) < ECHO_GUARD_MS;
        };

        recognition.onresult = (event) => {
            if (isEchoWindow()) {
                console.warn('エコーの可能性があるため認識結果を無視しました');
                return;
            }
            const results = event.results[0];
            for (let i = 0; i < results.length; i++) {
                const alt = results[i].transcript || '';
                const altNorm = alt.replace(/\s+/g, '');
                // check for 'もどる' command
                if (/もどる|戻る/.test(altNorm)) {
                    handled = true;
                    goHome();
                    return;
                }
                const num = parseSpokenNumber(alt);
                if (num !== null) {
                    handled = true;
                    document.getElementById("currentInput").innerText = String(num).includes('.') ? String(num) : String(num);
                    checkAnswer(num);
                    return;
                }
            }

            if (!handled) {
                if (retryCount < 2) {
                    if (status) status.innerText = "聞き取れなかったのだ。もう一度試すのだ...";
                    setTimeout(() => startAnswerListening(retryCount + 1), 700);
                } else {
                    if (status) status.innerText = "聞き取れなかったのだ。ボタンで回答するか、もう一度挑戦してね。";
                    setAnswerButtonsVisible(true);
                    if (hint) hint.innerText = 'ボタンで番号を選択してね！';
                    playSound('sound/hint.mp3');
                }
            }
        };

        recognition.onerror = (e) => {
            if (e.error === 'aborted') {
                // 次の音声に切り替えるために意図的に止めた時に出るだけなので、正常な動作
                console.log('[音声認識] 次に進むためマイクを停止しました(正常)');
                return;
            }
            console.error('Recognition error', e);
            if (currentAudio) return; // 既に次の音声が始まっている＝別の場面に進んでいるので何もしない
            const blocked = e.error === 'not-allowed' || e.error === 'denied' || e.error === 'not-allowed';
            if (retryCount < 2 && !blocked) {
                setTimeout(() => startAnswerListening(retryCount + 1), 700);
            } else {
                if (status) status.innerText = blocked
                    ? "マイクの許可が必要です。ブラウザの設定で許可するか、ボタンで答えてね。"
                    : "認識エラーが発生したのだ。ボタンで回答するか、マイク設定を確認してね。";
                setAnswerButtonsVisible(true);
                if (hint) hint.innerText = 'ボタンで番号を選択してね！';
            }
        };

        recognition.onend = () => {
            activeRecognition = null;
        };

        // 直前の音声の余韻(エコー)が収まるのを少し待ってからマイクを起動する
        setTimeout(() => {
            // 待っている間に別の音声が始まっていたら（既に次に進んでいたら）起動しない
            if (currentAudio) return;
            recognition.start();
            activeRecognition = recognition;
        }, ECHO_GUARD_MS);
    };

    doRecognition();
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
        const t = event.results[0][0].transcript || '';
        if (/もどる|戻る/.test(t.replace(/\s+/g,''))) {
            goHome();
            return;
        }
        document.getElementById("nameInput").value = t;
    };
    recognition.onerror = (e) => { console.error('Voice input error', e); };
    recognition.start();
}

// ==========================================
// 6. コア関数・ランキング
// ==========================================

function playSound(file, callback) {
    stopAllSounds();
    currentAudio = new Audio(file);
    currentAudio.play().then(() => {
        currentAudio.onended = () => {
            currentAudio = null;
            lastAudioEndedAt = Date.now();
            if (callback) callback();
        };
    }).catch(e => {
        console.error("再生エラー:", file, e);
        currentAudio = null;
        lastAudioEndedAt = Date.now();
        if (callback) callback();
    });
}

function finishPractice() {
    document.getElementById("statusArea").innerText = "練習終了！お疲れ様なのだ！";
    playSound("sound/training_otsukare.wav", () => {
        setTimeout(() => { location.reload(); }, 4000);
    });
}

function endGame() {
    setAnswerButtonsVisible(false);
    document.getElementById("gameArea").classList.add("hidden");
    document.getElementById("rankingArea").classList.remove("hidden");
    document.getElementById("finalScore").innerText = score;
    // 常にスコア送信エリアを表示（選手権モードでも保存できるように）
    document.getElementById("scoreSubmitArea").style.display = "block";
    loadRanking();
    startRankingRealtime();
    // ボタンを押さなくても、ずんだもんが呼びかけてそのまま名前を聞き取る
    announceNamePromptAndListen();
}

// スコア確定時に「名前を言うのだ」と呼びかけ、終わったら自動でマイクを起動する
function announceNamePromptAndListen() {
    // 「送信、と言うと送れるのだ！」と音声で案内してから、送信コマンドの聞き取りを始める
    function announceSubmitPromptThenListen() {
        const rankingStatus = document.getElementById('rankingStatus');
        if (rankingStatus) rankingStatus.innerText = '「送信」と言うとスコアを送れるのだ！';

        if (typeof window.speechSynthesis === 'undefined') {
            listenForSubmitCommand();
            return;
        }
        try {
            const msg = new SpeechSynthesisUtterance('送信、と言うと送信できます。');
            msg.lang = 'ja-JP';
            msg.onend = () => listenForSubmitCommand();
            msg.onerror = () => listenForSubmitCommand();
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(msg);
        } catch (e) {
            console.warn('送信案内のTTSに失敗', e);
            listenForSubmitCommand();
        }
    }

    // 名前を聞き取った後、続けて「送信」と言うのを待つ
    function listenForSubmitCommand() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event) => {
            const t = (event.results[0][0].transcript || '').replace(/\s+/g, '');
            if (/もどる|戻る/.test(t)) {
                goHome();
                return;
            }
            if (/送信|そうしん/.test(t)) {
                submitScore();
                return;
            }
            // 「送信」でも「もどる」でもなければ、もう一度「送信」待ちに戻る
            listenForSubmitCommand();
        };
        recognition.onerror = (e) => {
            console.warn('送信コマンドの音声認識エラー', e);
        };
        recognition.onend = () => {
            if (activeRecognition === recognition) activeRecognition = null;
        };

        try {
            recognition.start();
            activeRecognition = recognition;
        } catch (e) {
            console.warn('送信コマンドの音声認識開始エラー', e);
        }
    }

    function startListening() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const nameInput = document.getElementById('nameInput');
        if (!SpeechRecognition || !nameInput) return; // 非対応環境ではボタンからの手入力のみ

        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event) => {
            const t = event.results[0][0].transcript || '';
            if (/もどる|戻る/.test(t.replace(/\s+/g, ''))) {
                goHome();
                return;
            }
            nameInput.value = t;
            // 名前を聞き取ったら、1秒待ってから「送信と言ってね」と音声案内し、聞き取りを開始する
            setTimeout(() => {
                announceSubmitPromptThenListen();
            }, 1000);
        };
        recognition.onerror = (e) => {
            console.warn('名前の音声認識エラー', e);
        };
        recognition.onend = () => {
            if (activeRecognition === recognition) activeRecognition = null;
        };

        try {
            recognition.start();
            activeRecognition = recognition;
        } catch (e) {
            console.warn('名前の音声認識開始エラー', e);
        }
    }

    function tryPlay(src, onFail) {
        stopAllSounds();
        currentAudio = new Audio(src);
        currentAudio.play().then(() => {
            currentAudio.onended = () => {
                currentAudio = null;
                startListening();
            };
        }).catch(err => {
            console.warn('名前プロンプト音声の再生に失敗:', src, err);
            currentAudio = null;
            if (onFail) onFail();
        });
    }

    // 1. 録音済みの呼びかけ音声を試す → 2. 無ければ音声合成(TTS)で代用
    tryPlay('sound/name_prompt.wav', () => {
        try {
            const msg = new SpeechSynthesisUtterance('スコアを残すので、コートネームを言ってください。');
            msg.lang = 'ja-JP';
            msg.onend = startListening;
            msg.onerror = startListening;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(msg);
        } catch (e) {
            console.warn('名前プロンプトのTTSも失敗', e);
            startListening(); // 呼びかけ音声が全滅してもマイクだけは起動する
        }
    });
}

async function submitScore() {
    const status = document.getElementById("statusArea");
    const submitBtn = document.querySelector('#scoreSubmitArea button[onclick="submitScore()"]');
    try {
        const name = document.getElementById("nameInput").value || "ななし";
        if (status) status.innerText = "スコアを送信しています...";
        if (submitBtn) submitBtn.disabled = true;
        await db.collection("rankings").add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (status) status.innerText = "スコアを送信しました。ありがとう！";
        document.getElementById("scoreSubmitArea").style.display = "none";
        loadRanking();
        announceScoreAndRank();
    } catch (err) {
        console.error('submitScore error', err);
        if (status) status.innerText = `送信に失敗しました: ${err.message || err}`;
        if (submitBtn) submitBtn.disabled = false;
    }
}

// 送信したスコアと、自分が何位だったかを音声で読み上げる
async function announceScoreAndRank() {
    try {
        // 自分より高いスコアの人数を数えて、+1すれば順位になる
        const higherSnap = await db.collection("rankings").where("score", ">", score).get();
        const rank = higherSnap.size + 1;

        if (typeof window.speechSynthesis === 'undefined') return;
        const msg = new SpeechSynthesisUtterance(`あなたのスコアは${score}点、順位は${rank}位です。`);
        msg.lang = 'ja-JP';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
    } catch (e) {
        console.warn('順位の読み上げに失敗しました', e);
    }
}

async function loadRanking() {
    const statusEl = document.getElementById('rankingStatus');
    const listEl = document.getElementById('rankingList');
    if (statusEl) statusEl.innerText = 'ランキングを読み込んでいます...';
    if (listEl) listEl.innerHTML = '';
    try {
        const snapshot = await db.collection("rankings").orderBy("score", "desc").limit(10).get();
        if (!snapshot || snapshot.empty) {
            if (statusEl) statusEl.innerText = 'ランキングはまだ記録がありません。';
            return;
        }
        let html = '<h3 style="text-align:center;">TOP 10</h3>';
        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = data.name || 'ななし';
            const points = (data.score !== undefined && data.score !== null) ? data.score : '-';
            const time = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : '';
            html += `<div style="padding:8px 6px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;"><div><strong>${rank}. ${name}</strong><div style='font-size:0.9rem; color:#bbb;'>${time}</div></div><div style="font-size:1.2rem;">${points}点</div></div>`;
            rank++;
        });
        if (listEl) listEl.innerHTML = html;
        if (statusEl) statusEl.innerText = `読み込み完了: 上位 ${rank-1} 件を表示`; 
    } catch (err) {
        console.error('loadRanking error', err);
        if (statusEl) statusEl.innerText = `ランキングの取得に失敗しました: ${err.message || err}`;
        if (listEl) listEl.innerHTML = '';
    }
}

// ==========================================
// リアルタイム購読（onSnapshot）
// ==========================================
function startRankingRealtime() {
    if (rankingsUnsub) return; // 既に購読中
    const statusEl = document.getElementById('rankingStatus');
    const listEl = document.getElementById('rankingList');
    if (statusEl) statusEl.innerText = 'ランキングをリアルタイムで購読中...';
    rankingsUnsub = db.collection('rankings').orderBy('score','desc').limit(10)
        .onSnapshot(snapshot => {
            if (!snapshot || snapshot.empty) {
                if (statusEl) statusEl.innerText = 'ランキングはまだ記録がありません。';
                if (listEl) listEl.innerHTML = '';
                return;
            }
            let html = '<h3 style="text-align:center;">TOP 10</h3>';
            let rank = 1;
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.name || 'ななし';
                const points = (data.score !== undefined && data.score !== null) ? data.score : '-';
                const time = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : '';
                html += `<div style="padding:8px 6px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;"><div><strong>${rank}. ${name}</strong><div style='font-size:0.9rem; color:#bbb;'>${time}</div></div><div style="font-size:1.2rem;">${points}点</div></div>`;
                rank++;
            });
            if (listEl) listEl.innerHTML = html;
            if (statusEl) statusEl.innerText = `リアルタイム更新: 上位 ${rank-1} 件`;
        }, err => {
            console.error('onSnapshot error', err);
            if (statusEl) statusEl.innerText = `リアルタイム購読エラー: ${err.message || err}`;
        });
}

function stopRankingRealtime() {
    if (rankingsUnsub) {
        try { rankingsUnsub(); } catch (e) { console.warn('ランキング購読解除エラー', e); }
        rankingsUnsub = null;
    }
    const statusEl = document.getElementById('rankingStatus');
    if (statusEl) statusEl.innerText = 'ランキング購読停止';
}

// Firestore接続テスト
function testFirestoreConnection() {
    const status = document.getElementById("statusArea");
    if (!db) {
        console.error('Firestore not initialized');
        if (status) status.innerText = 'Firestore未初期化';
        return;
    }
    db.collection('rankings').limit(1).get().then(() => {
        console.log('Firestore: connection OK');
        if (status && gameMode !== "") {
            const prev = status.innerText;
            status.innerText = 'ランキング接続 OK';
            setTimeout(() => { if (status && gameMode !== "") status.innerText = prev; }, 2000);
        }
    }).catch(err => {
        console.error('Firestore connection error', err);
        if (status && gameMode !== "") {
            status.innerText = `Firestore 接続エラー: ${err.message || err}`;
        }
    });
}

// 読み込み完了時にコントロールをセットアップし、Firestore接続を確認
window.addEventListener('load', () => {
    setupGlobalControls();
    testFirestoreConnection();
});

// ==========================================
// トップでマイクを先に許可させるための処理
// ==========================================
// 指定した音声を再生し、失敗したら本当に次の手段へフォールバックする
// （playSound()は内部でエラーを握りつぶしてしまうため、ここでは直接Audioを扱う）
// onDone: 再生が最後まで終わった（または全フォールバックが尽きた）時に呼ばれる
function playGreetingWithFallback(onDone) {
    function tryPlay(src, onFail) {
        stopAllSounds();
        currentAudio = new Audio(src);
        currentAudio.play().then(() => {
            currentAudio.onended = () => {
                currentAudio = null;
                if (onDone) onDone();
            };
        }).catch(err => {
            console.warn('挨拶音声の再生に失敗:', src, err);
            currentAudio = null;
            if (onFail) onFail();
        });
    }

    // 1. wavを試す → 2. 失敗したらmp3を試す → 3. それも失敗したら音声合成(TTS)
    tryPlay('sound/zundamon_greeting_goalball.wav', () => {
        tryPlay('sound/zundamon_greeting_goalball.mp3', () => {
            try {
                const msg = new SpeechSynthesisUtterance('ゴールボールサーチゲームです。声で合図をすると遊べます。まずは「ゴールボール」と言ってみてください。');
                msg.lang = 'ja-JP';
                msg.onend = () => { if (onDone) onDone(); };
                msg.onerror = () => { if (onDone) onDone(); };
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(msg);
            } catch (e) {
                console.warn('TTSフォールバックも失敗', e);
                if (onDone) onDone();
            }
        });
    });
}

// 挨拶の後、実際に「ゴールボール」と言ってもらえるか確認する
// 認識できてもできなくても、最終的には必ずセットアップを完了させる（詰まらせない）
function listenForGreetingConfirmation() {
    const status = document.getElementById('statusArea');
    const btn = document.getElementById('preMicBtn');

    function finishSetup() {
        localStorage.setItem('micAllowed', '1');
        if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
        if (btn) btn.style.display = 'none';
        // モードを選ぶ前に、ここで先に「もどる」の案内を済ませておく
        // （モード選択後だとクイズ開始が毎回遅れてしまうため）
        announceBackHintOnce(() => {});
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        // この端末では音声認識自体が使えないので、確認はスキップしてそのまま完了
        finishSetup();
        return;
    }

    if (status) status.innerText = '「ゴールボール」と言ってみてね！';

    let handled = false;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    const timeoutId = setTimeout(() => {
        if (handled) return;
        handled = true;
        try { recognition.abort(); } catch (e) { /* ignore */ }
        playSound('sound/standby_ng.wav', finishSetup);
    }, 6000); // 6秒待っても発話が確認できなければNG扱い

    recognition.onresult = (event) => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        const results = event.results[0];
        let matched = false;
        for (let i = 0; i < results.length; i++) {
            const t = (results[i].transcript || '').replace(/\s+/g, '');
            if (/ゴールボール|ごうるぼうる|ごーるぼーる/.test(t)) {
                matched = true;
                break;
            }
        }
        playSound(matched ? 'sound/standby_ok.wav' : 'sound/standby_ng.wav', finishSetup);
    };

    recognition.onerror = (e) => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        console.warn('greeting recognition error', e);
        playSound('sound/standby_ng.wav', finishSetup);
    };

    recognition.onend = () => {
        // 何も検出されないまま終了した場合の保険
        if (!handled) {
            handled = true;
            clearTimeout(timeoutId);
            playSound('sound/standby_ng.wav', finishSetup);
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn('recognition start error', e);
        if (!handled) {
            handled = true;
            clearTimeout(timeoutId);
            finishSetup();
        }
    }
}

async function handlePreMicClick() {
    const btn = document.getElementById('preMicBtn');
    const status = document.getElementById('statusArea');
    if (btn) btn.disabled = true;
    if (status) status.innerText = 'マイクの許可を確認しています...';

    // 重要: マイク許可(getUserMediaのダイアログ待ち)と音声再生を"同時に"開始する。
    // await で直列に待ってから再生すると、クリックした瞬間の「ユーザー操作」扱いが
    // 切れてしまい、ブラウザ（特にiPhone Safari）が音声再生をブロックすることがある。
    const micPromise = requestMicrophoneAccess();
    const audioDonePromise = new Promise((resolve) => {
        playGreetingWithFallback(resolve);
    });

    // マイク許可の結果と、挨拶音声の再生完了の両方を待ってから次に進む
    const [ok] = await Promise.all([micPromise, audioDonePromise]);

    if (ok) {
        // マイクが許可できていれば、実際に「ゴールボール」と言ってもらって確認する
        listenForGreetingConfirmation();
    } else {
        if (status) status.innerText = 'マイクの許可が確認できませんでした。ボタンでも遊べます。';
        if (btn) btn.disabled = false;
    }
}

// 初期化：ボタンにリスナーを付け、既に許可済なら非表示にする
window.addEventListener('load', () => {
    try {
        const pre = document.getElementById('preMicBtn');
        if (pre) {
            // add touchstart to improve responsiveness on some iOS devices
            try { pre.addEventListener('touchstart', () => { handlePreMicClick(); }); } catch(e) { /* ignore */ }
            // only add click listener if there's no inline onclick to avoid double-calls
            if (!pre.getAttribute('onclick')) {
                pre.addEventListener('click', handlePreMicClick);
            }
            const allowed = localStorage.getItem('micAllowed');
            if (allowed === '1') {
                pre.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('preMic init error', e);
    }
});