import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';

const EMOJIS = ['🐱','🐶','🦊','🦁','🐵','🦆','🦉','🐝'];

export class Memory implements GameInterface {
  cards: { emoji: string; flipped: boolean; matched: boolean }[] = [];
  flippedIndices: number[] = [];
  pairsFound = 0;
  private isProcessing: boolean = false;

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="memory-wrapper">
        <style>
          .memory-wrapper {
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
          
          .memory-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            width: 100%;
            max-width: 500px;
          }
          
          .memory-header {
            text-align: center;
            color: #fff;
          }
          
          .memory-header h1 {
            font-size: 2.2em;
            margin: 0;
            background: linear-gradient(135deg, #ff6b6b, #ffd93d, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .memory-status {
            font-size: 1em;
            padding: 10px 24px;
            border-radius: 30px;
            display: inline-block;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          
          .memory-status.playing {
            background: rgba(76, 175, 80, 0.2);
            border: 2px solid #4caf50;
            color: #4caf50;
          }
          
          .memory-status.waiting {
            background: rgba(255, 152, 0, 0.2);
            border: 2px solid #ff9800;
            color: #ff9800;
          }
          
          .memory-status.complete {
            background: rgba(255, 193, 7, 0.2);
            border: 2px solid #ffc107;
            color: #ffc107;
            font-weight: 700;
            animation: celebrate 0.6s ease-in-out;
          }
          
          @keyframes celebrate {
            0%, 100% { transform: scale(1); }
            30% { transform: scale(1.15); }
            60% { transform: scale(0.95); }
          }
          
          .memory-score-bar {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 12px 24px;
            border-radius: 30px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            font-weight: 600;
            font-size: 1.1em;
          }
          
          .memory-score-bar .emoji-icon {
            font-size: 1.3em;
          }
          
          .memory-score-bar .progress-text {
            color: #ffd93d;
          }
          
          .memory-board {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 10px;
            width: min(75vw, 400px);
            height: min(75vw, 400px);
            perspective: 1000px;
          }
          
          .memory-card {
            background: linear-gradient(145deg, #2d2d44, #3d3d5c);
            border: 2px solid rgba(255,255,255,0.15);
            border-radius: 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2em;
            transition: all 0.4s ease;
            position: relative;
            transform-style: preserve-3d;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          }
          
          .memory-card:hover:not(.flipped):not(.matched) {
            transform: translateY(-3px);
            border-color: rgba(255,255,255,0.3);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
            background: linear-gradient(145deg, #3d3d5c, #4d4d6c);
          }
          
          .memory-card.flipped {
            background: linear-gradient(145deg, #fff, #f0f0f0);
            border-color: rgba(255, 215, 0, 0.5);
            box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3);
            transform: rotateY(180deg);
            cursor: default;
          }
          
          .memory-card.matched {
            background: linear-gradient(145deg, #4caf50, #388e3c);
            border-color: #4caf50;
            box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
            cursor: default;
            transform: scale(0.95);
            opacity: 0.8;
          }
          
          .memory-card.matched:hover {
            transform: scale(0.95);
          }
          
          .memory-card.card-flip-animation {
            animation: cardFlip 0.6s ease;
          }
          
          .memory-card.card-match-animation {
            animation: cardMatch 0.5s ease;
          }
          
          .memory-card.card-mismatch-animation {
            animation: cardMismatch 0.5s ease;
          }
          
          @keyframes cardFlip {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(180deg); }
          }
          
          @keyframes cardMatch {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(0.95); }
          }
          
          @keyframes cardMismatch {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
          }
          
          .memory-card .card-front {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            backface-visibility: hidden;
            border-radius: 15px;
          }
          
          .memory-card .card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            backface-visibility: hidden;
            border-radius: 15px;
            transform: rotateY(180deg);
          }
          
          .memory-btn {
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
          
          .memory-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
          }
          
          .memory-btn:active {
            transform: scale(0.96);
          }
          
          .memory-stats {
            display: flex;
            gap: 20px;
            color: rgba(255,255,255,0.7);
            font-size: 0.85em;
          }
          
          .memory-stats span {
            color: #ffd93d;
            font-weight: 600;
          }
          
          @media (max-width: 500px) {
            .memory-board {
              width: 88vw;
              height: 88vw;
              gap: 8px;
            }
            .memory-card {
              font-size: 1.6em;
              border-radius: 12px;
            }
            .memory-header h1 {
              font-size: 1.8em;
            }
            .memory-btn {
              padding: 10px 22px;
              font-size: 0.9em;
            }
            .memory-container {
              gap: 15px;
            }
          }
          
          @media (max-width: 350px) {
            .memory-board {
              width: 95vw;
              height: 95vw;
              gap: 6px;
            }
            .memory-card {
              font-size: 1.3em;
              border-radius: 10px;
            }
            .memory-score-bar {
              padding: 8px 16px;
              font-size: 0.9em;
            }
          }
        </style>
        
        <div class="memory-container">
          <div class="memory-header">
            <h1>🧠 Memory Match</h1>
          </div>
          
          <div id="memoryStatus" class="memory-status playing">Find the pairs!</div>
          
          <div class="memory-score-bar">
            <span class="emoji-icon">🎯</span>
            <span>Pairs: </span>
            <span class="progress-text" id="memoryScore">0 / 8</span>
          </div>
          
          <div id="memoryBoard" class="memory-board"></div>
          
          <div class="memory-stats">
            <div>Attempts: <span id="attemptCount">0</span></div>
          </div>
          
          <button id="memoryResetBtn" class="memory-btn">🔄 New Game</button>
        </div>
      </div>
    `;

    this.resetBoard();
    this.drawBoard();
    
    document.getElementById('memoryResetBtn')!.onclick = () => {
      this.resetBoard();
      sendGameEvent('memory_flip', { index: -1, reset: true });
    };

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    // CSS handles responsiveness
  };

  private attempts: number = 0;

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'memory_flip') {
      if (payload.reset) {
        this.resetBoard();
      } else {
        this.handleRemoteFlip(payload.index);
      }
    } else if (event === 'memory_reset') {
      this.resetBoard();
    }
  };

  private resetBoard() {
    const pool = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5);
    this.cards = pool.map(emoji => ({ emoji, flipped: false, matched: false }));
    this.flippedIndices = [];
    this.pairsFound = 0;
    this.attempts = 0;
    this.isProcessing = false;
    this.drawBoard();
  }

  drawBoard() {
    const board = document.getElementById('memoryBoard');
    const score = document.getElementById('memoryScore');
    const status = document.getElementById('memoryStatus');
    const attemptsEl = document.getElementById('attemptCount');
    
    if (!board) return;
    
    board.innerHTML = '';
    this.cards.forEach((card, idx) => {
      const cell = document.createElement('div');
      cell.className = 'memory-card';
      
      if (card.flipped) {
        cell.classList.add('flipped');
      }
      if (card.matched) {
        cell.classList.add('matched');
      }
      
      // Create card front (question mark) and back (emoji)
      cell.innerHTML = `
        <div class="card-front">❓</div>
        <div class="card-back">${card.emoji}</div>
      `;
      
      // Show emoji if flipped or matched
      if (card.flipped || card.matched) {
        cell.innerHTML = card.emoji;
      }
      
      cell.onclick = () => this.handleLocalFlip(idx);
      board.appendChild(cell);
    });
    
    if (score) score.textContent = `${this.pairsFound} / 8`;
    if (attemptsEl) attemptsEl.textContent = this.attempts.toString();
    
    // Update status
    if (status) {
      status.className = 'memory-status';
      if (this.pairsFound === 8) {
        status.textContent = '🎉 Congratulations! You won! 🎉';
        status.classList.add('complete');
      } else if (this.isProcessing) {
        status.textContent = 'Checking...';
        status.classList.add('waiting');
      } else {
        status.textContent = 'Find the matching pairs!';
        status.classList.add('playing');
      }
    }
  }

  handleLocalFlip(idx: number) {
    if (this.isProcessing) return;
    if (this.cards[idx].flipped || this.cards[idx].matched || this.flippedIndices.length >= 2) return;
    
    this.flipCard(idx);
    sendGameEvent('memory_flip', { index: idx });
  }

  handleRemoteFlip(idx: number) {
    if (this.cards[idx].flipped || this.cards[idx].matched) return;
    this.flipCard(idx);
  }

  private flipCard(idx: number) {
    this.cards[idx].flipped = true;
    this.flippedIndices.push(idx);
    this.drawBoard();

    if (this.flippedIndices.length === 2) {
      this.isProcessing = true;
      this.attempts++;
      
      const [first, second] = this.flippedIndices;
      const board = document.getElementById('memoryBoard');
      const firstCard = board?.children[first];
      const secondCard = board?.children[second];
      
      if (this.cards[first].emoji === this.cards[second].emoji) {
        // Match found!
        setTimeout(() => {
          this.cards[first].matched = true;
          this.cards[second].matched = true;
          this.pairsFound++;
          this.flippedIndices = [];
          this.isProcessing = false;
          this.drawBoard();
          
          // Add match animation
          if (firstCard) firstCard.classList.add('card-match-animation');
          if (secondCard) secondCard.classList.add('card-match-animation');
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          if (firstCard) firstCard.classList.add('card-mismatch-animation');
          if (secondCard) secondCard.classList.add('card-mismatch-animation');
        }, 100);
        
        setTimeout(() => {
          this.cards[first].flipped = false;
          this.cards[second].flipped = false;
          this.flippedIndices = [];
          this.isProcessing = false;
          this.drawBoard();
        }, 1200);
      }
    }
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'memory_flip') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    } else if (event === 'memory_reset') {
      this.resetBoard();
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
  }
}