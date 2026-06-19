import { useState } from 'react';

// ── Preset nhanh ──────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Facebook', keywords: ['facebook'] },
  { label: 'TikTok',   keywords: ['tiktok'] },
  { label: 'YouTube',  keywords: ['youtube'] },
  { label: 'Instagram',keywords: ['instagram'] },
  { label: 'Zalo',     keywords: ['zalo'] },
  { label: 'Discord',  keywords: ['discord'] },
  { label: 'Telegram', keywords: ['telegram'] },
  { label: 'Steam',    keywords: ['steam'] },
  { label: 'Valorant', keywords: ['valorant', 'vgc'] },
  { label: 'LMHT',     keywords: ['leagueoflegends', 'league of legends'] },
  { label: 'Minecraft',keywords: ['minecraft'] },
  { label: 'Spotify',  keywords: ['spotify'] },
];

export default function AppBlockPanel({ show, students, onClose, onViolation }) {
  const [mode, setMode] = useState('kill'); // 'kill' | 'warn'
  const [customInput, setCustomInput] = useState('');
  const [activeRules, setActiveRules] = useState(new Set());
  const [isBlocking, setIsBlocking] = useState(false);
  const [violations, setViolations] = useState([]);

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
    const trimmed = customInput.trim().toLowerCase();
    if (!trimmed) return;
    setActiveRules(prev => new Set([...prev, trimmed]));
    setCustomInput('');
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
    const rules = [...activeRules];
    await api.sendAppBlockRules(rules, mode);
    setIsBlocking(true);
  };

  // Tắt giám sát
  const handleStop = async () => {
    await api.stopAppBlock();
    setIsBlocking(false);
  };

  // Lắng nghe violation từ main nếu chưa đăng ký
  if (api.onAppViolation && !AppBlockPanel._listenerSet) {
    AppBlockPanel._listenerSet = true;
    api.onAppViolation((data) => {
      setViolations(prev => [{ ...data }, ...prev].slice(0, 20));
      if (onViolation) onViolation(data);
    });
  }

  const rulesList = [...activeRules];

  return (
    <div className={`chat-panel ${show ? '' : 'hidden'}`}>
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-title">🚫 Kiểm soát ứng dụng</div>
          <div className="chat-target">
            {isBlocking
              ? `🟡 Đang giám sát · ${rulesList.length} từ khóa`
              : 'Chưa bật giám sát'}
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Chế độ xử lý */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Chế độ xử lý vi phạm
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { val: 'kill', icon: '❌', label: 'Đóng ngay' },
              { val: 'warn', icon: '⚠️', label: 'Cảnh báo' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setMode(opt.val)}
                disabled={isBlocking}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${mode === opt.val ? (opt.val === 'kill' ? '#ef4444' : '#fbbf24') : 'var(--border)'}`,
                  background: mode === opt.val
                    ? (opt.val === 'kill' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)')
                    : 'var(--surface)',
                  color: mode === opt.val
                    ? (opt.val === 'kill' ? '#ef4444' : '#fbbf24')
                    : 'var(--text-secondary)',
                  cursor: isBlocking ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
            {mode === 'kill'
              ? '→ Ứng dụng vi phạm sẽ bị đóng ngay lập tức'
              : '→ Màn hình cảnh báo hiện 8 giây, ứng dụng không bị đóng'}
          </div>
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
            Thêm từ khóa / tên .exe
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none',
              }}
              placeholder="VD: notepad, chrome, game..."
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
              Từ khóa đang áp dụng ({rulesList.length})
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
              : (rulesList.length === 0 ? 'var(--surface)' : 'linear-gradient(135deg,#f59e0b,#ef4444)'),
            color: isBlocking ? '#ef4444' : (rulesList.length === 0 ? 'var(--text-muted)' : '#fff'),
            border: isBlocking ? '1px solid rgba(239,68,68,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {isBlocking ? '⏹ Tắt giám sát' : '▶ Bật giám sát cho tất cả học sinh'}
        </button>

        {/* Lịch sử vi phạm */}
        {violations.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: 6, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>⚠ Vi phạm gần đây</span>
              <button
                onClick={() => setViolations([])}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
              >
                Xóa
              </button>
            </div>
            {violations.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '7px 9px', marginBottom: 4, borderRadius: 7,
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderLeft: '3px solid #fbbf24',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                    👤 {v.studentName}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                    {new Date(v.time).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  {v.mode === 'kill' ? '❌ Đã đóng' : '⚠️ Cảnh báo'}: <strong style={{ color: 'var(--text-primary)' }}>{v.keyword}</strong>
                  {v.process && <span style={{ color: 'var(--text-muted)' }}> ({v.process}.exe)</span>}
                </div>
                {v.windowTitle && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 1 }}>
                    🪟 {v.windowTitle.slice(0, 40)}{v.windowTitle.length > 40 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
