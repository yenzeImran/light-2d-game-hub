import "./style.css";
import { initApp } from './ui/lobby';
import { connectWebSocket } from './websocket';
import { setupChat } from './ui/chat';
import { initSupabase } from './supabase';
import { store } from './store';

// Initialise Supabase (just the client, kept for future use)
initSupabase();

// Connect to WebSocket server
connectWebSocket();

// Start with the lobby
initApp();

// Set up chat listeners (will be activated when inside a room)
setupChat();