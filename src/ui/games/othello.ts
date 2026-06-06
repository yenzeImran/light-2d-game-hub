import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

export class Othello implements GameInterface {
  board: string[] = Array(64).fill('');
  current: string = 'black';
  winner: string | null = null;
  myColor: string | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="othello-wrapper">
        <style>
          .othello-wrapper {
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
          
          .othello-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            width: 100%;
            max-width: 480px;
          }
          
          .othello-header {
            text-align: center;
            color: #fff;
          }
          
          .othello-header h1 {
            font-size: 2em;
            margin: 0;
            background: linear-gradient(135deg, #fff, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .othello-status {
            font-size: 1em;
            padding: 10px 24px;
            border-radius: 30px;
            display: inline-block;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .othello-status.your-turn {
            background: rgba(76, 175, 80, 0.2);
            border: 2px solid #4caf50;
            color: #4caf50;
            animation: pulse-turn 1.5s infinite;
          }
          
          .othello-status.waiting {
            background: rgba(255, 152, 0, 0.2);
            border: 2px solid #ff9800;
            color: #ff9800;
          }
          
          .othello-status.winner {
            background: rgba(255, 193, 7, 0.2);
            border: 2px solid #ffc107;
            color: #ffc107;
            font-weight: 700;
            animation: celebrate 0.6s ease-in-out;
          }
          
          .othello-status.draw {
            background: rgba(158, 158, 158, 0.2);
            border: 2px solid #9e9e9e;
            color: #9e9e9e;
          }
          
          .othello-status.spectator {
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
          
          .othello-board-wrapper {
            background: #2d5016;
            border-radius: 15px;
            padding: 12px;
            box-shadow: 
              0 20px 50px rgba(0,0,0,0.5),
              0 0 0 4px #1b5e20,
              0 0 0 8px #0d3b0d,
              inset 0 0 30px rgba(0,0,0,0.2);
          }
          
          .othello-board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            gap: 2px;
            width: min(75vw, 420px);
            height: min(75vw, 420px);
            background: #1b5e20;
          }
          
          .othello-cell {
            background: #2d5016;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .othello-cell:hover {
            background: #3a6b1e;
          }
          
          .othello-cell.valid-move::after {
            content: '';
            position: absolute;
            width: 30%;
            height: 30%;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            animation: hint-pulse 1.5s infinite;
          }
          
          @keyframes hint-pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 0.6; transform: scale(1); }
          }
          
          .othello-disc {
            width: 80%;
            height: 80%;
            border-radius: 50%;
            transition: all 0.5s ease;
            position: relative;
            z-index: 2;
          }
          
          .othello-disc.black {
            background: radial-gradient(circle at 40% 35%, #555, #111 60%, #000 100%);
            box-shadow: 
              0 3px 8px rgba(0,0,0,0.5),
              inset 0 -3px 6px rgba(0,0,0,0.4),
              inset 0 2px 4px rgba(255,255,255,0.1);
            border: 2px solid #000;
          }
          
          .othello-disc.white {
            background: radial-gradient(circle at 40% 35%, #fff, #ddd 60%, #aaa 100%);
            box-shadow: 
              0 3px 8px rgba(0,0,0,0.4),
              inset 0 -3px 6px rgba(0,0,0,0.2),
              inset 0 2px 4px rgba(255,255,255,0.3);
            border: 2px solid #999;
          }
          
          .othello-disc.flip-animation {
            animation: flip 0.6s ease;
          }
          
          @keyframes flip {
            0% { transform: rotateY(0deg) scale(1); }
            50% { transform: rotateY(90deg) scale(0.8); }
            100% { transform: rotateY(0deg) scale(1); }
          }
          
          .othello-disc.new-piece {
            animation: dropIn 0.4s ease;
          }
          
          @keyframes dropIn {
            0% { transform: scale(0); opacity: 0; }
            70% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
          }
          
          .othello-info-panel {
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
          
          .othello-score-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            border-radius: 15px;
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.1);
            color: #fff;
            font-weight: 600;
            transition: all 0.3s ease;
            min-width: 100px;
            justify-content: center;
          }
          
          .othello-score-card.active {
            border-color: #fff;
            background: rgba(255,255,255,0.15);
            box-shadow: 0 0 20px rgba(255,255,255,0.2);
          }
          
          .othello-score-card .disc-preview {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          
          .othello-score-card .disc-preview.black-disc {
            background: radial-gradient(circle at 40% 35%, #555, #111 60%, #000 100%);
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            border: 1px solid #000;
          }
          
          .othello-score-card .disc-preview.white-disc {
            background: radial-gradient(circle at 40% 35%, #fff, #ddd 60%, #aaa 100%);
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            border: 1px solid #999;
          }
          
          .othello-score-card .count {
            font-size: 1.5em;
            font-weight: 700;
          }
          
          .othello-btn {
            padding: 12px 28px;
            font-size: 1em;
            font-weight: 600;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            letter-spacing: 0.5px;
            transition: all 0.25s ease;
            background: linear-gradient(135deg, #4ecdc4, #44bd32);
            color: #fff;
            box-shadow: 0 4px 15px rgba(78, 205, 196, 0.4);
          }
          
          .othello-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(78, 205, 196, 0.5);
          }
          
          .othello-btn:active {
            transform: scale(0.96);
          }
          
          .othello-skip-message {
            font-size: 0.9em;
            color: rgba(255,255,255,0.6);
            text-align: center;
            animation: fadeInOut 2s ease;
          }
          
          @keyframes fadeInOut {
            0% { opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { opacity: 0; }
          }
          
          @media (max-width: 600px) {
            .othello-board {
              width: 90vw;
              height: 90vw;
              gap: 1px;
            }
            .othello-board-wrapper {
              padding: 8px;
            }
            .othello-header h1 {
              font-size: 1.5em;
            }
            .othello-btn {
              padding: 10px 22px;
              font-size: 0.9em;
            }
            .othello-score-card {
              padding: 8px 14px;
              font-size: 0.85em;
              min-width: 80px;
            }
            .othello-score-card .count {
              font-size: 1.2em;
            }
          }
          
          @media (max-width: 400px) {
            .othello-board {
              width: 95vw;
              height: 95vw;
            }
            .othello-info-panel {
              gap: 10px;
            }
            .othello-score-card {
              padding: 6px 10px;
              gap: 8px;
            }
          }
        </style>
        
        <div class="othello-container">
          <div class="othello-header">
            <h1>⚫ Othello ⚪</h1>
          </div>
          
          <div id="othelloStatus" class="othello-status"></div>
          
          <div class="othello-board-wrapper">
            <div id="othelloBoard" class="othello-board"></div>
          </div>
          
          <div class="othello-info-panel">
            <div class="othello-score-card" id="blackScoreCard">
              <div class="disc-preview black-disc"></div>
              <div>
                <div style="font-size:0.75em;opacity:0.7;">Black</div>
                <div class="count" id="blackCount">2</div>
              </div>
            </div>
            
            <button id="othelloResetBtn" class="othello-btn">🔄 New Game</button>
            
            <div class="othello-score-card" id="whiteScoreCard">
              <div class="disc-preview white-disc"></div>
              <div>
                <div style="font-size:0.75em;opacity:0.7;">White</div>
                <div class="count" id="whiteCount">2</div>
              </div>
            </div>
          </div>
          
          <div id="othelloMessage" class="othello-skip-message"></div>
        </div>
      </div>
    `;

    this.resetBoard();
    this.assignColor();
    this.drawBoard();
    
    document.getElementById('othelloResetBtn')!.onclick = () => {
      this.resetBoard();
      sendGameEvent('othello_move', { board: this.board, current: this.current, winner: this.winner });
    };

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);

    this.playersUnsubscribe = store.subscribe(() => {
      const old = this.myColor;
      this.assignColor();
      if (old !== this.myColor) {
        this.resetBoard();
        sendGameEvent('othello_move', { board: this.board, current: this.current, winner: this.winner });
      }
      this.drawBoard();
    });
  }

  private handleResize = () => {
    // CSS handles responsiveness
  };

  private validMovesCache: number[] = [];

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'othello_move') {
      this.board = payload.board;
      this.current = payload.current;
      this.winner = payload.winner;
      this.drawBoard();
    } else if (event === 'othello_reset') {
      this.resetBoard();
    }
  };

  private assignColor() {
    const players = store.state.players;
    const myId = store.state.profile?.id;
    if (players.length >= 2 && myId) {
      const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
      const idx = sortedPlayers.findIndex(p => p.id === myId);
      this.myColor = idx === 0 ? 'black' : 'white';
    } else {
      this.myColor = 'black';
    }
  }

  resetBoard() {
    this.board = Array(64).fill('');
    this.board[27] = 'white'; this.board[28] = 'black';
    this.board[35] = 'black'; this.board[36] = 'white';
    this.current = 'black';
    this.winner = null;
    this.validMovesCache = [];
  }

  drawBoard() {
    const boardDiv = document.getElementById('othelloBoard');
    const statusEl = document.getElementById('othelloStatus');
    const blackCountEl = document.getElementById('blackCount');
    const whiteCountEl = document.getElementById('whiteCount');
    const blackScoreCard = document.getElementById('blackScoreCard');
    const whiteScoreCard = document.getElementById('whiteScoreCard');
    
    if (!boardDiv) return;

    // Calculate valid moves
    this.validMovesCache = this.getValidMoves(this.current);

    let blackCount = 0, whiteCount = 0;
    boardDiv.innerHTML = '';
    
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'othello-cell';
      
      // Show valid move indicator
      if (this.validMovesCache.includes(i) && !this.winner && this.current === this.myColor) {
        cell.classList.add('valid-move');
      }
      
      if (this.board[i]) {
        const disc = document.createElement('div');
        disc.className = 'othello-disc ' + this.board[i];
        cell.appendChild(disc);
        if (this.board[i] === 'black') blackCount++;
        else whiteCount++;
      }
      
      cell.onclick = () => this.handleClick(i);
      boardDiv.appendChild(cell);
    }

    // Update status
    if (statusEl) {
      statusEl.className = 'othello-status';
      if (this.winner) {
        if (this.winner === 'draw') {
          statusEl.textContent = "It's a Draw! 🤝";
          statusEl.classList.add('draw');
        } else {
          const winnerColor = this.winner.charAt(0).toUpperCase() + this.winner.slice(1);
          statusEl.textContent = `🏆 ${winnerColor} Wins! 🏆`;
          statusEl.classList.add('winner');
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
        statusEl.classList.add('spectator');
      }
    }

    // Update scores
    if (blackCountEl) blackCountEl.textContent = blackCount.toString();
    if (whiteCountEl) whiteCountEl.textContent = whiteCount.toString();
    
    // Update active player indicator
    if (blackScoreCard) {
      blackScoreCard.classList.remove('active');
      if (this.current === 'black' && !this.winner) {
        blackScoreCard.classList.add('active');
      }
    }
    if (whiteScoreCard) {
      whiteScoreCard.classList.remove('active');
      if (this.current === 'white' && !this.winner) {
        whiteScoreCard.classList.add('active');
      }
    }
  }

  private getValidMoves(color: string): number[] {
    const validMoves: number[] = [];
    const opp = color === 'black' ? 'white' : 'black';
    
    for (let i = 0; i < 64; i++) {
      if (this.board[i]) continue;
      
      const r = Math.floor(i / 8), c = i % 8;
      let isValid = false;
      
      for (const [dr, dc] of DIRECTIONS) {
        let nr = r + dr, nc = c + dc;
        let hasOpp = false;
        
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const nIdx = nr * 8 + nc;
          if (this.board[nIdx] === opp) {
            hasOpp = true;
          } else if (this.board[nIdx] === color) {
            if (hasOpp) {
              isValid = true;
              break;
            }
            break;
          } else {
            break;
          }
          nr += dr;
          nc += dc;
        }
        if (isValid) break;
      }
      
      if (isValid) {
        validMoves.push(i);
      }
    }
    
    return validMoves;
  }

  handleClick(idx: number) {
    if (this.winner || this.current !== this.myColor || this.board[idx]) return;
    if (!this.validMovesCache.includes(idx)) return;
    
    const color = this.current;
    const opp = color === 'black' ? 'white' : 'black';
    const r = Math.floor(idx / 8), c = idx % 8;
    const flippedPieces: number[] = [];

    for (const [dr, dc] of DIRECTIONS) {
      let nr = r + dr, nc = c + dc;
      const path: number[] = [];
      
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const nIdx = nr * 8 + nc;
        if (this.board[nIdx] === opp) {
          path.push(nIdx);
        } else if (this.board[nIdx] === color) {
          if (path.length) {
            path.forEach(p => flippedPieces.push(p));
          }
          break;
        } else {
          break;
        }
        nr += dr;
        nc += dc;
      }
    }

    if (flippedPieces.length > 0) {
      // Place the new piece
      this.board[idx] = color;
      
      // Flip captured pieces
      flippedPieces.forEach(p => {
        this.board[p] = color;
      });
      
      // Add animations
      setTimeout(() => {
        const boardDiv = document.getElementById('othelloBoard');
        if (boardDiv) {
          const cells = boardDiv.querySelectorAll('.othello-cell');
          
          // Animate new piece
          const newDisc = cells[idx]?.querySelector('.othello-disc');
          if (newDisc) {
            newDisc.classList.add('new-piece');
          }
          
          // Animate flipped pieces
          flippedPieces.forEach(p => {
            const disc = cells[p]?.querySelector('.othello-disc');
            if (disc) {
              disc.classList.add('flip-animation');
            }
          });
        }
      }, 50);
      
      this.finalizeTurn();
      sendGameEvent('othello_move', { board: this.board, current: this.current, winner: this.winner });
    }
  }

  private hasMoves(color: string): boolean {
    return this.getValidMoves(color).length > 0;
  }

  private finalizeTurn() {
    const next = this.current === 'black' ? 'white' : 'black';
    
    if (this.hasMoves(next)) {
      this.current = next;
      // Show skip message if the other player was skipped
      const messageEl = document.getElementById('othelloMessage');
      if (messageEl && !this.hasMoves(this.current)) {
        // This shouldn't happen here since we checked hasMoves(next)
      }
    } else if (!this.hasMoves(this.current)) {
      // Game over - no one can move
      let b = 0, w = 0;
      this.board.forEach(v => { 
        if(v === 'black') b++; 
        if(v === 'white') w++; 
      });
      this.winner = b === w ? 'draw' : (b > w ? 'black' : 'white');
    } else {
      // Current player can still move, skip next player
      const messageEl = document.getElementById('othelloMessage');
      if (messageEl) {
        messageEl.textContent = `${next.charAt(0).toUpperCase() + next.slice(1)} has no valid moves. Turn skipped.`;
        messageEl.style.animation = 'none';
        messageEl.offsetHeight; // Trigger reflow
        messageEl.style.animation = 'fadeInOut 2s ease';
      }
    }
    
    this.drawBoard();
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'othello_move') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    } else if (event === 'othello_reset') {
      this.resetBoard();
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
    if (this.playersUnsubscribe) this.playersUnsubscribe();
  }
}