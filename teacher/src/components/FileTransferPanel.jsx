import { useState, useRef, useEffect } from 'react';

// Danh sách thư mục đích có thể chọn
const DEST_FOLDERS = [
  { label: '📥 EduManager (Mặc định)', value: 'EduManager', desc: 'Downloads/EduManager/' },
  { label: '🖥️ Desktop', value: 'Desktop', desc: 'Màn hình nền' },
  { label: '📄 Tài liệu', value: 'Documents', desc: 'Thư mục Documents' },
  { label: '⬇️ Tải xuống', value: 'Downloads', desc: 'Thư mục Downloads' },
  { label: '✏️ Tùy chỉnh...', value: 'custom', desc: 'Nhập tên thư mục con' },
];

export default function FileTransferPanel({ show, students, logs, submissionLogs, onClose }) {
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'receive'

  // --- Tab Gửi file ---
  const [targetId, setTargetId] = useState('all');
  const [selectedFile, setSelectedFile] = useState(null);
  const [destFolder, setDestFolder] = useState('EduManager');
  const [customFolder, setCustomFolder] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sendError, setSendError] = useState('');

  // --- Tab Thu bài ---
  const [saveDir, setSaveDir] = useState('');
  const logsEndRef = useRef(null);
  const subLogsEndRef = useRef(null);

  const api = window.electronAPI;

  // Load thư mục thu bài khi mở
  useEffect(() => {
    api.getSaveDir().then(dir => setSaveDir(dir || ''));
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    subLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [submissionLogs]);

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
    const effectiveFolder = destFolder === 'custom' ? (customFolder.trim() || 'Custom') : destFolder;
    setIsSending(true);
    setSendError('');
    setProgress(0);
    const result = await api.sendFile(targetId, selectedFile.filePath, selectedFile.fileName, effectiveFolder);
    if (!result.success) {
      setSendError(result.error || 'Gửi file thất bại');
      setIsSending(false);
      setProgress(0);
    }
  };

  const handleChooseSaveDir = async () => {
    const dir = await api.openSaveDirDialog();
    if (dir) setSaveDir(dir);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const targetName = targetId === 'all'
    ? 'Tất cả học sinh'
    : (students.find(s => s.id === targetId)?.name || '?');

  const destLabel = DEST_FOLDERS.find(f => f.value === destFolder)?.desc || destFolder;

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`}>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-title">📁 Quản lý File</div>
          <div className="chat-target">
            {activeTab === 'send' ? `Đến: ${targetName}` : 'Bài nộp từ học sinh'}
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'send', icon: '📤', label: 'Gửi file' },
          { key: 'receive', icon: '📥', label: 'Thu bài', badge: submissionLogs?.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              position: 'relative'
            }}
          >
            {tab.icon} {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: '50%',
                fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: '14px'
              }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB GỬI FILE ═══ */}
      {activeTab === 'send' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Đối tượng gửi */}
            <select
              className="target-selector"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              disabled={isSending}
            >
              <option value="all">📢 Tất cả học sinh</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>👤 {s.name} ({s.computerName || s.ip})</option>
              ))}
            </select>

            {/* Thư mục đích */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📂 Lưu vào thư mục (trên máy học sinh)</div>
              <select
                className="target-selector"
                value={destFolder}
                onChange={e => setDestFolder(e.target.value)}
                disabled={isSending}
              >
                {DEST_FOLDERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {destFolder === 'custom' && (
                <input
                  style={{
                    marginTop: 6,
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: 'var(--text-primary)',
                    fontSize: 12
                  }}
                  placeholder="Tên thư mục (VD: BaiTap1)"
                  value={customFolder}
                  onChange={e => setCustomFolder(e.target.value)}
                  disabled={isSending}
                />
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                → Lưu vào: {destFolder === 'custom'
                  ? `Downloads/EduManager/${customFolder || '...'}/`
                  : destLabel
                }
              </div>
            </div>
          </div>

          {/* File picker */}
          <div style={{ padding: '10px 12px' }}>
            <div
              onClick={!isSending ? handleChooseFile : undefined}
              style={{
                border: `2px dashed ${selectedFile ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 8, padding: '14px 10px', textAlign: 'center',
                cursor: isSending ? 'not-allowed' : 'pointer',
                background: selectedFile ? 'rgba(59,130,246,0.06)' : 'transparent',
                opacity: isSending ? 0.6 : 1, transition: 'all 0.2s'
              }}
            >
              {selectedFile ? (
                <>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {selectedFile.fileName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatSize(selectedFile.fileSize)}
                  </div>
                  {!isSending && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4 }}>Click để đổi file</div>}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📂</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Click để chọn file</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Tối đa ~50MB</div>
                </>
              )}
            </div>

            {isSending && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Đang gửi...</span><span>{progress}%</span>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: 4, transition: 'width 0.1s' }} />
                </div>
              </div>
            )}
            {sendError && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '5px 8px', borderRadius: 6 }}>
                ⚠️ {sendError}
              </div>
            )}
            <button
              onClick={handleSend}
              disabled={!selectedFile || isSending}
              style={{
                marginTop: 10, width: '100%', padding: '9px',
                borderRadius: 8, border: 'none',
                background: (!selectedFile || isSending) ? 'var(--surface)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                color: (!selectedFile || isSending) ? 'var(--text-muted)' : '#fff',
                fontWeight: 600, fontSize: 13, cursor: (!selectedFile || isSending) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              {isSending ? `⏳ Đang gửi... ${progress}%` : '📤 Gửi file'}
            </button>
          </div>

          {/* Lịch sử gửi */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: '5px 12px 3px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Lịch sử gửi
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px' }}>
              {logs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 10 }}>Chưa gửi file nào</div>
              )}
              {logs.map((log, i) => (
                <div key={i} style={{ padding: '6px 8px', marginBottom: 3, borderRadius: 6, background: 'var(--surface)', fontSize: 11, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{log.icon || '📄'}</span>
                    <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {log.fileName}
                    </span>
                    <span style={{ fontSize: 9, color: log.type === 'ack' ? '#4ade80' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.type === 'ack' ? '✅ Nhận' : '📤 Gửi'}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 1 }}>
                    {log.type === 'ack' ? `HS: ${log.studentName}` : `→ ${log.target}`} · {new Date(log.time).toLocaleTimeString('vi-VN')}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB THU BÀI ═══ */}
      {activeTab === 'receive' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Thư mục thu bài */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>📂 Thư mục lưu bài nộp</div>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 8px', fontSize: 11,
              color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: 6
            }}>
              {saveDir || 'Downloads/EduManager/Submissions/'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleChooseSaveDir}
                style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 11,
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                🔄 Đổi thư mục
              </button>
              <button
                onClick={() => api.openSubmissionFolder()}
                style={{
                  flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff',
                  fontSize: 11, cursor: 'pointer', fontWeight: 600
                }}
              >
                📂 Mở thư mục
              </button>
            </div>
          </div>

          {/* Danh sách bài nộp */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {(!submissionLogs || submissionLogs.length === 0) && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                Chưa có bài nộp nào
              </div>
            )}
            {(submissionLogs || []).map((sub, i) => (
              <div key={i} style={{
                padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                background: 'var(--surface)', border: '1px solid rgba(74,222,128,0.2)',
                borderLeft: '3px solid #4ade80'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.fileName}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 2 }}>
                  👤 {sub.studentName}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {formatSize(sub.fileSize)} · {new Date(sub.time).toLocaleTimeString('vi-VN')}
                </div>
              </div>
            ))}
            <div ref={subLogsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
