import { useState, useEffect, useRef } from 'react';
import '../App.css';

export default function BroadcastPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [debugStatus, setDebugStatus] = useState("Bắt đầu...");
  const [signalingState, setSignalingState] = useState("stable");
  const [iceState, setIceState] = useState("new");
  const [connState, setConnState] = useState("new");
  const videoRef = useRef(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const iceCandidatesBuffer = [];
    let isProcessingOffer = false;

    // Track states
    pc.onsignalingstatechange = () => {
      setSignalingState(pc.signalingState);
    };
    pc.oniceconnectionstatechange = () => {
      setIceState(pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      setConnState(pc.connectionState);
    };

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
      if (event.candidate && event.candidate.candidate) {
        console.log('[WebRTC] Student generated ICE candidate:', event.candidate.candidate);
        api.sendWebRTCIceCandidate({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
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
        console.log(`[WebRTC] Processing ${iceCandidatesBuffer.length} buffered ICE candidates`);
        while (iceCandidatesBuffer.length > 0) {
          const candidate = iceCandidatesBuffer.shift();
          try {
            if (candidate && candidate.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
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
        console.log('[WebRTC] Student received ICE candidate from teacher:', candidate && candidate.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          if (candidate && candidate.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } else {
          if (candidate && candidate.candidate) {
            iceCandidatesBuffer.push(candidate);
          }
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
      <div style={{ position: 'absolute', top: 50, left: 20, color: '#00ff00', fontSize: 14, zIndex: 9999, background: 'rgba(0,0,0,0.7)', padding: '8px 12px', borderRadius: 4, fontFamily: 'monospace', lineHeight: '1.4' }}>
        <div>[Debug] Trạng thái: {debugStatus}</div>
        <div>[Debug] Signaling: {signalingState}</div>
        <div>[Debug] ICE State: {iceState}</div>
        <div>[Debug] Conn State: {connState}</div>
      </div>
    </div>
  );
}
