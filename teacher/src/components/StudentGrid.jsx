import StudentCard from './StudentCard';

export default function StudentGrid({
  students, gridCols, onSelectStudent,
  onLockStudent, onUnlockStudent, serverInfo
}) {
  if (students.length === 0) {
    return (
      <div className="student-grid-container">
        <div className="empty-state">
          <div className="empty-state-icon">🖥️</div>
          <div className="empty-state-title">Chưa có học sinh nào kết nối</div>
          <div className="empty-state-desc">
            Yêu cầu học sinh mở app EduManager Student và nhập địa chỉ:
          </div>
          <div className="empty-state-ip">
            {serverInfo?.ip || '...'} : {serverInfo?.port || 3722}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-grid-container">
      <div className={`student-grid cols-${gridCols}`}>
        {students.map(student => (
          <StudentCard
            key={student.id}
            student={student}
            onClick={() => onSelectStudent(student)}
            onLock={() => onLockStudent(student.id)}
            onUnlock={() => onUnlockStudent(student.id)}
          />
        ))}
      </div>
    </div>
  );
}
