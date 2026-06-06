import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

type PlayerColor = 'red' | 'black';

interface Piece {
  id: string;
  player: PlayerColor;
  row: number;
  col: number;
  isKing: boolean;
  captured: boolean;
}

interface Move {
  row: number;
  col: number;
  isJump: boolean;
  jumpedRow?: number;
  jumpedCol?: number;
  jumpedPieceId?: string;
}

interface TurnMoveOptions {
  pieceMovesMap: Map<string, Move[]>;
  maxCaptures: number;
}

export class Checkers implements GameInterface {
  // Game state
  private pieces: Piece[] = [];
  private currentPlayer: PlayerColor = 'red';
  private selectedPieceId: string | null = null;
  private validMoves: Move[] = [];
  private isAnimating: boolean = false;
  private gameOver: boolean = false;
  private isMultiJumpInProgress: boolean = false;
  private currentTurnOptions: TurnMoveOptions | null = null;
  private myColor: PlayerColor | null = null;
  private winner: string | null = null;
  
  // DOM references
  private boardEl: HTMLElement | null = null;
  private pieceElementsMap: Map<string, HTMLElement> = new Map();
  private moveIndicators: HTMLElement[] = [];
  private squareElements: HTMLElement[][] = [];
  private turnIndicator: HTMLElement | null = null;
  private turnText: HTMLElement | null = null;
  private redCountEl: HTMLElement | null = null;
  private blackCountEl: HTMLElement | null = null;
  private messageArea: HTMLElement | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  // Board dimensions
  private readonly BOARD_SIZE = 10;

  private getSquareSize(): number {
    // Get the board element and calculate square size based on available width
    if (this.boardEl) {
      const boardWidth = this.boardEl.clientWidth;
      return boardWidth / this.BOARD_SIZE;
    }
    // Fallback
    return Math.min(window.innerWidth * 0.8, 640) / this.BOARD_SIZE;
  }

  private getPieceSize(): number {
    return this.getSquareSize() * 0.75;
  }

  private getPieceOffset(): number {
    return (this.getSquareSize() - this.getPieceSize()) / 2;
  }

  private getTransitionDuration(): number {
    return 1.0; // 1 second transition
  }

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="checkers-wrapper">
        <style>
          .checkers-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a2e;
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
            padding: 10px;
          }
          .game-container {
            display: flex;
            gap: 24px;
            align-items: stretch;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 100%;
          }
          .board-wrapper {
            background: #3e2723;
            border-radius: 18px;
            padding: 14px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 4px #5d4037, 0 0 0 8px #3e2723, inset 0 0 30px rgba(0, 0, 0, 0.3);
          }
          .board {
            position: relative;
            width: min(80vw, 640px);
            height: min(80vw, 640px);
            border-radius: 4px;
            overflow: hidden;
            cursor: pointer;
            background: #5d4037;
          }
          .square {
            position: absolute;
            pointer-events: none;
          }
          .square.light {
            background-color: #efebe9;
          }
          .square.dark {
            background-color: #5d4037;
          }
          .square.selected-square {
            box-shadow: inset 0 0 0 4px #ffeb3b, inset 0 0 30px rgba(255, 235, 59, 0.4);
            z-index: 5;
          }
          .square.path-highlight {
            background-color: #8d6e63 !important;
            box-shadow: inset 0 0 25px rgba(255, 183, 77, 0.5);
          }
          .square.jumped-highlight {
            background-color: #bf360c !important;
            box-shadow: inset 0 0 30px rgba(255, 80, 30, 0.7);
          }
          .piece {
            position: absolute;
            border-radius: 50%;
            z-index: 20;
            pointer-events: none;
            transition: top 1.0s cubic-bezier(0.34, 1.56, 0.64, 1),
                        left 1.0s cubic-bezier(0.34, 1.56, 0.64, 1),
                        box-shadow 1.0s ease;
            cursor: pointer;
          }
          .piece.red {
            background: radial-gradient(circle at 35% 30%, #f44336, #c62828 60%, #7f0000 100%);
            box-shadow: 0 4px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3), inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.2);
            border: 3px solid #b71c1c;
          }
          .piece.black {
            background: radial-gradient(circle at 35% 30%, #616161, #212121 60%, #000000 100%);
            box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4), inset 0 -3px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1);
            border: 3px solid #000000;
          }
          .piece.king {
            border: 4px solid #ffc107 !important;
            box-shadow: 0 4px 14px rgba(255,193,7,0.5), 0 0 20px rgba(255,193,7,0.3), 0 1px 3px rgba(0,0,0,0.4), inset 0 -3px 6px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.2) !important;
          }
          .piece.king::after {
            content: '♛';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.2em;
            color: #ffc107;
            text-shadow: 0 1px 3px rgba(0,0,0,0.6), 0 0 8px rgba(255,193,7,0.6);
            pointer-events: none;
            line-height: 1;
          }
          .piece.moving {
            z-index: 50 !important;
            box-shadow: 0 8px 25px rgba(255,235,59,0.7), 0 0 40px rgba(255,235,59,0.4), 0 2px 8px rgba(0,0,0,0.5) !important;
            transform: scale(1.08);
          }
          .piece.captured {
            transition: opacity 0.5s ease, transform 0.5s ease;
            opacity: 0;
            transform: scale(0.2);
            pointer-events: none;
            z-index: 5;
          }
          .move-indicator {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
            z-index: 10;
            transform: translate(-50%, -50%);
          }
          .move-indicator.regular {
            background: rgba(76, 175, 80, 0.65);
            box-shadow: 0 0 12px rgba(76, 175, 80, 0.5);
          }
          .move-indicator.jump {
            background: rgba(255, 152, 0, 0.75);
            box-shadow: 0 0 16px rgba(255, 152, 0, 0.7);
            animation: pulse-indicator 0.8s ease-in-out infinite;
          }
          @keyframes pulse-indicator {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.35); }
          }
          .side-panel {
            background: #2c2c3e;
            border-radius: 16px;
            padding: 22px;
            color: #e0e0e0;
            display: flex;
            flex-direction: column;
            gap: 18px;
            min-width: 200px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            align-items: center;
          }
          .side-panel h2 {
            font-size: 1.4em;
            color: #ffc107;
            text-align: center;
            letter-spacing: 1px;
            margin: 0;
          }
          .turn-indicator {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1em;
            font-weight: 600;
            padding: 10px 16px;
            border-radius: 30px;
            background: #1e1e30;
            white-space: nowrap;
            transition: all 0.4s ease;
          }
          .turn-indicator.red-turn {
            border: 2px solid #f44336;
            box-shadow: 0 0 18px rgba(244,67,54,0.4);
          }
          .turn-indicator.black-turn {
            border: 2px solid #9e9e9e;
            box-shadow: 0 0 18px rgba(158,158,158,0.4);
          }
          .turn-dot {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .turn-dot.red-dot {
            background: radial-gradient(circle at 35% 30%, #f44336, #b71c1c);
          }
          .turn-dot.black-dot {
            background: radial-gradient(circle at 35% 30%, #616161, #000);
          }
          .score-section span {
            font-weight: bold;
            color: #fff;
            font-size: 1.1em;
          }
          .btn {
            padding: 12px 28px;
            font-size: 1em;
            font-weight: 600;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            letter-spacing: 0.5px;
            transition: all 0.25s ease;
            background: #ffc107;
            color: #1a1a2e;
            box-shadow: 0 4px 14px rgba(255,193,7,0.35);
          }
          .btn:hover {
            background: #ffd54f;
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(255,193,7,0.5);
          }
          .btn:active { transform: scale(0.96); }
          .message-area {
            font-size: 0.9em;
            text-align: center;
            color: #ffab40;
            min-height: 22px;
            font-weight: 500;
          }
          .message-area.winner {
            color: #4caf50;
            font-size: 1.1em;
            font-weight: 700;
            animation: celebrate 0.6s ease-in-out;
          }
          @keyframes celebrate {
            0%,100% { transform: scale(1); }
            30% { transform: scale(1.2); }
            60% { transform: scale(0.95); }
          }
          @media (max-width: 850px) {
            .board {
              width: min(90vw, 520px);
              height: min(90vw, 520px);
            }
            .game-container {
              flex-direction: column;
              align-items: center;
            }
            .side-panel {
              flex-direction: row;
              flex-wrap: wrap;
              justify-content: center;
              gap: 10px;
            }
          }
          @media (max-width: 480px) {
            .board-wrapper {
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
              margin: 0 auto;
            }
            .board {
              width: min(100%, calc(100vw - 28px));
              height: min(100%, calc(100vw - 28px));
              max-width: 100%;
              max-height: 100%;
            }
            .btn {
              padding: 8px 16px;
              font-size: 0.8em;
            }
            .side-panel {
              padding: 12px;
              gap: 8px;
            }
          }
        </style>
        <div class="game-container">
          <div class="board-wrapper">
            <div class="board" id="checkersBoard"></div>
          </div>
          <div class="side-panel">
            <h2>🏁 10x10 Draughts</h2>
            <div class="turn-indicator red-turn" id="turnIndicator">
              <div class="turn-dot red-dot"></div>
              <span id="turnText">Red's Turn</span>
            </div>
            <div class="score-section">
              Red: <span id="redCount">20</span> &nbsp;|&nbsp; Black: <span id="blackCount">20</span>
            </div>
            <div class="message-area" id="messageArea"></div>
            <button class="btn" id="checkersResetBtn">🔄 New Game</button>
          </div>
        </div>
      </div>
    `;

    this.boardEl = document.getElementById('checkersBoard');
    this.turnIndicator = document.getElementById('turnIndicator');
    this.turnText = document.getElementById('turnText');
    this.redCountEl = document.getElementById('redCount');
    this.blackCountEl = document.getElementById('blackCount');
    this.messageArea = document.getElementById('messageArea');

    this.assignColorAndMode();
    this.initGame();
    
    document.getElementById('checkersResetBtn')!.onclick = () => {
      this.resetGame();
      sendGameEvent('checkers_move', this.getStatePayload());
    };

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);

    this.playersUnsubscribe = store.subscribe(() => {
      const old = this.myColor;
      this.assignColorAndMode();
      if (old !== this.myColor) this.resetGame();
    });
  }

  private handleResize = () => {
    this.redrawBoard();
  };

  private redrawBoard() {
    if (!this.boardEl) return;
    
    const squareSize = this.getSquareSize();
    const pieceSize = this.getPieceSize();
    const pieceOffset = this.getPieceOffset();
    
    // Update square sizes
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const sq = this.squareElements[row]?.[col];
        if (sq) {
          sq.style.width = squareSize + 'px';
          sq.style.height = squareSize + 'px';
          sq.style.top = row * squareSize + 'px';
          sq.style.left = col * squareSize + 'px';
        }
      }
    }
    
    // Update piece positions
    this.pieces.forEach(piece => {
      if (!piece.captured) {
        const el = this.pieceElementsMap.get(piece.id);
        if (el) {
          el.style.width = pieceSize + 'px';
          el.style.height = pieceSize + 'px';
          el.style.top = piece.row * squareSize + pieceOffset + 'px';
          el.style.left = piece.col * squareSize + pieceOffset + 'px';
        }
      }
    });
    
    // Update move indicators
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
    if (this.selectedPieceId) {
      this.showMoveIndicators(this.validMoves);
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.currentPlayer !== this.myColor || this.gameOver || this.isAnimating) return;
    
    if (e.key === 'Escape' && this.selectedPieceId && !this.isMultiJumpInProgress) {
      this.selectedPieceId = null;
      this.validMoves = [];
      this.clearAllHighlights();
      this.moveIndicators.forEach(el => el.remove());
      this.moveIndicators = [];
      this.setMessage('');
    }
  };

  private assignColorAndMode() {
    const players = store.state.players;
    const myId = store.state.profile?.id;
    if (players.length >= 2 && myId) {
      const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
      const idx = sortedPlayers.findIndex(p => p.id === myId);
      this.myColor = idx === 0 ? 'red' : 'black';
    } else {
      this.myColor = 'red';
    }
  }

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'checkers_move') {
      this.pieces = payload.pieces;
      this.currentPlayer = payload.currentPlayer;
      this.winner = payload.winner;
      this.gameOver = payload.gameOver;
      this.isMultiJumpInProgress = payload.isMultiJumpInProgress || false;
      this.selectedPieceId = payload.selectedPieceId;
      this.validMoves = payload.validMoves || [];
      this.currentTurnOptions = payload.currentTurnOptions;
      
      this.rebuildUI();
    } else if (event === 'checkers_reset') {
      this.resetGame();
    }
  };

  private rebuildUI() {
    if (!this.boardEl) return;
    
    this.pieceElementsMap.forEach(el => el.remove());
    this.pieceElementsMap.clear();
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
    
    this.pieces.forEach(p => {
      if (!p.captured) this.createPieceElement(p);
    });
    
    this.clearAllHighlights();
    if (this.selectedPieceId) {
      const selectedPiece = this.getPieceById(this.selectedPieceId);
      if (selectedPiece) {
        this.highlightSelectedPiece(selectedPiece);
        this.showMoveIndicators(this.validMoves);
      }
    }
    
    this.updateTurnIndicator();
    this.updateCounts();
    
    if (this.winner) {
      this.setMessage(`🏆 ${this.winner.charAt(0).toUpperCase() + this.winner.slice(1)} Wins!`);
    } else if (this.isMultiJumpInProgress) {
      this.setMessage('🦘 Continue jumping!');
    }
  }

  private getPieceAt(row: number, col: number, ignoreSet: Set<string> = new Set()): Piece | null {
    return this.pieces.find(p => !p.captured && p.row === row && p.col === col && !ignoreSet.has(p.id)) || null;
  }

  private getActivePieces(player: PlayerColor): Piece[] {
    return this.pieces.filter(p => !p.captured && p.player === player);
  }

  private getPieceById(id: string): Piece | null {
    return this.pieces.find(p => p.id === id) || null;
  }

  private getManRegularMoves(row: number, col: number, player: PlayerColor, ignoreSet: Set<string> = new Set()): Move[] {
    const moves: Move[] = [];
    const forward = player === 'red' ? -1 : 1;
    for (let dc of [-1, 1]) {
      const nr = row + forward, nc = col + dc;
      if (nr >= 0 && nr < this.BOARD_SIZE && nc >= 0 && nc < this.BOARD_SIZE && !this.getPieceAt(nr, nc, ignoreSet)) {
        moves.push({ row: nr, col: nc, isJump: false });
      }
    }
    return moves;
  }

  private getKingSlideMoves(row: number, col: number, ignoreSet: Set<string> = new Set()): Move[] {
    const moves: Move[] = [];
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE) {
        if (this.getPieceAt(r, c, ignoreSet)) break;
        moves.push({ row: r, col: c, isJump: false });
        r += dr; c += dc;
      }
    }
    return moves;
  }

  private getManJumpMoves(row: number, col: number, player: PlayerColor, ignoreSet: Set<string> = new Set()): Move[] {
    const moves: Move[] = [];
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let [dr, dc] of dirs) {
      const mr = row + dr, mc = col + dc;
      const lr = row + 2 * dr, lc = col + 2 * dc;
      if (lr >= 0 && lr < this.BOARD_SIZE && lc >= 0 && lc < this.BOARD_SIZE) {
        const mid = this.getPieceAt(mr, mc, ignoreSet);
        if (mid && mid.player !== player && !this.getPieceAt(lr, lc, ignoreSet)) {
          moves.push({
            row: lr,
            col: lc,
            isJump: true,
            jumpedRow: mr,
            jumpedCol: mc,
            jumpedPieceId: mid.id
          });
        }
      }
    }
    return moves;
  }

  private getKingJumpMoves(row: number, col: number, player: PlayerColor, ignoreSet: Set<string> = new Set()): Move[] {
    const moves: Move[] = [];
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE) {
        const piece = this.getPieceAt(r, c, ignoreSet);
        if (piece) {
          if (piece.player !== player) {
            let lr = r + dr, lc = c + dc;
            while (lr >= 0 && lr < this.BOARD_SIZE && lc >= 0 && lc < this.BOARD_SIZE) {
              if (!this.getPieceAt(lr, lc, ignoreSet)) {
                moves.push({
                  row: lr,
                  col: lc,
                  isJump: true,
                  jumpedRow: r,
                  jumpedCol: c,
                  jumpedPieceId: piece.id
                });
              } else break;
              lr += dr; lc += dc;
            }
          }
          break;
        }
        r += dr; c += dc;
      }
    }
    return moves;
  }

  private buildCaptureSequences(row: number, col: number, player: PlayerColor, isKing: boolean, ignoreSet: Set<string>): Move[][] {
    const sequences: Move[][] = [];
    const jumps = isKing
      ? this.getKingJumpMoves(row, col, player, ignoreSet)
      : this.getManJumpMoves(row, col, player, ignoreSet);

    if (jumps.length === 0) return [[]];

    for (const move of jumps) {
      if (ignoreSet.has(move.jumpedPieceId!)) continue;
      const newIgnore = new Set(ignoreSet);
      newIgnore.add(move.jumpedPieceId!);
      let nextIsKing = isKing;
      if (!isKing) {
        if ((player === 'red' && move.row === 0) || (player === 'black' && move.row === this.BOARD_SIZE - 1)) {
          nextIsKing = true;
          sequences.push([move]);
          continue;
        }
      }
      const subSeqs = this.buildCaptureSequences(move.row, move.col, player, nextIsKing, newIgnore);
      for (const sub of subSeqs) sequences.push([move, ...sub]);
    }
    return sequences;
  }

  private getRegularMovesForPiece(piece: Piece, ignoreSet: Set<string> = new Set()): Move[] {
    return piece.isKing
      ? this.getKingSlideMoves(piece.row, piece.col, ignoreSet)
      : this.getManRegularMoves(piece.row, piece.col, piece.player, ignoreSet);
  }

  private computeTurnMoveOptions(): TurnMoveOptions {
    const map = new Map<string, Move[]>();
    let maxCaptures = 0;
    const activePieces = this.getActivePieces(this.currentPlayer);
    const seqCache = new Map<string, Move[][]>();

    for (const piece of activePieces) {
      const seqs = this.buildCaptureSequences(piece.row, piece.col, piece.player, piece.isKing, new Set());
      seqCache.set(piece.id, seqs);
      const pieceMax = Math.max(...seqs.map(s => s.length));
      if (pieceMax > maxCaptures) maxCaptures = pieceMax;
    }

    for (const piece of activePieces) {
      const seqs = seqCache.get(piece.id)!;
      let moves: Move[] = [];
      if (maxCaptures > 0) {
        const maxSeqs = seqs.filter(s => s.length === maxCaptures);
        const seen = new Set<string>();
        for (const seq of maxSeqs) {
          if (seq.length > 0) {
            const first = seq[0];
            const key = `${first.row},${first.col}`;
            if (!seen.has(key)) {
              seen.add(key);
              moves.push(first);
            }
          }
        }
      } else {
        moves = this.getRegularMovesForPiece(piece, new Set());
      }
      map.set(piece.id, moves);
    }
    return { pieceMovesMap: map, maxCaptures };
  }

  private getNextJumpMovesForPiece(piece: Piece): Move[] {
    const seqs = this.buildCaptureSequences(piece.row, piece.col, piece.player, piece.isKing, new Set());
    const maxLen = Math.max(...seqs.map(s => s.length));
    if (maxLen === 0) return [];
    const maxSeqs = seqs.filter(s => s.length === maxLen);
    const moves: Move[] = [];
    const seen = new Set<string>();
    for (const seq of maxSeqs) {
      if (seq.length > 0) {
        const first = seq[0];
        const key = `${first.row},${first.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          moves.push(first);
        }
      }
    }
    return moves;
  }

  private createSquareElements() {
    if (!this.boardEl) return;
    this.squareElements = [];
    const squareSize = this.getSquareSize();
    
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      this.squareElements[row] = [];
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        const sq = document.createElement('div');
        sq.classList.add('square');
        sq.classList.add((row + col) % 2 === 0 ? 'dark' : 'light');
        sq.style.width = squareSize + 'px';
        sq.style.height = squareSize + 'px';
        sq.style.top = row * squareSize + 'px';
        sq.style.left = col * squareSize + 'px';
        sq.dataset.row = row.toString();
        sq.dataset.col = col.toString();
        this.boardEl!.appendChild(sq);
        this.squareElements[row][col] = sq;
      }
    }
  }

  private createInitialPieces() {
    this.pieces = [];
    this.pieceElementsMap = new Map();
    let idCount = 0;
    
    // Black pieces (top)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if ((row + col) % 2 === 0) {
          const piece: Piece = {
            id: 'black-' + idCount,
            player: 'black',
            row,
            col,
            isKing: false,
            captured: false
          };
          idCount++;
          this.pieces.push(piece);
        }
      }
    }
    
    // Red pieces (bottom)
    for (let row = this.BOARD_SIZE - 4; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        if ((row + col) % 2 === 0) {
          const piece: Piece = {
            id: 'red-' + idCount,
            player: 'red',
            row,
            col,
            isKing: false,
            captured: false
          };
          idCount++;
          this.pieces.push(piece);
        }
      }
    }
    
    this.pieces.forEach(p => this.createPieceElement(p));
  }

  private createPieceElement(piece: Piece) {
    if (!this.boardEl || piece.captured) return;
    
    const squareSize = this.getSquareSize();
    const pieceSize = this.getPieceSize();
    const pieceOffset = this.getPieceOffset();
    
    const el = document.createElement('div');
    el.classList.add('piece', piece.player);
    el.id = 'piece-' + piece.id;
    el.style.width = pieceSize + 'px';
    el.style.height = pieceSize + 'px';
    el.style.top = piece.row * squareSize + pieceOffset + 'px';
    el.style.left = piece.col * squareSize + pieceOffset + 'px';
    if (piece.isKing) el.classList.add('king');
    this.boardEl.appendChild(el);
    this.pieceElementsMap.set(piece.id, el);
  }

  private clearAllHighlights() {
    for (let row = 0; row < this.BOARD_SIZE; row++) {
      for (let col = 0; col < this.BOARD_SIZE; col++) {
        this.squareElements[row]?.[col]?.classList.remove('path-highlight', 'jumped-highlight', 'selected-square');
      }
    }
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
  }

  private showMoveIndicators(moves: Move[]) {
    this.clearAllHighlights();
    const squareSize = this.getSquareSize();
    moves.forEach(move => {
      const ind = document.createElement('div');
      ind.classList.add('move-indicator', move.isJump ? 'jump' : 'regular');
      const indicatorSize = move.isJump ? squareSize * 0.4 : squareSize * 0.35;
      ind.style.width = indicatorSize + 'px';
      ind.style.height = indicatorSize + 'px';
      ind.style.top = move.row * squareSize + squareSize / 2 + 'px';
      ind.style.left = move.col * squareSize + squareSize / 2 + 'px';
      this.boardEl!.appendChild(ind);
      this.moveIndicators.push(ind);
    });
  }

  private highlightSelectedPiece(piece: Piece | null) {
    if (piece && this.squareElements[piece.row]?.[piece.col]) {
      this.squareElements[piece.row][piece.col].classList.add('selected-square');
    }
  }

  private highlightPathSquares(r1: number, c1: number, r2: number, c2: number) {
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    let r = r1, c = c1;
    while (r !== r2 || c !== c2) {
      this.squareElements[r]?.[c]?.classList.add('path-highlight');
      r += dr;
      c += dc;
    }
    this.squareElements[r2]?.[c2]?.classList.add('path-highlight');
  }

  private highlightJumpedSquare(row: number, col: number) {
    this.squareElements[row]?.[col]?.classList.add('jumped-highlight');
  }

  private animatePiece(pieceId: string, toRow: number, toCol: number) {
    const el = this.pieceElementsMap.get(pieceId);
    if (!el) return;
    const squareSize = this.getSquareSize();
    const pieceOffset = this.getPieceOffset();
    el.classList.add('moving');
    el.style.top = toRow * squareSize + pieceOffset + 'px';
    el.style.left = toCol * squareSize + pieceOffset + 'px';
  }

  private executeMove(pieceId: string, move: Move) {
    if (this.isAnimating || this.gameOver || this.currentPlayer !== this.myColor) return;
    
    this.isAnimating = true;
    const piece = this.getPieceById(pieceId);
    if (!piece) {
      this.isAnimating = false;
      return;
    }
    
    const fromRow = piece.row, fromCol = piece.col;
    const toRow = move.row, toCol = move.col;
    const isJump = move.isJump;
    
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
    this.clearAllHighlights();
    this.highlightSelectedPiece(null);
    this.animatePiece(pieceId, toRow, toCol);
    this.highlightPathSquares(fromRow, fromCol, toRow, toCol);
    
    if (isJump && move.jumpedRow !== undefined && move.jumpedCol !== undefined) {
      this.highlightJumpedSquare(move.jumpedRow, move.jumpedCol);
    }

    setTimeout(() => {
      const el = this.pieceElementsMap.get(pieceId);
      if (el) el.classList.remove('moving');
      
      piece.row = toRow;
      piece.col = toCol;
      
      if (isJump && move.jumpedPieceId) {
        const jumped = this.getPieceById(move.jumpedPieceId);
        if (jumped) {
          jumped.captured = true;
          const jel = this.pieceElementsMap.get(move.jumpedPieceId);
          if (jel) {
            jel.classList.add('captured');
            setTimeout(() => {
              jel.remove();
              this.pieceElementsMap.delete(move.jumpedPieceId!);
            }, 500);
          }
        }
      }
      
      let promoted = false;
      if (!piece.isKing) {
        if ((piece.player === 'red' && piece.row === 0) || (piece.player === 'black' && piece.row === this.BOARD_SIZE - 1)) {
          piece.isKing = true;
          if (el) el.classList.add('king');
          promoted = true;
        }
      }
      
      this.updateCounts();
      setTimeout(() => this.clearAllHighlights(), 350);

      if (isJump && !promoted) {
        const nextMoves = this.getNextJumpMovesForPiece(piece);
        if (nextMoves.length > 0) {
          this.isMultiJumpInProgress = true;
          this.selectedPieceId = pieceId;
          this.validMoves = nextMoves;
          this.showMoveIndicators(nextMoves);
          this.highlightSelectedPiece(piece);
          this.isAnimating = false;
          this.setMessage('🦘 Continue jumping!');
          this.syncState();
          return;
        }
      }
      
      if (promoted && isJump) {
        this.setMessage('👑 Crowned! Turn ends.');
      } else {
        this.setMessage('');
      }
      
      this.finishTurn();
    }, this.getTransitionDuration() * 1000 + 40);
  }

  private finishTurn() {
    this.selectedPieceId = null;
    this.validMoves = [];
    this.clearAllHighlights();
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
    this.isMultiJumpInProgress = false;
    this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    this.updateTurnIndicator();
    this.currentTurnOptions = this.computeTurnMoveOptions();
    this.isAnimating = false;
    this.checkGameOver();
    this.syncState();
  }

  private syncState() {
    sendGameEvent('checkers_move', {
      pieces: this.pieces,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      gameOver: this.gameOver,
      isMultiJumpInProgress: this.isMultiJumpInProgress,
      selectedPieceId: this.selectedPieceId,
      validMoves: this.validMoves,
      currentTurnOptions: this.currentTurnOptions
    });
  }

  private updateTurnIndicator() {
    if (!this.turnIndicator || !this.turnText) return;
    
    this.turnIndicator.classList.remove('red-turn', 'black-turn');
    if (this.currentPlayer === 'red') {
      this.turnIndicator.classList.add('red-turn');
      const dot = this.turnIndicator.querySelector('.turn-dot');
      if (dot) { dot.className = 'turn-dot red-dot'; }
      this.turnText.textContent = "Red's Turn";
    } else {
      this.turnIndicator.classList.add('black-turn');
      const dot = this.turnIndicator.querySelector('.turn-dot');
      if (dot) { dot.className = 'turn-dot black-dot'; }
      this.turnText.textContent = "Black's Turn";
    }
  }

  private updateCounts() {
    if (this.redCountEl) {
      this.redCountEl.textContent = this.getActivePieces('red').length.toString();
    }
    if (this.blackCountEl) {
      this.blackCountEl.textContent = this.getActivePieces('black').length.toString();
    }
  }

  private setMessage(msg: string) {
    if (!this.messageArea) return;
    this.messageArea.textContent = msg;
    this.messageArea.classList.remove('winner');
    if (msg.includes('Wins')) {
      this.messageArea.classList.add('winner');
    }
  }

  private checkGameOver() {
    const reds = this.getActivePieces('red').length;
    const blacks = this.getActivePieces('black').length;
    
    if (reds === 0) {
      this.gameOver = true;
      this.winner = 'black';
      this.setMessage('🏆 Black Wins!');
      return;
    }
    if (blacks === 0) {
      this.gameOver = true;
      this.winner = 'red';
      this.setMessage('🏆 Red Wins!');
      return;
    }
    
    const hasMove = this.getActivePieces(this.currentPlayer).some(p =>
      (this.currentTurnOptions?.pieceMovesMap.get(p.id) || []).length > 0
    );
    
    if (!hasMove) {
      this.gameOver = true;
      const winner = this.currentPlayer === 'red' ? 'black' : 'red';
      this.winner = winner;
      this.setMessage(`🏆 ${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins! (No moves)`);
    }
  }

  private handleBoardClick = (e: MouseEvent) => {
    if (this.isAnimating || this.gameOver || this.currentPlayer !== this.myColor) return;
    if (!this.boardEl) return;
    
    const rect = this.boardEl.getBoundingClientRect();
    const squareSize = this.getSquareSize();
    const col = Math.floor((e.clientX - rect.left) / squareSize);
    const row = Math.floor((e.clientY - rect.top) / squareSize);
    
    if (row < 0 || row >= this.BOARD_SIZE || col < 0 || col >= this.BOARD_SIZE) return;
    
    this.handleSquareClick(row, col);
  };

  private handleSquareClick(row: number, col: number) {
    const clickedPiece = this.getPieceAt(row, col);
    
    if (this.selectedPieceId === null) {
      if (clickedPiece && clickedPiece.player === this.currentPlayer && !clickedPiece.captured) {
        const moves = this.currentTurnOptions?.pieceMovesMap.get(clickedPiece.id) || [];
        if (moves.length === 0) {
          this.setMessage('No legal moves');
          return;
        }
        this.selectedPieceId = clickedPiece.id;
        this.validMoves = moves;
        this.showMoveIndicators(moves);
        this.highlightSelectedPiece(clickedPiece);
        this.setMessage(moves[0].isJump ? '🔥 Capture mandatory (max)!' : 'Select destination');
      }
      return;
    }
    
    if (this.isMultiJumpInProgress && clickedPiece && clickedPiece.id !== this.selectedPieceId) return;
    
    const move = this.validMoves.find(m => m.row === row && m.col === col);
    if (move) {
      this.executeMove(this.selectedPieceId, move);
      return;
    }
    
    if (!this.isMultiJumpInProgress) {
      if (clickedPiece && clickedPiece.player === this.currentPlayer && clickedPiece.id !== this.selectedPieceId) {
        const moves = this.currentTurnOptions?.pieceMovesMap.get(clickedPiece.id) || [];
        if (moves.length === 0) {
          this.selectedPieceId = null;
          this.validMoves = [];
          this.clearAllHighlights();
          this.moveIndicators.forEach(el => el.remove());
          this.moveIndicators = [];
          return;
        }
        this.selectedPieceId = clickedPiece.id;
        this.validMoves = moves;
        this.showMoveIndicators(moves);
        this.highlightSelectedPiece(clickedPiece);
        this.setMessage(moves[0].isJump ? '🔥 Capture mandatory (max)!' : 'Select destination');
      } else {
        this.selectedPieceId = null;
        this.validMoves = [];
        this.clearAllHighlights();
        this.moveIndicators.forEach(el => el.remove());
        this.moveIndicators = [];
        this.setMessage('');
      }
    }
  }

  private resetGame() {
    this.isAnimating = false;
    this.gameOver = false;
    this.isMultiJumpInProgress = false;
    this.selectedPieceId = null;
    this.validMoves = [];
    this.currentPlayer = 'red';
    this.winner = null;
    
    this.pieceElementsMap.forEach(el => el.remove());
    this.pieceElementsMap = new Map();
    this.moveIndicators.forEach(el => el.remove());
    this.moveIndicators = [];
    this.clearAllHighlights();
    
    if (this.boardEl) {
      this.boardEl.innerHTML = '';
    }
    
    this.createSquareElements();
    this.createInitialPieces();
    this.updateTurnIndicator();
    this.updateCounts();
    this.setMessage('');
    this.messageArea?.classList.remove('winner');
    this.currentTurnOptions = this.computeTurnMoveOptions();
    
    if (this.boardEl) {
      this.boardEl.addEventListener('click', this.handleBoardClick);
    }
  }

  private initGame() {
    if (!this.boardEl) return;
    
    this.createSquareElements();
    this.createInitialPieces();
    this.updateTurnIndicator();
    this.updateCounts();
    this.currentTurnOptions = this.computeTurnMoveOptions();
    this.setMessage('Click a piece · Jumps mandatory');
    
    this.boardEl.addEventListener('click', this.handleBoardClick);
  }

  private getStatePayload() {
    return {
      pieces: this.pieces,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      gameOver: this.gameOver,
      isMultiJumpInProgress: this.isMultiJumpInProgress,
      selectedPieceId: this.selectedPieceId,
      validMoves: this.validMoves,
      currentTurnOptions: this.currentTurnOptions
    };
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'checkers_move') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    } else if (event === 'checkers_reset') {
      this.resetGame();
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.boardEl) {
      this.boardEl.removeEventListener('click', this.handleBoardClick);
    }
    if (this.playersUnsubscribe) this.playersUnsubscribe();
  }
}