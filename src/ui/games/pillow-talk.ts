import { GameInterface } from './base';
import { sendGameEvent } from '../../websocket';
import { store } from '../../store';

const DECKS: Record<string, string[]> = {
  playful: [
    "What's your absolute favorite way to be kissed?",
    "What's a minor detail about me that you noticed early on?",
    "If we were trapped inside a movie together, which one?",
    "What's the funniest memory we share together?",
    "Name three things that instantly make you smile about me",
    "What is my absolute best physical attribute?",
    "If we could drop everything and go on an immediate trip, where?",
    "What text message from me always makes you warm?",
    "Describe our first kiss using only three adjectives",
    "What's a silly habit I have that you low-key adore?"
  ],
  deep: [
    "What is a fear you've never fully vocalized to me?",
    "What does vulnerability feel like when you look at me?",
    "How do you think our relationship has changed your worldview?",
    "What is a core memory from childhood that defines you?",
    "When do you feel absolute security or safety within our bond?",
    "What is something I did that made you feel deeply cherished?",
    "What does absolute unconditional love look like in your mind?",
    "What parts of yourself do you feel safest hiding or showing?"
  ],
  spicy: [
    "What's a safe fantasy you haven't brought up yet?",
    "Where is your absolute favorite spot to be touched?",
    "Describe a specific time you felt overwhelming physical desire here",
    "What piece of clothing do you love seeing me wear most?",
    "What is a text statement I could send to make you blush?",
    "Lights on or off, and what is your favorite mood setting?"
  ]
};

export class PillowTalk implements GameInterface {
  private currentDeck: string = 'playful';
  private usedCards: Record<string, string[]> = { playful: [], deep: [], spicy: [] };
  private replies: { text: string; side: 'me' | 'partner' }[] = [];
  private waitingForReply = false;
  private turnOwner: string | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  render(container: HTMLElement) {
    container.innerHTML = `
      <div class="pillow-talk-wrapper">
        <style>
          .pillow-talk-wrapper {
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
          
          .pt-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            width: 100%;
            max-width: 500px;
          }
          
          .pt-header {
            text-align: center;
            color: #fff;
          }
          
          .pt-header h1 {
            font-size: 2em;
            margin: 0;
            color: #ff6b9d;
            text-shadow: 0 2px 15px rgba(255, 107, 157, 0.4);
          }
          
          .pt-header .subtitle {
            font-size: 0.9em;
            color: rgba(255,255,255,0.6);
            margin-top: 4px;
          }
          
          .pt-card-container {
            perspective: 1000px;
            width: 100%;
            min-height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .pt-card {
            background: linear-gradient(145deg, #2d2d44, #3d3d5c);
            border-radius: 20px;
            padding: 30px 25px;
            width: 100%;
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #fff;
            font-size: 1.15em;
            line-height: 1.6;
            box-shadow: 
              0 15px 40px rgba(0,0,0,0.4),
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.05);
            transition: all 0.5s ease;
            position: relative;
            overflow: hidden;
          }
          
          .pt-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255,107,157,0.05) 0%, transparent 50%);
            pointer-events: none;
          }
          
          .pt-card.playful-active {
            border-color: rgba(76, 175, 80, 0.3);
            box-shadow: 
              0 15px 40px rgba(0,0,0,0.4),
              0 0 0 2px rgba(76, 175, 80, 0.3),
              0 0 30px rgba(76, 175, 80, 0.15);
          }
          
          .pt-card.deep-active {
            border-color: rgba(33, 150, 243, 0.3);
            box-shadow: 
              0 15px 40px rgba(0,0,0,0.4),
              0 0 0 2px rgba(33, 150, 243, 0.3),
              0 0 30px rgba(33, 150, 243, 0.15);
          }
          
          .pt-card.spicy-active {
            border-color: rgba(244, 67, 54, 0.3);
            box-shadow: 
              0 15px 40px rgba(0,0,0,0.4),
              0 0 0 2px rgba(244, 67, 54, 0.3),
              0 0 30px rgba(244, 67, 54, 0.15);
          }
          
          .pt-card .card-icon {
            font-size: 2.5em;
            margin-bottom: 10px;
            display: block;
          }
          
          .pt-deck-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
          
          .pt-deck-btn {
            padding: 10px 20px;
            border: 2px solid rgba(255,255,255,0.2);
            border-radius: 25px;
            background: rgba(255,255,255,0.05);
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            font-size: 0.9em;
            font-weight: 600;
            transition: all 0.3s ease;
            white-space: nowrap;
          }
          
          .pt-deck-btn:hover {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.4);
            color: #fff;
          }
          
          .pt-deck-btn.active.playful-active-btn {
            background: rgba(76, 175, 80, 0.2);
            border-color: #4caf50;
            color: #4caf50;
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.2);
          }
          
          .pt-deck-btn.active.deep-active-btn {
            background: rgba(33, 150, 243, 0.2);
            border-color: #2196f3;
            color: #2196f3;
            box-shadow: 0 0 15px rgba(33, 150, 243, 0.2);
          }
          
          .pt-deck-btn.active.spicy-active-btn {
            background: rgba(244, 67, 54, 0.2);
            border-color: #f44336;
            color: #f44336;
            box-shadow: 0 0 15px rgba(244, 67, 54, 0.2);
          }
          
          .pt-action-buttons {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
          
          .pt-btn {
            padding: 12px 28px;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .pt-btn-primary {
            background: linear-gradient(135deg, #ff6b9d, #c44569);
            color: #fff;
            box-shadow: 0 4px 15px rgba(255, 107, 157, 0.4);
          }
          
          .pt-btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 107, 157, 0.5);
          }
          
          .pt-btn-secondary {
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
          }
          
          .pt-btn-secondary:hover:not(:disabled) {
            background: rgba(255,255,255,0.15);
            transform: translateY(-2px);
          }
          
          .pt-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
          
          .pt-btn:active:not(:disabled) {
            transform: scale(0.96);
          }
          
          .pt-cards-left {
            font-size: 0.85em;
            color: rgba(255,255,255,0.5);
            text-align: center;
          }
          
          .pt-replies-container {
            width: 100%;
            max-height: 250px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            background: rgba(0,0,0,0.2);
            border-radius: 15px;
            scroll-behavior: smooth;
          }
          
          .pt-replies-container::-webkit-scrollbar {
            width: 4px;
          }
          
          .pt-replies-container::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .pt-replies-container::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
          }
          
          .pt-reply-bubble {
            padding: 10px 16px;
            border-radius: 18px;
            max-width: 80%;
            word-wrap: break-word;
            font-size: 0.9em;
            line-height: 1.4;
            animation: slideIn 0.3s ease;
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .pt-reply-bubble.me {
            align-self: flex-end;
            background: linear-gradient(135deg, #ff6b9d, #c44569);
            color: #fff;
            border-bottom-right-radius: 4px;
          }
          
          .pt-reply-bubble.partner {
            align-self: flex-start;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border-bottom-left-radius: 4px;
          }
          
          .pt-input-group {
            display: flex;
            gap: 10px;
            width: 100%;
          }
          
          .pt-input {
            flex: 1;
            padding: 12px 18px;
            border-radius: 25px;
            border: 2px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.05);
            color: #fff;
            font-size: 0.95em;
            outline: none;
            transition: all 0.3s ease;
          }
          
          .pt-input:focus {
            border-color: #ff6b9d;
            box-shadow: 0 0 15px rgba(255, 107, 157, 0.2);
          }
          
          .pt-input::placeholder {
            color: rgba(255,255,255,0.4);
          }
          
          .pt-input:disabled {
            opacity: 0.4;
          }
          
          .pt-send-btn {
            padding: 12px 24px;
            border-radius: 25px;
            border: none;
            background: linear-gradient(135deg, #ff6b9d, #c44569);
            color: #fff;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95em;
            transition: all 0.3s ease;
          }
          
          .pt-send-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(255, 107, 157, 0.4);
          }
          
          .pt-send-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
          
          @media (max-width: 600px) {
            .pt-container {
              gap: 15px;
            }
            .pt-header h1 {
              font-size: 1.5em;
            }
            .pt-card {
              padding: 20px 18px;
              font-size: 1em;
              min-height: 100px;
            }
            .pt-deck-btn {
              padding: 8px 14px;
              font-size: 0.8em;
            }
            .pt-btn {
              padding: 10px 20px;
              font-size: 0.9em;
            }
            .pt-input {
              padding: 10px 14px;
              font-size: 0.85em;
            }
            .pt-send-btn {
              padding: 10px 18px;
              font-size: 0.85em;
            }
            .pt-reply-bubble {
              max-width: 85%;
              font-size: 0.85em;
            }
          }
          
          @media (max-width: 400px) {
            .pt-container {
              gap: 12px;
            }
            .pt-deck-buttons {
              gap: 6px;
            }
            .pt-deck-btn {
              padding: 6px 10px;
              font-size: 0.75em;
            }
            .pt-action-buttons {
              gap: 8px;
            }
            .pt-card {
              padding: 16px 14px;
              font-size: 0.9em;
            }
          }
        </style>
        
        <div class="pt-container">
          <div class="pt-header">
            <h1>💕 Pillow Talk</h1>
            <div class="subtitle">Deepen your connection, one card at a time</div>
          </div>
          
          <div class="pt-card-container">
            <div class="pt-card" id="pillowCard">
              <span class="card-icon">🃏</span>
              <span>Select a deck and draw a card</span>
            </div>
          </div>
          
          <div class="pt-deck-buttons">
            <button class="pt-deck-btn active playful-active-btn" data-deck="playful">😊 Playful</button>
            <button class="pt-deck-btn" data-deck="deep">🤔 Deep</button>
            <button class="pt-deck-btn" data-deck="spicy">🔥 Spicy</button>
          </div>
          
          <div class="pt-action-buttons">
            <button id="drawCardBtn" class="pt-btn pt-btn-primary">🎴 Draw Card</button>
            <button id="resetDeckBtn" class="pt-btn pt-btn-secondary">🔄 Reset</button>
          </div>
          
          <div id="cardsLeft" class="pt-cards-left"></div>
          
          <div class="pt-replies-container" id="repliesList"></div>
          
          <div class="pt-input-group">
            <input type="text" id="replyInput" class="pt-input" placeholder="Type your reply..." />
            <button id="sendReplyBtn" class="pt-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;

    this.updateLeft();
    this.renderReplies();
    this.assignTurn();
    this.attachEvents();

    window.addEventListener('game_event', this.onGameEvent);
    window.addEventListener('resize', this.handleResize);

    this.playersUnsubscribe = store.subscribe(() => {
      this.updateControls();
    });
  }

  private handleResize = () => {
    // CSS handles responsiveness
  };

  private getDeckIcon(deck: string): string {
    switch (deck) {
      case 'playful': return '😊';
      case 'deep': return '🤔';
      case 'spicy': return '🔥';
      default: return '🃏';
    }
  }

  private attachEvents() {
    document.getElementById('drawCardBtn')!.onclick = () => this.drawCard();
    document.getElementById('resetDeckBtn')!.onclick = () => {
      this.resetDeck();
      sendGameEvent('pillow_reset', {});
    };
    
    document.getElementById('sendReplyBtn')!.onclick = () => {
      const input = document.getElementById('replyInput') as HTMLInputElement;
      const text = input.value.trim();
      if (!text) return;
      this.addReply(text, 'me');
      const nextDrawer = this.getOtherPlayerId() || store.state.profile?.id;
      this.turnOwner = nextDrawer;
      this.waitingForReply = false;
      sendGameEvent('pillow_reply', { text, nextDrawerId: nextDrawer });
      input.value = '';
      this.updateControls();
    };

    // Enter key to send reply
    document.getElementById('replyInput')!.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('sendReplyBtn')!.click();
      }
    });

    document.querySelectorAll('.pt-deck-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const deck = (btn as HTMLElement).dataset.deck!;
        this.currentDeck = deck;
        
        // Update deck buttons
        document.querySelectorAll('.pt-deck-btn').forEach(b => {
          b.classList.remove('active', 'playful-active-btn', 'deep-active-btn', 'spicy-active-btn');
        });
        btn.classList.add('active', `${deck}-active-btn`);
        
        // Update card styling
        const card = document.getElementById('pillowCard');
        if (card) {
          card.classList.remove('playful-active', 'deep-active', 'spicy-active');
          card.classList.add(`${deck}-active`);
          card.innerHTML = `<span class="card-icon">${this.getDeckIcon(deck)}</span><span>${deck.charAt(0).toUpperCase() + deck.slice(1)} deck selected</span>`;
        }
        
        this.updateLeft();
        this.replies = [];
        this.renderReplies();
        
        if (this.isConnected()) {
          sendGameEvent('pillow_deck', { deck });
        }
      });
    });
  }

  private onGameEvent = (e: Event) => {
    const { event, payload } = (e as CustomEvent).detail;
    if (event === 'pillow_draw') {
      const card = document.getElementById('pillowCard');
      if (card) {
        card.innerHTML = `<span class="card-icon">${this.getDeckIcon(this.currentDeck)}</span><span>${payload.text}</span>`;
      }
      this.waitingForReply = true;
      this.turnOwner = null;
      this.updateControls();
    } else if (event === 'pillow_reply') {
      this.addReply(payload.text, 'partner');
      this.turnOwner = payload.nextDrawerId;
      this.waitingForReply = false;
      this.updateControls();
    } else if (event === 'pillow_reset') {
      this.resetDeck();
      this.assignTurn();
    } else if (event === 'pillow_deck') {
      this.currentDeck = payload.deck;
      
      document.querySelectorAll('.pt-deck-btn').forEach(b => {
        b.classList.remove('active', 'playful-active-btn', 'deep-active-btn', 'spicy-active-btn');
      });
      const activeBtn = document.querySelector(`.pt-deck-btn[data-deck="${payload.deck}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active', `${payload.deck}-active-btn`);
      }
      
      const card = document.getElementById('pillowCard');
      if (card) {
        card.classList.remove('playful-active', 'deep-active', 'spicy-active');
        card.classList.add(`${payload.deck}-active`);
        card.innerHTML = `<span class="card-icon">${this.getDeckIcon(payload.deck)}</span><span>${payload.deck.charAt(0).toUpperCase() + payload.deck.slice(1)} deck selected</span>`;
      }
      
      this.updateLeft();
      this.replies = [];
      this.renderReplies();
    }
  };

  private drawCard() {
    let available = DECKS[this.currentDeck].filter(c => !this.usedCards[this.currentDeck].includes(c));
    if (available.length === 0) {
      this.usedCards[this.currentDeck] = [];
      available = DECKS[this.currentDeck];
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    this.usedCards[this.currentDeck].push(picked);
    this.updateLeft();
    
    const card = document.getElementById('pillowCard');
    if (card) {
      card.innerHTML = `<span class="card-icon">${this.getDeckIcon(this.currentDeck)}</span><span>${picked}</span>`;
    }
    
    this.waitingForReply = true;
    this.turnOwner = null;
    sendGameEvent('pillow_draw', { text: picked });
    this.updateControls();
  }

  private resetDeck() {
    this.usedCards = { playful: [], deep: [], spicy: [] };
    this.updateLeft();
    
    const card = document.getElementById('pillowCard');
    if (card) {
      card.innerHTML = `<span class="card-icon">🔄</span><span>Deck reset. Ready!</span>`;
    }
    
    this.replies = [];
    this.renderReplies();
    this.waitingForReply = false;
  }

  private addReply(text: string, side: 'me' | 'partner') {
    this.replies.push({ text, side });
    this.renderReplies();
  }

  private renderReplies() {
    const box = document.getElementById('repliesList');
    if (!box) return;
    
    if (this.replies.length === 0) {
      box.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;font-size:0.9em;">Replies will appear here</div>';
      return;
    }
    
    box.innerHTML = this.replies.map(r => `
      <div class="pt-reply-bubble ${r.side === 'me' ? 'me' : 'partner'}">${this.escapeHtml(r.text)}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private updateLeft() {
    const left = DECKS[this.currentDeck].length - this.usedCards[this.currentDeck].length;
    const el = document.getElementById('cardsLeft');
    if (el) {
      el.textContent = `Cards remaining in ${this.currentDeck}: ${left}/${DECKS[this.currentDeck].length}`;
    }
  }

  private assignTurn() {
    if (store.state.players.length < 2) {
      this.turnOwner = null;
      this.waitingForReply = false;
    } else if (!this.turnOwner && !this.waitingForReply) {
      this.turnOwner = store.state.players[0].id;
    }
    this.updateControls();
  }

  private updateControls() {
    const drawBtn = document.getElementById('drawCardBtn') as HTMLButtonElement;
    const sendBtn = document.getElementById('sendReplyBtn') as HTMLButtonElement;
    const replyInput = document.getElementById('replyInput') as HTMLInputElement;
    if (!drawBtn || !sendBtn || !replyInput) return;

    if (!this.isConnected() || store.state.players.length < 2) {
      drawBtn.disabled = true;
      sendBtn.disabled = true;
      replyInput.disabled = true;
      return;
    }

    if (this.waitingForReply) {
      drawBtn.disabled = true;
      sendBtn.disabled = false;
      replyInput.disabled = false;
      replyInput.placeholder = "Type your reply...";
    } else {
      sendBtn.disabled = true;
      replyInput.disabled = true;
      replyInput.placeholder = "Wait for a card to be drawn...";
      drawBtn.disabled = (this.turnOwner !== store.state.profile?.id);
    }
  }

  private isConnected(): boolean {
    return store.state.connectionStatus === 'connected';
  }

  private getOtherPlayerId(): string | null {
    const other = store.state.players.find(p => p.id !== store.state.profile?.id);
    return other ? other.id : null;
  }

  handleEvent(event: string, payload: any): void {
    if (event === 'pillow_draw' || event === 'pillow_reply' || event === 'pillow_reset' || event === 'pillow_deck') {
      this.onGameEvent(new CustomEvent('game_event', { detail: { event, payload } }));
    }
  }

  destroy() {
    window.removeEventListener('game_event', this.onGameEvent);
    window.removeEventListener('resize', this.handleResize);
    if (this.playersUnsubscribe) this.playersUnsubscribe();
  }
}