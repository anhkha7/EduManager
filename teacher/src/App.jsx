import { useState, useEffect, useCallback, useRef } from 'react';

// ── Components ──────────────────────────────────────────────────
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import StudentGrid from './components/StudentGrid';
import ChatPanel from './components/ChatPanel';
import FileTransferPanel from './components/FileTransferPanel';
import StudentDetail from './components/StudentDetail';
import Toast from './components/Toast';

export default function App() {
  const [students, setStudents] = useState([]);
  const [serverInfo, setServerInfo] = useState({ ip: '...', port: 3722 });
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFileTransfer, setShowFileTransfer] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState(4);
  const [toasts, setToasts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [fileTransferLogs, setFileTransferLogs] = useState([]);
  const [submissionLogs, setSubmissionLogs] = useState([]);
  
  const streamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const iceCandidatesBuffersRef = useRef(new Map());

  const api = window.electronAPI;

  // ── Toast notifications ────────────────────────────────────────
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Initial load ───────────────────────────────────────────────
  useEffect(() => {
    // Lấy thông tin server
    api.getServerInfo().then(info => setServerInfo(info));

    // Lấy danh sách học sinh đang kết nối (nếu reload)
    api.getStudents().then(list => {
      setStudents(list.map(s => ({ ...s, thumbnail: s.thumbnail || null })));
    });

    // ── Lắng nghe sự kiện ──────────────────────────────────────
    api.onStudentJoined((student) => {
      setStudents(prev => {
        if (prev.find(s => s.id === student.id)) return prev;
        addToast(`📲 ${student.name} vừa tham gia`, 'success');
        return [...prev, student];
      });
    });

    api.onStudentLeft(({ id, name }) => {
      setStudents(prev => prev.filter(s => s.id !== id));
      addToast(`⚠️ ${name} đã ngắt kết nối`, 'error');
      setSelectedStudent(prev => (prev?.id === id ? null : prev));
    });

    api.onStudentThumbnail(({ id, image }) => {
      setStudents(prev => prev.map(s =>
        s.id === id ? { ...s, thumbnail: image } : s
      ));
    });

    api.onStudentsStateChanged((updatedList) => {
      setStudents(updatedList);
    });

    api.onChatIncoming((msg) => {
      setChatMessages(prev => [...prev, { ...msg, direction: 'incoming' }]);
      if (!showChat) addToast(`💬 ${msg.from}: ${msg.message}`, 'info');
    });

    api.onFileAck(({ fileId, fileName, studentName }) => {
      setFileTransferLogs(prev => [...prev, {
        type: 'ack', fileName, studentName, fileId, time: Date.now(), icon: '📥'
      }]);
      addToast(`✅ ${studentName} đã nhận file: ${fileName}`, 'success');
    });

    api.onFileSubmitted((data) => {
      setSubmissionLogs(prev => [data, ...prev]);
      addToast(`📥 ${data.studentName} vừa nộp bài: ${data.fileName}`, 'success');
    });

    api.onWebRTCJoin(async ({ studentId }) => {
      if (!streamRef.current) return;

      // Close existing PeerConnection for this student if it exists
      const oldPc = peerConnectionsRef.current.get(studentId);
      if (oldPc) {
        console.log(`[WebRTC] Closing existing PeerConnection for student: ${studentId}`);
        try {
          oldPc.close();
        } catch (e) {
          console.error(e);
        }
      }

      // Initialize candidate buffer for this student
      iceCandidatesBuffersRef.current.set(studentId, []);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionsRef.current.set(studentId, pc);

      streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          api.sendWebRTCIceCandidate(studentId, {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      api.sendWebRTCOffer(studentId, offer);
    });

    api.onWebRTCAnswer(async ({ studentId, answer }) => {
      const pc = peerConnectionsRef.current.get(studentId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Process buffered ICE candidates
        const buffer = iceCandidatesBuffersRef.current.get(studentId) || [];
        while (buffer.length > 0) {
          const candidate = buffer.shift();
          try {
            if (candidate && candidate.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch (e) {
            console.warn(`[WebRTC] Error adding buffered ICE candidate for ${studentId}:`, e);
          }
        }
      } catch (e) {
        console.error(`[WebRTC] Error setting remote description for ${studentId}:`, e);
      }
    });

    api.onWebRTCIceCandidate(async ({ studentId, candidate }) => {
      const pc = peerConnectionsRef.current.get(studentId);
      if (!pc) return;

      try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          if (candidate && candidate.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } else {
          if (!iceCandidatesBuffersRef.current.has(studentId)) {
            iceCandidatesBuffersRef.current.set(studentId, []);
          }
          if (candidate && candidate.candidate) {
            iceCandidatesBuffersRef.current.get(studentId).push(candidate);
          }
        }
      } catch (e) {
        console.warn(`[WebRTC] Error adding ICE candidate for ${studentId}:`, e);
      }
    });

    return () => {
      ['student:joined','student:left','student:thumbnail','students:state-changed','chat:incoming', 'webrtc:join-broadcast', 'webrtc:answer', 'webrtc:ice-candidate', 'file:progress', 'file:ack', 'file:submitted']
        .forEach(ch => api.removeAllListeners(ch));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lock All ───────────────────────────────────────────────────
  const handleLockAll = useCallback(async () => {
    await api.lockAll('Giáo viên đã khóa màn hình. Hãy chú ý!');
    addToast('🔒 Đã khóa tất cả màn hình học sinh', 'info');
  }, [addToast, api]);

  // ── Unlock All ─────────────────────────────────────────────────
  const handleUnlockAll = useCallback(async () => {
    await api.unlockAll();
    addToast('🔓 Đã mở khóa tất cả màn hình', 'success');
    if (isBroadcasting) stopBroadcast();
  }, [addToast, api, isBroadcasting]);

  // ── Broadcast ──────────────────────────────────────────────────
  const startBroadcast = useCallback(async () => {
    try {
      const sourceId = await api.getScreenSourceId();
      if (!sourceId) throw new Error('Không lấy được nguồn màn hình');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: 1280,
            maxHeight: 720,
            maxFrameRate: 30
          }
        }
      });
      streamRef.current = stream;

      await api.startBroadcast();

      setIsBroadcasting(true);
      addToast('📡 Đang chiếu màn hình tới học sinh...', 'info');
    } catch (err) {
      console.error('Broadcast error:', err);
      addToast(`❌ Lỗi broadcast: ${err.message}`, 'error');
    }
  }, [api, addToast]);

  const stopBroadcast = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    iceCandidatesBuffersRef.current.clear();

    await api.stopBroadcast();
    setIsBroadcasting(false);
    addToast('⏹️ Đã dừng chiếu màn hình', 'info');
  }, [api, addToast]);

  const handleBroadcastToggle = useCallback(() => {
    if (isBroadcasting) stopBroadcast();
    else startBroadcast();
  }, [isBroadcasting, startBroadcast, stopBroadcast]);

  // ── Per-student actions ────────────────────────────────────────
  const handleLockStudent = useCallback(async (id) => {
    await api.lockStudent(id, 'Giáo viên đã khóa màn hình của bạn');
    setStudents(prev => prev.map(s => s.id === id ? { ...s, locked: true } : s));
  }, [api]);

  const handleUnlockStudent = useCallback(async (id) => {
    await api.unlockStudent(id);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, locked: false, broadcasting: false } : s));
  }, [api]);

  // ── Chat ───────────────────────────────────────────────────────
  const handleSendChat = useCallback(async (studentId, message) => {
    if (!message.trim()) return;
    await api.sendChat(studentId, message);
    const targetName = studentId === 'all'
      ? 'Tất cả học sinh'
      : (students.find(s => s.id === studentId)?.name || '?');
    setChatMessages(prev => [...prev, {
      direction: 'outgoing',
      from: 'Giáo viên',
      to: targetName,
      studentId,
      message,
      time: Date.now()
    }]);
  }, [api, students]);

  // ── File Transfer ───────────────────────────────────────────
  const handleFileSent = useCallback((fileName, targetId) => {
    const target = targetId === 'all'
      ? 'Tất cả học sinh'
      : (students.find(s => s.id === targetId)?.name || '?');
    setFileTransferLogs(prev => [...prev, {
      type: 'sent', fileName, target, time: Date.now(), icon: '📤'
    }]);
    addToast(`📤 Đang gửi file ${fileName}...`, 'info');
  }, [students, addToast]);

  // ── Filtered students ──────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.computerName.toLowerCase().includes(q);
  });

  const lockedCount = students.filter(s => s.locked).length;

  return (
    <div className="app-shell">
      <Titlebar
        serverInfo={serverInfo}
        studentCount={students.length}
      />

      <div className="app-body">
        {/* ── Left Sidebar ───────────────────────────────────── */}
        <Sidebar
          studentCount={students.length}
          lockedCount={lockedCount}
          isBroadcasting={isBroadcasting}
          onLockAll={handleLockAll}
          onUnlockAll={handleUnlockAll}
          onBroadcastToggle={handleBroadcastToggle}
          onShowChat={() => setShowChat(true)}
          onShowFileTransfer={() => setShowFileTransfer(true)}
          serverInfo={serverInfo}
        />

        {/* ── Main Content ────────────────────────────────────── */}
        <div className="main-content">
          <div className="content-header">
            <div>
              <div className="content-title">Danh sách học sinh</div>
              <div className="content-subtitle">
                {students.length} học sinh • {lockedCount} đang khóa
              </div>
            </div>
            <div className="content-actions">
              <input
                className="search-input"
                placeholder="Tìm học sinh..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {[3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`grid-size-btn ${gridCols === n ? 'active' : ''}`}
                  onClick={() => setGridCols(n)}
                  title={`${n} cột`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>

          <StudentGrid
            students={filteredStudents}
            gridCols={gridCols}
            onSelectStudent={setSelectedStudent}
            onLockStudent={handleLockStudent}
            onUnlockStudent={handleUnlockStudent}
            serverInfo={serverInfo}
          />
        </div>

        {/* ── Chat Panel ──────────────────────────────────────── */}
        <ChatPanel
          show={showChat}
          students={students}
          messages={chatMessages}
          onSend={handleSendChat}
          onClose={() => setShowChat(false)}
        />

        {/* ── File Transfer Panel ────────────────────────────── */}
        <FileTransferPanel
          show={showFileTransfer}
          students={students}
          logs={fileTransferLogs}
          submissionLogs={submissionLogs}
          onSent={handleFileSent}
          onClose={() => setShowFileTransfer(false)}
        />
      </div>

      {/* ── Student Detail Modal ─────────────────────────────── */}
      {selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onLock={handleLockStudent}
          onUnlock={handleUnlockStudent}
          onChat={() => { setShowChat(true); setSelectedStudent(null); }}
        />
      )}

      {/* ── Toast Notifications ──────────────────────────────── */}
      <Toast toasts={toasts} />
    </div>
  );
}
