import { useState, useEffect, useRef } from 'react';

export default function LogsPanel({ show, onClose, addToast }) {
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterText, setFilterText] = useState('');
  const logsEndRef = useRef(null);

  const api = window.electronAPI;

  useEffect(() => {
    // Load initial logs
    api.getLogs().then(setLogs);

    // Listen for new logs
    api.onNewLog((newLog) => {
      setLogs(prev => [...prev, newLog]);
    });

    return () => {
      api.removeAllListeners('log:new');
    };
  }, []);

  // Auto scroll to bottom when new logs arrive if not filtered
  useEffect(() => {
    if (filterType === 'all' && filterText === '') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, filterType, filterText]);

  const handleClear = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký hiện tại?')) {
      await api.clearLogs();
      setLogs([]);
      addToast('Đã xóa nhật ký', 'success');
    }
  };

  const handleExport = async () => {
    const filePath = await api.exportLogs();
    if (filePath) {
      addToast(`Đã xuất nhật ký thành công ra: ${filePath}`, 'success');
    }
  };

  // Filter logic
  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterText) {
      const lowerText = filterText.toLowerCase();
      if (!log.studentName.toLowerCase().includes(lowerText) && 
          !log.message.toLowerCase().includes(lowerText)) {
        return false;
      }
    }
    return true;
  });

  const getLogColor = (type) => {
    switch (type) {
      case 'violation': return '#ef4444'; // Đỏ
      case 'connect': return '#10b981'; // Xanh lá
      case 'disconnect': return '#f59e0b'; // Cam
      case 'command': return '#3b82f6'; // Xanh dương
      case 'system': return '#8b5cf6'; // Tím
      default: return 'var(--text-primary)';
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'violation': return '⚠️';
      case 'connect': return '🟢';
      case 'disconnect': return '🔴';
      case 'command': return '⚡';
      case 'system': return '⚙️';
      default: return '📝';
    }
  };

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`} style={show ? { width: 450 } : {}}>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-title">📜 Nhật ký hoạt động</div>
          <div className="chat-target">{logs.length} sự kiện đã ghi nhận</div>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Toolbar / Filters */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, outline: 'none'
            }}
          >
            <option value="all">Tất cả sự kiện</option>
            <option value="violation">⚠️ Vi phạm</option>
            <option value="connect">🟢 Kết nối</option>
            <option value="disconnect">🔴 Ngắt kết nối</option>
            <option value="command">⚡ Lệnh giáo viên</option>
            <option value="system">⚙️ Hệ thống</option>
          </select>

          <input 
            type="text" 
            placeholder="Tìm theo tên học sinh, nội dung..." 
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 12, outline: 'none'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button 
            onClick={handleExport}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid var(--primary)',
              background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontSize: 11, cursor: 'pointer', fontWeight: 600
            }}
          >
            📥 Xuất ra Excel (CSV)
          </button>
          <button 
            onClick={handleClear}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid #ef4444',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 600
            }}
          >
            🗑 Xóa nhật ký
          </button>
        </div>
      </div>

      {/* Log List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
            Không có nhật ký nào phù hợp.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} style={{ 
              padding: '8px', borderRadius: 6, background: 'var(--surface)', 
              borderLeft: `3px solid ${getLogColor(log.type)}`, fontSize: 12,
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}>
                <span>{getLogIcon(log.type)} <strong>{log.studentName}</strong></span>
                <span>{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {log.message}
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
