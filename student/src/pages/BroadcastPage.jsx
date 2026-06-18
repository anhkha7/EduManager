import { useState, useEffect, useRef } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        api.sendWebRTCIceCandidate(event.candidate);
      }
    };

    api.onWebRTCOffer(async ({ offer }) => {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      api.sendWebRTCAnswer(answer);
    });

    api.onWebRTCIceCandidate(async ({ candidate }) => {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Notify server that we opened the broadcast window
    api.joinBroadcast();

    // Chặn phím tắt
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', block, true);

    return () => {
      pc.close();
      api.removeAllListeners?.('webrtc:offer');
      api.removeAllListeners?.('webrtc:ice-candidate');
      window.removeEventListener('keydown', block, true);
    };
  }, []);

  return (
    <div className="broadcast-page">
      <div className="broadcast-label">📡 MÀN HÌNH GIÁO VIÊN</div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="broadcast-image"
        style={{ display: isConnected ? 'block' : 'none' }}
      />
      
      {!isConnected && (
        <div className="broadcast-waiting">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div>Đang chờ luồng Video từ giáo viên...</div>
        </div>
      )}
    </div>
  );
}
