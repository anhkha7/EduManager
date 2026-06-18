// Script để chờ Vite server khởi động rồi mới mở Electron
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const VITE_PORT = 5173;
const MAX_ATTEMPTS = 30;

function checkServer(port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve();
    });
    req.on('error', () => {
      if (attempt >= MAX_ATTEMPTS) {
        reject(new Error(`Vite server chưa sẵn sàng sau ${MAX_ATTEMPTS} lần thử`));
      } else {
        setTimeout(() => checkServer(port, attempt + 1).then(resolve).catch(reject), 1000);
      }
    });
    req.setTimeout(1000, () => {
      req.destroy();
      setTimeout(() => checkServer(port, attempt + 1).then(resolve).catch(reject), 500);
    });
  });
}

console.log(`[Electron] Đang chờ Vite server (port ${VITE_PORT})...`);

checkServer(VITE_PORT).then(() => {
  console.log('[Electron] Vite sẵn sàng! Đang khởi động Electron...');
  
  const proc = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['electron', '.'],
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    }
  );

  proc.on('close', (code) => {
    console.log(`[Electron] Đã đóng với mã: ${code}`);
    process.exit(code || 0);
  });
}).catch((err) => {
  console.error('[Electron] Lỗi:', err.message);
  process.exit(1);
});
