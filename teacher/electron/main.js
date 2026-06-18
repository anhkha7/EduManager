'use strict';
const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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
  maxHttpBufferSize: 50e6, // 50MB (hỗ trợ gửi file)
  pingTimeout: 15000,
  pingInterval: 5000
});
// Danh sách học sinh đang kết nối: socketId -> StudentInfo
const students = new Map();
// Thư mục mặc định để thu bài nộp từ học sinh
let submissionSaveDir = path.join(os.homedir(), 'Downloads', 'EduManager', 'Submissions');
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
  // ── WebRTC Signaling ──────────────────────────────────────────
  socket.on('webrtc:join-broadcast', () => {
    console.log(`[Server Socket] Nhận join-broadcast từ student: ${socket.id}`);
    notifyRenderer('webrtc:join-broadcast', { studentId: socket.id });
  });
  socket.on('webrtc:answer', (data) => {
    console.log(`[Server Socket] Nhận answer từ student: ${socket.id}`);
    notifyRenderer('webrtc:answer', { studentId: socket.id, answer: data.answer });
  });
  socket.on('webrtc:ice-candidate', (data) => {
    console.log(`[Server Socket] Nhận ice-candidate từ student: ${socket.id}`);
    notifyRenderer('webrtc:ice-candidate', { studentId: socket.id, candidate: data.candidate });
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

  // ── File Transfer ACK ──────────────────────────────────────
  socket.on('file:received-ack', ({ fileId, fileName, studentName }) => {
    console.log(`[Server] Học sinh ${studentName} đã nhận file: ${fileName}`);
    notifyRenderer('file:ack', { fileId, fileName, studentName });
  });

  // ── Nhận bài nộp từ học sinh ─────────────────────────────────
  const submitBuffers = new Map(); // fileId -> { fileName, studentName, chunks: [] }
  socket.on('student:submit-start', ({ fileId, fileName, totalChunks, fileSize, studentName }) => {
    console.log(`[Server] Nhận bài nộp: ${studentName} → ${fileName}`);
    submitBuffers.set(fileId, { fileName, studentName, totalChunks, chunks: [] });
  });
  socket.on('student:submit-chunk', ({ fileId, chunkIndex, chunk }) => {
    const entry = submitBuffers.get(fileId);
    if (!entry) return;
    entry.chunks[chunkIndex] = Buffer.from(chunk, 'base64');
  });
  socket.on('student:submit-done', async ({ fileId }) => {
    const entry = submitBuffers.get(fileId);
    if (!entry) return;
    submitBuffers.delete(fileId);
    try {
      const completeBuffer = Buffer.concat(entry.chunks.filter(Boolean));
      const studentDir = path.join(submissionSaveDir, entry.studentName);
      await fs.promises.mkdir(studentDir, { recursive: true });
      const savePath = path.join(studentDir, entry.fileName);
      await fs.promises.writeFile(savePath, completeBuffer);
      console.log(`[Server] Đã lưu bài nộp: ${savePath}`);
      notifyRenderer('file:submitted', {
        fileId,
        fileName: entry.fileName,
        studentName: entry.studentName,
        savePath,
        fileSize: completeBuffer.length,
        time: Date.now()
      });
      socket.emit('submit:ack', { fileId, fileName: entry.fileName });
    } catch (err) {
      console.error('[Server] Lỗi lưu bài nộp:', err.message);
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
// ── WebRTC Signaling (Teacher -> Student) ─────────────────────
ipcMain.on('teacher:webrtc-offer', (_, { studentId, offer }) => {
  console.log(`[Teacher IPC] gửi offer tới student: ${studentId}`);
  io.to(studentId).emit('webrtc:offer', { offer });
});
ipcMain.on('teacher:webrtc-ice-candidate', (_, { studentId, candidate }) => {
  console.log(`[Teacher IPC] gửi ice-candidate tới student: ${studentId}`);
  io.to(studentId).emit('webrtc:ice-candidate', { candidate });
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
// ── File Transfer ─────────────────────────────────────────────
// Mở hộp thoại chọn file
ipcMain.handle('teacher:open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn file để gửi cho học sinh',
    properties: ['openFile'],
    filters: [
      { name: 'Tất cả file', extensions: ['*'] },
      { name: 'Tài liệu', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'] },
      { name: 'Hình ảnh', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
      { name: 'Video', extensions: ['mp4', 'avi', 'mkv', 'mov'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const stat = fs.statSync(filePath);
  return { filePath, fileName, fileSize: stat.size };
});

// Gửi file tới học sinh theo cơ chế chunk (có destFolder)
const CHUNK_SIZE = 256 * 1024; // 256 KB mỗi chunk
ipcMain.handle('teacher:send-file', async (_, { studentId, filePath, fileName, destFolder }) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const target = studentId === 'all' ? io.to('students') : io.to(studentId);

    // Thông báo bắt đầu (kèm destFolder)
    target.emit('file:start', { fileId, fileName, totalChunks, fileSize: buffer.length, destFolder: destFolder || 'EduManager' });

    // Gửi từng chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const chunk = buffer.slice(start, start + CHUNK_SIZE);
      target.emit('file:chunk', { fileId, chunkIndex: i, totalChunks, chunk: chunk.toString('base64') });
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      notifyRenderer('file:progress', { fileId, fileName, progress });
      await new Promise(resolve => setImmediate(resolve));
    }

    target.emit('file:done', { fileId, fileName });
    notifyRenderer('file:progress', { fileId, fileName, progress: 100, done: true });
    return { success: true };
  } catch (err) {
    console.error('[Teacher] Lỗi gửi file:', err.message);
    return { success: false, error: err.message };
  }
});

// Chọn thư mục thu bài
ipcMain.handle('teacher:open-save-dir-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn thư mục để thu bài nộp',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  submissionSaveDir = result.filePaths[0];
  return submissionSaveDir;
});
ipcMain.handle('teacher:get-save-dir', () => submissionSaveDir);
ipcMain.handle('teacher:open-submission-folder', () => {
  shell.openPath(submissionSaveDir);
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