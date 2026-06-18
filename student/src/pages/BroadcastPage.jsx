import { useState, useEffect, useRef } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Bắt đầu...");
  const videoRef = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const iceCandidatesBuffer = [];
    let isProcessingOffer = false;

    pc.ontrack = (event) => {
      setDebugStatus("Đã nhận Track Video!");
      const stream = (event.streams && event.streams.length > 0) ? event.streams[0] : new MediaStream([event.track]);
      if (videoRef.current) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          setDebugStatus("Đang ép phát Video...");
          videoRef.current.play().then(() => {
            setDebugStatus("Video đang phát thành công!");
          }).catch(err => {
            setDebugStatus("Lỗi phát Video: " + err.message);
          });
        }
        setIsConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        api.sendWebRTCIceCandidate(event.candidate);
      }
    };

    api.onWebRTCOffer(async ({ offer }) => {
      if (isProcessingOffer || pc.signalingState !== 'stable') {
        console.warn(`[WebRTC] Ignoring offer. isProcessing: ${isProcessingOffer}, signalingState: ${pc.signalingState}`);
        return;
      }
      isProcessingOffer = true;
      try {
        setDebugStatus("Đã nhận Offer, tạo Answer...");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process buffered ICE candidates
        while (iceCandidatesBuffer.length > 0) {
          const candidate = iceCandidatesBuffer.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        api.sendWebRTCAnswer(answer);
        setDebugStatus("Đã gửi Answer, chờ luồng...");
      } catch (e) {
        setDebugStatus("Lỗi xử lý Offer: " + e.message);
      } finally {
        isProcessingOffer = false;
      }
    });

    api.onWebRTCIceCandidate(async ({ candidate }) => {
      try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesBuffer.push(candidate);
        }
      } catch (e) {
        console.warn('[WebRTC] Error adding ICE candidate:', e);
      }
    });

    // Notify server that we opened the broadcast window
    setDebugStatus("Đang yêu cầu kết nối...");
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
        muted
        className="broadcast-image"
        style={{ display: isConnected ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'contain' }}
      />
      
      {!isConnected && (
        <div className="broadcast-waiting">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div>Đang chờ luồng Video từ giáo viên...</div>
        </div>
      )}

      {/* Overlay debug text always visible */}
      <div style={{ position: 'absolute', top: 50, left: 20, color: '#00ff00', fontSize: 16, zIndex: 9999, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: 4 }}>
        [Debug] Trạng thái: {debugStatus}
      </div>
    </div>
  );
}
