# HƯỚNG DẪN CÀI ĐẶT BACKEND GOOGLE APPS SCRIPT & GOOGLE SHEETS

Hệ thống sử dụng **Google Sheets** làm cơ sở dữ liệu và **Google Apps Script (GAS)** làm REST API server.

---

## BƯỚC 1: TẠO GOOGLE SHEETS MỚI
1. Truy cập [Google Sheets](https://sheets.new) để tạo một bảng tính mới.
2. Đặt tên bảng tính, ví dụ: `DB_HE_THONG_THI_TRAC_NGHIEM`.

---

## BƯỚC 2: DÁN MÃ NGUỒN VÀO APPS SCRIPT
1. Trên thanh menu Google Sheets, chọn: **Tiện ích mở rộng (Extensions)** ➔ **Apps Script**.
2. Một tab mới mở ra với file `Mã.gs` (hoặc `Code.gs`).
3. Xóa toàn bộ nội dung mặc định và copy toàn bộ nội dung từ file [gas/Code.gs](file:///d:/DU%20AN/WEB%20KI%E1%BB%82M%20TRA/gas/Code.gs) dán vào.
4. Bấm biểu tượng **Lưu (Save)** (hoặc phím tắt `Ctrl + S`).

---

## BƯỚC 3: TỰ ĐỘNG KHỞI TẠO 4 SHEETS & DỮ LIỆU MẪU
1. Tại thanh công cụ phía trên của Apps Script, ở ô chọn hàm, chọn hàm **`initDatabase`**.
2. Bấm nút **Chạy (Run)**.
3. Khi được yêu cầu cấp quyền:
   - Bấm **Xem xét quyền (Review permissions)**.
   - Chọn tài khoản Google của bạn.
   - Bấm **Nâng cao (Advanced)** ➔ Chọn **Đi tới ... (Không an toàn) / Go to ... (unsafe)**.
   - Bấm **Cho phép (Allow)**.
4. Quay lại bảng tính Google Sheets của bạn, bạn sẽ thấy 4 Sheet cốt lõi đã được tự động tạo kèm màu tiêu đề và dữ liệu mẫu:
   - **DATA_HOCSINH**: Có sẵn tài khoản mẫu `HS001`, `HS002`, `HS003` (Mật khẩu: `123`).
   - **DATA_GIAOVIEN**: Có sẵn tài khoản mẫu `GV001`, `GV002` (Mật khẩu: `123`).
   - **DATA_DETHI**: Đầy đủ 7 cột sẵn sàng cho module tạo đề.
   - **DATA_KETQUA**: Đầy đủ 13 cột sẵn sàng lưu kết quả thi.

---

## BƯỚC 4: TRIỂN KHAI THÀNH WEB APP (DEPLOY)
1. Ở góc trên bên phải của trang Apps Script, bấm nút **Triển khai (Deploy)** ➔ Chọn **Tùy chọn triển khai mới (New deployment)**.
2. Bấm biểu tượng bánh răng **Chọn loại** (Select type) ➔ Chọn **Ứng dụng web (Web app)**.
3. Điền các trường sau:
   - **Mô tả (Description):** `API Đăng nhập và Thi trực tuyến v1`
   - **Thực thi dưới dạng (Execute as):** `Tôi (email của bạn)`
   - **Ai có quyền truy cập (Who has access):** Chọn **Bất kỳ ai (Anyone)** *(Rất quan trọng để frontend có thể gọi được API)*.
4. Bấm nút **Triển khai (Deploy)**.
5. Copy đường link tại mục **URL ứng dụng web (Web app URL)** (Đường dẫn có dạng: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## BƯỚC 5: CẬP NHẬT VÀO FRONTEND
1. Mở file [js/auth.js](file:///d:/DU%20AN/WEB%20KI%E1%BB%82M%20TRA/js/auth.js).
2. Tìm dòng thứ 8:
   ```javascript
   const API_URL = "URL_GOOGLE_APPS_SCRIPT_CUA_TOI_SE_DIEN_SAU";
   ```
3. Thay thế bằng URL bạn vừa copy ở Bước 4:
   ```javascript
   const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
4. Lưu file và mở [index.html](file:///d:/DU%20AN/WEB%20KI%E1%BB%82M%20TRA/index.html) bằng trình duyệt để kiểm tra!

---

## BƯỚC 6: CẬP NHẬT PHIÊN BẢN MỚI CỦA APPS SCRIPT (Mỗi khi sửa Code.gs)
Mỗi khi bạn copy code mới từ file [gas/Code.gs](file:///d:/DU%20AN/WEB%20KI%E1%BB%82M%20TRA/gas/Code.gs) vào Google Apps Script:
1. Bấm **Lưu (Save)** trong Apps Script.
2. Bấm nút **Triển khai (Deploy)** ➔ **Quản lý các bản triển khai (Manage deployments)**.
3. Bấm biểu tượng **Cây bút chì (Chỉnh sửa / Edit)** ở góc trên bên phải của bản triển khai.
4. Ở mục **Phiên bản (Version)**, bấm chọn **Phiên bản mới (New version)**.
5. Bấm nút **Triển khai (Deploy)**.
*(Thao tác này giữ nguyên đường link URL cũ mà vẫn cập nhật được toàn bộ code mới nhất của Module 2 và Module 3!)*

---

## TÀI KHOẢN MẪU ĐỂ TEST NGAY:
- **Học sinh:**
  - Tài khoản: `HS001` | Mật khẩu: `123`
  - Tài khoản: `HS002` | Mật khẩu: `123`
- **Giáo viên:**
  - Tài khoản: `GV001` | Mật khẩu: `123`
