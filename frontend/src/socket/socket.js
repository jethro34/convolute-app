import { io } from "socket.io-client";

// Use same URL derivation logic as Dashboard
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const socketUrl = apiUrl.replace('/api', '');

export const socket = io(socketUrl, {
  autoConnect: false,
});