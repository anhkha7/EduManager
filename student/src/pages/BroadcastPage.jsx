import { useState, useEffect } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onBroadcastFrame?.((image) => {
      setFrame(image);
    });

    // Chặn phím tắt
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', block, true);

    return () => {
      api.removeAllListeners?.('broadcast-frame');
      window.removeEventListener('keydown', block, true);
    };
  }, []);

  return (
    <div className="broadcast-page">
      <div className="broadcast-label">📡 MÀN HÌNH GIÁO VIÊN</div>

      {frame ? (
        <img
          src={frame}
          alt="Màn hình giáo viên"
          className="broadcast-image"
        />
      ) : (
        <div className="broadcast-waiting">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div>Đang chờ tín hiệu từ giáo viên...</div>
        </div>
      )}
    </div>
  );
}
