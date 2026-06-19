import { useState } from 'react';

// ── Preset nhanh ──────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Facebook', keywords: ['facebook.com'] },
  { label: 'TikTok',   keywords: ['tiktok.com'] },
  { label: 'YouTube',  keywords: ['youtube.com'] },
  { label: 'Instagram',keywords: ['instagram.com'] },
  { label: 'Zalo',     keywords: ['zalo.me', 'chat.zalo.me'] },
  { label: 'Discord',  keywords: ['discord.com'] },
  { label: 'Roblox',   keywords: ['roblox.com'] },
  { label: 'Netflix',  keywords: ['netflix.com'] },
];

export default function WebBlockPanel({ show, onClose }) {
  const [customInput, setCustomInput] = useState('');
  const [activeRules, setActiveRules] = useState(new Set());
  const [isBlocking, setIsBlocking] = useState(false);

  const api = window.electronAPI;

  // Toggle preset keyword
  const togglePreset = (keywords) => {
    setActiveRules(prev => {
      const next = new Set(prev);
      const hasAll = keywords.every(k => next.has(k));
      if (hasAll) {
        keywords.forEach(k => next.delete(k));
      } else {
        keywords.forEach(k => next.add(k));
      }
      return next;
    });
  };

  // Thêm từ khóa tùy chỉnh
  const addCustom = () => {
    let trimmed = customInput.trim().toLowerCase();
    if (!trimmed) return;
    
    // Loại bỏ http://, https://, www. nếu người dùng lỡ copy dán vào
    trimmed = trimmed.replace(/^(https?:\/\/)?(www\.)?/, '');
    // Xóa phần path phía sau domain (nếu có)
    trimmed = trimmed.split('/')[0];
    
    if (trimmed) {
      setActiveRules(prev => new Set([...prev, trimmed]));
      setCustomInput('');
    }
  };

  // Xóa từ khóa
  const removeRule = (kw) => {
    setActiveRules(prev => {
      const next = new Set(prev);
      next.delete(kw);
      return next;
    });
  };

  // Bật giám sát
  const handleStart = async () => {
    const domains = [...activeRules];
    await api.sendWebBlockRules(domains);
    setIsBlocking(true);
  };

  // Tắt giám sát
  const handleStop = async () => {
    await api.stopWebBlock();
    setIsBlocking(false);
  };

  const rulesList = [...activeRules];

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`}>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-title">🌐 Khóa Website</div>
          <div className="chat-target">
            {isBlocking
              ? `🔴 Đang chặn · ${rulesList.length} tên miền`
              : 'Chưa bật khóa Web'}
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Thông báo quyền Admin */}
        <div style={{
          padding: '8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: '#f87171'
        }}>
          <strong>Lưu ý:</strong> Tính năng này sử dụng cơ chế chặn ở cấp độ hệ thống mạng (Host File). Yêu cầu máy học sinh phải chạy EduManager bằng quyền <strong>Administrator</strong>.
        </div>

        {/* Preset nhanh */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Chọn nhanh
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {PRESETS.map(p => {
              const isActive = p.keywords.some(k => activeRules.has(k));
              return (
                <button
                  key={p.label}
                  onClick={() => togglePreset(p.keywords)}
                  disabled={isBlocking}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(59,130,246,0.15)' : 'var(--surface)',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: isBlocking ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {isActive ? '✓ ' : ''}{p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nhập từ khoá tự do */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Thêm tên miền (Domain)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none',
              }}
              placeholder="VD: facebook.com"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              disabled={isBlocking}
            />
            <button
              onClick={addCustom}
              disabled={isBlocking || !customInput.trim()}
              style={{
                padding: '7px 12px', borderRadius: 6, border: 'none',
                background: (!customInput.trim() || isBlocking) ? 'var(--surface)' : 'var(--primary)',
                color: (!customInput.trim() || isBlocking) ? 'var(--text-muted)' : '#fff',
                fontSize: 12, fontWeight: 700, cursor: (!customInput.trim() || isBlocking) ? 'not-allowed' : 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Danh sách rules hiện tại */}
        {rulesList.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Danh sách chặn ({rulesList.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {rulesList.map(kw => (
                <span
                  key={kw}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                  }}
                >
                  {kw}
                  {!isBlocking && (
                    <button
                      onClick={() => removeRule(kw)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nút bật/tắt */}
        <button
          onClick={isBlocking ? handleStop : handleStart}
          disabled={!isBlocking && rulesList.length === 0}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
            cursor: (!isBlocking && rulesList.length === 0) ? 'not-allowed' : 'pointer',
            background: isBlocking
              ? 'rgba(239,68,68,0.15)'
              : (rulesList.length === 0 ? 'var(--surface)' : 'linear-gradient(135deg,#ef4444,#b91c1c)'),
            color: isBlocking ? '#ef4444' : (rulesList.length === 0 ? 'var(--text-muted)' : '#fff'),
            border: isBlocking ? '1px solid rgba(239,68,68,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {isBlocking ? '⏹ Hủy khóa Website' : '▶ Bắt đầu khóa trên toàn bộ máy'}
        </button>
      </div>
    </div>
  );
}
