/*
 * tetris.js — ブラウザで読み込むだけで遊べるテトリス実装（単一JSファイル）
 *
 * 使い方：
 * <script src="tetris.js"></script> をHTMLの</body>直前に入れるだけ。
 * 自動でゲーム用のCanvasとUIが生成されます。
 *
 * 操作：
 * ←→ 移動 / ↓ ソフトドロップ / Space ハードドロップ
 * Z 反時計回り回転 / X 時計回り回転 / ↑ 180°回転
 * C ホールド / P ポーズ / R リスタート
 */
(() => {
  // ===== 設定 =====
  const COLS = 10;
  const ROWS = 20;
  const VISIBLE_ROWS = 20; // 描画する行数
  const CELL = 32; // 描画1マスのpx
  const PREVIEW_COUNT = 5;
  const TICK_START_MS = 800; // レベル1の落下速度
  const TICK_MIN_MS = 60;    // 最小落下速度
  const LOCK_DELAY_MS = 500; // 接地後の猶予
  const GHOST_ALPHA = 0.25;

  // スコア設定（一般的なTetris Guidelineに近いが簡略）
  const SCORE_TABLE = {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800,
    softDrop: 1,
    hardDrop: 2,
    tspin: 400, // 簡易：T-Spinでライン消し時に加算（厳密判定は省略）
  };

  // ===== DOM 準備 =====
  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.background = 'linear-gradient(180deg,#0b1020,#121b2f)';
  root.style.display = 'grid';
  root.style.gridTemplateColumns = '1fr auto 1fr';
  root.style.gridTemplateRows = '1fr';
  root.style.gap = '16px';
  root.style.alignItems = 'center';
  root.style.justifyItems = 'center';
  root.style.zIndex = '2147483647'; // いちばん上

  const panel = document.createElement('div');
  panel.style.display = 'grid';
  panel.style.gridTemplateColumns = 'auto auto auto';
  panel.style.gap = '16px';
  panel.style.alignItems = 'start';
  panel.style.justifyItems = 'center';
  panel.style.padding = '16px';
  panel.style.borderRadius = '16px';
  panel.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
  panel.style.background = 'rgba(255,255,255,.06)';
  panel.style.backdropFilter = 'blur(6px)';

  const leftCol = document.createElement('div');
  const centerCol = document.createElement('div');
  const rightCol = document.createElement('div');
  panel.append(leftCol, centerCol, rightCol);

  const title = document.createElement('div');
  title.textContent = 'TETRIS';
  title.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
  title.style.letterSpacing = '6px';
  title.style.fontWeight = '800';
  title.style.fontSize = '24px';
  title.style.color = '#eaf0ff';
  leftCol.appendChild(title);

  const info = document.createElement('div');
  info.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
  info.style.color = '#cfe1ff';
  info.style.fontSize = '12px';
  info.style.lineHeight = '1.6';
  info.innerHTML = `
    <b>Controls</b><br>
    ←→: Move / ↓: Soft Drop / Space: Hard Drop<br>
    Z: Rotate CCW / X: Rotate CW / ↑: 180° Rotate<br>
    C: Hold / P: Pause / R: Restart
  `;
  leftCol.appendChild(info);

  const scoreBox = document.createElement('div');
  scoreBox.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
  scoreBox.style.color = '#eaf0ff';
  scoreBox.style.fontSize = '14px';
  scoreBox.style.lineHeight = '1.8';
  scoreBox.style.minWidth = '180px';
  leftCol.appendChild(scoreBox);

  const holdCanvas = document.createElement('canvas');
  holdCanvas.width = CELL * 4;
  holdCanvas.height = CELL * 4;
  holdCanvas.style.background = 'rgba(0,0,0,.25)';
  holdCanvas.style.borderRadius = '12px';
  holdCanvas.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.08)';
  leftCol.appendChild(holdCanvas);
  const holdCtx = holdCanvas.getContext('2d');

  const nextCanvas = document.createElement('canvas');
  nextCanvas.width = CELL * 4;
  nextCanvas.height = CELL * (PREVIEW_COUNT * 2);
  nextCanvas.style.background = 'rgba(0,0,0,.25)';
  nextCanvas.style.borderRadius = '12px';
  nextCanvas.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.08)';
  rightCol.appendChild(nextCanvas);
  const nextCtx = nextCanvas.getContext('2d');

  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = VISIBLE_ROWS * CELL;
  canvas.style.background = '#0d1326';
  canvas.style.borderRadius = '12px';
  canvas.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.08), 0 10px 30px rgba(0,0,0,.35)';
  centerCol.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  root.appendChild(panel);
  document.body.appendChild(root);

  // ===== ユーティリティ =====
  const rnd = (n) => Math.floor(Math.random() * n);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 色（ピースごと）
  const COLORS = {
    I: '#26c6da',
    O: '#ffd54f',
    T: '#ba68c8',
    S: '#66bb6a',
    Z: '#ef5350',
    J: '#42a5f5',
    L: '#ff8a65',
    shadow: 'rgba(255,255,255,0.06)',
    grid: 'rgba(255,255,255,0.04)'
  };

  // テトリミノ形状（原点まわりの相対座標）
  const SHAPES = {
    I: [ [0,1],[1,1],[2,1],[3,1] ],
    O: [ [1,0],[2,0],[1,1],[2,1] ],
    T: [ [1,0],[0,1],[1,1],[2,1] ],
    S: [ [1,1],[2,1],[0,2],[1,2] ],
    Z: [ [0,1],[1,1],[1,2],[2,2] ],
    J: [ [0,0],[0,1],[1,1],[2,1] ],
    L: [ [2,0],[0,1],[1,1],[2,1] ],
  };

  const KICKS = {
    // 簡易SRS風キック
    I: [ [0,0],[ -1,0 ], [ 1,0 ], [ 0,-1 ], [ 0,1 ] ],
    O: [ [0,0] ],
    default: [ [0,0],[ -1,0 ], [ 1,0 ], [ 0,-1 ], [ 0,1 ] ]
  };

  // ===== 盤面 =====
  const emptyBoard = () => Array.from({length: ROWS}, () => Array(COLS).fill(null));

  // 7バッグ乱数
  class SevenBag {
    constructor(){ this.bag = []; }
    next(){
      if (this.bag.length === 0) {
        this.bag = ['I','O','T','S','Z','J','L'].sort(() => Math.random()-0.5);
      }
      return this.bag.pop();
    }
  }

  // ===== ピース =====
  function rotate(shape, dir){
    // dir: +1(時計回り) / -1(反時計) / 2(180°)
    const pts = shape.map(([x,y]) => [x,y]);
    if (dir === 2) return pts.map(([x,y])=>[3 - x, 3 - y]);
    if (dir === 1) return pts.map(([x,y])=>[3 - y, x]);
    if (dir === -1) return pts.map(([x,y])=>[y, 3 - x]);
    return pts;
  }

  function createPiece(type){
    return {
      type,
      cells: SHAPES[type].map(([x,y])=>[x,y]),
      x: 0,
      y: -2, // ちょい上から
      rot: 0,
      locked: false,
    };
  }

  // ===== ゲーム状態 =====
  const state = {
    board: emptyBoard(),
    bag: new SevenBag(),
    current: null,
    hold: null,
    canHold: true,
    queue: [],
    score: 0,
    lines: 0,
    level: 1,
    tickMs: TICK_START_MS,
    dropAccum: 0,
    lastFall: performance.now(),
    over: false,
    paused: false,
    lastLockTime: 0,
  };
  state.queue = Array.from({length: PREVIEW_COUNT}, () => state.bag.next());

  function spawn(){
    const nextType = state.queue.shift();
    state.queue.push(state.bag.next());
    const p = createPiece(nextType);
    // 初期位置（中央）
    p.x = Math.floor((COLS - 4)/2);
    p.y = -2;
    state.current = p;
    state.canHold = true;
    if (collides(p)) {
      state.over = true;
    }
  }

  function hardDropY(piece){
    let y = piece.y;
    while(!collides({ ...piece, y: y+1 })) y++;
    return y;
  }

  function collides(piece){
    for (const [dx,dy] of piece.cells){
      const x = piece.x + dx;
      const y = piece.y + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && state.board[y][x]) return true;
    }
    return false;
  }

  function move(dx, dy){
    if (!state.current || state.over || state.paused) return false;
    const p = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
    if (!collides(p)) { state.current = p; return true; }
    return false;
  }

  function tryRotate(dir){
    if (!state.current || state.over || state.paused) return;
    const type = state.current.type;
    const kicks = (KICKS[type] || KICKS.default);
    const rotated = { ...state.current, cells: rotate(state.current.cells, dir) };
    for (const [kx,ky] of kicks){
      const test = { ...rotated, x: state.current.x + kx, y: state.current.y + ky };
      if (!collides(test)) { state.current = test; return; }
    }
  }

  function lock(){
    const p = state.current;
    for (const [dx,dy] of p.cells){
      const x = p.x + dx;
      const y = p.y + dy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) state.board[y][x] = p.type;
    }
    clearLines();
    spawn();
  }

  function clearLines(){
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--){
      if (state.board[y].every(c => c)){
        state.board.splice(y,1);
        state.board.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0){
      state.lines += cleared;
      let add = 0;
      if (cleared === 1) add = SCORE_TABLE.single;
      if (cleared === 2) add = SCORE_TABLE.double;
      if (cleared === 3) add = SCORE_TABLE.triple;
      if (cleared === 4) add = SCORE_TABLE.tetris;
      state.score += add * state.level;
      const newLevel = 1 + Math.floor(state.lines / 10);
      if (newLevel !== state.level){
        state.level = newLevel;
        state.tickMs = Math.max(TICK_START_MS - (state.level-1) * 60, TICK_MIN_MS);
      }
    }
  }

  function hold(){
    if (!state.canHold || !state.current) return;
    const cur = state.current.type;
    if (state.hold){
      const temp = state.hold;
      state.hold = cur;
      const p = createPiece(temp);
      p.x = Math.floor((COLS - 4)/2);
      p.y = -2;
      state.current = p;
    } else {
      state.hold = cur;
      spawn();
    }
    state.canHold = false;
  }

  function reset(){
    state.board = emptyBoard();
    state.bag = new SevenBag();
    state.queue = Array.from({length: PREVIEW_COUNT}, () => state.bag.next());
    state.current = null;
    state.hold = null;
    state.canHold = true;
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.tickMs = TICK_START_MS;
    state.dropAccum = 0;
    state.lastFall = performance.now();
    state.over = false;
    state.paused = false;
    spawn();
  }

  // ===== 入力 =====
  const keys = new Set();
  let dasTimer = null; // 連続移動用
  function startDAS(dir){
    stopDAS();
    dasTimer = setInterval(()=> move(dir,0), 35);
  }
  function stopDAS(){
    if (dasTimer) clearInterval(dasTimer); dasTimer = null;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // 自前DASを使う
    if (state.over) {
      if (e.key.toLowerCase() === 'r') reset();
      return;
    }
    if (e.key.toLowerCase() === 'p') { state.paused = !state.paused; return; }
    if (state.paused) return;

    switch(e.key){
      case 'ArrowLeft': move(-1,0); startDAS(-1); break;
      case 'ArrowRight': move(1,0); startDAS(1); break;
      case 'ArrowDown': if (move(0,1)) state.score += SCORE_TABLE.softDrop; break;
      case ' ': {
        e.preventDefault();
        const targetY = hardDropY(state.current);
        state.score += (targetY - state.current.y) * SCORE_TABLE.hardDrop;
        state.current.y = targetY;
        lock();
        break;
      }
      case 'z': case 'Z': tryRotate(-1); break;
      case 'x': case 'X': tryRotate(1); break;
      case 'ArrowUp': tryRotate(2); break;
      case 'c': case 'C': hold(); break;
      case 'r': case 'R': reset(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') stopDAS();
  });

  // ===== 描画 =====
  function drawCell(g, x, y, color, alpha=1){
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(x*CELL, y*CELL, CELL, CELL);
    // 立体風グロス
    g.globalAlpha = alpha * 0.35;
    g.fillStyle = 'white';
    g.fillRect(x*CELL, y*CELL, CELL, 4);
    g.globalAlpha = alpha * 0.15;
    g.fillStyle = 'black';
    g.fillRect(x*CELL, y*CELL+CELL-4, CELL, 4);
    g.restore();
  }

  function drawGrid(){
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x=0;x<=COLS;x++){
      ctx.beginPath();
      ctx.moveTo(x*CELL + 0.5, 0);
      ctx.lineTo(x*CELL + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y=0;y<=VISIBLE_ROWS;y++){
      ctx.beginPath();
      ctx.moveTo(0, y*CELL + 0.5);
      ctx.lineTo(canvas.width, y*CELL + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // 盤面
    for (let y=0;y<ROWS;y++){
      for (let x=0;x<COLS;x++){
        const t = state.board[y][x];
        if (t && y < VISIBLE_ROWS){
          drawCell(ctx, x, y, COLORS[t]);
        }
      }
    }

    if (state.current){
      // ゴースト
      const gY = hardDropY(state.current);
      for (const [dx,dy] of state.current.cells){
        const x = state.current.x + dx;
        const y = gY + dy;
        if (y >= 0 && y < VISIBLE_ROWS) drawCell(ctx, x, y, COLORS[state.current.type], GHOST_ALPHA);
      }
      // 現在ピース
      for (const [dx,dy] of state.current.cells){
        const x = state.current.x + dx;
        const y = state.current.y + dy;
        if (y >= 0 && y < VISIBLE_ROWS) drawCell(ctx, x, y, COLORS[state.current.type]);
      }
    }

    drawGrid();

    if (state.over){
      overlayText('GAME OVER\nR: Restart');
    } else if (state.paused){
      overlayText('PAUSED');
    }
  }

  function overlayText(text){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, canvas.height/2 - 60, canvas.width, 120);
    ctx.fillStyle = '#eaf0ff';
    ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line,i)=>{
      ctx.fillText(line, canvas.width/2, canvas.height/2 + i*32);
    });
    ctx.restore();
  }

  function drawMini(g, type, ox=0, oy=0){
    if (!type) return;
    const cells = SHAPES[type];
    // 中心に寄せる
    const xs = cells.map(c=>c[0]);
    const ys = cells.map(c=>c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = (maxX - minX + 1);
    const h = (maxY - minY + 1);
    const offsetX = Math.floor((4 - w)/2) - minX;
    const offsetY = Math.floor((4 - h)/2) - minY;
    for (const [dx,dy] of cells){
      drawCell(g, ox + dx + offsetX, oy + dy + offsetY, COLORS[type]);
    }
  }

  function drawHold(){
    holdCtx.clearRect(0,0,holdCanvas.width, holdCanvas.height);
    drawMini(holdCtx, state.hold, 0, 0);
    holdCtx.save();
    holdCtx.fillStyle = '#cfe1ff';
    holdCtx.font = 'bold 14px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
    holdCtx.fillText('HOLD', 8, 18);
    holdCtx.restore();
  }

  function drawNext(){
    nextCtx.clearRect(0,0,nextCanvas.width, nextCanvas.height);
    nextCtx.save();
    nextCtx.fillStyle = '#cfe1ff';
    nextCtx.font = 'bold 14px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif';
    nextCtx.fillText('NEXT', 8, 18);
    nextCtx.restore();
    for (let i=0;i<state.queue.length;i++){
      const y = 1 + i * 2; // 2行おきに
      drawMini(nextCtx, state.queue[i], 0, y);
    }
  }

  function drawScore(){
    scoreBox.innerHTML = `
      <div style="font-size:12px; letter-spacing:.2px; opacity:.8">LEVEL</div>
      <div style="font-size:22px; font-weight:800">${state.level}</div>
      <div style="font-size:12px; margin-top:8px; opacity:.8">LINES</div>
      <div style="font-size:20px; font-weight:700">${state.lines}</div>
      <div style="font-size:12px; margin-top:8px; opacity:.8">SCORE</div>
      <div style="font-size:24px; font-weight:800">${state.score.toLocaleString()}</div>
    `;
  }

  // ===== ループ =====
  function update(now){
    if (state.over || state.paused) return;
    const dt = now - state.lastFall;
    if (dt >= state.tickMs){
      state.lastFall = now;
      if (!move(0,1)){
        if (!state.lastLockTime) state.lastLockTime = now;
        // ロック遅延
        if (now - state.lastLockTime >= LOCK_DELAY_MS) {
          lock();
          state.lastLockTime = 0;
        }
      } else {
        state.lastLockTime = 0; // 移動できたら遅延リセット
      }
    }
  }

  function loop(now){
    update(now);
    drawBoard();
    drawHold();
    drawNext();
    drawScore();
    requestAnimationFrame(loop);
  }

  // ===== 公開API（必要なら） =====
  window.TetrisGame = {
    reset,
    pause: () => state.paused = true,
    resume: () => state.paused = false,
    getState: () => clone(state),
    destroy: () => { try { document.body.removeChild(root); } catch(_){} }
  };

  // ===== 起動 =====
  reset();
  requestAnimationFrame(loop);
})();
