// ========== SNAKE GAME ==========
class SnakeGame {
    constructor() {
        this.gridSize = 20;
        this.cellSize = 0;
        this.snake = [];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.food = { x: 0, y: 0 };
        this.animationId = null;
        this.lastUpdate = 0;
        this.updateInterval = 120; // ms per move
    }

    init() {
        this.cellSize = Math.floor(Math.min(getCanvasWidth(), getCanvasHeight()) / this.gridSize);
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.spawnFood();
        this.lastUpdate = 0;
        this.gameLoop();
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
        // Prevent reversing into self
        if ((key === 'ArrowUp' || key === 'w' || key === 'W') && this.direction.y === 0) {
            this.nextDirection = { x: 0, y: -1 };
            e.preventDefault();
        } else if ((key === 'ArrowDown' || key === 's' || key === 'S') && this.direction.y === 0) {
            this.nextDirection = { x: 0, y: 1 };
            e.preventDefault();
        } else if ((key === 'ArrowLeft' || key === 'a' || key === 'A') && this.direction.x === 0) {
            this.nextDirection = { x: -1, y: 0 };
            e.preventDefault();
        } else if ((key === 'ArrowRight' || key === 'd' || key === 'D') && this.direction.x === 0) {
            this.nextDirection = { x: 1, y: 0 };
            e.preventDefault();
        }
    }

    spawnFood() {
        do {
            this.food = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize)
            };
        } while (this.snake.some(seg => seg.x === this.food.x && seg.y === this.food.y));
    }

    update(timestamp) {
        if (gameState.isPaused || gameState.isGameOver) return;

        if (timestamp - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = timestamp;

        // Update direction
        this.direction = { ...this.nextDirection };

        // Move snake
        const head = { 
            x: this.snake[0].x + this.direction.x, 
            y: this.snake[0].y + this.direction.y 
        };

        // Check wall collision
        if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize) {
            gameState.isGameOver = true;
            const finalScore = gameState.score;
            reportHighScore('snake', finalScore);
            finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, 'snake');
            gameOverOverlay.classList.add('show');
            return;
        }

        // Check self collision
        if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
            gameState.isGameOver = true;
            const finalScore = gameState.score;
            reportHighScore('snake', finalScore);
            finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, 'snake');
            gameOverOverlay.classList.add('show');
            return;
        }

        this.snake.unshift(head);

        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            gameState.score += 10;
            updateScore();
            this.spawnFood();
            // Speed up slightly
            this.updateInterval = Math.max(60, this.updateInterval - 2);
        } else {
            this.snake.pop();
        }
    }

    draw() {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

        const offsetX = (getCanvasWidth() - this.cellSize * this.gridSize) / 2;
        const offsetY = (getCanvasHeight() - this.cellSize * this.gridSize) / 2;

        // Draw grid (subtle)
        ctx.strokeStyle = '#2d333b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY + i * this.cellSize);
            ctx.lineTo(offsetX + this.gridSize * this.cellSize, offsetY + i * this.cellSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(offsetX + i * this.cellSize, offsetY);
            ctx.lineTo(offsetX + i * this.cellSize, offsetY + this.gridSize * this.cellSize);
            ctx.stroke();
        }

        // Draw snake
        this.snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? colors.accent : colors.player;
            ctx.fillRect(
                offsetX + seg.x * this.cellSize + 1,
                offsetY + seg.y * this.cellSize + 1,
                this.cellSize - 2,
                this.cellSize - 2
            );
        });

        // Draw food
        ctx.fillStyle = '#f85149';
        ctx.fillRect(
            offsetX + this.food.x * this.cellSize + 1,
            offsetY + this.food.y * this.cellSize + 1,
            this.cellSize - 2,
            this.cellSize - 2
        );
    }

    gameLoop(timestamp = 0) {
        this.update(timestamp);
        this.draw();
        this.animationId = requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}


