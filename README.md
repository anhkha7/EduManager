# 🎓 EduManager — Phần mềm Quản lý Lớp học Thực hành

<div align="center">

![EduManager Banner](https://img.shields.io/badge/EduManager-v1.1.0-3b82f6?style=for-the-badge&logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
![LAN Only](https://img.shields.io/badge/Network-LAN_Only-f59e0b?style=for-the-badge&logo=wifi&logoColor=white)

**Giải pháp quản lý phòng máy học tập mạng LAN mã nguồn mở — thay thế NetSupport School**

</div>

---

## 📋 Giới thiệu

**EduManager** là phần mềm quản lý phòng máy tính học tập hoạt động hoàn toàn trên mạng LAN nội bộ, **không cần kết nối Internet**. Được xây dựng để thay thế các giải pháp thương mại đắt tiền như NetSupport School hay NetOp School, EduManager cung cấp đầy đủ công cụ giúp giáo viên **giám sát, điều khiển và tương tác** với toàn bộ máy tính học sinh trong một giao diện thống nhất.

Dự án gồm **2 ứng dụng Desktop riêng biệt**:

| Ứng dụng | Vai trò | Chạy trên |
|---|---|---|
| 🖥️ **Teacher Console** | Server điều phối — giao diện quản trị lớp học | Máy giáo viên |
| 💻 **Student Client** | Client nhận lệnh — chạy ẩn trong khay hệ thống | Mỗi máy học sinh |

---

## ✨ Tính năng đầy đủ

### 🔍 Giám sát & Điều khiển
| Tính năng | Mô tả |
|---|---|
| 🖥️ **Xem màn hình dạng lưới** | Thumbnail màn hình tất cả học sinh cập nhật mỗi 3 giây |
| 🔒 **Khóa màn hình** | Khóa toàn bộ hoặc từng máy — chặn bàn phím, chuột và phím hệ thống (`Alt+Tab`, `Win`, `Ctrl+Esc`) bằng C# Low-Level Hook |
| 🛡️ **Chống vượt rào** | Vô hiệu hóa Task Manager qua Registry khi màn hình bị khóa — học sinh không thể tắt ứng dụng |
| 🖱️ **Điều khiển từ xa** | Điều khiển chuột và bàn phím máy học sinh từ xa theo thời gian thực (~7 FPS) |

### 📡 Chia sẻ & Truyền thông
| Tính năng | Mô tả |
|---|---|
| 📺 **Chiếu màn hình (Broadcast)** | Chia sẻ màn hình giáo viên xuống toàn bộ lớp — tối ưu băng thông ~38 Mbps cho 40 máy |
| 💬 **Nhắn tin** | Gửi thông báo từ giáo viên tới một hoặc toàn bộ học sinh |
| 📤 **Gửi tài liệu** | Gửi file bất kỳ từ giáo viên xuống học sinh qua HTTP streaming — không giới hạn kích thước |
| 📥 **Thu bài tập** | Học sinh nộp bài về máy giáo viên, tự động lưu theo tên từng học sinh |

### 🚫 Kiểm soát nội dung
| Tính năng | Mô tả |
|---|---|
| 🔕 **Chặn ứng dụng** | Giám sát và tự động đóng ứng dụng bị cấm (chế độ Kill hoặc cảnh báo) bằng C# native API |
| 🌐 **Chặn website** | Hai lớp bảo vệ: DNS Sinkhole (file `hosts`) + giám sát tiêu đề cửa sổ trình duyệt |

### ⚙️ Hạ tầng thông minh
| Tính năng | Mô tả |
|---|---|
| 🔎 **Tự động kết nối (Auto-Discovery)** | Student App tự dò tìm IP giáo viên qua UDP Broadcast — không cần nhập IP thủ công |
| 📝 **Nhật ký hoạt động** | Ghi log toàn bộ lệnh và vi phạm, xuất file CSV |
| 🔁 **Hoạt động offline** | Chỉ cần mạng LAN nội bộ, không cần internet |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                   MÁY GIÁO VIÊN (Server)                    │
│                                                             │
│  ┌─────────────┐    IPC    ┌──────────────────────────────┐ │
│  │  React UI   │ ◄──────► │    Electron Main Process     │ │
│  │  Dashboard  │           │  ┌──────────────────────┐   │ │
│  └─────────────┘           │  │ Socket.IO Server :3722│   │ │
│                            │  │ Express HTTP Server   │   │ │
│                            │  │ UDP Broadcast :3723   │   │ │
│                            │  └──────────────────────┘   │ │
│                            └──────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │ Mạng LAN (Wi-Fi / Ethernet)
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  MÁY HS 1   │  │  MÁY HS 2   │  │  MÁY HS 40  │
│             │  │             │  │             │
│ Socket.IO   │  │ Socket.IO   │  │ Socket.IO   │
│ Client      │  │ Client      │  │ Client      │
│             │  │             │  │             │
│ BlockKeys   │  │ BlockKeys   │  │ BlockKeys   │
│ .exe (C#)   │  │ .exe (C#)   │  │ .exe (C#)   │
│             │  │             │  │             │
│ ProcessMon  │  │ ProcessMon  │  │ ProcessMon  │
│ itor.exe    │  │ itor.exe    │  │ itor.exe    │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🚀 Cài đặt & Chạy (Development)

### Yêu cầu hệ thống
- **Node.js** ≥ 20.x LTS — [Tải tại nodejs.org](https://nodejs.org/)
- **Windows 10/11** — (Các tính năng C# Hook chỉ hỗ trợ Windows)
- **.NET Framework 4.0+** — Thường đã có sẵn trên Windows 10/11

### Bước 1: Tải mã nguồn
```bash
git clone https://github.com/anhkha7/EduManager.git
cd EduManager
```

### Bước 2: Khởi chạy Teacher App
Mở **Terminal 1**:
```bash
cd teacher
npm install --legacy-peer-deps
npm run dev
```
> Teacher App sẽ khởi động, hiển thị Dashboard và bắt đầu phát tín hiệu UDP Auto-Discovery.

### Bước 3: Khởi chạy Student App
Mở **Terminal 2** (cửa sổ mới):
```bash
cd student
npm install --legacy-peer-deps
npm run dev
```
> Student App sẽ **tự động tìm thấy và kết nối** vào Teacher App trong vòng ~5 giây nhờ UDP Auto-Discovery — không cần nhập IP thủ công!

---

## 🔧 Hướng dẫn Sử dụng Thực tế (Triển khai phòng máy)

### Quy trình đầu giờ học

```
1. Giáo viên bật Teacher App trên máy chủ
   → App hiển thị IP và Port trên thanh tiêu đề (vd: 192.168.1.100:3722)
   → UDP Broadcast tự động phát tín hiệu khắp mạng LAN

2. Học sinh bật Student App trên từng máy trạm
   → App TỰ ĐỘNG kết nối vào máy giáo viên (không cần nhập IP)
   → Nhập tên học sinh → App thu nhỏ xuống System Tray

3. Màn hình học sinh xuất hiện lần lượt trên Dashboard giáo viên dạng lưới thumbnail
   → Sẵn sàng bắt đầu buổi học!
```

### Các tính năng chính trên Teacher Console

| Hành động | Cách thực hiện |
|---|---|
| **Xem màn hình** | Thumbnail cập nhật tự động trên lưới chính |
| **Khóa/Mở khóa toàn lớp** | Nút "Khóa tất cả" / "Mở khóa" trên thanh công cụ |
| **Khóa 1 học sinh** | Click vào card học sinh → Chọn "Khóa màn hình" |
| **Chiếu màn hình** | Nút "Broadcast" — toàn lớp xem màn hình giáo viên |
| **Điều khiển từ xa** | Click vào card học sinh → "Điều khiển từ xa" |
| **Gửi tài liệu** | Tab File Transfer → Chọn file → Chọn máy đích |
| **Thu bài** | Học sinh click "Nộp bài" → File lưu vào `Downloads/EduManager/Submissions/<Tên HS>/` |
| **Chặn ứng dụng** | Tab App Block → Nhập từ khóa → Bật giám sát |
| **Chặn website** | Tab Web Block → Nhập tên miền → Bật chặn |
| **Nhắn tin** | Tab Chat → Soạn tin → Gửi (tất cả hoặc từng người) |

### Lưu ý quan trọng khi triển khai thực tế

> ⚠️ **Chặn Website** yêu cầu Student App được chạy với quyền **Administrator** để ghi file `hosts`. Nếu không có quyền Admin, lớp bảo vệ thứ 2 (giám sát tiêu đề cửa sổ) vẫn hoạt động bình thường.

> ℹ️ **Kiểm tra khẩn cấp:** Khi test trên cùng một máy (chạy cả Teacher và Student), dùng `Ctrl + Shift + U` trong cửa sổ Student Setup để ép mở khóa màn hình khẩn cấp.

---

## 📦 Build file cài đặt (.exe)

Đóng gói ứng dụng thành file `.exe` để triển khai không cần Node.js:

```bash
# Build Teacher App
cd teacher
npm run build:exe

# Build Student App (mở terminal mới)
cd student
npm run build:exe
```

File `.exe` cài đặt sẽ xuất hiện trong thư mục `release/` của từng project (ví dụ: `EduManager Setup 1.0.0.exe`).

---

## 🔬 Công nghệ sử dụng

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| **Desktop Framework** | [Electron.js](https://electronjs.org/) | ^42.x |
| **Giao diện** | [React.js](https://react.dev/) + Vanilla CSS | ^18.x |
| **Build Tool** | [Vite](https://vitejs.dev/) | ^8.x |
| **Realtime** | [Socket.IO](https://socket.io/) | ^4.7.x |
| **HTTP Server** | [Express.js](https://expressjs.com/) | ^4.18.x |
| **System Hooks** | C# (.NET Framework 4.0) — Win32 API | Built-in |
| **State Store** | [electron-store](https://github.com/sindresorhus/electron-store) | ^8.x |

---

## 📂 Cấu trúc thư mục

```
EduManager/
├── README.md
├── GUIDE.md                          # Tài liệu kỹ thuật chi tiết cho Developer
│
├── teacher/                          # Ứng dụng Giáo viên (Server)
│   ├── electron/
│   │   ├── main.js                   # Server chính: Socket.IO + Express HTTP + UDP Broadcast
│   │   ├── preload.js                # IPC Bridge bảo mật cho React UI
│   │   └── logger.js                 # Ghi log hoạt động ra CSV
│   └── src/
│       ├── App.jsx                   # Dashboard chính, quản lý state toàn lớp
│       └── components/               # Các panel chức năng (WebBlock, AppBlock, FileTransfer, Chat...)
│
└── student/                          # Ứng dụng Học sinh (Client)
    ├── electron/
    │   ├── main.js                   # Client chính: Socket.IO + UDP Discovery + IPC
    │   ├── preload.js                # IPC Bridge bảo mật cho React UI
    │   ├── hostsManager.js           # Quản lý chặn website qua file hosts
    │   ├── BlockKeys.cs/.exe         # C# hook chặn phím hệ thống (Alt+Tab, Win...)
    │   ├── InputSimulator.cs/.exe    # C# hook giả lập chuột/bàn phím (Remote Control)
    │   └── ProcessMonitor.cs/.exe    # C# native API quét tiến trình/cửa sổ (thay PowerShell)
    └── src/
        └── pages/
            ├── SetupPage.jsx         # Giao diện kết nối, chat, file transfer
            ├── LockPage.jsx          # Màn hình khóa toàn cảnh
            └── BroadcastPage.jsx     # Màn hình xem chiếu bài giáo viên
```

---

## ⚡ Hiệu năng & Tối ưu hóa (v1.1.0)

| Chỉ số | Trước (v1.0) | Sau (v1.1) | Cải thiện |
|---|---|---|---|
| **Băng thông Broadcast (40 máy)** | ~416 Mbps | **~38 Mbps** | ↓ 91% |
| **CPU máy học sinh (giám sát)** | 20–60% | **< 0.1%** | ↓ 99% |
| **RAM máy giáo viên (gửi file)** | Toàn bộ file | **~0 MB** (stream) | ↓ ~100% |
| **Thời gian kết nối đầu giờ** | 10–15 phút | **< 5 giây** | ↓ 99% |
| **Bảo mật màn hình khóa** | Học sinh thoát qua Task Manager | **Không thể thoát** | ✅ |

---

## 🛣️ Lộ trình Phát triển

### ✅ Đã hoàn thành
- [x] Giám sát màn hình dạng lưới thumbnail (realtime)
- [x] Khóa/mở khóa màn hình học sinh (toàn lớp & từng người)
- [x] Chặn phím hệ thống khi khóa (C# WH_KEYBOARD_LL Hook)
- [x] Vô hiệu hóa Task Manager khi màn hình bị khóa (Registry)
- [x] Chiếu màn hình giáo viên (Broadcast MJPEG)
- [x] Điều khiển từ xa chuột và bàn phím (Remote Control)
- [x] Nhắn tin giáo viên ↔ học sinh
- [x] Kiểm soát ứng dụng (Block App — Kill / Warn)
- [x] Kiểm soát website (Block Website — DNS + Title Monitor)
- [x] Truyền tài liệu giáo viên → học sinh (HTTP Stream)
- [x] Thu bài tập học sinh → giáo viên (HTTP Upload)
- [x] Nhật ký hoạt động lớp học (xuất CSV)
- [x] UDP Auto-Discovery (tự động kết nối, không cần nhập IP)
- [x] Tối ưu hiệu năng cho lớp 40 học sinh

### 🔮 Kế hoạch tương lai
- [ ] WebRTC P2P Broadcast (60 FPS, truyền âm thanh)
- [ ] Trắc nghiệm / Quiz nhanh trực tuyến (Quiz Module)
- [ ] Chia nhóm học sinh (Group Management)
- [ ] Ký số file `.exe` để tránh Windows Defender cảnh báo
- [ ] Hỗ trợ đa nền tảng (macOS, Linux)

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo **Issue** hoặc **Pull Request** trên GitHub.

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m "feat: mô tả tính năng"`
4. Push: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

Xem chi tiết kiến trúc và hướng dẫn lập trình trong **[GUIDE.md](./GUIDE.md)**.

---

## 📄 Giấy phép

Dự án được phân phối theo giấy phép **MIT License**. Xem file [LICENSE](./LICENSE) để biết thêm chi tiết.

---

<div align="center">

Được xây dựng với ❤️ bằng **Electron** + **React** + **Socket.IO**

</div>
