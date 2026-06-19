import { useState, useEffect, useRef } from 'react';

export default function StudentDetail({ student, onClose, onLock, onUnlock, onChat }) {
  const isLocked = student.locked;
  const [isRemoteControl, setIsRemoteControl] = useState(false);
  const imgRef = useRef(null);

  const api = window.electronAPI;

  useEffect(() => {
    return () => {
      if (isRemoteControl) {
        api.remoteControlStart(student.id, false);
      }
    };
  }, [isRemoteControl, student.id, api]);

  const toggleRemoteControl = () => {
    const newState = !isRemoteControl;
    setIsRemoteControl(newState);
    api.remoteControlStart(student.id, newState);
    if (newState && imgRef.current) {
      imgRef.current.focus();
    }
  };

  const handleMouseMove = (e) => {
    if (!isRemoteControl || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    api.sendRemoteInput(student.id, `M:${px.toFixed(4)}:${py.toFixed(4)}`);
  };

  const handleMouseDown = (e) => {
    if (!isRemoteControl) return;
    const btn = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    api.sendRemoteInput(student.id, `MD:${btn}`);
  };

  const handleMouseUp = (e) => {
    if (!isRemoteControl) return;
    const btn = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    api.sendRemoteInput(student.id, `MU:${btn}`);
  };

  const handleWheel = (e) => {
    if (!isRemoteControl) return;
    const delta = e.deltaY > 0 ? -120 : 120; 
    api.sendRemoteInput(student.id, `W:${delta}`);
  };

  const handleContextMenu = (e) => {
    if (isRemoteControl) e.preventDefault();
  };

  const handleKeyDown = (e) => {
    if (!isRemoteControl) return;
    e.preventDefault();
    api.sendRemoteInput(student.id, `KD:${e.keyCode}`);
  };

  const handleKeyUp = (e) => {
    if (!isRemoteControl) return;
    e.preventDefault();
    api.sendRemoteInput(student.id, `KU:${e.keyCode}`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🖥️ {student.name}</div>
            <div className="modal-subtitle">
              {student.computerName || 'PC'} · {student.ip}
              {isLocked && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>🔒 Đang bị khóa</span>}
              {isRemoteControl && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>⚡ Đang bị điều khiển</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {student.thumbnail ? (
            <div 
              ref={imgRef}
              tabIndex={0}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              onContextMenu={handleContextMenu}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              style={{
                outline: isRemoteControl ? '2px solid var(--warning)' : 'none',
                cursor: isRemoteControl ? 'crosshair' : 'default',
                position: 'relative'
              }}
            >
              <img
                src={student.thumbnail}
                alt="Màn hình học sinh"
                className="modal-screenshot"
                style={{ display: 'block', width: '100%', pointerEvents: 'none' }}
              />
              {isRemoteControl && (
                <div style={{
                  position: 'absolute', top: 10, right: 10, 
                  background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4,
                  fontSize: 11, color: '#fff', pointerEvents: 'none'
                }}>
                  ● LIVE (Click để tương tác)
                </div>
              )}
            </div>
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

          <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
            <button
              className={`action-btn ${isRemoteControl ? 'danger' : 'warning'}`}
              style={{ width: 'auto', padding: '8px 16px', fontWeight: 'bold' }}
              onClick={toggleRemoteControl}
            >
              {isRemoteControl ? '⏹ Dừng điều khiển' : '🖱 Điều khiển từ xa'}
            </button>

            {isLocked ? (
              <button
                className="action-btn success"
                style={{ width: 'auto', padding: '8px 16px' }}
                onClick={() => { onUnlock(student.id); onClose(); }}
              >
                🔓 Mở khóa
              </button>
            ) : (
              <button
                className="action-btn danger"
                style={{ width: 'auto', padding: '8px 16px' }}
                onClick={() => { onLock(student.id); onClose(); }}
              >
                🔒 Khóa
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
