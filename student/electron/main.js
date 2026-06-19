'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { io } = require('socket.io-client');
const { execSync, spawn } = require('child_process');
const hostsManager = require('./hostsManager');

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
let setupWindow = null;      // Cửa sổ cài đặt / tray menu
let lockWindow = null;       // Overlay khóa màn hình
let broadcastWindow = null;  // Overlay broadcast
let tray = null;
let blockerProcess = null;   // Tiến trình chặn phím ngầm (C#)
let inputSimulatorProcess = null; // Tiến trình giả lập chuột/phím (C#)

let socket = null;
let screenCaptureInterval = null;
let isConnected = false;

// APP MONITOR STATE
let appMonitorInterval = null;
let appBlockRules = [];      // Mảng từ khóa cần chặn (chữ thường)
let appBlockMode = 'kill';   // 'kill' | 'warn'
let isMonitoring = false;
let lastViolations = new Set(); // Tránh gửi trùng lặp

// WEB BLOCK STATE
let webBlockRules = [];
let isWebMonitoring = false;

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
//  INPUT SIMULATOR COMPILATION (C#)
// ═══════════════════════════════════════════════════════════════
function compileInputSimulator() {
  if (process.platform !== 'win32') return;
  const sourcePath = path.join(__dirname, 'InputSimulator.cs');
  const exePath = path.join(__dirname, 'InputSimulator.exe');

  if (!fs.existsSync(sourcePath)) return;
  if (fs.existsSync(exePath)) return;

  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
  if (!fs.existsSync(cscPath)) return;

  try {
    execSync(`"${cscPath}" /target:exe /out:"${exePath}" "${sourcePath}"`, { stdio: 'ignore' });
    console.log('[Student] Biên dịch thành công InputSimulator.exe');
  } catch (err) {
    console.error('[Student] Lỗi biên dịch InputSimulator.cs:', err.message);
  }
}

function startInputSimulator() {
  if (inputSimulatorProcess) return;
  const exePath = path.join(__dirname, 'InputSimulator.exe');
  if (fs.existsSync(exePath)) {
    try {
      inputSimulatorProcess = spawn(exePath);
      console.log('[Student] Đã chạy InputSimulator.exe (PID:', inputSimulatorProcess.pid, ')');
    } catch(e) {
      console.error('[Student] Không thể chạy InputSimulator.exe:', e.message);
    }
  }
}

function stopInputSimulator() {
  if (inputSimulatorProcess) {
    try {
      inputSimulatorProcess.kill();
    } catch(e) {}
    inputSimulatorProcess = null;
  }
}

function sendInputEvent(commandStr) {
  if (inputSimulatorProcess && inputSimulatorProcess.stdin && !inputSimulatorProcess.killed) {
    try {
      inputSimulatorProcess.stdin.write(commandStr + '\n');
    } catch(e) {
      // Bỏ qua lỗi broken pipe nếu tiến trình đã chết
    }
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

  // ── Nhận lệnh từ giáo viên ─────────────────────────────────────
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
    stopAppMonitor(); // Dừng giám sát khi giáo viên thoát
    stopInputSimulator();
    if (screenCaptureInterval) {
      clearInterval(screenCaptureInterval);
      screenCaptureInterval = null;
      startScreenCapture(); // Reset FPS
    }
  });

  // ── Nhận lệnh điều khiển (Remote Control) ──────────────────────────
  socket.on('command:remote-control', ({ enabled }) => {
    console.log(`[Student] Remote Control: ${enabled}`);
    if (enabled) {
      // Tăng FPS chụp màn hình lên ~5-8 FPS (150ms)
      if (screenCaptureInterval) clearInterval(screenCaptureInterval);
      screenCaptureInterval = setInterval(async () => {
        if (!socket || !isConnected) return;
        try {
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1280, height: 720 } // Ảnh lớn hơn chút cho Remote Control
          });
          if (sources.length > 0) {
            socket.emit('student:thumbnail', { image: sources[0].thumbnail.toDataURL('image/jpeg', 0.6) });
          }
        } catch (err) {}
      }, 150);
      
      startInputSimulator();
    } else {
      // Khôi phục chụp màn hình 3s
      if (screenCaptureInterval) clearInterval(screenCaptureInterval);
      screenCaptureInterval = null;
      stopInputSimulator();
      startScreenCapture();
    }
  });

  socket.on('command:remote-input', (cmd) => {
    // Truyền thẳng lệnh sang C# thông qua stdin
    sendInputEvent(cmd);
  });

  // ── Nhận lệnh kiểm soát ứng dụng ──────────────────────────────
  socket.on('command:app-block', ({ enabled, rules, mode }) => {
    if (enabled) {
      appBlockRules = Array.isArray(rules) ? rules : [];
      appBlockMode = mode || 'kill';
      stopAppMonitor(); // Reset trước khi bắt đầu lại
      if (appBlockRules.length > 0) {
        startAppMonitor();
      } else {
        // Enabled nhưng không có rules — chỉ cập nhật trạng thái
        isMonitoring = true;
        notifySetup('app-block-status', { monitoring: true, rules: [], mode: appBlockMode });
      }
      console.log(`[Student] Bật giám sát App: ${appBlockRules.length} từ khóa, chế độ: ${appBlockMode}`);
    } else {
      stopAppMonitor();
      appBlockRules = [];
      console.log('[Student] Tắt giám sát App');
    }
  });

  // ── Nhận lệnh kiểm soát Website ───────────────────────────────
  socket.on('command:web-block', ({ enabled, domains }) => {
    if (enabled) {
      webBlockRules = Array.isArray(domains) ? domains : [];
      isWebMonitoring = true;
      const success = hostsManager.blockWebsites(webBlockRules);
      
      notifySetup('web-block-status', { monitoring: true, rules: webBlockRules });
      console.log(`[Student] Bật khóa Web: ${webBlockRules.length} domains. Success=${success}`);
      
      if (!success) {
        // Có thể do thiếu quyền Admin
        if (setupWindow && !setupWindow.isDestroyed()) {
          setupWindow.webContents.send('app-violation-detected', { 
            keyword: 'LỖI: Cần quyền Administrator để khóa Web!', 
            mode: 'warn' 
          });
        }
      }
      
      if (webBlockRules.length > 0 || appBlockRules.length > 0) {
        startAppMonitor();
      }
    } else {
      hostsManager.unblockAllWebsites();
      webBlockRules = [];
      isWebMonitoring = false;
      notifySetup('web-block-status', { monitoring: false, rules: [] });
      console.log('[Student] Đã tắt khóa Web');
      
      if (appBlockRules.length === 0) {
        stopAppMonitor();
      }
    }
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
//  APP MONITOR ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Lấy danh sách TÊN tiến trình đang chạy bằng lệnh tasklist (Windows)
 * @returns {Promise<string[]>} mảng tên process (chữ thường, không có .exe)
 */
function getRunningProcessNames() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const { exec } = require('child_process');
    exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      if (err) return resolve([]);
      // Mỗi dòng: "process.exe","PID","Session","SessionNum","MemUsage"
      const names = stdout.split('\n')
        .map(line => {
          const parts = line.split(',');
          if (parts.length < 1) return null;
          return parts[0].replace(/"/g, '').toLowerCase().replace(/\.exe$/, '');
        })
        .filter(Boolean);
      resolve(names);
    });
  });
}

/**
 * Lấy danh sách TIÊU ĐỀ cửa sổ đang mở bằng PowerShell
 * @returns {Promise<string[]>} mảng title cửa sổ (chữ thường)
 */
function getWindowTitles() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const { exec } = require('child_process');
    const cmd = `powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle"`;
    exec(cmd, { windowsHide: true, timeout: 3000 }, (err, stdout) => {
      if (err) return resolve([]);
      const titles = stdout.split('\n')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      resolve(titles);
    });
  });
}

/**
 * Bắt đầu vòng lặp giám sát ứng dụng/website
 */
function startAppMonitor() {
  if (appMonitorInterval) return; // Đã chạy rồi
  isMonitoring = true;
  console.log('[Student] Bắt đầu giám sát. Rules:', appBlockRules, 'Mode:', appBlockMode);
  notifySetup('app-block-status', { monitoring: true, rules: appBlockRules, mode: appBlockMode });

  appMonitorInterval = setInterval(async () => {
    if (appBlockRules.length === 0 && webBlockRules.length === 0) return;

    const [processNames, windowTitles] = await Promise.all([
      getRunningProcessNames(),
      getWindowTitles()
    ]);

    const violations = [];

    // --- 1. Kiểm tra luật khóa App ---
    for (const keyword of appBlockRules) {
      const kw = keyword.toLowerCase().trim();
      if (!kw) continue;

      const matchedProcess = processNames.find(p => p.includes(kw));
      const matchedTitle = windowTitles.find(t => t.includes(kw));

      if (matchedProcess || matchedTitle) {
        const violationKey = matchedProcess || matchedTitle;
        if (!lastViolations.has(violationKey)) {
          violations.push({ keyword: kw, process: matchedProcess, title: matchedTitle });
          lastViolations.add(violationKey);
          // Tăng thời gian chờ lên 30s để học sinh có đủ thời gian thao tác đóng ứng dụng (tránh bị khóa lại ngay lập tức)
          setTimeout(() => lastViolations.delete(violationKey), 30000);
        }
      }
    }

    // --- 2. Kiểm tra luật khóa Web (Window Title Check - Layer 2 fallback) ---
    for (const domain of webBlockRules) {
      const kw = domain.toLowerCase().trim();
      if (!kw) continue;
      
      // Lấy tên miền cơ bản (bỏ http, www, .com) để bắt title tốt hơn
      // VD: facebook.com -> facebook
      const baseDomain = kw.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0]; 
      
      const matchedTitle = windowTitles.find(t => t.includes(baseDomain));
      if (matchedTitle) {
        const violationKey = 'web-' + matchedTitle;
        if (!lastViolations.has(violationKey)) {
          violations.push({ keyword: kw, process: null, title: matchedTitle, isWeb: true });
          lastViolations.add(violationKey);
          setTimeout(() => lastViolations.delete(violationKey), 30000);
        }
      }
    }

    for (const v of violations) {
      console.log(`[Student] Vi phạm: keyword="${v.keyword}" process="${v.process}" title="${v.title}"`);

      // Thông báo lên giáo viên
      if (socket && isConnected) {
        const studentName = store.get('studentName', os.hostname());
        socket.emit('student:app-violation', {
          keyword: v.keyword,
          process: v.process || '',
          windowTitle: v.title || '',
          studentName,
          mode: appBlockMode,
          time: Date.now()
        });
      }

      // Nếu là vi phạm Web Block, LUÔN LUÔN KILL cửa sổ trình duyệt (Layer 2)
      if (v.isWeb || appBlockMode === 'kill') {
        const { exec } = require('child_process');
        if (v.process) {
          exec(`taskkill /F /IM "${v.process}.exe"`, { windowsHide: true }, (err) => {
            if (err) console.log(`[Student] taskkill lỗi: ${err.message}`);
            else console.log(`[Student] Đã đóng: ${v.process}.exe`);
          });
        }
        if (v.title) {
          // Thoát dấu nháy đơn cho powershell
          const safeTitle = v.keyword.replace(/'/g, "''");
          // Bắt theo title thay vì process
          const safeBase = v.isWeb ? v.keyword.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0].replace(/'/g, "''") : safeTitle;
          const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeBase}*' } | Stop-Process -Force"`;
          exec(psCmd, { windowsHide: true }, (err) => {
            if (err) console.log(`[Student] powershell kill lỗi: ${err.message}`);
            else console.log(`[Student] Đã đóng cửa sổ chứa từ khóa: ${safeBase}`);
          });
        }
        
        if (!v.isWeb) {
          notifySetup('app-violation-detected', { ...v, mode: 'kill' });
        }
      } else if (appBlockMode === 'warn' && !v.isWeb) {
        // Hiện cửa sổ cảnh báo overlay (không khóa hoàn toàn)
        const warnMsg = `⛔ Ứng dụng bị cấm!\n\nBạn đang mở "${v.keyword}".\nMàn hình sẽ được mở khóa sau 8 giây.\n\nVUI LÒNG ĐÓNG ỨNG DỤNG ĐÓ NGAY LẬP TỨC!`;
        createLockWindow(warnMsg);
        
        // Tự đóng cảnh báo sau 8 giây
        setTimeout(() => {
          closeLockWindow();
        }, 8000);
        notifySetup('app-violation-detected', { ...v, mode: 'warn' });
      }
    }
  }, 2000); // Kiểm tra mỗi 2 giây
}

/**
 * Dừng vòng lặp giám sát
 */
function stopAppMonitor() {
  if (appMonitorInterval) {
    clearInterval(appMonitorInterval);
    appMonitorInterval = null;
  }
  isMonitoring = false;
  lastViolations.clear();
  console.log('[Student] Đã dừng giám sát');
  notifySetup('app-block-status', { monitoring: false, rules: [], mode: 'kill' });
}

/**
 * Helper: gửi sự kiện tới setupWindow
 */
function notifySetup(channel, data) {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.webContents.send(channel, data);
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

// Window controls
ipcMain.handle('window:minimize', () => {
  if (setupWindow) setupWindow.minimize();
});

ipcMain.handle('window:close', () => {
  if (setupWindow) {
    setupWindow.hide();
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

// Lấy trạng thái giám sát ứng dụng
ipcMain.handle('get-monitor-status', () => ({
  monitoring: isMonitoring,
  rules: appBlockRules,
  mode: appBlockMode
}));

// Lấy trạng thái khóa Web
ipcMain.handle('get-web-monitor-status', () => ({
  monitoring: isWebMonitoring,
  rules: webBlockRules
}));

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
  compileInputSimulator();
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
  stopAppMonitor();
  hostsManager.unblockAllWebsites(); // Dọn dẹp file hosts
  if (blockerProcess) {
    try { blockerProcess.kill(); } catch (e) {}
  }
});
