import { sendChat } from '../websocket';
import { store } from '../store';

const CHAT_STORAGE_KEY = 'chatyapp_chat_messages';
const MAX_STORED_MESSAGES = 100;

interface ChatMessage {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
  timestamp: number;
}

// Load messages from local storage
function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const messages = JSON.parse(stored);
      return Array.isArray(messages) ? messages : [];
    }
  } catch (e) {
    console.error('Failed to load chat messages:', e);
  }
  return [];
}

// Save messages to local storage
function saveMessages(messages: ChatMessage[]) {
  try {
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save chat messages:', e);
  }
}

export function renderChat(): string {
  return `
    <div class="modern-chat-wrapper">
      <style>
        .modern-chat-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 16px;
          overflow: hidden;
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        }
        
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .chat-header-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2em;
        }
        
        .chat-header-text {
          flex: 1;
        }
        
        .chat-header-title {
          color: #fff;
          font-weight: 600;
          font-size: 0.95em;
        }
        
        .chat-header-subtitle {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.75em;
        }
        
        .chat-header-actions {
          display: flex;
          gap: 8px;
        }
        
        .chat-header-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          font-size: 0.85em;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-header-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          scroll-behavior: smooth;
        }
        
        .chat-messages::-webkit-scrollbar {
          width: 5px;
        }
        
        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
        
        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        
        .chat-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.3);
          text-align: center;
          padding: 20px;
        }
        
        .chat-empty-state .empty-icon {
          font-size: 3em;
          margin-bottom: 10px;
        }
        
        .chat-empty-state .empty-text {
          font-size: 0.9em;
          line-height: 1.5;
        }
        
        .chat-date-separator {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 0;
        }
        
        .chat-date-separator::before,
        .chat-date-separator::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .chat-date-separator span {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.7em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .chat-msg-wrapper {
          display: flex;
          flex-direction: column;
          animation: messageSlideIn 0.3s ease;
        }
        
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .chat-msg-wrapper.my-message {
          align-items: flex-end;
        }
        
        .chat-msg-wrapper.other-message {
          align-items: flex-start;
        }
        
        .chat-msg-sender {
          font-size: 0.7em;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 2px;
          padding: 0 8px;
        }
        
        .chat-msg {
          padding: 10px 14px;
          border-radius: 16px;
          max-width: 75%;
          word-wrap: break-word;
          font-size: 0.9em;
          line-height: 1.4;
          position: relative;
        }
        
        .chat-msg-wrapper.my-message .chat-msg {
          background: linear-gradient(135deg, #ff6b6b, #c44569);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        
        .chat-msg-wrapper.other-message .chat-msg {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-bottom-left-radius: 4px;
        }
        
        .chat-msg-time {
          font-size: 0.65em;
          opacity: 0.6;
          margin-top: 4px;
          padding: 0 8px;
        }
        
        .chat-typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          max-width: 60px;
        }
        
        .chat-typing-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          animation: typingBounce 1.4s infinite;
        }
        
        .chat-typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .chat-typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        
        .chat-input-area {
          display: flex;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          align-items: center;
        }
        
        .chat-input {
          flex: 1;
          padding: 10px 16px;
          border-radius: 25px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-size: 0.9em;
          outline: none;
          transition: all 0.3s ease;
          font-family: inherit;
        }
        
        .chat-input:focus {
          border-color: #ff6b6b;
          box-shadow: 0 0 15px rgba(255, 107, 107, 0.2);
          background: rgba(255, 255, 255, 0.08);
        }
        
        .chat-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .chat-send-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #ff6b6b, #c44569);
          color: #fff;
          cursor: pointer;
          font-size: 1.1em;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
        }
        
        .chat-send-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(255, 107, 107, 0.5);
        }
        
        .chat-send-btn:active {
          transform: scale(0.95);
        }
        
        .chat-new-messages-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          color: #ff6b6b;
          font-size: 0.8em;
          cursor: pointer;
          animation: fadeInDown 0.3s ease;
        }
        
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      </style>
      
      <div class="chat-header">
        <div class="chat-header-icon">💬</div>
        <div class="chat-header-text">
          <div class="chat-header-title">Room Chat</div>
          <div class="chat-header-subtitle" id="chatOnlineCount">0 online</div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn" id="clearChatBtn" title="Clear chat">🗑️</button>
        </div>
      </div>
      
      <div class="chat-messages" id="chatMessages">
        <div class="chat-empty-state">
          <div class="empty-icon">💭</div>
          <div class="empty-text">No messages yet.<br>Start the conversation!</div>
        </div>
      </div>
      
      <div class="chat-input-area">
        <input 
          class="chat-input" 
          id="chatInput" 
          placeholder="Type a message..." 
          autocomplete="off"
          maxlength="500"
        />
        <button class="chat-send-btn" id="sendChatBtn">➤</button>
      </div>
    </div>
  `;
}

export function setupChat() {
  const messages: ChatMessage[] = loadMessages();
  const myId = store.state.profile?.id;
  let lastMessageCount = 0;
  let isAtBottom = true;

  // Render stored messages
  renderStoredMessages(messages);

  // Check if user is at bottom of chat
  const messagesDiv = document.getElementById('chatMessages');
  if (messagesDiv) {
    messagesDiv.addEventListener('scroll', () => {
      const threshold = 50;
      isAtBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < threshold;
      
      // Hide new messages indicator if scrolled to bottom
      const indicator = document.getElementById('newMessagesIndicator');
      if (indicator && isAtBottom) {
        indicator.remove();
      }
    });
  }

  // Clear chat button
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'clearChatBtn') {
      if (confirm('Clear all chat messages?')) {
        messages.length = 0;
        saveMessages(messages);
        renderStoredMessages(messages);
        lastMessageCount = 0;
      }
    }
  });

  // Handle incoming chat messages
  window.addEventListener('chat_message', ((e: CustomEvent) => {
    const msg = e.detail;
    const newMessage: ChatMessage = {
      id: generateMessageId(),
      text: msg.text,
      senderName: msg.profile?.name || 'Unknown',
      senderId: msg.profile?.id || 'unknown',
      timestamp: Date.now()
    };
    
    messages.push(newMessage);
    saveMessages(messages);
    
    // Add message to UI
    appendMessageToUI(newMessage);
    
    // Handle scroll behavior
    if (!isAtBottom && messages.length > lastMessageCount) {
      showNewMessagesIndicator();
    }
    
    lastMessageCount = messages.length;
  }) as EventListener);

  // Handle send button
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'sendChatBtn') {
      sendChatMessage();
    }
  });

  // Handle Enter key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const input = document.getElementById('chatInput');
      if (document.activeElement === input) {
        e.preventDefault();
        sendChatMessage();
      }
    }
  });

  // Update online count periodically
  updateOnlineCount();
  setInterval(updateOnlineCount, 10000);

  function sendChatMessage() {
    const input = document.getElementById('chatInput') as HTMLInputElement;
    if (input && input.value.trim()) {
      sendChat(input.value.trim());
      input.value = '';
      input.focus();
    }
  }

  function generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function appendMessageToUI(msg: ChatMessage) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;

    // Remove empty state if present
    const emptyState = messagesDiv.querySelector('.chat-empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const isMyMessage = msg.senderId === myId;
    const time = formatTime(msg.timestamp);
    
    // Add date separator if needed
    const lastMsg = messages[messages.length - 2];
    if (!lastMsg || !isSameDay(msg.timestamp, lastMsg.timestamp)) {
      const dateSep = document.createElement('div');
      dateSep.className = 'chat-date-separator';
      dateSep.innerHTML = `<span>${formatDate(msg.timestamp)}</span>`;
      messagesDiv.appendChild(dateSep);
    }

    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg-wrapper ${isMyMessage ? 'my-message' : 'other-message'}`;
    wrapper.innerHTML = `
      ${!isMyMessage ? `<div class="chat-msg-sender">${escapeHtml(msg.senderName)}</div>` : ''}
      <div class="chat-msg">${escapeHtml(msg.text)}</div>
      <div class="chat-msg-time">${time}</div>
    `;
    
    messagesDiv.appendChild(wrapper);
    
    if (isAtBottom) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function renderStoredMessages(msgs: ChatMessage[]) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    
    messagesDiv.innerHTML = '';
    
    if (msgs.length === 0) {
      messagesDiv.innerHTML = `
        <div class="chat-empty-state">
          <div class="empty-icon">💭</div>
          <div class="empty-text">No messages yet.<br>Start the conversation!</div>
        </div>
      `;
      return;
    }
    
    msgs.forEach((msg, index) => {
      const isMyMessage = msg.senderId === myId;
      const time = formatTime(msg.timestamp);
      
      // Add date separator if needed
      if (index === 0 || !isSameDay(msg.timestamp, msgs[index - 1].timestamp)) {
        const dateSep = document.createElement('div');
        dateSep.className = 'chat-date-separator';
        dateSep.innerHTML = `<span>${formatDate(msg.timestamp)}</span>`;
        messagesDiv.appendChild(dateSep);
      }
      
      const wrapper = document.createElement('div');
      wrapper.className = `chat-msg-wrapper ${isMyMessage ? 'my-message' : 'other-message'}`;
      wrapper.innerHTML = `
        ${!isMyMessage ? `<div class="chat-msg-sender">${escapeHtml(msg.senderName)}</div>` : ''}
        <div class="chat-msg">${escapeHtml(msg.text)}</div>
        <div class="chat-msg-time">${time}</div>
      `;
      
      messagesDiv.appendChild(wrapper);
    });
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    lastMessageCount = msgs.length;
  }

  function showNewMessagesIndicator() {
    const existing = document.getElementById('newMessagesIndicator');
    if (existing) return;
    
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'newMessagesIndicator';
    indicator.className = 'chat-new-messages-indicator';
    indicator.innerHTML = '▼ New messages';
    indicator.onclick = () => {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      indicator.remove();
      isAtBottom = true;
    };
    
    messagesDiv.appendChild(indicator);
  }

  function updateOnlineCount() {
    const countEl = document.getElementById('chatOnlineCount');
    if (countEl) {
      const count = store.state.players?.length || 0;
      countEl.textContent = `${count} online`;
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isSameDay(t1: number, t2: number): boolean {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}