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
    this.difficulty = difficultySelect.value || "easy";
    this.aiAbortController = null;
    const initialSettings =
      chessDifficultyConfig[this.difficulty] || chessDifficultyConfig.easy;
    this.maxEngineTimeMs =
      initialSettings.maxTimeMs || chessDifficultyConfig.easy.maxTimeMs;
    this.difficultyLocked = false;
    this.matchStarted = false;
    // Transposition table for caching positions
    this.transpositionTable = new Map();
    this.maxTTSize = 100000;
    // Killer moves for move ordering (indexed by ply)
    this.killerMoves = [];
    // History heuristic table
    this.historyTable = {};
    // Principal variation
    this.pvTable = {};
    // Chess.js game instance for AI
    this.chessInstance = null;
  }

  startFadeAnimation() {
    const tick = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
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
    const allowedLevels = Object.keys(chessDifficultyConfig);
    const safeLevel = allowedLevels.includes(level) ? level : "easy";
    this.difficulty = safeLevel;
    const settings = this.getDifficultySettings();
    this.maxEngineTimeMs =
      settings.maxTimeMs || chessDifficultyConfig.easy.maxTimeMs;
    if (difficultySelect.value !== safeLevel) {
      difficultySelect.value = safeLevel;
    }
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
      const label = this.getDifficultySettings().label || "AI";
      scoreElement.textContent = "AI Thinking (" + label + ")...";
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
    canvas.classList.add("chess-board");
    resizeCanvas();

    setTimeout(() => {
      const availableWidth = getCanvasWidth() - 50;
      const availableHeight = getCanvasHeight() - 30;
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
      // Clear caches on new game
      this.transpositionTable.clear();
      this.killerMoves = [];
      this.historyTable = {};
      this.pvTable = {};
      this.chessInstance = null;
      if (this.fadeAnimationId) {
        cancelAnimationFrame(this.fadeAnimationId);
        this.fadeAnimationId = null;
      }
      this.draw();
      scoreElement.textContent = "Your Turn (White)";
    }, 100);

    canvas.addEventListener(
      "click",
      (this.clickHandler = (e) => this.handleClick(e))
    );
    canvas.addEventListener(
      "mousemove",
      (this.mouseMoveHandler = (e) => this.handleMouseMove(e))
    );
  }

  cleanup() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    canvas.removeEventListener("click", this.clickHandler);
    canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    canvas.classList.remove("chess-board");
    this.matchStarted = false;
    this.difficultyLocked = false;
  }

  reset() {
    this.cleanup();
    gameState.score = 0;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    pauseOverlay.classList.remove("show");
    gameOverOverlay.classList.remove("show");
    scoreElement.textContent = "Your Turn (White)";
    this.init();
  }

  isDifficultySelectionLocked() {
    return this.difficultyLocked;
  }

  prepareDifficultySelectionWindow() {
    this.matchStarted = false;
    this.difficultyLocked = false;
    this.setDifficulty(this.difficulty || difficultySelect.value || "easy");
    difficultyUI.showSetup();
  }

  lockDifficultySelectionForMatch() {
    if (this.difficultyLocked) return;
    this.difficultyLocked = true;
    this.matchStarted = true;
    difficultyUI.lock();
  }

  initBoard() {
    this.board = [
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ["P", "P", "P", "P", "P", "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"],
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
    if (
      this.gameOver ||
      this.thinking ||
      !this.isPlayerTurn ||
      this.squareSize === 0
    )
      return;
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
        scoreElement.textContent = "AI Thinking...";
        // Faster response for easier difficulties
        const aiDelay =
          this.difficulty === "easy"
            ? 50
            : this.difficulty === "medium"
            ? 100
            : 200;
        setTimeout(() => this.makeAIMove(), aiDelay);
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
    if (fromRow === toRow && fromCol === toCol) return false;
    if (piece !== piece.toUpperCase()) return false;
    const targetPiece = this.board[toRow][toCol];
    if (targetPiece && targetPiece === targetPiece.toUpperCase()) {
      return false;
    }
    return this.isValidPieceMove(piece, fromRow, fromCol, toRow, toCol);
  }

  isValidPieceMove(piece, fromRow, fromCol, toRow, toCol) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const pieceUpper = piece.toUpperCase();
    if (rowDiff === 0 && colDiff === 0) return false;
    switch (pieceUpper) {
      case "P":
        return this.isValidPawnMove(
          piece,
          fromRow,
          fromCol,
          toRow,
          toCol,
          rowDiff,
          colDiff
        );
      case "R":
        return this.isValidRookMove(
          fromRow,
          fromCol,
          toRow,
          toCol,
          rowDiff,
          colDiff
        );
      case "N":
        return this.isValidKnightMove(rowDiff, colDiff);
      case "B":
        return this.isValidBishopMove(
          fromRow,
          fromCol,
          toRow,
          toCol,
          rowDiff,
          colDiff
        );
      case "Q":
        return this.isValidQueenMove(
          fromRow,
          fromCol,
          toRow,
          toCol,
          rowDiff,
          colDiff
        );
      case "K":
        return this.isValidKingMove(rowDiff, colDiff);
      default:
        return false;
    }
  }

  isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
    const isWhite = piece === "P";
    const targetPiece = this.board[toRow][toCol];
    const startRow = isWhite ? 6 : 1;
    const dir = isWhite ? -1 : 1;
    if (colDiff === 0 && !targetPiece) {
      if (rowDiff === dir) return true;
      if (fromRow === startRow && rowDiff === 2 * dir) {
        const midRow = fromRow + dir;
        if (this.board[midRow][fromCol] === null) return true;
      }
    }
    if (Math.abs(colDiff) === 1 && rowDiff === dir && targetPiece) {
      return true;
    }
    return false;
  }

  isValidRookMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
    if (rowDiff !== 0 && colDiff !== 0) return false;
    return this.isPathClear(fromRow, fromCol, toRow, toCol);
  }

  isValidKnightMove(rowDiff, colDiff) {
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);
    return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
  }

  isValidBishopMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
    if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
    return this.isPathClear(fromRow, fromCol, toRow, toCol);
  }

  isValidQueenMove(fromRow, fromCol, toRow, toCol, rowDiff, colDiff) {
    const isDiagonal = Math.abs(rowDiff) === Math.abs(colDiff);
    const isStraight = rowDiff === 0 || colDiff === 0;
    if (!isDiagonal && !isStraight) return false;
    return this.isPathClear(fromRow, fromCol, toRow, toCol);
  }

  isValidKingMove(rowDiff, colDiff) {
    return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
  }

  isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow === fromRow ? 0 : toRow > fromRow ? 1 : -1;
    const colStep = toCol === fromCol ? 0 : toCol > fromCol ? 1 : -1;
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    while (currentRow !== toRow || currentCol !== toCol) {
      if (this.board[currentRow][currentCol] !== null) {
        return false;
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    return true;
  }

  makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    const capturedPiece = this.board[toRow][toCol];
    if (capturedPiece) {
      if (capturedPiece === capturedPiece.toUpperCase()) {
        this.capturedPieces.black.push(capturedPiece);
      } else {
        this.capturedPieces.white.push(capturedPiece);
      }
    }
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // Pawn promotion
    if (piece === "P" && toRow === 0) {
      this.board[toRow][toCol] = "Q";
    } else if (piece === "p" && toRow === 7) {
      this.board[toRow][toCol] = "q";
    }

    this.lastMove = { fromRow, fromCol, toRow, toCol };
    this.lastMoveTimeMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.startFadeAnimation();
    this.moves.push(`${fromRow}${fromCol}${toRow}${toCol}`);

    const blackKing = this.findKing("k");
    const whiteKing = this.findKing("K");
    if (!blackKing || !whiteKing) {
      this.gameOver = true;
      gameState.isGameOver = true;
      const winner = whiteKing ? "White" : "Black";
      finalScoreElement.textContent = `${winner} Wins!`;
      gameOverOverlay.classList.add("show");
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
    const rawType = (settings.type || this.difficulty || "easy").toLowerCase();
    const clampChance = (value, fallback = 0) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return fallback;
      }
      return Math.min(1, Math.max(0, value));
    };
    if (rawType === "random") {
      return {
        strategy: "random",
        mistakeChance: clampChance(settings.mistakeChance, 0.65),
      };
    }
    if (rawType === "heuristic") {
      return {
        strategy: "heuristic",
        preferAggressive: !!settings.preferAggressive,
        mistakeChance: clampChance(settings.mistakeChance, 0.05),
      };
    }
    return {
      strategy: "search",
      depth: Number.isFinite(settings.depth)
        ? settings.depth
        : this.difficulty === "hard"
        ? 6
        : 3,
      timeLimitMs:
        settings.maxTimeMs ?? settings.timeLimitMs ?? this.maxEngineTimeMs,
      mixRandomness:
        typeof settings.mixRandomness === "number"
          ? settings.mixRandomness
          : this.difficulty === "medium"
          ? 0.15
          : 0,
      allowHeuristicFallback:
        settings.allowHeuristicFallback !== undefined
          ? settings.allowHeuristicFallback
          : true,
      preferAggressive:
        settings.preferAggressive !== undefined
          ? settings.preferAggressive
          : this.difficulty === "hard",
      mistakeChance: clampChance(
        settings.mistakeChance,
        this.difficulty === "medium" ? 0.08 : 0
      ),
      useQuiescence:
        settings.useQuiescence !== undefined
          ? settings.useQuiescence
          : this.difficulty === "hard",
      useNullMove:
        settings.useNullMove !== undefined
          ? settings.useNullMove
          : this.difficulty === "hard",
      useOpeningBook:
        settings.useOpeningBook !== undefined
          ? settings.useOpeningBook
          : this.difficulty === "hard",
    };
  }

  async makeAIMove() {
    if (this.gameOver || this.isPlayerTurn) return;
    const abortSignal = this.createAbortSignal();
    const settings = this.getDifficultySettings();
    const label = (settings && settings.label) || "AI";
    const profile = this.getDifficultyProfile(settings);

    this.thinking = true;
    scoreElement.textContent = "AI Thinking (" + label + ")...";
    this.draw();

    try {
      if (profile.strategy === "random") {
        await this.yieldToUI();
        this.makeRandomMove();
      } else if (profile.strategy === "heuristic") {
        await this.yieldToUI();
        const move = this.chooseHeuristicMove({
          preferAggressive: profile.preferAggressive,
        });
        this.resolveAIMove(move, profile, true);
      } else {
        let move = null;
        if (profile.mixRandomness && Math.random() < profile.mixRandomness) {
          await this.yieldToUI();
          move = this.chooseHeuristicMove({
            preferAggressive: profile.preferAggressive,
          });
        }
        if (!move) {
          move = await this.getEngineMoveAsync(profile, abortSignal);
        }
        if (abortSignal.aborted || this.gameOver) {
          return;
        }
        this.resolveAIMove(
          move,
          profile,
          profile.allowHeuristicFallback !== false
        );
      }
    } catch (error) {
      if (!abortSignal.aborted) {
        console.error("AI move error:", error);
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
        scoreElement.textContent = "Your Turn (White)";
      }
      this.draw();
    }
  }

  // Yield control back to the UI to prevent blocking
  yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Opening book for strong opening play
  getOpeningMove(fen) {
    // Common strong opening responses for black
    const openingBook = {
      // After 1.e4
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
        "e7e5",
        "c7c5",
        "e7e6",
        "c7c6",
      ], // Sicilian, French, Caro-Kann
      // After 1.d4
      "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": [
        "d7d5",
        "g8f6",
        "e7e6",
      ],
      // After 1.Nf3
      "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b": [
        "d7d5",
        "g8f6",
        "c7c5",
      ],
      // After 1.c4
      "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b": [
        "e7e5",
        "c7c5",
        "g8f6",
      ],
      // After 1.e4 e5 2.Nf3
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": ["b8c6", "g8f6"],
      // After 1.e4 c5 (Sicilian) 2.Nf3
      "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
        "d7d6",
        "b8c6",
        "e7e6",
      ],
      // After 1.d4 d5 2.c4
      "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b": [
        "e7e6",
        "c7c6",
        "d5c4",
      ],
      // After 1.d4 Nf6 2.c4
      "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b": [
        "e7e6",
        "g7g6",
        "c7c5",
      ],
      // Italian Game setup
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b": [
        "g8f6",
        "f8c5",
      ],
      // Ruy Lopez
      "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b": [
        "a7a6",
        "g8f6",
        "f8c5",
      ],
    };

    // Normalize FEN (just position and turn)
    const fenParts = fen.split(" ");
    const positionKey = fenParts[0] + " " + fenParts[1];

    if (openingBook[positionKey]) {
      const moves = openingBook[positionKey];
      return moves[Math.floor(Math.random() * moves.length)];
    }
    return null;
  }

  // Async engine move that yields periodically to prevent UI freezing
  async getEngineMoveAsync(searchOptions = {}, abortSignal) {
    if (window.Chess) {
      try {
        const fen = this.boardToFEN();

        // Check opening book first for hard mode
        if (searchOptions.useOpeningBook && this.moves.length < 20) {
          const bookMove = this.getOpeningMove(fen);
          if (bookMove) {
            await this.yieldToUI();
            return this.algebraicToCoordinates(bookMove);
          }
        }

        const moveUci = await this.getBestMoveAsync(
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
          console.error("chess.js engine error:", e);
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

  // Async minimax with iterative deepening and periodic yielding
  async getBestMoveAsync(fen, options = {}, abortSignal) {
    if (!window.Chess) return null;
    const ChessEngine = window.Chess;
    const {
      depth = 5,
      timeLimitMs = 3000,
      preferAggressive = true,
      useQuiescence = true,
      useNullMove = true,
    } = options;

    const game = new ChessEngine(fen);
    this.chessInstance = game;

    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const searchStart = now();
    const limit = Math.max(500, timeLimitMs || 3000);

    let nodesSearched = 0;
    const yieldInterval = 800; // Yield every N nodes

    const hasTimeLeft = () => {
      if (abortSignal?.aborted) return false;
      return now() - searchStart < limit;
    };

    // Piece values (centipawns)
    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    // Enhanced piece-square tables
    const pst = {
      p: [
        // Pawn - encourage advancement and center control
        0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 35,
        35, 20, 10, 10, 5, 5, 15, 30, 30, 15, 5, 5, 0, 0, 5, 28, 28, 5, 0, 0, 5,
        -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -30, -30, 10, 10, 5, 0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      n: [
        // Knight - strong in center
        -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40,
        -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 20, 25, 25, 20, 0, -30, -30, 5,
        20, 25, 25, 20, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -40, -20, 0, 5,
        5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
      ],
      b: [
        // Bishop - control diagonals, avoid edges
        -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10,
        10, 10, 10, 10, 10, 10, -10, -10, 0, 15, 15, 15, 15, 0, -10, -10, 5, 15,
        15, 15, 15, 5, -10, -10, 0, 15, 15, 15, 15, 0, -10, -10, 5, 0, 0, 0, 0,
        5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
      ],
      r: [
        // Rook - 7th rank, open files
        0, 0, 0, 5, 5, 0, 0, 0, 10, 15, 15, 15, 15, 15, 15, 10, -5, 0, 0, 0, 0,
        0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0,
        0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 5, 10, 10, 5, 0, 0,
      ],
      q: [
        // Queen - avoid early development, stay safe
        -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10,
        5, 5, 5, 5, 5, 0, -10, -5, 0, 5, 10, 10, 5, 0, -5, 0, 0, 5, 10, 10, 5,
        0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10,
        -10, -5, -5, -10, -10, -20,
      ],
      k_middle: [
        // King middlegame - stay safe, castle
        -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
        -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50,
        -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20,
        -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 35, 15, 0,
        0, 15, 35, 20,
      ],
      k_end: [
        // King endgame - become active
        -50, -30, -30, -30, -30, -30, -30, -50, -30, -10, 0, 0, 0, 0, -10, -30,
        -30, 0, 20, 30, 30, 20, 0, -30, -30, 0, 30, 45, 45, 30, 0, -30, -30, 0,
        30, 45, 45, 30, 0, -30, -30, 0, 20, 30, 30, 20, 0, -30, -30, -20, -10,
        0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50,
      ],
    };

    const mirrorIdx = (idx) => {
      const row = Math.floor(idx / 8);
      const col = idx % 8;
      return (7 - row) * 8 + col;
    };

    // Count total material for phase detection
    const countMaterial = (g) => {
      const board = g.board();
      let total = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = board[r][c];
          if (sq && sq.type !== "k") {
            total += pieceValues[sq.type] || 0;
          }
        }
      }
      return total;
    };

    // Check if a pawn is passed
    const isPassedPawn = (board, row, col, color) => {
      const dir = color === "w" ? -1 : 1;
      const endRow = color === "w" ? 0 : 7;

      for (
        let r = row + dir;
        color === "w" ? r >= endRow : r <= endRow;
        r += dir
      ) {
        for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
          const sq = board[r][c];
          if (sq && sq.type === "p" && sq.color !== color) {
            return false;
          }
        }
      }
      return true;
    };

    // Count attackers around a square
    const countAttackers = (g, square, byColor) => {
      const moves = g.moves({ verbose: true });
      return moves.filter(
        (m) =>
          m.to === square &&
          (byColor === undefined || g.get(m.from)?.color === byColor)
      ).length;
    };

    // Evaluate king safety
    const evaluateKingSafety = (board, kingPos, color, isEndgame) => {
      if (isEndgame) return 0; // King safety less important in endgame

      let safety = 0;
      const kRow = kingPos.row;
      const kCol = kingPos.col;

      // Check pawn shield (for castled king)
      const pawnRow = color === "w" ? kRow - 1 : kRow + 1;
      if (pawnRow >= 0 && pawnRow < 8) {
        for (let c = Math.max(0, kCol - 1); c <= Math.min(7, kCol + 1); c++) {
          const sq = board[pawnRow][c];
          if (sq && sq.type === "p" && sq.color === color) {
            safety += 15; // Pawn shield bonus
          }
        }
      }

      // Penalty for open files near king
      for (let c = Math.max(0, kCol - 1); c <= Math.min(7, kCol + 1); c++) {
        let hasPawn = false;
        for (let r = 0; r < 8; r++) {
          const sq = board[r][c];
          if (sq && sq.type === "p") {
            hasPawn = true;
            break;
          }
        }
        if (!hasPawn) safety -= 20; // Open file penalty
      }

      return safety;
    };

    // Main evaluation function
    const evaluateBoard = (g) => {
      if (g.isCheckmate()) {
        return g.turn() === "b" ? -999999 : 999999;
      }
      if (g.isDraw() || g.isStalemate() || g.isInsufficientMaterial()) {
        return 0;
      }

      const board = g.board();
      const material = countMaterial(g);
      const isEndgame = material < 2400;

      let score = 0;
      let whiteKingPos = null;
      let blackKingPos = null;

      // First pass: find kings and basic material/position
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = board[r][c];
          if (!sq) continue;

          if (sq.type === "k") {
            if (sq.color === "w") whiteKingPos = { row: r, col: c };
            else blackKingPos = { row: r, col: c };
          }

          const idx = r * 8 + c;
          let table;
          if (sq.type === "k") {
            table = isEndgame ? pst.k_end : pst.k_middle;
          } else {
            table = pst[sq.type];
          }

          const positional = table
            ? table[sq.color === "w" ? mirrorIdx(idx) : idx]
            : 0;
          let pieceScore = (pieceValues[sq.type] || 0) + positional;

          // Passed pawn bonus
          if (sq.type === "p" && isPassedPawn(board, r, c, sq.color)) {
            const advancement = sq.color === "w" ? 6 - r : r - 1;
            pieceScore += advancement * 20 + 30;
          }

          // Doubled pawn penalty
          if (sq.type === "p") {
            for (let checkR = 0; checkR < 8; checkR++) {
              if (checkR !== r) {
                const checkSq = board[checkR][c];
                if (
                  checkSq &&
                  checkSq.type === "p" &&
                  checkSq.color === sq.color
                ) {
                  pieceScore -= 15;
                  break;
                }
              }
            }
          }

          // Rook on open/semi-open file
          if (sq.type === "r") {
            let ownPawn = false,
              oppPawn = false;
            for (let checkR = 0; checkR < 8; checkR++) {
              const checkSq = board[checkR][c];
              if (checkSq && checkSq.type === "p") {
                if (checkSq.color === sq.color) ownPawn = true;
                else oppPawn = true;
              }
            }
            if (!ownPawn && !oppPawn) pieceScore += 25; // Open file
            else if (!ownPawn) pieceScore += 15; // Semi-open
          }

          // Rook on 7th rank
          if (sq.type === "r") {
            if (
              (sq.color === "w" && r === 1) ||
              (sq.color === "b" && r === 6)
            ) {
              pieceScore += 30;
            }
          }

          // Bishop pair bonus
          if (sq.type === "b") {
            let hasPair = false;
            const isLight = (r + c) % 2 === 0;
            for (let checkR = 0; checkR < 8; checkR++) {
              for (let checkC = 0; checkC < 8; checkC++) {
                const checkSq = board[checkR][checkC];
                if (
                  checkSq &&
                  checkSq.type === "b" &&
                  checkSq.color === sq.color
                ) {
                  const checkIsLight = (checkR + checkC) % 2 === 0;
                  if (isLight !== checkIsLight) {
                    hasPair = true;
                    break;
                  }
                }
              }
              if (hasPair) break;
            }
            if (hasPair) pieceScore += 25;
          }

          if (sq.color === "b") {
            score += pieceScore;
          } else {
            score -= pieceScore;
          }
        }
      }

      // King safety
      if (whiteKingPos) {
        score -= evaluateKingSafety(board, whiteKingPos, "w", isEndgame);
      }
      if (blackKingPos) {
        score += evaluateKingSafety(board, blackKingPos, "b", isEndgame);
      }

      // Mobility bonus
      const moves = g.moves().length;
      score += g.turn() === "b" ? moves * 5 : -moves * 5;

      // Check bonus
      if (g.isCheck()) {
        score += g.turn() === "b" ? -40 : 40;
      }

      // Tempo bonus for being aggressive
      if (preferAggressive) {
        score += 15;
      }

      return score;
    };

    // Move ordering score (MVV-LVA + history + killers)
    const scoreMoveOrder = (move, ply = 0) => {
      let score = 0;

      // Captures: MVV-LVA
      if (move.captured) {
        const victimValue = pieceValues[move.captured] || 0;
        const attackerValue = pieceValues[move.piece] || 0;
        score += 10000 + victimValue * 10 - attackerValue;
      }

      // Promotions
      if (move.promotion) {
        score += 9000 + (pieceValues[move.promotion] || 0);
      }

      // Checks
      if (move.san && move.san.includes("+")) {
        score += 1500;
      }

      // Castling
      if (
        move.flags &&
        (move.flags.includes("k") || move.flags.includes("q"))
      ) {
        score += 700;
      }

      // Killer moves
      if (this.killerMoves[ply]) {
        const key = move.from + move.to;
        if (this.killerMoves[ply][0] === key) score += 900;
        else if (this.killerMoves[ply][1] === key) score += 800;
      }

      // History heuristic
      const historyKey = move.from + move.to;
      score += Math.min(500, this.historyTable[historyKey] || 0);

      // Center control
      const toFile = move.to.charCodeAt(0) - 97;
      const toRank = parseInt(move.to[1], 10) - 1;
      const centerBonus = 4 - (Math.abs(3.5 - toFile) + Math.abs(3.5 - toRank));
      score += centerBonus * 8;

      return score;
    };

    const orderMoves = (moves, ply = 0) => {
      return moves.sort(
        (a, b) => scoreMoveOrder(b, ply) - scoreMoveOrder(a, ply)
      );
    };

    // Quiescence search - search captures until position is quiet
    const quiescence = async (g, alpha, beta, depthLeft) => {
      nodesSearched++;

      if (nodesSearched % yieldInterval === 0) {
        await this.yieldToUI();
        if (abortSignal?.aborted || !hasTimeLeft()) {
          return evaluateBoard(g);
        }
      }

      const standPat = evaluateBoard(g);

      if (depthLeft <= 0) return standPat;
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      // Only search captures, promotions, and checks
      const allMoves = g.moves({ verbose: true });
      const tacticalMoves = allMoves.filter(
        (m) => m.captured || m.promotion || (m.san && m.san.includes("+"))
      );

      if (tacticalMoves.length === 0) return standPat;

      const orderedMoves = orderMoves(tacticalMoves);

      for (const move of orderedMoves) {
        // Delta pruning - skip captures that can't possibly improve alpha
        if (move.captured && !move.promotion && !g.isCheck()) {
          const captureValue = pieceValues[move.captured] || 0;
          if (standPat + captureValue + 200 < alpha) continue;
        }

        g.move(move);
        const score = -(await quiescence(g, -beta, -alpha, depthLeft - 1));
        g.undo();

        if (abortSignal?.aborted || !hasTimeLeft()) return alpha;

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }

      return alpha;
    };

    // Null move pruning - skip a move to get a quick lower bound
    const nullMoveAllowed = (g, inCheck, lastWasNull) => {
      if (!useNullMove) return false;
      if (inCheck) return false;
      if (lastWasNull) return false;

      // Don't do null move in endgame or when we only have pawns
      const board = g.board();
      let majorPieces = 0;
      const turn = g.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = board[r][c];
          if (
            sq &&
            sq.color === turn &&
            (sq.type === "q" ||
              sq.type === "r" ||
              sq.type === "n" ||
              sq.type === "b")
          ) {
            majorPieces++;
          }
        }
      }
      return majorPieces >= 2;
    };

    // Principal variation search with negamax
    const pvSearch = async (
      g,
      d,
      alpha,
      beta,
      ply = 0,
      lastWasNull = false
    ) => {
      nodesSearched++;

      if (nodesSearched % yieldInterval === 0) {
        await this.yieldToUI();
        if (abortSignal?.aborted || !hasTimeLeft()) {
          return { score: evaluateBoard(g), move: null };
        }
      }

      // Check transposition table
      const posKey = g.fen();
      const ttEntry = this.transpositionTable.get(posKey);
      if (ttEntry && ttEntry.depth >= d) {
        if (ttEntry.flag === "exact")
          return { score: ttEntry.score, move: ttEntry.move };
        if (ttEntry.flag === "lower" && ttEntry.score >= beta)
          return { score: ttEntry.score, move: ttEntry.move };
        if (ttEntry.flag === "upper" && ttEntry.score <= alpha)
          return { score: ttEntry.score, move: ttEntry.move };
      }

      const inCheck = g.isCheck();

      if (d <= 0 || g.isGameOver()) {
        if (useQuiescence && d === 0 && !g.isGameOver()) {
          const qScore = await quiescence(g, alpha, beta, 6);
          return { score: qScore, move: null };
        }
        return { score: evaluateBoard(g), move: null };
      }

      // Null move pruning
      if (nullMoveAllowed(g, inCheck, lastWasNull) && d >= 3) {
        // Make null move (pass)
        const nullFen = g.fen();
        const parts = nullFen.split(" ");
        parts[1] = parts[1] === "w" ? "b" : "w"; // Switch turn
        parts[3] = "-"; // Clear en passant
        try {
          const nullGame = new ChessEngine(parts.join(" "));
          const nullResult = await pvSearch(
            nullGame,
            d - 3,
            -beta,
            -beta + 1,
            ply + 1,
            true
          );
          if (-nullResult.score >= beta) {
            return { score: beta, move: null }; // Null move cutoff
          }
        } catch (e) {
          // Invalid position, skip null move
        }
      }

      const moves = orderMoves(g.moves({ verbose: true }), ply);
      if (moves.length === 0) {
        return { score: evaluateBoard(g), move: null };
      }

      let bestMove = moves[0];
      let bestScore = -Infinity;
      let searchedFirst = false;

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        g.move(move);

        let result;
        if (!searchedFirst) {
          // Full window search for first move
          result = await pvSearch(g, d - 1, -beta, -alpha, ply + 1, false);
          searchedFirst = true;
        } else {
          // Null window search for other moves
          result = await pvSearch(g, d - 1, -alpha - 1, -alpha, ply + 1, false);
          if (-result.score > alpha && -result.score < beta) {
            // Re-search with full window
            result = await pvSearch(g, d - 1, -beta, -alpha, ply + 1, false);
          }
        }

        g.undo();

        const score = -result.score;

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }

        if (score > alpha) {
          alpha = score;

          // Update history heuristic for quiet moves
          if (!move.captured) {
            const historyKey = move.from + move.to;
            this.historyTable[historyKey] =
              (this.historyTable[historyKey] || 0) + d * d;
          }
        }

        if (alpha >= beta) {
          // Store killer move
          if (!move.captured) {
            if (!this.killerMoves[ply]) this.killerMoves[ply] = [null, null];
            if (this.killerMoves[ply][0] !== move.from + move.to) {
              this.killerMoves[ply][1] = this.killerMoves[ply][0];
              this.killerMoves[ply][0] = move.from + move.to;
            }
          }
          break;
        }

        if (abortSignal?.aborted || !hasTimeLeft()) {
          break;
        }
      }

      // Store in transposition table
      if (this.transpositionTable.size < this.maxTTSize) {
        const flag =
          bestScore <= alpha ? "upper" : bestScore >= beta ? "lower" : "exact";
        this.transpositionTable.set(posKey, {
          score: bestScore,
          depth: d,
          flag: flag,
          move: bestMove,
        });
      }

      return { score: bestScore, move: bestMove };
    };

    // Iterative deepening
    const rootMoves = orderMoves(game.moves({ verbose: true }));
    if (!rootMoves.length) return null;

    let bestMove = rootMoves[0];
    let bestScore = -Infinity;

    // Start with depth 1 and increase
    for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
      if (abortSignal?.aborted || !hasTimeLeft()) {
        break;
      }

      nodesSearched = 0;
      const result = await pvSearch(
        game,
        currentDepth,
        -Infinity,
        Infinity,
        0,
        false
      );

      if (result.move && result.score > bestScore - 100) {
        // Accept if not much worse
        bestScore = result.score;
        bestMove = result.move;
      }

      // Re-order root moves with best move first
      const bestMoveStr = bestMove?.from + bestMove?.to;
      rootMoves.sort((a, b) => {
        if (a.from + a.to === bestMoveStr) return -1;
        if (b.from + b.to === bestMoveStr) return 1;
        return scoreMoveOrder(b) - scoreMoveOrder(a);
      });

      await this.yieldToUI();

      // If we found a checkmate, stop searching
      if (Math.abs(bestScore) > 900000) {
        break;
      }
    }

    return bestMove
      ? bestMove.from + bestMove.to + (bestMove.promotion || "")
      : null;
  }

  boardToFEN() {
    let fen = "";
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
          fen += piece;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (row < 7) fen += "/";
    }
    fen += " b";
    let castling = "";
    if (this.board[7][4] === "K") {
      if (this.board[7][7] === "R") castling += "K";
      if (this.board[7][0] === "R") castling += "Q";
    }
    if (this.board[0][4] === "k") {
      if (this.board[0][7] === "r") castling += "k";
      if (this.board[0][0] === "r") castling += "q";
    }
    fen += " " + (castling || "-");
    fen += " -";
    fen += " 0";
    const moveNumber = Math.floor(this.moves.length / 2) + 1;
    fen += " " + moveNumber;
    return fen;
  }

  algebraicToCoordinates(algebraic) {
    const match = algebraic.match(/^([a-h])([1-8])([a-h])([1-8])([qrnb])?$/);
    if (!match) {
      console.error("Invalid algebraic notation:", algebraic);
      return null;
    }
    const fromCol = match[1].charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(match[2]);
    const toCol = match[3].charCodeAt(0) - 97;
    const toRow = 8 - parseInt(match[4]);
    return {
      fromRow,
      fromCol,
      toRow,
      toCol,
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
                capture: this.board[tr][tc],
              });
            }
          }
        }
      }
    }
    return moves;
  }

  shouldInjectMistake(profile) {
    if (!profile) return false;
    const chance =
      typeof profile.mistakeChance === "number" ? profile.mistakeChance : 0;
    if (chance <= 0) return false;
    return Math.random() < Math.min(1, Math.max(0, chance));
  }

  pickImperfectMove(preferAggressive = false) {
    // For easy mode, pick truly random moves more often
    if (this.difficulty === "easy" && Math.random() < 0.6) {
      return this.makeRandomMove(false);
    }
    return (
      this.chooseHeuristicMove({ preferAggressive }) ||
      this.makeRandomMove(false)
    );
  }

  resolveAIMove(primaryMove, profile, allowHeuristicFallback = true) {
    let move = primaryMove;
    if (!move && allowHeuristicFallback) {
      move = this.chooseHeuristicMove({
        preferAggressive: profile?.preferAggressive,
      });
    }
    if (this.shouldInjectMistake(profile)) {
      const downgraded = this.pickImperfectMove(profile?.preferAggressive);
      if (downgraded) {
        move = downgraded;
      }
    }
    if (move && this.executeAIMove(move)) {
      return true;
    }
    const fallback = this.pickImperfectMove(profile?.preferAggressive);
    if (fallback && this.executeAIMove(fallback)) {
      return true;
    }
    this.makeRandomMove();
    return false;
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
    const checks = [];
    const others = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece === piece.toLowerCase()) {
          for (let tr = 0; tr < 8; tr++) {
            for (let tc = 0; tc < 8; tc++) {
              if (this.isValidAIMove(r, c, tr, tc)) {
                const targetPiece = this.board[tr][tc];
                const isCapture = !!(
                  targetPiece && targetPiece === targetPiece.toUpperCase()
                );
                const move = { fromRow: r, fromCol: c, toRow: tr, toCol: tc };

                // Calculate priority for aggressive play
                const captureValue = isCapture
                  ? this.getPieceValueFromSymbol(targetPiece)
                  : 0;
                const advancement = piece === "p" ? (tr - r) * 5 : 0;
                const centrality = this.getCentralityScore(tr, tc);
                move.priority = captureValue * 3 + centrality * 2 + advancement;

                if (isCapture) {
                  captures.push(move);
                } else {
                  others.push(move);
                }
              }
            }
          }
        }
      }
    }

    // Sort by priority
    captures.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    others.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (captures.length) {
      if (preferAggressive) {
        return captures[0];
      }
      return captures[Math.floor(Math.random() * Math.min(3, captures.length))];
    }
    if (others.length) {
      if (preferAggressive) {
        return others[0];
      }
      return others[Math.floor(Math.random() * Math.min(5, others.length))];
    }
    return null;
  }

  getPieceValueFromSymbol(symbol) {
    if (!symbol) return 0;
    const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    return values[symbol.toLowerCase()] || 0;
  }

  getCentralityScore(row, col) {
    return 4 - (Math.abs(3.5 - col) + Math.abs(3.5 - row));
  }

  isValidAIMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    if (!piece) return false;
    if (piece !== piece.toLowerCase()) return false;
    const targetPiece = this.board[toRow][toCol];
    if (targetPiece && targetPiece === targetPiece.toLowerCase()) {
      return false;
    }
    return this.isValidPieceMove(piece, fromRow, fromCol, toRow, toCol);
  }

  executeAIMove(move) {
    if (!move) {
      console.error("executeAIMove: move is null/undefined");
      return false;
    }
    if (typeof move === "string") {
      console.error("executeAIMove: string moves not yet supported");
      return false;
    }
    const { fromRow, fromCol, toRow, toCol } = move;
    if (!this.isValidAIMove(fromRow, fromCol, toRow, toCol)) {
      console.error("executeAIMove: Invalid move attempted", move);
      console.error(
        "Piece at source:",
        this.board[fromRow] && this.board[fromRow][fromCol]
      );
      console.error(
        "Target square:",
        this.board[toRow] && this.board[toRow][toCol]
      );
      return false;
    }
    this.makeMove(fromRow, fromCol, toRow, toCol);
    return true;
  }

  draw() {
    if (this.squareSize === 0) return;
    ctx.fillStyle = "#1c2128";
    ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());
    const boardStartX = 20;
    const boardStartY = 15;
    ctx.fillStyle = "#768390";
    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (let i = 0; i < 8; i++) {
      ctx.fillText(
        files[i],
        boardStartX + i * this.squareSize + this.squareSize / 2,
        8
      );
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillText(
        String(8 - i),
        10,
        boardStartY + i * this.squareSize + this.squareSize / 2
      );
    }
    let lastMoveAlpha = 0;
    if (this.lastMove && this.lastMoveTimeMs) {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - this.lastMoveTimeMs;
      const t = Math.min(
        1,
        Math.max(0, elapsed / (this.fadeDurationMs || 1200))
      );
      lastMoveAlpha = 1 - t;
    }
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = boardStartX + c * this.squareSize;
        const y = boardStartY + r * this.squareSize;
        ctx.fillStyle = (r + c) % 2 === 0 ? "#373e47" : "#2d333b";
        ctx.fillRect(x, y, this.squareSize, this.squareSize);
        if (this.lastMove && lastMoveAlpha > 0) {
          const isFrom =
            this.lastMove.fromRow === r && this.lastMove.fromCol === c;
          const isTo = this.lastMove.toRow === r && this.lastMove.toCol === c;
          if (isFrom || isTo) {
            const lineW = Math.max(2, Math.floor(this.squareSize * 0.08));
            ctx.lineWidth = lineW;
            const a = Math.max(0, Math.min(1, lastMoveAlpha * 0.9));
            ctx.strokeStyle = isFrom
              ? "rgba(246, 193, 77, " + a + ")"
              : "rgba(87, 171, 90, " + a + ")";
            const inset = Math.max(1, Math.floor(lineW / 2));
            ctx.strokeRect(
              x + inset,
              y + inset,
              this.squareSize - inset * 2,
              this.squareSize - inset * 2
            );
          }
        }
        if (
          this.hoveredSquare &&
          this.hoveredSquare.row === r &&
          this.hoveredSquare.col === c
        ) {
          ctx.fillStyle = "rgba(173, 186, 199, 0.1)";
          ctx.fillRect(x, y, this.squareSize, this.squareSize);
        }
        if (
          this.selectedSquare &&
          this.selectedSquare.row === r &&
          this.selectedSquare.col === c
        ) {
          ctx.fillStyle = "rgba(87, 171, 90, 0.4)";
          ctx.fillRect(x, y, this.squareSize, this.squareSize);
        }
        const isLegalMove = this.legalMoves.some(
          (m) => m.row === r && m.col === c
        );
        if (isLegalMove) {
          const targetPiece = this.board[r][c];
          if (targetPiece) {
            ctx.strokeStyle = "rgba(248, 113, 113, 0.6)";
            ctx.lineWidth = 2;
            ctx.strokeRect(
              x + 2,
              y + 2,
              this.squareSize - 4,
              this.squareSize - 4
            );
          } else {
            ctx.fillStyle = "rgba(173, 186, 199, 0.4)";
            ctx.beginPath();
            ctx.arc(
              x + this.squareSize / 2,
              y + this.squareSize / 2,
              this.squareSize * 0.15,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        const piece = this.board[r][c];
        if (piece) {
          ctx.fillStyle = piece === piece.toUpperCase() ? "#e6edf3" : "#636e7b";
          ctx.font = `${this.squareSize * 0.7}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            this.getPieceSymbol(piece),
            x + this.squareSize / 2,
            y + this.squareSize / 2
          );
        }
      }
    }
    const capturedStartX = boardStartX + this.squareSize * 8 + 10;
    const pieceSize = 12;
    ctx.fillStyle = "#768390";
    ctx.font = '8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("Captured:", capturedStartX, boardStartY + 8);
    let yOffset = boardStartY + 18;
    for (let i = 0; i < this.capturedPieces.white.length; i++) {
      ctx.fillStyle = "#636e7b";
      ctx.font = `${pieceSize}px Arial`;
      ctx.fillText(
        this.getPieceSymbol(this.capturedPieces.white[i]),
        capturedStartX,
        yOffset
      );
      yOffset += pieceSize + 2;
    }
    yOffset = boardStartY + this.squareSize * 4 + 10;
    for (let i = 0; i < this.capturedPieces.black.length; i++) {
      ctx.fillStyle = "#e6edf3";
      ctx.font = `${pieceSize}px Arial`;
      ctx.fillText(
        this.getPieceSymbol(this.capturedPieces.black[i]),
        capturedStartX,
        yOffset
      );
      yOffset += pieceSize + 2;
    }
    if (this.thinking) {
      ctx.fillStyle = "rgba(28, 33, 40, 0.85)";
      ctx.fillRect(0, 0, getCanvasWidth(), getCanvasHeight());
      ctx.fillStyle = "#adbac7";
      ctx.font =
        '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        "AI thinking...",
        getCanvasWidth() / 2,
        getCanvasHeight() / 2
      );
    }
  }

  getPieceSymbol(piece) {
    const symbols = {
      p: "♟",
      P: "♙",
      r: "♜",
      R: "♖",
      n: "♞",
      N: "♘",
      b: "♝",
      B: "♗",
      q: "♛",
      Q: "♕",
      k: "♚",
      K: "♔",
    };
    return symbols[piece] || "";
  }
}
