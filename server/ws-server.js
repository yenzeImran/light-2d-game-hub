import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

function getMimeType(ext) {
  return {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  }[ext] || 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname === '/ws') {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('Upgrade required');
    return;
  }

  let filePath = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !extname(filePath)) {
    filePath = join(distDir, 'index.html');
  }

  try {
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': getMimeType(extname(filePath)) });
    res.end(data);
  } catch (error) {
    try {
      const indexHtml = await readFile(join(distDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexHtml);
    } catch (fallbackError) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

// room structure: { players: [{ ws, profile }], public: boolean }
const rooms = new Map();

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getRoom(code) {
  return rooms.get(code);
}

function removePlayerFromRoom(ws) {
  for (const [code, room] of rooms.entries()) {
    const index = room.players.findIndex(p => p.ws === ws);
    if (index !== -1) {
      room.players.splice(index, 1);
      if (room.players.length === 0) {
        rooms.delete(code);
        updatePublicRooms();
      } else {
        broadcastPresence(code);
      }
      return code;
    }
  }
  return null;
}

function broadcastPresence(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = room.players.map(p => p.profile);
  broadcastToRoom(roomCode, { type: 'presence', players });
}

function broadcastToRoom(roomCode, data, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const player of room.players) {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msg);
    }
  }
}

function updatePublicRooms() {
  const publicRooms = [];
  for (const [code, room] of rooms.entries()) {
    if (room.public) {
      publicRooms.push({ code, playerCount: room.players.length });
    }
  }
  // Broadcast updated list to all connected clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'room_list', rooms: publicRooms }));
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case 'create': {
        const code = generateCode();
        rooms.set(code, { players: [{ ws, profile: msg.profile }], public: msg.public || false });
        ws.send(JSON.stringify({ type: 'room_created', code }));
        if (rooms.get(code).public) updatePublicRooms();
        broadcastPresence(code);
        break;
      }

      case 'join': {
        const room = rooms.get(msg.code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        // Prevent duplicate joins from same ws
        if (room.players.some(p => p.ws === ws)) {
          return;
        }
        room.players.push({ ws, profile: msg.profile });
        ws.send(JSON.stringify({ type: 'room_joined', code: msg.code }));
        broadcastPresence(msg.code);
        if (room.public) updatePublicRooms();
        break;
      }

      case 'leave': {
        const code = msg.code;
        const room = rooms.get(code);
        if (room) {
          room.players = room.players.filter(p => p.ws !== ws);
          if (room.players.length === 0) {
            rooms.delete(code);
            updatePublicRooms();
          } else {
            broadcastPresence(code);
          }
        }
        break;
      }

      case 'chat': {
        broadcastToRoom(msg.room, { type: 'chat', text: msg.text, profile: msg.profile }, ws);
        break;
      }

      case 'game_event': {
        broadcastToRoom(msg.room, { type: 'game_event', event: msg.event, payload: msg.payload }, ws);
        break;
      }

      case 'list_rooms': {
        const publicRooms = [];
        for (const [code, room] of rooms.entries()) {
          if (room.public) {
            publicRooms.push({ code, playerCount: room.players.length });
          }
        }
        ws.send(JSON.stringify({ type: 'room_list', rooms: publicRooms }));
        break;
      }
    }
  });

  ws.on('close', () => {
    removePlayerFromRoom(ws);
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});