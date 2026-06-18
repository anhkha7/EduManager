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

    return () => {
      api.removeAllListeners('connection-status');
      api.removeAllListeners('chat-received');
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
      </div>
    </div>
  );
}
