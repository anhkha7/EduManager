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
  
  // ── Broadcast Stream (MSE) ───────────────────────────────────
  sendStreamStart: () => ipcRenderer.send('teacher:stream-start'),
  sendStreamChunk: (chunk) => ipcRenderer.send('teacher:stream-chunk', chunk),

  // ── Remote Control & Stream Control ────────────────────────
  remoteControlStart: (studentId, enabled) => ipcRenderer.invoke('teacher:remote-control-start', { studentId, enabled }),
  sendRemoteInput: (studentId, cmd) => ipcRenderer.send('teacher:remote-control-input', { studentId, cmd }),
  boostStream: (studentId) => ipcRenderer.invoke('teacher:boost-stream', studentId),
  normalStream: (studentId) => ipcRenderer.invoke('teacher:normal-stream', studentId),

  sendChat: (studentId, message) => ipcRenderer.invoke('teacher:chat', { studentId, message }),

  getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),

  // ── File Transfer ─────────────────────────────────────────
  openFileDialog: () => ipcRenderer.invoke('teacher:open-file-dialog'),
  sendFile: (studentId, filePath, fileName, destFolder) => ipcRenderer.invoke('teacher:send-file', { studentId, filePath, fileName, destFolder }),
  onFileProgress: (cb) => ipcRenderer.on('file:progress', (_, d) => cb(d)),
  onFileAck: (cb) => ipcRenderer.on('file:ack', (_, d) => cb(d)),
  // Thu bài
  openSaveDirDialog: () => ipcRenderer.invoke('teacher:open-save-dir-dialog'),
  getSaveDir: () => ipcRenderer.invoke('teacher:get-save-dir'),
  openSubmissionFolder: () => ipcRenderer.invoke('teacher:open-submission-folder'),
  onFileSubmitted: (cb) => ipcRenderer.on('file:submitted', (_, d) => cb(d)),

  // ── App Block ────────────────────────────────────────
  sendAppBlockRules: (rules, mode) => ipcRenderer.invoke('teacher:set-app-block', { enabled: true, rules, mode }),
  stopAppBlock: () => ipcRenderer.invoke('teacher:set-app-block', { enabled: false, rules: [], mode: 'kill' }),
  onAppViolation: (cb) => ipcRenderer.on('app:violation', (_, d) => cb(d)),

  // ── Web Block ────────────────────────────────────────
  sendWebBlockRules: (domains) => ipcRenderer.invoke('teacher:set-web-block', { enabled: true, domains }),
  stopWebBlock: () => ipcRenderer.invoke('teacher:set-web-block', { enabled: false, domains: [] }),

  // ── Logs ─────────────────────────────────────────────
  getLogs: () => ipcRenderer.invoke('teacher:get-logs'),
  clearLogs: () => ipcRenderer.invoke('teacher:clear-logs'),
  exportLogs: () => ipcRenderer.invoke('teacher:export-logs'),
  onNewLog: (cb) => ipcRenderer.on('log:new', (_, d) => cb(d)),

  // ── Window controls ───────────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // ── Cleanup listeners ─────────────────────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
