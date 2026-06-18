'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Server info ──────────────────────────────────────────────
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getStudents: () => ipcRenderer.invoke('get-students'),

  // ── Sự kiện từ server (học sinh) ─────────────────────────────
  onStudentJoined: (cb) => ipcRenderer.on('student:joined', (_, d) => cb(d)),
  onStudentLeft: (cb) => ipcRenderer.on('student:left', (_, d) => cb(d)),
  onStudentThumbnail: (cb) => ipcRenderer.on('student:thumbnail', (_, d) => cb(d)),
  onStudentsStateChanged: (cb) => ipcRenderer.on('students:state-changed', (_, d) => cb(d)),
  onChatIncoming: (cb) => ipcRenderer.on('chat:incoming', (_, d) => cb(d)),

  // ── Teacher commands ─────────────────────────────────────────
  lockAll: (message) => ipcRenderer.invoke('teacher:lock', { studentId: 'all', message }),
  unlockAll: () => ipcRenderer.invoke('teacher:unlock', { studentId: 'all' }),
  lockStudent: (id, message) => ipcRenderer.invoke('teacher:lock', { studentId: id, message }),
  unlockStudent: (id) => ipcRenderer.invoke('teacher:unlock', { studentId: id }),

  startBroadcast: () => ipcRenderer.invoke('teacher:broadcast-start'),
  stopBroadcast: () => ipcRenderer.invoke('teacher:broadcast-stop'),
  
  // ── WebRTC ───────────────────────────────────────────────────
  onWebRTCJoin: (cb) => ipcRenderer.on('webrtc:join-broadcast', (_, d) => cb(d)),
  onWebRTCAnswer: (cb) => ipcRenderer.on('webrtc:answer', (_, d) => cb(d)),
  onWebRTCIceCandidate: (cb) => ipcRenderer.on('webrtc:ice-candidate', (_, d) => cb(d)),
  sendWebRTCOffer: (studentId, offer) => ipcRenderer.send('teacher:webrtc-offer', { studentId, offer }),
  sendWebRTCIceCandidate: (studentId, candidate) => ipcRenderer.send('teacher:webrtc-ice-candidate', { studentId, candidate }),

  sendChat: (studentId, message) => ipcRenderer.invoke('teacher:chat', { studentId, message }),

  getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),

  // ── Window controls ───────────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // ── Cleanup listeners ─────────────────────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
