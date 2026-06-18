📖 Cẩm nang Phát triển EduManager (Developer Guide)
Tài liệu này tổng hợp toàn bộ kiến trúc, cơ chế hoạt động và lộ trình phát triển của EduManager nhằm giúp các lập trình viên mới (hoặc chính bạn trong tương lai) có thể nhanh chóng nắm bắt dự án và tiếp tục phát triển các tính năng mới.

1. Tổng quan Dự án
EduManager là phần mềm quản lý phòng máy tính nội bộ (mạng LAN) dành cho trường học, đóng vai trò thay thế cho các phần mềm thương mại đắt đỏ như NetSupport School.

Dự án được chia làm 2 ứng dụng độc lập:

Teacher App (Giáo viên): Đóng vai trò là Máy Chủ (Server) và bảng điều khiển (Dashboard).
Student App (Học sinh): Đóng vai trò là Máy Khách (Client), chạy ẩn dưới nền để gửi dữ liệu và nhận lệnh từ giáo viên.
2. Kiến trúc Kỹ thuật (Tech Stack)
Dự án là một Monorepo chứa 2 ứng dụng, sử dụng chung các công nghệ:

Framework: Electron.js (để tạo app Desktop) + React.js (để làm giao diện).
Trình đóng gói: Vite (giúp dev server chạy siêu nhanh).
Giao tiếp Real-time: Socket.IO (truyền nhận lệnh khóa màn hình, chat, trạng thái).
Xử lý hình ảnh: API desktopCapturer của Electron (để chụp màn hình học sinh và giáo viên).
3. Cấu trúc Thư mục
text

edumanager/
├── teacher/                     # Ứng dụng của Giáo viên (App + Server)
│   ├── electron/
│   │   ├── main.js              # Khởi tạo cửa sổ, NHÚNG SERVER Socket.IO (Port 3722)
│   │   └── preload.js           # Cầu nối (IPC bridge) giữa React và Electron
│   ├── src/                     # Code giao diện React (App.jsx, các Components)
│   └── package.json             # Chứa script build và dependencies
│
└── student/                     # Ứng dụng của Học sinh (Client)
    ├── electron/
    │   ├── main.js              # Khởi tạo cửa sổ ẩn, kết nối tới Server, chụp màn hình gửi đi
    │   └── preload.js           # Cầu nối (IPC bridge)
    ├── src/
    │   ├── pages/               # Giao diện Setup, LockScreen, BroadcastScreen
    │   └── App.jsx              # Router điều hướng màn hình
    └── package.json             # Chứa script build
4. Cơ chế Hoạt động Cốt lõi (Core Mechanisms)
Để làm tiếp các tính năng mới, bạn cần hiểu rõ dòng chảy dữ liệu giữa Teacher và Student:

A. Kết nối mạng
Khi Teacher App bật lên, file teacher/electron/main.js sẽ tự động mở một Socket.IO Server ở port 3722. (Lưu ý: Đã có logic tự động lọc bỏ IP ảo của VMware/VirtualBox để lấy đúng IP LAN thật).
Khi Student App bật lên, nhập IP và ấn kết nối, student/electron/main.js sẽ dùng Socket.IO Client kết nối đến ws://<IP-Teacher>:3722.
B. Chụp màn hình học sinh (Thumbnail)
Cứ mỗi 3 giây, Student App sẽ gọi desktopCapturer.getSources() chụp màn hình.
Ép ảnh thành dạng chuỗi Base64 (JPEG thu nhỏ) và socket.emit('student:thumbnail') gửi cho Server.
Teacher Server nhận được, bắn qua IPC xuống cho Teacher React UI để render thành các thẻ học sinh.
C. Khóa màn hình (Lock Screen)
Giáo viên bấm nút "Khóa". React gửi IPC lên main.js của Teacher.
Teacher gửi tín hiệu command:lock qua Socket.IO tới học sinh.
Học sinh nhận tín hiệu, tự động tạo ra một cửa sổ (BrowserWindow) phủ kín toàn màn hình (Fullscreen, AlwaysOnTop) chặn mọi thao tác chuột/phím của học sinh.
D. Chiếu màn hình Giáo viên (Broadcast)
(Hiện đang dùng cơ chế mô phỏng bằng Socket)

Teacher chụp màn hình liên tục và gửi luồng dữ liệu hình ảnh (Base64) qua Socket.
Student nhận được tín hiệu, tự động mở 1 màn hình Fullscreen (giống màn hình khóa) nhưng bên trong chứa thẻ <img> liên tục cập nhật ảnh của giáo viên để tạo thành Video.
5. Các Tính năng Hiện có (Đã hoàn thành)
Quét IP vật lý thật của máy giáo viên để làm Server.
Học sinh nhập IP tham gia lớp. Giám sát trạng thái Online/Offline.
Xem màn hình thu nhỏ (Grid view) của toàn bộ lớp học.
Khóa toàn bộ / Mở khóa toàn bộ.
Khóa / Mở khóa từng cá nhân (Click vào học sinh).
Broadcast màn hình giáo viên xuống máy học sinh (~8 FPS).
Chat riêng lẻ hoặc Chat toàn lớp.
Phím tắt giải cứu (Ctrl+Shift+U) cho học sinh khi test code trên cùng 1 máy tính.
Cấu hình Build ra file .exe bằng electron-builder.
6. Hướng Phát triển Tiếp theo (Roadmap Phase 2)
Dưới đây là các tính năng ưu tiên để phát triển tiếp, kèm theo gợi ý cách thực hiện:

Tính năng 1: Kiểm soát Website (Khóa Web)
Cách làm: Ở student/electron/main.js, bạn cần tìm cách theo dõi lịch sử duyệt web hoặc lấy tên cửa sổ đang Active. Nếu phát hiện tiêu đề cửa sổ chứa chữ cấm (ví dụ: "Facebook", "Liên Minh"), dùng code Node.js ép đóng chương trình đó (taskkill trên Windows) hoặc hiển thị ngay cái màn hình Khóa (LockWindow).
Tính năng 2: Chuyển Gửi File (File Transfer)
Cách làm:
Gửi cho học sinh: Teacher mở hộp thoại chọn file -> Chia file thành các mảnh nhỏ (Buffer) -> Gửi qua Socket.IO -> Student nhận, ghép lại và lưu ra ổ đĩa (dùng module fs của Node).
Thu bài: Tương tự chiều ngược lại.
Tính năng 3: Điều khiển máy học sinh (Remote Control)
Cách làm:
Hình ảnh: Khi giáo viên bấm "Điều khiển", Student tăng tốc độ gửi ảnh chụp màn hình từ 3s/lần lên khoảng 15-20 FPS.
Thao tác: Bắt sự kiện Click chuột, Gõ phím trên màn hình của Teacher -> Gửi sự kiện đó qua Socket -> Student dùng thư viện Node.js bên thứ ba (như robotjs hoặc nut.js) để mô phỏng lại cú click chuột/gõ phím y hệt trên máy học sinh.
Tính năng 4: Nâng cấp luồng Video bằng WebRTC (Tối ưu hóa)
Hiện tại Broadcast màn hình giáo viên đang đẩy ảnh tĩnh qua Socket.IO (chỉ đạt ~8fps, hơi giật).
Cách làm: Trong tương lai, nên chuyển sang dùng công nghệ WebRTC. Server đóng vai trò là Signaling Server. Giáo viên lấy luồng navigator.mediaDevices.getUserMedia, tạo luồng P2P Video Stream xuống cho học sinh. Tốc độ sẽ mượt mà như xem YouTube (60 FPS) và có cả âm thanh.
7. Các Lưu ý Quan trọng khi Code
Đừng bao giờ nhúng code Node.js trực tiếp vào React (Ví dụ lệnh fs.readFile không chạy trong React). Luôn dùng cơ chế IPC (Inter-Process Communication) qua file preload.js để nhờ Electron Main Process xử lý.
Luôn cẩn thận với bộ nhớ rò rỉ (Memory Leak) khi thao tác với hình ảnh liên tục. Nhớ dọn dẹp các biến chứa chuỗi Base64 hình ảnh.
Khi thêm các tính năng can thiệp sâu vào hệ điều hành (như chặn phím Windows, tắt ứng dụng), có thể Windows Defender sẽ hiểu lầm là Virus. Đôi khi cần Code Signing (mua chứng chỉ) khi xuất bản thương mại.