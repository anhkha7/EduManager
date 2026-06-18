'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const os = require('os');
const { io } = require('socket.io-client');

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

let socket = null;
let screenCaptureInterval = null;
let isConnected = false;

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

  lockWindow.on('closed', () => { lockWindow = null; });
}

function closeLockWindow() {
  if (lockWindow) {
    lockWindow._allowClose = true;
    lockWindow.close();
    lockWindow = null;
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

  socket.on('webrtc:offer', ({ offer }) => {
    if (broadcastWindow && !broadcastWindow.isDestroyed()) {
      broadcastWindow.webContents.send('webrtc:offer', { offer });
    }
  });

  socket.on('webrtc:ice-candidate', ({ candidate }) => {
    if (broadcastWindow && !broadcastWindow.isDestroyed()) {
      broadcastWindow.webContents.send('webrtc:ice-candidate', { candidate });
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

// ── WebRTC Signaling (Student -> Teacher) ──────────────────────
ipcMain.handle('student:webrtc-join', () => {
  if (socket && isConnected) socket.emit('webrtc:join-broadcast');
});
ipcMain.handle('student:webrtc-answer', (_, { answer }) => {
  if (socket && isConnected) socket.emit('webrtc:answer', { answer });
});
ipcMain.handle('student:webrtc-ice-candidate', (_, { candidate }) => {
  if (socket && isConnected) socket.emit('webrtc:ice-candidate', { candidate });
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
});
