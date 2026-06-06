// lobby.ts
import { store } from '../store';
import { createRoom, joinRoom, requestRoomList } from '../websocket';
import { renderRoom } from './room';
import { applyTheme, getThemeLabel, loadTheme, renderThemePicker } from './theme';

export function initApp() {
  const app = document.getElementById('root')!;
  app.innerHTML = '';

  const savedProfile = localStorage.getItem('gamehub_profile');
  if (savedProfile) {
    store.setState({ profile: JSON.parse(savedProfile) });
  }

  const savedTheme = loadTheme();
  if (savedTheme) {
    store.setState({ theme: savedTheme });
    applyTheme(savedTheme);
  }

  const savedRoom = localStorage.getItem('gamehub_current_room');
  if (savedRoom && store.state.profile) {
    renderRoom();
    return;
  }

  renderLobby();
}

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

function renderLobby() {
  const app = document.getElementById('root')!;
  const profile = store.state.profile || { name: '', avatar: '🎮' };

  const avatarHtml = (() => {
    const av = profile.avatar;
    if (isImageAvatar(av)) {
      return `<img src="${av}" class="profile-avatar-img" alt="avatar" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\"profile-avatar-emoji\"></span>`;
    }
    return `<span class="profile-avatar-emoji">${av || '🎮'}</span>`;
  })();

  app.innerHTML = `
    <div class="lobby">
      <div class="lobby-header">
        <div class="logo-area"><h1>GameHub</h1></div>
        ${renderThemePicker(store.state.theme)}
        <div class="profile-card" id="profileCard">
          ${avatarHtml}
          <span class="profile-name">${escapeHtml(profile.name) || 'Set name'}</span>
          <span class="edit-icon">✎</span>
        </div>
      </div>

      <div class="room-actions-section">
        <div class="room-code-input-group">
          <label>Enter room code</label>
          <div class="input-button-row">
            <input type="text" id="roomCodeInput" placeholder="e.g., TNPC26" />
            <button id="joinBtn" class="btn-join">Join Room</button>
            <button id="createRoomBtn" class="btn-create">+ Create Room</button>
          </div>
        </div>
      </div>

      <div class="active-rooms">
        <div class="section-header">
          <h2>Active Rooms</h2>
          <button id="refreshRoomsBtn" class="refresh-btn">⟳ Refresh</button>
        </div>
        <div id="roomList" class="rooms-list"></div>
      </div>

      <div class="games-section">
        <h2>Multiplayer Games</h2>
        <div class="games-grid">
          <div class="game-card">🎴 Pillow Talk</div>
          <div class="game-card">♟️ Chess</div>
          <div class="game-card">🔴 Connect 4</div>
          <div class="game-card">⬛ Draughts</div>
          <div class="game-card">🧠 Memory</div>
          <div class="game-card">⚫ Othello</div>
        </div>
      </div>
    </div>

    <!-- Profile Modal -->
    <div id="profileModal" class="profile-modal hidden">
      <div class="profile-modal-content">
        <h3>Your profile</h3>
        <div class="avatar-preview" id="avatarPreview">
          ${avatarHtml}
        </div>
        <input type="text" id="modalNameInput" placeholder="Name" value="${escapeHtml(profile.name)}" />
        <div class="file-input-wrapper">
          <label for="avatarUpload" class="upload-btn">Choose profile picture</label>
          <input type="file" id="avatarUpload" accept="image/jpeg,image/png,image/gif" style="display: none;" />
        </div>
        <button id="saveProfileBtn">Save</button>
        <button id="closeModalBtn" class="close-modal">Close</button>
      </div>
    </div>

    <!-- Create Room Modal -->
    <div id="createRoomModal" class="profile-modal hidden">
      <div class="profile-modal-content">
        <h3>Create New Room</h3>
        <div style="margin: 12px 0;">
          <label style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <input type="radio" name="roomType" value="public" checked> Public (listed in lobby)
          </label>
          <label style="display: flex; align-items: center; gap: 12px;">
            <input type="radio" name="roomType" value="private"> Private (invite by code)
          </label>
        </div>
        <input type="text" id="roomNameInput" placeholder="Room name (optional)" style="width: 100%;" />
        <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancelCreateBtn" class="close-modal">Cancel</button>
          <button id="confirmCreateBtn" style="background: #1f5e3a;">Create</button>
        </div>
      </div>
    </div>
  `;

  // DOM elements
  const roomCodeInput = document.getElementById('roomCodeInput') as HTMLInputElement;
  const joinBtn = document.getElementById('joinBtn')!;
  const createRoomBtn = document.getElementById('createRoomBtn')!;
  const refreshBtn = document.getElementById('refreshRoomsBtn')!;
  const profileCard = document.getElementById('profileCard')!;
  const profileModal = document.getElementById('profileModal')!;
  const saveProfileBtn = document.getElementById('saveProfileBtn')!;
  const closeModalBtn = document.getElementById('closeModalBtn')!;
  const modalNameInput = document.getElementById('modalNameInput') as HTMLInputElement;
  const avatarUpload = document.getElementById('avatarUpload') as HTMLInputElement;
  const avatarPreview = document.getElementById('avatarPreview')!;
  const createModal = document.getElementById('createRoomModal')!;
  const cancelCreateBtn = document.getElementById('cancelCreateBtn')!;
  const confirmCreateBtn = document.getElementById('confirmCreateBtn')!;
  const publicRadio = document.querySelector('input[value="public"]') as HTMLInputElement;

  // --- Profile modal handlers ---
  const openModal = () => profileModal.classList.remove('hidden');
  const closeModal = () => profileModal.classList.add('hidden');
  profileCard.onclick = openModal;
  closeModalBtn.onclick = closeModal;

  // File upload & resize
  avatarUpload.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/png');
        avatarPreview.innerHTML = `<img src="${dataUrl}" class="profile-avatar-img" alt="avatar">`;
        (window as any).tempAvatar = dataUrl;
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  saveProfileBtn.onclick = () => {
    const name = modalNameInput.value.trim();
    if (!name) {
      alert('Name required');
      return;
    }
    const newAvatar = (window as any).tempAvatar || store.state.profile?.avatar || '🎮';
    const profile = { name, avatar: newAvatar };
    store.setState({ profile });
    localStorage.setItem('gamehub_profile', JSON.stringify(profile));
    // Update header display
    updateProfileHeader(profile);
    closeModal();
    delete (window as any).tempAvatar;
  };

  function updateProfileHeader(profile: { name: string; avatar: string }) {
    const card = document.querySelector('.profile-card');
    if (!card) return;
    const avatarHtml = isImageAvatar(profile.avatar)
      ? `<img src="${profile.avatar}" class="profile-avatar-img" alt="avatar" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\"profile-avatar-emoji\"></span>';">`
      : `<span class="profile-avatar-emoji">${profile.avatar || ''}</span>`;
    const nameSpan = card.querySelector('.profile-name');
    const oldAvatar = card.querySelector('.profile-avatar-img, .profile-avatar-emoji');
    if (oldAvatar) oldAvatar.remove();
    card.insertAdjacentHTML('afterbegin', avatarHtml);
    if (nameSpan) nameSpan.textContent = profile.name;
  }

  // --- Create Room modal handlers ---
  const openCreateModal = () => createModal.classList.remove('hidden');
  const closeCreateModal = () => createModal.classList.add('hidden');
  createRoomBtn.onclick = openCreateModal;
  cancelCreateBtn.onclick = closeCreateModal;
  confirmCreateBtn.onclick = () => {
    const isPublic = publicRadio.checked;
    createRoom(isPublic);
    closeCreateModal();
    renderRoom();
  };

  // --- Room actions ---
  joinBtn.onclick = () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) return alert('Enter a room code');
    joinRoom(code);
    renderRoom();
  };
  refreshBtn.onclick = () => requestRoomList();

  setupThemePicker();

  // --- Store subscription: update public room list ---
  const unsub = store.subscribe(() => {
    const roomListDiv = document.getElementById('roomList');
    if (!roomListDiv) return;
    const rooms = store.state.publicRooms;
    if (rooms.length === 0) {
      roomListDiv.innerHTML = '<div class="empty-rooms">No public rooms yet — create one!</div>';
      return;
    }
    roomListDiv.innerHTML = rooms.map(r => `
      <div class="room-entry">
        <div class="room-info">
          <span class="room-code">${r.code}</span>
          <span class="room-meta">${r.playerCount} player(s)</span>
        </div>
        <button data-code="${r.code}" class="join-public-btn">Join</button>
      </div>
    `).join('');
    document.querySelectorAll('.join-public-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = (e.currentTarget as HTMLElement).dataset.code!;
        joinRoom(code);
        renderRoom();
      });
    });
  });
  requestRoomList();
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
