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
  const broadcastIntervalRef = useRef(null);
  const videoElementRef = useRef(null);

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

    return () => {
      ['student:joined','student:left','student:thumbnail','students:state-changed','chat:incoming', 'file:progress', 'file:ack', 'file:submitted']
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
            maxFrameRate: 24 // Giới hạn 24 FPS cho mượt và nhẹ
          }
        }
      });
      streamRef.current = stream;

      await api.startBroadcast();
      api.sendStreamStart(); // Báo cho học sinh chuẩn bị hiển thị

      // Khởi tạo video ẩn và canvas để nén ảnh
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      videoElementRef.current = video;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });

      // Đợi video chạy mới có kích thước
      video.onloadedmetadata = () => {
        video.play().catch(e => console.error("Lỗi play video ẩn:", e));
        
        broadcastIntervalRef.current = setInterval(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Nén JPEG chất lượng 60% (~50-80KB mỗi khung hình)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            api.sendStreamChunk(dataUrl);
          }
        }, 50); // 50ms = 20 FPS (Tốc độ khung hình hoàn hảo cho dạy học)
      };

      setIsBroadcasting(true);
      addToast('📡 Đang chiếu màn hình tới học sinh...', 'info');
    } catch (err) {
      console.error('Broadcast error:', err);
      addToast(`❌ Lỗi broadcast: ${err.message}`, 'error');
    }
  }, [api, addToast]);

  const stopBroadcast = useCallback(async () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }

    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.srcObject = null;
      videoElementRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

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
