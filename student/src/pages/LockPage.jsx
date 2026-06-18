import { useState, useEffect } from 'react';
import '../App.css';

// Tạo particles ngẫu nhiên cho background
function generateParticles(n = 20) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animDuration: `${8 + Math.random() * 12}s`,
    animDelay: `${-Math.random() * 15}s`,
    size: `${1 + Math.random() * 3}px`
  }));
}

const PARTICLES = generateParticles(25);

export default function LockPage({ initialMessage }) {
  const [message, setMessage] = useState(initialMessage);
  const [time, setTime] = useState('');
  const [chatMsg, setChatMsg] = useState(null);

  // Đồng hồ
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Lắng nghe cập nhật message và chat từ main
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onUpdateMessage?.((msg) => setMessage(msg));

    api.onChatReceived?.((msg) => {
      setChatMsg(msg);
      // Tự ẩn sau 5 giây
      setTimeout(() => setChatMsg(null), 5000);
    });

    return () => {
      api.removeAllListeners?.('update-message');
      api.removeAllListeners?.('chat-received');
    };
  }, []);

  // Chặn tất cả phím tắt
  useEffect(() => {
    const blockKeys = (e) => {
      // Chặn Alt+F4, Windows key, v.v.
      if (e.altKey || e.key === 'Meta' || e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockKeys, true);
    return () => window.removeEventListener('keydown', blockKeys, true);
  }, []);

  return (
    <div className="lock-page">
      {/* Background particles */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="lock-particle"
          style={{
            left: p.left,
            bottom: 0,
            width: p.size,
            height: p.size,
            animationDuration: p.animDuration,
            animationDelay: p.animDelay
          }}
        />
      ))}

      <div className="lock-content">
        {/* Lock icon */}
        <div className="lock-icon-ring">🔒</div>

        {/* Title */}
        <div className="lock-title">Màn hình bị khóa</div>

        {/* Message from teacher */}
        <div className="lock-message">
          {message || 'Giáo viên đã khóa màn hình. Hãy chú ý bài giảng!'}
        </div>

        {/* Clock */}
        <div className="lock-time">{time}</div>
      </div>

      {/* Chat popup from teacher */}
      {chatMsg && (
        <div className="lock-chat-popup">
          <div className="lock-chat-from">💬 {chatMsg.from}</div>
          <div style={{ fontSize: 13 }}>{chatMsg.message}</div>
        </div>
      )}

      {/* Branding */}
      <div className="lock-brand">
        🎓 EduManager · Liên hệ giáo viên để được mở khóa
      </div>
    </div>
  );
}
