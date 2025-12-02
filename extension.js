const vscode = require("vscode");
const path = require("path");

const HIGH_SCORE_STORAGE_KEY = "minigames.highScores";
const TRACKED_HIGH_SCORE_GAMES = new Set([
  "spaceShooter",
  "runner",
  "breakout",
  "snake",
  "2048",
]);

function sanitizeScore(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function getStoredHighScores(context) {
  return context.globalState.get(HIGH_SCORE_STORAGE_KEY, {});
}

async function updateStoredHighScores(context, scores) {
  await context.globalState.update(HIGH_SCORE_STORAGE_KEY, scores);
}

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
        vscode.Uri.file(path.join(this._context.extensionPath, "webview")),
      ],
    };

    // Prepare local URIs for scripts
    const chessJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, ".media", "chess.js")
      )
    );

    const chessGameJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, "webview", "games", "chess.js")
      )
    );

    const spaceShooterJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this._context.extensionPath,
          "webview",
          "games",
          "spaceshooter.js"
        )
      )
    );

    const runnerJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, "webview", "games", "runner.js")
      )
    );

    const breakoutJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this._context.extensionPath,
          "webview",
          "games",
          "breakout.js"
        )
      )
    );

    const snakeJsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, "webview", "games", "snake.js")
      )
    );

    const game2048JsUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(
          this._context.extensionPath,
          "webview",
          "games",
          "game2048.js"
        )
      )
    );

    const nonce = getNonce();
    webview.html = getGameHTML({
      chessJsSrc: String(chessJsUri),
      chessGameJsSrc: String(chessGameJsUri),
      spaceShooterJsSrc: String(spaceShooterJsUri),
      runnerJsSrc: String(runnerJsUri),
      breakoutJsSrc: String(breakoutJsUri),
      snakeJsSrc: String(snakeJsUri),
      game2048JsSrc: String(game2048JsUri),
      cspSource: webview.cspSource,
      nonce,
    });

    const sendHighScoreToWebview = (game, score) => {
      webview.postMessage({
        command: "highScoreData",
        payload: { game, score: sanitizeScore(score) },
      });
    };

    // Handle messages from the webview
    webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showInformationMessage(message.text);
            return;
          case "getHighScore": {
            const game = message.game;
            if (!TRACKED_HIGH_SCORE_GAMES.has(game)) {
              return;
            }
            const scores = getStoredHighScores(this._context);
            const current = sanitizeScore(scores[game] || 0);
            sendHighScoreToWebview(game, current);
            return;
          }
          case "reportScore": {
            const game = message.game;
            if (!TRACKED_HIGH_SCORE_GAMES.has(game)) {
              return;
            }
            const incoming = sanitizeScore(message.score);
            const scores = { ...getStoredHighScores(this._context) };
            const previous = sanitizeScore(scores[game] || 0);
            if (incoming > previous) {
              scores[game] = incoming;
              updateStoredHighScores(this._context, scores).catch((error) => {
                console.error("Failed to update high scores:", error);
              });
              sendHighScoreToWebview(game, incoming);
            } else {
              sendHighScoreToWebview(game, previous);
            }
            return;
          }
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

function getGameHTML({
  chessJsSrc,
  chessGameJsSrc,
  spaceShooterJsSrc,
  runnerJsSrc,
  breakoutJsSrc,
  snakeJsSrc,
  game2048JsSrc,
  cspSource,
  nonce,
}) {
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
            margin-left: 8px;
        }

        #gameTitle {
            font-size: 10px;
            font-weight: 500;
            color: #768390;
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
            text-align: center;
            max-width: 300px;
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
            currentGame: null
        };

        const chessDifficultyConfig = {
            easy: {
                type: 'heuristic',
                label: 'Easy',
                maxTimeMs: 100,
                mistakeChance: 0.45,
                preferAggressive: false,
                description: 'Quick moves with frequent mistakes - great for beginners.'
            },
            medium: {
                type: 'search',
                label: 'Medium',
                depth: 3,
                maxTimeMs: 800,
                mixRandomness: 0.12,
                allowHeuristicFallback: true,
                preferAggressive: false,
                mistakeChance: 0.10,
                useQuiescence: false,
                useNullMove: false,
                useOpeningBook: false,
                description: 'Fast, decent play with occasional mistakes.'
            },
            hard: {
                type: 'search',
                label: 'Hard',
                depth: 7,
                maxTimeMs: 5000,
                mixRandomness: 0,
                allowHeuristicFallback: true,
                preferAggressive: true,
                mistakeChance: 0,
                useQuiescence: true,
                useNullMove: true,
                useOpeningBook: true,
                description: 'Aggressive AI with opening book, deep search, and no mercy.'
            }
        };

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
        const pauseText = document.getElementById('pauseText');
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        const finalScoreElement = document.getElementById('finalScore');
        const gameMenu = document.getElementById('gameMenu');
        const helpOverlay = document.getElementById('helpOverlay');
        const helpContent = document.getElementById('helpContent');
        const closeHelpBtn = document.getElementById('closeHelpBtn');
        let logicalWidth = canvas.clientWidth || canvas.offsetWidth || 0;
        let logicalHeight = canvas.clientHeight || canvas.offsetHeight || 0;

        const trackedHighScoreGames = new Set(['spaceShooter', 'runner', 'breakout', 'snake', '2048']);

        let activeHighScoreGame = null;

        const highScoreManager = (() => {
            const scores = {};
            const pendingResolvers = {};

            const isTracked = (gameId) => trackedHighScoreGames.has(gameId);

            const ensureScore = (gameId) => {
                if (!isTracked(gameId)) {
                    return Promise.resolve(0);
                }
                if (scores[gameId] !== undefined) {
                    return Promise.resolve(scores[gameId]);
                }
                return new Promise((resolve) => {
                    pendingResolvers[gameId] = pendingResolvers[gameId] || [];
                    pendingResolvers[gameId].push(resolve);
                    vscode.postMessage({ command: 'getHighScore', game: gameId });
                });
            };

            const setScore = (gameId, value) => {
                if (!isTracked(gameId)) return;
                const sanitized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
                scores[gameId] = sanitized;
                if (pendingResolvers[gameId]) {
                    pendingResolvers[gameId].forEach((resolve) => resolve(sanitized));
                    pendingResolvers[gameId] = [];
                }
                if (activeHighScoreGame === gameId) {
                    updateScore();
                }
            };

            const getScore = (gameId) => {
                if (!isTracked(gameId)) return 0;
                return scores[gameId] ?? 0;
            };

            const reportScore = (gameId, value) => {
                if (!isTracked(gameId)) return;
                const sanitized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
                if (sanitized > (scores[gameId] ?? 0)) {
                    scores[gameId] = sanitized;
                }
                vscode.postMessage({ command: 'reportScore', game: gameId, score: sanitized });
                if (activeHighScoreGame === gameId) {
                    updateScore();
                }
            };

            const preloadAll = () => {
                trackedHighScoreGames.forEach((gameId) => {
                    ensureScore(gameId);
                });
            };

            return {
                isTracked,
                ensureScore,
                setScore,
                getScore,
                reportScore,
                preloadAll
            };
        })();

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg) return;
            if (msg.command === 'highScoreData' && msg.payload) {
                highScoreManager.setScore(msg.payload.game, msg.payload.score);
            }
        });

        highScoreManager.preloadAll();

        function setActiveHighScoreGame(gameId) {
            if (trackedHighScoreGames.has(gameId)) {
                activeHighScoreGame = gameId;
                highScoreManager.ensureScore(gameId).then(() => {
                    if (activeHighScoreGame === gameId) {
                        updateScore();
                    }
                });
            } else {
                activeHighScoreGame = null;
                updateScore();
            }
        }

        function formatScoreWithBest(label, score, gameId) {
            if (trackedHighScoreGames.has(gameId)) {
                const best = Math.max(score, highScoreManager.getScore(gameId));
                return \`\${label}: \${score} (Best: \${best})\`;
            }
            return \`\${label}: \${score}\`;
        }

        function reportHighScore(gameId, score) {
            if (!trackedHighScoreGames.has(gameId)) return;
            highScoreManager.reportScore(gameId, score);
        }

        function getBestScore(gameId) {
            if (!trackedHighScoreGames.has(gameId)) return 0;
            return highScoreManager.getScore(gameId);
        }

        const getCanvasWidth = () => logicalWidth || canvas.clientWidth || canvas.offsetWidth || 0;
        const getCanvasHeight = () => logicalHeight || canvas.clientHeight || canvas.offsetHeight || 0;

        // Colors - Clean Cursor IDE aesthetic
        const colors = Object.freeze({
            background: '#22272e',
            player: '#adbac7',
            target: '#768390',
            bullet: '#adbac7',
            header: '#2d333b',
            dark: '#1c2128',
            accent: '#57ab5a'
        });

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

        // Game state
        let gameState = {
            score: 0,
            isPaused: false,
            isGameOver: false
        };

        function resetGameState() {
            gameState.score = 0;
            gameState.isPaused = false;
            gameState.isGameOver = false;
        }

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

        function disposeCurrentGame() {
            if (gameManager.currentGame && typeof gameManager.currentGame.cleanup === 'function') {
                gameManager.currentGame.cleanup();
            }
            gameManager.currentGame = null;
        }

        function showMenu() {
            resetGameState();
            pauseOverlay.classList.remove('show');
            gameOverOverlay.classList.remove('show');
            helpOverlay.classList.remove('show');
            gameMenu.classList.remove('hidden');
            canvas.style.display = 'none';
            helpBtn.style.display = 'none';
            menuBtn.style.display = 'none';
            pauseBtn.style.display = 'none';
            resetBtn.style.display = 'none';
            resetBtn.textContent = 'Reset';
            difficultyUI.hide();
            gameTitle.textContent = '';
            scoreElement.textContent = '';
            scoreElement.style.display = 'none';
            disposeCurrentGame();
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
            
            resetGameState();
            pauseOverlay.classList.remove('show');
            gameOverOverlay.classList.remove('show');
            helpOverlay.classList.remove('show');
            updateScore();

            resetBtn.textContent = 'Reset';

            // Stop current game
            disposeCurrentGame();

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
            
            setActiveHighScoreGame(gameName);

            if (gameManager.currentGame) {
                gameManager.currentGame.init();
            }
        }

        function updateScore() {
            const scoreValue = typeof gameState.score === 'number' ? gameState.score : 0;
            if (activeHighScoreGame && trackedHighScoreGames.has(activeHighScoreGame)) {
                const best = highScoreManager.getScore(activeHighScoreGame);
                scoreElement.textContent = \`Score: \${scoreValue} (Best: \${best})\`;
            } else {
                scoreElement.textContent = \`Score: \${scoreValue}\`;
            }
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
            const helpBestLine = (gameId) => {
                if (!trackedHighScoreGames.has(gameId)) {
                    return '';
                }
                return \`<p><strong>Best:</strong> \${getBestScore(gameId)}</p>\`;
            };
            
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
                        \${helpBestLine('spaceShooter')}
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
                        \${helpBestLine('runner')}
                        <p><strong>Game Over:</strong> When you hit an obstacle</p>
                    \`;
                    break;
                case 'BreakoutGame':
                    helpHTML = \`
                        <h3>🎾 Breakout</h3>
                        <p><strong>Goal:</strong> Break all bricks across three rounds!</p>
                        <p><strong>Controls:</strong></p>
                        <ul>
                            <li>Move mouse to control paddle</li>
                            <li>Click canvas or press Space to launch the ball when a round is ready</li>
                            <li>Space after Game Over to play again</li>
                            <li>ESC to pause</li>
                        </ul>
                        <p><strong>Scoring:</strong> +10 points per brick</p>
                        \${helpBestLine('breakout')}
                        <p><strong>Levels:</strong> Bricks get smaller and more numerous each round. After clearing a round the game pauses—click anywhere or press Space to begin the next one.</p>
                        <p><strong>Tip:</strong> Speed increases as you break more bricks!</p>
                        <p><strong>Win:</strong> Clear all 3 levels. Lose: Ball falls off screen</p>
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
                            <li>Easy: Random play with frequent mistakes</li>
                            <li>Medium: Looks a few moves ahead with light randomness</li>
                            <li>Hard: Deep minimax search with zero intentional blunders</li>
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
                        \${helpBestLine('snake')}
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
                        \${helpBestLine('2048')}
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

    </script>
    <script nonce="${nonce}" src="${chessGameJsSrc}"></script>
    <script nonce="${nonce}" src="${spaceShooterJsSrc}"></script>
    <script nonce="${nonce}" src="${runnerJsSrc}"></script>
    <script nonce="${nonce}" src="${breakoutJsSrc}"></script>
    <script nonce="${nonce}" src="${snakeJsSrc}"></script>
    <script nonce="${nonce}" src="${game2048JsSrc}"></script>
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
