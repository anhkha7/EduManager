import { useState, useEffect, useRef } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Đang đợi kết nối Stream Ảnh...");
  const imgRef = useRef(null);
  
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const handleStreamStart = () => {
      setDebugStatus("Đã nhận lệnh bắt đầu stream (MJPEG)");
      setIsConnected(false);
      if (imgRef.current) {
        imgRef.current.src = "";
      }
    };

    const handleStreamChunk = (base64Image) => {
      if (!isConnected) setIsConnected(true);
      if (imgRef.current) {
        // Cập nhật ảnh trực tiếp, không độ trễ
        imgRef.current.src = base64Image;
        setDebugStatus(`Đang phát MJPEG... (Độ trễ 0s)`);
      }
    };

    api.onStreamStart(handleStreamStart);
    api.onStreamChunk(handleStreamChunk);

    // Chặn phím tắt
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', block, true);

    return () => {
      api.removeAllListeners?.('stream:start');
      api.removeAllListeners?.('stream:chunk');
      window.removeEventListener('keydown', block, true);
    };
  }, [isConnected]);

  return (
    <div className="broadcast-page">
      <div className="broadcast-label">📡 MÀN HÌNH GIÁO VIÊN</div>

      <img
        ref={imgRef}
        className="broadcast-image"
        style={{ display: isConnected ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }}
        alt="Teacher Screen"
      />
      
      {!isConnected && (
        <div className="broadcast-waiting">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div>Đang chờ dữ liệu màn hình từ giáo viên...</div>
        </div>
      )}

      {/* Overlay debug text always visible */}
      <div style={{ position: 'absolute', top: 50, left: 20, color: '#00ff00', fontSize: 14, zIndex: 9999, background: 'rgba(0,0,0,0.7)', padding: '8px 12px', borderRadius: 4, fontFamily: 'monospace', lineHeight: '1.4' }}>
        <div>[Debug] Trạng thái: {debugStatus}</div>
      </div>
    </div>
  );
}
