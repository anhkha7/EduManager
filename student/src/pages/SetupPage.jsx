import { useState, useEffect } from 'react';
import '../App.css';

export default function SetupPage() {
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('3722');
  const [studentName, setStudentName] = useState('');
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [incomingFile, setIncomingFile] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | submitting | done | error
  const [submitMsg, setSubmitMsg] = useState('');

  const api = window.electronAPI;

  useEffect(() => {
    // Load settings đã lưu
    api.getSettings().then((s) => {
      if (s.serverIp) setServerIp(s.serverIp);
      if (s.serverPort) setServerPort(String(s.serverPort));
      if (s.studentName) setStudentName(s.studentName);
      if (s.isConnected) setStatus('connected');
    });

    // Lắng nghe trạng thái kết nối
    api.onConnectionStatus((data) => {
      if (data.connected) {
        setStatus('connected');
        setErrorMsg('');
      } else {
        setStatus('disconnected');
        if (data.error) setErrorMsg(`Không thể kết nối: ${data.error}`);
      }
    });

    // Lắng nghe tin nhắn từ giáo viên
    api.onChatReceived((msg) => {
      setMessages(prev => [...prev.slice(-9), msg]); // giữ 10 tin
    });

    // Lắng nghe file từ giáo viên
    api.onFileReceiving(({ fileName, fileSize }) => {
      setIncomingFile({ fileName, fileSize });
    });
    api.onFileReceived(({ fileName, savePath, fileSize, destFolder }) => {
      setIncomingFile(null);
      setReceivedFiles(prev => [
        { fileName, savePath, fileSize, destFolder, time: Date.now() },
        ...prev.slice(0, 9)
      ]);
    });

    api.onSubmitAck(({ fileName }) => {
      setSubmitStatus('done');
      setSubmitMsg(`✅ Đã nộp: ${fileName}`);
      setTimeout(() => setSubmitStatus('idle'), 4000);
    });

    return () => {
      api.removeAllListeners('connection-status');
      api.removeAllListeners('chat-received');
      api.removeAllListeners('file-receiving');
      api.removeAllListeners('file-received');
      api.removeAllListeners('submit:ack');
    };
  }, []);

  const handleConnect = async () => {
    if (!serverIp.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ IP server');
      return;
    }
    setErrorMsg('');
    setStatus('connecting');
    await api.connect({
      serverIp: serverIp.trim(),
      serverPort: parseInt(serverPort) || 3722,
      studentName: studentName.trim()
    });
  };

  const handleDisconnect = async () => {
    await api.disconnect();
    setStatus('disconnected');
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || status !== 'connected') return;
    await api.sendChat(chatInput.trim());
    setChatInput('');
  };

  const handleSubmitFile = async () => {
    if (status !== 'connected') return;
    setSubmitStatus('submitting');
    setSubmitMsg('');
    const result = await api.submitFile();
    if (result.canceled) {
      setSubmitStatus('idle');
    } else if (!result.success) {
      setSubmitStatus('error');
      setSubmitMsg(result.error || 'Nộp bài thất bại');
      setTimeout(() => setSubmitStatus('idle'), 4000);
    } else {
      setSubmitStatus('submitting');
      setSubmitMsg(`Đang gửi ${result.fileName}...`);
    }
  };

  const statusLabels = {
    connected: '✅ Đã kết nối với giáo viên',
    disconnected: '🔴 Chưa kết nối',
    connecting: '⏳ Đang kết nối...'
  };

  return (
    <div className="setup-page">
      {/* Titlebar */}
      <div className="setup-titlebar">
        <div className="setup-titlebar-left">
          <span>🎓</span>
          <span style={{ color: '#60a5fa' }}>EduManager</span>
          <span style={{ fontSize: 10, color: '#4a6280', fontWeight: 400, marginLeft: 2 }}>STUDENT</span>
        </div>
        <div className="setup-titlebar-controls">
          <button className="tb-btn" onClick={() => api.windowMinimize()}>─</button>
          <button className="tb-btn close" onClick={() => api.windowClose()}>✕</button>
        </div>
      </div>

      <div className="setup-body">
        {/* Logo */}
        <div className="setup-logo">
          <div className="setup-logo-icon">🖥️</div>
          <div className="setup-logo-title">EduManager</div>
          <div className="setup-logo-sub">PHẦN MỀM QUẢN LÝ LỚP HỌC</div>
        </div>

        {/* Status */}
        <div className={`status-badge ${status}`}>
          <div className="status-dot" />
          {statusLabels[status]}
        </div>

        {/* Form */}
        <div className="setup-form">
          <div className="form-group">
            <label className="form-label">Tên học sinh</label>
            <input
              className="form-input"
              placeholder="Nhập tên của bạn (hoặc để trống dùng tên máy)"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              disabled={status === 'connected'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Địa chỉ server (IP giáo viên)</label>
            <div className="form-row">
              <input
                className="form-input"
                placeholder="Ví dụ: 192.168.1.100"
                value={serverIp}
                onChange={e => setServerIp(e.target.value)}
                disabled={status === 'connected'}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              <input
                className="form-input port"
                placeholder="Port"
                value={serverPort}
                onChange={e => setServerPort(e.target.value)}
                disabled={status === 'connected'}
              />
            </div>
          </div>

          {errorMsg && <div className="error-msg">⚠️ {errorMsg}</div>}

          {status === 'connected' ? (
            <button className="connect-btn disconnect" onClick={handleDisconnect}>
              🔌 Ngắt kết nối
            </button>
          ) : (
            <button
              className="connect-btn"
              onClick={handleConnect}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? '⏳ Đang kết nối...' : '🔗 Kết nối vào lớp học'}
            </button>
          )}
        </div>

        {/* Chat với giáo viên */}
        {status === 'connected' && (
          <>
            {/* Nộp bài */}
            <button
              onClick={handleSubmitFile}
              disabled={submitStatus === 'submitting'}
              style={{
                width: '100%', marginTop: 8,
                padding: '10px',
                borderRadius: 8, border: 'none',
                background: submitStatus === 'done' ? 'rgba(74,222,128,0.15)'
                  : submitStatus === 'error' ? 'rgba(239,68,68,0.15)'
                  : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                color: submitStatus === 'done' ? '#4ade80'
                  : submitStatus === 'error' ? '#f87171'
                  : '#fff',
                fontWeight: 700, fontSize: 13,
                cursor: submitStatus === 'submitting' ? 'wait' : 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {submitStatus === 'submitting' ? '⏳ Đang gửi bài...'
                : submitStatus === 'done' ? submitMsg
                : submitStatus === 'error' ? `⚠️ ${submitMsg}`
                : '📤 Nộp bài cho giáo viên'}
            </button>
            {messages.length > 0 && (
              <div className="messages-section">
                <div className="messages-title">💬 Tin nhắn từ giáo viên</div>
                {messages.slice(-3).map((msg, i) => (
                  <div key={i} className="message-item">
                    <div className="message-from">{msg.from}</div>
                    <div className="message-text">{msg.message}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="chat-row">
              <input
                className="chat-input-student"
                placeholder="Nhắn tin cho giáo viên..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              />
              <button
                className="chat-send-student"
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
              >
                ➤
              </button>
            </div>
          </>
        )}
        {/* File nhận được */}
        {status === 'connected' && (
          <>
            {incomingFile && (
              <div style={{
                margin: '8px 0',
                padding: '10px 12px',
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 8,
                fontSize: 13
              }}>
                <div style={{ color: '#60a5fa', fontWeight: 600, marginBottom: 2 }}>📥 Đang nhận file...</div>
                <div style={{ color: 'var(--text-secondary)' }}>{incomingFile.fileName}</div>
                <div style={{ marginTop: 6, height: 4, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 4, animation: 'pulse 1s infinite' }} />
                </div>
              </div>
            )}

            {receivedFiles.length > 0 && (
              <div className="messages-section">
                <div className="messages-title">📁 File đã nhận</div>
                {receivedFiles.map((f, i) => (
                  <div key={i} className="message-item" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="message-from" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.fileName}
                        </div>
                        <div className="message-text" style={{ fontSize: 11 }}>
                          {f.fileSize < 1024 * 1024
                            ? `${(f.fileSize / 1024).toFixed(1)} KB`
                            : `${(f.fileSize / 1024 / 1024).toFixed(2)} MB`
                          } · {new Date(f.time).toLocaleTimeString('vi-VN')}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>
                      ✅ Đã lưu vào: {f.destFolder === 'Desktop' ? 'Màn hình nền'
                        : f.destFolder === 'Documents' ? 'Tài liệu'
                        : f.destFolder === 'Downloads' ? 'Tải xuống'
                        : f.destFolder === 'EduManager' ? 'Downloads/EduManager'
                        : `Downloads/EduManager/${f.destFolder}`
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
