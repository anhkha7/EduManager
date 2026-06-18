export default function StudentDetail({ student, onClose, onLock, onUnlock, onChat }) {
  const isLocked = student.locked;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🖥️ {student.name}</div>
            <div className="modal-subtitle">
              {student.computerName || 'PC'} · {student.ip}
              {isLocked && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>🔒 Đang bị khóa</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {student.thumbnail ? (
            <img
              src={student.thumbnail}
              alt="Màn hình học sinh"
              className="modal-screenshot"
            />
          ) : (
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13
            }}>
              Chưa có ảnh chụp màn hình
            </div>
          )}

          <div className="modal-actions">
            {isLocked ? (
              <button
                className="action-btn success"
                style={{ width: 'auto', padding: '8px 16px' }}
                onClick={() => { onUnlock(student.id); onClose(); }}
              >
                🔓 Mở khóa màn hình
              </button>
            ) : (
              <button
                className="action-btn danger"
                style={{ width: 'auto', padding: '8px 16px' }}
                onClick={() => { onLock(student.id); onClose(); }}
              >
                🔒 Khóa màn hình
              </button>
            )}

            <button
              className="action-btn primary"
              style={{ width: 'auto', padding: '8px 16px' }}
              onClick={onChat}
            >
              💬 Nhắn tin
            </button>

            <button
              className="action-btn"
              style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }}
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
