const CELL_SIZE = 32;
const FIELD_WIDTH = 10;
const FIELD_HEIGHT = 20;

class MainScene extends Phaser.Scene {
  constructor(mode = 'puyo') {
    super('MainScene');
    this.field = [];
    this.currentPiece = null;
    this.pieceType = mode; // 初期モードを選択
    this.graphics = null;
    this.dropTimer = 0; // 追加: 落下タイマー
    this.dropInterval = 2000; // 追加: 落下間隔（ミリ秒、遅くしたい場合は値を大きく）
  }

  preload() {
    // ...existing code...
  }

  create() {
    // フィールド初期化
    for (let y = 0; y < FIELD_HEIGHT; y++) {
      this.field[y] = [];
      for (let x = 0; x < FIELD_WIDTH; x++) {
        this.field[y][x] = 0;
      }
    }
    // 最初のピース生成
    this.spawnPiece();

    // 描画用graphics初期化
    this.graphics = this.add.graphics();

    // キーボード入力
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown', this.handleInput, this);
  }

  spawnPiece() {
    if (this.pieceType === 'tetris') {
      // テトリスブロック（I型のみ簡易実装）
      this.currentPiece = {
        shape: [[1,1,1,1]],
        x: 3,
        y: 0,
        color: 0x00ffff
      };
      this.pieceType = 'puyo';
    } else {
      // ぷよぷよ（2連ぷよのみ簡易実装）
      this.currentPiece = {
        shape: [[2],[2]],
        x: 4,
        y: 0,
        color: 0xff0000
      };
      this.pieceType = 'tetris';
    }
  }

  handleInput(event) {
    if (!this.currentPiece) return;
    if (event.code === 'ArrowLeft') this.movePiece(-1, 0);
    if (event.code === 'ArrowRight') this.movePiece(1, 0);
    if (event.code === 'ArrowDown') this.movePiece(0, 1);
    if (event.code === 'Space') this.rotatePiece();
  }

  movePiece(dx, dy) {
    const { shape, x, y } = this.currentPiece;
    if (this.canMove(x + dx, y + dy, shape)) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;
    }
  }

  rotatePiece() {
    // 簡易回転（90度）
    const { shape, x, y } = this.currentPiece;
    const rotated = shape[0].map((_, i) => shape.map(row => row[i])).reverse();
    if (this.canMove(x, y, rotated)) {
      this.currentPiece.shape = rotated;
    }
  }

  canMove(nx, ny, shape) {
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx]) {
          const fx = nx + sx;
          const fy = ny + sy;
          if (fx < 0 || fx >= FIELD_WIDTH || fy >= FIELD_HEIGHT) return false;
          if (fy >= 0 && this.field[fy][fx]) return false;
        }
      }
    }
    return true;
  }

  placePiece() {
    const { shape, x, y, color } = this.currentPiece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx]) {
          const fx = x + sx;
          const fy = y + sy;
          if (fy >= 0 && fy < FIELD_HEIGHT && fx >= 0 && fx < FIELD_WIDTH) {
            this.field[fy][fx] = color;
          }
        }
      }
    }
    this.currentPiece = null;
    this.spawnPiece();
  }

  update(time, delta) {
    // ピース落下（タイマー制御）
    if (this.currentPiece) {
      this.dropTimer += delta;
      if (this.dropTimer >= this.dropInterval) {
        if (this.canMove(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
          this.currentPiece.y += 1;
        } else {
          this.placePiece();
        }
        this.dropTimer = 0;
      }
    }

    // 描画
    this.drawField();
    this.drawPiece();
  }

  drawField() {
    this.graphics.clear();
    for (let y = 0; y < FIELD_HEIGHT; y++) {
      for (let x = 0; x < FIELD_WIDTH; x++) {
        if (this.field[y][x]) {
          this.graphics.fillStyle(this.field[y][x], 1);
          this.graphics.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }

  drawPiece() {
    if (!this.currentPiece) return;
    const { shape, x, y, color } = this.currentPiece;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy].length; sx++) {
        if (shape[sy][sx]) {
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect((x + sx) * CELL_SIZE, (y + sy) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: FIELD_WIDTH * CELL_SIZE,
  height: FIELD_HEIGHT * CELL_SIZE,
  backgroundColor: '#222',
  scene: null, // 後でセット
  parent: 'game-container'
};

window.startPhaserGame = (mode = 'puyo') => {
  if (!window._phaserGame) {
    config.scene = new MainScene(mode);
    window._phaserGame = new Phaser.Game(config);
  }
};