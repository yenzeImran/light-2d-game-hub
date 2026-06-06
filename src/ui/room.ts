// room.ts
import { store } from '../store';
import { leaveRoom } from '../websocket';
import { renderChat } from './chat';
import { activateGame } from './games/base';
import { applyTheme, getThemeLabel, renderThemePicker } from './theme';

const GAMES = [
  { key: 'pillow', label: 'Pillow Talk' },
  { key: 'chess', label: 'Chess' },
  { key: 'c4', label: 'Connect 4' },
  { key: 'checkers', label: 'Draughts' },
  { key: 'memory', label: 'Memory' },
  { key: 'othello', label: 'Othello' },
  { key: 'tictactoe', label: 'Tic‑Tac‑Toe' },
];

let currentTab: 'chat' | string = 'chat';
let gameContainer: HTMLElement | null = null;
let chatContainer: HTMLElement | null = null;

function isImageAvatar(avatar: string | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith('data:image') || avatar.startsWith('http') || avatar.startsWith('/');
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

export function renderRoom() {
  const app = document.getElementById('root')!;
  const roomCode = store.state.currentRoom ?? '???';
  const profile = store.state.profile ?? { name: 'Guest', avatar: '🎮' };

  const avatarHtml = (() => {
    const av = profile.avatar;
    if (isImageAvatar(av)) {
      return `<img src="${av}" class="player-avatar-img" alt="avatar" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\"player-avatar-emoji\"></span>`;
    }
    return `<span class="player-avatar-emoji">${av || '🎮'}</span>`;
  })();

  app.innerHTML = `
    <div class="room-container">
      <div class="room-header">
        <div class="player-info">
          ${avatarHtml}
          <span class="player-name">${escapeHtml(profile.name)} <span class="you-badge">(you)</span></span>
          ${renderThemePicker(store.state.theme)}
        </div>
        <div class="room-code-wrapper">
          <span class="room-code-label">Room code:</span>
          <span class="room-code-value" id="roomCodeValue">${roomCode}</span>
          <button id="copyCodeBtn" class="copy-code-btn" title="Copy room code">📋</button>
          <button id="leaveRoomBtn" class="leave-btn">Leave Room</button>
        </div>
      </div>
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="chat">💬 Chat</button>
        ${GAMES.map(game => `<button class="tab-btn" data-tab="${game.key}">${game.label}</button>`).join('')}
      </div>
      <div id="chatContainer" class="tab-content active"></div>
      <div id="gameContainer" class="tab-content" style="display: none;">
        <div id="activeGameContainer"></div>
      </div>
    </div>
  `;

  chatContainer = document.getElementById('chatContainer');
  gameContainer = document.getElementById('gameContainer');
  if (chatContainer) chatContainer.innerHTML = renderChat();

  setupThemePicker();

  // Copy room code button
  const copyBtn = document.getElementById('copyCodeBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const codeSpan = document.getElementById('roomCodeValue');
      if (codeSpan && codeSpan.textContent && codeSpan.textContent !== '???') {
        navigator.clipboard.writeText(codeSpan.textContent);
        const original = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = original; }, 1500);
      } else {
        alert('Waiting for room code...');
      }
    };
  }

  // Leave room button
  document.getElementById('leaveRoomBtn')!.onclick = () => {
    leaveRoom();
    localStorage.removeItem('gamehub_current_room');
    window.location.reload();
  };

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = (e.currentTarget as HTMLElement).dataset.tab!;
      setActiveTab(tabId);
    });
  });

  // Subscribe to room code updates (server may send it later)
  const unsubscribe = store.subscribe(() => {
    const codeSpan = document.getElementById('roomCodeValue');
    if (codeSpan && store.state.currentRoom) {
      codeSpan.textContent = store.state.currentRoom;
    }
  });
  (window as any).__roomUnsubscribe = unsubscribe;

  setActiveTab('chat');
}

function setActiveTab(tabId: string) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const el = btn as HTMLElement;
    if (el.dataset.tab === tabId) el.classList.add('active');
    else el.classList.remove('active');
  });
  if (chatContainer && gameContainer) {
    if (tabId === 'chat') {
      chatContainer.style.display = 'block';
      gameContainer.style.display = 'none';
    } else {
      chatContainer.style.display = 'none';
      gameContainer.style.display = 'block';
      activateGame(tabId);
    }
  }
  currentTab = tabId;
}

function setupThemePicker() {
  const themeBtn = document.getElementById('themeBtn');
  const themeMenu = document.getElementById('themeMenu');
  if (!themeBtn || !themeMenu) return;

  themeBtn.onclick = () => {
    themeMenu.classList.toggle('hidden');
  };

  themeMenu.querySelectorAll('.theme-option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selected = (e.currentTarget as HTMLElement).dataset.theme as 'dark' | 'warm' | 'earth' | 'water' | undefined;
      if (!selected) return;
      applyTheme(selected);
      store.setState({ theme: selected });
      themeBtn.textContent = `Theme: ${getThemeLabel(selected)}`;
      themeMenu.classList.add('hidden');
    });
  });
}

// Required exports for websocket.ts
export function handleGameEvent(event: string, payload: any) {
  window.dispatchEvent(new CustomEvent('game_event', { detail: { event, payload } }));
}
export function handleChatMessage(msg: any) {
  window.dispatchEvent(new CustomEvent('chat_message', { detail: msg }));
}