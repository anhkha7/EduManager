import { useState, useRef, useEffect } from 'react';

export default function FileTransferPanel({ show, students, logs, onClose }) {
  const [targetId, setTargetId] = useState('all');
  const [selectedFile, setSelectedFile] = useState(null); // { filePath, fileName, fileSize }
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sendError, setSendError] = useState('');
  const logsEndRef = useRef(null);

  const api = window.electronAPI;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Lắng nghe tiến trình gửi file
  useEffect(() => {
    const handleProgress = (data) => {
      setProgress(data.progress);
      if (data.done) {
        setIsSending(false);
        setProgress(0);
        setSelectedFile(null);
      }
    };
    api.onFileProgress(handleProgress);
    return () => api.removeAllListeners('file:progress');
  }, []);

  const handleChooseFile = async () => {
    const result = await api.openFileDialog();
    if (result) {
      setSelectedFile(result);
      setSendError('');
    }
  };

  const handleSend = async () => {
    if (!selectedFile) return;
    setIsSending(true);
    setSendError('');
    setProgress(0);

    const result = await api.sendFile(targetId, selectedFile.filePath, selectedFile.fileName);
    if (!result.success) {
      setSendError(result.error || 'Gửi file thất bại');
      setIsSending(false);
      setProgress(0);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const targetName = targetId === 'all'
    ? 'Tất cả học sinh'
    : (students.find(s => s.id === targetId)?.name || '?');

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`}>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-title">📁 Gửi File</div>
          <div className="chat-target">Đến: {targetName}</div>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Target selector */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <select
          className="target-selector"
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          disabled={isSending}
        >
          <option value="all">📢 Tất cả học sinh</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              👤 {s.name} ({s.computerName || s.ip})
            </option>
          ))}
        </select>
      </div>

      {/* File picker area */}
      <div style={{ padding: '12px' }}>
        <div
          onClick={!isSending ? handleChooseFile : undefined}
          style={{
            border: `2px dashed ${selectedFile ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '16px 12px',
            textAlign: 'center',
            cursor: isSending ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            background: selectedFile ? 'rgba(59,130,246,0.06)' : 'transparent',
            opacity: isSending ? 0.6 : 1
          }}
        >
          {selectedFile ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 4 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {selectedFile.fileName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {formatSize(selectedFile.fileSize)}
              </div>
              {!isSending && (
                <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 6 }}>
                  Click để đổi file
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 4 }}>📂</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Click để chọn file
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Hỗ trợ mọi loại file, tối đa ~50MB
              </div>
            </>
          )}
        </div>

        {/* Progress bar */}
        {isSending && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <span>Đang gửi...</span>
              <span>{progress}%</span>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: 4,
                transition: 'width 0.1s ease'
              }} />
            </div>
          </div>
        )}

        {sendError && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 }}>
            ⚠️ {sendError}
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!selectedFile || isSending}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            background: (!selectedFile || isSending) ? 'var(--surface)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: (!selectedFile || isSending) ? 'var(--text-muted)' : '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: (!selectedFile || isSending) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {isSending ? `⏳ Đang gửi... ${progress}%` : '📤 Gửi file'}
        </button>
      </div>

      {/* Lịch sử gửi */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 12px 4px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Lịch sử gửi
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px' }}>
          {logs.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
              Chưa gửi file nào
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{
              padding: '7px 10px',
              marginBottom: 4,
              borderRadius: 6,
              background: 'var(--surface)',
              fontSize: 12,
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{log.icon || '📄'}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.fileName}
                </span>
                <span style={{ fontSize: 10, color: log.type === 'ack' ? '#4ade80' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {log.type === 'ack' ? '✅ Đã nhận' : '📤 Đã gửi'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                {log.type === 'ack' ? `HS: ${log.studentName}` : `→ ${log.target}`}
                {' · '}{new Date(log.time).toLocaleTimeString('vi-VN')}
              </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
