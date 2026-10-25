# EduTest Pro 2.0 - Hệ Thống Thi Trắc Nghiệm Trực Tuyến

Hệ thống thi trắc nghiệm và kiểm tra trực tuyến hiện đại dành cho Giáo viên và Học sinh, tích hợp Trợ lý AI Gemini hỗ trợ soạn đề tự động và kết nối trực tiếp Google Sheets cá nhân làm cơ sở dữ liệu độc lập.

---

## 🌟 Tính Năng Nổi Bật

### 1. Dành Cho Giáo Viên (`teacher_dashboard.html`)
* **Soạn đề thi thông minh:**
  * Bóc tách đề thi tự động từ file Word (`.docx`) hoặc `PDF`.
  * Hỗ trợ Trợ lý AI Google Gemini (chọn mô hình AI: Gemini 3 Flash, 3.1 Flash-Lite, 2.5 Flash, 3.7 Flash...).
  * Tạo câu hỏi thủ công đa dạng: Trắc nghiệm 4 lựa chọn (Phần I), Trắc nghiệm Đúng/Sai (Phần II), và Tự luận (Phần III).
  * Chế độ linh hoạt: Luyện tập / Ôn tập (cho xem lại bài & đáp án sau khi nộp) hoặc Thi chính thức (bảo mật đề).
* **Quản lý đề thi & học sinh:**
  * Quản lý trạng thái Mở/Khóa kỳ thi.
  * Phân quyền lớp học được phép tham gia.
  * Quản lý danh sách học sinh theo lớp, cấp lại và đổi mật khẩu học sinh.
* **Thống kê & Chấm điểm:**
  * Bảng xếp hạng điểm số trực quan, xếp loại học lực.
  * Xuất bảng điểm chi tiết ra file Excel (`.xlsx`) chỉ với 1 click.

### 2. Dành Cho Học Sinh (`student_dashboard.html`)
* **Giao diện phòng thi trực tuyến tập trung:**
  * Xem danh sách các bài thi mở phù hợp theo đúng lớp học.
  * Đồng hồ đếm ngược thời gian làm bài chính xác từng giây.
  * Bảng điều hướng câu hỏi (Palette) trực quan, đổi màu khi đã làm / chưa làm.
  * Tự động nộp bài khi hết giờ hoặc nộp thủ công.
* **Màn hình vinh danh & Xem lại bài:**
  * Hiển thị điểm số, số câu đúng và lời chúc mừng.
  * Xem lại chi tiết từng câu hỏi, đáp án đã chọn và đáp án đúng (ở chế độ Ôn tập).

### 3. Nhạc Nền Du Dương "Love Story" & "Sealed With a Kiss"
* Widget icon cái loa nhỏ gọn gàng ở góc trên bên phải thanh điều hướng.
* Mỗi lần mở trang chọn ngẫu nhiên 1 bản nhạc và phát lặp lại liên tục (loop) bản nhạc đó (không tự động đổi bài khi hết).
* Hỗ trợ nút chuyển bài nhanh (⏭️) trong Popup khi người dùng muốn đổi bài thủ công.
* Bảng điều khiển Popup đầy đủ: Play/Pause, Chuyển bài, Tắt/Bật tiếng, Thanh trượt âm lượng và các phím chọn nhanh (15%, 30%, 50%, 80%).

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

### Bước 1: Khởi chạy trên trình duyệt
Chỉ cần mở file `index.html` trực tiếp bằng trình duyệt Google Chrome, Edge hoặc bất kỳ trình duyệt hiện đại nào, hoặc chạy qua Live Server:
```bash
# Nếu dùng Node.js
npx serve .
```

### Bước 2: Thiết lập Backend Google Sheets (Tùy chọn)
1. Tạo 1 file Google Sheets mới trên Google Drive cá nhân.
2. Vào **Tiện ích mở rộng > Apps Script**.
3. Dán toàn bộ mã nguồn từ file `gas/Code.gs` vào Apps Script và nhấn `Ctrl + S`.
4. Chọn hàm `initDatabase` và bấm **Chạy (Run)** một lần để tự động tạo 5 sheet dữ liệu và tài khoản mẫu.
5. Triển khai Web App:
   * **Triển khai (Deploy)** > **Triển khai mới (New deployment)**.
   * Loại: **Web app**.
   * Thực thi dưới dạng: **Tôi (Me)**.
   * Ai có quyền truy cập: **Bất kỳ ai (Anyone)**.
6. Sao chép Web App URL và dán vào phần **⚙️ Cấu hình Backend** tại trang đăng nhập.

---

## 📁 Cấu Trúc Thư Mục

```text
├── index.html                   # Trang đăng nhập & Cấu hình Backend
├── student_dashboard.html       # Bảng điều khiển & Phòng thi Học sinh
├── teacher_dashboard.html       # Bảng điều khiển Giáo viên
├── Sealed with a kiss.m4a        # Tệp nhạc nền du dương (Phát ngẫu nhiên)
├── love story.mp3               # Tệp nhạc nền du dương (Phát ngẫu nhiên, 30%)
├── css/
│   ├── style.css                # Hệ thống thiết kế chung & Design tokens
│   ├── student.css              # Giao diện thi trắc nghiệm học sinh
│   ├── teacher.css              # Giao diện quản lý & tạo đề thi giáo viên
│   └── bg_music.css             # Giao diện icon loa & popup phát nhạc
├── js/
│   ├── auth.js                  # Logic đăng nhập, phân quyền & bảo mật
│   ├── student.js               # Logic làm bài thi & tính điểm học sinh
│   ├── teacher.js               # Logic tạo đề AI, bóc tách đề & quản lý GV
│   ├── bg_music.js              # Logic phát nhạc nền, âm lượng 30%
│   └── gas_code_content.js      # Mã nguồn Code.gs nhúng sao chép 1 chạm
└── gas/
    └── Code.gs                  # Toàn bộ mã nguồn Google Apps Script backend
```

---

## 👨‍💻 Tác Giả
* **Nguyễn Phi Hùng**
* Hệ thống: **EduTest Pro 2.0**
