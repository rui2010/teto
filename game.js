window.startPhaserGame = function(selectedSkin) {
  const skins = {
    classic: {
      backgroundColor: '#111',
      colors: ['#00f', '#0f0', '#f00', '#ff0', '#0ff', '#f0f', '#fff'],
      shadow: false
    },
    modern: {
      backgroundColor: '#222',
      colors: ['#4fc3f7', '#81c784', '#e57373', '#fff176', '#80deea', '#ba68c8', '#ffffff'],
      shadow: true
    }
  };

  const skin = skins[selectedSkin] || skins.classic;

  const config = {
    type: Phaser.AUTO,
    width: 320,
    height: 640,
    parent: 'game-container',
    backgroundColor: skin.backgroundColor,
    scene: {
      preload,
      create,
      update
    }
  };

  const game = new Phaser.Game(config);

  let board = [];
  const ROWS = 20, COLS = 10, BLOCK_SIZE = 32;
  let currentPiece, nextPieces = [], holdPiece = null, canHold = true;
  let score = 0, lines = 0;
  let cursors, dropTime = 0, dropInterval = 500;

  function preload() {}

  function create() {
    this.cameras.main.setBackgroundColor(skin.backgroundColor);
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-H', holdPieceHandler);

    initBoard();
    for (let i = 0; i < 5; i++) nextPieces.push(randomPiece());
    spawnPiece();

    this.scoreText = this.add.text(320, 10, 'SCORE: 0\nLINES: 0', { fontSize: '20px', fill: '#fff' });

    // 背景装飾（モダンなら軽いエフェクト）
    if (skin.shadow) {
      this.add.text(40, 600, 'MODERN MODE', { fontSize: '18px', fill: '#888' });
    }
  }

  function update(time) {
    if (time > dropTime + dropInterval) {
      dropPiece();
      dropTime = time;
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
      hardDrop();
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
      movePiece(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
      movePiece(1);
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.down)) {
      dropPiece();
    }
  }

  function initBoard() {
    for (let r = 0; r < ROWS; r++) {
      board[r] = new Array(COLS).fill(null);
    }
  }

  function randomPiece() {
    const shapes = [
      [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]]
    ];
    const index = Math.floor(Math.random() * shapes.length);
    return { shape: shapes[index], color: skin.colors[index] };
  }

  function spawnPiece() {
    currentPiece = nextPieces.shift();
    currentPiece.x = 3;
    currentPiece.y = 0;
    nextPieces.push(randomPiece());
    canHold = true;
  }

  function drawPiece(piece, ctx, offsetX = 0, offsetY = 0) {
    piece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          const x = (piece.x + c + offsetX) * BLOCK_SIZE;
          const y = (piece.y + r + offsetY) * BLOCK_SIZE;
          ctx.fillStyle = piece.color;
          ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          if (skin.shadow) {
            ctx.strokeStyle = '#333';
            ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
          }
        }
      });
    });
  }

  function movePiece(dir) {
    currentPiece.x += dir;
    if (collide()) {
      currentPiece.x -= dir;
    }
  }

  function dropPiece() {
    currentPiece.y++;
    if (collide()) {
      currentPiece.y--;
      lockPiece();
      clearLines();
      spawnPiece();
      if (collide()) {
        gameOver();
      }
    }
  }

  function hardDrop() {
    while (!collide()) {
      currentPiece.y++;
    }
    currentPiece.y--;
    lockPiece();
    clearLines();
    spawnPiece();
    if (collide()) gameOver();
  }

  function holdPieceHandler() {
    if (!canHold) return;
    if (!holdPiece) {
      holdPiece = currentPiece;
      spawnPiece();
    } else {
      [holdPiece, currentPiece] = [currentPiece, holdPiece];
      currentPiece.x = 3;
      currentPiece.y = 0;
    }
    canHold = false;
  }

  function collide() {
    return currentPiece.shape.some((row, r) => {
      return row.some((val, c) => {
        if (val) {
          let y = currentPiece.y + r;
          let x = currentPiece.x + c;
          return y >= ROWS || x < 0 || x >= COLS || board[y][x];
        }
        return false;
      });
    });
  }

  function lockPiece() {
    currentPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          board[currentPiece.y + r][currentPiece.x + c] = currentPiece.color;
        }
      });
    });
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(cell => cell)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
      }
    }
    if (cleared > 0) {
      score += cleared * 100;
      lines += cleared;
      game.scene.scenes[0].scoreText.setText(`SCORE: ${score}\nLINES: ${lines}`);
    }
  }

  function gameOver() {
    game.scene.scenes[0].add.text(40, 300, 'GAME OVER', { fontSize: '32px', fill: '#ff3333' });
    game.scene.pause();
  }
};
