const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logs = [];
let logFilePath = '';

function initLogger() {
  const userDataPath = app.getPath('userData');
  logFilePath = path.join(userDataPath, 'edumanager-session.log');
  
  // Xóa log cũ mỗi khi khởi động (chỉ giữ log phiên hiện tại để đỡ nặng máy)
  if (fs.existsSync(logFilePath)) {
    try {
      fs.unlinkSync(logFilePath);
    } catch(e) {}
  }
}

function logEvent(type, message, studentName = 'Hệ thống') {
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    type, // 'system' | 'connect' | 'disconnect' | 'violation' | 'command' | 'file'
    studentName,
    message
  };
  
  logs.push(logEntry);
  
  // Ghi thêm vào file backup
  const timeStr = new Date(logEntry.timestamp).toLocaleString('vi-VN');
  const logLine = `[${timeStr}] [${type.toUpperCase()}] [${studentName}] ${message}\n`;
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch(e) {}
  }
  
  return logEntry;
}

function getLogs() {
  return logs;
}

function clearLogs() {
  logs = [];
  if (fs.existsSync(logFilePath)) {
    try {
      fs.writeFileSync(logFilePath, '', 'utf8');
    } catch(e) {}
  }
}

function exportLogsAsCSV(destPath) {
  const header = 'Thời gian,Loại sự kiện,Đối tượng,Nội dung\n';
  const rows = logs.map(l => {
    const time = new Date(l.timestamp).toLocaleString('vi-VN');
    return `"${time}","${l.type}","${l.studentName}","${l.message}"`;
  }).join('\n');
  
  fs.writeFileSync(destPath, header + rows, 'utf8');
}

module.exports = {
  initLogger,
  logEvent,
  getLogs,
  clearLogs,
  exportLogsAsCSV
};
