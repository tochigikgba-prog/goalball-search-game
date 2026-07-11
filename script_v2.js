// ==========================================
// 1. 初期設定・変数
// ==========================================
let score = 0;
let practiceCount = 0;   
let practiceCorrect = 0; 
let currentCorrectAnswer = null;
let gameMode = ""; 
let currentAudio = null; // 現在再生中の音声を保持
let activeRecognition = null; // 音声認識を停止するための参照
let rankingsUnsub = null; // リアルタイム購読の解除関数

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
    if (ok) {
        try {
            // 指定された挨拶音声を再生し、続けて成功音を鳴らす
            playSound('sound/zundamon_greeting_goalball.wav', () => {
                playSound('sound/standby_ok.wav', () => {
                    localStorage.setItem('micAllowed', '1');
                    if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                    if (btn) btn.style.display = 'none';
                });
            });
        } catch (e) {
            console.warn('greeting play error', e);
            // 挨拶再生に失敗したらエラーメッセージ音を再生して完了扱いにする
            try {
                playSound('sound/standby_ng.wav', () => {
                    localStorage.setItem('micAllowed', '1');
                    if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                    if (btn) btn.style.display = 'none';
                });
            } catch (e2) {
                console.warn('standby_ng play error', e2);
                // 最終フォールバック：UIのみ更新
                localStorage.setItem('micAllowed', '1');
                if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                if (btn) btn.style.display = 'none';
            }
        }
    } else {
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

function startPractice() {
    gameMode = "practice";
    score = 0;
    practiceCount = 0;
    practiceCorrect = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    setBackButtonVisible(true);
    nextQuestion();
}

function startChampionship() {
    gameMode = "championship";
    score = 0;
    document.getElementById("modeSelection").classList.add("hidden");
    document.getElementById("gameArea").classList.remove("hidden");
    setBackButtonVisible(true);
    playSound("sound/start_pro.mp3", () => {
        nextQuestion();
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
        recognition.onresult = (event) => {
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
            console.error('Recognition error', e);
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

        recognition.start();
        activeRecognition = recognition;
    };

    // Start recognition immediately (beep removed)
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
        if (callback) {
            currentAudio.onended = () => {
                currentAudio = null;
                callback();
            };
        }
    }).catch(e => {
        console.error("再生エラー:", file, e);
        if (callback) callback();
    });
}

function finishPractice() {
    document.getElementById("statusArea").innerText = `練習終了！5問中 ${practiceCorrect}問 正解なのだ！`;
    playSound("sound/otsukare.mp3", () => {
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
    } catch (err) {
        console.error('submitScore error', err);
        if (status) status.innerText = `送信に失敗しました: ${err.message || err}`;
        if (submitBtn) submitBtn.disabled = false;
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
async function handlePreMicClick() {
    const btn = document.getElementById('preMicBtn');
    const status = document.getElementById('statusArea');
    if (btn) btn.disabled = true;
    if (status) status.innerText = 'まずは挨拶してマイクの許可を確認します...';
    const ok = await requestMicrophoneAccess();
    if (ok) {
        try {
            // 指定された音源を再生して挨拶する
            playSound('sound/zundamon_greeting_goalball.wav', () => {
                localStorage.setItem('micAllowed', '1');
                if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                if (btn) btn.style.display = 'none';
            });
        } catch (e) {
            console.warn('greeting play error', e);
            // フォールバック: 同じsoundフォルダの別フォーマットを試す
            try {
                playSound('sound/zundamon_greeting_goalball.wav', () => {
                    localStorage.setItem('micAllowed', '1');
                    if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                    if (btn) btn.style.display = 'none';
                });
            } catch (e2) {
                console.warn('wav fallback failed', e2);
                try {
                    playSound('sound/zundamon_greeting_goalball.mp3', () => {
                        localStorage.setItem('micAllowed', '1');
                        if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                        if (btn) btn.style.display = 'none';
                    });
                } catch (e3) {
                    console.warn('mp3 fallback failed', e3);
                    try {
                        const msg = new SpeechSynthesisUtterance('ずんだもんなのだ！　声で合図してくれたら遊べるのだ。まずは「ゴールボール」と言ってみるのだ！');
                        msg.lang = 'ja-JP';
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(msg);
                    } catch (e4) {
                        console.warn('TTS fallback error', e4);
                    }
                    localStorage.setItem('micAllowed', '1');
                    if (status) status.innerText = 'マイクの許可が確認できました。モードを選んでね。';
                    if (btn) btn.style.display = 'none';
                }
            }
        }
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
            pre.addEventListener('click', handlePreMicClick);
            const allowed = localStorage.getItem('micAllowed');
            if (allowed === '1') {
                pre.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('preMic init error', e);
    }
});