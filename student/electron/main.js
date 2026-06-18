'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { io } = require('socket.io-client');
const { execSync, spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════
let Store;
try {
  Store = require('electron-store');
} catch (e) {
  // fallback: simple in-memory store
  Store = class {
    constructor() { this._data = {}; }
    get(k, d) { return this._data[k] ?? d; }
    set(k, v) { this._data[k] = v; }
  };
}

const store = new Store();

// ═══════════════════════════════════════════════════════════════
//  WINDOWS
// ═══════════════════════════════════════════════════════════════
let setupWindow = null;   // Cửa sổ cài đặt / tray menu
let lockWindow = null;    // Overlay khóa màn hình
let broadcastWindow = null; // Overlay broadcast
let tray = null;
let blockerProcess = null; // Tiến trình chặn phím ngầm (C#)

let socket = null;
let screenCaptureInterval = null;
let isConnected = false;

// ═══════════════════════════════════════════════════════════════
//  BLOCK KEYS COMPILATION (C#)
// ═══════════════════════════════════════════════════════════════
function compileBlockKeys() {
  if (process.platform !== 'win32') return;
  const sourcePath = path.join(__dirname, 'BlockKeys.cs');
  const exePath = path.join(__dirname, 'BlockKeys.exe');

  if (!fs.existsSync(sourcePath)) {
    console.error('[Student] Không tìm thấy BlockKeys.cs');
    return;
  }

  if (fs.existsSync(exePath)) {
    return;
  }

  console.log('[Student] Đang biên dịch BlockKeys.cs...');
  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
  if (!fs.existsSync(cscPath)) {
    console.error('[Student] Không tìm thấy csc.exe. Bỏ qua chặn bàn phím nâng cao.');
    return;
  }

  try {
    execSync(`"${cscPath}" /target:winexe /out:"${exePath}" "${sourcePath}"`, { stdio: 'ignore' });
    console.log('[Student] Biên dịch thành công BlockKeys.exe');
  } catch (err) {
    console.error('[Student] Lỗi biên dịch BlockKeys.cs:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SETUP WINDOW
// ═══════════════════════════════════════════════════════════════
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 480,
    height: 560,
    resizable: false,
    frame: false,
    backgroundColor: '#070b14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    setupWindow.loadURL('http://localhost:5174');
  } else {
    setupWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  setupWindow.on('closed', () => { setupWindow = null; });
}

// ═══════════════════════════════════════════════════════════════
//  LOCK SCREEN WINDOW
// ═══════════════════════════════════════════════════════════════
function createLockWindow(message) {
  if (lockWindow) {
    lockWindow.webContents.send('update-message', message);
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().bounds;

  lockWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    fullscreen: true,
    kiosk: true, // Chế độ kiosk: khóa ứng dụng toàn màn hình, ngăn người dùng thoát
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    transparent: false,
    backgroundColor: '#070b14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  lockWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  lockWindow.setVisibleOnAllWorkspaces(true);

  if (isDev) {
    lockWindow.loadURL(`http://localhost:5174/#lock?msg=${encodeURIComponent(message)}`);
  } else {
    lockWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      hash: `lock?msg=${encodeURIComponent(message)}`
    });
  }

  // Ngăn đóng bằng keyboard
  lockWindow.on('close', (e) => {
    if (!lockWindow._allowClose) e.preventDefault();
  });

  // Ép focus liên tục nếu mất focus (tránh Alt+Tab hoặc click ra ngoài bằng cách nào đó)
  lockWindow.on('blur', () => {
    if (lockWindow) lockWindow.focus();
  });

  // Chạy file chặn phím ngầm (C#) để chặn hoàn toàn Alt+Tab, Win, Ctrl+Esc, v.v.
  if (process.platform === 'win32') {
    const exePath = path.join(__dirname, 'BlockKeys.exe');
    if (fs.existsSync(exePath)) {
      try {
        blockerProcess = spawn(exePath);
        console.log('[Student] Đã khởi chạy BlockKeys.exe (PID:', blockerProcess.pid, ')');
      } catch (err) {
        console.error('[Student] Không thể chạy BlockKeys.exe:', err.message);
      }
    }
  }

  // Vô hiệu hóa các tổ hợp phím tắt hệ thống trong Electron (phòng hờ)
  try {
    globalShortcut.register('Alt+Tab', () => {});
    globalShortcut.register('CommandOrControl+Tab', () => {});
    globalShortcut.register('CommandOrControl+Esc', () => {});
    globalShortcut.register('Alt+F4', () => {});
    globalShortcut.register('Super', () => {});
    globalShortcut.register('Super+D', () => {});
    globalShortcut.register('Super+M', () => {});
    globalShortcut.register('Super+Tab', () => {});
    globalShortcut.register('Alt+Esc', () => {});
  } catch (e) {
    console.log('[Student] Không thể đăng ký một số phím tắt khóa:', e);
  }

  lockWindow.on('closed', () => { lockWindow = null; });
}

function closeLockWindow() {
  if (lockWindow) {
    lockWindow._allowClose = true;
    lockWindow.close();
    lockWindow = null;
    
    // Gỡ các phím tắt đã bị khóa
    globalShortcut.unregisterAll();
  }

  // Tắt tiến trình chặn phím ngầm C#
  if (blockerProcess) {
    try {
      blockerProcess.kill();
      console.log('[Student] Đã dừng BlockKeys.exe');
    } catch (err) {
      console.error('[Student] Lỗi khi dừng BlockKeys.exe:', err.message);
    }
    blockerProcess = null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  BROADCAST WINDOW
// ═══════════════════════════════════════════════════════════════
function createBroadcastWindow() {
  if (broadcastWindow) return;

  const { width, height } = screen.getPrimaryDisplay().bounds;

  broadcastWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  broadcastWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  if (isDev) {
    broadcastWindow.loadURL('http://localhost:5174/#broadcast');
  } else {
    broadcastWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      hash: 'broadcast'
    });
  }

  broadcastWindow.on('close', (e) => {
    if (!broadcastWindow._allowClose) e.preventDefault();
  });

  broadcastWindow.on('closed', () => { broadcastWindow = null; });
}

function closeBroadcastWindow() {
  if (broadcastWindow) {
    broadcastWindow._allowClose = true;
    broadcastWindow.close();
    broadcastWindow = null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SOCKET.IO CLIENT — Kết nối tới server của giáo viên
// ═══════════════════════════════════════════════════════════════
function connectToServer(serverIp, serverPort) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const url = `http://${serverIp}:${serverPort}`;
  console.log(`[Student] Đang kết nối tới: ${url}`);

  socket = io(url, {
    timeout: 8000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 10000
  });

  socket.on('connect', () => {
    isConnected = true;
    console.log('[Student] Đã kết nối tới server!');

    // Gửi thông tin học sinh
    socket.emit('student:join', {
      name: store.get('studentName', os.hostname()),
      computerName: os.hostname()
    });

    // Bắt đầu gửi thumbnail
    startScreenCapture();

    // Thông báo cho setup window
    if (setupWindow) setupWindow.webContents.send('connection-status', { connected: true });
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    console.log('[Student] Mất kết nối:', reason);
    stopScreenCapture();
    if (setupWindow) setupWindow.webContents.send('connection-status', { connected: false, reason });
  });

  socket.on('connect_error', (err) => {
    isConnected = false;
    console.log('[Student] Lỗi kết nối:', err.message);
    if (setupWindow) setupWindow.webContents.send('connection-status', { connected: false, error: err.message });
  });

  // ── Nhận lệnh từ giáo viên ─────────────────────────────────
  socket.on('command:lock', ({ message }) => {
    console.log('[Student] Nhận lệnh khóa màn hình');
    closeBroadcastWindow();
    createLockWindow(message);
  });

  socket.on('command:unlock', () => {
    console.log('[Student] Nhận lệnh mở khóa');
    closeLockWindow();
    closeBroadcastWindow();
  });

  socket.on('broadcast:start', () => {
    console.log('[Student] Nhận lệnh bắt đầu broadcast');
    closeLockWindow(); // Đóng lock nếu đang mở
    createBroadcastWindow();
  });

  socket.on('broadcast:stream-start', () => {
    console.log('[Student Socket] Nhận stream-start từ teacher');
    if (broadcastWindow && !broadcastWindow.isDestroyed()) {
      broadcastWindow.webContents.send('stream:start');
    }
  });

  socket.on('broadcast:stream-chunk', (chunk) => {
    if (broadcastWindow && !broadcastWindow.isDestroyed()) {
      broadcastWindow.webContents.send('stream:chunk', chunk);
    }
  });

  socket.on('broadcast:stop', () => {
    console.log('[Student] Nhận lệnh dừng broadcast');
    closeBroadcastWindow();
  });

  socket.on('chat:message', ({ from, message, time }) => {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.webContents.send('chat-received', { from, message, time });
    }
    // Hiện trên lockscreen nếu đang khóa
    if (lockWindow && !lockWindow.isDestroyed()) {
      lockWindow.webContents.send('chat-received', { from, message, time });
    }
  });

  // ── File Transfer (Nhận file từ giáo viên) ─────────────────────
  const fileBuffers = new Map(); // fileId -> { fileName, chunks: [], totalChunks }

  socket.on('file:start', ({ fileId, fileName, totalChunks, fileSize, destFolder }) => {
    console.log(`[Student] Bắt đầu nhận file: ${fileName} (${totalChunks} chunks, destFolder=${destFolder})`);
    fileBuffers.set(fileId, { fileName, totalChunks, chunks: [], destFolder: destFolder || 'EduManager' });
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.webContents.send('file-receiving', { fileName, fileSize });
    }
  });

  socket.on('file:chunk', ({ fileId, chunkIndex, chunk }) => {
    const entry = fileBuffers.get(fileId);
    if (!entry) return;
    entry.chunks[chunkIndex] = Buffer.from(chunk, 'base64');
  });

  socket.on('file:done', async ({ fileId, fileName }) => {
    const entry = fileBuffers.get(fileId);
    if (!entry) return;
    fileBuffers.delete(fileId);

    try {
      const completeBuffer = Buffer.concat(entry.chunks.filter(Boolean));

      // Giải quyết thư mục lưu dựa theo destFolder
      const home = os.homedir();
      let saveDir;
      switch (entry.destFolder) {
        case 'Desktop':   saveDir = path.join(home, 'Desktop'); break;
        case 'Documents': saveDir = path.join(home, 'Documents'); break;
        case 'Downloads': saveDir = path.join(home, 'Downloads'); break;
        case 'EduManager': saveDir = path.join(home, 'Downloads', 'EduManager'); break;
        default: saveDir = path.join(home, 'Downloads', 'EduManager', entry.destFolder); break;
      }

      await fs.promises.mkdir(saveDir, { recursive: true });
      const savePath = path.join(saveDir, fileName);
      await fs.promises.writeFile(savePath, completeBuffer);
      console.log(`[Student] Đã lưu file: ${savePath}`);

      const studentName = store.get('studentName', os.hostname());
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('file-received', { fileName, savePath, fileSize: completeBuffer.length, destFolder: entry.destFolder });
      }
      socket.emit('file:received-ack', { fileId, fileName, studentName });
    } catch (err) {
      console.error('[Student] Lỗi lưu file:', err.message);
    }
  });

  // Nhận xác nhận giáo viên đã lưu bài nộp
  socket.on('submit:ack', ({ fileId, fileName }) => {
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.webContents.send('submit:ack', { fileId, fileName });
    }
  });

  socket.on('teacher:disconnect', () => {
    console.log('[Student] Giáo viên đã ngắt kết nối');
    closeLockWindow();
    closeBroadcastWindow();
  });
}

// ═══════════════════════════════════════════════════════════════
//  SCREEN CAPTURE — Chụp và gửi thumbnail mỗi 3 giây
// ═══════════════════════════════════════════════════════════════
const { desktopCapturer } = require('electron');

function startScreenCapture() {
  if (screenCaptureInterval) return;

  screenCaptureInterval = setInterval(async () => {
    if (!socket || !isConnected) return;
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 480, height: 300 }
      });

      if (sources.length > 0) {
        const image = sources[0].thumbnail.toDataURL('image/jpeg');
        socket.emit('student:thumbnail', { image });
      }
    } catch (err) {
      // Bỏ qua lỗi chụp màn hình
    }
  }, 3000);
}

function stopScreenCapture() {
  if (screenCaptureInterval) {
    clearInterval(screenCaptureInterval);
    screenCaptureInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  IPC HANDLERS
// ═══════════════════════════════════════════════════════════════

// Lấy cài đặt đã lưu
ipcMain.handle('get-settings', () => ({
  serverIp: store.get('serverIp', ''),
  serverPort: store.get('serverPort', 3722),
  studentName: store.get('studentName', os.hostname()),
  isConnected
}));

// Kết nối tới server
ipcMain.handle('connect', (_, { serverIp, serverPort, studentName }) => {
  store.set('serverIp', serverIp);
  store.set('serverPort', serverPort || 3722);
  store.set('studentName', studentName || os.hostname());
  connectToServer(serverIp, serverPort || 3722);
  return { success: true };
});

// Ngắt kết nối
ipcMain.handle('disconnect', () => {
  if (socket) socket.disconnect();
  stopScreenCapture();
  isConnected = false;
  return { success: true };
});

// Gửi chat từ học sinh tới giáo viên
ipcMain.handle('send-chat', (_, { message }) => {
  if (socket && isConnected) {
    socket.emit('student:chat', { message });
  }
});



// Gửi bài nộp từ học sinh tới giáo viên
ipcMain.handle('student:submit-file', async () => {
  if (!socket || !isConnected) return { success: false, error: 'Chưa kết nối' };

  // Mở hộp thoại chọn file
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(setupWindow, {
    title: 'Chọn file để nộp bài',
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const studentName = store.get('studentName', os.hostname());

  try {
    const buffer = fs.readFileSync(filePath);
    const CHUNK_SIZE = 256 * 1024;
    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    socket.emit('student:submit-start', { fileId, fileName, totalChunks, fileSize: buffer.length, studentName });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const chunk = buffer.slice(start, start + CHUNK_SIZE);
      socket.emit('student:submit-chunk', { fileId, chunkIndex: i, chunk: chunk.toString('base64') });
      await new Promise(resolve => setImmediate(resolve));
    }

    socket.emit('student:submit-done', { fileId });
    return { success: true, fileName };
  } catch (err) {
    console.error('[Student] Lỗi nộp bài:', err.message);
    return { success: false, error: err.message };
  }
});

// Window controls
ipcMain.handle('window:minimize', () => setupWindow?.minimize());
ipcMain.handle('window:close', () => {
  // Ẩn xuống tray thay vì đóng
  setupWindow?.hide();
});

// ═══════════════════════════════════════════════════════════════
//  SYSTEM TRAY
// ═══════════════════════════════════════════════════════════════
function createTray() {
  // Tạo icon đơn giản bằng NativeImage
  const iconData = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill="#3b82f6"/>
      <text x="8" y="12" text-anchor="middle" fill="white" font-size="10" font-family="Arial">E</text>
    </svg>`
  );

  let icon;
  try {
    icon = nativeImage.createFromBuffer(iconData);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('EduManager - Học sinh');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mở EduManager', click: () => { setupWindow?.show(); } },
    { type: 'separator' },
    { label: 'Thoát', click: () => { app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { setupWindow?.show(); });
}

// ═══════════════════════════════════════════════════════════════
//  APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════
app.whenReady().then(() => {
  compileBlockKeys();
  createSetupWindow();
  createTray();

  // Tự động kết nối nếu đã có cài đặt
  const savedIp = store.get('serverIp', '');
  const savedPort = store.get('serverPort', 3722);
  if (savedIp) {
    setTimeout(() => connectToServer(savedIp, savedPort), 1500);
  }
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Giữ ứng dụng chạy trong tray
});

app.on('before-quit', () => {
  if (socket) socket.disconnect();
  stopScreenCapture();
  if (blockerProcess) {
    try { blockerProcess.kill(); } catch (e) {}
  }
});
