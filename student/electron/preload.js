'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Settings & connection ─────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  connect: (config) => ipcRenderer.invoke('connect', config),
  disconnect: () => ipcRenderer.invoke('disconnect'),

  // ── Events từ main process ────────────────────────────────
  onConnectionStatus: (cb) => ipcRenderer.on('connection-status', (_, d) => cb(d)),
  onChatReceived: (cb) => ipcRenderer.on('chat-received', (_, d) => cb(d)),

  // ── Broadcast window events ───────────────────────────────
  onBroadcastFrame: (cb) => ipcRenderer.on('broadcast-frame', (_, img) => cb(img)),

  // ── Lock window events ────────────────────────────────────
  onUpdateMessage: (cb) => ipcRenderer.on('update-message', (_, msg) => cb(msg)),

  // ── Chat ──────────────────────────────────────────────────
  sendChat: (message) => ipcRenderer.invoke('send-chat', { message }),

  // ── Window controls ───────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // ── Cleanup ───────────────────────────────────────────────
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch)
});
