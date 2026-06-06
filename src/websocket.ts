import { store } from './store';
import { handleChatMessage, handleGameEvent, renderRoom } from './ui/room';

let socket: WebSocket | null = null;
let reconnectTimer: number;

export function connectWebSocket() {
  const envUrl = import.meta.env.VITE_WS_SERVER_URL;
  const defaultProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const defaultHost = window.location.hostname === 'localhost' ? 'localhost:3001' : window.location.host;
  const url = envUrl
    ? envUrl.startsWith('ws://') || envUrl.startsWith('wss://')
      ? envUrl
      : `${defaultProtocol}://${envUrl}`
    : `${defaultProtocol}://${defaultHost}/ws`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    store.setState({ connectionStatus: 'connected' });
    clearTimeout(reconnectTimer);
    console.log('WebSocket connected');
    const savedRoom = localStorage.getItem('gamehub_current_room');
    if (savedRoom && store.state.profile) {
      joinRoom(savedRoom);
    }
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'room_created':
        // Server created a room for us — set current room and navigate
        store.setState({ currentRoom: msg.code });
        localStorage.setItem('gamehub_current_room', msg.code);
        renderRoom();
        break;
      case 'room_joined':
        // Successfully joined a room (from join flow)
        store.setState({ currentRoom: msg.code });
        localStorage.setItem('gamehub_current_room', msg.code);
        renderRoom();
        break;
      case 'presence':
        store.setState({ players: msg.players });
        break;
      case 'chat':
        handleChatMessage(msg);
        break;
      case 'game_event':
        handleGameEvent(msg.event, msg.payload);
        break;
      case 'room_list':
        store.setState({ publicRooms: msg.rooms });
        break;
      case 'error':
        alert(msg.message);
        break;
    }
  };

  socket.onclose = () => {
    store.setState({ connectionStatus: 'disconnected' });
    socket = null;
    reconnectTimer = window.setTimeout(connectWebSocket, 3000);
  };
}

function send(data: any) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

export function joinRoom(code: string) {
  // Optimistically set the current room so the UI can render immediately.
  store.setState({ currentRoom: code });
  send({ type: 'join', code, profile: store.state.profile });
  localStorage.setItem('gamehub_current_room', code);
}

export function leaveRoom() {
  send({ type: 'leave', code: store.state.currentRoom });
  store.setState({ currentRoom: null, players: [] });
  localStorage.removeItem('gamehub_current_room');
}

export function createRoom(publicRoom = false) {
  send({ type: 'create', public: publicRoom, profile: store.state.profile });
}

export function sendChat(text: string) {
  send({ type: 'chat', text, room: store.state.currentRoom, profile: store.state.profile });
}

export function sendGameEvent(event: string, payload: any) {
  send({ type: 'game_event', room: store.state.currentRoom, event, payload });
}

export function requestRoomList() {
  send({ type: 'list_rooms' });
}