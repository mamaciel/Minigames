// ========== SPACE SHOOTER GAME ==========
class SpaceShooterGame {
    constructor() {
        this.player = { x: 20, y: 0, width: 12, height: 12 };
        this.bullets = [];
        this.targets = [];
        this.mouseY = 0;
        this.animationId = null;
        this.lastTimestamp = 0;
        this.targetSpawnRate = 1.8;
        this.bulletSpeed = 720;
        this.targetSpeed = 240;
        this.playerLerpRate = 20;
    }

    init() {
        this.player.y = getCanvasHeight() / 2;
        this.mouseY = getCanvasHeight() / 2;
        this.bullets = [];
        this.targets = [];
        this.lastTimestamp = 0;
        canvas.addEventListener('mousemove', this.mouseMoveHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseY = e.clientY - rect.top;
        });
        canvas.addEventListener('click', this.clickHandler = () => this.shoot());
        this.gameLoop();
    }

    cleanup() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.lastTimestamp = 0;
        canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        canvas.removeEventListener('click', this.clickHandler);
    }

    reset() {
        // Stop current game loop and clean up
        this.cleanup();
        
        // Reset game state
        gameState.score = 0;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        this.bullets = [];
        this.targets = [];
        this.player.y = getCanvasHeight() / 2;
        this.mouseY = getCanvasHeight() / 2;
        this.lastTimestamp = 0;
        pauseOverlay.classList.remove('show');
        gameOverOverlay.classList.remove('show');
        updateScore();
        
        // Reinitialize
        this.init();
    }

    shoot() {
        if (gameState.isPaused || gameState.isGameOver) return;
        this.bullets.push({
            x: this.player.x + this.player.width,
            y: this.player.y + this.player.height / 2 - 3,
            width: 3,
            height: 6
        });
    }

    update(dt) {
        const targetY = this.mouseY - this.player.height / 2;
        const lerp = Math.min(1, this.playerLerpRate * dt);
        this.player.y += (targetY - this.player.y) * lerp;
        this.player.y = Math.max(0, Math.min(getCanvasHeight() - this.player.height, this.player.y));

        const spawnChance = 1 - Math.exp(-this.targetSpawnRate * dt);
        if (Math.random() < spawnChance) {
            this.targets.push({
                x: getCanvasWidth(),
                y: Math.random() * (getCanvasHeight() - 12),
                width: 12,
                height: 12
            });
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].x += this.bulletSpeed * dt;
            if (this.bullets[i].x > getCanvasWidth()) {
                this.bullets.splice(i, 1);
                continue;
            }
            for (let j = this.targets.length - 1; j >= 0; j--) {
                const b = this.bullets[i];
                const t = this.targets[j];
                if (b.x < t.x + t.width && b.x + b.width > t.x &&
                    b.y < t.y + t.height && b.y + b.height > t.y) {
                    this.bullets.splice(i, 1);
                    this.targets.splice(j, 1);
                    gameState.score += 10;
                    updateScore();
                    break;
                }
            }
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            this.targets[i].x -= this.targetSpeed * dt;
            if (this.targets[i].x + this.targets[i].width < 0) {
                this.targets.splice(i, 1);
                continue;
            }
            const t = this.targets[i];
            if (t.x < this.player.x + this.player.width &&
                t.x + t.width > this.player.x &&
                t.y < this.player.y + this.player.height &&
                t.y + t.height > this.player.y) {
                gameState.isGameOver = true;
                const finalScore = gameState.score;
                reportHighScore('spaceShooter', finalScore);
                finalScoreElement.textContent = formatScoreWithBest('Final Score', finalScore, 'spaceShooter');
                gameOverOverlay.classList.add('show');
            }
        }
    }

    draw() {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

        ctx.fillStyle = colors.player;
        ctx.beginPath();
        ctx.moveTo(this.player.x + this.player.width, this.player.y + this.player.height / 2);
        ctx.lineTo(this.player.x, this.player.y);
        ctx.lineTo(this.player.x, this.player.y + this.player.height);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = colors.bullet;
        this.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

        ctx.fillStyle = colors.target;
        this.targets.forEach(t => {
            ctx.fillRect(t.x, t.y, t.width, t.height);
            ctx.strokeStyle = colors.dark;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.x + t.width / 2, t.y);
            ctx.lineTo(t.x + t.width / 2, t.y + t.height);
            ctx.moveTo(t.x, t.y + t.height / 2);
            ctx.lineTo(t.x + t.width, t.y + t.height / 2);
            ctx.stroke();
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


