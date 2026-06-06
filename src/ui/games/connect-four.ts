import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

export class ConnectFour implements GameInterface {
  board: string[] = Array(42).fill('');
  current: string = 'red';
  winner: string | null = null;
  myColor: string | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="connect-four-wrapper">
        <style>
          .connect-four-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            user-select: none;
            -webkit-user-select: none;
            padding: 20px;
          }
          
          .c4-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            max-width: 100%;
          }
          
          .c4-header {
            text-align: center;
            color: #fff;
          }
          
          .c4-header h1 {
            font-size: 2em;
            margin: 0;
            color: #ffc107;
            text-shadow: 0 2px 10px rgba(255, 193, 7, 0.3);
          }
          
          .c4-status {
            font-size: 1em;
            padding: 8px 20px;
            border-radius: 30px;
            background: rgba(255,255,255,0.1);
            display: inline-block;
            margin-top: 8px;
          }
          
          .c4-status.your-turn {
            background: rgba(76, 175, 80, 0.3);
            border: 2px solid #4caf50;
            color: #4caf50;
            animation: pulse-turn 1.5s infinite;
          }
          
          .c4-status.waiting {
            background: rgba(255, 152, 0, 0.2);
            border: 2px solid #ff9800;
            color: #ff9800;
          }
          
          .c4-status.winner {
            background: rgba(255, 193, 7, 0.3);
            border: 2px solid #ffc107;
            color: #ffc107;
            font-weight: 700;
            animation: celebrate 0.6s ease-in-out;
          }
          
          .c4-status.draw {
            background: rgba(158, 158, 158, 0.3);
            border: 2px solid #9e9e9e;
            color: #9e9e9e;
          }
          
          @keyframes pulse-turn {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          
          @keyframes celebrate {
            0%, 100% { transform: scale(1); }
            30% { transform: scale(1.1); }
            60% { transform: scale(0.95); }
          }
          
          .c4-board-wrapper {
            background: #1a73e8;
            border-radius: 20px;
            padding: 15px;
            box-shadow: 
              0 20px 50px rgba(0,0,0,0.5),
              0 0 0 4px #1565c0,
              0 0 0 8px #0d47a1,
              inset 0 5px 20px rgba(0,0,0,0.3);
            position: relative;
          }
          
          .c4-board {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-template-rows: repeat(6, 1fr);
            gap: 8px;
            width: min(70vw, 490px);
            height: min(60vw, 420px);
          }
          
          .c4-cell {
            background: #e8e8e8;
            border-radius: 50%;
            cursor: pointer;
            position: relative;
            transition: all 0.3s ease;
            box-shadow: inset 0 5px 15px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.2);
          }
          
          .c4-cell:hover {
            transform: scale(1.05);
            box-shadow: inset 0 5px 15px rgba(0,0,0,0.4), 0 4px 15px rgba(255,255,255,0.3);
          }
          
          .c4-cell.red {
            background: radial-gradient(circle at 40% 35%, #ff5252, #c62828 60%, #7f0000 100%);
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.3);
            cursor: default;
          }
          
          .c4-cell.yellow {
            background: radial-gradient(circle at 40% 35%, #ffeb3b, #f9a825 60%, #f57f17 100%);
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.3), 0 2px 5px rgba(0,0,0,0.3);
            cursor: default;
          }
          
          .c4-cell.winning-cell {
            animation: win-glow 0.5s ease-in-out infinite alternate;
          }
          
          @keyframes win-glow {
            0% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
            100% { box-shadow: 0 0 25px rgba(255,255,255,0.9), 0 0 50px rgba(255,255,255,0.5); }
          }
          
          .c4-info-panel {
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .c4-player-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 20px;
            border-radius: 30px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .c4-player-indicator.active {
            background: rgba(255,255,255,0.2);
            border: 2px solid #fff;
            box-shadow: 0 0 20px rgba(255,255,255,0.2);
          }
          
          .c4-dot {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          
          .c4-dot.red-dot {
            background: radial-gradient(circle at 40% 35%, #ff5252, #c62828);
            box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
          }
          
          .c4-dot.yellow-dot {
            background: radial-gradient(circle at 40% 35%, #ffeb3b, #f9a825);
            box-shadow: 0 0 10px rgba(255, 235, 59, 0.5);
          }
          
          .c4-btn {
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
          
          .c4-btn:hover {
            background: #ffd54f;
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(255,193,7,0.5);
          }
          
          .c4-btn:active {
            transform: scale(0.96);
          }
          
          .c4-column-indicator {
            display: flex;
            gap: 8px;
            width: min(70vw, 490px);
            margin-bottom: -10px;
          }
          
          .c4-column-arrow {
            flex: 1;
            text-align: center;
            color: rgba(255,255,255,0.6);
            font-size: 1.5em;
            cursor: pointer;
            transition: all 0.3s ease;
            padding: 5px 0;
          }
          
          .c4-column-arrow:hover {
            color: #fff;
            transform: translateY(-3px);
          }
          
          @media (max-width: 700px) {
            .c4-board {
              width: 90vw;
              height: 77vw;
              gap: 6px;
            }
            .c4-board-wrapper {
              padding: 10px;
            }
            .c4-header h1 {
              font-size: 1.5em;
            }
            .c4-btn {
              padding: 8px 16px;
              font-size: 0.85em;
            }
            .c4-column-indicator {
              width: 90vw;
            }
            .c4-column-arrow {
              font-size: 1.2em;
            }
          }
          
          @media (max-width: 400px) {
            .c4-board {
              width: 50vw;
              height: 81vw;
              gap: 4px;
            }
            .c4-board-wrapper {
              padding: 8px;
              border-radius: 12px;
            }
            .c4-info-panel {
              gap: 10px;
            }
            .c4-player-indicator {
              padding: 8px 14px;
              font-size: 0.85em;
            }
          }
        </style>
        
        <div class="c4-container">
          <div class="c4-header">
            <h1>🔴 Connect Four 🟡</h1>
            <div id="c4Status" class="c4-status"></div>
          </div>
          
          <div class="c4-board-wrapper">
            <div class="c4-column-indicator" id="c4ColumnIndicator">
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
              <div class="c4-column-arrow">▼</div>
            </div>
            <div id="c4Board" class="c4-board"></div>
          </div>
          
          <div class="c4-info-panel">
            <div class="c4-player-indicator" id="redIndicator">
              <div class="c4-dot red-dot"></div>
              <span>Red</span>
            </div>
            <button id="c4ResetBtn" class="c4-btn">🔄 New Game</button>
            <div class="c4-player-indicator" id="yellowIndicator">
              <div class="c4-dot yellow-dot"></div>
              <span>Yellow</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.assignColor();
    this.drawBoard();
    
    document.getElementById('c4ResetBtn')!.onclick = () => {
      this.resetGame();
      sendGameEvent('c4_move', { board: this.board, current: this.current, winner: this.winner });
    };

    // Column indicators click handling
    const columnIndicator = document.getElementById('c4ColumnIndicator');
    if (columnIndicator) {
      const arrows = columnIndicator.querySelectorAll('.c4-column-arrow');
      arrows.forEach((arrow, index) => {
        arrow.addEventListener('click', () => this.handleClick(index));
      });
    }

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);

    this.playersUnsubscribe = store.subscribe(() => {
      const old = this.myColor;
      this.assignColor();
      if (old !== this.myColor) this.drawBoard();
    });
  }

  private handleResize = () => {
    // Board is responsive via CSS, no need to redraw
  };

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'c4_move') {
      this.board = payload.board;
      this.current = payload.current;
      this.winner = payload.winner;
      this.drawBoard();
    } else if (event === 'c4_reset') {
      this.resetGame();
    }
  };

  private assignColor() {
    const players = store.state.players;
    const myId = store.state.profile?.id;
    if (players.length >= 2 && myId) {
      const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
      const idx = sortedPlayers.findIndex(p => p.id === myId);
      this.myColor = idx === 0 ? 'red' : 'yellow';
    } else {
      this.myColor = 'red';
    }
  }

  drawBoard() {
    const boardDiv = document.getElementById('c4Board');
    const statusEl = document.getElementById('c4Status');
    const redIndicator = document.getElementById('redIndicator');
    const yellowIndicator = document.getElementById('yellowIndicator');
    
    if (!boardDiv) return;

    boardDiv.innerHTML = '';
    for (let i = 0; i < 42; i++) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell';
      if (this.board[i]) {
        cell.className += ' ' + this.board[i];
      }
      cell.onclick = () => this.handleClick(i % 7);
      boardDiv.appendChild(cell);
    }

    // Update status
    if (statusEl) {
      statusEl.className = 'c4-status';
      if (this.winner) {
        if (this.winner === 'draw') {
          statusEl.textContent = "It's a Draw! 🤝";
          statusEl.classList.add('draw');
        } else {
          const winnerName = this.winner.charAt(0).toUpperCase() + this.winner.slice(1);
          statusEl.textContent = `🏆 ${winnerName} Wins! 🏆`;
          statusEl.classList.add('winner');
          
          // Highlight winning cells
          this.highlightWinningCells();
        }
      } else if (this.myColor) {
        if (this.current === this.myColor) {
          statusEl.textContent = 'Your Turn! 🎯';
          statusEl.classList.add('your-turn');
        } else {
          statusEl.textContent = 'Waiting for opponent...';
          statusEl.classList.add('waiting');
        }
      } else {
        statusEl.textContent = 'Spectator Mode';
      }
    }

    // Update player indicators
    if (redIndicator) {
      redIndicator.classList.remove('active');
      if (this.current === 'red' && !this.winner) {
        redIndicator.classList.add('active');
      }
    }
    if (yellowIndicator) {
      yellowIndicator.classList.remove('active');
      if (this.current === 'yellow' && !this.winner) {
        yellowIndicator.classList.add('active');
      }
    }
  }

  private highlightWinningCells() {
    if (!this.winner || this.winner === 'draw') return;
    
    const boardDiv = document.getElementById('c4Board');
    if (!boardDiv) return;
    
    const cells = boardDiv.querySelectorAll('.c4-cell');
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
    
    const color = this.winner;
    
    for (let i = 0; i < 42; i++) {
      if (this.board[i] !== color) continue;
      
      const r = Math.floor(i / 7), c = i % 7;
      
      // Horizontal
      if (c <= 3) {
        const line = [i, i+1, i+2, i+3];
        if (line.every(idx => idx >= 0 && idx < 42 && this.board[idx] === color)) {
          return line;
        }
      }
      
      // Vertical
      if (r <= 2) {
        const line = [i, i+7, i+14, i+21];
        if (line.every(idx => idx >= 0 && idx < 42 && this.board[idx] === color)) {
          return line;
        }
      }
      
      // Diagonal down-right
      if (c <= 3 && r <= 2) {
        const line = [i, i+8, i+16, i+24];
        if (line.every(idx => idx >= 0 && idx < 42 && this.board[idx] === color)) {
          return line;
        }
      }
      
      // Diagonal down-left
      if (c >= 3 && r <= 2) {
        const line = [i, i+6, i+12, i+18];
        if (line.every(idx => idx >= 0 && idx < 42 && this.board[idx] === color)) {
          return line;
        }
      }
    }
    
    return null;
  }

  handleClick(col: number) {
    if (this.winner || this.current !== this.myColor) return;
    for (let r = 5; r >= 0; r--) {
      const idx = r * 7 + col;
      if (!this.board[idx]) {
        this.board[idx] = this.current;
        this.checkWinner(idx);
        
        // If there's a winner, highlight cells before sending event
        if (this.winner) {
          this.drawBoard();
        }
        
        sendGameEvent('c4_move', { board: this.board, current: this.current, winner: this.winner });
        
        if (!this.winner) {
          this.drawBoard();
        }
        return;
      }
    }
  }

  checkWinner(lastIdx: number) {
    const color = this.board[lastIdx];
    const checkLine = (cells: number[]) => cells.every(idx => idx >= 0 && idx < 42 && this.board[idx] === color);
    
    for (let i = 0; i < 42; i++) {
      if (!this.board[i]) continue;
      const r = Math.floor(i / 7), c = i % 7;
      if (c <= 3 && checkLine([i, i+1, i+2, i+3])) { this.winner = color; return; }
      if (r <= 2 && checkLine([i, i+7, i+14, i+21])) { this.winner = color; return; }
      if (c <= 3 && r <= 2 && checkLine([i, i+8, i+16, i+24])) { this.winner = color; return; }
      if (c >= 3 && r <= 2 && checkLine([i, i+6, i+12, i+18])) { this.winner = color; return; }
    }
    
    if (!this.board.includes('')) {
      this.winner = 'draw';
    } else {
      this.current = this.current === 'red' ? 'yellow' : 'red';
    }
  }

  resetGame() {
    this.board = Array(42).fill('');
    this.current = 'red';
    this.winner = null;
    this.drawBoard();
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'c4_move') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    } else if (event === 'c4_reset') {
      this.resetGame();
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
    if (this.playersUnsubscribe) this.playersUnsubscribe();
  }
}