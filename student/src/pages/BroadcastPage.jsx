import { useState, useEffect, useRef } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Đang đợi kết nối Stream...");
  const videoRef = useRef(null);
  
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const queueRef = useRef([]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    let mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }

    const onSourceOpen = () => {
      setDebugStatus("MediaSource mở. Đợi luồng chunks...");
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs=vp8');
        sourceBuffer.mode = 'sequence';
        sourceBufferRef.current = sourceBuffer;

        sourceBuffer.addEventListener('updateend', () => {
          if (queueRef.current.length > 0 && !sourceBuffer.updating) {
            const nextChunk = queueRef.current.shift();
            try {
              sourceBuffer.appendBuffer(nextChunk);
            } catch (err) {
              console.warn("Lỗi appendBuffer (updateend):", err);
            }
          }
        });
      } catch (err) {
        setDebugStatus("Lỗi tạo SourceBuffer: " + err.message);
      }
    };

    mediaSource.addEventListener('sourceopen', onSourceOpen);

    const handleStreamStart = () => {
      setDebugStatus("Đã nhận lệnh bắt đầu stream");
      queueRef.current = [];
      setIsConnected(false);
    };

    const handleStreamChunk = (chunk) => {
      setIsConnected(true);
      if (!sourceBufferRef.current) return;
      
      // Node.js Buffer được gửi qua IPC là kiểu Uint8Array trong trình duyệt
      const buffer = new Uint8Array(chunk);
      queueRef.current.push(buffer);

      if (!sourceBufferRef.current.updating) {
        const nextChunk = queueRef.current.shift();
        try {
          sourceBufferRef.current.appendBuffer(nextChunk);
          setDebugStatus(`Đang phát stream... Queue: ${queueRef.current.length}`);
          
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(e => console.warn("Lỗi auto-play:", e));
          }
        } catch (err) {
          console.warn("Lỗi appendBuffer:", err);
        }
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
      if (mediaSource.readyState === 'open') {
        try { mediaSource.endOfStream(); } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="broadcast-page">
      <div className="broadcast-label">📡 MÀN HÌNH GIÁO VIÊN</div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="broadcast-image"
        style={{ display: isConnected ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'contain' }}
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
