const vscode = require("vscode");
const path = require("path");

class GameViewProvider {
  constructor(context) {
    this._context = context;
    this._view = undefined;
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    const disposables = this._context.subscriptions;
    disposables.push(
      webviewView.onDidDispose(() => {
        this._view = undefined;
      })
    );

    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._context.extensionPath, "media")),
        vscode.Uri.file(path.join(this._context.extensionPath, ".media")),
      ],
    };

    // Prepare local URI for chess.js
    const chessJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, ".media", "chess.js")
      )
    );

    const nonce = getNonce();
    webview.html = getGameHTML({
      chessJsSrc: String(chessJsUri),
      cspSource: webview.cspSource,
      nonce,
    });

    // Handle messages from the webview
    webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      null,
      this._context.subscriptions
    );
  }

  dispose() {
    if (this._view) {
      this._view.dispose();
      this._view = undefined;
    }
  }
}

let gameViewProvider = undefined;

function activate(context) {
  console.log("Cursor Minigames extension is now active!");

  // Register the webview view provider
  gameViewProvider = new GameViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("minigames", gameViewProvider)
  );

  // Register command to manually show/reveal the game
  const showMinigames = vscode.commands.registerCommand(
    "minigames.showGame",
    async () => {
      try {
        await vscode.commands.executeCommand("workbench.view.explorer");
        await vscode.commands.executeCommand("minigames.focus");
      } catch (error) {
        console.error("Failed to focus Minigames view:", error);
        vscode.window.showErrorMessage(
          "Unable to focus the Minigames view. Check the logs for details."
        );
      }
    }
  );

  context.subscriptions.push(showMinigames);
}

function getGameHTML({ chessJsSrc, cspSource, nonce }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource} https: data:;">
      <title>Mini Games</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: #1c2128;
            color: #adbac7;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
        }

        #gameContainer {
            flex: 1;
            position: relative;
            background: linear-gradient(to bottom, #22272e 0%, #1c2128 100%);
            display: flex;
            flex-direction: column;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #gameHeader {
            background-color: #2d333b;
            padding: 2px 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444c56;
            flex-shrink: 0;
            height: 24px;
        }

        #score {
            font-size: 10px;
            font-weight: 500;
            color: #768390;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #gameTitle {
            font-size: 10px;
            font-weight: 500;
            color: #768390;
            margin-right: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #controls {
            display: flex;
            gap: 4px;
        }

        button {
            background-color: #373e47;
            color: #adbac7;
            border: 1px solid #444c56;
            padding: 2px 6px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 10px;
            transition: all 0.15s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        button:hover {
            background-color: #444c56;
            border-color: #545d68;
        }

        button:active {
            background-color: #2d333b;
        }

        #helpBtn {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            font-style: italic;
            font-family: Georgia, serif;
            background-color: #373e47;
            color: #768390;
            border: 1px solid #444c56;
        }

        #helpBtn:hover {
            background-color: #444c56;
            color: #adbac7;
            border-color: #545d68;
        }
        
        select {
            background-color: #373e47;
            color: #adbac7;
            border: 1px solid #444c56;
            padding: 2px 4px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        #gameCanvas {
            flex: 1;
            width: 100%;
            max-width: 400px;
            min-height: 120px;
            max-height: 150px;
            background-color: #22272e;
            cursor: crosshair;
            display: block;
            margin: 0 auto;
        }

        #gameCanvas.chess-board {
            min-height: 280px;
            max-height: 500px;
            max-width: 500px;
            cursor: pointer;
        }

        #gameMenu {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 12px;
        }

        #gameMenu.hidden {
            display: none;
        }
        
        #gameMenu h3 {
            font-size: 11px;
            margin-bottom: 8px;
            width: 100%;
            text-align: center;
        }
        
        #gameButtonGrid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            max-width: 220px;
        }

        .gameButton {
            width: 100%;
            padding: 8px 8px;
            font-size: 10px;
            margin: 0;
            white-space: nowrap;
        }

        #pauseOverlay {
            position: absolute;
            top: 24px;
            left: 0;
            width: 100%;
            height: calc(100% - 24px);
            background-color: rgba(28, 33, 40, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 1000;
        }

        #pauseOverlay.show {
            display: flex;
        }

        #pauseText {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 12px;
            color: #adbac7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #gameOverOverlay {
            position: absolute;
            top: 24px;
            left: 0;
            width: 100%;
            height: calc(100% - 24px);
            background-color: rgba(28, 33, 40, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 1001;
        }

        #gameOverOverlay.show {
            display: flex;
        }

        #gameOverText {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
            color: #adbac7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #finalScore {
            font-size: 12px;
            margin-bottom: 12px;
            color: #768390;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        #helpOverlay {
            position: absolute;
            top: 24px;
            left: 0;
            width: 100%;
            height: calc(100% - 24px);
            background-color: rgba(28, 33, 40, 0.95);
            display: none;
            flex-direction: column;
            align-items: center;
            z-index: 1002;
            overflow-y: auto;
            padding: 20px;
        }

        #helpOverlay.show {
            display: flex;
        }

        #helpContent {
            max-width: 350px;
            color: #adbac7;
            text-align: left;
            margin-bottom: 15px;
        }

        #helpContent h3 {
            font-size: 14px;
            margin-bottom: 12px;
            color: #e6edf3;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        #helpContent p {
            font-size: 11px;
            line-height: 1.5;
            margin-bottom: 8px;
            color: #adbac7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        #helpContent ul {
            font-size: 11px;
            line-height: 1.6;
            margin: 8px 0;
            padding-left: 20px;
            color: #768390;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        #helpContent strong {
            color: #e6edf3;
        }
    </style>
      <!-- Load chess.js as an ES module and expose Chess on window -->
      <script type="module" nonce="${nonce}">
        try {
            const mod = await import('${chessJsSrc}');
            // chess.js exports { Chess }
            window.Chess = mod.Chess || mod.default || undefined;
            if (window.Chess) {
                console.log('chess.js loaded successfully');
            } else {
                console.error('chess.js loaded but Chess export not found');
            }
        } catch (e) {
            console.error('Failed to import chess.js:', e);
        }
    </script>
</head>
<body>
    <div id="gameContainer">
        <div id="gameHeader">
            <div style="display: flex; align-items: center;">
                <span id="gameTitle"></span>
                <span id="score" style="display: none;"></span>
            </div>
            <div id="controls">
                <select id="difficulty" title="Difficulty" style="display: none;">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
                <button id="helpBtn" style="display: none;" title="How to Play">i</button>
                <button id="menuBtn" style="display: none;">Menu</button>
                <button id="pauseBtn" style="display: none;">Pause</button>
                <button id="resetBtn" style="display: none;">Reset</button>
            </div>
        </div>
        <div id="gameMenu">
            <h3 style="color: #768390; font-size: 11px; font-weight: 500;">Choose a Game</h3>
            <div id="gameButtonGrid">
                <button class="gameButton" data-game="spaceShooter">Space Shooter</button>
                <button class="gameButton" data-game="runner">Runner</button>
                <button class="gameButton" data-game="breakout">Breakout</button>
                <button class="gameButton" data-game="chess">♟ Chess</button>
                <button class="gameButton" data-game="snake">Snake</button>
                <button class="gameButton" data-game="2048">2048</button>
            </div>
        </div>
        <canvas id="gameCanvas" style="display: none;"></canvas>
        <div id="pauseOverlay">
            <div id="pauseText">PAUSED</div>
            <button id="resumeBtn">Resume</button>
        </div>
        <div id="gameOverOverlay">
            <div id="gameOverText">Game Over!</div>
            <div id="finalScore">Final Score: 0</div>
            <button id="restartBtn">Play Again</button>
        </div>
        <div id="helpOverlay">
            <div id="helpContent"></div>
            <button id="closeHelpBtn">Close</button>
        </div>
    </div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        // Game manager
        const gameManager = {
            currentGame: null,
            games: {}
        };

        const chessDifficultyConfig = {
            easy: { type: 'random', label: 'Easy', maxTimeMs: 200 },
            medium: {
                type: 'engine',
                label: 'Medium',
                depth: 3,
                maxTimeMs: 800,
                mixRandomness: 0.2,
                allowHeuristicFallback: true,
                preferAggressive: false
            },
            hard: {
                type: 'engine',
                label: 'Hard',
                depth: 5,
                maxTimeMs: 2200,
                mixRandomness: 0,
                allowHeuristicFallback: true,
                preferAggressive: true
            }
        };

        const chessPieceValues = {
            p: 100,
            n: 320,
            b: 330,
            r: 500,
            q: 900,
            k: 20000
        };

        const chessCenterSquares = new Set(['33', '34', '43', '44']);

        // DOM elements
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const gameTitle = document.getElementById('gameTitle');
        const helpBtn = document.getElementById('helpBtn');
        const menuBtn = document.getElementById('menuBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const difficultySelect = document.getElementById('difficulty');
        const resumeBtn = document.getElementById('resumeBtn');
        const restartBtn = document.getElementById('restartBtn');
        const pauseOverlay = document.getElementById('pauseOverlay');
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        const finalScoreElement = document.getElementById('finalScore');
        const gameMenu = document.getElementById('gameMenu');
        const helpOverlay = document.getElementById('helpOverlay');
        const helpContent = document.getElementById('helpContent');
        const closeHelpBtn = document.getElementById('closeHelpBtn');
        let logicalWidth = canvas.clientWidth || canvas.offsetWidth || 0;
        let logicalHeight = canvas.clientHeight || canvas.offsetHeight || 0;

        const getCanvasWidth = () => logicalWidth || canvas.clientWidth || canvas.offsetWidth || 0;
        const getCanvasHeight = () => logicalHeight || canvas.clientHeight || canvas.offsetHeight || 0;

        const difficultyUI = {
            showSetup() {
                difficultySelect.style.display = 'inline-block';
                difficultySelect.disabled = false;
                difficultySelect.dataset.state = 'setup';
                difficultySelect.title = 'Select a difficulty before starting a chess match.';
            },
            hide() {
                difficultySelect.style.display = 'none';
                difficultySelect.disabled = true;
                difficultySelect.dataset.state = 'hidden';
                difficultySelect.title = '';
            },
            lock() {
                difficultySelect.style.display = 'none';
                difficultySelect.disabled = true;
                difficultySelect.dataset.state = 'locked';
                difficultySelect.title = 'Reset the match to change difficulty.';
            }
        };

        const applyChessDifficulty = () => {
            if (gameManager.currentGame instanceof ChessGame) {
                if (gameManager.currentGame.isDifficultySelectionLocked()) {
                    // Revert UI change if selection is currently locked
                    if (difficultySelect.value !== gameManager.currentGame.difficulty) {
                        difficultySelect.value = gameManager.currentGame.difficulty;
                    }
                    return;
                }
                gameManager.currentGame.setDifficulty(difficultySelect.value);
            }
        };

        difficultySelect.addEventListener('change', applyChessDifficulty);

        // Colors - Clean Cursor IDE aesthetic
        const colors = {
            background: '#22272e',
            player: '#adbac7',
            target: '#768390',
            bullet: '#adbac7',
            header: '#2d333b',
            dark: '#1c2128',
            accent: '#57ab5a'
        };

        // Chess evaluation constants
        const CHESS_PIECE_VALUES = Object.freeze({
            p: 100,
            n: 320,
            b: 330,
            r: 500,
            q: 900,
            k: 20000
        });

        const CHESS_PST = Object.freeze({
            p: [
                0, 0, 0, 0, 0, 0, 0, 0,
                5, 10, 10, -20, -20, 10, 10, 5,
                5, -5, -10, 0, 0, -10, -5, 5,
                0, 0, 0, 20, 20, 0, 0, 0,
                5, 5, 10, 25, 25, 10, 5, 5,
                10, 10, 20, 30, 30, 20, 10, 10,
                50, 50, 50, 50, 50, 50, 50, 50,
                0, 0, 0, 0, 0, 0, 0, 0
            ],
            n: [
                -50, -40, -30, -30, -30, -30, -40, -50,
                -40, -20, 0, 5, 5, 0, -20, -40,
                -30, 5, 10, 15, 15, 10, 5, -30,
                -30, 0, 15, 20, 20, 15, 0, -30,
                -30, 5, 15, 20, 20, 15, 5, -30,
                -30, 0, 10, 15, 15, 10, 0, -30,
                -40, -20, 0, 0, 0, 0, -20, -40,
                -50, -40, -30, -30, -30, -30, -40, -50
            ],
            b: [
                -20, -10, -10, -10, -10, -10, -10, -20,
                -10, 0, 0, 0, 0, 0, 0, -10,
                -10, 0, 5, 10, 10, 5, 0, -10,
                -10, 5, 5, 10, 10, 5, 5, -10,
                -10, 0, 10, 10, 10, 10, 0, -10,
                -10, 10, 10, 10, 10, 10, 10, -10,
                -10, 5, 0, 0, 0, 0, 5, -10,
                -20, -10, -10, -10, -10, -10, -10, -20
            ],
            r: [
                0, 0, 5, 10, 10, 5, 0, 0,
                -5, 0, 0, 0, 0, 0, 0, -5,
                -5, 0, 0, 0, 0, 0, 0, -5,
                -5, 0, 0, 0, 0, 0, 0, -5,
                -5, 0, 0, 0, 0, 0, 0, -5,
                -5, 0, 0, 0, 0, 0, 0, -5,
                5, 10, 10, 10, 10, 10, 10, 5,
                0, 0, 0, 0, 0, 0, 0, 0
            ],
            q: [
                -20, -10, -10, -5, -5, -10, -10, -20,
                -10, 0, 0, 0, 0, 0, 0, -10,
                -10, 0, 5, 5, 5, 5, 0, -10,
                -5, 0, 5, 5, 5, 5, 0, -5,
                0, 0, 5, 5, 5, 5, 0, -5,
                -10, 5, 5, 5, 5, 5, 0, -10,
                -10, 0, 5, 0, 0, 0, 0, -10,
                -20, -10, -10, -5, -5, -10, -10, -20
            ],
            k: [
                -30, -40, -40, -50, -50, -40, -40, -30,
                -30, -40, -40, -50, -50, -40, -40, -30,
                -30, -40, -40, -50, -50, -40, -40, -30,
                -30, -40, -40, -50, -50, -40, -40, -30,
                -20, -30, -30, -40, -40, -30, -30, -20,
                -10, -20, -20, -20, -20, -20, -20, -10,
                20, 20, 0, 0, 0, 0, 20, 20,
                20, 30, 10, 0, 0, 10, 30, 20
            ]
        });

        const mirrorIndex64 = (idx) => {
            const row = Math.floor(idx / 8);
            const col = idx % 8;
            return (7 - row) * 8 + col;
        };

        // Resize canvas
        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = canvas.clientWidth || canvas.offsetWidth;
            const displayHeight = canvas.clientHeight || canvas.offsetHeight;
            if (!displayWidth || !displayHeight) {
                canvas.width = 0;
                canvas.height = 0;
                return;
            }
            const width = Math.floor(displayWidth * dpr);
            const height = Math.floor(displayHeight * dpr);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            logicalWidth = displayWidth;
            logicalHeight = displayHeight;
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            if (gameManager.currentGame && typeof gameManager.currentGame.draw === 'function') {
                gameManager.currentGame.draw();
            }
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Receive AI move from extension
        let pendingMoveResolver = null;
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg) return;
            if (msg.command === 'chessMove' && pendingMoveResolver) {
                const resolve = pendingMoveResolver;
                pendingMoveResolver = null;
                resolve(msg.payload && msg.payload.move ? msg.payload.move : null);
            }
        });

        // Game state
        let gameState = {
            score: 0,
            isPaused: false,
            isGameOver: false
        };

        // Menu controls
        document.querySelectorAll('.gameButton').forEach(btn => {
            btn.addEventListener('click', () => {
                const gameName = btn.getAttribute('data-game');
                startGame(gameName);
            });
        });

        menuBtn.addEventListener('click', () => {
            showMenu();
        });

        function showMenu() {
            gameState.isPaused = false;
            gameState.isGameOver = false;
            pauseOverlay.classList.remove('show');
            gameOverOverlay.classList.remove('show');
            helpOverlay.classList.remove('show');
            gameMenu.classList.remove('hidden');
            canvas.style.display = 'none';
            helpBtn.style.display = 'none';
            menuBtn.style.display = 'none';
            pauseBtn.style.display = 'none';
            resetBtn.style.display = 'none';
            difficultyUI.hide();
            gameTitle.textContent = '';
            scoreElement.textContent = '';
            scoreElement.style.display = 'none';
            if (gameManager.currentGame && gameManager.currentGame.cleanup) {
                gameManager.currentGame.cleanup();
            }
            gameManager.currentGame = null;
        }

        function startGame(gameName) {
            gameMenu.classList.add('hidden');
            canvas.style.display = 'block';
            helpBtn.style.display = 'inline-block';
            menuBtn.style.display = 'inline-block';
            // pauseBtn visibility is set per game in the switch statement
            resetBtn.style.display = 'inline-block';
            scoreElement.style.display = 'inline-block';
            resizeCanvas();
            
            gameState.score = 0;
            gameState.isPaused = false;
            gameState.isGameOver = false;
            pauseOverlay.classList.remove('show');
            gameOverOverlay.classList.remove('show');
            helpOverlay.classList.remove('show');
            updateScore();

            // Stop current game
            if (gameManager.currentGame && gameManager.currentGame.cleanup) {
                gameManager.currentGame.cleanup();
            }

            // Start new game
            switch(gameName) {
                case 'spaceShooter':
                    gameTitle.textContent = 'Space Shooter';
                    difficultyUI.hide();
                    pauseBtn.style.display = 'inline-block';
                    gameManager.currentGame = new SpaceShooterGame();
                    break;
                case 'runner':
                    gameTitle.textContent = 'Runner';
                    difficultyUI.hide();
                    pauseBtn.style.display = 'inline-block';
                    gameManager.currentGame = new RunnerGame();
                    break;
                case 'breakout':
                    gameTitle.textContent = 'Breakout';
                    difficultyUI.hide();
                    pauseBtn.style.display = 'inline-block';
                    gameManager.currentGame = new BreakoutGame();
                    break;
                case 'chess':
                    gameTitle.textContent = '♟ Chess';
                    scoreElement.textContent = 'Your Turn (White)';
                    difficultyUI.showSetup();
                    pauseBtn.style.display = 'none'; // No pause for turn-based game
                    gameManager.currentGame = new ChessGame();
                    applyChessDifficulty();
                    break;
                case 'snake':
                    gameTitle.textContent = 'Snake';
                    difficultyUI.hide();
                    pauseBtn.style.display = 'inline-block';
                    gameManager.currentGame = new SnakeGame();
                    break;
                case '2048':
                    gameTitle.textContent = '2048';
                    difficultyUI.hide();
                    pauseBtn.style.display = 'none'; // No pause for turn-based game
                    gameManager.currentGame = new Game2048();
                    break;
            }
            
            if (gameManager.currentGame) {
                gameManager.currentGame.init();
            }
        }

        function updateScore() {
            scoreElement.textContent = \`Score: \${gameState.score}\`;
        }

        // Pause/Resume function
        function togglePause() {
            if (!gameManager.currentGame || gameState.isGameOver) return;
            gameState.isPaused = !gameState.isPaused;
            if (gameState.isPaused) {
                pauseOverlay.classList.add('show');
            } else {
                pauseOverlay.classList.remove('show');
            }
        }

        pauseBtn.addEventListener('click', () => {
            if (!gameState.isPaused) {
                togglePause();
            }
        });

        resumeBtn.addEventListener('click', () => {
            togglePause();
        });

        resetBtn.addEventListener('click', () => {
            if (gameManager.currentGame && gameManager.currentGame.reset) {
                gameManager.currentGame.reset();
            }
        });

        restartBtn.addEventListener('click', () => {
            if (gameManager.currentGame && gameManager.currentGame.reset) {
                gameManager.currentGame.reset();
            }
        });

        helpBtn.addEventListener('click', () => {
            if (helpOverlay.classList.contains('show')) {
                helpOverlay.classList.remove('show');
            } else {
                showHelp();
            }
        });

        closeHelpBtn.addEventListener('click', () => {
            helpOverlay.classList.remove('show');
        });

        function showHelp() {
            const gameName = gameManager.currentGame ? gameManager.currentGame.constructor.name : '';
            let helpHTML = '';
            
            // Reset scroll position to top
            helpOverlay.scrollTop = 0;

            switch(gameName) {
                case 'SpaceShooterGame':
                    helpHTML = \`
                        <h3>🚀 Space Shooter</h3>
                        <p><strong>Goal:</strong> Shoot targets and avoid collisions!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Move mouse to control ship vertically</li>
                            <li>Click to shoot bullets</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Scoring:</strong> +10 points per target hit</p>
                        <p><strong>Game Over:</strong> When you collide with a target</p>
                    \`;
                    break;
                case 'RunnerGame':
                    helpHTML = \`
                        <h3>🏃 Runner</h3>
                        <p><strong>Goal:</strong> Jump over obstacles!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Spacebar to jump</li>
                            <li>Space after Game Over to play again</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Scoring:</strong> +5 points per obstacle passed</p>
                        <p><strong>Game Over:</strong> When you hit an obstacle</p>
                    \`;
                    break;
                case 'BreakoutGame':
                    helpHTML = \`
                        <h3>🎾 Breakout</h3>
                        <p><strong>Goal:</strong> Break all bricks!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Move mouse to control paddle</li>
                            <li>Space after Game Over to play again</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Scoring:</strong> +10 points per brick</p>
                        <p><strong>Tip:</strong> Speed increases as you break more bricks!</p>
                        <p><strong>Win:</strong> Break all bricks. Lose: Ball falls off screen</p>
                    \`;
                    break;
                case 'ChessGame':
                    helpHTML = \`
                        <h3>♟️ Chess</h3>
                        <p><strong>Goal:</strong> Capture the opponent's king!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Click a piece to select it</li>
                            <li>Legal moves are highlighted (dots = move, rings = capture)</li>
                            <li>Click destination to move</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Difficulty:</strong></p>
                        <ul>
                            <li>Easy: Random moves</li>
                            <li>Medium: Prefers captures</li>
                            <li>Hard: Minimax AI (5 depth)</li>
                        </ul>
                        <p><strong>Features:</strong> Captured pieces shown on right, coordinates on edges</p>
                    \`;
                    break;
                case 'SnakeGame':
                    helpHTML = \`
                        <h3>🐍 Snake</h3>
                        <p><strong>Goal:</strong> Eat food and grow!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Arrow keys or WASD to move</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Scoring:</strong> +10 points per food eaten</p>
                        <p><strong>Tip:</strong> Speed increases as you grow!</p>
                        <p><strong>Game Over:</strong> Hit walls or yourself</p>
                    \`;
                    break;
                case 'Game2048':
                    helpHTML = \`
                        <h3>2048</h3>
                        <p><strong>Goal:</strong> Reach the 2048 tile!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Arrow keys or WASD to slide tiles</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Rules:</strong> Same numbers merge and add up</p>
                        <p><strong>Scoring:</strong> Sum of merged tiles</p>
                        <p><strong>Game Over:</strong> No more valid moves</p>
                        <p><strong>Tip:</strong> Keep your highest tile in a corner!</p>
                    \`;
                    break;
                default:
                    helpHTML = '<h3>Help</h3><p>Select a game to see instructions.</p>';
            }

            helpContent.innerHTML = helpHTML;
            helpOverlay.classList.add('show');
        }

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            // Escape key for pause/resume
            if (e.code === 'Escape') {
                e.preventDefault();
                if (gameState.isGameOver) return;
                togglePause();
                return;
            }
            // Pass other keys to current game
            if (gameManager.currentGame && gameManager.currentGame.handleKey) {
                gameManager.currentGame.handleKey(e);
            }
        });

        // ========== SPACE SHOOTER GAME ==========
        class SpaceShooterGame {
            constructor() {
                this.player = { x: 20, y: 0, width: 12, height: 12 };
                this.bullets = [];
                this.targets = [];
                this.mouseY = 0;
                this.animationId = null;
            }

            init() {
                this.player.y = getCanvasHeight() / 2;
                this.mouseY = getCanvasHeight() / 2;
                this.bullets = [];
                this.targets = [];
                canvas.addEventListener('mousemove', this.mouseMoveHandler = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    this.mouseY = e.clientY - rect.top;
                });
                canvas.addEventListener('click', this.clickHandler = () => this.shoot());
                this.gameLoop();
            }

            cleanup() {
                if (this.animationId) cancelAnimationFrame(this.animationId);
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

            update() {
                if (gameState.isPaused || gameState.isGameOver) return;

                const targetY = this.mouseY - this.player.height / 2;
                this.player.y += (targetY - this.player.y) * 0.1;
                this.player.y = Math.max(0, Math.min(getCanvasHeight() - this.player.height, this.player.y));

                if (Math.random() < 0.015) {
                    this.targets.push({
                        x: getCanvasWidth(),
                        y: Math.random() * (getCanvasHeight() - 12),
                        width: 12,
                        height: 12
                    });
                }

                for (let i = this.bullets.length - 1; i >= 0; i--) {
                    this.bullets[i].x += 6;
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
                    this.targets[i].x -= 2;
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
                        finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
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

            gameLoop() {
                this.update();
                this.draw();
                this.animationId = requestAnimationFrame(() => this.gameLoop());
            }
        }

        // ========== RUNNER GAME ==========
        class RunnerGame {
            constructor() {
                this.player = { x: 30, y: 0, width: 12, height: 16, vy: 0, onGround: false };
                this.obstacles = [];
                this.animationId = null;
            }

            init() {
                this.player.y = getCanvasHeight() - this.player.height - 5;
                this.player.vy = 0;
                this.player.onGround = true;
                this.obstacles = [];
                this.gameLoop();
            }

            cleanup() {
                if (this.animationId) cancelAnimationFrame(this.animationId);
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
                        this.player.vy = -8;
                        this.player.onGround = false;
                    }
                }
            }

            update() {
                if (gameState.isPaused || gameState.isGameOver) return;

                // Gravity
                this.player.vy += 0.5;
                this.player.y += this.player.vy;

                // Ground collision
                const groundY = getCanvasHeight() - this.player.height - 5;
                if (this.player.y >= groundY) {
                    this.player.y = groundY;
                    this.player.vy = 0;
                    this.player.onGround = true;
                }

                // Spawn obstacles
                if (Math.random() < 0.01) {
                    this.obstacles.push({
                        x: getCanvasWidth(),
                        y: groundY,
                        width: 8,
                        height: 16
                    });
                }

                // Update obstacles
                for (let i = this.obstacles.length - 1; i >= 0; i--) {
                    this.obstacles[i].x -= 3;
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
                        finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
                        gameOverOverlay.classList.add('show');
                    }
                }
            }

            draw() {
                ctx.fillStyle = colors.background;
                ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

                // Ground
                ctx.fillStyle = colors.target;
                ctx.fillRect(0, getCanvasHeight() - 5, getCanvasWidth(), 5);

                // Player
                ctx.fillStyle = colors.player;
                ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

                // Obstacles
                ctx.fillStyle = colors.target;
                this.obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.width, o.height));
            }

            gameLoop() {
                this.update();
                this.draw();
                this.animationId = requestAnimationFrame(() => this.gameLoop());
            }
        }

        // ========== BREAKOUT GAME ==========
        class BreakoutGame {
            constructor() {
                this.paddle = { x: 0, y: 0, width: 40, height: 6 };
                this.ball = { x: 0, y: 0, radius: 4, vx: 1.5, vy: -1.5 };
                this.bricks = [];
                this.animationId = null;
                this.speedMultiplier = 1.0;
                this.baseSpeed = 1.5;
            }

            init() {
                this.paddle.y = getCanvasHeight() - 15;
                this.ball.x = getCanvasWidth() / 2;
                this.ball.y = getCanvasHeight() - 25;
                this.ball.vx = this.baseSpeed;
                this.ball.vy = -this.baseSpeed;
                this.speedMultiplier = 1.0;
                this.bricks = [];
                
                // Create bricks
                const rows = 3;
                const cols = 6;
                const brickWidth = (getCanvasWidth() - 20) / cols - 4;
                const brickHeight = 10;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        this.bricks.push({
                            x: 10 + c * (brickWidth + 4),
                            y: 20 + r * (brickHeight + 4),
                            width: brickWidth,
                            height: brickHeight
                        });
                    }
                }

                // Hide cursor while playing Breakout
                canvas.style.cursor = 'none';

                canvas.addEventListener('mousemove', this.mouseMoveHandler = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    this.paddle.x = e.clientX - rect.left - this.paddle.width / 2;
                    this.paddle.x = Math.max(0, Math.min(getCanvasWidth() - this.paddle.width, this.paddle.x));
                });
                this.gameLoop();
            }

            cleanup() {
                if (this.animationId) cancelAnimationFrame(this.animationId);
                canvas.removeEventListener('mousemove', this.mouseMoveHandler);
                // Restore cursor for other games/menus
                canvas.style.cursor = '';
            }

            reset() {
                // Stop current game loop and clean up
                this.cleanup();
                
                // Reset game state
                gameState.score = 0;
                gameState.isPaused = false;
                gameState.isGameOver = false;
                pauseOverlay.classList.remove('show');
                gameOverOverlay.classList.remove('show');
                
                // Wait a frame before reinitializing to ensure cleanup is complete
                setTimeout(() => {
                    this.init();
                    updateScore();
                }, 50);
            }

            handleKey(e) {
                if ((e.code === 'Space' || e.key === ' ') && gameState.isGameOver) {
                    e.preventDefault();
                    this.reset();
                }
            }

            update() {
                if (gameState.isPaused || gameState.isGameOver) return;

                // Update ball with speed multiplier
                this.ball.x += this.ball.vx * this.speedMultiplier;
                this.ball.y += this.ball.vy * this.speedMultiplier;

                // Ball walls
                if (this.ball.x <= this.ball.radius || this.ball.x >= getCanvasWidth() - this.ball.radius) {
                    this.ball.vx = -this.ball.vx;
                }
                if (this.ball.y <= this.ball.radius) {
                    this.ball.vy = -this.ball.vy;
                }

                // Ball paddle collision
                if (this.ball.y + this.ball.radius >= this.paddle.y &&
                    this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.height &&
                    this.ball.x >= this.paddle.x &&
                    this.ball.x <= this.paddle.x + this.paddle.width) {
                    this.ball.vy = -Math.abs(this.ball.vy);
                    this.ball.y = this.paddle.y - this.ball.radius;
                }

                // Ball brick collision
                for (let i = this.bricks.length - 1; i >= 0; i--) {
                    const brick = this.bricks[i];
                    if (this.ball.x >= brick.x && this.ball.x <= brick.x + brick.width &&
                        this.ball.y >= brick.y && this.ball.y <= brick.y + brick.height) {
                        this.bricks.splice(i, 1);
                        this.ball.vy = -this.ball.vy;
                        gameState.score += 10;
                        // Gradually increase speed as bricks are destroyed
                        this.speedMultiplier = Math.min(1.0 + (18 - this.bricks.length) * 0.05, 2.5);
                        updateScore();
                        
                        if (this.bricks.length === 0) {
                            gameState.isGameOver = true;
                            finalScoreElement.textContent = \`You Win! Score: \${gameState.score}\`;
                            gameOverOverlay.classList.add('show');
                        }
                    }
                }

                // Game over if ball falls
                if (this.ball.y > getCanvasHeight()) {
                    gameState.isGameOver = true;
                    finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
                    gameOverOverlay.classList.add('show');
                }
            }

            draw() {
                ctx.fillStyle = colors.background;
                ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

                // Paddle
                ctx.fillStyle = colors.player;
                ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

                // Ball
                ctx.fillStyle = colors.bullet;
                ctx.beginPath();
                ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
                ctx.fill();

                // Bricks
                ctx.fillStyle = colors.target;
                this.bricks.forEach(brick => {
                    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
                });
            }

            gameLoop() {
                this.update();
                this.draw();
                this.animationId = requestAnimationFrame(() => this.gameLoop());
            }
        }

        // ========== CHESS GAME ==========
        class ChessGame {
            constructor() {
                this.board = [];
                this.selectedSquare = null;
                this.isPlayerTurn = true;
                this.moves = [];
                this.gameOver = false;
                this.animationId = null;
                this.squareSize = 0;
                this.thinking = false;
                this.capturedPieces = { white: [], black: [] };
                this.legalMoves = [];
                this.hoveredSquare = null;
                this.lastMove = null;
                this.lastMoveTimeMs = 0;
                this.fadeAnimationId = null;
                this.fadeDurationMs = 1200;
                this.difficulty = difficultySelect.value || 'easy';
                this.aiAbortController = null;
                const initialSettings = chessDifficultyConfig[this.difficulty] || chessDifficultyConfig.easy;
                this.maxEngineTimeMs = initialSettings.maxTimeMs || chessDifficultyConfig.easy.maxTimeMs;
                this.difficultyLocked = false;
                this.matchStarted = false;
            }

            startFadeAnimation() {
                const tick = () => {
                    // If there is no pending last move or duration elapsed, stop
                    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                    const elapsed = now - (this.lastMoveTimeMs || 0);
                    if (!this.lastMove || elapsed >= this.fadeDurationMs) {
                        this.fadeAnimationId = null;
                        this.draw();
                        return;
                    }
                    this.draw();
                    this.fadeAnimationId = requestAnimationFrame(tick);
                };
                if (this.fadeAnimationId) cancelAnimationFrame(this.fadeAnimationId);
                this.fadeAnimationId = requestAnimationFrame(tick);
            }

            getDifficultySettings() {
                return chessDifficultyConfig[this.difficulty] || chessDifficultyConfig.easy;
            }

            setDifficulty(level) {
                const safeLevel = chessDifficultyConfig[level] ? level : 'easy';
                this.difficulty = safeLevel;
                this.maxEngineTimeMs = this.getDifficultySettings().maxTimeMs || 800;
                if (this.thinking) {
                    this.cancelThinking(true);
                }
            }

            cancelThinking(shouldRestart = false) {
                if (this.aiAbortController) {
                    this.aiAbortController.aborted = true;
                }
                this.aiAbortController = null;
                this.thinking = false;
                if (shouldRestart && !this.isPlayerTurn && !this.gameOver) {
                    const label = this.getDifficultySettings().label || 'AI';
                    scoreElement.textContent = 'AI Thinking (' + label + ')...';
                    setTimeout(() => this.makeAIMove(), 0);
                }
            }

            createAbortSignal() {
                if (this.aiAbortController) {
                    this.aiAbortController.aborted = true;
                }
                const token = { aborted: false };
                this.aiAbortController = token;
                return token;
            }

            init() {
                this.prepareDifficultySelectionWindow();
                // Make canvas bigger for chess
                canvas.classList.add('chess-board');
                resizeCanvas();
                
                // Wait for resize, then calculate square size
                setTimeout(() => {
                    // Leave space for coordinates and captured pieces
                    const availableWidth = getCanvasWidth() - 50; // Space for captured pieces
                    const availableHeight = getCanvasHeight() - 30; // Space for coordinates
                    const size = Math.min(availableWidth, availableHeight);
                    this.squareSize = size / 8;
                    this.initBoard();
                    this.selectedSquare = null;
                    this.isPlayerTurn = true;
                    this.moves = [];
                    this.gameOver = false;
                    this.thinking = false;
                    this.capturedPieces = { white: [], black: [] };
                    this.legalMoves = [];
                    this.lastMove = null;
                    this.lastMoveTimeMs = 0;
                    if (this.fadeAnimationId) {
                        cancelAnimationFrame(this.fadeAnimationId);
                        this.fadeAnimationId = null;
                    }
                    this.draw();
                    scoreElement.textContent = 'Your Turn (White)';
                }, 100);
                
                canvas.addEventListener('click', this.clickHandler = (e) => this.handleClick(e));
                canvas.addEventListener('mousemove', this.mouseMoveHandler = (e) => this.handleMouseMove(e));
            }

            cleanup() {
                if (this.animationId) cancelAnimationFrame(this.animationId);
                canvas.removeEventListener('click', this.clickHandler);
                canvas.removeEventListener('mousemove', this.mouseMoveHandler);
                canvas.classList.remove('chess-board');
                this.matchStarted = false;
                this.difficultyLocked = false;
            }

            reset() {
                // Stop current game and clean up
                this.cleanup();
                
                // Reset game state
                gameState.score = 0;
                gameState.isPaused = false;
                gameState.isGameOver = false;
                pauseOverlay.classList.remove('show');
                gameOverOverlay.classList.remove('show');
                scoreElement.textContent = 'Your Turn (White)';
                
                // Reinitialize
                this.init();
            }

            isDifficultySelectionLocked() {
                return this.difficultyLocked;
            }

            setDifficulty(mode) {
                const allowed = ['easy', 'medium', 'hard'];
                const normalized = allowed.includes(mode) ? mode : 'easy';
                this.difficulty = normalized;
                if (difficultySelect.value !== normalized) {
                    difficultySelect.value = normalized;
                }
            }

            prepareDifficultySelectionWindow() {
                this.matchStarted = false;
                this.difficultyLocked = false;
                this.setDifficulty(this.difficulty || difficultySelect.value || 'easy');
                difficultyUI.showSetup();
            }

            lockDifficultySelectionForMatch() {
                if (this.difficultyLocked) return;
                this.difficultyLocked = true;
                this.matchStarted = true;
                difficultyUI.lock();
            }

            initBoard() {
                // Initialize chess board with pieces
                // Lowercase = black, Uppercase = white
                this.board = [
                    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
                    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
                    [null, null, null, null, null, null, null, null],
                    [null, null, null, null, null, null, null, null],
                    [null, null, null, null, null, null, null, null],
                    [null, null, null, null, null, null, null, null],
                    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
                    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
                ];
            }
            
            handleMouseMove(e) {
                if (this.gameOver || this.thinking || this.squareSize === 0) return;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const boardStartX = 20;
                const boardStartY = 15;
                
                const col = Math.floor((x - boardStartX) / this.squareSize);
                const row = Math.floor((y - boardStartY) / this.squareSize);
                
                if (col >= 0 && col < 8 && row >= 0 && row < 8) {
                    this.hoveredSquare = { row, col };
                } else {
                    this.hoveredSquare = null;
                }
                
                this.draw();
            }
            
            calculateLegalMoves(row, col) {
                const legalMoves = [];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        if (this.isValidMove(row, col, r, c)) {
                            legalMoves.push({ row: r, col: c });
                        }
                    }
                }
                return legalMoves;
            }

            handleClick(e) {
                if (this.gameOver || this.thinking || !this.isPlayerTurn || this.squareSize === 0) return;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const boardStartX = 20;
                const boardStartY = 15;
                
                const col = Math.floor((x - boardStartX) / this.squareSize);
                const row = Math.floor((y - boardStartY) / this.squareSize);
                
                if (col < 0 || col >= 8 || row < 0 || row >= 8) return;

                if (this.selectedSquare) {
                    const { row: fromRow, col: fromCol } = this.selectedSquare;
                    if (this.isValidMove(fromRow, fromCol, row, col)) {
                        if (!this.matchStarted) {
                            this.lockDifficultySelectionForMatch();
                        }
                        this.makeMove(fromRow, fromCol, row, col);
                        this.selectedSquare = null;
                        this.legalMoves = [];
                        this.isPlayerTurn = false;
                        scoreElement.textContent = 'AI Thinking...';
                        setTimeout(() => this.makeAIMove(), 500);
                    } else {
                        const piece = this.board[row][col];
                        if (piece && piece === piece.toUpperCase()) {
                            this.selectedSquare = { row, col };
                            this.legalMoves = this.calculateLegalMoves(row, col);
                        } else {
                            this.selectedSquare = null;
                            this.legalMoves = [];
                        }
                    }
                } else {
                    const piece = this.board[row][col];
                    if (piece && piece === piece.toUpperCase()) {
                        this.selectedSquare = { row, col };
                        this.legalMoves = this.calculateLegalMoves(row, col);
                    }
                }
                this.draw();
            }

            isValidMove(fromRow, fromCol, toRow, toCol) {
                const piece = this.board[fromRow][fromCol];
                if (!piece) return false;
                // Must actually move
                if (fromRow === toRow && fromCol === toCol) return false;
                
                // Must be player's piece (uppercase = white)
                if (piece !== piece.toUpperCase()) return false;
                
                const targetPiece = this.board[toRow][toCol];
                // Can't capture own piece
                if (targetPiece && targetPiece === targetPiece.toUpperCase()) {
                    return false;
                }
                
                // Check piece-specific movement rules
                return this.isValidPieceMove(piece, fromRow, fromCol, toRow, toCol);
            }

            isValidPieceMove(piece, fromRow, fromCol, toRow, toCol) {
                const rowDiff = toRow - fromRow;
                const colDiff = toCol - fromCol;
                const pieceUpper = piece.toUpperCase();
                // Disallow zero-distance moves (already guarded, but keep for clarity)
                if (rowDiff === 0 && colDiff === 0) return false;

                switch (pieceUpper) {
                    case 'P': // Pawn
                        return this.isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, rowDiff, colDiff);
                    case 'R': // Rook
                        return this.isValidRookMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff);
                    case 'N': // Knight
                        return this.isValidKnightMove(rowDiff, colDiff);
                    case 'B': // Bishop
                        return this.isValidBishopMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff);
                    case 'Q': // Queen
                        return this.isValidQueenMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff);
                    case 'K': // King
                        return this.isValidKingMove(rowDiff, colDiff);
                    default:
                        return false;
                }
            }

            isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
                const isWhite = piece === 'P';
                const targetPiece = this.board[toRow][toCol];
                const startRow = isWhite ? 6 : 1; // Starting row for pawns
                const dir = isWhite ? -1 : 1; // movement direction
                
                // Forward move (no capture)
                if (colDiff === 0 && !targetPiece) {
                    // Single step
                    if (rowDiff === dir) return true;
                    // Double step from starting rank if path is clear
                    if (fromRow === startRow && rowDiff === 2 * dir) {
                        const midRow = fromRow + dir;
                        if (this.board[midRow][fromCol] === null) return true;
                    }
                }
                // Diagonal capture
                if (Math.abs(colDiff) === 1 && rowDiff === dir && targetPiece) {
                    return true;
                }
                return false;
            }

            isValidRookMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
                // Rook moves horizontally or vertically
                if (rowDiff !== 0 && colDiff !== 0) return false;
                
                // Check if path is clear
                return this.isPathClear(fromRow, fromCol, toRow, toCol);
            }

            isValidKnightMove(rowDiff, colDiff) {
                // Knight moves in L-shape: 2 squares one direction, 1 square perpendicular
                const absRow = Math.abs(rowDiff);
                const absCol = Math.abs(colDiff);
                return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
            }

            isValidBishopMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
                // Bishop moves diagonally
                if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
                
                // Check if path is clear
                return this.isPathClear(fromRow, fromCol, toRow, toCol);
            }

            isValidQueenMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
                // Queen combines rook and bishop movement
                const isDiagonal = Math.abs(rowDiff) === Math.abs(colDiff);
                const isStraight = (rowDiff === 0 || colDiff === 0);
                
                if (!isDiagonal && !isStraight) return false;
                
                return this.isPathClear(fromRow, fromCol, toRow, toCol);
            }

            isValidKingMove(rowDiff, colDiff) {
                // King moves one square in any direction
                return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
            }

            isPathClear(fromRow, fromCol, toRow, toCol) {
                const rowStep = toRow === fromRow ? 0 : (toRow > fromRow ? 1 : -1);
                const colStep = toCol === fromCol ? 0 : (toCol > fromCol ? 1 : -1);
                
                let currentRow = fromRow + rowStep;
                let currentCol = fromCol + colStep;
                
                // Check all squares along the path except the destination
                while (currentRow !== toRow || currentCol !== toCol) {
                    if (this.board[currentRow][currentCol] !== null) {
                        return false; // Path is blocked
                    }
                    currentRow += rowStep;
                    currentCol += colStep;
                }
                
                return true; // Path is clear
            }

            makeMove(fromRow, fromCol, toRow, toCol) {
                const piece = this.board[fromRow][fromCol];
                const capturedPiece = this.board[toRow][toCol];
                
                // Track captured pieces
                if (capturedPiece) {
                    if (capturedPiece === capturedPiece.toUpperCase()) {
                        this.capturedPieces.black.push(capturedPiece);
                    } else {
                        this.capturedPieces.white.push(capturedPiece);
                    }
                }
                
                this.board[toRow][toCol] = piece;
                this.board[fromRow][fromCol] = null;
                this.lastMove = { fromRow, fromCol, toRow, toCol };
                this.lastMoveTimeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                this.startFadeAnimation();
                this.moves.push(\`\${fromRow}\${fromCol}\${toRow}\${toCol}\`);
                
                const blackKing = this.findKing('k');
                const whiteKing = this.findKing('K');
                if (!blackKing || !whiteKing) {
                    this.gameOver = true;
                    gameState.isGameOver = true;
                    const winner = whiteKing ? 'White' : 'Black';
                    finalScoreElement.textContent = \`\${winner} Wins!\`;
                    gameOverOverlay.classList.add('show');
                }
            }

            findKing(king) {
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        if (this.board[r][c] === king) {
                            return { row: r, col: c };
                        }
                    }
                }
                return null;
            }

            getDifficultyProfile(settingsOverride) {
                const settings = settingsOverride || this.getDifficultySettings() || {};
                const type = (settings.type || this.difficulty || 'easy').toLowerCase();

                if (type === 'random') {
                    return { strategy: 'random' };
                }

                if (type === 'heuristic') {
                    return {
                        strategy: 'heuristic',
                        preferAggressive: !!settings.preferAggressive
                    };
                }

                const profile = {
                    strategy: 'search',
                    depth: Number.isFinite(settings.depth) ? settings.depth : (this.difficulty === 'hard' ? 5 : 3),
                    timeLimitMs: settings.maxTimeMs ?? settings.timeLimitMs ?? this.maxEngineTimeMs,
                    mixRandomness: typeof settings.mixRandomness === 'number'
                        ? settings.mixRandomness
                        : (this.difficulty === 'medium' ? 0.2 : 0),
                    allowHeuristicFallback: settings.allowHeuristicFallback !== undefined
                        ? settings.allowHeuristicFallback
                        : true,
                    preferAggressive: settings.preferAggressive !== undefined
                        ? settings.preferAggressive
                        : (this.difficulty === 'hard')
                };

                return profile;
            }

            async makeAIMove() {
                if (this.gameOver || this.isPlayerTurn) return;
                const abortSignal = this.createAbortSignal();
                const settings = this.getDifficultySettings();
                const label = (settings && settings.label) || 'AI';
                const profile = this.getDifficultyProfile(settings);

                this.thinking = true;
                scoreElement.textContent = 'AI Thinking (' + label + ')...';
                this.draw();

                try {
                    if (profile.strategy === 'random') {
                        this.makeRandomMove();
                    } else if (profile.strategy === 'heuristic') {
                        const move = this.chooseHeuristicMove({ preferAggressive: profile.preferAggressive });
                        if (move) {
                            this.executeAIMove(move);
                        } else {
                            this.makeRandomMove();
                        }
                    } else {
                        let move = null;
                        if (profile.mixRandomness && Math.random() < profile.mixRandomness) {
                            move = this.chooseHeuristicMove({ preferAggressive: profile.preferAggressive });
                        }
                        if (!move) {
                            move = await this.getEngineMove(profile, abortSignal);
                        }
                        if (abortSignal.aborted || this.gameOver) {
                            return;
                        }
                        if (!move && profile.allowHeuristicFallback) {
                            move = this.chooseHeuristicMove({ preferAggressive: profile.preferAggressive });
                        }

                        if (move) {
                            const executed = this.executeAIMove(move);
                            if (!executed) {
                                this.makeRandomMove();
                            }
                        } else {
                            this.makeRandomMove();
                        }
                    }
                } catch (error) {
                    if (!abortSignal.aborted) {
                        console.error('AI move error:', error);
                        this.makeRandomMove();
                    }
                } finally {
                    if (abortSignal.aborted) {
                        return;
                    }
                    this.thinking = false;
                    this.aiAbortController = null;
                    this.isPlayerTurn = true;
                    if (!this.gameOver) {
                        scoreElement.textContent = 'Your Turn (White)';
                    }
                    this.draw();
                }
            }

            async getEngineMove(searchOptions = {}, abortSignal) {
                if (window.Chess) {
                    try {
                        const fen = this.boardToFEN();
                        const moveUci = this.getBestMoveWithChessJs(
                            fen,
                            searchOptions,
                            abortSignal
                        );
                        if (abortSignal?.aborted) {
                            return null;
                        }
                        if (moveUci) {
                            return this.algebraicToCoordinates(moveUci);
                        }
                    } catch (e) {
                        if (!abortSignal?.aborted) {
                            console.error('chess.js engine error:', e);
                        }
                    }
                }

                if (abortSignal?.aborted) {
                    return null;
                }

                const alt = this.chooseHeuristicMove();
                if (alt) return alt;
                return this.makeRandomMove(false);
            }

            getBestMoveWithChessJs(fen, options = {}, abortSignal) {
                if (!window.Chess) return null;
                const ChessEngine = window.Chess;
                const {
                    depth = 3,
                    timeLimitMs = 1000,
                    preferAggressive = false
                } = options;

                const game = new ChessEngine(fen);
                const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
                const searchStart = now();
                const limit = Math.max(200, timeLimitMs || 1000);
                const hasTimeLeft = () => {
                    if (abortSignal?.aborted) return false;
                    return (now() - searchStart) < limit;
                };
                let timedOut = false;

                const getPassedPawnBonus = (boardState, row, col, color) => {
                    let blocked = false;
                    if (color === 'b') {
                        for (let r = row + 1; r < 8 && !blocked; r++) {
                            for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
                                const sq = boardState[r][c];
                                if (sq && sq.type === 'p' && sq.color === 'w') {
                                    blocked = true;
                                    break;
                                }
                            }
                        }
                        if (blocked) return 0;
                        return row * 6;
                    } else {
                        for (let r = row - 1; r >= 0 && !blocked; r--) {
                            for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
                                const sq = boardState[r][c];
                                if (sq && sq.type === 'p' && sq.color === 'b') {
                                    blocked = true;
                                    break;
                                }
                            }
                        }
                        if (blocked) return 0;
                        return (7 - row) * 6;
                    }
                };

                const evaluateGame = (g) => {
                    if (g.isCheckmate()) {
                        return g.turn() === 'b' ? -999999 : 999999;
                    }
                    if (g.isDraw() || g.isStalemate() || g.isInsufficientMaterial()) {
                        return 0;
                    }

                    const board = g.board();
                    let score = 0;
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const sq = board[r][c];
                            if (!sq) continue;
                            const idx = r * 8 + c;
                            const positionalTable = CHESS_PST[sq.type];
                            const positional = positionalTable
                                ? positionalTable[sq.color === 'w' ? mirrorIndex64(idx) : idx]
                                : 0;
                            let total = (CHESS_PIECE_VALUES[sq.type] || 0) + positional;
                            if (sq.type === 'p') {
                                total += getPassedPawnBonus(board, r, c, sq.color);
                            }
                            if (preferAggressive && sq.color === 'b' && (sq.type === 'q' || sq.type === 'r')) {
                                total += 5;
                            }
                            score += sq.color === 'b' ? total : -total;
                        }
                    }
                    return score;
                };

                const scoreMoveForOrdering = (move) => {
                    let score = 0;
                    if (move.captured) {
                        score += (CHESS_PIECE_VALUES[move.captured] || 0) * 10;
                        score -= (CHESS_PIECE_VALUES[move.piece] || 0);
                    }
                    if (move.promotion) {
                        score += (CHESS_PIECE_VALUES[move.promotion] || 0) + 30;
                    }
                    const file = move.to.charCodeAt(0) - 97;
                    const rank = parseInt(move.to[1], 10) - 1;
                    const centrality = 4 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
                    score += centrality * (preferAggressive ? 3 : 1);
                    if (move.flags && move.flags.includes('c')) {
                        score += 4;
                    }
                    if (move.flags && move.flags.includes('k')) {
                        score += 2;
                    }
                    return score;
                };

                const orderMoves = (moves) => {
                    return moves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));
                };

                const minimax = (g, d, alpha, beta, isMax) => {
                    if (!hasTimeLeft()) {
                        timedOut = true;
                        return evaluateGame(g);
                    }
                    if (d === 0 || g.isGameOver()) {
                        return evaluateGame(g);
                    }
                    const moves = orderMoves(g.moves({ verbose: true }));
                    if (isMax) {
                        let maxEval = -Infinity;
                        for (const m of moves) {
                            g.move(m);
                            const evalv = minimax(g, d - 1, alpha, beta, false);
                            g.undo();
                            if (evalv > maxEval) maxEval = evalv;
                            if (evalv > alpha) alpha = evalv;
                            if (beta <= alpha || !hasTimeLeft()) break;
                        }
                        return maxEval;
                    } else {
                        let minEval = Infinity;
                        for (const m of moves) {
                            g.move(m);
                            const evalv = minimax(g, d - 1, alpha, beta, true);
                            g.undo();
                            if (evalv < minEval) minEval = evalv;
                            if (evalv < beta) beta = evalv;
                            if (beta <= alpha || !hasTimeLeft()) break;
                        }
                        return minEval;
                    }
                };

                const rootMoves = orderMoves(game.moves({ verbose: true }));
                if (!rootMoves.length) return null;
                let best = null;
                let bestScore = -Infinity;

                for (const m of rootMoves) {
                    if (!hasTimeLeft() && best) break;
                    game.move(m);
                    const score = minimax(game, Math.max(0, (depth || 1) - 1), -Infinity, Infinity, false);
                    game.undo();
                    if (score > bestScore) {
                        bestScore = score;
                        best = m;
                    }
                    if (timedOut && best) {
                        break;
                    }
                }

                if (!best && rootMoves.length) {
                    best = rootMoves[0];
                }

                return best ? (best.from + best.to + (best.promotion || '')) : null;
            }

            boardToFEN() {
                // Convert board array to FEN notation
                // Our board: rows 0-7 (row 0 = top/black's back rank), cols 0-7
                // FEN: starts from rank 8 (top, black's back rank) to rank 1 (bottom, white's back rank)
                // So row 0 in our board = rank 8 in FEN, row 7 = rank 1
                let fen = '';
                
                // Build the position string (ranks 8 to 1)
                // Note: our row 0 is FEN rank 8 (top), row 7 is FEN rank 1 (bottom)
                for (let row = 0; row < 8; row++) {
                    let emptyCount = 0;
                    for (let col = 0; col < 8; col++) {
                        const piece = this.board[row][col];
                        if (piece === null) {
                            emptyCount++;
                        } else {
                            if (emptyCount > 0) {
                                fen += emptyCount;
                                emptyCount = 0;
                            }
                            // FEN uses uppercase for white, lowercase for black
                            fen += piece;
                        }
                    }
                    if (emptyCount > 0) {
                        fen += emptyCount;
                    }
                    if (row < 7) fen += '/';
                }
                
                // Side to move: black to move (b) since AI is black
                fen += ' b';
                
                // Castling rights: check if kings and rooks are in starting positions
                let castling = '';
                // White king at e1 (row 7, col 4)
                if (this.board[7][4] === 'K') {
                    if (this.board[7][7] === 'R') castling += 'K';
                    if (this.board[7][0] === 'R') castling += 'Q';
                }
                // Black king at e8 (row 0, col 4)
                if (this.board[0][4] === 'k') {
                    if (this.board[0][7] === 'r') castling += 'k';
                    if (this.board[0][0] === 'r') castling += 'q';
                }
                fen += ' ' + (castling || '-');
                
                // En passant: none for simplicity (could track from last move)
                fen += ' -';
                
                // Halfmove clock (moves since last capture/pawn move)
                fen += ' 0';
                
                // Fullmove number (increments after black moves)
                const moveNumber = Math.floor(this.moves.length / 2) + 1;
                fen += ' ' + moveNumber;
                
                return fen;
            }

            algebraicToCoordinates(algebraic) {
                // Convert algebraic notation like 'e2e4' to {fromRow, fromCol, toRow, toCol}
                // Format: [a-h][1-8][a-h][1-8] or [a-h][1-8][a-h][1-8][qrnb] for promotion
                const match = algebraic.match(/^([a-h])([1-8])([a-h])([1-8])([qrnb])?$/);
                if (!match) {
                    console.error('Invalid algebraic notation:', algebraic);
                    return null;
                }

                const fromCol = match[1].charCodeAt(0) - 97; // a=0, b=1, ..., h=7
                const fromRow = 8 - parseInt(match[2]); // 1=7, 2=6, ..., 8=0 (FEN is top to bottom)
                const toCol = match[3].charCodeAt(0) - 97;
                const toRow = 8 - parseInt(match[4]);

                return {
                    fromRow: fromRow,
                    fromCol: fromCol,
                    toRow: toRow,
                    toCol: toCol
                };
            }

            getAllAIMoves() {
                const moves = [];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const piece = this.board[r][c];
                        if (!piece || piece !== piece.toLowerCase()) continue;
                        for (let tr = 0; tr < 8; tr++) {
                            for (let tc = 0; tc < 8; tc++) {
                                if (this.isValidAIMove(r, c, tr, tc)) {
                                    moves.push({
                                        fromRow: r,
                                        fromCol: c,
                                        toRow: tr,
                                        toCol: tc,
                                        capture: this.board[tr][tc]
                                    });
                                }
                            }
                        }
                    }
                }
                return moves;
            }

            makeRandomMove(applyImmediately = true) {
                const moves = this.getAllAIMoves();
                if (!moves.length) return null;
                const move = moves[Math.floor(Math.random() * moves.length)];
                if (applyImmediately) {
                    this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                }
                return move;
            }

            chooseHeuristicMove(options = {}) {
                const { preferAggressive = false } = options;
                const captures = [];
                const others = [];
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const piece = this.board[r][c];
                        if (piece && piece === piece.toLowerCase()) {
                            for (let tr = 0; tr < 8; tr++) {
                                for (let tc = 0; tc < 8; tc++) {
                                    if (this.isValidAIMove(r, c, tr, tc)) {
                                        const targetPiece = this.board[tr][tc];
                                        const isCapture = !!(targetPiece && targetPiece === targetPiece.toUpperCase());
                                        const move = { fromRow: r, fromCol: c, toRow: tr, toCol: tc };
                                        if (preferAggressive) {
                                            const captureValue = isCapture ? this.getPieceValueFromSymbol(targetPiece) : 0;
                                            const advancement = piece === 'p' ? (tr - r) : 0;
                                            move.priority = captureValue * 2 + this.getCentralityScore(tr, tc) + advancement;
                                        }
                                        (isCapture ? captures : others).push(move);
                                    }
                                }
                            }
                        }
                    }
                }
                if (captures.length) {
                    if (preferAggressive) {
                        captures.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                        return captures[0];
                    }
                    return captures[Math.floor(Math.random() * captures.length)];
                }
                if (others.length) {
                    if (preferAggressive) {
                        others.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                        return others[0];
                    }
                    return others[Math.floor(Math.random() * others.length)];
                }
                return null;
            }

            getPieceValueFromSymbol(symbol) {
                if (!symbol) return 0;
                return CHESS_PIECE_VALUES[symbol.toLowerCase()] || 0;
            }

            getCentralityScore(row, col) {
                return 4 - (Math.abs(3.5 - col) + Math.abs(3.5 - row));
            }

            isValidAIMove(fromRow, fromCol, toRow, toCol) {
                const piece = this.board[fromRow][fromCol];
                if (!piece) return false;
                
                // Must be AI's piece (lowercase = black)
                if (piece !== piece.toLowerCase()) return false;
                
                const targetPiece = this.board[toRow][toCol];
                // Can't capture own piece
                if (targetPiece && targetPiece === targetPiece.toLowerCase()) {
                    return false;
                }
                
                // Use same validation logic as player moves
                return this.isValidPieceMove(piece, fromRow, fromCol, toRow, toCol);
            }

            executeAIMove(move) {
                if (!move) {
                    console.error('executeAIMove: move is null/undefined');
                    return false;
                }
                
                if (typeof move === 'string') {
                    // Parse algebraic notation if needed
                    console.error('executeAIMove: string moves not yet supported');
                    return false;
                }
                
                const { fromRow, fromCol, toRow, toCol } = move;
                
                // Validate the move before executing
                if (!this.isValidAIMove(fromRow, fromCol, toRow, toCol)) {
                    console.error('executeAIMove: Invalid move attempted', move);
                    console.error('Piece at source:', this.board[fromRow] && this.board[fromRow][fromCol]);
                    console.error('Target square:', this.board[toRow] && this.board[toRow][toCol]);
                    return false;
                }
                
                this.makeMove(fromRow, fromCol, toRow, toCol);
                return true;
            }

            draw() {
                if (this.squareSize === 0) return; // Wait for initialization
                
                ctx.fillStyle = '#1c2128';
                ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());

                const boardStartX = 20;
                const boardStartY = 15;
                
                // Draw file labels (a-h) at the top
                ctx.fillStyle = '#768390';
                ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                for (let i = 0; i < 8; i++) {
                    ctx.fillText(files[i], boardStartX + i * this.squareSize + this.squareSize / 2, 8);
                }
                
                // Draw rank labels (8-1) on the left
                for (let i = 0; i < 8; i++) {
                    ctx.fillText(String(8 - i), 10, boardStartY + i * this.squareSize + this.squareSize / 2);
                }

                // Draw board squares
                // Precompute last move fade alpha
                let lastMoveAlpha = 0;
                if (this.lastMove && this.lastMoveTimeMs) {
                    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                    const elapsed = now - this.lastMoveTimeMs;
                    const t = Math.min(1, Math.max(0, elapsed / (this.fadeDurationMs || 1200)));
                    lastMoveAlpha = 1 - t;
                }
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const x = boardStartX + c * this.squareSize;
                        const y = boardStartY + r * this.squareSize;
                        
                        // Base square color (clean 2-bit aesthetic)
                        ctx.fillStyle = (r + c) % 2 === 0 ? '#373e47' : '#2d333b';
                        ctx.fillRect(x, y, this.squareSize, this.squareSize);
                        
                        // Last move highlights (from/to) as fading outlines
                        if (this.lastMove && lastMoveAlpha > 0) {
                            const isFrom = this.lastMove.fromRow === r && this.lastMove.fromCol === c;
                            const isTo = this.lastMove.toRow === r && this.lastMove.toCol === c;
                            if (isFrom || isTo) {
                                const lineW = Math.max(2, Math.floor(this.squareSize * 0.08));
                                ctx.lineWidth = lineW;
                                // From = amber, To = accent green
                                const a = Math.max(0, Math.min(1, lastMoveAlpha * 0.9));
                                ctx.strokeStyle = isFrom
                                    ? ('rgba(246, 193, 77, ' + a + ')')
                                    : ('rgba(87, 171, 90, ' + a + ')');
                                // inset the stroke so it’s visible inside the square bounds
                                const inset = Math.max(1, Math.floor(lineW / 2));
                                ctx.strokeRect(x + inset, y + inset, this.squareSize - inset * 2, this.squareSize - inset * 2);
                            }
                        }
                        
                        // Hover effect
                        if (this.hoveredSquare && this.hoveredSquare.row === r && this.hoveredSquare.col === c) {
                            ctx.fillStyle = 'rgba(173, 186, 199, 0.1)';
                            ctx.fillRect(x, y, this.squareSize, this.squareSize);
                        }
                        
                        // Selected square highlight
                        if (this.selectedSquare && this.selectedSquare.row === r && this.selectedSquare.col === c) {
                            ctx.fillStyle = 'rgba(87, 171, 90, 0.4)';
                            ctx.fillRect(x, y, this.squareSize, this.squareSize);
                        }
                        
                        // Legal move indicators
                        const isLegalMove = this.legalMoves.some(m => m.row === r && m.col === c);
                        if (isLegalMove) {
                            const targetPiece = this.board[r][c];
                            if (targetPiece) {
                                // Capture indicator - ring around square
                                ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
                                ctx.lineWidth = 2;
                                ctx.strokeRect(x + 2, y + 2, this.squareSize - 4, this.squareSize - 4);
                            } else {
                                // Empty square indicator - small dot
                                ctx.fillStyle = 'rgba(173, 186, 199, 0.4)';
                                ctx.beginPath();
                                ctx.arc(x + this.squareSize / 2, y + this.squareSize / 2, this.squareSize * 0.15, 0, Math.PI * 2);
                                ctx.fill();
                            }
                        }
                        
                        // Draw pieces
                        const piece = this.board[r][c];
                        if (piece) {
                            // Color pieces: white = light, black = dark
                            ctx.fillStyle = piece === piece.toUpperCase() ? '#e6edf3' : '#636e7b';
                            ctx.font = \`\${this.squareSize * 0.7}px Arial\`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(this.getPieceSymbol(piece), x + this.squareSize / 2, y + this.squareSize / 2);
                        }
                    }
                }
                
                // Draw captured pieces
                const capturedStartX = boardStartX + this.squareSize * 8 + 8;
                const pieceSize = 12;
                
                // Captured by white (display black pieces)
                ctx.fillStyle = '#768390';
                ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Captured:', capturedStartX, boardStartY + 8);
                
                let yOffset = boardStartY + 18;
                for (let i = 0; i < this.capturedPieces.white.length; i++) {
                    ctx.fillStyle = '#636e7b';
                    ctx.font = \`\${pieceSize}px Arial\`;
                    ctx.fillText(this.getPieceSymbol(this.capturedPieces.white[i]), capturedStartX, yOffset);
                    yOffset += pieceSize + 2;
                }
                
                // Captured by black (display white pieces)
                yOffset = boardStartY + this.squareSize * 4 + 10;
                for (let i = 0; i < this.capturedPieces.black.length; i++) {
                    ctx.fillStyle = '#e6edf3';
                    ctx.font = \`\${pieceSize}px Arial\`;
                    ctx.fillText(this.getPieceSymbol(this.capturedPieces.black[i]), capturedStartX, yOffset);
                    yOffset += pieceSize + 2;
                }

                // Thinking overlay
                if (this.thinking) {
                    ctx.fillStyle = 'rgba(28, 33, 40, 0.85)';
                    ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());
                    ctx.fillStyle = '#adbac7';
                    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('AI thinking...', getCanvasWidth() / 2, getCanvasHeight() / 2);
                }
            }

            getPieceSymbol(piece) {
                const symbols = {
                    'p': '♟', 'P': '♙',
                    'r': '♜', 'R': '♖',
                    'n': '♞', 'N': '♘',
                    'b': '♝', 'B': '♗',
                    'q': '♛', 'Q': '♕',
                    'k': '♚', 'K': '♔'
                };
                return symbols[piece] || '';
            }
        }

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
                    finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
                    gameOverOverlay.classList.add('show');
                    return;
                }

                // Check self collision
                if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
                    gameState.isGameOver = true;
                    finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
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
                    
                    if (this.isGameOver()) {
                        gameState.isGameOver = true;
                        finalScoreElement.textContent = \`Final Score: \${gameState.score}\`;
                        gameOverOverlay.classList.add('show');
                    }
                }
            }

            addRandomTile() {
                const emptyCells = [];
                for (let r = 0; r < this.gridSize; r++) {
                    for (let c = 0; c < this.gridSize; c++) {
                        if (this.grid[r][c] === 0) {
                            emptyCells.push({ r, c });
                        }
                    }
                }
                if (emptyCells.length > 0) {
                    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
                }
            }

            moveLeft() {
                for (let r = 0; r < this.gridSize; r++) {
                    const row = this.grid[r].filter(val => val !== 0);
                    const newRow = [];
                    let i = 0;
                    while (i < row.length) {
                        if (i + 1 < row.length && row[i] === row[i + 1]) {
                            newRow.push(row[i] * 2);
                            gameState.score += row[i] * 2;
                            i += 2;
                            this.moved = true;
                        } else {
                            newRow.push(row[i]);
                            i++;
                        }
                    }
                    while (newRow.length < this.gridSize) newRow.push(0);
                    if (JSON.stringify(this.grid[r]) !== JSON.stringify(newRow)) this.moved = true;
                    this.grid[r] = newRow;
                }
                if (this.moved) updateScore();
            }

            moveRight() {
                for (let r = 0; r < this.gridSize; r++) {
                    const row = this.grid[r].filter(val => val !== 0);
                    const newRow = [];
                    let i = row.length - 1;
                    while (i >= 0) {
                        if (i - 1 >= 0 && row[i] === row[i - 1]) {
                            newRow.unshift(row[i] * 2);
                            gameState.score += row[i] * 2;
                            i -= 2;
                            this.moved = true;
                        } else {
                            newRow.unshift(row[i]);
                            i--;
                        }
                    }
                    while (newRow.length < this.gridSize) newRow.unshift(0);
                    if (JSON.stringify(this.grid[r]) !== JSON.stringify(newRow)) this.moved = true;
                    this.grid[r] = newRow;
                }
                if (this.moved) updateScore();
            }

            moveUp() {
                for (let c = 0; c < this.gridSize; c++) {
                    const col = [];
                    for (let r = 0; r < this.gridSize; r++) {
                        if (this.grid[r][c] !== 0) col.push(this.grid[r][c]);
                    }
                    const newCol = [];
                    let i = 0;
                    while (i < col.length) {
                        if (i + 1 < col.length && col[i] === col[i + 1]) {
                            newCol.push(col[i] * 2);
                            gameState.score += col[i] * 2;
                            i += 2;
                            this.moved = true;
                        } else {
                            newCol.push(col[i]);
                            i++;
                        }
                    }
                    while (newCol.length < this.gridSize) newCol.push(0);
                    let changed = false;
                    for (let r = 0; r < this.gridSize; r++) {
                        if (this.grid[r][c] !== newCol[r]) changed = true;
                        this.grid[r][c] = newCol[r];
                    }
                    if (changed) this.moved = true;
                }
                if (this.moved) updateScore();
            }

            moveDown() {
                for (let c = 0; c < this.gridSize; c++) {
                    const col = [];
                    for (let r = 0; r < this.gridSize; r++) {
                        if (this.grid[r][c] !== 0) col.push(this.grid[r][c]);
                    }
                    const newCol = [];
                    let i = col.length - 1;
                    while (i >= 0) {
                        if (i - 1 >= 0 && col[i] === col[i - 1]) {
                            newCol.unshift(col[i] * 2);
                            gameState.score += col[i] * 2;
                            i -= 2;
                            this.moved = true;
                        } else {
                            newCol.unshift(col[i]);
                            i--;
                        }
                    }
                    while (newCol.length < this.gridSize) newCol.unshift(0);
                    let changed = false;
                    for (let r = 0; r < this.gridSize; r++) {
                        if (this.grid[r][c] !== newCol[r]) changed = true;
                        this.grid[r][c] = newCol[r];
                    }
                    if (changed) this.moved = true;
                }
                if (this.moved) updateScore();
            }

            isGameOver() {
                // Check for empty cells
                for (let r = 0; r < this.gridSize; r++) {
                    for (let c = 0; c < this.gridSize; c++) {
                        if (this.grid[r][c] === 0) return false;
                    }
                }
                // Check for possible merges
                for (let r = 0; r < this.gridSize; r++) {
                    for (let c = 0; c < this.gridSize; c++) {
                        const val = this.grid[r][c];
                        if (r < this.gridSize - 1 && this.grid[r + 1][c] === val) return false;
                        if (c < this.gridSize - 1 && this.grid[r][c + 1] === val) return false;
                    }
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
                            ctx.font = \`bold \${this.cellSize * 0.35}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif\`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(value, x + this.cellSize / 2, y + this.cellSize / 2);
                        }
                    }
                }
            }
        }
    </script>
</body>
</html>`;
}

function getNonce() {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

function deactivate() {
  if (gameViewProvider) {
    gameViewProvider.dispose();
    gameViewProvider = undefined;
  }
}

module.exports = {
  activate,
  deactivate,
};
