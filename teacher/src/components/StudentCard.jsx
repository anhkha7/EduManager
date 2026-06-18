import { memo } from 'react';

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  const colors = [
    ['#3b82f6', '#8b5cf6'],
    ['#06b6d4', '#3b82f6'],
    ['#8b5cf6', '#ec4899'],
    ['#22c55e', '#06b6d4'],
    ['#f59e0b', '#ef4444'],
    ['#ec4899', '#8b5cf6'],
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

const StudentCard = memo(function StudentCard({ student, onClick, onLock, onUnlock }) {
  const [c1, c2] = getAvatarColor(student.name || 'A');

  const statusLabel = student.broadcasting ? 'BROADCAST' : student.locked ? 'KHÓA' : 'ONLINE';
  const statusClass = student.broadcasting ? 'broadcasting' : student.locked ? 'locked' : 'online';

  return (
    <div
      className={`student-card ${student.locked ? 'locked' : ''} ${student.broadcasting ? 'broadcasting' : ''}`}
      onClick={onClick}
    >
      {/* ── Thumbnail ─────────────────────────────────────── */}
      <div className="card-thumbnail">
        {student.thumbnail ? (
          <img src={student.thumbnail} alt={`Màn hình ${student.name}`} />
        ) : (
          <div className="card-thumbnail-placeholder">
            <div className="card-thumbnail-placeholder-icon">🖥️</div>
          </div>
        )}

        {student.locked && !student.broadcasting && (
          <div className="card-lock-overlay">🔒</div>
        )}

        {student.broadcasting && (
          <div className="card-broadcast-overlay">
            <span className="card-broadcast-label">📡 BROADCAST</span>
          </div>
        )}

        {/* Hover actions */}
        <div className="card-hover-actions" onClick={e => e.stopPropagation()}>
          {student.locked ? (
            <button
              className="card-action-btn unlock"
              onClick={onUnlock}
              title="Mở khóa"
            >🔓</button>
          ) : (
            <button
              className="card-action-btn lock"
              onClick={onLock}
              title="Khóa màn hình"
            >🔒</button>
          )}
          <button
            className="card-action-btn"
            onClick={onClick}
            title="Xem chi tiết"
          >⛶</button>
        </div>
      </div>

      {/* ── Info bar ─────────────────────────────────────── */}
      <div className="card-info">
        <div className="card-avatar" style={{
          background: `linear-gradient(135deg, ${c1}, ${c2})`
        }}>
          {getInitials(student.name)}
        </div>

        <div className="card-names">
          <div className="card-student-name">{student.name}</div>
          <div className="card-computer-name">{student.computerName || student.ip}</div>
        </div>

        <div className={`card-status-badge ${statusClass}`}>
          {statusLabel}
        </div>
      </div>
    </div>
  );
});

export default StudentCard;
