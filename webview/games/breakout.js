// ========== BREAKOUT GAME ==========
class BreakoutGame {
    constructor() {
        this.paddle = { x: 0, y: 0, width: 40, height: 6 };
        this.ball = { x: 0, y: 0, radius: 4, vx: 0, vy: 0 };
        this.bricks = [];
        this.animationId = null;
        this.speedMultiplier = 1.0;
        this.baseSpeed = 180;
        this.lastTimestamp = 0;
        this.totalBricks = 0;
        this.level = 1;
        this.maxLevels = 3;
        this.awaitingLevelStart = false;
        this.levelMessage = '';
        this.levelSubMessage = '';
        this.levelConfigs = [
            { rows: 3, cols: 6, brickHeight: 10, baseSpeed: 180, paddleWidth: 46 },
            { rows: 4, cols: 8, brickHeight: 9, baseSpeed: 210, paddleWidth: 38 },
            { rows: 5, cols: 10, brickHeight: 8, baseSpeed: 240, paddleWidth: 32 }
        ];
        this.mouseMoveHandler = null;
        this.canvasClickHandler = null;
    }

    init() {
        this.paddle.y = getCanvasHeight() - 15;
        canvas.style.cursor = 'none';
        canvas.addEventListener('mousemove', this.mouseMoveHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            this.paddle.x = e.clientX - rect.left - this.paddle.width / 2;
            this.paddle.x = Math.max(0, Math.min(getCanvasWidth() - this.paddle.width, this.paddle.x));
        });
        canvas.addEventListener('click', this.canvasClickHandler = () => {
            if (this.awaitingLevelStart && !gameState.isGameOver) {
                this.startCurrentLevel();
            }
        });
        this.prepareLevel(1, { resetScore: true });
        this.gameLoop();
    }

    cleanup() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.lastTimestamp = 0;
        canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        canvas.removeEventListener('click', this.canvasClickHandler);
        canvas.style.cursor = '';
    }

    reset() {
        this.cleanup();
        gameState.score = 0;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        this.speedMultiplier = 1.0;
        this.bricks = [];
        this.lastTimestamp = 0;
        this.level = 1;
        this.levelMessage = '';
        this.levelSubMessage = '';
        pauseOverlay.classList.remove('show');
        gameOverOverlay.classList.remove('show');

        setTimeout(() => {
            this.init();
            updateScore();
        }, 50);
    }

    handleKey(e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            if (gameState.isGameOver) {
                this.reset();
                return;
            }
            if (this.awaitingLevelStart) {
                this.startCurrentLevel();
            }
        }
    }

    getLevelConfig(level) {
        const index = Math.min(level - 1, this.levelConfigs.length - 1);
        return this.levelConfigs[index];
    }

    prepareLevel(level, { resetScore = false } = {}) {
        this.level = Math.min(level, this.maxLevels);
        const config = this.getLevelConfig(this.level);
        this.baseSpeed = config.baseSpeed;
        this.speedMultiplier = 1.0;
        this.paddle.width = config.paddleWidth;
        this.paddle.x = (getCanvasWidth() - this.paddle.width) / 2;
        this.ball.x = getCanvasWidth() / 2;
        this.ball.y = this.paddle.y - 10;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.bricks = this.buildBricks(config);
        this.totalBricks = this.bricks.length;
        this.awaitingLevelStart = true;
        this.lastTimestamp = 0;
        this.levelMessage = `Level ${this.level} ready!`;
        this.levelSubMessage = 'Click or press Space to launch';
        if (resetScore) {
            gameState.score = 0;
            updateScore();
        }
    }

    buildBricks(config) {
        const bricks = [];
        const padding = 4;
        const offsetX = 10;
        const offsetY = 8;
        const usableWidth = getCanvasWidth() - offsetX * 2;
        const brickWidth = (usableWidth - (config.cols - 1) * padding) / config.cols;
        for (let r = 0; r < config.rows; r++) {
            for (let c = 0; c < config.cols; c++) {
                bricks.push({
                    x: offsetX + c * (brickWidth + padding),
                    y: offsetY + r * (config.brickHeight + padding),
                    width: brickWidth,
                    height: config.brickHeight
                });
            }
        }
        return bricks;
    }

    startCurrentLevel() {
        if (!this.awaitingLevelStart) return;
        this.awaitingLevelStart = false;
        this.levelMessage = '';
        this.levelSubMessage = '';
        const launch = this.getLaunchVector();
        this.ball.vx = launch.vx;
        this.ball.vy = launch.vy;
        this.lastTimestamp = 0;
    }

    getLaunchVector() {
        const minAngle = 30 * Math.PI / 180;
        const maxAngle = 150 * Math.PI / 180;
        const angle = minAngle + Math.random() * (maxAngle - minAngle);
        const speed = this.baseSpeed;
        return {
            vx: speed * Math.cos(angle),
            vy: -Math.abs(speed * Math.sin(angle))
        };
    }

    update(dt) {
        const targetSpeed = this.baseSpeed * this.speedMultiplier;
        const currentSpeed = Math.hypot(this.ball.vx, this.ball.vy) || targetSpeed;
        if (Math.abs(currentSpeed - targetSpeed) > 0.5) {
            const scale = targetSpeed / (currentSpeed || 1);
            this.ball.vx *= scale;
            this.ball.vy *= scale;
        }

        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;

        if (this.ball.x <= this.ball.radius || this.ball.x >= getCanvasWidth() - this.ball.radius) {
            this.ball.vx = -this.ball.vx;
            this.ball.vy += (Math.random() - 0.5) * 25;
        }
        if (this.ball.y <= this.ball.radius) {
            this.ball.vy = -this.ball.vy;
            this.ball.vx += (Math.random() - 0.5) * 25;
        }

        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.height &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width) {
            const paddleCenter = this.paddle.x + this.paddle.width / 2;
            const impactOffset = (this.ball.x - paddleCenter) / (this.paddle.width / 2);
            const clampedOffset = Math.max(-1, Math.min(1, impactOffset));
            const maxBounceAngle = Math.PI / 3; // 60°
            const bounceAngle = clampedOffset * maxBounceAngle;
            const speed = Math.hypot(this.ball.vx, this.ball.vy) || targetSpeed;
            this.ball.vx = speed * Math.sin(bounceAngle);
            this.ball.vy = -Math.abs(speed * Math.cos(bounceAngle));
            this.ball.vx += (Math.random() - 0.5) * 15;
            this.ball.y = this.paddle.y - this.ball.radius;
        }

        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (this.ball.x >= brick.x && this.ball.x <= brick.x + brick.width &&
                this.ball.y >= brick.y && this.ball.y <= brick.y + brick.height) {
                this.bricks.splice(i, 1);
                const horizontalHit = this.ball.x < brick.x || this.ball.x > brick.x + brick.width;
                if (horizontalHit) {
                    this.ball.vx = -this.ball.vx;
                } else {
                    this.ball.vy = -this.ball.vy;
                }
                this.ball.vx += (Math.random() - 0.5) * 20;
                gameState.score += 10;
                const cleared = this.totalBricks - this.bricks.length;
                this.speedMultiplier = Math.min(1 + cleared * 0.05, 3);
                updateScore();

                if (this.bricks.length === 0) {
                    this.handleLevelClear();
                }
            }
        }

        if (this.ball.y > getCanvasHeight()) {
            gameState.isGameOver = true;
            const finalScore = gameState.score;
            reportHighScore('breakout', finalScore);
            finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, 'breakout');
            gameOverOverlay.classList.add('show');
        }
    }

    handleLevelClear() {
        if (this.level >= this.maxLevels) {
            gameState.isGameOver = true;
            const finalScore = gameState.score;
            reportHighScore('breakout', finalScore);
            finalScoreElement.textContent = formatScoreWithBest('You Win! Score', finalScore, 'breakout');
            gameOverOverlay.classList.add('show');
            return;
        }
        this.level += 1;
        this.prepareLevel(this.level, { resetScore: false });
    }

    draw() {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

        ctx.fillStyle = colors.player;
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

        ctx.fillStyle = colors.bullet;
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.target;
        this.bricks.forEach(brick => {
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        });

        if (this.levelMessage) {
            ctx.fillStyle = '#adbac7';
            ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.levelMessage, getCanvasWidth() / 2, getCanvasHeight() / 2 - 6);
            if (this.levelSubMessage) {
                ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.fillText(this.levelSubMessage, getCanvasWidth() / 2, getCanvasHeight() / 2 + 10);
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    }

    gameLoop(timestamp = performance.now()) {
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
        this.lastTimestamp = timestamp;

        if (!gameState.isPaused && !gameState.isGameOver && !this.awaitingLevelStart) {
            this.update(delta);
        }
        this.draw();
        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }
}


