// ========== RUNNER GAME ==========
class RunnerGame {
    constructor() {
        this.player = { x: 30, y: 0, width: 12, height: 16, vy: 0, onGround: false };
        this.obstacles = [];
        this.animationId = null;
        this.lastTimestamp = 0;
        this.gravity = 7200; // px/sec^2
        this.jumpVelocity = -960; // px/sec
        this.obstacleSpeed = 360; // px/sec
        this.obstacleSpawnRate = 1.2; // per second
    }

    init() {
        this.player.y = getCanvasHeight() - this.player.height - 5;
        this.player.vy = 0;
        this.player.onGround = true;
        this.obstacles = [];
        this.lastTimestamp = 0;
        this.gameLoop();
    }

    cleanup() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.lastTimestamp = 0;
    }

    reset() {
        // Stop current game loop and clean up
        this.cleanup();
        
        // Reset game state
        gameState.score = 0;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        this.obstacles = [];
        this.player.y = getCanvasHeight() - this.player.height - 5;
        this.player.vy = 0;
        this.player.onGround = true;
        this.lastTimestamp = 0;
        pauseOverlay.classList.remove('show');
        gameOverOverlay.classList.remove('show');
        updateScore();
        
        // Reinitialize
        this.init();
    }

    handleKey(e) {
        if (e.code === 'Space' || e.key === ' ') {
            if (gameState.isGameOver) {
                e.preventDefault();
                this.reset();
                return;
            }
            if (!gameState.isPaused && this.player.onGround) {
                e.preventDefault();
                this.player.vy = this.jumpVelocity;
                this.player.onGround = false;
            }
        }
    }

    update(dt) {
        // Gravity
        this.player.vy += this.gravity * dt;
        this.player.y += this.player.vy * dt;

        // Ground collision
        const groundY = getCanvasHeight() - this.player.height - 5;
        if (this.player.y >= groundY) {
            this.player.y = groundY;
            this.player.vy = 0;
            this.player.onGround = true;
        }

        // Spawn obstacles
        const spawnChance = 1 - Math.exp(-this.obstacleSpawnRate * dt);
        if (Math.random() < spawnChance) {
            this.obstacles.push({
                x: getCanvasWidth(),
                y: groundY,
                width: 8,
                height: 16
            });
        }

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].x -= this.obstacleSpeed * dt;
            if (this.obstacles[i].x + this.obstacles[i].width < 0) {
                this.obstacles.splice(i, 1);
                gameState.score += 5;
                updateScore();
                continue;
            }

            // Collision
            const o = this.obstacles[i];
            if (this.player.x < o.x + o.width &&
                this.player.x + this.player.width > o.x &&
                this.player.y < o.y + o.height &&
                this.player.y + this.player.height > o.y) {
                gameState.isGameOver = true;
                const finalScore = gameState.score;
                reportHighScore('runner', finalScore);
                finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, 'runner');
                gameOverOverlay.classList.add('show');
            }
        }
    }

    draw() {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

        // Ground
        const groundY = getCanvasHeight() - this.player.height - 5;
        ctx.fillStyle = colors.dark;
        ctx.fillRect(0, groundY + this.player.height, getCanvasWidth(), 3);

        // Player
        ctx.fillStyle = colors.player;
        ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

        // Obstacles
        ctx.fillStyle = colors.target;
        this.obstacles.forEach(o => {
            ctx.fillRect(o.x, o.y, o.width, o.height);
        });
    }

    gameLoop(timestamp = performance.now()) {
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
        this.lastTimestamp = timestamp;

        if (!gameState.isPaused && !gameState.isGameOver) {
            this.update(delta);
        }
        this.draw();
        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }
}


