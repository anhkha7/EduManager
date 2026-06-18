export default function Titlebar({ serverInfo, studentCount }) {
  const api = window.electronAPI;

  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <div className="titlebar-logo-icon">🎓</div>
        <span className="titlebar-logo-text">EduManager</span>
        <span className="titlebar-logo-badge">TEACHER</span>
      </div>

      <div className="titlebar-spacer" />

      {serverInfo?.ip && (
        <div className="titlebar-server-info">
          <div className="server-dot" />
          <span>Server: </span>
          <strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>
            {serverInfo.ip}:{serverInfo.port}
          </strong>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>{studentCount} học sinh</span>
        </div>
      )}

      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => api.windowMinimize()} title="Thu nhỏ">─</button>
        <button className="titlebar-btn" onClick={() => api.windowMaximize()} title="Phóng to">□</button>
        <button className="titlebar-btn close" onClick={() => api.windowClose()} title="Đóng">✕</button>
      </div>
    </div>
  );
}
