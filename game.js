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
    width: BOARD_WIDTH * CELL_SIZE + 200,
    height: BOARD_HEIGHT * CELL_SIZE,
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
    this.graphics = this.add.graphics();
    this.currentPiece = createPiece();
    for (let i = 0; i < queueSize; i++) nextQueue.push(randomPiece());
    this.nextText = this.add.text(BOARD_WIDTH * CELL_SIZE + 10, 10, 'NEXT:', { fontSize: '20px', color: '#fff' });
    this.input.keyboard.on('keydown', handleInput, this);
    this.dropTime = 1000;
    this.lastDrop = 0;
    this.gameOver = false;
  }

  function update(time) {
    if (this.gameOver) return;
    if (time > this.lastDrop + this.dropTime) {
      moveDown.call(this);
      this.lastDrop = time;
    }
    drawBoard.call(this);
    drawPiece.call(this, this.currentPiece);
    drawNextQueue.call(this);
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
    document.getElementById('hold').innerHTML = 'HOLD: ' + holdPiece;
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
      alert('GAME OVER');
      this.scene.pause();
    }
  }

  function drawBoard() {
    this.graphics.clear();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (this.board[r][c]) {
          this.graphics.fillStyle(skin.colors[this.board[r][c]], 1);
          this.graphics.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  }

  function drawPiece(piece) {
    piece.matrix.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          this.graphics.fillStyle(skin.colors[piece.type], 1);
          this.graphics.fillRect((piece.x + c) * CELL_SIZE, (piece.y + r) * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      });
    });
  }

  function drawNextQueue() {
    let yOffset = 40;
    for (let i = 0; i < nextQueue.length; i++) {
      const type = nextQueue[i];
      const matrix = shapes[type];
      let xBase = BOARD_WIDTH * CELL_SIZE + 20;
      matrix.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) {
            this.graphics.fillStyle(skin.colors[type], 1);
            this.graphics.fillRect(xBase + c * 15, yOffset + r * 15, 14, 14);
          }
        });
      });
      yOffset += matrix.length * 15 + 10;
    }
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
