const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextCtx = nextCanvas.getContext('2d');

const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;

// キャラクターの世界観に合わせたダーク＆ネオンカラー
const COLORS = [
    'transparent',
    '#ff2a5f', // I (ネオンピンク/羽の色)
    '#ff8c00', // J (オレンジ/炎の色)
    '#ffea00', // L (イエロー/目の色)
    '#ff0055', // O (濃いピンク)
    '#00d4ff', // S (水色/背景のネオンの色)
    '#b700ff', // T (紫/ダークな雰囲気)
    '#ff3300'  // Z (朱色)
];

// ブロックの形
const SHAPES = [
    [],
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], // I
    [[2,0,0], [2,2,2], [0,0,0]], // J
    [[0,0,3], [3,3,3], [0,0,0]], // L
    [[4,4], [4,4]], // O
    [[0,5,5], [5,5,0], [0,0,0]], // S
    [[0,6,0], [6,6,6], [0,0,0]], // T
    [[7,7,0], [0,7,7], [0,0,0]]  // Z
];

let board = [];
let piece = null;
let nextPieceInfo = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let score = 0;
let lines = 0;
let level = 1;
let gameActive = false;
let isPaused = false;
let highScore = localStorage.getItem('tetrisHighScore') || 0;
let animationId = null;

// キャラクターのセリフ表示用タイマー
let speechTimeout = null;

// BGM関連の変数
const bgmAudio = document.getElementById('bgm-audio');
let isBgmEnabled = true;

// BGMの再生
function startBGM() {
    if (isBgmEnabled && bgmAudio) {
        bgmAudio.volume = 0.3; // 音量を少し下げる（0.0〜1.0）
        bgmAudio.play().catch(e => console.log("ブラウザの制限でBGMが再生されませんでした"));
    }
}

// BGMの停止
function stopBGM() {
    if (bgmAudio) {
        bgmAudio.pause();
    }
}

function showSpeech(text, duration = 2000) {
    const bubble = document.getElementById('speech-bubble');
    if (!bubble) return;
    
    // 改行コードを反映させるためinnerTextを使用
    bubble.innerText = text;
    bubble.classList.remove('hidden');
    
    if (speechTimeout) {
        clearTimeout(speechTimeout);
    }
    
    speechTimeout = setTimeout(() => {
        bubble.classList.add('hidden');
    }, duration);
}

// 盤面の初期化
function initBoard() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
}

// 新しいブロックの生成
function createPiece(type) {
    return {
        matrix: SHAPES[type],
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
        y: 0,
        type: type
    };
}

// ランダムなブロックの種類を取得
function randomPieceType() {
    return Math.floor(Math.random() * 7) + 1;
}

// 1つのブロックの描画（ネオン効果付き）
function drawBlock(context, x, y, type, size, isNext = false) {
    if (type === 0) return;
    
    const color = COLORS[type];
    
    // 背景の塗りつぶし
    context.fillStyle = color;
    context.globalAlpha = 0.8;
    context.fillRect(x * size, y * size, size, size);
    
    // 枠線
    context.globalAlpha = 1.0;
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 1;
    context.strokeRect(x * size, y * size, size, size);

    // 内側の光
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
    
    // ネオンのぼかし効果（次のブロックプレビュー以外で適用）
    if (!isNext) {
        context.shadowBlur = 10;
        context.shadowColor = color;
    }
}

// 盤面の描画
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 背景画像を透かせるためにクリア
    
    // 盤面だけ少し暗くしてブロックを見やすくする
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.shadowBlur = 0;

    // グリッド線の描画
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let r = 0; r < ROWS; r++){
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(canvas.width, r * BLOCK_SIZE);
        ctx.stroke();
    }
    for(let c = 0; c < COLS; c++){
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }

    // すでに固定されたブロックの描画
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== 0) {
                drawBlock(ctx, x, y, board[y][x], BLOCK_SIZE);
            }
        }
    }
    ctx.shadowBlur = 0;
}

// 現在操作中のブロックの描画
function drawPiece() {
    if (!piece) return;
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, piece.x + x, piece.y + y, value, BLOCK_SIZE);
            }
        });
    });
    ctx.shadowBlur = 0;
}

// 次のブロックのプレビューを描画
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPieceInfo) return;
    
    const matrix = SHAPES[nextPieceInfo];
    const blockSize = 24;
    const offsetX = (nextCanvas.width - matrix[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - matrix.length * blockSize) / 2;

    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const px = offsetX / blockSize + x;
                const py = offsetY / blockSize + y;
                drawBlock(nextCtx, px, py, value, blockSize, true);
            }
        });
    });
}

// 衝突判定（壁や他のブロックにぶつかっていないか）
function collide(board, piece) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 &&
               (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

// ブロックを盤面に固定する
function merge(board, piece) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + piece.y][x + piece.x] = value;
            }
        });
    });
}

// ブロックの回転
function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

// ブロックを1段落とす
function pieceDrop() {
    piece.y++;
    if (collide(board, piece)) {
        piece.y--;
        merge(board, piece);
        resetPiece();
        clearLines();
        if (collide(board, piece)) {
            gameOver();
        }
    }
    dropCounter = 0;
}

// スペースキーで一気に下まで落とす
function hardDrop() {
    while (!collide(board, piece)) {
        piece.y++;
    }
    piece.y--;
    merge(board, piece);
    resetPiece();
    clearLines();
    if (collide(board, piece)) {
        gameOver();
    }
    dropCounter = 0;
}

// ブロックを左右に移動
function pieceMove(offset) {
    piece.x += offset;
    if (collide(board, piece)) {
        piece.x -= offset;
    }
}

// ブロックを回転させる（壁際での回転処理も含む）
function pieceRotate(dir) {
    const pos = piece.x;
    let offset = 1;
    rotate(piece.matrix, dir);
    while (collide(board, piece)) {
        piece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > piece.matrix[0].length) {
            rotate(piece.matrix, -dir);
            piece.x = pos;
            return;
        }
    }
}

// 揃った列を消去し、スコアを計算
function clearLines() {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        y++;
        linesCleared++;
    }

    if (linesCleared > 0) {
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[linesCleared] * level;
        lines += linesCleared;
        
        const oldLevel = level;
        // 10ライン消すたびにレベルアップ、スピードアップ
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);

        updateUI();

        // 消したライン数やレベルアップに応じた掛け声
        if (level > oldLevel) {
            showSpeech("レベルアップ！\nスピードが上がるぜ！", 3000);
        } else {
            if (linesCleared === 1) {
                showSpeech("よし！その調子！", 1500);
            } else if (linesCleared === 2) {
                showSpeech("ダブル！いいぞ！", 1500);
            } else if (linesCleared === 3) {
                showSpeech("トリプル！すげぇ！", 2000);
            } else if (linesCleared === 4) {
                showSpeech("テトリス！！\nお前、天才か！？", 2500);
            }
        }
    }
}

// 次のブロックを準備
function resetPiece() {
    if (nextPieceInfo === null) {
        nextPieceInfo = randomPieceType();
    }
    piece = createPiece(nextPieceInfo);
    nextPieceInfo = randomPieceType();
    drawNextPiece();
}

// スコアなどのUIを更新
function updateUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('high-score').innerText = highScore;
    document.getElementById('lines').innerText = lines;
    document.getElementById('level').innerText = level;
}

// ゲームのメインループ（常に画面を更新し続ける）
function update(time = 0) {
    if (!gameActive || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    // 一定時間ごとにブロックを落とす
    if (dropCounter > dropInterval) {
        pieceDrop();
    }

    drawBoard();
    drawPiece();

    animationId = requestAnimationFrame(update);
}

// ゲームオーバー処理
function gameOver() {
    gameActive = false;
    stopBGM();
    cancelAnimationFrame(animationId);
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
    
    if (score > highScore && score > 0) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
        document.getElementById('high-score').innerText = highScore;
        showSpeech("新記録だ！！\nお前、やるじゃねえか！", 4000);
    } else {
        showSpeech("ゲームオーバー！\n次はもっと頑張れよ！", 3000);
    }
}

// ゲームスタート処理
function startGame() {
    initBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    isPaused = false;
    updateUI();
    nextPieceInfo = null;
    resetPiece();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    gameActive = true;
    lastTime = performance.now();
    startBGM();
    update();
    
    showSpeech("さあ、始めるぜ！", 2000);
}

// 一時停止／再開の切り替え
function togglePause() {
    if (!gameActive) return; // プレイ中のみ有効
    
    isPaused = !isPaused;
    if (isPaused) {
        stopBGM();
        cancelAnimationFrame(animationId);
        document.getElementById('pause-screen').classList.remove('hidden');
        showSpeech("ちょっと休憩か？", 2000);
    } else {
        document.getElementById('pause-screen').classList.add('hidden');
        lastTime = performance.now();
        startBGM();
        update();
        showSpeech("再開するぜ！", 2000);
    }
}

// キーボード操作の設定
document.addEventListener('keydown', event => {
    if (!gameActive) return;
    
    // Pキーは一時停止中でも受け付ける
    if (event.keyCode === 80) { // Pキー
        togglePause();
        return;
    }
    
    if (isPaused) return; // 一時停止中は他の操作を無効化
    
    switch (event.keyCode) {
        case 37: // 左矢印
            pieceMove(-1);
            break;
        case 39: // 右矢印
            pieceMove(1);
            break;
        case 40: // 下矢印
            pieceDrop();
            break;
        case 38: // 上矢印
            pieceRotate(1);
            break;
        case 32: // スペースキー
            hardDrop();
            break;
    }
    
    // 矢印キーやスペースキーで画面がスクロールするのを防ぐ
    if([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }
});

// スマホ用ボタンのクリック／タップイベント
function setupMobileControls() {
    const handleControl = (id, action) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        
        // clickはスマホでもPCでも確実に動作します
        btn.addEventListener('click', (e) => {
            if (gameActive) action();
            // スペースキーなどとの干渉を防ぐためフォーカスを外す
            btn.blur();
        });
    };

    handleControl('btn-pause', () => togglePause());
    handleControl('btn-left', () => pieceMove(-1));
    handleControl('btn-right', () => pieceMove(1));
    handleControl('btn-down', () => pieceDrop());
    handleControl('btn-rotate', () => pieceRotate(1));
    handleControl('btn-drop', () => hardDrop());
}

// コントローラーのセットアップを実行
setupMobileControls();

// ボタンのクリックイベント
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('btn-bgm').addEventListener('click', (e) => {
    isBgmEnabled = !isBgmEnabled;
    e.target.innerText = isBgmEnabled ? "🔊" : "🔈";
    if (gameActive && !isPaused) {
        if (isBgmEnabled) startBGM();
        else stopBGM();
    }
    e.target.blur();
});

// 最初の画面描画
drawBoard();
