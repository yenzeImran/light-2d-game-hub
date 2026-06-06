import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

export class TicTacToe implements GameInterface {
  board: string[] = Array(9).fill('');
  current: string = 'X';
  winner: string | null = null;
  mySymbol: string | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="tictactoe-wrapper">
        <style>
          .tictactoe-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
            padding: 20px;
          }
          
          .ttt-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            width: 100%;
            max-width: 400px;
          }
          
          .ttt-header {
            text-align: center;
            color: #fff;
          }
          
          .ttt-header h1 {
            font-size: 2.2em;
            margin: 0;
            background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: none;
          }
          
          .ttt-status {
            font-size: 1em;
            padding: 10px 24px;
            border-radius: 30px;
            display: inline-block;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .ttt-status.your-turn {
            background: rgba(76, 175, 80, 0.2);
            border: 2px solid #4caf50;
            color: #4caf50;
            animation: pulse-turn 1.5s infinite;
          }
          
          .ttt-status.waiting {
            background: rgba(255, 152, 0, 0.2);
            border: 2px solid #ff9800;
            color: #ff9800;
          }
          
          .ttt-status.winner {
            background: rgba(255, 193, 7, 0.2);
            border: 2px solid #ffc107;
            color: #ffc107;
            font-weight: 700;
            animation: celebrate 0.6s ease-in-out;
          }
          
          .ttt-status.draw {
            background: rgba(158, 158, 158, 0.2);
            border: 2px solid #9e9e9e;
            color: #9e9e9e;
          }
          
          .ttt-status.spectator {
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.5);
          }
          
          @keyframes pulse-turn {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
          }
          
          @keyframes celebrate {
            0%, 100% { transform: scale(1); }
            30% { transform: scale(1.15); }
            60% { transform: scale(0.95); }
          }
          
          .ttt-board-wrapper {
            background: rgba(0,0,0,0.3);
            border-radius: 20px;
            padding: 15px;
            box-shadow: 
              0 20px 50px rgba(0,0,0,0.4),
              0 0 0 1px rgba(255,255,255,0.1);
          }
          
          .ttt-board {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 10px;
            width: min(70vw, 300px);
            height: min(70vw, 300px);
          }
          
          .ttt-cell {
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.15);
            border-radius: 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5em;
            font-weight: 700;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }
          
          .ttt-cell:hover:not(.taken) {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.3);
            transform: scale(1.05);
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
          }
          
          .ttt-cell.taken {
            cursor: default;
          }
          
          .ttt-cell.X {
            color: #ff6b6b;
            text-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
            border-color: rgba(255, 107, 107, 0.3);
            background: rgba(255, 107, 107, 0.05);
          }
          
          .ttt-cell.O {
            color: #4ecdc4;
            text-shadow: 0 0 20px rgba(78, 205, 196, 0.5);
            border-color: rgba(78, 205, 196, 0.3);
            background: rgba(78, 205, 196, 0.05);
          }
          
          .ttt-cell.winning-cell {
            animation: win-glow 0.5s ease-in-out infinite alternate;
          }
          
          .ttt-cell.X.winning-cell {
            background: rgba(255, 107, 107, 0.2);
            border-color: #ff6b6b;
            box-shadow: 0 0 30px rgba(255, 107, 107, 0.5);
          }
          
          .ttt-cell.O.winning-cell {
            background: rgba(78, 205, 196, 0.2);
            border-color: #4ecdc4;
            box-shadow: 0 0 30px rgba(78, 205, 196, 0.5);
          }
          
          @keyframes win-glow {
            0% { transform: scale(1); }
            100% { transform: scale(1.08); }
          }
          
          .ttt-cell.X.pop-in {
            animation: popIn 0.3s ease;
          }
          
          .ttt-cell.O.pop-in {
            animation: popIn 0.3s ease;
          }
          
          @keyframes popIn {
            0% { transform: scale(0); }
            70% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          
          .ttt-info-panel {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .ttt-player-badge {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 20px;
            border-radius: 30px;
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.1);
            color: #fff;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .ttt-player-badge.active {
            border-color: #fff;
            background: rgba(255,255,255,0.15);
            box-shadow: 0 0 20px rgba(255,255,255,0.2);
          }
          
          .ttt-symbol {
            font-size: 1.3em;
            font-weight: 700;
          }
          
          .ttt-symbol.x-symbol {
            color: #ff6b6b;
          }
          
          .ttt-symbol.o-symbol {
            color: #4ecdc4;
          }
          
          .ttt-btn {
            padding: 12px 28px;
            font-size: 1em;
            font-weight: 600;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            letter-spacing: 0.5px;
            transition: all 0.25s ease;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: #fff;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
          }
          
          .ttt-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
          }
          
          .ttt-btn:active {
            transform: scale(0.96);
          }
          
          .ttt-score-section {
            display: flex;
            gap: 20px;
            color: rgba(255,255,255,0.7);
            font-size: 0.9em;
          }
          
          .ttt-score-section span {
            font-weight: 600;
          }
          
          @media (max-width: 500px) {
            .ttt-board {
              width: 85vw;
              height: 85vw;
              gap: 8px;
            }
            .ttt-board-wrapper {
              padding: 10px;
            }
            .ttt-cell {
              font-size: 2em;
              border-radius: 12px;
            }
            .ttt-header h1 {
              font-size: 1.8em;
            }
            .ttt-btn {
              padding: 10px 22px;
              font-size: 0.9em;
            }
            .ttt-container {
              gap: 18px;
            }
          }
          
          @media (max-width: 350px) {
            .ttt-board {
              width: 90vw;
              height: 90vw;
              gap: 6px;
            }
            .ttt-cell {
              font-size: 1.6em;
              border-radius: 10px;
            }
            .ttt-player-badge {
              padding: 8px 14px;
              font-size: 0.85em;
            }
          }
        </style>
        
        <div class="ttt-container">
          <div class="ttt-header">
            <h1>❌ Tic Tac Toe ⭕</h1>
          </div>
          
          <div id="tttStatus" class="ttt-status"></div>
          
          <div class="ttt-board-wrapper">
            <div id="tttBoard" class="ttt-board"></div>
          </div>
          
          <div class="ttt-info-panel">
            <div class="ttt-player-badge" id="xBadge">
              <span class="ttt-symbol x-symbol">✕</span>
              <span>Player X</span>
            </div>
            <button id="tttResetBtn" class="ttt-btn">🔄 New Game</button>
            <div class="ttt-player-badge" id="oBadge">
              <span class="ttt-symbol o-symbol">○</span>
              <span>Player O</span>
            </div>
          </div>
          
          <div class="ttt-score-section">
            <span>X Wins: <strong id="xWins">0</strong></span>
            <span>O Wins: <strong id="oWins">0</strong></span>
            <span>Draws: <strong id="draws">0</strong></span>
          </div>
        </div>
      </div>
    `;

    this.assignSymbol();
    this.drawBoard();
    
    document.getElementById('tttResetBtn')!.onclick = () => {
      this.resetGame();
      sendGameEvent('ttt_move', { board: this.board, current: this.current, winner: this.winner });
    };

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);

    this.playersUnsubscribe = store.subscribe(() => {
      const old = this.mySymbol;
      this.assignSymbol();
      if (old !== this.mySymbol) {
        this.resetGame();
        sendGameEvent('ttt_move', { board: this.board, current: this.current, winner: this.winner });
      }
      this.drawBoard();
    });
  }

  private handleResize = () => {
    // CSS handles responsiveness
  };

  private scoreX: number = 0;
  private scoreO: number = 0;
  private scoreDraws: number = 0;

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'ttt_move') {
      this.board = payload.board;
      this.current = payload.current;
      this.winner = payload.winner;
      this.scoreX = payload.scoreX || 0;
      this.scoreO = payload.scoreO || 0;
      this.scoreDraws = payload.scoreDraws || 0;
      this.drawBoard();
    } else if (event === 'ttt_reset') {
      this.resetGame();
    }
  };

  private assignSymbol() {
    const players = store.state.players;
    const myId = store.state.profile?.id;
    if (players.length >= 2 && myId) {
      const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
      const idx = sortedPlayers.findIndex(p => p.id === myId);
      this.mySymbol = idx === 0 ? 'X' : 'O';
    } else {
      this.mySymbol = 'X';
    }
  }

  drawBoard() {
    const boardDiv = document.getElementById('tttBoard');
    const statusEl = document.getElementById('tttStatus');
    const xBadge = document.getElementById('xBadge');
    const oBadge = document.getElementById('oBadge');
    const xWinsEl = document.getElementById('xWins');
    const oWinsEl = document.getElementById('oWins');
    const drawsEl = document.getElementById('draws');
    
    if (!boardDiv) return;

    boardDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'ttt-cell';
      if (this.board[i]) {
        cell.className += ' ' + this.board[i] + ' taken';
      }
      cell.textContent = this.board[i] || '';
      cell.onclick = () => this.handleClick(i);
      boardDiv.appendChild(cell);
    }

    // Update status
    if (statusEl) {
      statusEl.className = 'ttt-status';
      if (this.winner) {
        if (this.winner === 'draw') {
          statusEl.textContent = "It's a Draw! 🤝";
          statusEl.classList.add('draw');
        } else {
          statusEl.textContent = `🏆 ${this.winner} Wins! 🏆`;
          statusEl.classList.add('winner');
          
          // Highlight winning cells
          this.highlightWinningCells();
        }
      } else if (this.mySymbol) {
        if (this.current === this.mySymbol) {
          statusEl.textContent = 'Your Turn! 🎯';
          statusEl.classList.add('your-turn');
        } else {
          statusEl.textContent = 'Waiting for opponent...';
          statusEl.classList.add('waiting');
        }
      } else {
        statusEl.textContent = 'Spectator Mode';
        statusEl.classList.add('spectator');
      }
    }

    // Update player badges
    if (xBadge) {
      xBadge.classList.remove('active');
      if (this.current === 'X' && !this.winner) {
        xBadge.classList.add('active');
      }
    }
    if (oBadge) {
      oBadge.classList.remove('active');
      if (this.current === 'O' && !this.winner) {
        oBadge.classList.add('active');
      }
    }

    // Update scores
    if (xWinsEl) xWinsEl.textContent = this.scoreX.toString();
    if (oWinsEl) oWinsEl.textContent = this.scoreO.toString();
    if (drawsEl) drawsEl.textContent = this.scoreDraws.toString();
  }

  private highlightWinningCells() {
    if (!this.winner || this.winner === 'draw') return;
    
    const boardDiv = document.getElementById('tttBoard');
    if (!boardDiv) return;
    
    const cells = boardDiv.querySelectorAll('.ttt-cell');
    const winningCells = this.getWinningCells();
    
    if (winningCells) {
      winningCells.forEach((idx: number) => {
        if (cells[idx]) {
          cells[idx].classList.add('winning-cell');
        }
      });
    }
  }

  private getWinningCells(): number[] | null {
    if (!this.winner || this.winner === 'draw') return null;
    
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]              // diagonals
    ];
    
    for (const line of lines) {
      if (line.every(i => this.board[i] === this.winner)) {
        return line;
      }
    }
    
    return null;
  }

  handleClick(idx: number) {
    if (this.winner || this.board[idx] || this.current !== this.mySymbol) return;
    
    this.board[idx] = this.current;
    
    // Add pop-in animation class
    const boardDiv = document.getElementById('tttBoard');
    if (boardDiv) {
      const cells = boardDiv.querySelectorAll('.ttt-cell');
      if (cells[idx]) {
        cells[idx].classList.add('pop-in');
      }
    }
    
    this.checkWinner();
    
    // Update scores if game ended
    if (this.winner === 'X') {
      this.scoreX++;
    } else if (this.winner === 'O') {
      this.scoreO++;
    } else if (this.winner === 'draw') {
      this.scoreDraws++;
    }
    
    sendGameEvent('ttt_move', { 
      board: this.board, 
      current: this.current, 
      winner: this.winner,
      scoreX: this.scoreX,
      scoreO: this.scoreO,
      scoreDraws: this.scoreDraws
    });
    
    this.drawBoard();
  }

  checkWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]              // diagonals
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        this.winner = this.board[a];
        return;
      }
    }

    if (this.board.every(cell => cell !== '')) {
      this.winner = 'draw';
    } else {
      this.current = this.current === 'X' ? 'O' : 'X';
    }
  }

  resetGame() {
    this.board = Array(9).fill('');
    this.current = 'X';
    this.winner = null;
    this.drawBoard();
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'ttt_move') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    } else if (event === 'ttt_reset') {
      this.resetGame();
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
    if (this.playersUnsubscribe) this.playersUnsubscribe();
  }
}