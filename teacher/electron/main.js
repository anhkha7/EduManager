'use strict';
const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const isDev = process.env.NODE_ENV === 'development';
// ═══════════════════════════════════════════════════════════════
//  EMBEDDED SOCKET.IO SERVER
//  Chạy trực tiếp trong main process của teacher app
// ═══════════════════════════════════════════════════════════════
const SERVER_PORT = 3722; // Port đặc trưng cho EduManager
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 10e6, // 10MB (cho broadcast frames)
  pingTimeout: 15000,
  pingInterval: 5000
});
// Danh sách học sinh đang kết nối: socketId -> StudentInfo
const students = new Map();
io.on('connection', (socket) => {
  console.log(`[Server] Kết nối mới: ${socket.id} từ ${socket.handshake.address}`);
  // ── Học sinh tham gia lớp ──────────────────────────────────────
  socket.on('student:join', (data) => {
    const info = {
      name: data.name || 'Không xác định',
      computerName: data.computerName || 'PC',
      ip: socket.handshake.address.replace('::ffff:', ''),
      locked: false,
      broadcasting: false,
      thumbnail: null,
      joinedAt: Date.now()
    };
    students.set(socket.id, info);
    socket.join('students');
    console.log(`[Server] Học sinh tham gia: ${info.name} (${info.ip})`);
    // Thông báo cho teacher renderer
    notifyRenderer('student:joined', { id: socket.id, ...info });
  });
  // ── Học sinh gửi thumbnail màn hình ───────────────────────────
  socket.on('student:thumbnail', (data) => {
    const student = students.get(socket.id);
    if (!student) return;
    student.thumbnail = data.image;
    // Forward tới teacher UI
    notifyRenderer('student:thumbnail', { id: socket.id, image: data.image });
  });
  // ── Học sinh gửi chat tới giáo viên ──────────────────────────
  socket.on('student:chat', (data) => {
    const student = students.get(socket.id);
    if (!student) return;
    notifyRenderer('chat:incoming', {
      from: student.name,
      studentId: socket.id,
      message: data.message,
      time: Date.now()
    });
  });
  // ── Xử lý ngắt kết nối ────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    if (students.has(socket.id)) {
      const student = students.get(socket.id);
      students.delete(socket.id);
      console.log(`[Server] Học sinh offline: ${student.name} (${reason})`);
      notifyRenderer('student:left', { id: socket.id, name: student.name });
    }
  });
});
// Khởi động server
httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`[Server] EduManager Server đang chạy trên cổng ${SERVER_PORT}`);
});
httpServer.on('error', (err) => {
  console.error('[Server] Lỗi server:', err.message);
});
// ═══════════════════════════════════════════════════════════════
//  HELPER: Lấy địa chỉ IP LAN của máy
// ═══════════════════════════════════════════════════════════════
function getLanIP() {
  const interfaces = os.networkInterfaces();
  const virtualKeywords = ['vmware', 'virtual', 'wsl', 'vethernet', 'hamachi', 'loopback', 'npcap'];
  let fallbackIp = null;
  for (const name of Object.keys(interfaces)) {
    const isVirtual = virtualKeywords.some(kw => name.toLowerCase().includes(kw));
    
    for (const iface of (interfaces[name] || [])) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          return iface.address; // Ưu tiên card mạng vật lý thật
        } else if (!fallbackIp) {
          fallbackIp = iface.address; // Lưu tạm card ảo để dự phòng
        }
      }
    }
  }
  return fallbackIp || '127.0.0.1';
}
// ═══════════════════════════════════════════════════════════════
//  ELECTRON WINDOW
// ═══════════════════════════════════════════════════════════════
let mainWindow = null;
function notifyRenderer(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data);
  }
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    frame: false,           // Custom titlebar
    backgroundColor: '#0a0e1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev
    }
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
// ═══════════════════════════════════════════════════════════════
//  IPC HANDLERS — Teacher → Server commands
// ═══════════════════════════════════════════════════════════════
// Thông tin server
ipcMain.handle('get-server-info', () => ({
  ip: getLanIP(),
  port: SERVER_PORT,
  studentCount: students.size
}));
// Danh sách học sinh hiện tại
ipcMain.handle('get-students', () =>
  Array.from(students.entries()).map(([id, info]) => ({ id, ...info }))
);
// ── Khóa màn hình ─────────────────────────────────────────────
ipcMain.handle('teacher:lock', (_, { studentId, message }) => {
  const msg = message || 'Màn hình đang bị khóa bởi giáo viên';
  if (studentId === 'all') {
    io.to('students').emit('command:lock', { message: msg });
    students.forEach(s => { s.locked = true; });
  } else {
    io.to(studentId).emit('command:lock', { message: msg });
    const s = students.get(studentId);
    if (s) s.locked = true;
  }
  // Cập nhật UI giáo viên
  notifyRenderer('students:state-changed', getStudentList());
});
// ── Mở khóa màn hình ──────────────────────────────────────────
ipcMain.handle('teacher:unlock', (_, { studentId }) => {
  if (studentId === 'all') {
    io.to('students').emit('command:unlock');
    students.forEach(s => { s.locked = false; s.broadcasting = false; });
  } else {
    io.to(studentId).emit('command:unlock');
    const s = students.get(studentId);
    if (s) { s.locked = false; s.broadcasting = false; }
  }
  notifyRenderer('students:state-changed', getStudentList());
});
// ── Bắt đầu broadcast ─────────────────────────────────────────
ipcMain.handle('teacher:broadcast-start', () => {
  io.to('students').emit('broadcast:start');
  students.forEach(s => { s.broadcasting = true; s.locked = true; });
  notifyRenderer('students:state-changed', getStudentList());
});
// ── Dừng broadcast ────────────────────────────────────────────
ipcMain.handle('teacher:broadcast-stop', () => {
  io.to('students').emit('broadcast:stop');
  students.forEach(s => { s.broadcasting = false; s.locked = false; });
  notifyRenderer('students:state-changed', getStudentList());
});
// ── Gửi frame broadcast (từ renderer, không dùng invoke để tránh lag) ──
ipcMain.on('teacher:broadcast-frame', (_, { image }) => {
  io.to('students').emit('broadcast:frame', { image });
});
// ── Gửi chat/thông báo ────────────────────────────────────────
ipcMain.handle('teacher:chat', (_, { studentId, message }) => {
  if (studentId === 'all') {
    io.to('students').emit('chat:message', {
      from: 'Giáo viên',
      message,
      time: Date.now()
    });
  } else {
    io.to(studentId).emit('chat:message', {
      from: 'Giáo viên',
      message,
      time: Date.now()
    });
  }
});
// ── Screen capture source ID cho broadcast ────────────────────
ipcMain.handle('get-screen-source-id', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 } // nhỏ nhất có thể để nhanh
  });
  return sources[0]?.id ?? null;
});
// ── Window controls ───────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function getStudentList() {
  return Array.from(students.entries()).map(([id, info]) => ({ id, ...info }));
}
// ═══════════════════════════════════════════════════════════════
//  APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════
app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on('window-all-closed', () => {
  httpServer.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  // Thông báo học sinh giáo viên đã thoát
  io.to('students').emit('teacher:disconnect');
  httpServer.close();
});