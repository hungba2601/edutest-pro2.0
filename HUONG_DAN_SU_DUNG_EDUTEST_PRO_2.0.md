# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0
*(Phiên bản cập nhật Full tính năng mới nhất - Tháng 11/2026)*

**Tác giả phát triển:** Thầy **NGUYỄN PHI HÙNG**  
**Số điện thoại / Zalo hỗ trợ kỹ thuật 24/7:** **0938.750.424**  
**Nền tảng công nghệ:** Serverless Cloud (HTML5/CSS3/JS + Google Apps Script + Google Sheets + Gemini AI)

---

## 📑 MỤC LỤC TỔNG QUAN

1. [PHẦN I: TỔNG QUAN HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN EDUTEST PRO 2.0](#phần-i-tổng-quan-hệ-thống)
2. [PHẦN II: THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT & CƠ SỞ DỮ LIỆU](#phần-ii-thiết-lập-máy-chủ-google-apps-script)
3. [PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN & ADMIN (CỔNG QUẢN TRỊ)](#phần-iii-hướng-dẫn-chi-tiết-dành-cho-giáo-viên--admin)
4. [PHẦN IV: HƯỚNG DẪN PHÂN HỆ MỚI: TAB "TỔNG HỢP ĐIỂM" (TRẮC NGHIỆM & TỰ LUẬN)](#phần-iv-hướng-dẫn-tab-tổng-hợp-điểm)
5. [PHẦN V: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH (PHÒNG THI TRỰC TUYẾN & CHỐNG GIAN LẬN)](#phần-v-hướng-dẫn-chi-tiết-dành-cho-học-sinh)
6. [PHẦN VI: KIẾN TRÚC MÁY CHỦ PHÂN TÁN & TRẠM TRUNG TÂM (CENTRAL HUB)](#phần-vi-kiến-trúc-máy-chủ-phân-tán--central-hub)
7. [PHẦN VII: CÁC TIỆN ÍCH ĐẶC BIỆT: NHẠC NỀN & THIẾT KẾ ĐA NỀN TẢNG](#phần-vii-các-tiện-ích-đặc-biệt)
8. [PHẦN VIII: BẢNG TỔNG HỢP CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ](#phần-viii-câu-hỏi-thường-gặp-faq--xử-lý-sự-cố)
9. [PHẦN IX: THÔNG TIN LIÊN HỆ, BẢN QUYỀN & HỖ TRỢ KỸ THUẬT](#phần-ix-thông-tin-liên-hệ-bản-quyền--hỗ-trợ-kỹ-thuật)

---

## PHẦN I: TỔNG QUAN HỆ THỐNG

### 1.1 Mục tiêu phát triển & Ý nghĩa thực tiễn
- Hỗ trợ đổi mới căn bản, toàn diện phương pháp kiểm tra đánh giá theo **Chương trình Giáo dục Phổ thông 2018**.
- Khắc phục triệt để nhược điểm của Google Forms (không chống gian lận, không hỗ trợ thang điểm lũy tiến Đúng/Sai 4 ý, không quản lý sổ điểm) và phần mềm thương mại đắt đỏ (tốn phí hàng tháng, không làm chủ dữ liệu).
- **EduTest Pro 2.0** là giải pháp Serverless miễn phí trọn đời, trao 100% quyền sở hữu CSDL cho giáo viên trên chính tài khoản Google Drive cá nhân.

### 1.2 Kiến trúc công nghệ không máy chủ (Serverless Cloud)
- **Frontend Tối Ưu:** HTML5, CSS3 Glassmorphism sang trọng, Vanilla JS ES6+ tốc độ tải trang < 1 giây, tương thích mọi thiết bị.
- **Backend Serverless:** Google Apps Script (GAS) tiếp nhận và xử lý API an toàn.
- **Cơ Sở Dữ Liệu:** Google Sheets cá nhân lưu trữ 100% danh sách học sinh, đề thi, điểm số.
- **Trí Tuệ Nhân Tạo:** Google Gemini AI (Gemini 3 Flash, 3.1 Flash-Lite, 2.5 Flash, 3.7 Flash) bóc tách đề thi tự động.

### 1.3 Phân quyền 4 nhóm người dùng
1. **Quản Trị Viên (Admin):** Toàn quyền cấu hình hệ thống, điều phối danh bạ Trạm Trung Tâm (HUB_SERVERS), quản lý tài khoản giáo viên.
2. **Giáo Viên (Teacher):** Soạn đề thi trắc nghiệm & tự luận, phân quyền lớp thi, quản lý học sinh, đổi mật khẩu hàng loạt, nhập điểm tự luận và xem báo cáo.
3. **Ban Giám Hiệu (BGH):** Tài khoản đặc quyền dành riêng cho lãnh đạo nhà trường xem phổ điểm và thống kê toàn trường (*Chế độ chỉ xem - khóa tính năng sửa/xóa bài*).
4. **Học Sinh (Student):** Vào phòng thi làm bài, sử dụng chế độ chống nhìn trộm tự luận, chống gian lận toàn màn hình và xem lại bài thi.

### 1.4 Bảng so sánh tính năng vượt trội

| Tiêu chí so sánh | Google Forms thông thường | Phần mềm thi trực tuyến trả phí | EduTest Pro 2.0 (Bản mới 2026) |
|---|---|---|---|
| **Chi phí bản quyền & máy chủ** | Miễn phí | Thu phí theo tháng/năm | **Hoàn toàn miễn phí trọn đời** |
| **Quyền sở hữu CSDL** | Google cá nhân | Lưu máy chủ nhà cung cấp | **100% trên Google Sheets của GV** |
| **Trợ lý AI bóc tách đề** | Không có | Có (giới hạn lượt dùng) | **Tích hợp Gemini AI không giới hạn** |
| **Trắc nghiệm Đúng/Sai 4 ý** | Không hỗ trợ tính lũy tiến | Hỗ trợ hạn chế | **Chuẩn 100% Bộ GD&ĐT (10%-25%-50%-100%)** |
| **Phân hệ Tổng Hợp Điểm** | Không có | Phải ghép thủ công ngoài Excel | **Tự động ghép điểm TN & điểm TL từ Excel** |
| **Chống nhìn trộm Tự luận** | Không có | Không có | **Độc quyền: Gạch ngang chữ, thu nhỏ & nút 👁️** |
| **Giám sát toàn màn hình** | Không có | Có | **Bắt buộc Fullscreen, tự nộp khi vi phạm quá mức** |
| **Quyền Ban Giám Hiệu (BGH)** | Không có | Có ở gói đắt tiền | **Có sẵn tài khoản BGH theo dõi toàn trường** |
| **Xuất đề ra Word (.docx)** | Không có | Có | **Xuất 1 chạm kèm ma trận đáp án chuẩn Bộ** |
| **Nhạc nền thư giãn phòng thi**| Không có | Không có | **3 bản nhạc bất hủ, tự chuyển âm lượng theo bài** |
| **Trạm Trung Tâm (Central Hub)**| Không có | Phức tạp | **Tự động định tuyến học sinh về đúng GV** |

---

## PHẦN II: THIẾT LẬP MÁY CHỦ GOOGLE APPS SCRIPT

### 2.1 Các bước cài đặt chi tiết
1. Truy cập [Google Drive](https://drive.google.com), bấm **+ Mới** > **Google Trang tính** để tạo bảng tính trắng.
2. Đặt tên bảng tính (ví dụ: `CSDL_EduTest_ThayHung`).
3. Chọn menu **Tiện ích mở rộng** (Extensions) > chọn **Apps Script**.
4. Xóa sạch mã mặc định trong `Code.gs`. Dán toàn bộ mã nguồn `Teacher_Code.gs` (cho Giáo viên) hoặc `Code.gs` (cho Trạm Trung Tâm) vào.
5. Nhấn **Ctrl + S** để lưu dự án.

### 2.2 Khởi tạo tự động CSDL chuẩn hóa
- Tại ô chọn hàm thực thi trên Apps Script, chọn hàm `initDatabase` và bấm **Chạy** (Run).
- Cấp quyền ủy quyền tài khoản Google lần đầu (Review permissions > Advanced > Go to... > Allow).
- Hệ thống tự động tạo 5 bảng chuẩn (hoặc 7 bảng đối với Trạm Trung Tâm):
  1. `DATA_HOCSINH`: Quản lý danh sách học sinh.
  2. `DATA_GIAOVIEN`: Quản lý tài khoản giáo viên.
  3. `DATA_DETHI`: Lưu thông tin đề thi và câu hỏi.
  4. `DATA_KETQUA`: Lưu điểm trắc nghiệm và lịch sử chọn đáp án.
  5. `DATA_TULUAN`: Lưu câu trả lời tự luận của thí sinh.
  6. `HUB_SERVERS` & `HUB_STUDENTS`: Phục vụ mô hình Trạm Trung Tâm toàn trường.

### 2.3 Triển khai Web App (Deploy as Web App)
1. Bấm nút màu xanh **Triển khai** (Deploy) > chọn **Tùy chọn triển khai mới** (New deployment).
2. Bấm biểu tượng Bánh răng cài đặt > chọn **Ứng dụng web** (Web app).
3. **Cấu hình bắt buộc:**
   - *Thực thi dưới dạng (Execute as):* Chọn **Tôi** (Me).
   - *Ai có quyền truy cập (Who has access):* BẮT BUỘC chọn **Bất kỳ ai** (Anyone).
4. Bấm **Triển khai** và sao chép đường dẫn **URL ứng dụng web** (có đuôi `/exec`).

### 2.4 Tiện ích Sao Chép Mã Nguồn GAS Code 1 Chạm
- Ngay trên thanh công cụ của Cổng Giáo Viên, giáo viên chỉ cần bấm nút **"Sao chép mã nguồn GAS"** là toàn bộ mã nguồn chuẩn 5 Sheet mới nhất được lưu vào Clipboard để dán thẳng vào Google Apps Script!

---

## PHẦN III: HƯỚNG DẪN CHI TIẾT DÀNH CHO GIÁO VIÊN & ADMIN

### 3.1 Đăng nhập & Phân quyền Ban Giám Hiệu (BGH)
- **Tài khoản Giáo viên:** Soạn đề, chỉnh sửa đề, cấu hình kỳ thi, quản lý học sinh, nhập điểm tự luận, xóa bài thi học sinh khi cần thi lại.
- **Tài khoản Ban Giám Hiệu (BGH):** Xem tiến độ thi và bảng điểm toàn trường, theo dõi chỉ số KPI; hệ thống tự động ẩn nút sửa/xóa bài để đảm bảo tính khách quan.

### 3.2 Cấu hình Trợ lý AI Google Gemini
- Bấm nút **Cấu hình Trợ Lý AI**.
- Dán khóa **Gemini API Key** miễn phí từ [Google AI Studio](https://aistudio.google.com).
- Hỗ trợ các mô hình AI:
  - `Gemini 3 Flash Preview`: Tốc độ cực nhanh, bóc tách chuẩn xác nhất (Khuyên dùng).
  - `Gemini 3.1 Flash-Lite`: Tiết kiệm token, siêu nhẹ.
  - `Gemini 2.5 Flash`: Ổn định, bóc tách tốt câu hỏi dài.
  - `Gemini 3.7 Flash`: Suy luận cao cấp đối với đề thi tự nhiên.

### 3.3 Quy trình Soạn đề & Bóc tách Đề thi Thông minh
- **Cách 1: Kéo thả file Word (.docx) hoặc PDF:**
  - Bấm *Bóc tách bằng Thuật toán*: Xử lý trong 0.2 giây bằng regex nội bộ siêu tốc.
  - Bấm *Bóc tách bằng Gemini AI*: Đọc hiểu tự nhiên và phân loại chính xác 3 phần câu hỏi.
- **Cách 2: Dán trực tiếp văn bản thô:** Dán đề thi từ bất kỳ tài liệu nào và bấm bóc tách.
- **Cách 3: Soạn thủ công 3 dạng câu hỏi chuẩn Bộ GD&ĐT:**
  - *Phần I: Trắc nghiệm 4 lựa chọn* (A, B, C, D).
  - *Phần II: Trắc nghiệm Đúng / Sai 4 ý* (a, b, c, d) - Chấm điểm thang lũy tiến: Đúng 1 ý = 10%, Đúng 2 ý = 25%, Đúng 3 ý = 50%, Đúng 4 ý = 100%.
  - *Phần III: Câu hỏi Tự Luận*.
- **Tiện ích:** Nút `⚡ Chia đều 10đ` (tự cân bằng điểm tròn 10.0đ) và nút `Xuất DOCX` (xuất file Word chuẩn ma trận Bộ GD&ĐT).

### 3.4 Cấu hình Kỳ kiểm tra & Thiết lập Phòng thi
- **Trạng thái:** Mở (học sinh thấy bài và thi) hoặc Đóng (tạm ẩn đề thi).
- **Chế độ thi:**
  - *Ôn tập / Luyện tập:* Cho phép làm nhiều lần; sau khi nộp được xem lại đề và đáp án chi tiết.
  - *Thi / Kiểm tra chính thức:* Chỉ làm 1 lần; sau khi nộp bài sẽ khóa đề và khóa xem đáp án.
- **Giám sát toàn màn hình:** Tự động bắt lỗi thoát tab, thu nhỏ cửa sổ; tự động nộp bài khi học sinh vi phạm vượt mức cho phép.
- **Phân quyền lớp:** Tích chọn Khối và Lớp cụ thể được phép thi.

### 3.5 Quản lý Đề thi: Chia sẻ & Sao chép Đề thi 1 Click (Duplicate)
- **Chia sẻ đề thi:** Chia sẻ link đề thi cho đồng nghiệp trong trường.
- **Sao chép đề thi (Duplicate):** Nhân bản đề thi ngay lập tức để chỉnh sửa cho các lớp khác mà không cần soạn lại từ đầu.

### 3.6 Quản lý Học sinh & Đổi mật khẩu hàng loạt
- Thêm từng học sinh hoặc cấp lại mật khẩu cho học sinh quên tài khoản.
- **Đổi mật khẩu HÀNG LOẠT (Batch Reset):** Chọn Khối hoặc Lớp, nhập mật khẩu chung mới (ví dụ: `123`) và cập nhật đồng loạt trong 1 giây.
- Xuất danh sách học sinh ra file Excel (.xlsx).

### 3.7 Thống kê Kết quả & Cơ chế Xóa bài thi tức thì (Direct DOM Sync)
- **4 thẻ KPI:** Tổng bài nộp, Điểm TB, Điểm cao nhất/thấp nhất, Tỉ lệ đạt (>= 5.0).
- **Phân trang:** Xem 60, 100, 200 hoặc Tất cả học sinh/trang.
- **Hiện đủ danh sách lớp:** Tự động chèn những học sinh chưa làm bài vào bảng điểm (để trống điểm) để giáo viên đôn đốc.
- **Xóa bài thi tức thì (Direct DOM):** Bấm nút xóa bài [🗑️] của học sinh, dòng bài thi lập tức chuyển sang trạng thái "Chưa làm bài" ngay trước mắt, cố định vĩnh viễn và đồng bộ lệnh xóa sạch trên Google Sheets, không bị giật lag hay hiện lại điểm cũ.

---

## PHẦN IV: HƯỚNG DẪN TAB "TỔNG HỢP ĐIỂM"

### 4.1 Ý nghĩa của Phân hệ Tổng Hợp Điểm
- Giải quyết bài toán ghép điểm 70% Trắc nghiệm (hệ thống tự chấm) và 30% Tự luận (thầy cô chấm tay).
- Tự động cộng: `Tổng Điểm = Điểm TN + Điểm TL` và xuất bảng điểm chuẩn sổ điểm điện tử.

### 4.2 Quy trình 3 bước sử dụng
1. **Bước 1 - Tải File Mẫu Tự Luận (.xlsx):** Bấm nút *Tải File Mẫu Tự Luận (.xlsx)* để nhận file Excel có sẵn danh sách học sinh của lớp và cột Điểm Tự Luận để trống.
2. **Bước 2 - Giáo viên chấm bài & Nhập điểm vào Excel:** Nhập điểm tự luận của từng em vào file Excel và lưu lại.
3. **Bước 3 - Nhập Điểm Tự Luận (Upload File):** Bấm nút *Nhập Điểm Tự Luận (Upload File)*, chọn file Excel vừa chấm. Hệ thống tự động so khớp, cộng điểm và đồng bộ lên Google Sheets.

### 4.3 Xuất Bảng Điểm Tổng Hợp (.xlsx)
- Bấm nút *Xuất Excel Bảng Tổng Hợp (.xlsx)* để tải về bảng điểm chính thức phục vụ vào sổ điểm điện tử VnEdu, SMAS hoặc nộp Ban Giám Hiệu.

---

## PHẦN V: HƯỚNG DẪN CHI TIẾT DÀNH CHO HỌC SINH

### 5.1 Đăng nhập & Lưu ý Sống còn
- Truy cập trang đăng nhập, chọn vai trò **Học sinh**.
- **BẮT BUỘC CHỌN ĐÚNG THẦY/CÔ PHỤ TRÁCH:** Tại danh sách thả xuống, học sinh phải chọn đúng tên giáo viên đang dạy lớp mình. *(Nếu chọn sai giáo viên sẽ không đăng nhập được hoặc bài làm bị gửi nhầm máy chủ)*.
- Nhập Mã học sinh và Mật khẩu > Bấm **Đăng Nhập**.

### 5.2 Giao diện Phòng thi & Bảng câu hỏi
- **Đồng hồ đếm ngược:** Đổi màu đỏ khi còn dưới 5 phút; tự động thu bài khi hết giờ.
- **Bảng câu hỏi:** Hiển thị ô màu xám (chưa làm) và màu xanh lá (đã hoàn thành). Bấm vào số câu để cuộn nhanh đến câu đó.

### 5.3 Tính năng Độc quyền: CHỐNG NHÌN TRỘM TỰ LUẬN (Anti-Peep Mode)
- **Gạch ngang & Thu nhỏ chữ tự động:** Khi học sinh gõ chữ vào khung tự luận, toàn bộ văn bản tự động có đường gạch ngang ở giữa và thu nhỏ lại, khiến bạn ngồi bên cạnh không thể nhìn trộm nội dung.
- **Nút con mắt 👁️ xem lại bài:** Bấm nút con mắt 👁️ ở góc câu hỏi tự luận để tạm hiện lại chữ bình thường khi cần đọc soát bài. Bấm lại một lần nữa để tiếp tục che bài.

### 5.4 Cơ chế Giám sát Chống gian lận Nâng cao (Anti-Cheat 2.0)
- Bắt buộc toàn màn hình (Fullscreen) khi làm bài thi chính thức.
- Bịt kín lỗ hổng Nộp bài - Hủy: Kể cả khi học sinh bấm Nộp bài rồi chọn Hủy hộp thoại, màn hình vẫn giữ chế độ giám sát toàn màn hình.
- Nhấn Esc, thu nhỏ cửa sổ hoặc chuyển tab đều bị cảnh báo đỏ. Vi phạm quá số lần cho phép sẽ bị **TỰ ĐỘNG KHÓA VÀ NỘP BÀI CƯỠNG CHẾ**.

---

## PHẦN VI: KIẾN TRÚC MÁY CHỦ PHÂN TÁN & CENTRAL HUB

### 6.1 Giải bài toán nghẽn mạng toàn trường
- **Trạm Trung Tâm (Hub Server):** Điều phối danh bạ giáo viên và Web App của từng giáo viên trong trường.
- **Máy chủ Giáo viên Phân tán:** Mỗi thầy cô sở hữu 1 Google Sheet độc lập, đảm bảo không bao giờ bị nghẽn mạng dù hàng nghìn học sinh thi cùng lúc.
- **Tự động Định tuyến:** Học sinh vào trang chung, hệ thống tự động điều hướng kết nối an toàn về đúng máy chủ của thầy cô phụ trách lớp.

### 6.2 Quy trình Đồng bộ Dữ liệu lên Trạm Trung Tâm
1. Giáo viên cập nhật danh sách học sinh lớp mình trên Google Sheet cá nhân.
2. Tại Cổng Giáo Viên > Tab *Quản Lý Học Sinh*, bấm nút **🌐 Đồng bộ Trạm Trung Tâm**.
3. Hệ thống tự động gửi danh bạ mã học sinh lên bảng `HUB_STUDENTS` của Trạm Trung Tâm.

---

## PHẦN VII: CÁC TIỆN ÍCH ĐẶC BIỆT

### 7.1 Widget Nhạc Nền Thư Giãn Phòng Thi & Âm Lượng Thông Minh
- Nút biểu tượng Loa nhỏ gọn góc trên bên phải thanh điều hướng.
- **Danh sách 3 ca khúc bất hủ phát ngẫu nhiên:**
  1. *Woman in Love* (Barbra Streisand) - Tự động phát ở mức **50% âm lượng**.
  2. *Love Story* (Taylor Swift) - Tự động phát ở mức **30% âm lượng**.
  3. *Sealed With a Kiss* (Brian Hyland) - Tự động phát ở mức **30% âm lượng**.
- **Cơ chế âm lượng thông minh:** Tự động điều chỉnh âm lượng chuẩn khi chuyển bài (Next / Shuffle).
- Bảng điều khiển popup: Play/Pause, Đổi bài nhanh, Mute, Thanh kéo âm lượng (0 - 100%) và 4 nấc chọn nhanh (15%, 30%, 50%, 80%).

### 7.2 Trải nghiệm Đáp ứng Đa nền tảng (Responsive Design)
- **Máy tính / Laptop:** Giao diện 2 cột rộng rãi, thanh điều hướng câu hỏi bám dính khi cuộn.
- **Điện thoại / Máy tính bảng:** Bảng câu hỏi chuyển thành ngăn kéo trượt (Mobile Drawer), thanh điều hướng đáy tiện dụng, giao diện chạm chuẩn công thái học.

---

## PHẦN VIII: CÂU HỎI THƯỜNG GẶP (FAQ) & XỬ LÝ SỰ CỐ

### 8.1 Học sinh không đăng nhập được?
- Nhắc học sinh kiểm tra xem đã chọn đúng tên Thầy/Cô phụ trách chưa.
- Kiểm tra mã học sinh trong sheet `DATA_HOCSINH`. Sử dụng tính năng Cấp lại mật khẩu lẻ hoặc Đổi mật khẩu hàng loạt nếu học sinh quên.
- Kiểm tra lại bản Deploy Web App trên Google Apps Script đã chọn mục *Who has access: Anyone* chưa.

### 8.2 Bị mất điện hoặc rớt mạng khi đang thi?
- Toàn bộ đáp án học sinh đã chọn được lưu liên tục vào Local Storage trên máy.
- Khi có mạng hoặc điện lại, học sinh tải lại trang web là có thể tiếp tục làm bài mà không bị mất dữ liệu.

### 8.3 Cách cho học sinh thi lại khi gặp sự cố bất khả kháng?
- Giáo viên vào Tab *Xem Kết Quả & Thống Kê*, chọn đúng Đề thi và Lớp.
- Tìm học sinh đó, bấm nút xóa [🗑️]. Dòng bài thi chuyển ngay sang trạng thái Chưa làm bài và Google Sheets được xóa sạch. Học sinh có thể vào thi lại bình thường.

### 8.4 Bảo mật đề thi trước giờ kiểm tra?
- Để công tắc *Trạng thái kỳ thi* ở chế độ **ĐÓNG**. Đúng đến giờ kiểm tra chỉ cần gạt sang **MỞ** là học sinh sẽ thấy đề thi.

---

## PHẦN IX: THÔNG TIN LIÊN HỆ, BẢN QUYỀN & HỖ TRỢ KỸ THUẬT

Hệ thống **EduTest Pro 2.0** được nghiên cứu và phát triển bởi Thầy **Nguyễn Phi Hùng** với tâm huyết đóng góp một công cụ khảo thí hiện đại, mạnh mẽ, công bằng và hoàn toàn miễn phí cho cộng đồng giáo dục Việt Nam.

- **Tác giả phát triển:** Thầy **NGUYỄN PHI HÙNG**
- **Số điện thoại / Zalo tư vấn & hỗ trợ kỹ thuật:** **0938.750.424**
- **Lĩnh vực hỗ trợ:** Cài đặt hệ thống, tích hợp AI bóc tách đề, chuyển giao công nghệ cho tổ chuyên môn, tùy biến theo nhận diện thương hiệu của từng nhà trường.
- **Bản quyền:** Phần mềm mã nguồn mở phục vụ phi thương mại cho các trường học và thầy cô giáo trên toàn quốc.

*Kính chúc quý Thầy Cô có những trải nghiệm giảng dạy và kiểm tra đánh giá hiệu quả, chúc các em học sinh luôn tự tin và đạt thành tích xuất sắc trong học tập!*
