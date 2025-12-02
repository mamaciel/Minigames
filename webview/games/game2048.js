// ========== 2048 GAME ==========
class Game2048 {
    constructor() {
        this.gridSize = 4;
        this.cellSize = 0;
        this.grid = [];
        this.animationId = null;
        this.moved = false;
    }

    init() {
        const size = Math.min(getCanvasWidth(), getCanvasHeight()) - 20;
        this.cellSize = size / this.gridSize;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.addRandomTile();
        this.addRandomTile();
        this.draw();
    }

    cleanup() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    reset() {
        this.cleanup();
        gameState.score = 0;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        pauseOverlay.classList.remove('show');
        gameOverOverlay.classList.remove('show');
        updateScore();
        this.init();
    }

    handleKey(e) {
        if (gameState.isPaused || gameState.isGameOver) return;

        const key = e.key || e.code;
        this.moved = false;

        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            this.moveUp();
            e.preventDefault();
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            this.moveDown();
            e.preventDefault();
        } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            this.moveLeft();
            e.preventDefault();
        } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            this.moveRight();
            e.preventDefault();
        }

        if (this.moved) {
            this.addRandomTile();
            this.draw();
            if (!this.canMove()) {
                gameState.isGameOver = true;
                const finalScore = gameState.score;
                reportHighScore('2048', finalScore);
                finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, '2048');
                gameOverOverlay.classList.add('show');
            }
        }
    }

    addRandomTile() {
        const empty = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] === 0) empty.push({ r, c });
            }
        }
        if (empty.length === 0) return;

        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }

    compressRow(row) {
        const newRow = row.filter(v => v !== 0);
        while (newRow.length < this.gridSize) newRow.push(0);
        return newRow;
    }

    mergeRow(row) {
        for (let i = 0; i < this.gridSize - 1; i++) {
            if (row[i] !== 0 && row[i] === row[i + 1]) {
                row[i] *= 2;
                row[i + 1] = 0;
                gameState.score += row[i];
                this.moved = true;
            }
        }
        return this.compressRow(row);
    }

    moveLeft() {
        for (let r = 0; r < this.gridSize; r++) {
            const compressed = this.compressRow(this.grid[r]);
            const merged = this.mergeRow(compressed);
            if (!this.arraysEqual(this.grid[r], merged)) {
                this.grid[r] = merged;
                this.moved = true;
            }
        }
    }

    moveRight() {
        for (let r = 0; r < this.gridSize; r++) {
            const reversed = [...this.grid[r]].reverse();
            const compressed = this.compressRow(reversed);
            const merged = this.mergeRow(compressed);
            const restored = merged.reverse();
            if (!this.arraysEqual(this.grid[r], restored)) {
                this.grid[r] = restored;
                this.moved = true;
            }
        }
    }

    moveUp() {
        for (let c = 0; c < this.gridSize; c++) {
            const col = [];
            for (let r = 0; r < this.gridSize; r++) col.push(this.grid[r][c]);
            const compressed = this.compressRow(col);
            const merged = this.mergeRow(compressed);
            for (let r = 0; r < this.gridSize; r++) {
                if (this.grid[r][c] !== merged[r]) {
                    this.grid[r][c] = merged[r];
                    this.moved = true;
                }
            }
        }
    }

    moveDown() {
        for (let c = 0; c < this.gridSize; c++) {
            const col = [];
            for (let r = this.gridSize - 1; r >= 0; r--) col.push(this.grid[r][c]);
            const compressed = this.compressRow(col);
            const merged = this.mergeRow(compressed);
            for (let r = this.gridSize - 1, i = 0; r >= 0; r--, i++) {
                if (this.grid[r][c] !== merged[i]) {
                    this.grid[r][c] = merged[i];
                    this.moved = true;
                }
            }
        }
    }

    canMove() {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] === 0) return true;
                if (c < this.gridSize - 1 && this.grid[r][c] === this.grid[r][c + 1]) return true;
                if (r < this.gridSize - 1 && this.grid[r][c] === this.grid[r + 1][c]) return true;
            }
        }
        return false;
    }

    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    getTileColor(value) {
        const colors = {
            0: '#2d333b',
            2: '#373e47',
            4: '#444c56',
            8: '#57ab5a',
            16: '#46954a',
            32: '#347d39',
            64: '#6cb6ff',
            128: '#539bf5',
            256: '#4184e4',
            512: '#316dca',
            1024: '#255ab2',
            2048: '#1b4b91',
            4096: '#f85149',
            8192: '#da3633'
        };
        return colors[value] || '#768390';
    }

    draw() {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

        const offsetX = (getCanvasWidth() - this.cellSize * this.gridSize) / 2;
        const offsetY = (getCanvasHeight() - this.cellSize * this.gridSize) / 2;
        const padding = 4;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const x = offsetX + c * this.cellSize;
                const y = offsetY + r * this.cellSize;
                const value = this.grid[r][c];

                // Draw tile background
                ctx.fillStyle = this.getTileColor(value);
                ctx.fillRect(x + padding, y + padding, this.cellSize - padding * 2, this.cellSize - padding * 2);

                // Draw value
                if (value > 0) {
                    ctx.fillStyle = value <= 4 ? '#adbac7' : '#ffffff';
                    ctx.font = `bold ${this.cellSize * 0.35}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(value, x + this.cellSize / 2, y + this.cellSize / 2);
                }
            }
        }
    }
}


