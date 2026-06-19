const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const START_MARKER = '# EduManager Block Start';
const END_MARKER = '# EduManager Block End';

/**
 * Đọc nội dung file hosts
 */
function readHosts() {
  try {
    if (!fs.existsSync(HOSTS_PATH)) return '';
    return fs.readFileSync(HOSTS_PATH, 'utf8');
  } catch (err) {
    console.error('[HostsManager] Lỗi đọc file hosts:', err.message);
    return null;
  }
}

/**
 * Ghi nội dung vào file hosts
 */
function writeHosts(content) {
  try {
    // Đảm bảo không bị Read-Only bằng lệnh hệ thống của Windows
    try {
      execSync(`attrib -R "${HOSTS_PATH}"`, { windowsHide: true });
    } catch (e) {}
    
    fs.writeFileSync(HOSTS_PATH, content, 'utf8');
    return true;
  } catch (err) {
    console.error('[HostsManager] Lỗi ghi file hosts (Cần quyền Admin):', err.message);
    return false;
  }
}

/**
 * Xóa sạch các block cũ của EduManager
 */
function clearOldBlocks(content) {
  const lines = content.split(/\r?\n/);
  const newLines = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.trim() === START_MARKER) {
      inBlock = true;
      continue;
    }
    if (line.trim() === END_MARKER) {
      inBlock = false;
      continue;
    }
    if (!inBlock) {
      newLines.push(line);
    }
  }

  // Xóa các dòng trống ở cuối file
  while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
    newLines.pop();
  }

  return newLines.join('\r\n');
}

/**
 * Cập nhật file hosts để chặn danh sách domains
 * @param {string[]} domains Mảng các domain (vd: ['facebook.com', 'youtube.com'])
 */
function blockWebsites(domains) {
  if (process.platform !== 'win32') return false;

  const currentContent = readHosts();
  if (currentContent === null) return false;

  // Xóa các block cũ trước
  let cleanContent = clearOldBlocks(currentContent);

  // Nếu mảng rỗng, chỉ cần ghi lại cleanContent là đủ (tương đương unblock)
  if (!domains || domains.length === 0) {
    const success = writeHosts(cleanContent);
    flushDns();
    return success;
  }

  // Tạo block mới
  let blockContent = `\r\n${START_MARKER}\r\n`;
  for (const domain of domains) {
    const cleanDomain = domain.trim().toLowerCase();
    if (cleanDomain) {
      blockContent += `127.0.0.1 ${cleanDomain}\r\n`;
      if (!cleanDomain.startsWith('www.')) {
        blockContent += `127.0.0.1 www.${cleanDomain}\r\n`;
      }
    }
  }
  blockContent += `${END_MARKER}\r\n`;

  // Ghi đè file
  const finalContent = cleanContent + blockContent;
  const success = writeHosts(finalContent);
  if (success) {
    console.log(`[HostsManager] Đã chặn ${domains.length} websites.`);
    flushDns();
  }
  return success;
}

/**
 * Hủy chặn tất cả
 */
function unblockAllWebsites() {
  if (process.platform !== 'win32') return false;

  const currentContent = readHosts();
  if (currentContent === null) return false;

  const cleanContent = clearOldBlocks(currentContent);
  const success = writeHosts(cleanContent);
  
  if (success) {
    console.log('[HostsManager] Đã gỡ chặn toàn bộ website.');
    flushDns();
  }
  return success;
}

/**
 * Flush DNS để áp dụng ngay lập tức
 */
function flushDns() {
  exec('ipconfig /flushdns', { windowsHide: true }, (err) => {
    if (err) console.error('[HostsManager] Lỗi flushdns:', err.message);
    else console.log('[HostsManager] Đã xóa cache DNS.');
  });
}

module.exports = {
  blockWebsites,
  unblockAllWebsites
};
