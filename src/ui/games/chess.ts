import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

// ──────────────────────────────────────────────
//  Chess Implementation with Visible Animations
// ──────────────────────────────────────────────

const UNICODE: Record<string, Record<string, string>> = {
    white: { king:'♔', queen:'♕', rook:'♖', bishop:'♗', knight:'♘', pawn:'♙' },
    black: { king:'♚', queen:'♛', rook:'♜', bishop:'♝', knight:'♞', pawn:'♟' }
};

interface Piece {
    color: string;
    type: string;
    id: string;
    hasMoved: boolean;
}

interface Move {
    row: number;
    col: number;
    special?: string;
}

export class Chess implements GameInterface {
    private board: (Piece | null)[][] = [];
    private currentPlayer: string = 'white';
    private selectedRow: number | null = null;
    private selectedCol: number | null = null;
    private legalMoves: Move[] = [];
    private isAnimating: boolean = false;
    private gameOver: boolean = false;
    private enPassantTarget: { row: number; col: number } | null = null;
    private castlingRights: Record<string, { kingSide: boolean; queenSide: boolean }> = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    private pieceElements: Map<string, HTMLElement> = new Map();
    private moveIndicators: HTMLElement[] = [];
    private myColor: string | null = null;
    private winner: string | null = null;
    private statusMessage: string = '';
    
    private boardEl: HTMLElement | null = null;
    private turnIndicator: HTMLElement | null = null;
    private turnText: HTMLElement | null = null;
    private statusMsg: HTMLElement | null = null;
    private playersUnsubscribe: (() => void) | null = null;

    private readonly BOARD_SIZE = 8;

    private getSquareSize(): number {
        if (this.boardEl) {
            const boardWidth = this.boardEl.clientWidth;
            return boardWidth / this.BOARD_SIZE;
        }
        return Math.min(window.innerWidth * 0.8, 560) / this.BOARD_SIZE;
    }

    private getPieceSize(): number {
        return this.getSquareSize() * 0.8;
    }

    private getPieceOffset(): number {
        return (this.getSquareSize() - this.getPieceSize()) / 2;
    }

    private getTransitionMs(): number {
        return 1400;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="chess-wrapper">
                <style>
                    .chess-wrapper {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        background: #2b2b2b;
                        font-family: 'Segoe UI', sans-serif;
                        user-select: none;
                        -webkit-user-select: none;
                        padding: 10px;
                    }
                    .game-container {
                        display: flex;
                        gap: 30px;
                        align-items: flex-start;
                        flex-wrap: wrap;
                        justify-content: center;
                        max-width: 100%;
                    }
                    .board-wrapper {
                        background: #3e2723;
                        border-radius: 12px;
                        padding: 10px;
                        box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 0 3px #5d4037;
                    }
                    .board {
                        position: relative;
                        width: min(80vw, 560px);
                        height: min(80vw, 560px);
                        cursor: pointer;
                        display: grid;
                        grid-template-columns: repeat(8, 1fr);
                        grid-template-rows: repeat(8, 1fr);
                    }
                    .square {
                        width: 100%;
                        height: 100%;
                        position: relative;
                        transition: background-color 0.2s;
                    }
                    .square.light { background-color: #f0d9b5; }
                    .square.dark { background-color: #b58863; }
                    .square.selected { 
                        box-shadow: inset 0 0 0 4px #fdd835; 
                        z-index: 2; 
                    }
                    .square.possible-move::after {
                        content: '';
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 30%;
                        height: 30%;
                        border-radius: 50%;
                        background-color: rgba(76, 175, 80, 0.7);
                        box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
                        z-index: 5;
                    }
                    .square.possible-capture::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        border-radius: 50%;
                        border: 6px solid rgba(200, 50, 50, 0.7);
                        box-shadow: inset 0 0 15px rgba(200, 50, 50, 0.4);
                        z-index: 5;
                        box-sizing: border-box;
                    }
                    .square.in-check { 
                        background-color: #e05252 !important; 
                        animation: pulse-check 0.8s infinite; 
                    }
                    @keyframes pulse-check { 
                        0%,100% { opacity:1; } 
                        50% { opacity:0.7; } 
                    }
                    .square.last-move {
                        background-color: rgba(255, 255, 0, 0.3) !important;
                    }

                    .piece {
                        position: absolute;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                        pointer-events: none;
                        transition: top 1.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                                    left 1.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                        background: radial-gradient(circle at 35% 30%, #fff, #aaa 80%);
                        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
                        border: 2px solid #555;
                        color: #000;
                    }
                    .piece.black-piece {
                        background: radial-gradient(circle at 35% 30%, #555, #111 80%);
                        color: #ddd;
                        border-color: #000;
                    }
                    .piece.moving {
                        z-index: 50 !important;
                        box-shadow: 0 8px 25px rgba(255,235,59,0.7);
                        transform: scale(1.08);
                    }
                    .piece.captured-piece {
                        transition: opacity 0.5s;
                        opacity: 0;
                        pointer-events: none;
                    }

                    .side-panel {
                        background: #3b3b4d;
                        border-radius: 16px;
                        padding: 24px;
                        color: #e0e0e0;
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                        min-width: 200px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                        align-items: center;
                    }
                    .turn-indicator {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-size: 1.1em;
                        font-weight: 600;
                        padding: 10px 18px;
                        border-radius: 30px;
                        background: #24242e;
                    }
                    .turn-indicator.white-turn { 
                        border: 2px solid #f5f5f5; 
                        box-shadow: 0 0 15px rgba(255,255,255,0.3); 
                    }
                    .turn-indicator.black-turn { 
                        border: 2px solid #333; 
                        box-shadow: 0 0 15px rgba(0,0,0,0.5); 
                    }
                    .turn-dot {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: radial-gradient(circle at 35% 30%, #fff, #aaa);
                    }
                    .turn-dot.black-dot { 
                        background: radial-gradient(circle at 35% 30%, #555, #000); 
                    }
                    .status-message {
                        font-size: 0.95em;
                        text-align: center;
                        color: #ffb74d;
                        min-height: 24px;
                    }
                    .btn {
                        padding: 12px 28px;
                        font-size: 1em;
                        font-weight: 600;
                        border: none;
                        border-radius: 30px;
                        cursor: pointer;
                        background: #fdd835;
                        color: #1a1a2e;
                        box-shadow: 0 4px 14px rgba(253,216,53,0.4);
                    }
                    .btn:hover { 
                        background: #ffee58; 
                        transform: translateY(-2px); 
                    }

                    .promotion-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.6);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 200;
                    }
                    .promotion-dialog {
                        background: #2c2c3e;
                        border-radius: 16px;
                        padding: 20px;
                        display: flex;
                        gap: 15px;
                    }
                    .promotion-piece {
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        font-size: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        background: radial-gradient(circle at 35% 30%, #fff, #aaa 80%);
                        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    }
                    .promotion-piece.black-promo {
                        background: radial-gradient(circle at 35% 30%, #555, #111 80%);
                        color: #ddd;
                    }
                    .promotion-piece:hover { 
                        transform: scale(1.15); 
                    }

                    @media (max-width: 850px) {
                        .board {
                            width: min(90vw, 480px);
                            height: min(90vw, 480px);
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
                            min-width: auto;
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
                            width: min(100%, calc(100vw - 24px));
                            height: min(100%, calc(100vw - 24px));
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
                        <div class="board" id="chessBoard"></div>
                    </div>
                    <div class="side-panel">
                        <h2 style="color:#fdd835;margin:0;">♟️ Chess</h2>
                        <div class="turn-indicator white-turn" id="turnIndicator">
                            <div class="turn-dot"></div>
                            <span id="turnText">White's turn</span>
                        </div>
                        <div class="status-message" id="statusMessage"></div>
                        <button class="btn" id="chessResetBtn">🔄 New Game</button>
                    </div>
                </div>
                <div class="promotion-overlay" id="promotionOverlay" style="display:none;">
                    <div class="promotion-dialog" id="promotionDialog"></div>
                </div>
            </div>
        `;

        this.boardEl = document.getElementById('chessBoard');
        this.turnIndicator = document.getElementById('turnIndicator');
        this.turnText = document.getElementById('turnText');
        this.statusMsg = document.getElementById('statusMessage');

        this.assignColor();
        this.setupBoard();
        this.createBoardDOM();
        this.renderPieces();
        this.updateTurnDisplay();
        
        document.getElementById('chessResetBtn')!.onclick = () => {
            this.resetGame();
            sendGameEvent('chess_move', this.getStatePayload());
        };

        if (this.boardEl) {
            this.boardEl.addEventListener('click', this.handleBoardClick);
        }

        window.addEventListener('game_event', this.onGameEvent);
        window.addEventListener('resize', this.handleResize);
        document.addEventListener('keydown', this.handleKeyDown);

        this.playersUnsubscribe = store.subscribe(() => {
            const old = this.myColor;
            this.assignColor();
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
        
        this.pieceElements.forEach((el, key) => {
            const [row, col] = key.split(',').map(Number);
            el.style.width = pieceSize + 'px';
            el.style.height = pieceSize + 'px';
            el.style.top = row * squareSize + pieceOffset + 'px';
            el.style.left = col * squareSize + pieceOffset + 'px';
            el.style.fontSize = (pieceSize * 0.65) + 'px';
        });
        
        // Redraw move indicators
        this.clearMoveIndicators();
        if (this.selectedRow !== null && this.selectedCol !== null) {
            this.showMoveIndicators(this.legalMoves);
        }
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (this.currentPlayer !== this.myColor || this.gameOver || this.isAnimating) return;
        
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
            this.resetGame();
            sendGameEvent('chess_move', this.getStatePayload());
        }
        if (e.key === 'Escape' && this.selectedRow != null && !this.isAnimating) {
            this.selectedRow = null;
            this.selectedCol = null;
            this.legalMoves = [];
            this.clearHighlights();
            this.clearMoveIndicators();
        }
    };

    private assignColor() {
        const players = store.state.players;
        const myId = store.state.profile?.id;
        if (players.length >= 2 && myId) {
            const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
            const idx = sortedPlayers.findIndex(p => p.id === myId);
            this.myColor = idx === 0 ? 'white' : 'black';
        } else {
            this.myColor = 'white';
        }
    }

    private onGameEvent = (e: Event) => {
        const { event, payload } = (e as CustomEvent).detail;
        if (event === 'chess_move') {
            this.board = payload.board;
            this.currentPlayer = payload.currentPlayer;
            this.winner = payload.winner;
            this.gameOver = payload.gameOver;
            this.enPassantTarget = payload.enPassantTarget;
            this.castlingRights = payload.castlingRights;
            this.statusMessage = payload.statusMessage || '';
            
            this.selectedRow = null;
            this.selectedCol = null;
            this.legalMoves = [];
            this.clearHighlights();
            this.clearMoveIndicators();
            this.renderPieces();
            this.updateTurnDisplay();
            if (this.statusMsg) {
                this.statusMsg.textContent = this.statusMessage;
            }
        } else if (event === 'chess_reset') {
            this.resetGame();
        }
    };

    private createPiece(color: string, type: string): Piece {
        return { color, type, id: Math.random().toString(36).substr(2, 9), hasMoved: false };
    }

    private setupBoard() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Black pieces
        this.board[0][0] = this.createPiece('black', 'rook');
        this.board[0][1] = this.createPiece('black', 'knight');
        this.board[0][2] = this.createPiece('black', 'bishop');
        this.board[0][3] = this.createPiece('black', 'queen');
        this.board[0][4] = this.createPiece('black', 'king');
        this.board[0][5] = this.createPiece('black', 'bishop');
        this.board[0][6] = this.createPiece('black', 'knight');
        this.board[0][7] = this.createPiece('black', 'rook');
        for (let i = 0; i < 8; i++) this.board[1][i] = this.createPiece('black', 'pawn');
        
        // White pieces
        this.board[7][0] = this.createPiece('white', 'rook');
        this.board[7][1] = this.createPiece('white', 'knight');
        this.board[7][2] = this.createPiece('white', 'bishop');
        this.board[7][3] = this.createPiece('white', 'queen');
        this.board[7][4] = this.createPiece('white', 'king');
        this.board[7][5] = this.createPiece('white', 'bishop');
        this.board[7][6] = this.createPiece('white', 'knight');
        this.board[7][7] = this.createPiece('white', 'rook');
        for (let i = 0; i < 8; i++) this.board[6][i] = this.createPiece('white', 'pawn');
        
        this.currentPlayer = 'white';
        this.selectedRow = null;
        this.selectedCol = null;
        this.legalMoves = [];
        this.isAnimating = false;
        this.gameOver = false;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true }
        };
        this.winner = null;
        this.statusMessage = '';
    }

    private createBoardDOM() {
        if (!this.boardEl) return;
        this.boardEl.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = document.createElement('div');
                sq.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');
                sq.dataset.row = r.toString();
                sq.dataset.col = c.toString();
                this.boardEl.appendChild(sq);
            }
        }
    }

    private renderPieces() {
        this.pieceElements.forEach(el => el.remove());
        this.pieceElements.clear();
        this.clearMoveIndicators();
        
        const squareSize = this.getSquareSize();
        const pieceSize = this.getPieceSize();
        const pieceOffset = this.getPieceOffset();
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    const el = document.createElement('div');
                    el.classList.add('piece');
                    if (piece.color === 'black') el.classList.add('black-piece');
                    el.textContent = UNICODE[piece.color][piece.type];
                    el.style.width = pieceSize + 'px';
                    el.style.height = pieceSize + 'px';
                    el.style.fontSize = (pieceSize * 0.65) + 'px';
                    el.style.top = r * squareSize + pieceOffset + 'px';
                    el.style.left = c * squareSize + pieceOffset + 'px';
                    el.dataset.pieceId = piece.id;
                    this.boardEl!.appendChild(el);
                    this.pieceElements.set(`${r},${c}`, el);
                }
            }
        }
        
        // Re-show move indicators if a piece is selected
        if (this.selectedRow !== null && this.selectedCol !== null) {
            this.showMoveIndicators(this.legalMoves);
        }
    }

    private updatePiecePosition(pieceId: string, fromRow: number, fromCol: number, toRow: number, toCol: number) {
        const oldKey = `${fromRow},${fromCol}`;
        const el = this.pieceElements.get(oldKey);
        if (!el) return;
        this.pieceElements.delete(oldKey);
        this.pieceElements.set(`${toRow},${toCol}`, el);
        const squareSize = this.getSquareSize();
        const pieceOffset = this.getPieceOffset();
        el.style.top = toRow * squareSize + pieceOffset + 'px';
        el.style.left = toCol * squareSize + pieceOffset + 'px';
    }

    private removePieceElement(row: number, col: number) {
        const key = `${row},${col}`;
        const el = this.pieceElements.get(key);
        if (el) {
            el.classList.add('captured-piece');
            setTimeout(() => el.remove(), 500);
            this.pieceElements.delete(key);
        }
    }

    private clearMoveIndicators() {
        this.moveIndicators.forEach(el => el.remove());
        this.moveIndicators = [];
    }

    private showMoveIndicators(moves: Move[]) {
        this.clearMoveIndicators();
        const boardEl = this.boardEl;
        if (!boardEl) return;
        
        moves.forEach(m => {
            const sq = boardEl.querySelector(`.square[data-row="${m.row}"][data-col="${m.col}"]`);
            if (sq) {
                const piece = this.board[m.row]?.[m.col];
                if (piece) {
                    sq.classList.add('possible-capture');
                } else {
                    sq.classList.add('possible-move');
                }
            }
        });
    }

    private inBounds(r: number, c: number): boolean {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    private isEmpty(r: number, c: number): boolean {
        return this.inBounds(r, c) && this.board[r][c] === null;
    }

    private enemyPiece(r: number, c: number, color: string): boolean {
        if (!this.inBounds(r, c)) return false;
        const piece = this.board[r][c];
        return piece !== null && piece.color !== color;
    }

    private getPseudoMoves(row: number, col: number, color: string, forAttack: boolean = false): Move[] {
        const piece = this.board[row][col];
        if (!piece || piece.color !== color) return [];
        
        const moves: Move[] = [];
        const opp = color === 'white' ? 'black' : 'white';
        const type = piece.type;

        if (type === 'pawn') {
            const dir = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;
            
            if (this.isEmpty(row + dir, col)) {
                if (row + dir === 0 || row + dir === 7) {
                    moves.push({ row: row + dir, col, special: 'promotion' });
                } else {
                    moves.push({ row: row + dir, col });
                }
                if (row === startRow && this.isEmpty(row + 2 * dir, col)) {
                    moves.push({ row: row + 2 * dir, col, special: 'doublePush' });
                }
            }
            
            for (let dc of [-1, 1]) {
                const capRow = row + dir, capCol = col + dc;
                if (this.enemyPiece(capRow, capCol, color)) {
                    if (capRow === 0 || capRow === 7) {
                        moves.push({ row: capRow, col: capCol, special: 'promotion' });
                    } else {
                        moves.push({ row: capRow, col: capCol });
                    }
                }
                if (this.enPassantTarget && this.enPassantTarget.row === capRow && 
                    this.enPassantTarget.col === capCol && this.isEmpty(capRow, capCol)) {
                    moves.push({ row: capRow, col: capCol, special: 'enPassant' });
                }
            }
        } else if (type === 'knight') {
            for (let [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                const nr = row + dr, nc = col + dc;
                if (this.inBounds(nr, nc) && (this.isEmpty(nr, nc) || this.enemyPiece(nr, nc, color))) {
                    moves.push({ row: nr, col: nc });
                }
            }
        } else if (type === 'bishop' || type === 'queen') {
            for (let [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                let r = row + dr, c = col + dc;
                while (this.inBounds(r, c)) {
                    if (this.isEmpty(r, c)) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (this.enemyPiece(r, c, color)) moves.push({ row: r, col: c });
                        break;
                    }
                    r += dr; c += dc;
                }
            }
        }
        
        if (type === 'rook' || type === 'queen') {
            for (let [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                let r = row + dr, c = col + dc;
                while (this.inBounds(r, c)) {
                    if (this.isEmpty(r, c)) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (this.enemyPiece(r, c, color)) moves.push({ row: r, col: c });
                        break;
                    }
                    r += dr; c += dc;
                }
            }
        }
        
        if (type === 'king') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = row + dr, nc = col + dc;
                    if (this.inBounds(nr, nc) && (this.isEmpty(nr, nc) || this.enemyPiece(nr, nc, color))) {
                        moves.push({ row: nr, col: nc });
                    }
                }
            }
            
            if (!forAttack && !this.isSquareAttacked(row, col, opp)) {
                const rights = this.castlingRights[color];
                if (rights.kingSide && this.isEmpty(row, 5) && this.isEmpty(row, 6) && 
                    this.board[row][7]?.type === 'rook' &&
                    !this.isSquareAttacked(row, 5, opp) && !this.isSquareAttacked(row, 6, opp)) {
                    moves.push({ row, col: 6, special: 'castleKingSide' });
                }
                if (rights.queenSide && this.isEmpty(row, 3) && this.isEmpty(row, 2) && 
                    this.isEmpty(row, 1) && this.board[row][0]?.type === 'rook' &&
                    !this.isSquareAttacked(row, 3, opp) && !this.isSquareAttacked(row, 2, opp)) {
                    moves.push({ row, col: 2, special: 'castleQueenSide' });
                }
            }
        }
        
        return moves;
    }

    private isSquareAttacked(row: number, col: number, byColor: string): boolean {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === byColor) {
                    const moves = this.getPseudoMoves(r, c, byColor, true);
                    if (moves.some(m => m.row === row && m.col === col)) return true;
                }
            }
        }
        return false;
    }

    private findKing(color: string): [number, number] | null {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece?.color === color && piece?.type === 'king') return [r, c];
            }
        }
        return null;
    }

    private getLegalMoves(row: number, col: number, color: string): Move[] {
        const pseudo = this.getPseudoMoves(row, col, color, false);
        return pseudo.filter(move => {
            const piece = this.board[row][col];
            if (!piece) return false;
            
            const captured = this.board[move.row][move.col];
            const enPassantCaptured: Piece | null = move.special === 'enPassant' ? 
                this.board[color === 'white' ? move.row + 1 : move.row - 1][move.col] : null;
            
            this.board[move.row][move.col] = piece;
            this.board[row][col] = null;
            
            if (move.special === 'enPassant') {
                const capRow = color === 'white' ? move.row + 1 : move.row - 1;
                this.board[capRow][move.col] = null;
            }
            if (move.special === 'castleKingSide') {
                this.board[row][5] = this.board[row][7];
                this.board[row][7] = null;
            }
            if (move.special === 'castleQueenSide') {
                this.board[row][3] = this.board[row][0];
                this.board[row][0] = null;
            }
            
            const kingPos = piece.type === 'king' ? [move.row, move.col] : this.findKing(color);
            const inCheck = kingPos ? this.isSquareAttacked(kingPos[0], kingPos[1], color === 'white' ? 'black' : 'white') : true;
            
            this.board[row][col] = piece;
            this.board[move.row][move.col] = captured || null;
            
            if (move.special === 'enPassant') {
                const capRow = color === 'white' ? move.row + 1 : move.row - 1;
                this.board[capRow][move.col] = enPassantCaptured;
            }
            if (move.special === 'castleKingSide') {
                this.board[row][7] = this.board[row][5];
                this.board[row][5] = null;
            }
            if (move.special === 'castleQueenSide') {
                this.board[row][0] = this.board[row][3];
                this.board[row][3] = null;
            }
            
            return !inCheck;
        });
    }

    private hasAnyLegalMove(color: string): boolean {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece?.color === color && this.getLegalMoves(r, c, color).length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    private isInCheck(color: string): boolean {
        const kingPos = this.findKing(color);
        return kingPos !== null && this.isSquareAttacked(kingPos[0], kingPos[1], color === 'white' ? 'black' : 'white');
    }

    private clearHighlights() {
        if (!this.boardEl) return;
        const squares = this.boardEl.querySelectorAll('.square');
        squares.forEach(sq => {
            sq.classList.remove('selected', 'possible-move', 'possible-capture', 'in-check');
        });
        this.clearMoveIndicators();
    }

    private highlightSelected(row: number, col: number) {
        if (row !== null && this.boardEl) {
            const sq = this.boardEl.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            if (sq) sq.classList.add('selected');
        }
    }

    private highlightMoves(moves: Move[]) {
        this.showMoveIndicators(moves);
    }

    private animatePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): Promise<void> {
        return new Promise(resolve => {
            const el = this.pieceElements.get(`${fromRow},${fromCol}`);
            if (!el) {
                resolve();
                return;
            }
            el.classList.add('moving');
            const squareSize = this.getSquareSize();
            const pieceOffset = this.getPieceOffset();
            el.style.top = toRow * squareSize + pieceOffset + 'px';
            el.style.left = toCol * squareSize + pieceOffset + 'px';
            setTimeout(() => {
                el.classList.remove('moving');
                resolve();
            }, this.getTransitionMs() + 30);
        });
    }

    private executeMove(fromRow: number, fromCol: number, move: Move) {
        if (this.isAnimating || this.gameOver || this.currentPlayer !== this.myColor) return;
        
        this.isAnimating = true;
        this.clearHighlights();
        
        const piece = this.board[fromRow][fromCol];
        if (!piece) {
            this.isAnimating = false;
            return;
        }
        
        const toRow = move.row, toCol = move.col;
        const captured = this.board[toRow][toCol];
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        let extraAnim: (() => Promise<void>) | null = null;
        
        if (move.special === 'enPassant') {
            const capRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            this.board[capRow][toCol] = null;
            extraAnim = () => {
                this.removePieceElement(capRow, toCol);
                return Promise.resolve();
            };
        }
        
        if (move.special === 'castleKingSide') {
            const rook = this.board[fromRow][7];
            if (rook) {
                this.board[fromRow][5] = rook;
                this.board[fromRow][7] = null;
                extraAnim = () => {
                    return this.animatePiece(fromRow, 7, fromRow, 5).then(() => {
                        this.updatePiecePosition(rook.id, fromRow, 7, fromRow, 5);
                    });
                };
            }
        }
        
        if (move.special === 'castleQueenSide') {
            const rook = this.board[fromRow][0];
            if (rook) {
                this.board[fromRow][3] = rook;
                this.board[fromRow][0] = null;
                extraAnim = () => {
                    return this.animatePiece(fromRow, 0, fromRow, 3).then(() => {
                        this.updatePiecePosition(rook.id, fromRow, 0, fromRow, 3);
                    });
                };
            }
        }
        
        if (move.special === 'doublePush') {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        } else {
            this.enPassantTarget = null;
        }
        
        if (piece.type === 'king') {
            this.castlingRights[piece.color] = { kingSide: false, queenSide: false };
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
        }
        
        const mainAnim = this.animatePiece(fromRow, fromCol, toRow, toCol);
        const extraPromise = extraAnim ? extraAnim() : Promise.resolve();
        
        Promise.all([mainAnim, extraPromise]).then(() => {
            this.updatePiecePosition(piece.id, fromRow, fromCol, toRow, toCol);
            if (captured) this.removePieceElement(toRow, toCol);
            
            if (move.special === 'promotion') {
                this.showPromotion(piece.color, toRow, toCol, (type: string) => {
                    const promotedPiece = this.board[toRow][toCol];
                    if (promotedPiece) {
                        promotedPiece.type = type;
                        const el = this.pieceElements.get(`${toRow},${toCol}`);
                        if (el) el.textContent = UNICODE[piece.color][type];
                    }
                    this.finishTurn();
                });
            } else {
                this.finishTurn();
            }
        }).catch(e => {
            console.error('Animation error:', e);
            this.isAnimating = false;
            this.resetGame();
        });
    }

    private finishTurn() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.selectedRow = null;
        this.selectedCol = null;
        this.legalMoves = [];
        this.clearHighlights();
        this.isAnimating = false;
        this.updateTurnDisplay();
        
        let message = '';
        if (this.isInCheck(this.currentPlayer)) {
            const kingPos = this.findKing(this.currentPlayer);
            if (kingPos) {
                const kingSquare = this.boardEl?.querySelector(`.square[data-row="${kingPos[0]}"][data-col="${kingPos[1]}"]`);
                if (kingSquare) kingSquare.classList.add('in-check');
            }
            if (!this.hasAnyLegalMove(this.currentPlayer)) {
                this.gameOver = true;
                this.winner = this.currentPlayer === 'white' ? 'black' : 'white';
                message = `Checkmate! ${this.winner === 'white' ? 'White' : 'Black'} wins!`;
            } else {
                message = 'Check!';
            }
        } else {
            if (!this.hasAnyLegalMove(this.currentPlayer)) {
                this.gameOver = true;
                this.winner = 'draw';
                message = 'Stalemate! Draw.';
            }
        }
        
        this.statusMessage = message;
        if (this.statusMsg) this.statusMsg.textContent = message;
        
        sendGameEvent('chess_move', this.getStatePayload());
    }

    private showPromotion(color: string, row: number, col: number, callback: (type: string) => void) {
        const overlay = document.getElementById('promotionOverlay');
        const dialog = document.getElementById('promotionDialog');
        if (!overlay || !dialog) return;
        
        dialog.innerHTML = '';
        ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
            const btn = document.createElement('div');
            btn.className = 'promotion-piece';
            if (color === 'black') btn.classList.add('black-promo');
            btn.textContent = UNICODE[color][type];
            btn.addEventListener('click', () => {
                overlay.style.display = 'none';
                callback(type);
            });
            dialog.appendChild(btn);
        });
        
        overlay.style.display = 'flex';
    }

    private updateTurnDisplay() {
        if (!this.turnIndicator || !this.turnText) return;
        
        this.turnIndicator.classList.remove('white-turn', 'black-turn');
        if (this.currentPlayer === 'white') {
            this.turnIndicator.classList.add('white-turn');
            const dot = this.turnIndicator.querySelector('.turn-dot');
            if (dot) { dot.className = 'turn-dot'; }
            this.turnText.textContent = "White's turn";
        } else {
            this.turnIndicator.classList.add('black-turn');
            const dot = this.turnIndicator.querySelector('.turn-dot');
            if (dot) { dot.className = 'turn-dot black-dot'; }
            this.turnText.textContent = "Black's turn";
        }
    }

    private handleBoardClick = (e: MouseEvent) => {
        if (this.isAnimating || this.gameOver || this.currentPlayer !== this.myColor) return;
        
        const square = (e.target as HTMLElement).closest('.square');
        if (!square) return;
        
        const row = parseInt((square as HTMLElement).dataset.row || '');
        const col = parseInt((square as HTMLElement).dataset.col || '');
        if (isNaN(row) || isNaN(col)) return;
        
        const clickedPiece = this.board[row]?.[col];
        
        // If a piece is already selected
        if (this.selectedRow != null && this.selectedCol != null) {
            // Check if clicking on a valid move
            const move = this.legalMoves.find(m => m.row === row && m.col === col);
            if (move) {
                this.executeMove(this.selectedRow, this.selectedCol, move);
                return;
            }
            
            // If clicking on another piece of the same color, select that piece instead
            if (clickedPiece && clickedPiece.color === this.currentPlayer) {
                this.clearHighlights();
                this.selectedRow = row;
                this.selectedCol = col;
                this.legalMoves = this.getLegalMoves(row, col, this.currentPlayer);
                this.highlightSelected(row, col);
                this.highlightMoves(this.legalMoves);
                return;
            }
            
            // Clicked on empty square or enemy piece that's not a valid move, deselect
            this.selectedRow = null;
            this.selectedCol = null;
            this.legalMoves = [];
            this.clearHighlights();
        } else {
            // No piece selected yet, select this piece if it belongs to current player
            if (clickedPiece && clickedPiece.color === this.currentPlayer) {
                this.selectedRow = row;
                this.selectedCol = col;
                this.legalMoves = this.getLegalMoves(row, col, this.currentPlayer);
                this.clearHighlights();
                this.highlightSelected(row, col);
                this.highlightMoves(this.legalMoves);
                console.log(`Selected ${clickedPiece.type} at ${row},${col}. Legal moves: ${this.legalMoves.length}`);
            }
        }
    };

    private resetGame() {
        this.setupBoard();
        this.createBoardDOM();
        this.renderPieces();
        this.updateTurnDisplay();
        this.clearHighlights();
        if (this.statusMsg) this.statusMsg.textContent = '';
        this.statusMessage = '';
    }

    private getStatePayload() {
        return {
            board: this.board,
            currentPlayer: this.currentPlayer,
            winner: this.winner,
            gameOver: this.gameOver,
            enPassantTarget: this.enPassantTarget,
            castlingRights: this.castlingRights,
            statusMessage: this.statusMessage
        };
    }

    handleEvent(event: string, payload: any): void {
        if (event === 'chess_move') {
            this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
        } else if (event === 'chess_reset') {
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