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
  joinBroadcast: () => ipcRenderer.invoke('student:webrtc-join'),
  sendWebRTCAnswer: (answer) => ipcRenderer.invoke('student:webrtc-answer', { answer }),
  sendWebRTCIceCandidate: (candidate) => ipcRenderer.invoke('student:webrtc-ice-candidate', { candidate }),
  onWebRTCOffer: (cb) => ipcRenderer.on('webrtc:offer', (_, d) => cb(d)),
  onWebRTCIceCandidate: (cb) => ipcRenderer.on('webrtc:ice-candidate', (_, d) => cb(d)),

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
