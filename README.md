# 🎓 EduManager — Phần mềm Quản lý Lớp học

EduManager là một phần mềm mã nguồn mở thay thế cho các giải pháp quản lý lớp học thương mại như NetSupport School. Phần mềm giúp giáo viên dễ dàng giám sát, điều khiển và tương tác với máy tính của học sinh trong mạng LAN nội bộ nhà trường.

Dự án bao gồm 2 ứng dụng:
- **Teacher Console**: Dành cho giáo viên (đóng vai trò là Server điều phối lớp học).
- **Student Client**: Dành cho máy học sinh (chạy ngầm dưới khay hệ thống).

---

## ✨ Tính năng nổi bật (MVP)

- 🖥️ **Giám sát thời gian thực:** Xem dạng lưới thu nhỏ màn hình của toàn bộ học sinh (cập nhật 3s/lần).
- 🔒 **Khóa màn hình:** Khóa màn hình, chuột, bàn phím của một hoặc toàn bộ học sinh.
- 📡 **Chiếu màn hình (Broadcast):** Chia sẻ trực tiếp màn hình giáo viên xuống máy học sinh.
- 💬 **Nhắn tin trực tiếp:** Gửi thông báo từ giáo viên tới máy học sinh.
- ⚡ **Hoạt động Offline:** Chỉ cần mạng LAN cục bộ, KHÔNG CẦN internet.

---

## 🚀 Hướng dẫn Cài đặt & Chạy (Dành cho Developer)

### 1. Yêu cầu hệ thống
- Đã cài đặt [Node.js](https://nodejs.org/) (khuyến nghị bản LTS 20.x trở lên).
- Hệ điều hành: Hiện tại hỗ trợ tốt nhất trên Windows.

### 2. Tải mã nguồn
```bash
git clone https://github.com/your-username/edumanager.git
cd edumanager
```

### 3. Cài đặt và Chạy App Giáo Viên (Teacher)
Mở terminal/cmd và chạy:
```bash
cd teacher
npm install
npm run dev
```

### 4. Cài đặt và Chạy App Học Sinh (Student)
Mở một terminal/cmd **mới** và chạy:
```bash
cd student
npm install
npm run dev
```

*(Ghi chú: Luôn đảm bảo Teacher App đang chạy trước khi học sinh tiến hành kết nối).*

---

## 📦 Build file cài đặt (.exe)

Để đóng gói ứng dụng thành file `.exe` cài đặt thực tế (không cần Node.js trên máy đích), bạn sử dụng `electron-builder`.

**Bước 1:** Cài đặt công cụ (chỉ làm lần đầu)
```bash
# Ở cả thư mục teacher và student
npm install electron-builder --save-dev
```

**Bước 2:** Cập nhật file `package.json` của cả `teacher` và `student`:
Thêm đoạn sau vào `scripts`:
```json
"build:exe": "vite build && electron-builder --win"
```
Thêm cấu hình `build` (ngang hàng với dependencies):
```json
"build": {
  "appId": "com.edumanager.app",
  "productName": "EduManager",
  "directories": { "output": "release/" },
  "win": { "target": "nsis" },
  "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
}
```

**Bước 3:** Chạy lệnh Build
```bash
npm run build:exe
```
Sau khi hoàn tất, file cài đặt sẽ nằm trong thư mục `release/` của từng project (ví dụ: `EduManager Setup 1.0.0.exe`).
---

## 🔧 Hướng dẫn Sử dụng Thực tế

1. **Trên máy Giáo viên:**
   - Mở Teacher App. Ứng dụng sẽ hiển thị **địa chỉ IP** và Port (ví dụ: `192.168.1.100:3722`) trên thanh tiêu đề.
   - Cung cấp địa chỉ IP này cho học sinh.
2. **Trên máy Học sinh:**
   - Mở Student App.
   - Nhập tên của mình và **Địa chỉ IP của giáo viên**.
   - Bấm "Kết nối". Sau khi kết nối, app sẽ tự động thu nhỏ xuống khay hệ thống (System Tray).

*Lưu ý: Đối với việc test tính năng khóa màn hình trên cùng 1 máy tính (vừa mở app giáo viên vừa mở app học sinh), bạn có thể dùng phím tắt `Ctrl + Shift + U` để ép đóng màn hình khóa (Emergency Unlock).*

---

## 🛣️ Lộ trình Phát triển (Roadmap)
- [ ] Kiểm soát website (Block/Allow URLs).
- [ ] Truyền file (File Transfer) giữa giáo viên và học sinh.
- [ ] Điều khiển từ xa (Remote Control) chuột và bàn phím học sinh.
- [ ] Trắc nghiệm/Quiz nhanh trực tuyến.
- [ ] Hỗ trợ đa nền tảng toàn diện (macOS, Linux).
