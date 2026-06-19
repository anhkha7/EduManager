export default function Sidebar({
  studentCount, lockedCount, isBroadcasting,
  onLockAll, onUnlockAll, onBroadcastToggle, onShowChat, onShowFileTransfer, onShowAppBlock, onShowWebBlock, onShowLogs,
  serverInfo
}) {
  return (
    <div className="sidebar">
      {/* ── Điều khiển lớp học ─────────────────────────────── */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Điều khiển lớp</div>

        <button className="action-btn danger" onClick={onLockAll} title="Khóa tất cả màn hình">
          <span className="action-btn-icon">🔒</span>
          Khóa màn hình
        </button>

        <button className="action-btn success" onClick={onUnlockAll} title="Mở khóa tất cả">
          <span className="action-btn-icon">🔓</span>
          Mở khóa tất cả
        </button>

        <div className="divider" />

        <button
          className={`action-btn ${isBroadcasting ? 'active-broadcast' : 'warning'}`}
          onClick={onBroadcastToggle}
          title={isBroadcasting ? 'Dừng chiếu màn hình' : 'Chiếu màn hình giáo viên'}
        >
          <span className="action-btn-icon">{isBroadcasting ? '⏹️' : '📡'}</span>
          {isBroadcasting ? 'Dừng broadcast' : 'Broadcast màn hình'}
        </button>

        <div className="divider" />

        <button className="action-btn primary" onClick={onShowChat} title="Mở khung chat">
          <span className="action-btn-icon">💬</span>
          Nhắn tin
        </button>

        <button className="action-btn primary" onClick={onShowFileTransfer} title="Gửi file cho học sinh">
          <span className="action-btn-icon">📁</span>
          Gửi file
        </button>

        <button className="action-btn warning" onClick={onShowAppBlock} title="Kiểm soát ứng dụng học sinh">
          <span className="action-btn-icon">🚫</span>
          Kiểm soát App
        </button>

        <button className="action-btn danger" onClick={onShowWebBlock} title="Chặn truy cập Website">
          <span className="action-btn-icon">🌐</span>
          Khóa Website
        </button>

        <div className="divider" />

        <button className="action-btn" onClick={onShowLogs} title="Xem nhật ký hệ thống" style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
          <span className="action-btn-icon">📜</span>
          Nhật ký hệ thống
        </button>
      </div>

      {/* ── Thống kê ─────────────────────────────────────────── */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Tổng quan</div>

        <div className="stat-row">
          <span className="stat-label">Tổng học sinh</span>
          <span className="stat-value">{studentCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Đang online</span>
          <span className="stat-value online">{studentCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Đang bị khóa</span>
          <span className="stat-value locked">{lockedCount}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Tự do</span>
          <span className="stat-value">{studentCount - lockedCount}</span>
        </div>
      </div>

      {/* ── Server Info ────────────────────────────────────────── */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Thông tin kết nối</div>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <div>IP máy giáo viên:</div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            color: '#60a5fa',
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 6,
            padding: '4px 8px',
            marginTop: 4,
            userSelect: 'text',
            WebkitUserSelect: 'text'
          }}>
            {serverInfo?.ip || '...'}:{serverInfo?.port || 3722}
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6 }}>
            Học sinh nhập địa chỉ này để kết nối vào lớp học
          </div>
        </div>
      </div>

      {/* ── Phiên bản ─────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          EduManager v1.0.0 · Made in Vietnam 🇻🇳
        </div>
      </div>
    </div>
  );
}
