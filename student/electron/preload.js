'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Settings & Connection ─────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  connect: (config) => ipcRenderer.invoke('connect', config),
  disconnect: () => ipcRenderer.invoke('disconnect'),

  // ── Events từ main process ────────────────────────────────
  onConnectionStatus: (cb) => ipcRenderer.on('connection-status', (_, d) => cb(d)),
  onChatReceived: (cb) => ipcRenderer.on('chat-received', (_, d) => cb(d)),

  // ── Broadcast window events (MSE) ─────────────────────────
  onStreamStart: (cb) => ipcRenderer.on('stream:start', () => cb()),
  onStreamChunk: (cb) => ipcRenderer.on('stream:chunk', (_, chunk) => cb(chunk)),

  // ── Lock window events ────────────────────────────────────
  onUpdateMessage: (cb) => ipcRenderer.on('update-message', (_, msg) => cb(msg)),

  // ── Chat ──────────────────────────────────────────────────
  sendChat: (message) => ipcRenderer.invoke('send-chat', { message }),

  // ── File Transfer ─────────────────────────────────────────
  onFileReceiving: (cb) => ipcRenderer.on('file-receiving', (_, d) => cb(d)),
  onFileReceived: (cb) => ipcRenderer.on('file-received', (_, d) => cb(d)),
  onFileError: (cb) => ipcRenderer.on('file-error', (_, d) => cb(d)),
  submitFile: () => ipcRenderer.invoke('student:submit-file'),
  onSubmitAck: (cb) => ipcRenderer.on('submit:ack', (_, d) => cb(d)),

  // ── App Monitor ───────────────────────────────────────────
  getMonitorStatus: () => ipcRenderer.invoke('get-monitor-status'),
  onAppBlockStatus: (cb) => ipcRenderer.on('app-block-status', (_, d) => cb(d)),
  onAppViolationDetected: (cb) => ipcRenderer.on('app-violation-detected', (_, d) => cb(d)),

  // ── Web Monitor ───────────────────────────────────────────
  getWebMonitorStatus: () => ipcRenderer.invoke('get-web-monitor-status'),
  onWebBlockStatus: (cb) => ipcRenderer.on('web-block-status', (_, d) => cb(d)),

  // ── Window controls ───────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // ── Screen Capture (Renderer side) ────────────────────────
  onStartCapture: (cb) => ipcRenderer.on('capture:start', (_, d) => cb(d)),
  onStopCapture: (cb) => ipcRenderer.on('capture:stop', () => cb()),
  onUpdateCaptureInterval: (cb) => ipcRenderer.on('capture:update-interval', (_, d) => cb(d)),
  sendCaptureFrame: (image) => ipcRenderer.invoke('capture:frame', { image }),

  // ── Cleanup ───────────────────────────────────────────────
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch)
});
