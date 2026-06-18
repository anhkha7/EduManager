import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ show, students, messages, onSend, onClose }) {
  const [input, setInput] = useState('');
  const [targetId, setTargetId] = useState('all');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    onSend(targetId, msg);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const targetName = targetId === 'all'
    ? 'Tất cả học sinh'
    : (students.find(s => s.id === targetId)?.name || '?');

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`}>
      <div className="chat-header">
        <div>
          <div className="chat-title">💬 Nhắn tin</div>
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
        >
          <option value="all">📢 Tất cả học sinh</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              👤 {s.name} ({s.computerName || s.ip})
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
            Chưa có tin nhắn nào
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble ${msg.direction}`}
          >
            <div className="chat-bubble-from">
              {msg.direction === 'incoming' ? `${msg.from}` : `Giáo viên → ${msg.to || 'Tất cả'}`}
            </div>
            {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Nhập tin nhắn... (Enter để gửi)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim()}
          title="Gửi (Enter)"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
