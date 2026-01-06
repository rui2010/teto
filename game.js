window.startPhaserGame = function(selectedSkin) {
  const BOARD_WIDTH = 10;
  const BOARD_HEIGHT = 20;
  const CELL_SIZE = 30;

  const skins = {
    classic: {
      colors: {
        I: 0x00ffff, O: 0xffff00, T: 0xaa00ff,
        S: 0x00ff00, Z: 0xff0000, J: 0x0000ff, L: 0xffa500
      },
      bg: 0x000000
    },
    neon: {
      colors: {
        I: 0x00eaff, O: 0xfff200, T: 0xff00f2,
        S: 0x00ff91, Z: 0xff003c, J: 0x0066ff, L: 0xff8900
      },
      bg: 0x111111
    },
    pastel: {
      colors: {
        I: 0xa8e6cf, O: 0xfff3b0, T: 0xffd6e0,
        S: 0xaff8db, Z: 0xffaaa5, J: 0xa0c4ff, L: 0xffd6a5
      },
      bg: 0xf8f9fa
    }
  };

  const skin = skins[selectedSkin] || skins.classic;

  let score = 0;
  let linesCleared = 0;
  let holdPiece = null;
  let holdUsed = false;
  let nextQueue = [];
  const queueSize = 5;

  const shapes = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
  };

  let game;

  const config = {
    type: Phaser.AUTO,
    width: BOARD_WIDTH * CELL_SIZE + 280,
    height: BOARD_HEIGHT * CELL_SIZE + 100,
    backgroundColor: skin.bg,
    parent: 'phaser-game',
    scene: {
      preload: preload,
      create: create,
      update: update
    }
  };

  game = new Phaser.Game(config);

  function preload() {}

  function create() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
    
    // グリッド背景
    this.gridGraphics = this.add.graphics();
    drawGridBackground.call(this);
    
    this.graphics = this.add.graphics();
    
    // 背景パネル描画
    const panelGraphics = this.add.graphics();
    panelGraphics.fillStyle(skin.bg === 0x000000 ? 0x1a1a1a : 0xeeeeee, 0.8);
    panelGraphics.fillRoundedRect(BOARD_WIDTH * CELL_SIZE + 5, 5, 270, BOARD_HEIGHT * CELL_SIZE - 10, 10);
    
    this.currentPiece = createPiece();
    for (let i = 0; i < queueSize; i++) nextQueue.push(randomPiece());
    
    // ネクスト表示
    this.nextTitle = this.add.text(BOARD_WIDTH * CELL_SIZE + 20, 15, 'NEXT', { 
      fontSize: '18px', 
      fontStyle: 'bold',
      color: skin.bg === 0x000000 ? '#00bcd4' : '#0066cc'
    });
    
    // ホールド表示
    this.holdTitle = this.add.text(BOARD_WIDTH * CELL_SIZE + 20, BOARD_HEIGHT * CELL_SIZE - 100, 'HOLD', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: skin.bg === 0x000000 ? '#ff6600' : '#cc3300'
    });
    
    this.input.keyboard.on('keydown', handleInput, this);
    this.dropTime = 1000;
    this.lastDrop = 0;
    this.gameOver = false;
    this.ghostPieceColor = skin.bg === 0x000000 ? 0x444444 : 0xcccccc;
  }

  function update(time) {
    if (this.gameOver) return;
    if (time > this.lastDrop + this.dropTime) {
      moveDown.call(this);
      this.lastDrop = time;
    }
    drawBoard.call(this);
    drawGhostPiece.call(this);
    drawPiece.call(this, this.currentPiece);
    drawNextQueue.call(this);
    drawHoldPiece.call(this);
  }

  function handleInput(event) {
    if (this.gameOver) return;
    switch (event.code) {
      case 'ArrowLeft': moveHorizontal.call(this, -1); break;
      case 'ArrowRight': moveHorizontal.call(this, 1); break;
      case 'ArrowDown': moveDown.call(this); break;
      case 'ArrowUp': rotatePiece.call(this); break;
      case 'Space': hardDrop.call(this); break;
      case 'ShiftLeft': hold.call(this); break;
    }
  }

  function createPiece() {
    const type = nextQueue.shift() || randomPiece();
    nextQueue.push(randomPiece());
    const matrix = shapes[type];
    return { type, matrix, x: 3, y: 0 };
  }

  function randomPiece() {
    return Object.keys(shapes)[Math.floor(Math.random() * 7)];
  }

  function moveHorizontal(dir) {
    this.currentPiece.x += dir;
    if (collides.call(this)) this.currentPiece.x -= dir;
  }

  function moveDown() {
    this.currentPiece.y++;
    if (collides.call(this)) {
      this.currentPiece.y--;
      mergePiece.call(this);
      clearLines.call(this);
      spawnPiece.call(this);
    }
  }

  function hardDrop() {
    while (!collides.call(this)) {
      this.currentPiece.y++;
    }
    this.currentPiece.y--;
    mergePiece.call(this);
    addParticles.call(this);
    clearLines.call(this);
    spawnPiece.call(this);
  }

  function rotatePiece() {
    const piece = this.currentPiece;
    const rotated = piece.matrix[0].map((_, i) => piece.matrix.map(row => row[i])).reverse();
    const oldMatrix = piece.matrix;
    piece.matrix = rotated;
    if (collides.call(this)) piece.matrix = oldMatrix;
  }

  function hold() {
    if (holdUsed) return;
    if (!holdPiece) {
      holdPiece = this.currentPiece.type;
      this.currentPiece = createPiece();
    } else {
      const temp = holdPiece;
      holdPiece = this.currentPiece.type;
      this.currentPiece = { type: temp, matrix: shapes[temp], x: 3, y: 0 };
    }
    holdUsed = true;
    document.getElementById('hold-text').textContent = holdPiece;
  }

  function collides() {
    const { x, y, matrix } = this.currentPiece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] && (
          x + c < 0 || x + c >= BOARD_WIDTH || y + r >= BOARD_HEIGHT || this.board[y + r]?.[x + c]
        )) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    const { x, y, matrix, type } = this.currentPiece;
    matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) this.board[y + r][x + c] = type;
      });
    });
    holdUsed = false;
  }

  function clearLines() {
    let cleared = 0;
    for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell)) {
        this.board.splice(r, 1);
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      linesCleared += cleared;
      score += cleared * 100;
      document.getElementById('score').textContent = score;
      document.getElementById('lines').textContent = linesCleared;
    }
  }

  function spawnPiece() {
    this.currentPiece = createPiece();
    if (collides.call(this)) {
      this.gameOver = true;
      triggerGameOverAnimation.call(this);
    }
  }

  function triggerGameOverAnimation() {
    // ゲーム画面を落下させるアニメーション
    const canvas = this.sys.game.canvas;
    const container = canvas.parentElement;
    
    // ゲームオーバーテキストを表示
    const gameOverText = this.add.text(
      BOARD_WIDTH * CELL_SIZE / 2, 
      BOARD_HEIGHT * CELL_SIZE / 2,
      'GAME OVER',
      { 
        fontSize: '48px', 
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 4
      }
    ).setOrigin(0.5);
    
    // テキストを点滅させる
    this.tweens.add({
      targets: gameOverText,
      alpha: 0,
      duration: 300,
      yoyo: true,
      repeat: 3
    });
    
    // カメラを振動させる
    this.cameras.main.shake(500, 0.01);
    
    // 画面全体を落下させる
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: BOARD_HEIGHT * CELL_SIZE * 2,
      duration: 1500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.scene.pause();
        setTimeout(() => {
          if (confirm('ゲームオーバー！もう一度プレイしますか？')) {
            location.reload();
          }
        }, 100);
      }
    });
  }

  function drawBoard() {
    this.graphics.clear();
    
    // グリッド線を描画
    this.graphics.lineStyle(1, skin.bg === 0x000000 ? 0x333333 : 0xdddddd, 0.5);
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      this.graphics.lineBetween(0, r * CELL_SIZE, BOARD_WIDTH * CELL_SIZE, r * CELL_SIZE);
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      this.graphics.lineBetween(c * CELL_SIZE, 0, c * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
    }
    
    // ブロックを描画
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (this.board[r][c]) {
          const color = skin.colors[this.board[r][c]];
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
          
          // 3Dっぽいハイライト
          this.graphics.fillStyle(0xffffff, 0.3);
          this.graphics.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 4, 3);
          
          // 暗い影
          this.graphics.fillStyle(0x000000, 0.2);
          this.graphics.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + CELL_SIZE - 4, CELL_SIZE - 4, 3);
        }
      }
    }
  }

  function drawGridBackground() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(2, skin.bg === 0x000000 ? 0x00bcd4 : 0x0066cc, 0.3);
    
    // ボード外枠
    this.gridGraphics.strokeRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
  }

  function drawPiece(piece) {
    piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          const color = skin.colors[piece.type];
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect((piece.x + c) * CELL_SIZE, (piece.y + r) * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
          
          // 3Dっぽいハイライト
          this.graphics.fillStyle(0xffffff, 0.4);
          this.graphics.fillRect((piece.x + c) * CELL_SIZE + 1, (piece.y + r) * CELL_SIZE + 1, CELL_SIZE - 4, 3);
          
          // 暗い影
          this.graphics.fillStyle(0x000000, 0.3);
          this.graphics.fillRect((piece.x + c) * CELL_SIZE + 1, (piece.y + r) * CELL_SIZE + CELL_SIZE - 4, CELL_SIZE - 4, 3);
        }
      });
    });
  }

  function drawGhostPiece() {
    const piece = this.currentPiece;
    let ghostPiece = { ...piece };
    while (!collides.call(Object.assign(this, { currentPiece: ghostPiece }))) {
      ghostPiece.y++;
    }
    ghostPiece.y--;
    
    piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          this.graphics.fillStyle(this.ghostPieceColor, 0.3);
          this.graphics.fillRect((ghostPiece.x + c) * CELL_SIZE, (ghostPiece.y + r) * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
          
          // ゴーストピースの枠線
          this.graphics.lineStyle(2, this.ghostPieceColor, 0.5);
          this.graphics.strokeRect((ghostPiece.x + c) * CELL_SIZE, (ghostPiece.y + r) * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      });
    });
  }

  function drawNextQueue() {
    let yOffset = 50;
    const startX = BOARD_WIDTH * CELL_SIZE + 20;
    
    for (let i = 0; i < nextQueue.length; i++) {
      const type = nextQueue[i];
      const matrix = shapes[type];
      const color = skin.colors[type];
      
      // 背景パネル
      const panelHeight = matrix.length * 15 + 10;
      this.graphics.fillStyle(skin.bg === 0x000000 ? 0x222222 : 0xf0f0f0, 0.5);
      this.graphics.fillRoundedRect(startX - 5, yOffset - 5, 85, panelHeight + 10, 3);
      
      // ネクストピース表示
      matrix.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) {
            this.graphics.fillStyle(color, 1);
            this.graphics.fillRect(startX + c * 15 + 5, yOffset + r * 15, 14, 14);
            
            // ハイライト
            this.graphics.fillStyle(0xffffff, 0.3);
            this.graphics.fillRect(startX + c * 15 + 6, yOffset + r * 15 + 1, 5, 2);
          }
        });
      });
      
      yOffset += panelHeight + 5;
    }
  }

  function drawHoldPiece() {
    if (!holdPiece) {
      const startX = BOARD_WIDTH * CELL_SIZE + 20;
      const startY = BOARD_HEIGHT * CELL_SIZE - 85;
      
      this.graphics.fillStyle(skin.bg === 0x000000 ? 0x222222 : 0xf0f0f0, 0.5);
      this.graphics.fillRoundedRect(startX - 5, startY - 5, 85, 80, 3);
      
      const textColor = skin.bg === 0x000000 ? 0xcccccc : 0x666666;
      this.graphics.fillStyle(textColor, 0.3);
      
      // 枠線
      this.graphics.lineStyle(1, textColor, 0.5);
      this.graphics.strokeRoundedRect(startX - 5, startY - 5, 85, 80, 3);
      return;
    }
    
    const matrix = shapes[holdPiece];
    const color = skin.colors[holdPiece];
    const startX = BOARD_WIDTH * CELL_SIZE + 20;
    const startY = BOARD_HEIGHT * CELL_SIZE - 85;
    
    // 背景パネル
    this.graphics.fillStyle(skin.bg === 0x000000 ? 0x222222 : 0xf0f0f0, 0.5);
    this.graphics.fillRoundedRect(startX - 5, startY - 5, 85, 80, 3);
    
    // ホールドピース表示
    matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect(startX + c * 15 + 5, startY + r * 15 + 10, 14, 14);
          
          // ハイライト
          this.graphics.fillStyle(0xffffff, 0.3);
          this.graphics.fillRect(startX + c * 15 + 6, startY + r * 15 + 11, 5, 2);
        }
      });
    });
  }

  function addParticles() {
    const emitter = this.add.particles(0, 0, 'spark', {
      x: (this.currentPiece.x + 1) * CELL_SIZE,
      y: (this.currentPiece.y + 1) * CELL_SIZE,
      speed: 100,
      lifespan: 500,
      quantity: 10
    });
    setTimeout(() => emitter.stop(), 200);
  }
};
