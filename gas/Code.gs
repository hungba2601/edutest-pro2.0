/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT (GAS) - HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN
 * ============================================================================
 * Hướng dẫn nhanh:
 * 1. Mở Google Sheets của bạn.
 * 2. Chọn Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Dán toàn bộ mã nguồn bên dưới vào file Code.gs.
 * 4. Chạy hàm 'initDatabase()' một lần duy nhất để tự động tạo 4 Sheet và nạp dữ liệu mẫu.
 * 5. Bấm 'Triển khai' (Deploy) -> 'Tùy chọn triển khai mới' (New deployment).
 *    - Loại: 'Ứng dụng web' (Web app).
 *    - Thực thi dưới dạng (Execute as): 'Tôi' (Me).
 *    - Ai có quyền truy cập (Who has access): 'Bất kỳ ai' (Anyone).
 * 6. Sao chép 'URL ứng dụng web' (Web App URL) và dán vào biến API_URL trong file js/auth.js.
 * ============================================================================
 */

// ============================================================================
// CẤU HÌNH LIÊN KẾT BẢNG TÍNH GOOGLE SHEETS
// Dán link Google Sheets của bạn vào đây (nếu để trống, code sẽ tự dùng Sheet đang mở)
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1MCOXMDiLbh_Nifk1RxkI0jk8YIJ0hHndvz2dp7Ip5Y/edit"; 

// PHIÊN BẢN BACKEND HIỆN TẠI (DẠNG SỐ: 2.1, 2.2, 2.3,...)
const CURRENT_BACKEND_VERSION = "2.3";

// ĐỊNH NGHĨA TÊN CÁC SHEET DỮ LIỆU
const SHEETS = {
  HOCSINH: "DATA_HOCSINH",
  GIAOVIEN: "DATA_GIAOVIEN",
  DETHI: "DATA_DETHI",
  KETQUA: "DATA_KETQUA",
  TULUAN: "DATA_TULUAN",
  HUB_SERVERS: "HUB_SERVERS",   // Danh bạ Máy chủ các Giáo viên (Trạm Trung Tâm)
  HUB_STUDENTS: "HUB_STUDENTS"  // Danh bạ Học sinh định tuyến tự động (Trạm Trung Tâm)
};

/**
 * Hàm lấy đối tượng Spreadsheet linh hoạt (hỗ trợ cả URL hoặc Sheet hiện hành)
 */
function getSpreadsheet() {
  try {
    if (SPREADSHEET_URL && SPREADSHEET_URL.trim() !== "") {
      return SpreadsheetApp.openByUrl(SPREADSHEET_URL.trim());
    }
  } catch (eUrl) {
    Logger.log("Lỗi openByUrl, chuyển sang getActiveSpreadsheet: " + eUrl);
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (eActive) {
    Logger.log("Lỗi getActiveSpreadsheet: " + eActive);
  }
  return null;
}

/**
 * ============================================================================
 * HÀM CHẠY TRỰC TIẾP: TỰ ĐỘNG THÊM CỘT D (QUYỀN) VÀO SHEET DATA_GIAOVIEN
 * Chọn hàm 'chayThemCotQuyenChoGiaoVien' trong menu dropdown rồi bấm 'Chạy' (Run)
 * ============================================================================
 */
function chayThemCotQuyenChoGiaoVien() {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log("❌ Không thể kết nối Bảng tính Google Sheets. Vui lòng kiểm tra lại SPREADSHEET_URL!");
    return;
  }
  let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
  if (!sheetGV) {
    Logger.log("❌ Không tìm thấy Sheet DATA_GIAOVIEN!");
    return;
  }
  ensureGiaoVienSheetColumns(sheetGV);
  Logger.log("🎉 Hoàn tất quá trình thêm Cột D (Quyền) vào Sheet DATA_GIAOVIEN!");
}

/**
 * ============================================================================
 * HÀM CHẠY TRỰC TIẾP: TỰ ĐỘNG ĐỒNG BỘ LỚP GIẢNG DẠY TỪ URL CỦA TẤT CẢ GIÁO VIÊN
 * Chọn hàm 'chayDongBoLopGiangDayTuSheetGiaoVien' trong menu dropdown rồi bấm 'Chạy' (Run)
 * ============================================================================
 */
function chayDongBoLopGiangDayTuSheetGiaoVien() {
  Logger.log("⏳ Bắt đầu quét các URL máy chủ giáo viên trong HUB_SERVERS...");
  const result = handleSyncClassesFromHubServers();
  Logger.log("🎉 Kết quả đồng bộ lớp: " + JSON.stringify(result));
}

/**
 * Hàm khởi tạo tự động 5 Sheet chuẩn cấu trúc nếu chưa có và thêm tài khoản mẫu
 * Chạy hàm này 1 lần duy nhất trong trình soạn thảo Apps Script để kiểm tra
 */
function initDatabase() {
  const ss = getSpreadsheet();

  // 1. Cấu trúc Sheet DATA_HOCSINH
  let sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
  if (!sheetHS) {
    sheetHS = ss.insertSheet(SHEETS.HOCSINH);
    const headers = ["Tài khoản HS", "Mật khẩu", "Lớp", "Họ tên", "Ngày sinh", "Giới tính", "Trường"];
    sheetHS.appendRow(headers);
    formatHeaderRow(sheetHS);

    // Thêm dữ liệu học sinh mẫu
    sheetHS.appendRow(["HS001", "123", "9A1", "Nguyễn Văn An", "15/05/2010", "Nam", "THCS Chu Văn An"]);
    sheetHS.appendRow(["HS002", "123", "9A2", "Trần Thị Mai", "20/08/2010", "Nữ", "THCS Chu Văn An"]);
    sheetHS.appendRow(["HS003", "123", "9A1", "Lê Bảo Long", "02/11/2010", "Nam", "THCS Chu Văn An"]);
  }

  // 2. Cấu trúc Sheet DATA_GIAOVIEN (Cột A: Tài khoản GV, B: Mật khẩu, C: Họ tên GV, D: Quyền, E: Lớp giảng dạy, F: Trường, G: Phiên bản Backend GV)
  let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
  if (!sheetGV) {
    sheetGV = ss.insertSheet(SHEETS.GIAOVIEN);
    const headers = ["Tài khoản GV", "Mật khẩu", "Họ tên GV", "Quyền", "Lớp giảng dạy", "Trường", "Phiên bản Backend GV"];
    sheetGV.appendRow(headers);
    formatHeaderRow(sheetGV);

    // Thêm dữ liệu giáo viên mẫu và tài khoản Ban Giám Hiệu (mặc định quyền gv)
    sheetGV.appendRow(["admin", "123456", "Ban Giám Hiệu", "gv", "", "THCS Chu Văn An", CURRENT_BACKEND_VERSION]);
    sheetGV.appendRow(["0938750424", "hung2601", "Nguyễn Phi Hùng", "admin", "8A1, 9A1", "THCS Chu Văn An", CURRENT_BACKEND_VERSION]);
    sheetGV.appendRow(["GV001", "123", "Thầy Lê Hoàng Nam", "gv", "9A1, 9A2", "THCS Chu Văn An", CURRENT_BACKEND_VERSION]);
    sheetGV.appendRow(["GV002", "123", "Cô Nguyễn Thùy Chi", "gv", "9A1, 9A3", "THCS Chu Văn An", CURRENT_BACKEND_VERSION]);
  } else {
    // Đảm bảo có đủ cột D là Quyền và các cột còn lại
    ensureGiaoVienSheetColumns(sheetGV);
    // Đảm bảo có tài khoản Admin nếu sheet đã tồn tại
    try {
      const gvRows = sheetGV.getDataRange().getValues();
      let hasAdmin = false;
      for (let r = 1; r < gvRows.length; r++) {
        if (String(gvRows[r][3] || "").trim().toLowerCase() === "admin") {
          hasAdmin = true;
          break;
        }
      }
      if (!hasAdmin) {
        sheetGV.appendRow(["0938750424", "hung2601", "Nguyễn Phi Hùng", "admin", "", "THCS An Nhơn", CURRENT_BACKEND_VERSION]);
      }
    } catch (eAdmin) {}
  }

  // 3. Cấu trúc Sheet DATA_DETHI (Gồm 8 cột: thêm cột Chế độ xem bài)
  let sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    sheetDeThi = ss.insertSheet(SHEETS.DETHI);
    const headers = ["Mã đề thi", "Tên kỳ kiểm tra", "Tài khoản GV tạo", "Lớp được phép thi", "Thời gian làm bài", "Trạng thái (Đóng/Mở)", "Chế độ xem bài", "Chế độ xem điểm", "Số lần cảnh báo", "Dữ liệu đề (JSON)"];
    sheetDeThi.appendRow(headers);
    formatHeaderRow(sheetDeThi);
  } else {
    ensureDeThiSheetColumns(sheetDeThi);
  }

  // 4. Cấu trúc Sheet DATA_KETQUA
  let sheetKetQua = ss.getSheetByName(SHEETS.KETQUA);
  if (!sheetKetQua) {
    sheetKetQua = ss.insertSheet(SHEETS.KETQUA);
    const headers = [
      "Tài khoản HS", "Lớp", "Họ tên", "Ngày sinh", "Giới tính", "Trường",
      "Thời gian đăng nhập", "Mã đề thi", "Tài khoản GV của đề thi",
      "Điểm tổng", "Số câu đúng/sai", "Thời gian nộp bài", "Chi tiết trả lời"
    ];
    sheetKetQua.appendRow(headers);
    formatHeaderRow(sheetKetQua);
  }

  // 5. Cấu trúc Sheet DATA_TULUAN (Lưu kết quả làm bài tự luận của học sinh để GV chấm thủ công)
  let sheetTuLuan = ss.getSheetByName(SHEETS.TULUAN);
  if (!sheetTuLuan) {
    sheetTuLuan = ss.insertSheet(SHEETS.TULUAN);
    const headers = [
      "Tài khoản HS", "Lớp", "Họ tên", "Ngày sinh", "Giới tính", "Trường",
      "Thời gian đăng nhập", "Mã đề thi", "Tên kỳ kiểm tra", "Thời gian nộp bài",
      "Câu 1 (Tự luận)", "Câu 2 (Tự luận)", "Câu 3 (Tự luận)", "Điểm Tự Luận (GV chấm)", "Nhận xét của GV"
    ];
    sheetTuLuan.appendRow(headers);
    formatHeaderRow(sheetTuLuan, "#059669"); // Màu xanh ngọc chuẩn chuyên nghiệp
  }

  // 6. Cấu trúc Sheet HUB_SERVERS (Danh bạ Máy chủ các Giáo viên)
  let sheetHubServers = ss.getSheetByName(SHEETS.HUB_SERVERS);
  if (!sheetHubServers) {
    sheetHubServers = ss.insertSheet(SHEETS.HUB_SERVERS);
    const headers = ["Mã GV", "Họ tên GV", "Trường", "URL Web App (Server)", "Trạng thái", "Ngày cập nhật"];
    sheetHubServers.appendRow(headers);
    formatHeaderRow(sheetHubServers, "#4f46e5"); // Màu tím chàm công nghệ
  }

  // 7. Cấu trúc Sheet HUB_STUDENTS (Bảng định tuyến tự động Học sinh -> Server GV)
  let sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS);
  if (!sheetHubStudents) {
    sheetHubStudents = ss.insertSheet(SHEETS.HUB_STUDENTS);
    const headers = ["Mã HS", "Họ tên HS", "Lớp", "Trường", "Mã GV", "URL Web App (Server)", "Ngày cập nhật"];
    sheetHubStudents.appendRow(headers);
    formatHeaderRow(sheetHubStudents, "#d97706"); // Màu cam hổ phách nổi bật
  }

  Logger.log("✅ Khởi tạo cơ sở dữ liệu thành công với đầy đủ 7 Sheets (kèm Trạm Trung Tâm HUB)!");
}

/**
 * Đảm bảo Sheet DATA_TULUAN tồn tại và có đủ số lượng cột cho các câu tự luận của đề thi
 */
function ensureTuLuanSheet(ss, essayQuestionCount) {
  let sheetTuLuan = ss.getSheetByName(SHEETS.TULUAN);
  const baseHeaders = [
    "Tài khoản HS", "Lớp", "Họ tên", "Ngày sinh", "Giới tính", "Trường",
    "Thời gian đăng nhập", "Mã đề thi", "Tên kỳ kiểm tra", "Thời gian nộp bài"
  ];
  const count = Math.max(Number(essayQuestionCount) || 1, 1);

  if (!sheetTuLuan) {
    sheetTuLuan = ss.insertSheet(SHEETS.TULUAN);
    const headers = [...baseHeaders];
    for (let i = 1; i <= count; i++) {
      headers.push(`Câu ${i} (Tự luận)`);
    }
    headers.push("Điểm Tự Luận (GV chấm)", "Nhận xét của GV");
    sheetTuLuan.appendRow(headers);
    formatHeaderRow(sheetTuLuan, "#059669");
    return sheetTuLuan;
  }

  // Nếu sheet đã có, kiểm tra xem số cột câu hỏi tự luận đã đủ chưa
  const lastCol = sheetTuLuan.getLastColumn();
  if (lastCol === 0) {
    const headers = [...baseHeaders];
    for (let i = 1; i <= count; i++) {
      headers.push(`Câu ${i} (Tự luận)`);
    }
    headers.push("Điểm Tự Luận (GV chấm)", "Nhận xét của GV");
    sheetTuLuan.appendRow(headers);
    formatHeaderRow(sheetTuLuan, "#059669");
    return sheetTuLuan;
  }

  const existingHeaders = sheetTuLuan.getRange(1, 1, 1, lastCol).getValues()[0];
  // Đếm xem hiện tại có bao nhiêu cột "Câu X (Tự luận)"
  let currentEssayCols = 0;
  for (let c = 0; c < existingHeaders.length; c++) {
    const h = String(existingHeaders[c] || "").toLowerCase();
    if (h.includes("câu") && (h.includes("tự luận") || h.includes("tl"))) {
      currentEssayCols++;
    }
  }

  // Nếu đề thi này có nhiều câu tự luận hơn số cột hiện tại, mở rộng thêm cột
  if (count > currentEssayCols) {
    // Vị trí chèn trước các cột "Điểm Tự Luận", "Nhận xét"
    for (let i = currentEssayCols + 1; i <= count; i++) {
      const colTitle = `Câu ${i} (Tự luận)`;
      sheetTuLuan.insertColumnAfter(sheetTuLuan.getLastColumn() - 2);
      sheetTuLuan.getRange(1, sheetTuLuan.getLastColumn() - 2).setValue(colTitle);
    }
    formatHeaderRow(sheetTuLuan, "#059669");
  }

  return sheetTuLuan;
}

// Định dạng hàng tiêu đề đẹp mắt
function formatHeaderRow(sheet, bgColor) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setBackground(bgColor || "#2563eb");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Xử lý yêu cầu GET (vừa kiểm tra trạng thái, vừa hỗ trợ fallback truy vấn dữ liệu)
 */
/**
 * Chuẩn hóa giá trị phiên bản backend thành chuỗi phiên bản dạng số (ví dụ: 2.0, 2.1, 2.2,...)
 * Tuyệt đối không hiển thị dạng ngày tháng (DD/MM/YYYY)
 */
function formatBackendVersion(val, fallback = "2.0") {
  try {
    if (val === null || val === undefined || String(val).trim() === "") {
      return fallback;
    }
    // Nếu là đối tượng Date (do Google Sheets tự ép kiểu số 2.1 thành ngày)
    if (Object.prototype.toString.call(val) === "[object Date]" || val instanceof Date) {
      if (!isNaN(val.getTime())) {
        const d = val.getDate();
        const m = val.getMonth() + 1;
        // Nếu là ngày 2/1 hoặc 1/2 -> do gõ 2.1 hoặc 1.2
        if (d === 2 && m === 1) return "2.1";
        if (d === 26 && m === 10) return "2.0"; // Giá trị ngày cũ quy về bản cũ 2.0
        return d + "." + m;
      }
    }
    let str = String(val).trim();
    if (str.startsWith("'")) str = str.substring(1).trim();

    // Nếu là chuỗi ngày tháng cũ (ví dụ 26/10/2026 hoặc GMT) quy về phiên bản cũ 2.0
    if (str.indexOf("26/10/2026") !== -1 || str.indexOf("GMT") !== -1 || /^[A-Z][a-z]{2}\s/.test(str)) {
      return "2.0";
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      return "2.0";
    }

    // Trích xuất số phiên bản như 2.0, 2.1, 2.2, 2.3, 3.0,...
    const match = str.match(/v?(\d+(\.\d+)+)/i);
    if (match) {
      return match[1];
    }
    if (/^\d+$/.test(str)) {
      return str + ".0";
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}

// Giữ alias an toàn cho tương thích ngược
const formatBackendVersionDate = formatBackendVersion;

/**
 * Lập bản đồ vị trí các cột trong Sheet DATA_GIAOVIEN linh hoạt
 * Chuẩn mới: Cột A: Tài khoản GV (0) | B: Mật khẩu (1) | C: Họ tên GV (2) | D: Quyền (3) | E: Lớp giảng dạy (4) | F: Trường (5) | G: Phiên bản Backend GV (6)
 */
function getGiaoVienColMap(sheetGV) {
  const map = {
    colUser: 0,
    colPass: 1,
    colName: 2,
    colRole: 3,
    colClass: 4,
    colSchool: 5,
    colVer: 6
  };
  try {
    if (!sheetGV) return map;
    const lastCol = Math.max(sheetGV.getLastColumn(), 5);
    const headers = sheetGV.getRange(1, 1, 1, Math.max(lastCol, 10)).getValues()[0];
    let foundRole = false;

    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || "").trim().toLowerCase();
      if (h.includes("quyền") || h.includes("quyen") || h === "role" || h.includes("chức vụ")) {
        map.colRole = c;
        foundRole = true;
      } else if (h.includes("tài khoản") || h.includes("mã gv") || h.includes("username")) {
        map.colUser = c;
      } else if (h.includes("mật khẩu") || h.includes("password") || h.includes("pass")) {
        map.colPass = c;
      } else if (h.includes("họ tên") || h.includes("tên gv") || h.includes("hoten")) {
        map.colName = c;
      } else if (h.includes("lớp") || h.includes("lop")) {
        map.colClass = c;
      } else if (h.includes("trường") || h.includes("truong")) {
        map.colSchool = c;
      } else if (h.includes("phiên bản") || h.includes("version")) {
        map.colVer = c;
      }
    }

    // Nếu cấu trúc cũ chưa có cột Quyền thì Cột 3 là Lớp, 4 là Trường, 5 là Phiên bản
    if (!foundRole) {
      map.colRole = -1;
      map.colClass = 3;
      map.colSchool = 4;
      map.colVer = 5;
    }
  } catch (e) {}
  return map;
}

/**
 * Đọc phiên bản Backend yêu cầu từ Sheet DATA_GIAOVIEN
 * Trả về dạng số phiên bản như 2.1, 2.2, 2.3, 2.4, 3.0,...
 * - Với cấu trúc mới (có Cột D: Quyền): Cột G là 'Phiên bản Backend GV', Ô H1 là phiên bản trung tâm (vd: 2.3), Ô I1 là 'backend'
 * - Với cấu trúc cũ (chưa có Cột D): Cột F là 'Phiên bản Backend GV', Ô G1 là phiên bản trung tâm, Ô H1 là 'backend'
 */
function getCentralBackendVersion(sheetGV) {
  try {
    if (!sheetGV) {
      const ss = getSpreadsheet();
      sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
    }
    if (sheetGV) {
      const maxCol = Math.max(sheetGV.getLastColumn(), 12);
      const topRow = sheetGV.getRange(1, 1, 1, maxCol).getValues()[0];
      const gvCols = getGiaoVienColMap(sheetGV);

      // Cách 1: Xác định trực tiếp theo vị trí cột 'Phiên bản Backend GV'
      // Nếu cột Phiên bản Backend GV ở cột G (colVer = 6, 0-based), thì ô phiên bản trung tâm là Ô H1 (cột 8, 1-based)
      if (gvCols.colVer >= 0) {
        const targetColIdx = gvCols.colVer + 1; // vị trí trong topRow (0-based) = colVer + 1 (tức cột kế tiếp)
        if (targetColIdx < topRow.length) {
          const valAtCol = String(topRow[targetColIdx] || "").trim();
          if (valAtCol && !valAtCol.toLowerCase().includes("phiên bản") && !valAtCol.toLowerCase().includes("backend")) {
            const parsed = formatBackendVersion(valAtCol, "");
            if (parsed) return parsed;
          }
        }
      }

      // Cách 2: Ưu tiên đọc trực tiếp ô H1 (vị trí chuẩn mới sau khi thêm Cột D)
      try {
        const h1Val = String(sheetGV.getRange("H1").getDisplayValue() || "").trim();
        if (h1Val && !h1Val.toLowerCase().includes("phiên bản") && !h1Val.toLowerCase().includes("backend")) {
          const parsedH1 = formatBackendVersion(h1Val, "");
          if (parsedH1) return parsedH1;
        }
      } catch (eH1) {}

      // Cách 3: Tìm ô bên trái ô có chữ 'backend' ở hàng 1 (ví dụ: I1 là 'backend' -> H1 là phiên bản)
      for (let c = 0; c < topRow.length; c++) {
        const strVal = String(topRow[c] || "").trim().toLowerCase();
        if (strVal === "backend" && c > 0) {
          const leftVal = String(topRow[c - 1] || "").trim();
          if (leftVal && !leftVal.toLowerCase().includes("phiên bản")) {
            const parsedLeft = formatBackendVersion(leftVal, "");
            if (parsedLeft) return parsedLeft;
          }
        }
      }

      // Cách 4: Quét toàn bộ hàng 1 tìm ô có định dạng số phiên bản hợp lệ (như 2.0, 2.3, 2.4, 3.0,...)
      for (let c = 0; c < topRow.length; c++) {
        const strVal = String(topRow[c] || "").trim();
        if (/^v?\d+(\.\d+)+$/i.test(strVal)) {
          return formatBackendVersion(strVal, CURRENT_BACKEND_VERSION || "2.3");
        }
      }

      // Cách 5: Kiểm tra ô G1 (cho cấu trúc sheet cũ chưa có cột D, đảm bảo G1 không phải là chữ 'Phiên bản Backend GV')
      try {
        const g1Val = String(sheetGV.getRange("G1").getDisplayValue() || "").trim();
        if (g1Val && !g1Val.toLowerCase().includes("phiên bản") && !g1Val.toLowerCase().includes("backend")) {
          const parsedG1 = formatBackendVersion(g1Val, "");
          if (parsedG1) return parsedG1;
        }
      } catch (eG1) {}
    }
  } catch (e) {}
  return CURRENT_BACKEND_VERSION || "2.3";
}

/**
 * Đảm bảo Sheet DATA_GIAOVIEN có thêm cột D là 'Quyền', đẩy các cột kia qua phải 1 cột
 * Cột A: Tài khoản GV | B: Mật khẩu | C: Họ tên GV | D: Quyền | E: Lớp giảng dạy | F: Trường | G: Phiên bản Backend GV | H1: 2.3 | I1: backend
 */
function ensureGiaoVienSheetColumns(sheetGV) {
  try {
    if (!sheetGV) {
      const ss = getSpreadsheet();
      if (ss) {
        sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
      }
    }
    if (!sheetGV) {
      Logger.log("❌ Không tìm thấy Sheet DATA_GIAOVIEN!");
      return 6;
    }
    let lastCol = Math.max(sheetGV.getLastColumn(), 5);
    let headerRow = sheetGV.getRange(1, 1, 1, Math.max(lastCol, 12)).getValues()[0];

    // 1. Kiểm tra xem đã có cột Quyền chưa
    let roleColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] || "").toLowerCase().trim();
      if (h.includes("quyền") || h.includes("quyen") || h === "role" || h.includes("chức vụ")) {
        roleColIdx = c;
        break;
      }
    }

    if (roleColIdx === -1) {
      // Chưa có cột Quyền: Chèn cột mới vào trước cột 4 (Vị trí cột D)
      sheetGV.insertColumnBefore(4);
      sheetGV.getRange(1, 4).setValue("Quyền");
      formatHeaderRow(sheetGV);
      roleColIdx = 3;

      // Cập nhật giá trị cột D cho các dòng hiện tại (mặc định 'gv' nếu ô đang trống)
      const allRows = sheetGV.getDataRange().getValues();
      for (let r = 1; r < allRows.length; r++) {
        const roleCell = sheetGV.getRange(r + 1, 4);
        const oldVal = String(roleCell.getValue() || "").trim();
        if (!oldVal) {
          roleCell.setValue("gv");
        }
      }
      Logger.log("✅ ĐÃ CHÈN THÀNH CÔNG CỘT D (QUYỀN) VÀ ĐẨY CÁC CỘT SANG PHẢI 1 CỘT!");
    } else {
      Logger.log("ℹ️ Cột Quyền đã có sẵn tại cột số " + (roleColIdx + 1));
    }

    // Đọc lại header sau khi đảm bảo có cột D
    lastCol = Math.max(sheetGV.getLastColumn(), 7);
    headerRow = sheetGV.getRange(1, 1, 1, Math.max(lastCol, 12)).getValues()[0];

    // 2. Kiểm tra cột 'Phiên bản Backend GV'
    let verColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] || "").toLowerCase().trim();
      if (h.includes("phiên bản") || h.includes("version")) {
        verColIdx = c;
        break;
      }
    }

    if (verColIdx === -1) {
      const nextCol = sheetGV.getLastColumn() + 1;
      sheetGV.getRange(1, nextCol).setValue("Phiên bản Backend GV");
      formatHeaderRow(sheetGV);
      verColIdx = nextCol - 1;
    }

    // 3. Đảm bảo ô thông tin phiên bản chuẩn hệ thống ở dòng 1 (Ô H1 nếu cột G là Phiên bản GV)
    let foundVersionCell = false;
    for (let c = 1; c <= Math.max(lastCol, 12); c++) {
      const v = String(sheetGV.getRange(1, c).getValue() || "").trim();
      if (/^v?\d+(\.\d+)+$/i.test(v)) {
        foundVersionCell = true;
        break;
      }
    }
    if (!foundVersionCell) {
      // Vị trí ô phiên bản là cột ngay sau cột 'Phiên bản Backend GV' (Cột G (7) -> Cột H (8, Ô H1))
      const verCellCol = (verColIdx >= 0 ? verColIdx + 2 : 8);
      const verRange = sheetGV.getRange(1, verCellCol);
      verRange.setNumberFormat("@");
      verRange.setValue(CURRENT_BACKEND_VERSION || "2.3");
      verRange.setBackground("#dc2626"); // Đỏ nổi bật
      verRange.setFontColor("#ffffff");
      verRange.setFontWeight("bold");

      const labelRange = sheetGV.getRange(1, verCellCol + 1);
      labelRange.setValue("backend");
      labelRange.setBackground("#2563eb"); // Xanh nổi bật
      labelRange.setFontColor("#ffffff");
      labelRange.setFontWeight("bold");
    }

    return verColIdx;
  } catch (err) {
    Logger.log("Lỗi ensureGiaoVienSheetColumns: " + err.toString());
    return 6;
  }
}

/**
 * Cập nhật phiên bản backend thực tế mà giáo viên đang sử dụng vào cột 'Phiên bản Backend GV' (Cột G)
 */
function handleUpdateTeacherBackendVersion(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy sheet DATA_GIAOVIEN" });

    const username = String(payload.username || "").trim();
    const version = formatBackendVersion(payload.version || "2.0");
    if (!username) return createJsonResponse({ success: false, message: "Thiếu tên tài khoản giáo viên" });

    const verColIdx = ensureGiaoVienSheetColumns(sheetGV);
    const data = sheetGV.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < data.length; i++) {
      const gvUser = String(data[i][0] || "").trim();
      if (isSameTeacherAccount(gvUser, username)) {
        const vToSave = (isAdminAccount(username) || isCentralAccountBackend(username, gvUser)) 
          ? getCentralBackendVersion(sheetGV) 
          : version;
        const cell = sheetGV.getRange(i + 1, verColIdx + 1);
        cell.setNumberFormat("@"); // Định dạng Plain Text để Google Sheets không tự động biến thành ngày tháng
        cell.setValue(String(vToSave));
        updated = true;
        break;
      }
    }

    return createJsonResponse({
      success: updated,
      message: updated ? `Đã cập nhật phiên bản backend ${version} cho giáo viên ${username} vào Cột G` : "Không tìm thấy giáo viên",
      version: version
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi cập nhật phiên bản GV: " + err.toString()
    });
  }
}

/**
 * Admin cập nhật phiên bản Backend chuẩn của hệ thống (lưu trực tiếp vào Ô H1 của sheet DATA_GIAOVIEN)
 * Payload: { version }
 */
function handleSetCentralBackendVersion(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });

    const newVer = formatBackendVersion(payload.version || CURRENT_BACKEND_VERSION || "2.3", "2.3");
    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);

    // Xác định ô phiên bản trung tâm (cột kế tiếp cột Phiên bản Backend GV)
    const verColIdx = cols.colVer >= 0 ? cols.colVer : 6;
    const targetCol = verColIdx + 2; // Ví dụ: Cột G (7) -> Cột H (8, Ô H1)

    const cellVer = sheetGV.getRange(1, targetCol);
    cellVer.setNumberFormat("@");
    cellVer.setValue(newVer);
    cellVer.setBackground("#dc2626"); // Đỏ nổi bật
    cellVer.setFontColor("#ffffff");
    cellVer.setFontWeight("bold");

    // Ô ghi chú bên cạnh (Ô I1)
    const cellLabel = sheetGV.getRange(1, targetCol + 1);
    if (!cellLabel.getValue()) {
      cellLabel.setValue("backend");
      cellLabel.setBackground("#2563eb");
      cellLabel.setFontColor("#ffffff");
      cellLabel.setFontWeight("bold");
    }

    return createJsonResponse({
      success: true,
      message: `Đã cập nhật phiên bản backend trung tâm thành "${newVer}" tại ô H1 của Sheet DATA_GIAOVIEN!`,
      version: newVer
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi cập nhật phiên bản trung tâm: " + err.toString()
    });
  }
}

/**
 * Kiểm tra tài khoản có phải tài khoản dùng chung backend trung tâm hay không
 */
function isCentralAccountBackend(user1, user2) {
  var u1 = String(user1 || "").toLowerCase().trim();
  var u2 = String(user2 || "").toLowerCase().trim();
  var c1 = u1.replace(/^0+/, "");
  var c2 = u2.replace(/^0+/, "");
  return (u1 === "admin" || u2 === "admin" || u1 === "0938750424" || u2 === "0938750424" || c1 === "938750424" || c2 === "938750424");
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action) {
      const payload = e.parameter;
      const action = payload.action;

      switch (action) {
        case "checkBackendVersion":
          return createJsonResponse({
            success: true,
            version: CURRENT_BACKEND_VERSION,
            message: "Phiên bản Code.gs: " + CURRENT_BACKEND_VERSION
          });
        case "checkCentralBackendVersion":
          return createJsonResponse({
            success: true,
            requiredBackendVersion: getCentralBackendVersion(),
            version: CURRENT_BACKEND_VERSION
          });
        case "updateTeacherBackendVersion":
          return handleUpdateTeacherBackendVersion(payload);
        case "getStudentsForTeacher":
          return handleGetStudentsForTeacher(payload);
        case "getTeacherExams":
          return handleGetTeacherExams(payload);
        case "getTeacherResults":
          return handleGetTeacherResults(payload);
        case "getStudentExams":
          return handleGetStudentExams(payload);
        case "login":
          return handleLogin(payload);
        case "updateStudentPassword":
          return handleUpdateStudentPassword(payload);
        case "batchUpdateStudentPasswords":
          return handleBatchUpdateStudentPasswords(payload);
        case "updateTeacherPassword":
          return handleUpdateTeacherPassword(payload);
        case "deleteStudentResult":
          return handleDeleteStudentResult(payload);
        case "deleteStudent":
          return handleDeleteStudent(payload);
        case "addStudent":
          return handleAddStudent(payload);
        case "ensureDeThiColumns":
          const ssEnsure = getSpreadsheet();
          ensureDeThiSheetColumns(ssEnsure.getSheetByName(SHEETS.DETHI));
          return createJsonResponse({ success: true, message: "Đã nâng cấp Sheet DATA_DETHI đầy đủ cột Chế độ xem bài và Chế độ xem điểm!" });
        case "verifyAdminPassword":
          return handleVerifyAdminPassword(payload);
        case "toggleExamStatus":
          return handleToggleExamStatus(payload);
        case "deleteExam":
          return handleDeleteExam(payload);
        case "syncTeacherAndStudentsToHub":
          return handleSyncTeacherAndStudentsToHub(payload);
        case "getTeacherHubDirectory":
          return handleGetTeacherHubDirectory(payload);
        case "lookupStudentHub":
          return handleLookupStudentHub(payload);
        case "getSheetDataByUrl":
          return handleGetSheetDataByUrl(payload);
        case "getAdminTeachers":
          return handleGetAdminTeachers(payload);
        case "addTeacher":
          return handleAddTeacher(payload);
        case "updateTeacher":
          return handleUpdateTeacher(payload);
        case "deleteTeacher":
          return handleDeleteTeacher(payload);
        case "adminResetTeacherPassword":
          return handleAdminResetTeacherPassword(payload);
        case "getAdminHubServers":
          return handleGetAdminHubServers(payload);
        case "saveHubServer":
          return handleSaveHubServer(payload);
        case "deleteHubServer":
          return handleDeleteHubServer(payload);
        case "setCentralBackendVersion":
          return handleSetCentralBackendVersion(payload);
        case "syncClassesFromHubServers":
          return handleSyncClassesFromHubServers(payload);
        case "updateTeacherClasses":
          return handleUpdateTeacherClasses(payload);
      }
    }

    const response = {
      status: "online",
      version: CURRENT_BACKEND_VERSION,
      requiredBackendVersion: getCentralBackendVersion(),
      message: "Google Apps Script API - Hệ Thống Thi Trắc Nghiệm Trực Tuyến đang hoạt động tốt!",
      timestamp: new Date().toISOString()
    };
    return createJsonResponse(response);
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi GET API: " + err.toString()
    });
  }
}

/**
 * Xử lý yêu cầu POST gửi từ Frontend
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        message: "Không tìm thấy dữ liệu gửi lên (Payload trống)!"
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // Phân luồng hành động theo action
    switch (action) {
      case "login":
        return handleLogin(payload);

      case "verifyAdminPassword":
        return handleVerifyAdminPassword(payload);

      // --- MODULE TRẠM TRUNG TÂM (CENTRAL HUB) ---
      case "syncTeacherAndStudentsToHub":
        return handleSyncTeacherAndStudentsToHub(payload);

      case "getTeacherHubDirectory":
        return handleGetTeacherHubDirectory(payload);

      case "lookupStudentHub":
        return handleLookupStudentHub(payload);

      case "getSheetDataByUrl":
        return handleGetSheetDataByUrl(payload);

      case "updateTeacherBackendVersion":
        return handleUpdateTeacherBackendVersion(payload);

      // --- MODULE QUẢN LÝ GIÁO VIÊN & KẾT NỐI HUB (ADMIN) ---
      case "getAdminTeachers":
        return handleGetAdminTeachers(payload);

      case "addTeacher":
        return handleAddTeacher(payload);

      case "updateTeacher":
        return handleUpdateTeacher(payload);

      case "deleteTeacher":
        return handleDeleteTeacher(payload);

      case "adminResetTeacherPassword":
        return handleAdminResetTeacherPassword(payload);

      case "getAdminHubServers":
        return handleGetAdminHubServers(payload);

      case "saveHubServer":
        return handleSaveHubServer(payload);

      case "deleteHubServer":
        return handleDeleteHubServer(payload);

      case "setCentralBackendVersion":
        return handleSetCentralBackendVersion(payload);

      case "syncClassesFromHubServers":
        return handleSyncClassesFromHubServers(payload);

      case "updateTeacherClasses":
        return handleUpdateTeacherClasses(payload);

      // --- MODULE 2: GIÁO VIÊN ---
      case "saveExam":
        return handleSaveExam(payload);

      case "getTeacherExams":
        return handleGetTeacherExams(payload);

      case "toggleExamStatus":
        return handleToggleExamStatus(payload);

      case "deleteExam":
        return handleDeleteExam(payload);

      case "getTeacherResults":
        return handleGetTeacherResults(payload);

      case "getStudentsForTeacher":
        return handleGetStudentsForTeacher(payload);

      case "updateStudentPassword":
        return handleUpdateStudentPassword(payload);

      case "batchUpdateStudentPasswords":
        return handleBatchUpdateStudentPasswords(payload);

      case "updateTeacherPassword":
        return handleUpdateTeacherPassword(payload);

      case "deleteStudentResult":
        return handleDeleteStudentResult(payload);

      case "deleteStudent":
        return handleDeleteStudent(payload);

      case "addStudent":
        return handleAddStudent(payload);

      case "ensureDeThiColumns":
        const ssEnsurePost = getSpreadsheet();
        ensureDeThiSheetColumns(ssEnsurePost.getSheetByName(SHEETS.DETHI));
        return createJsonResponse({ success: true, message: "Đã nâng cấp Sheet DATA_DETHI đầy đủ cột Chế độ xem bài và Chế độ xem điểm!" });

      // --- MODULE 3: HỌC SINH ---
      case "getStudentExams":
        return handleGetStudentExams(payload);

      case "submitExam":
        return handleSubmitExam(payload);

      default:
        return createJsonResponse({
          success: false,
          message: "Hành động (action) không hợp lệ hoặc chưa được hỗ trợ: " + action
        });
    }

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xử lý máy chủ: " + error.toString()
    });
  }
}

/**
 * XỬ LÝ ĐĂNG NHẬP (HỖ TRỢ ĐỊNH TUYẾN TRẠM TRUNG TÂM TỰ ĐỘNG)
 * Payload: { action: "login", username: "...", password: "...", role: "GV" | "HS" }
 */
function handleLogin(payload) {
  const ss = getSpreadsheet();
  const role = (payload.role || "HS").toUpperCase();
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "").trim();

  if (!username || !password) {
    return createJsonResponse({
      success: false,
      message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu!"
    });
  }

  if (role === "GV") {
    // 1. ĐĂNG NHẬP CHO GIÁO VIÊN
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) {
      return createJsonResponse({
        success: false,
        message: "Chưa cấu hình Sheet DATA_GIAOVIEN. Hãy chạy hàm initDatabase() trước!"
      });
    }

    ensureGiaoVienSheetColumns(sheetGV);
    const gvCols = getGiaoVienColMap(sheetGV);
    const data = sheetGV.getDataRange().getValues();
    let userFound = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[gvCols.colUser] && !row[gvCols.colPass]) continue; // Bỏ qua dòng trống

      const gvUser = String(row[gvCols.colUser] !== null && row[gvCols.colUser] !== undefined ? row[gvCols.colUser] : "").trim().replace(/\u00A0/g, "");
      const gvPass = String(row[gvCols.colPass] !== null && row[gvCols.colPass] !== undefined ? row[gvCols.colPass] : "").trim().replace(/\u00A0/g, "");

      if (isSameTeacherAccount(gvUser, username)) {
        userFound = true;
        if (gvPass === password) {
          // Tra cứu xem GV này đã đăng ký Server riêng trên HUB_SERVERS chưa
          let personalServerUrl = "";
          try {
            const sheetHubServers = ss.getSheetByName(SHEETS.HUB_SERVERS || "HUB_SERVERS");
            if (sheetHubServers) {
              const hubData = sheetHubServers.getDataRange().getValues();
              for (let h = 1; h < hubData.length; h++) {
                const hUser = String(hubData[h][0] || "").trim();
                if (isSameTeacherAccount(hUser, gvUser)) {
                  personalServerUrl = String(hubData[h][3] || "").trim();
                  break;
                }
              }
            }
          } catch (eHub) {}

          // Kiểm tra quyền Quản trị viên (CHỈ CÓ TÀI KHOẢN CÓ CỘT D LÀ 'admin' THÌ MỚI CÓ QUYỀN ADMIN)
          // Tài khoản có tên là 'admin' nhưng Cột D là 'gv' thì KHÔNG PHẢI là Admin!
          const roleVal = gvCols.colRole >= 0 ? String(row[gvCols.colRole] || "").trim().toLowerCase() : "";
          const isAdmin = (roleVal === "admin");

          const verColIdx = gvCols.colVer >= 0 ? gvCols.colVer : ensureGiaoVienSheetColumns(sheetGV);
          const reqVer = getCentralBackendVersion(sheetGV);
          const teacherCurrentVer = formatBackendVersion(row[verColIdx], "2.0");

          return createJsonResponse({
            success: true,
            message: isAdmin ? "Đăng nhập Quản trị viên (Admin) thành công!" : "Đăng nhập Giáo viên thành công!",
            role: isAdmin ? "ADMIN" : "GV",
            requiredBackendVersion: reqVer,
            teacherBackendVersion: teacherCurrentVer,
            data: {
              username: gvUser,
              hoTenGV: String(row[gvCols.colName] || ""),
              quyen: roleVal || "gv",
              lopGiangDay: String(row[gvCols.colClass] || ""),
              truong: String(row[gvCols.colSchool] || ""),
              ngaySinh: "",
              serverUrl: personalServerUrl || "",
              requiredBackendVersion: reqVer,
              teacherBackendVersion: teacherCurrentVer,
              isAdmin: isAdmin,
              role: isAdmin ? "ADMIN" : "GV"
            }
          });
        } else {
          return createJsonResponse({
            success: false,
            message: "Mật khẩu không chính xác! Vui lòng kiểm tra lại."
          });
        }
      }
    }

    return createJsonResponse({
      success: false,
      message: userFound 
        ? "Mật khẩu không chính xác!" 
        : `Tài khoản Giáo viên "${username}" không tồn tại trên Google Sheets!`
    });

  } else {
    // 2. ĐĂNG NHẬP CHO HỌC SINH
    const sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
    if (!sheetHS) {
      return createJsonResponse({
        success: false,
        message: "Chưa cấu hình Sheet DATA_HOCSINH. Hãy chạy hàm initDatabase() trước!"
      });
    }

    const data = sheetHS.getDataRange().getValues();
    // Cột: 0: Tài khoản HS | 1: Mật khẩu | 2: Lớp | 3: Họ tên | 4: Ngày sinh | 5: Giới tính | 6: Trường
    let userFound = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue; // Bỏ qua dòng trống

      const hsUser = String(row[0] !== null && row[0] !== undefined ? row[0] : "").trim().replace(/\u00A0/g, "");
      const hsPass = String(row[1] !== null && row[1] !== undefined ? row[1] : "").trim().replace(/\u00A0/g, "");

      if (hsUser.toLowerCase() === username.toLowerCase() || isSameTeacherAccount(hsUser, username)) {
        userFound = true;
        if (hsPass === password) {
          return createJsonResponse({
            success: true,
            message: "Đăng nhập Học sinh thành công!",
            role: "HS",
            data: {
              username: hsUser,
              lop: formatClassValue(row[2]),
              hoTen: String(row[3] || ""),
              ngaySinh: formatBirthDateValue(row[4]),
              gioiTinh: String(row[5] || ""),
              truong: String(row[6] || "")
            }
          });
        } else {
          return createJsonResponse({
            success: false,
            message: "Mật khẩu không chính xác! Vui lòng kiểm tra lại."
          });
        }
      }
    }

    // 3. NẾU KHÔNG CÓ TRÊN SHEET HIỆN TẠI -> TỰ ĐỘNG TRA CỨU TRẠM TRUNG TÂM (HUB_STUDENTS)
    try {
      const sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS || "HUB_STUDENTS");
      if (sheetHubStudents) {
        const hubHSData = sheetHubStudents.getDataRange().getValues();
        for (let j = 1; j < hubHSData.length; j++) {
          const hsHubUser = String(hubHSData[j][0] || "").trim().replace(/\u00A0/g, "");
          if (hsHubUser.toLowerCase() === username.toLowerCase()) {
            const redirectServer = String(hubHSData[j][5] || "").trim();
            const gvCode = String(hubHSData[j][4] || "");
            const hsName = String(hubHSData[j][1] || "");
            if (redirectServer) {
              return createJsonResponse({
                success: true,
                isRedirect: true,
                redirectServerUrl: redirectServer,
                teacherCode: gvCode,
                hoTen: hsName,
                message: "Đang tự động chuyển tiếp tới máy chủ lớp học của Thầy/Cô..."
              });
            }
          }
        }
      }
    } catch (eHubLookup) {
      Logger.log("Lỗi tra cứu HUB_STUDENTS: " + eHubLookup);
    }

    return createJsonResponse({
      success: false,
      message: userFound 
        ? "Mật khẩu không chính xác!" 
        : `Tài khoản Học sinh "${username}" không tồn tại trên hệ thống hoặc chưa được đồng bộ lên Trạm Trung Tâm!`
    });
  }
}

/**
 * XÁC THỰC MẬT KHẨU BẢO MẬT CẤU HÌNH BACKEND (ĐỌC LINH HOẠT TẠI CÁC Ô F2, G2, H2, I2, H1 HOẶC CẠNH CHỮ CẤU HÌNH BACKEND)
 * Payload: { action: "verifyAdminPassword", password: "..." }
 */
function handleVerifyAdminPassword(payload) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
    if (!sheet) {
      return createJsonResponse({
        success: false,
        message: "Không tìm thấy sheet DATA_GIAOVIEN trên Google Sheets chính!"
      });
    }

    const inputPass = payload && payload.password !== undefined ? String(payload.password).trim() : "";
    if (!inputPass) {
      return createJsonResponse({
        success: false,
        message: "Vui lòng nhập mật khẩu!"
      });
    }

    // Đọc danh sách các ô tiềm năng (F2, G2, H2, I2 nơi người dùng đặt mật khẩu cạnh chữ CẤU HÌNH BACKEND)
    const candidates = [];
    
    // 1. Kiểm tra các ô F2, G2, H2, I2 (vị trí mật khẩu sau khi dịch chuyển cột)
    try { candidates.push(String(sheet.getRange("F2").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("G2").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("H2").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("I2").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("F1").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("G1").getValue() || "").trim()); } catch(e) {}
    try { candidates.push(String(sheet.getRange("H1").getValue() || "").trim()); } catch(e) {}

    // 2. Quét tìm ô bên cạnh hoặc bên dưới nhãn "CẤU HÌNH BACKEND"
    try {
      const topData = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 10), Math.min(sheet.getLastColumn(), 12)).getValues();
      for (let r = 0; r < topData.length; r++) {
        for (let c = 0; c < topData[r].length; c++) {
          const cellStr = String(topData[r][c] || "").toUpperCase();
          if (cellStr.includes("CẤU HÌNH") || cellStr.includes("BACKEND")) {
            if (c > 0) candidates.push(String(topData[r][c - 1] || "").trim());
            if (c + 1 < topData[r].length) candidates.push(String(topData[r][c + 1] || "").trim());
            if (r + 1 < topData.length) candidates.push(String(topData[r + 1][c] || "").trim());
          }
        }
      }
    } catch(e) {}

    // 3. Mật khẩu của các tài khoản có quyền Admin trong DATA_GIAOVIEN
    try {
      const gvRows = sheet.getDataRange().getValues();
      const gvMap = getGiaoVienColMap(sheet);
      for (let r = 1; r < gvRows.length; r++) {
        const role = gvMap.colRole >= 0 ? String(gvRows[r][gvMap.colRole] || "").trim().toLowerCase() : "";
        if (role === "admin") {
          const p = String(gvRows[r][gvMap.colPass] || "").trim();
          if (p) candidates.push(p);
        }
      }
    } catch(eAdm) {}

    // Lọc các giá trị hợp lệ
    const validPasswords = candidates.filter(p => p && !p.toUpperCase().includes("CẤU HÌNH") && !p.toUpperCase().includes("BACKEND"));

    if (validPasswords.length === 0) {
      return createJsonResponse({
        success: false,
        message: "Chưa cấu hình mật khẩu quản trị tại ô H2, G2 hoặc tài khoản admin trong sheet DATA_GIAOVIEN!"
      });
    }

    if (validPasswords.includes(inputPass)) {
      return createJsonResponse({
        success: true,
        message: "Xác thực mật khẩu quản trị thành công!"
      });
    } else {
      return createJsonResponse({
        success: false,
        message: "Mật khẩu quản trị không chính xác! Vui lòng kiểm tra lại ô mật khẩu trong sheet DATA_GIAOVIEN."
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xác thực mật khẩu: " + err.toString()
    });
  }
}

// ============================================================================
// MODULE 1.5: TRẠM TRUNG TÂM (CENTRAL HUB REGISTRY)
// ============================================================================

/**
 * ĐỒNG BỘ MÁY CHỦ GIÁO VIÊN & DANH SÁCH HỌC SINH LÊN TRẠM TRUNG TÂM (CENTRAL HUB)
 * Payload: {
 *   action: "syncTeacherAndStudentsToHub",
 *   usernameGV: "...",
 *   passwordGV: "...",
 *   hoTenGV: "...",
 *   truong: "...",
 *   serverUrl: "...",
 *   students: [ { username, hoTen, lop, truong }, ... ]
 * }
 */
function handleSyncTeacherAndStudentsToHub(payload) {
  try {
    const ss = getSpreadsheet();
    const usernameGV = String(payload.usernameGV || "").trim();
    const serverUrl = String(payload.serverUrl || "").trim();
    const hoTenGV = String(payload.hoTenGV || "").trim();
    const truong = String(payload.truong || "").trim();
    const students = Array.isArray(payload.students) ? payload.students : [];

    if (!usernameGV) {
      return createJsonResponse({
        success: false,
        message: "Thiếu mã tài khoản Giáo viên!"
      });
    }

    if (!serverUrl || !serverUrl.startsWith("https://script.google.com/macros/s/") || !serverUrl.includes("/exec")) {
      return createJsonResponse({
        success: false,
        message: "URL Web App của Giáo viên không hợp lệ (phải có dạng https://script.google.com/macros/s/.../exec)!"
      });
    }

    const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    // ========================================================================
    // 1. CẬP NHẬT HOẶC THÊM MỚI VÀO HUB_SERVERS (KHÔNG TẠO TRÙNG GIÁO VIÊN)
    // ========================================================================
    let sheetHubServers = ss.getSheetByName(SHEETS.HUB_SERVERS);
    if (!sheetHubServers) {
      sheetHubServers = ss.insertSheet(SHEETS.HUB_SERVERS);
      sheetHubServers.appendRow(["Mã GV", "Họ tên GV", "Trường", "URL Web App (Server)", "Trạng thái", "Ngày cập nhật"]);
      formatHeaderRow(sheetHubServers, "#4f46e5");
    }

    const gvData = sheetHubServers.getDataRange().getValues();
    let gvRowIdx = -1;
    for (let r = 1; r < gvData.length; r++) {
      if (isSameTeacherAccount(gvData[r][0], usernameGV)) {
        gvRowIdx = r + 1; // 1-based index trên sheet
        break;
      }
    }

    if (gvRowIdx > 0) {
      // ĐÃ CÓ: Chỉ cập nhật các thông tin thay đổi (Tên, Trường, URL mới, Trạng thái, Ngày cập nhật)
      sheetHubServers.getRange(gvRowIdx, 2, 1, 5).setValues([[
        hoTenGV || gvData[gvRowIdx - 1][1],
        truong || gvData[gvRowIdx - 1][2],
        serverUrl,
        "Hoạt động",
        nowStr
      ]]);
    } else {
      // CHƯA CÓ: Thêm 1 dòng mới duy nhất
      sheetHubServers.appendRow([usernameGV, hoTenGV, truong, serverUrl, "Hoạt động", nowStr]);
    }

    // ========================================================================
    // 2. DÒ VÀ CẬP NHẬT HUB_STUDENTS (UPSERT THÔNG MINH, KHÔNG TẠO TRÙNG HỌC SINH)
    // ========================================================================
    let sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS);
    if (!sheetHubStudents) {
      sheetHubStudents = ss.insertSheet(SHEETS.HUB_STUDENTS);
      sheetHubStudents.appendRow(["Mã HS", "Họ tên HS", "Lớp", "Trường", "Mã GV", "URL Web App (Server)", "Ngày cập nhật"]);
      formatHeaderRow(sheetHubStudents, "#d97706");
    }

    // Đọc toàn bộ danh sách hiện tại trên HUB_STUDENTS vào bộ nhớ (xử lý siêu tốc)
    let studentRows = sheetHubStudents.getDataRange().getValues();
    if (studentRows.length === 0 || !studentRows[0][0]) {
      sheetHubStudents.appendRow(["Mã HS", "Họ tên HS", "Lớp", "Trường", "Mã GV", "URL Web App (Server)", "Ngày cập nhật"]);
      studentRows = sheetHubStudents.getDataRange().getValues();
    }

    // Xây dựng bảng tra cứu nhanh theo Mã HS (Mã HS in hoa)
    const studentMap = {}; // key: cleanedUsername -> rowIndex trong studentRows
    for (let i = 1; i < studentRows.length; i++) {
      const u = String(studentRows[i][0] || "").trim().toUpperCase();
      if (u) {
        studentMap[u] = i;
      }
    }

    let updatedCount = 0;
    let addedCount = 0;

    // Dò từng học sinh trong danh sách đồng bộ
    students.forEach(st => {
      const rawUser = String(st.username || "").trim();
      if (!rawUser) return;
      const userKey = rawUser.toUpperCase();

      const lopFormatted = formatClassValue(st.lop || "").trim();
      const lopToSave = lopFormatted.includes("/") ? "'" + lopFormatted : lopFormatted;
      const hoTen = String(st.hoTen || "").trim();
      const truongHS = String(st.truong || truong || "").trim();

      if (studentMap[userKey] !== undefined) {
        // HỌC SINH ĐÃ TỒN TẠI TRÊN HUB_STUDENTS:
        // Chỉ dò và cập nhật những thông tin thay đổi (URL server mới, Lớp, Họ tên, Trường, Ngày cập nhật)
        const rIdx = studentMap[userKey];
        if (hoTen) studentRows[rIdx][1] = hoTen;
        if (lopToSave) studentRows[rIdx][2] = lopToSave;
        if (truongHS) studentRows[rIdx][3] = truongHS;
        studentRows[rIdx][4] = usernameGV;
        studentRows[rIdx][5] = serverUrl; // Cập nhật URL Web App mới nhất của Thầy/Cô
        studentRows[rIdx][6] = nowStr;
        updatedCount++;
      } else {
        // HỌC SINH MỚI CHƯA CÓ TRÊN HUB_STUDENTS:
        // Thêm vào danh sách tạo mới
        const newRow = [rawUser, hoTen, lopToSave, truongHS, usernameGV, serverUrl, nowStr];
        studentRows.push(newRow);
        studentMap[userKey] = studentRows.length - 1;
        addedCount++;
      }
    });

    // Ghi toàn bộ dữ liệu trở lại Google Sheets trong duy nhất 1 lần gọi lệnh (siêu tốc, < 0.5s, không lo timeout)
    if (studentRows.length > 1) {
      sheetHubStudents.getRange(1, 1, studentRows.length, 7).setValues(studentRows);
    }

    // ========================================================================
    // 3. ĐỒNG BỘ LỚP GIẢNG DẠY SANG SHEET DATA_GIAOVIEN TRUNG TÂM (CỘT E)
    // ========================================================================
    try {
      const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
      if (sheetGV) {
        ensureGiaoVienSheetColumns(sheetGV);
        const gvCols = getGiaoVienColMap(sheetGV);
        const gvRows = sheetGV.getDataRange().getValues();

        // Xác định chuỗi lớp giảng dạy (ưu tiên payload.lopGiangDay, nếu không có thì lấy unique từ học sinh)
        let classesStr = String(payload.lopGiangDay || payload.classes || "").trim();
        if (!classesStr && students.length > 0) {
          const uniqueClasses = [];
          students.forEach(st => {
            const l = formatClassValue(st.lop || "").trim();
            if (l && !uniqueClasses.includes(l)) uniqueClasses.push(l);
          });
          classesStr = uniqueClasses.join(", ");
        }

        let gvFound = false;
        for (let r = 1; r < gvRows.length; r++) {
          if (isSameTeacherAccount(gvRows[r][gvCols.colUser], usernameGV)) {
            gvFound = true;
            if (classesStr) {
              sheetGV.getRange(r + 1, gvCols.colClass + 1).setValue(classesStr);
            }
            if (truong && !gvRows[r][gvCols.colSchool]) {
              sheetGV.getRange(r + 1, gvCols.colSchool + 1).setValue(truong);
            }
            if (hoTenGV && !gvRows[r][gvCols.colName]) {
              sheetGV.getRange(r + 1, gvCols.colName + 1).setValue(hoTenGV);
            }
            break;
          }
        }

        if (!gvFound && usernameGV) {
          const maxCol = Math.max(sheetGV.getLastColumn(), 7);
          const newGvRow = new Array(maxCol).fill("");
          newGvRow[gvCols.colUser] = usernameGV.startsWith("0") ? "'" + usernameGV : usernameGV;
          newGvRow[gvCols.colPass] = "'123456";
          newGvRow[gvCols.colName] = hoTenGV || usernameGV;
          if (gvCols.colRole >= 0) newGvRow[gvCols.colRole] = "gv";
          newGvRow[gvCols.colClass] = classesStr;
          newGvRow[gvCols.colSchool] = truong;
          if (gvCols.colVer >= 0) newGvRow[gvCols.colVer] = "2.0";
          sheetGV.appendRow(newGvRow);
        }
      }
    } catch (eGvSync) {
      Logger.log("Lỗi đồng bộ DATA_GIAOVIEN trong handleSyncTeacherAndStudentsToHub: " + eGvSync);
    }

    return createJsonResponse({
      success: true,
      message: `Đồng bộ thành công máy chủ của Thầy/Cô! Đã đồng bộ ${students.length} học sinh (Cập nhật: ${updatedCount} em, Thêm mới: ${addedCount} em).`,
      totalStudents: students.length,
      updatedCount: updatedCount,
      addedCount: addedCount,
      serverUrl: serverUrl,
      updatedAt: nowStr
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi đồng bộ lên Trạm Trung Tâm: " + err.toString()
    });
  }
}

/**
 * LẤY DANH BẠ GIÁO VIÊN TRÊN TRẠM TRUNG TÂM
 */
function handleGetTeacherHubDirectory() {
  try {
    const ss = getSpreadsheet();
    const sheetHubServers = ss.getSheetByName(SHEETS.HUB_SERVERS);
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);

    // Hàm chuẩn hóa mã GV (bỏ số 0 ở đầu và chữ hoa/thường để đối soát không bao giờ bị nhân đôi)
    const cleanKey = function(str) {
      return String(str || "").trim().toLowerCase().replace(/^0+/, "");
    };

    // 1. Quét danh sách máy chủ & liên kết từ HUB_SERVERS
    const hubMap = {};
    if (sheetHubServers) {
      const data = sheetHubServers.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rawMaGV = String(data[i][0] || "").trim();
        if (!rawMaGV || rawMaGV.toLowerCase() === "admin") continue;
        const ck = cleanKey(rawMaGV);
        const rk = rawMaGV.toLowerCase();

        let sUrl = String(data[i][3] || "").trim();
        let sheetUrl = "";
        for (let col = 0; col < data[i].length; col++) {
          const val = String(data[i][col] || "").trim();
          if (val.includes("docs.google.com/spreadsheets/")) {
            sheetUrl = val;
            break;
          }
        }

        const info = {
          maGV: rawMaGV,
          hoTenGV: String(data[i][1] || "").trim(),
          truong: String(data[i][2] || "").trim(),
          serverUrl: sUrl,
          sheetUrl: sheetUrl,
          trangThai: String(data[i][4] || "Hoạt động")
        };

        if (!hubMap[ck]) hubMap[ck] = info;
        if (!hubMap[rk]) hubMap[rk] = info;
      }
    }

    const teacherList = [];
    const seen = {};

    // 2. DUYỆT THEO THỨ TỰ CHÍNH XÁC CỦA SHEET DATA_GIAOVIEN (Ưu tiên hàng đầu)
    if (sheetGV) {
      const gvCols = getGiaoVienColMap(sheetGV);
      const gvData = sheetGV.getDataRange().getValues();
      for (let i = 1; i < gvData.length; i++) {
        const rawMaGV = String(gvData[i][gvCols.colUser] || "").trim();
        const roleCol = gvCols.colRole >= 0 ? String(gvData[i][gvCols.colRole] || "").trim() : "";
        if (!rawMaGV || rawMaGV.toLowerCase() === "admin" || roleCol.toLowerCase() === "admin") continue;

        const ck = cleanKey(rawMaGV);
        const rk = rawMaGV.toLowerCase();
        if (seen[ck] || seen[rk]) continue; // Chống lặp tuyệt đối
        seen[ck] = true;
        seen[rk] = true;

        const hubInfo = hubMap[ck] || hubMap[rk] || {};

        let sheetUrl = hubInfo.sheetUrl || "";
        if (!sheetUrl) {
          for (let col = 0; col < gvData[i].length; col++) {
            const val = String(gvData[i][col] || "").trim();
            if (val.includes("docs.google.com/spreadsheets/")) {
              sheetUrl = val;
              break;
            }
          }
        }

        teacherList.push({
          maGV: rawMaGV, // Giữ nguyên mã số có số 0 gốc trong DATA_GIAOVIEN (VD: 0938750424)
          hoTenGV: String(gvData[i][gvCols.colName] || hubInfo.hoTenGV || rawMaGV).trim(),
          quyen: roleCol || "gv",
          truong: String(gvData[i][gvCols.colSchool] || hubInfo.truong || "").trim(),
          serverUrl: hubInfo.serverUrl || "",
          sheetUrl: sheetUrl,
          trangThai: hubInfo.trangThai || "Hoạt động"
        });
      }
    }

    // 3. Nếu trong HUB_SERVERS có GV chưa nằm trong DATA_GIAOVIEN thì đưa tiếp vào cuối
    if (sheetHubServers) {
      const data = sheetHubServers.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const rawMaGV = String(data[i][0] || "").trim();
        if (!rawMaGV || rawMaGV.toLowerCase() === "admin") continue;
        const ck = cleanKey(rawMaGV);
        const rk = rawMaGV.toLowerCase();
        if (seen[ck] || seen[rk]) continue;
        seen[ck] = true;
        seen[rk] = true;

        const hubInfo = hubMap[ck] || hubMap[rk] || {};
        teacherList.push({
          maGV: rawMaGV,
          hoTenGV: hubInfo.hoTenGV || rawMaGV,
          truong: hubInfo.truong || "",
          serverUrl: hubInfo.serverUrl || "",
          sheetUrl: hubInfo.sheetUrl || "",
          trangThai: hubInfo.trangThai || "Hoạt động"
        });
      }
    }

    const reqVer = getCentralBackendVersion(sheetGV);

    return createJsonResponse({
      success: true,
      requiredBackendVersion: reqVer,
      teachers: teacherList
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi lấy danh bạ giáo viên: " + err.toString()
    });
  }
}

/**
 * ĐỌC DỮ LIỆU ĐỀ THI VÀ KẾT QUẢ TRỰC TIẾP TỪ URL GOOGLE SHEET CỦA GIÁO VIÊN
 * Hỗ trợ tài khoản Quản trị viên (Admin) xem thống kê qua link Google Sheets
 */
function handleGetSheetDataByUrl(payload) {
  try {
    const sheetUrl = String(payload.sheetUrl || "").trim();
    if (!sheetUrl) {
      return createJsonResponse({
        success: false,
        message: "Vui lòng cung cấp đường dẫn URL Google Sheet của Giáo viên!"
      });
    }

    let targetSS;
    try {
      targetSS = SpreadsheetApp.openByUrl(sheetUrl);
    } catch (eOpen) {
      return createJsonResponse({
        success: false,
        message: "Không thể mở Google Sheet này! Vui lòng đảm bảo Sheet đã được bấm 'Chia sẻ' (Share) với quyền 'Người xem' (Viewer) hoặc 'Bất kỳ ai có liên kết'. Chi tiết: " + eOpen.toString()
      });
    }

    // 1. Đọc danh sách đề thi từ DATA_DETHI
    const sheetDeThi = targetSS.getSheetByName(SHEETS.DETHI || "DATA_DETHI");
    const exams = [];
    if (sheetDeThi) {
      ensureDeThiSheetColumns(sheetDeThi);
      const cols = getDeThiColumnIndexes(sheetDeThi);
      const dataDe = sheetDeThi.getDataRange().getValues();
      for (let i = 1; i < dataDe.length; i++) {
        const row = dataDe[i];
        if (!row[0]) continue;
        const cheDoXemText = String(row[cols.reviewCol] || "").trim();
        const cheDoXemDiemText = String(row[cols.scoreCol] || "").trim();
        const jsonRaw = row[cols.jsonCol];
        let duLieuDeParsed = {};
        try {
          duLieuDeParsed = typeof jsonRaw === "string" ? JSON.parse(jsonRaw) : (jsonRaw || {});
        } catch (e) { duLieuDeParsed = {}; }

        const essayList = (duLieuDeParsed.tuLuan && Array.isArray(duLieuDeParsed.tuLuan.danhSachCauHoi)) ? duLieuDeParsed.tuLuan.danhSachCauHoi : [];
        const soCauTuLuan = essayList.length > 0 ? essayList.length : (duLieuDeParsed.tuLuan && duLieuDeParsed.tuLuan.noiDung ? 1 : 0);
        const hasTuLuan = !!(duLieuDeParsed.tuLuan && (duLieuDeParsed.tuLuan.noiDung || duLieuDeParsed.tuLuan.linkForm || essayList.length > 0));

        exams.push({
          maDe: String(row[0]),
          tenKyThi: String(row[1]),
          usernameGV: String(row[2]),
          lopChoPhep: String(row[3]),
          thoiGian: Number(row[4]) || 45,
          trangThai: String(row[5] || "Mở"),
          choXemLaiBai: cheDoXemText.indexOf("Khóa") === -1,
          choXemDiem: cheDoXemDiemText.indexOf("Khóa") === -1,
          soCauHoi: (duLieuDeParsed.cauHoi || []).length,
          soCauTuLuan: soCauTuLuan,
          hasTuLuan: hasTuLuan,
          duLieuDe: duLieuDeParsed
        });
      }
    }

    // 2. Đọc danh sách kết quả bài làm từ DATA_KETQUA
    const sheetKetQua = targetSS.getSheetByName(SHEETS.KETQUA || "DATA_KETQUA");
    const results = [];
    if (sheetKetQua) {
      const dataKQ = sheetKetQua.getDataRange().getValues();
      const maDeFilter = String(payload.maDe || "").trim();
      for (let i = 1; i < dataKQ.length; i++) {
        const row = dataKQ[i];
        const rowMaDe = String(row[7]).trim();
        if (!maDeFilter || maDeFilter === "ALL" || rowMaDe === maDeFilter) {
          let chiTietParsed = [];
          let baiLamTuLuan = [];
          try {
            const rawDetail = JSON.parse(row[12] || "[]");
            if (rawDetail && typeof rawDetail === "object" && !Array.isArray(rawDetail)) {
              chiTietParsed = rawDetail.tracNghiem || [];
              baiLamTuLuan = rawDetail.tuLuan || [];
            } else {
              chiTietParsed = rawDetail;
            }
          } catch (e) {
            chiTietParsed = [];
            baiLamTuLuan = [];
          }

          results.push({
            usernameHS: String(row[0]),
            lop: formatClassValue(row[1]),
            hoTen: String(row[2]),
            ngaySinh: formatBirthDateValue(row[3]),
            gioiTinh: String(row[4]),
            truong: String(row[5]),
            thoiGianDangNhap: formatDateValue(row[6]),
            maDe: rowMaDe,
            usernameGV: String(row[8]),
            diemTong: Number(row[9]) || 0,
            soCauDungSai: String(row[10] || ""),
            thoiGianNop: formatDateValue(row[11]),
            chiTietTraLoi: JSON.stringify(chiTietParsed),
            baiLamTuLuan: baiLamTuLuan
          });
        }
      }
    }

    // 3. Đọc danh sách học sinh từ DATA_HOCSINH
    const sheetHS = targetSS.getSheetByName(SHEETS.HOCSINH || "DATA_HOCSINH");
    const students = [];
    const classSet = new Set();
    if (sheetHS) {
      const dataHS = sheetHS.getDataRange().getValues();
      for (let i = 1; i < dataHS.length; i++) {
        const row = dataHS[i];
        const c = formatClassValue(row[2]);
        if (c) classSet.add(c);
        students.push({
          username: String(row[0] || "").trim(),
          password: String(row[1] || "").trim(),
          lop: c,
          hoTen: String(row[3] || "").trim(),
          ngaySinh: formatBirthDateValue(row[4]),
          gioiTinh: String(row[5] || "").trim(),
          truong: String(row[6] || "").trim()
        });
      }
    }

    return createJsonResponse({
      success: true,
      sheetTitle: targetSS.getName(),
      exams: exams,
      results: results,
      students: students,
      classes: Array.from(classSet)
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi đọc Google Sheet: " + err.toString()
    });
  }
}

/**
 * TRA CỨU HỌC SINH TRÊN TRẠM TRUNG TÂM
 */
function handleLookupStudentHub(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS);
    const username = String(payload.username || "").trim().toLowerCase();

    if (!sheetHubStudents || !username) {
      return createJsonResponse({ success: false, message: "Không tìm thấy thông tin" });
    }

    const data = sheetHubStudents.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const hsCode = String(data[i][0] || "").trim().toLowerCase();
      if (hsCode === username) {
        return createJsonResponse({
          success: true,
          found: true,
          data: {
            username: String(data[i][0]),
            hoTen: String(data[i][1]),
            lop: String(data[i][2]),
            truong: String(data[i][3]),
            maGV: String(data[i][4]),
            serverUrl: String(data[i][5])
          }
        });
      }
    }

    return createJsonResponse({ success: false, found: false, message: "Học sinh chưa có trong danh bạ trung tâm" });
  } catch (err) {
    return createJsonResponse({ success: false, message: err.toString() });
  }
}

// ============================================================================
// MODULE 2: XỬ LÝ DÀNH CHO GIÁO VIÊN
// ============================================================================

/**
 * Tự động kiểm tra và nâng cấp Sheet DATA_DETHI để luôn có cột 'Chế độ xem bài'
 */
/**
 * Tự động kiểm tra và nâng cấp Sheet DATA_DETHI để luôn có 2 cột:
 * Cột 'Chế độ xem bài' và cột 'Chế độ xem điểm'
 */
function ensureDeThiSheetColumns(sheetDeThi) {
  try {
    const data = sheetDeThi.getDataRange().getValues();
    if (!data || data.length === 0) return;
    let headerRow = data[0];

    // 1. Kiểm tra xem đã có cột Chế độ xem bài chưa
    let reviewColIdx = -1;
    let scoreColIdx = -1;
    let violationColIdx = -1;
    let jsonColIdx = -1;

    for (let c = 0; c < headerRow.length; c++) {
      const hText = String(headerRow[c] || "").toLowerCase().trim();
      if (hText.indexOf("xem lại") !== -1 || (hText.indexOf("chế độ xem") !== -1 && hText.indexOf("điểm") === -1)) {
        reviewColIdx = c;
      }
      if (hText.indexOf("xem điểm") !== -1 || (hText.indexOf("chế độ") !== -1 && hText.indexOf("điểm") !== -1)) {
        scoreColIdx = c;
      }
      if (hText.indexOf("cảnh báo") !== -1 || hText.indexOf("vi phạm") !== -1) {
        violationColIdx = c;
      }
      if (hText.indexOf("json") !== -1 || hText.indexOf("dữ liệu") !== -1) {
        jsonColIdx = c;
      }
    }

    // Nếu chưa có cột "Chế độ xem bài"
    if (reviewColIdx === -1) {
      const insertAt = jsonColIdx !== -1 ? jsonColIdx + 1 : 7;
      sheetDeThi.insertColumnBefore(insertAt);
      sheetDeThi.getRange(1, insertAt).setValue("Chế độ xem bài");
      reviewColIdx = insertAt - 1;
      formatHeaderRow(sheetDeThi);
    }

    // Lấy lại header sau khi có thể đã chèn cột xem bài
    let refreshedData = sheetDeThi.getDataRange().getValues();
    headerRow = refreshedData[0];
    scoreColIdx = -1;
    violationColIdx = -1;
    jsonColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const hText = String(headerRow[c] || "").toLowerCase().trim();
      if (hText.indexOf("xem điểm") !== -1 || (hText.indexOf("chế độ") !== -1 && hText.indexOf("điểm") !== -1)) {
        scoreColIdx = c;
      }
      if (hText.indexOf("cảnh báo") !== -1 || hText.indexOf("vi phạm") !== -1) {
        violationColIdx = c;
      }
      if (hText.indexOf("json") !== -1 || hText.indexOf("dữ liệu") !== -1) {
        jsonColIdx = c;
      }
    }

    // 2. Kiểm tra xem đã có cột "Chế độ xem điểm" chưa
    if (scoreColIdx === -1) {
      const insertScoreAt = jsonColIdx !== -1 ? jsonColIdx + 1 : (headerRow.length >= 8 ? 8 : headerRow.length + 1);
      sheetDeThi.insertColumnBefore(insertScoreAt);
      sheetDeThi.getRange(1, insertScoreAt).setValue("Chế độ xem điểm");
      scoreColIdx = insertScoreAt - 1;
      formatHeaderRow(sheetDeThi);

      // Tự động quét và cập nhật giá trị cho các đề thi cũ
      const latestData = sheetDeThi.getDataRange().getValues();
      const currentJsonIdx = latestData[0].findIndex(h => String(h).toLowerCase().includes("json") || String(h).toLowerCase().includes("dữ liệu"));
      const targetJsonCol = currentJsonIdx !== -1 ? currentJsonIdx : (latestData[0].length - 1);

      for (let i = 1; i < latestData.length; i++) {
        const jsonStr = String(latestData[i][targetJsonCol] || "");
        let isAllowScore = true;
        try {
          const parsed = JSON.parse(jsonStr);
          isAllowScore = (parsed.choXemDiem !== false);
        } catch (e) {
          isAllowScore = true;
        }
        sheetDeThi.getRange(i + 1, scoreColIdx + 1).setValue(isAllowScore ? "Cho xem điểm" : "Khóa xem điểm");
      }
    }

    // Lấy lại header sau khi có thể đã chèn cột xem điểm
    refreshedData = sheetDeThi.getDataRange().getValues();
    headerRow = refreshedData[0];
    violationColIdx = -1;
    jsonColIdx = -1;
    for (let c = 0; c < headerRow.length; c++) {
      const hText = String(headerRow[c] || "").toLowerCase().trim();
      if (hText.indexOf("cảnh báo") !== -1 || hText.indexOf("vi phạm") !== -1) {
        violationColIdx = c;
      }
      if (hText.indexOf("json") !== -1 || hText.indexOf("dữ liệu") !== -1) {
        jsonColIdx = c;
      }
    }

    // 3. Kiểm tra xem đã có cột "Số lần cảnh báo" chưa
    if (violationColIdx === -1) {
      const insertViolationsAt = jsonColIdx !== -1 ? jsonColIdx + 1 : (headerRow.length >= 9 ? 9 : headerRow.length + 1);
      sheetDeThi.insertColumnBefore(insertViolationsAt);
      sheetDeThi.getRange(1, insertViolationsAt).setValue("Số lần cảnh báo");
      violationColIdx = insertViolationsAt - 1;
      formatHeaderRow(sheetDeThi);

      // Tự động quét và cập nhật giá trị cho các đề thi cũ
      const latestData = sheetDeThi.getDataRange().getValues();
      const currentJsonIdx = latestData[0].findIndex(h => String(h).toLowerCase().includes("json") || String(h).toLowerCase().includes("dữ liệu"));
      const targetJsonCol = currentJsonIdx !== -1 ? currentJsonIdx : (latestData[0].length - 1);

      for (let i = 1; i < latestData.length; i++) {
        const jsonStr = String(latestData[i][targetJsonCol] || "");
        let vText = "Không giới hạn";
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.choXemLaiBai === false) {
            const vLimit = Number(parsed.soLanViPhamChoPhep) || 5;
            vText = vLimit + " lần";
          }
        } catch (e) {}
        sheetDeThi.getRange(i + 1, violationColIdx + 1).setValue(vText);
      }
    }
  } catch (err) {
    Logger.log("Lỗi kiểm tra cột DATA_DETHI: " + err.toString());
  }
}

/**
 * Trợ giúp xác định chính xác index các cột của DATA_DETHI linh hoạt
 */
function getDeThiColumnIndexes(sheetDeThi) {
  const headerRow = sheetDeThi.getRange(1, 1, 1, Math.max(sheetDeThi.getLastColumn(), 1)).getValues()[0];
  let reviewCol = -1;
  let scoreCol = -1;
  let violationCol = -1;
  let jsonCol = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || "").toLowerCase().trim();
    if (h.indexOf("xem lại") !== -1 || (h.indexOf("chế độ xem") !== -1 && h.indexOf("điểm") === -1)) {
      reviewCol = c;
    }
    if (h.indexOf("xem điểm") !== -1 || (h.indexOf("chế độ") !== -1 && h.indexOf("điểm") !== -1)) {
      scoreCol = c;
    }
    if (h.indexOf("cảnh báo") !== -1 || h.indexOf("vi phạm") !== -1) {
      violationCol = c;
    }
    if (h.indexOf("json") !== -1 || h.indexOf("dữ liệu") !== -1) {
      jsonCol = c;
    }
  }

  if (jsonCol === -1) jsonCol = headerRow.length - 1;
  if (reviewCol === -1) reviewCol = 6;
  if (scoreCol === -1) scoreCol = 7;
  if (violationCol === -1) violationCol = (jsonCol > 8) ? 8 : -1;

  return { reviewCol, scoreCol, violationCol, jsonCol };
}

/**
 * So sánh tài khoản giáo viên thông minh (bỏ qua dấu nháy đơn, tiền tố số 0 nếu là số điện thoại)
 */
function isSameTeacherAccount(acc1, acc2) {
  var s1 = String(acc1 || "").trim().toLowerCase();
  var s2 = String(acc2 || "").trim().toLowerCase();
  if (s1 === s2) return true;
  if (s1.startsWith("'")) s1 = s1.substring(1).trim();
  if (s2.startsWith("'")) s2 = s2.substring(1).trim();
  if (s1 === s2) return true;
  var clean1 = s1.replace(/^0+/, "");
  var clean2 = s2.replace(/^0+/, "");
  if (clean1 && clean2 && clean1 === clean2) return true;
  return false;
}

function isSameStudentAccount(acc1, acc2) {
  if (!acc1 || !acc2) return false;
  var s1 = String(acc1 || "").trim().toLowerCase();
  var s2 = String(acc2 || "").trim().toLowerCase();
  if (s1 === s2) return true;
  if (s1.startsWith("'")) s1 = s1.substring(1).trim();
  if (s2.startsWith("'")) s2 = s2.substring(1).trim();
  if (s1 === s2) return true;
  var clean1 = s1.replace(/^0+/, "");
  var clean2 = s2.replace(/^0+/, "");
  if (clean1 && clean2 && clean1 === clean2) return true;
  return false;
}

function isAdminAccount(username) {
  var s = String(username || "").trim().toLowerCase();
  if (!s) return false;
  try {
    const ss = getSpreadsheet();
    if (ss) {
      const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
      if (sheetGV) {
        const gvCols = getGiaoVienColMap(sheetGV);
        if (gvCols.colRole >= 0) {
          const data = sheetGV.getDataRange().getValues();
          for (let i = 1; i < data.length; i++) {
            if (isSameTeacherAccount(data[i][gvCols.colUser], s)) {
              return (String(data[i][gvCols.colRole] || "").trim().toLowerCase() === "admin");
            }
          }
        }
      }
    }
  } catch (e) {}
  return false;
}

function handleSaveExam(payload) {
  const ss = getSpreadsheet();
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    return createJsonResponse({ success: false, message: "Không tìm thấy sheet DATA_DETHI!" });
  }

  ensureDeThiSheetColumns(sheetDeThi);
  const cols = getDeThiColumnIndexes(sheetDeThi);

  const usernameGV = String(payload.usernameGV || "").trim();
  const tenKyThi = String(payload.tenKyThi || "").trim();
  const lopChoPhep = String(payload.lopChoPhep || "").trim();
  const thoiGian = Number(payload.thoiGian) || 45;
  const trangThai = String(payload.trangThai || "Mở").trim();
  const choXemLaiBai = (payload.choXemLaiBai !== false);
  const choXemDiem = (payload.choXemDiem !== false);
  const cheDoXemText = choXemLaiBai ? "Cho xem lại bài" : "Khóa xem lại bài";
  const cheDoXemDiemText = choXemDiem ? "Cho xem điểm" : "Khóa xem điểm";

  let duLieuDeObj = payload.duLieuDe || {};
  if (typeof duLieuDeObj === "string") {
    try { duLieuDeObj = JSON.parse(duLieuDeObj); } catch (e) { duLieuDeObj = {}; }
  }
  duLieuDeObj.choXemLaiBai = choXemLaiBai;
  duLieuDeObj.choXemDiem = choXemDiem;
  duLieuDeObj.soLanViPhamChoPhep = (!choXemLaiBai) ? (Number(payload.soLanViPhamChoPhep) > 0 ? Number(payload.soLanViPhamChoPhep) : 5) : 0;
  if (payload.hoTenGV) {
    duLieuDeObj.hoTenGV = String(payload.hoTenGV).trim();
  }
  const duLieuDeStr = JSON.stringify(duLieuDeObj);

  let maDe = String(payload.maDe || "").trim();

  if (!tenKyThi) {
    return createJsonResponse({ success: false, message: "Tên kỳ kiểm tra không được để trống!" });
  }

  const canhBaoViPhamText = !choXemLaiBai ? ((Number(payload.soLanViPhamChoPhep) > 0 ? Number(payload.soLanViPhamChoPhep) : 5) + " lần") : "Không giới hạn";

  const data = sheetDeThi.getDataRange().getValues();
  let updated = false;

  // Nếu đã có mã đề, tìm dòng để cập nhật
  // 1. Nếu đã có mã đề, tìm dòng để cập nhật
  if (maDe) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === maDe && isSameTeacherAccount(data[i][2], usernameGV)) {
        const rowNum = i + 1;
        sheetDeThi.getRange(rowNum, 2).setValue(tenKyThi);
        sheetDeThi.getRange(rowNum, 4).setValue(lopChoPhep);
        sheetDeThi.getRange(rowNum, 5).setValue(thoiGian);
        sheetDeThi.getRange(rowNum, 6).setValue(trangThai);
        sheetDeThi.getRange(rowNum, cols.reviewCol + 1).setValue(cheDoXemText);
        sheetDeThi.getRange(rowNum, cols.scoreCol + 1).setValue(cheDoXemDiemText);
        if (cols.violationCol !== -1) {
          sheetDeThi.getRange(rowNum, cols.violationCol + 1).setValue(canhBaoViPhamText);
        }
        sheetDeThi.getRange(rowNum, cols.jsonCol + 1).setValue(duLieuDeStr);
        updated = true;
        break;
      }
    }
  }

  // 2. Nếu chưa có mã đề (hoặc mã đề không khớp), tự động kiểm tra xem giáo viên này đã có đề trùng tên kiểm tra chưa để cập nhật đè, tránh tạo thêm đề mới trùng lặp
  if (!updated && tenKyThi) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim().toLowerCase() === tenKyThi.toLowerCase() && isSameTeacherAccount(data[i][2], usernameGV)) {
        const rowNum = i + 1;
        maDe = String(data[i][0]).trim(); // Giữ nguyên mã đề cũ đã có
        sheetDeThi.getRange(rowNum, 2).setValue(tenKyThi);
        sheetDeThi.getRange(rowNum, 4).setValue(lopChoPhep);
        sheetDeThi.getRange(rowNum, 5).setValue(thoiGian);
        sheetDeThi.getRange(rowNum, 6).setValue(trangThai);
        sheetDeThi.getRange(rowNum, cols.reviewCol + 1).setValue(cheDoXemText);
        sheetDeThi.getRange(rowNum, cols.scoreCol + 1).setValue(cheDoXemDiemText);
        if (cols.violationCol !== -1) {
          sheetDeThi.getRange(rowNum, cols.violationCol + 1).setValue(canhBaoViPhamText);
        }
        sheetDeThi.getRange(rowNum, cols.jsonCol + 1).setValue(duLieuDeStr);
        updated = true;
        break;
      }
    }
  }

  // 3. Nếu thực sự là đề mới hoàn toàn
  if (!updated) {
    maDe = "DE_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000);
    let newRow = [];
    if (cols.violationCol !== -1) {
      newRow = [maDe, tenKyThi, usernameGV, lopChoPhep, thoiGian, trangThai, cheDoXemText, cheDoXemDiemText, canhBaoViPhamText, duLieuDeStr];
    } else {
      newRow = [maDe, tenKyThi, usernameGV, lopChoPhep, thoiGian, trangThai, cheDoXemText, cheDoXemDiemText, duLieuDeStr];
    }
    sheetDeThi.appendRow(newRow);
  }

  return createJsonResponse({
    success: true,
    message: updated ? "Cập nhật đề thi thành công!" : "Tạo mới đề thi thành công!",
    maDe: maDe
  });
}

function handleGetTeacherExams(payload) {
  const ss = getSpreadsheet();
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    return createJsonResponse({ success: true, exams: [] });
  }

  ensureDeThiSheetColumns(sheetDeThi);
  const cols = getDeThiColumnIndexes(sheetDeThi);

  const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();
  const data = sheetDeThi.getDataRange().getValues();
  const exams = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;

    if (!usernameGV || usernameGV === "all" || isAdminAccount(usernameGV) || isSameTeacherAccount(row[2], usernameGV)) {
      const cheDoXemText = String(row[cols.reviewCol] || "").trim();
      const cheDoXemDiemText = String(row[cols.scoreCol] || "").trim();
      const jsonRaw = row[cols.jsonCol];

      let duLieuDeParsed = {};
      try {
        duLieuDeParsed = typeof jsonRaw === "string" ? JSON.parse(jsonRaw) : (jsonRaw || {});
      } catch (e) {
        duLieuDeParsed = {};
      }

      let choXemLaiBai = true;
      if (cheDoXemText) {
        choXemLaiBai = cheDoXemText.indexOf("Khóa") === -1;
      } else {
        choXemLaiBai = (duLieuDeParsed.choXemLaiBai !== false);
      }

      let choXemDiem = true;
      if (cheDoXemDiemText) {
        choXemDiem = cheDoXemDiemText.indexOf("Khóa") === -1;
      } else {
        choXemDiem = (duLieuDeParsed.choXemDiem !== false);
      }

      const essayList = (duLieuDeParsed.tuLuan && Array.isArray(duLieuDeParsed.tuLuan.danhSachCauHoi)) ? duLieuDeParsed.tuLuan.danhSachCauHoi : [];
      const soCauTuLuan = essayList.length > 0 ? essayList.length : (duLieuDeParsed.tuLuan && duLieuDeParsed.tuLuan.noiDung ? 1 : 0);
      const hasTuLuan = !!(duLieuDeParsed.tuLuan && (duLieuDeParsed.tuLuan.noiDung || duLieuDeParsed.tuLuan.linkForm || essayList.length > 0));

      exams.push({
        maDe: String(row[0]),
        tenKyThi: String(row[1]),
        usernameGV: String(row[2]),
        lopChoPhep: String(row[3]),
        thoiGian: Number(row[4]) || 45,
        trangThai: String(row[5] || "Mở"),
        choXemLaiBai: choXemLaiBai,
        choXemDiem: choXemDiem,
        soLanViPhamChoPhep: (!choXemLaiBai ? (Number(duLieuDeParsed.soLanViPhamChoPhep) || 5) : 0),
        soCauHoi: (duLieuDeParsed.cauHoi || []).length,
        soCauTuLuan: soCauTuLuan,
        hasTuLuan: hasTuLuan,
        duLieuDe: duLieuDeParsed
      });
    }
  }

  return createJsonResponse({
    success: true,
    exams: exams
  });
}

function handleToggleExamStatus(payload) {
  const ss = getSpreadsheet();
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    return createJsonResponse({ success: false, message: "Không tìm thấy sheet DATA_DETHI!" });
  }

  const maDe = String(payload.maDe || "").trim();
  const newStatus = String(payload.trangThai || "Mở").trim();
  const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();

  const data = sheetDeThi.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === maDe) {
      const isOwner = isSameTeacherAccount(data[i][2], usernameGV);
      const isAdmin = isAdminAccount(usernameGV);

      // Kiểm tra xem đề thi có phải là đề được chia sẻ không (trong duLieuDe JSON)
      let isShared = false;
      try {
        const jsonColIdx = data[0].findIndex(h => String(h).toLowerCase().includes("json") || String(h).toLowerCase().includes("dữ liệu"));
        if (jsonColIdx !== -1) {
          const rawJson = data[i][jsonColIdx];
          const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : (rawJson || {});
          if (parsed && (parsed.sharedBy || parsed.sharedFromAdmin || parsed.nguonDe)) {
            isShared = true;
          }
        }
      } catch (eJson) {}

      if (usernameGV && !isOwner && !isAdmin && !isShared) {
        return createJsonResponse({ success: false, message: "Bạn không có quyền sửa đề thi này!" });
      }
      sheetDeThi.getRange(i + 1, 6).setValue(newStatus);
      return createJsonResponse({
        success: true,
        message: `Đã đổi trạng thái đề thi sang: "${newStatus}"`,
        trangThai: newStatus,
        maDe: maDe
      });
    }
  }

  return createJsonResponse({ success: false, message: "Không tìm thấy đề thi với mã: " + maDe });
}

/**
 * Xóa đề thi
 */
function handleDeleteExam(payload) {
  const ss = getSpreadsheet();
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    return createJsonResponse({ success: false, message: "Không tìm thấy sheet DATA_DETHI!" });
  }

  const maDe = String(payload.maDe || "").trim();
  const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();

  const data = sheetDeThi.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === maDe) {
      const isOwner = isSameTeacherAccount(data[i][2], usernameGV);
      const isAdmin = isAdminAccount(usernameGV);

      // Cho phép xóa nếu là chủ sở hữu, là Admin, hoặc là đề thi được chia sẻ
      let isShared = false;
      try {
        const jsonColIdx = data[0].findIndex(h => String(h).toLowerCase().includes("json") || String(h).toLowerCase().includes("dữ liệu"));
        if (jsonColIdx !== -1) {
          const rawJson = data[i][jsonColIdx];
          const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : (rawJson || {});
          if (parsed && (parsed.sharedBy || parsed.sharedFromAdmin || parsed.nguonDe)) {
            isShared = true;
          }
        }
      } catch (eJson) {}

      if (usernameGV && !isOwner && !isAdmin && !isShared) {
        return createJsonResponse({ success: false, message: "Bạn không có quyền xóa đề thi này!" });
      }
      sheetDeThi.deleteRow(i + 1);
      return createJsonResponse({ success: true, message: "Đã xóa đề thi thành công!", maDe: maDe });
    }
  }

  return createJsonResponse({ success: false, message: "Không tìm thấy đề thi cần xóa!" });
}

/**
 * Lấy kết quả làm bài của học sinh theo giáo viên và bài kiểm tra
 */
function handleGetTeacherResults(payload) {
  const ss = getSpreadsheet();
  const sheetKetQua = ss.getSheetByName(SHEETS.KETQUA);
  if (!sheetKetQua) {
    return createJsonResponse({ success: true, results: [] });
  }

  const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();
  const maDeFilter = String(payload.maDe || "").trim();

  const data = sheetKetQua.getDataRange().getValues();
  const results = [];

  // DATA_KETQUA Columns:
  // 0: Tài khoản HS | 1: Lớp | 2: Họ tên | 3: Ngày sinh | 4: Giới tính | 5: Trường
  // 6: Thời gian đăng nhập | 7: Mã đề thi | 8: Tài khoản GV của đề thi | 9: Điểm tổng
  // 10: Số câu đúng/sai | 11: Thời gian nộp bài | 12: Chi tiết trả lời
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowGV = String(row[8]).trim().toLowerCase();
    const rowMaDe = String(row[7]).trim();

    if (!usernameGV || usernameGV === "all" || isAdminAccount(usernameGV) || isSameTeacherAccount(rowGV, usernameGV)) {
      if (!maDeFilter || maDeFilter === "ALL" || rowMaDe === maDeFilter) {
        let chiTietParsed = [];
        let baiLamTuLuan = [];
        try {
          const rawDetail = JSON.parse(row[12] || "[]");
          if (rawDetail && typeof rawDetail === "object" && !Array.isArray(rawDetail)) {
            chiTietParsed = rawDetail.tracNghiem || [];
            baiLamTuLuan = rawDetail.tuLuan || [];
          } else {
            chiTietParsed = rawDetail;
          }
        } catch (e) {
          chiTietParsed = [];
          baiLamTuLuan = [];
        }

        results.push({
          usernameHS: String(row[0]),
          lop: String(row[1]),
          hoTen: String(row[2]),
          ngaySinh: formatBirthDateValue(row[3]),
          gioiTinh: String(row[4]),
          truong: String(row[5]),
          thoiGianDangNhap: formatDateValue(row[6]),
          maDe: rowMaDe,
          usernameGV: String(row[8]),
          diemTong: Number(row[9]) || 0,
          soCauDungSai: String(row[10] || ""),
          thoiGianNop: formatDateValue(row[11]),
          chiTietTraLoi: JSON.stringify(chiTietParsed),
          baiLamTuLuan: baiLamTuLuan
        });
      }
    }
  }

  return createJsonResponse({
    success: true,
    results: results
  });
}

/**
 * Lấy danh sách học sinh thuộc các lớp mà giáo viên giảng dạy
 */
function handleGetStudentsForTeacher(payload) {
  const ss = getSpreadsheet();
  const sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
  const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);

  if (!sheetHS) {
    return createJsonResponse({ success: true, students: [] });
  }

  const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();
  let allowedClassesStr = "";

  // 1. Tìm lớp giảng dạy của giáo viên
  if (sheetGV) {
    const gvCols = getGiaoVienColMap(sheetGV);
    const dataGV = sheetGV.getDataRange().getValues();
    for (let i = 1; i < dataGV.length; i++) {
      if (isSameTeacherAccount(dataGV[i][gvCols.colUser], usernameGV)) {
        allowedClassesStr = String(dataGV[i][gvCols.colClass] || "").trim();
        break;
      }
    }
  }

  // Chuẩn hóa danh sách lớp được phép
  const isAll = !allowedClassesStr || allowedClassesStr.toUpperCase().includes("ALL") || allowedClassesStr.toUpperCase().includes("TẤT CẢ") || !usernameGV || usernameGV === "all" || isAdminAccount(usernameGV);
  const allowedClasses = allowedClassesStr.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);

  const dataHS = sheetHS.getDataRange().getValues();
  const students = [];

  // DATA_HOCSINH: 0: TK HS | 1: Mật khẩu | 2: Lớp | 3: Họ tên | 4: Ngày sinh | 5: Giới tính | 6: Trường
  for (let i = 1; i < dataHS.length; i++) {
    const row = dataHS[i];
    const formattedClass = formatClassValue(row[2]);
    const rowClass = formattedClass.trim().toUpperCase();

    if (isAll || allowedClasses.includes(rowClass)) {
      students.push({
        username: String(row[0] || "").trim(),
        password: String(row[1] || "").trim(),
        lop: formattedClass,
        hoTen: String(row[3] || "").trim(),
        ngaySinh: formatBirthDateValue(row[4]),
        gioiTinh: String(row[5] || "").trim(),
        truong: String(row[6] || "").trim()
      });
    }
  }

  return createJsonResponse({
    success: true,
    students: students,
    allowedClasses: allowedClassesStr
  });
}

/**
 * Đổi mật khẩu học sinh và cập nhật trực tiếp lên DATA_HOCSINH Google Sheets
 */
function handleUpdateStudentPassword(payload) {
  const ss = getSpreadsheet();
  const sheetHS = ss.getSheetByName(SHEETS.HOCSINH);

  if (!sheetHS) {
    return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_HOCSINH!" });
  }

  const usernameHS = String(payload.usernameHS || "").trim();
  const oldPassword = payload.oldPassword !== undefined ? String(payload.oldPassword).trim() : null;
  const newPassword = String(payload.newPassword || "").trim();

  if (!usernameHS) {
    return createJsonResponse({ success: false, message: "Thiếu mã tài khoản học sinh!" });
  }

  if (!newPassword) {
    return createJsonResponse({ success: false, message: "Mật khẩu mới không được để trống!" });
  }

  const dataHS = sheetHS.getDataRange().getValues();
  for (let i = 1; i < dataHS.length; i++) {
    if (String(dataHS[i][0]).trim().toUpperCase() === usernameHS.toUpperCase()) {
      const currentPass = String(dataHS[i][1] !== null && dataHS[i][1] !== undefined ? dataHS[i][1] : "").trim();
      
      // Nếu có truyền oldPassword (học sinh tự đổi) thì kiểm tra mật khẩu cũ
      if (oldPassword !== null && currentPass !== oldPassword) {
        return createJsonResponse({
          success: false,
          message: "Mật khẩu hiện tại không chính xác! Vui lòng nhập đúng mật khẩu cũ."
        });
      }

      // Cột 2 (index 1) là Mật khẩu (Range bắt đầu từ 1, nên là cột 2)
      sheetHS.getRange(i + 1, 2).setValue(newPassword);

      const hoTen = String(dataHS[i][3] || usernameHS);
      return createJsonResponse({
        success: true,
        message: `Đã đổi mật khẩu thành công cho học sinh "${hoTen}" (${usernameHS})!`,
        usernameHS: usernameHS,
        newPassword: newPassword
      });
    }
  }

  return createJsonResponse({
    success: false,
    message: "Không tìm thấy học sinh có mã tài khoản: " + usernameHS
  });
}

/**
 * Đổi mật khẩu hàng loạt cho học sinh theo Lớp / Khối
 */
function handleBatchUpdateStudentPasswords(payload) {
  const ss = getSpreadsheet();
  const sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
  if (!sheetHS) {
    return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_HOCSINH!" });
  }

  // Lấy danh sách lớp được chọn (hỗ trợ cả mảng hoặc chuỗi phân tách bởi dấu phẩy)
  var rawClasses = payload.classes;
  var selectedClasses = [];
  if (Array.isArray(rawClasses)) {
    selectedClasses = rawClasses.map(function(c) { return String(c).trim().toUpperCase(); }).filter(Boolean);
  } else if (typeof rawClasses === "string" && rawClasses.trim()) {
    selectedClasses = rawClasses.split(/[,;\s]+/).map(function(c) { return String(c).trim().toUpperCase(); }).filter(Boolean);
  }

  if (selectedClasses.length === 0) {
    return createJsonResponse({ success: false, message: "Vui lòng chọn ít nhất một lớp học để đổi mật khẩu!" });
  }

  var type = String(payload.type || "birthdate").trim().toLowerCase();
  var customPassword = String(payload.customPassword || "").trim();
  var birthdateFormat = String(payload.birthdateFormat || "ddmmyyyy").trim().toLowerCase();
  var fallbackPassword = String(payload.fallbackPassword || "123456").trim();

  if (type === "custom" && !customPassword) {
    return createJsonResponse({ success: false, message: "Vui lòng nhập mật khẩu chung mới!" });
  }

  var dataRange = sheetHS.getDataRange();
  var dataHS = dataRange.getValues();
  if (!dataHS || dataHS.length <= 1) {
    return createJsonResponse({ success: false, message: "Danh sách học sinh trên Sheet DATA_HOCSINH đang trống!" });
  }

  var updatedCount = 0;
  var passwordColumnValues = [];

  for (var i = 1; i < dataHS.length; i++) {
    var row = dataHS[i];
    var formattedClass = formatClassValue(row[2]);
    var rowClass = String(formattedClass || "").trim().toUpperCase();
    var currentPass = row[1];

    if (selectedClasses.indexOf(rowClass) !== -1) {
      var newPass = "";
      if (type === "birthdate") {
        var rawDate = formatBirthDateValue(row[4]);
        if (rawDate) {
          var dateStr = String(rawDate).trim();
          if (dateStr.indexOf(" ") !== -1) dateStr = dateStr.split(" ")[0].trim();
          if (dateStr.indexOf("T") !== -1) dateStr = dateStr.split("T")[0].trim();
          var parts = dateStr.split(/[\/\-\.]/);
          if (parts.length >= 3) {
            var day = parts[0].length === 1 ? "0" + parts[0] : parts[0];
            var month = parts[1].length === 1 ? "0" + parts[1] : parts[1];
            var year = parts[2];
            if (year.length === 2) year = "20" + year;

            if (birthdateFormat === "dd/mm/yyyy") {
              newPass = day + "/" + month + "/" + year;
            } else {
              newPass = day + month + year;
            }
          } else {
            var digits = dateStr.replace(/\D/g, "");
            if (digits.length === 8) {
              if (birthdateFormat === "dd/mm/yyyy") {
                newPass = digits.substring(0, 2) + "/" + digits.substring(2, 4) + "/" + digits.substring(4);
              } else {
                newPass = digits;
              }
            } else {
              newPass = fallbackPassword;
            }
          }
        } else {
          newPass = fallbackPassword;
        }
      } else {
        newPass = customPassword;
      }

      passwordColumnValues.push([String(newPass)]);
      updatedCount++;
    } else {
      passwordColumnValues.push([currentPass !== null && currentPass !== undefined ? String(currentPass) : ""]);
    }
  }

  if (updatedCount > 0 && passwordColumnValues.length > 0) {
    // Đặt định dạng văn bản cho cột B và ghi hàng loạt dữ liệu mới
    var range = sheetHS.getRange(2, 2, passwordColumnValues.length, 1);
    range.setNumberFormat("@");
    range.setValues(passwordColumnValues);
  }

  return createJsonResponse({
    success: true,
    message: "Đã đổi mật khẩu thành công cho " + updatedCount + " học sinh thuộc " + selectedClasses.length + " lớp được chọn!",
    updatedCount: updatedCount,
    classes: selectedClasses
  });
}

/**
 * Đổi mật khẩu giáo viên và cập nhật trực tiếp lên DATA_GIAOVIEN Google Sheets
 */
function handleUpdateTeacherPassword(payload) {
  const ss = getSpreadsheet();
  const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);

  if (!sheetGV) {
    return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });
  }

  const usernameGV = String(payload.usernameGV || "").trim();
  const oldPassword = payload.oldPassword !== undefined ? String(payload.oldPassword).trim() : null;
  const newPassword = String(payload.newPassword || "").trim();

  if (!usernameGV) {
    return createJsonResponse({ success: false, message: "Thiếu mã tài khoản giáo viên!" });
  }

  if (!newPassword) {
    return createJsonResponse({ success: false, message: "Mật khẩu mới không được để trống!" });
  }

  ensureGiaoVienSheetColumns(sheetGV);
  const gvCols = getGiaoVienColMap(sheetGV);
  const dataGV = sheetGV.getDataRange().getValues();
  for (let i = 1; i < dataGV.length; i++) {
    if (isSameTeacherAccount(dataGV[i][gvCols.colUser], usernameGV)) {
      const currentPass = String(dataGV[i][gvCols.colPass] !== null && dataGV[i][gvCols.colPass] !== undefined ? dataGV[i][gvCols.colPass] : "").trim();

      // Nếu có truyền oldPassword thì kiểm tra mật khẩu cũ (Admin đổi thì không bắt buộc oldPassword)
      const isMasterAdmin = (String(payload.performedByAdmin || "").toLowerCase() === "true" || String(payload.isAdmin || "").toLowerCase() === "true");
      if (!isMasterAdmin && oldPassword !== null && currentPass !== oldPassword) {
        return createJsonResponse({
          success: false,
          message: "Mật khẩu hiện tại không chính xác! Vui lòng kiểm tra lại."
        });
      }

      // Cập nhật Mật khẩu
      const passCell = sheetGV.getRange(i + 1, gvCols.colPass + 1);
      passCell.setNumberFormat("@");
      passCell.setValue(newPassword);

      const hoTen = String(dataGV[i][gvCols.colName] || usernameGV);
      return createJsonResponse({
        success: true,
        message: `Đã đổi mật khẩu thành công cho giáo viên "${hoTen}" (${usernameGV})!`,
        usernameGV: usernameGV,
        newPassword: newPassword
      });
    }
  }

  return createJsonResponse({
    success: false,
    message: "Không tìm thấy giáo viên có mã tài khoản: " + usernameGV
  });
}

// ============================================================================
// MODULE 3: XỬ LÝ DÀNH CHO HỌC SINH
// ============================================================================

/**
 * Lấy danh sách đề thi đang "Mở" phù hợp với lớp của học sinh
 */
function handleGetStudentExams(payload) {
  const ss = getSpreadsheet();
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);
  if (!sheetDeThi) {
    return createJsonResponse({ success: true, exams: [] });
  }

  ensureDeThiSheetColumns(sheetDeThi);
  const cols = getDeThiColumnIndexes(sheetDeThi);

  const studentClass = formatClassValue(payload.lop || "").trim().toUpperCase();
  const requestedTeacher = String(payload.usernameGV || "").trim();
  const usernameHS = String(payload.usernameHS || "").trim();

  // Tra cứu lịch sử nộp bài của học sinh này từ DATA_KETQUA
  const submittedExamsMap = {};
  const sheetKetQua = ss.getSheetByName(SHEETS.KETQUA);
  if (sheetKetQua && usernameHS) {
    try {
      const kqData = sheetKetQua.getDataRange().getValues();
      // DATA_KETQUA Columns:
      // 0: Tài khoản HS | 1: Lớp | 2: Họ tên | 3: Ngày sinh | 4: Giới tính | 5: Trường
      // 6: Thời gian đăng nhập | 7: Mã đề thi | 8: Tài khoản GV của đề thi | 9: Điểm tổng
      // 10: Số câu đúng/sai | 11: Thời gian nộp bài | 12: Chi tiết trả lời
      for (let r = 1; r < kqData.length; r++) {
        const rHs = String(kqData[r][0] || "").trim();
        const rMaDe = String(kqData[r][7] || "").trim();
        if (rMaDe && isSameStudentAccount(rHs, usernameHS)) {
          const rawDiem = kqData[r][9];
          let numDiem = null;
          if (rawDiem !== "" && rawDiem !== null && rawDiem !== undefined) {
            const parsed = parseFloat(String(rawDiem).replace(",", "."));
            if (!isNaN(parsed)) numDiem = Math.round(parsed * 100) / 100;
          }
          submittedExamsMap[rMaDe] = {
            daLam: true,
            diemTong: (numDiem !== null ? numDiem : rawDiem),
            soCauDungSai: String(kqData[r][10] || ""),
            thoiGianNop: formatDateValue(kqData[r][11])
          };
        }
      }
    } catch (eKq) {
      Logger.log("Lỗi tra cứu DATA_KETQUA trong getStudentExams: " + eKq);
    }
  }

  // Lập bản đồ tra cứu Họ tên Giáo viên từ DATA_GIAOVIEN và HUB_SERVERS (Ưu tiên lấy tên GV, không lấy SĐT/Mã GV)
  const teacherNameMap = {};
  const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
  if (sheetGV) {
    try {
      const gvData = sheetGV.getDataRange().getValues();
      if (gvData.length > 1) {
        const gvHeader = gvData[0];
        let colUser = 0;
        let colName = 2; // Cột 2 chuẩn: "Họ tên GV"
        for (let c = 0; c < gvHeader.length; c++) {
          const h = String(gvHeader[c] || "").trim().toLowerCase();
          if (h.includes("tài khoản") || h.includes("tk") || h.includes("mã gv") || h.includes("sđt") || h.includes("sdt")) {
            colUser = c;
          }
          if ((h.includes("tên") || h.includes("họ") || h.includes("giáo viên")) && !h.includes("tài khoản") && !h.includes("tk") && !h.includes("mã")) {
            colName = c;
          }
        }
        for (let r = 1; r < gvData.length; r++) {
          const uStr = String(gvData[r][colUser] || "").trim().toLowerCase();
          const nameStr = String(gvData[r][colName] || "").trim();
          if (uStr && nameStr) {
            teacherNameMap[uStr] = nameStr;
            teacherNameMap[uStr.replace(/^0+/, "")] = nameStr;
            teacherNameMap["0" + uStr.replace(/^0+/, "")] = nameStr;
          }
        }
      }
    } catch (eGv) {
      Logger.log("Lỗi tra cứu DATA_GIAOVIEN trong Code getStudentExams: " + eGv);
    }
  }

  const sheetHub = ss.getSheetByName(SHEETS.HUB_SERVERS);
  if (sheetHub) {
    try {
      const hubData = sheetHub.getDataRange().getValues();
      for (let r = 1; r < hubData.length; r++) {
        const uStr = String(hubData[r][0] || "").trim().toLowerCase();
        const nameStr = String(hubData[r][1] || "").trim();
        if (uStr && nameStr) {
          teacherNameMap[uStr] = nameStr;
          teacherNameMap[uStr.replace(/^0+/, "")] = nameStr;
          teacherNameMap["0" + uStr.replace(/^0+/, "")] = nameStr;
        }
      }
    } catch (eHub) {}
  }

  const data = sheetDeThi.getDataRange().getValues();
  const availableExams = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const maDe = String(row[0]).trim();

    const trangThai = String(row[5] || "").trim();
    const rawAllowedClasses = row[3];
    const allowedClasses = String(rawAllowedClasses || "").trim().toUpperCase();

    if (trangThai.toLowerCase() === "mở") {
      let isAllowed = false;
      if (!allowedClasses || allowedClasses === "TẤT CẢ" || allowedClasses === "ALL") {
        isAllowed = true;
      } else {
        const classList = allowedClasses.split(/[,;\s]+/).map(c => formatClassValue(c).trim().toUpperCase()).filter(Boolean);
        isAllowed = classList.includes(studentClass);
      }

      // Nếu client gửi kèm usernameGV thì lọc theo đúng giáo viên đó
      if (isAllowed && requestedTeacher) {
        if (!isSameTeacherAccount(row[2], requestedTeacher)) {
          isAllowed = false;
        }
      }

      if (isAllowed) {
        const cheDoXemText = String(row[cols.reviewCol] || "").trim();
        const cheDoXemDiemText = String(row[cols.scoreCol] || "").trim();
        const jsonRaw = row[cols.jsonCol];

        let duLieuDeParsed = {};
        try {
          duLieuDeParsed = typeof jsonRaw === "string" ? JSON.parse(jsonRaw) : (jsonRaw || {});
        } catch (e) {
          duLieuDeParsed = {};
        }

        let choXemLaiBai = true;
        if (cheDoXemText) {
          choXemLaiBai = cheDoXemText.indexOf("Khóa") === -1;
        } else {
          choXemLaiBai = (duLieuDeParsed.choXemLaiBai !== false);
        }

        let choXemDiem = true;
        if (cheDoXemDiemText) {
          choXemDiem = cheDoXemDiemText.indexOf("Khóa") === -1;
        } else {
          choXemDiem = (duLieuDeParsed.choXemDiem !== false);
        }

        const safeQuestions = (duLieuDeParsed.cauHoi || []).map((q, idx) => {
          const safeQ = {
            id: q.id || (idx + 1),
            noiDung: q.noiDung,
            loaiCauHoi: q.loaiCauHoi || "multiple_choice",
            diem: q.diem || 1
          };

          if (q.loaiCauHoi === "true_false") {
            safeQ.y = (q.y || []).map(item => ({
              key: item.key,
              noiDung: item.noiDung
            }));
          } else {
            safeQ.luaChon = (q.luaChon || []).map(opt => ({
              key: opt.key,
              noiDung: opt.noiDung
            }));
          }
          return safeQ;
        });

        const rawTuLuan = duLieuDeParsed.tuLuan || {};
        const safeTuLuan = {
          linkForm: rawTuLuan.linkForm || "",
          noiDung: rawTuLuan.noiDung || "",
          danhSachCauHoi: (rawTuLuan.danhSachCauHoi || []).map((eq, eqIdx) => ({
            id: eq.id || (eqIdx + 1),
            noiDung: eq.noiDung,
            diem: eq.diem !== undefined ? eq.diem : 1
          }))
        };

        const essayList = (safeTuLuan.danhSachCauHoi && Array.isArray(safeTuLuan.danhSachCauHoi)) ? safeTuLuan.danhSachCauHoi : [];
        const soCauTuLuan = essayList.length > 0 ? essayList.length : (safeTuLuan.noiDung && String(safeTuLuan.noiDung).trim().length > 0 ? 1 : 0);
        const hasTuLuan = !!(safeTuLuan.noiDung || safeTuLuan.linkForm || essayList.length > 0);

        const submittedInfo = submittedExamsMap[maDe] || null;
        const daLam = !!submittedInfo;

        const rawGV = String(row[2] || "").trim();
        const rawGVKey = rawGV.toLowerCase();
        let hoTenGV = duLieuDeParsed.hoTenGV || duLieuDeParsed.tenGV || "";
        if (!hoTenGV || /^0?\d{8,11}$/.test(hoTenGV) || /^GV\d+$/i.test(hoTenGV)) {
          hoTenGV = teacherNameMap[rawGVKey] || teacherNameMap[rawGVKey.replace(/^0+/, "")] || teacherNameMap["0" + rawGVKey.replace(/^0+/, "")] || "";
        }
        if (!hoTenGV) {
          hoTenGV = rawGV;
        }

        availableExams.push({
          maDe: maDe,
          tenKyThi: String(row[1]),
          usernameGV: rawGV,
          hoTenGV: hoTenGV,
          tenGV: hoTenGV,
          lopChoPhep: String(row[3]),
          thoiGian: Number(row[4]) || 45,
          trangThai: trangThai,
          soCauHoi: safeQuestions.length,
          soCauTuLuan: soCauTuLuan,
          hasTuLuan: hasTuLuan,
          cauHoi: safeQuestions,
          choXemLaiBai: choXemLaiBai,
          choXemDiem: choXemDiem,
          soLanViPhamChoPhep: (!choXemLaiBai ? (Number(duLieuDeParsed.soLanViPhamChoPhep) || 5) : 0),
          tuLuan: safeTuLuan,
          daLam: daLam,
          diemCu: submittedInfo ? submittedInfo.diemTong : null,
          soCauDungSaiCu: submittedInfo ? submittedInfo.soCauDungSai : null,
          thoiGianNopCu: submittedInfo ? submittedInfo.thoiGianNop : null
        });
      }
    }
  }

  return createJsonResponse({
    success: true,
    exams: availableExams
  });
}

function handleSubmitExam(payload) {
  const ss = getSpreadsheet();
  const sheetKetQua = ss.getSheetByName(SHEETS.KETQUA);
  const sheetDeThi = ss.getSheetByName(SHEETS.DETHI);

  if (!sheetKetQua || !sheetDeThi) {
    return createJsonResponse({ success: false, message: "Lỗi cơ sở dữ liệu sheets chưa được khởi tạo!" });
  }

  const maDe = String(payload.maDe || "").trim();
  const usernameHS = String(payload.usernameHS || "").trim();
  const lop = formatClassValue(payload.lop || "").trim();
  const hoTen = String(payload.hoTen || "").trim();
  const ngaySinh = formatBirthDateValue(payload.ngaySinh || "");
  const gioiTinh = String(payload.gioiTinh || "").trim();
  const truong = String(payload.truong || "").trim();
  const thoiGianVaoThi = String(payload.thoiGianVaoThi || "").trim();
  const thoiGianNop = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

  // 1. Tìm đề thi gốc để lấy đáp án chuẩn đối chiếu (Server-side verification)
  const dataDe = sheetDeThi.getDataRange().getValues();
  let originalExamData = null;
  let usernameGV = "";

  for (let i = 1; i < dataDe.length; i++) {
    if (String(dataDe[i][0]).trim() === maDe) {
      usernameGV = String(dataDe[i][2]).trim();
      let rawJson = "";
      for (let c = dataDe[i].length - 1; c >= 6; c--) {
        const valStr = String(dataDe[i][c] || "").trim();
        if (valStr.startsWith("{") && valStr.endsWith("}")) {
          rawJson = dataDe[i][c];
          break;
        }
      }
      if (!rawJson) rawJson = dataDe[i][dataDe[i].length - 1];
      try {
        originalExamData = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
      } catch (e) {
        originalExamData = null;
      }
      break;
    }
  }

  if (!originalExamData || !originalExamData.cauHoi) {
    return createJsonResponse({ success: false, message: "Không tìm thấy dữ liệu đề thi gốc để chấm điểm!" });
  }

  // 2. Chấm điểm Trắc nghiệm theo quy tắc:
  // - Trắc nghiệm 4 lựa chọn: Đúng = trọn điểm câu
  // - Trắc nghiệm Đúng/Sai nhiều ý: Đúng 1 ý = 10%, Đúng 2 ý = 25%, Đúng 3 ý = 50%, Đúng 4 ý = 100%
  const studentAnswers = payload.cauTraLoi || {};
  const questions = originalExamData.cauHoi;
  let totalScore = 0;
  let maxPossibleScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const detailedResults = [];

  questions.forEach((q, idx) => {
    const qId = q.id || (idx + 1);
    const qPoints = Number(q.diem) || 1;
    maxPossibleScore += qPoints;

    const userAns = studentAnswers[qId];

    if (q.loaiCauHoi === "true_false") {
      // Đúng/Sai nhiều ý (a, b, c, d)
      let correctSubCount = 0;
      const subItems = q.y || [];
      const subItemResults = [];

      subItems.forEach((sub) => {
        const expected = parseBooleanVal(sub.dung);
        const hasAnswered = (userAns && userAns[sub.key] !== undefined && userAns[sub.key] !== null && userAns[sub.key] !== "");
        const actual = hasAnswered ? parseBooleanVal(userAns[sub.key]) : null;
        const isMatch = (actual !== null && actual === expected);
        if (isMatch) correctSubCount++;
        subItemResults.push({
          key: sub.key,
          noiDung: sub.noiDung,
          traLoi: actual,
          dung: isMatch,
          dapAnChuan: expected
        });
      });

      // Quy tắc tính tỉ lệ điểm Đúng/Sai:
      let ratio = 0;
      if (correctSubCount === 1) ratio = 0.10;
      else if (correctSubCount === 2) ratio = 0.25;
      else if (correctSubCount === 3) ratio = 0.50;
      else if (correctSubCount >= 4) ratio = 1.00;

      const earnedPoints = qPoints * ratio;
      totalScore += earnedPoints;

      if (ratio === 1.0) correctCount++;
      else incorrectCount++;

      detailedResults.push({
        qId: qId,
        loai: "true_false",
        soYDung: correctSubCount,
        tongSoY: subItems.length,
        diemDat: Math.round(earnedPoints * 100) / 100,
        diemToiDa: qPoints,
        chiTietY: subItemResults
      });

    } else {
      // Trắc nghiệm 4 lựa chọn thông thường
      const isCorrect = userAns && String(userAns).toUpperCase() === String(q.dapAnDung).toUpperCase();
      const earnedPoints = isCorrect ? qPoints : 0;
      totalScore += earnedPoints;

      if (isCorrect) correctCount++;
      else incorrectCount++;

      detailedResults.push({
        qId: qId,
        loai: "multiple_choice",
        traLoi: userAns || "Chưa chọn",
        dapAnDung: q.dapAnDung,
        dung: isCorrect,
        diemDat: earnedPoints,
        diemToiDa: qPoints
      });
    }
  });

  // Tính điểm phần trắc nghiệm chuẩn xác (Ví dụ 5.6/7)
  const diemTracNghiem = Math.round(totalScore * 100) / 100;
  const tongDiemTracNghiem = Math.round(maxPossibleScore * 100) / 100;
  const soCauDungSaiText = `${correctCount}/${questions.length} câu đúng (${incorrectCount} câu chưa chuẩn)`;

  // 3. XỬ LÝ PHẦN TỰ LUẬN (GHI VÀO DATA_TULUAN VÀ ĐÓNG GÓI)
  const studentEssayAnswers = payload.baiLamTuLuan || {};
  const examTuLuan = originalExamData.tuLuan || {};
  const essayQuestions = (examTuLuan.danhSachCauHoi && examTuLuan.danhSachCauHoi.length > 0)
    ? examTuLuan.danhSachCauHoi
    : [];

  let essayCount = essayQuestions.length;
  if (essayCount === 0) {
    if (examTuLuan.noiDung && String(examTuLuan.noiDung).trim().length > 0) {
      essayCount = 1;
    } else {
      essayCount = Object.keys(studentEssayAnswers).length;
    }
  }

  const choXemLaiBai = (originalExamData.choXemLaiBai !== false);
  const essayDetailsForStudent = [];

  // Tra cứu xem học sinh này đã từng nộp bài thi này trong DATA_KETQUA chưa
  let existingKqRowIndex = -1;
  const kqData = sheetKetQua.getDataRange().getValues();
  for (let r = 1; r < kqData.length; r++) {
    const rHs = String(kqData[r][0] || "").trim();
    const rMaDe = String(kqData[r][7] || "").trim();
    if (rMaDe === maDe && isSameStudentAccount(rHs, usernameHS)) {
      existingKqRowIndex = r;
      if (!choXemLaiBai) break; // Thi chính thức dừng ở dòng đầu tiên, Ôn tập tiếp tục để lấy dòng nộp cuối cùng
    }
  }

  // QUY TẮC 1: ĐỐI VỚI THI / KIỂM TRA CHÍNH THỨC (Khóa xem bài)
  // Nếu học sinh đã có kết quả trong DATA_KETQUA (do mạng chậm/bấm nộp lại),
  // trả về thành công kèm đúng điểm số đã ghi nhận để học sinh thấy màn hình kết quả!
  if (!choXemLaiBai && existingKqRowIndex !== -1) {
    const existingRow = kqData[existingKqRowIndex];
    let parsedDetail = {};
    try {
      parsedDetail = JSON.parse(existingRow[12] || "{}");
    } catch (e) {}

    const choXemDiem = (originalExamData.choXemDiem !== false);

    return createJsonResponse({
      success: true,
      daLamRoi: true,
      daGhiNhan: true,
      message: "Bài thi của bạn đã được hệ thống ghi nhận thành công trước đó!",
      diemTong: existingRow[9],
      diemTracNghiem: existingRow[9],
      tongDiemTracNghiem: tongDiemTracNghiem,
      soCauDung: correctCount,
      tongSoCau: questions.length,
      soCauDungSai: String(existingRow[10] || soCauDungSaiText),
      thoiGianNop: existingRow[11] || thoiGianNop,
      choXemLaiBai: false,
      choXemDiem: choXemDiem,
      chiTietKetQua: [],
      baiLamTuLuan: (parsedDetail && parsedDetail.tuLuan) ? parsedDetail.tuLuan : essayDetailsForStudent,
      danhSachCauHoiTuLuan: [],
      linkTuLuan: (originalExamData.tuLuan && originalExamData.tuLuan.linkForm) ? originalExamData.tuLuan.linkForm : ""
    });
  }

  // Xử lý lưu tự luận vào DATA_TULUAN
  if (essayCount > 0) {
    try {
      const sheetTuLuan = ensureTuLuanSheet(ss, essayCount);
      const rowTuLuan = [
        usernameHS,
        lop,
        hoTen,
        ngaySinh,
        gioiTinh,
        truong,
        thoiGianVaoThi || thoiGianNop,
        maDe,
        originalExamData.tenKyThi || "",
        thoiGianNop
      ];

      for (let qNum = 1; qNum <= essayCount; qNum++) {
        let ansText = "";
        if (studentEssayAnswers[qNum] !== undefined && studentEssayAnswers[qNum] !== null) {
          ansText = String(studentEssayAnswers[qNum]).trim();
        } else if (studentEssayAnswers[String(qNum)] !== undefined && studentEssayAnswers[String(qNum)] !== null) {
          ansText = String(studentEssayAnswers[String(qNum)]).trim();
        } else if (studentEssayAnswers[`cau_${qNum}`] !== undefined) {
          ansText = String(studentEssayAnswers[`cau_${qNum}`]).trim();
        }

        rowTuLuan.push(ansText);

        const qObj = essayQuestions[qNum - 1] || {};
        const essayAnsKey = (qObj.dapAn || qObj.dapAnDung || "");

        essayDetailsForStudent.push({
          id: qNum,
          noiDung: qObj.noiDung || (qNum === 1 && examTuLuan.noiDung ? examTuLuan.noiDung : `Câu hỏi tự luận ${qNum}`),
          diem: qObj.diem !== undefined ? qObj.diem : 0,
          baiLam: ansText,
          dapAn: choXemLaiBai ? essayAnsKey : ""
        });
      }

      // Thêm 2 cột cuối: Điểm Tự Luận (GV chấm), Nhận xét của GV
      rowTuLuan.push("", "");

      // Nếu là Ôn tập và đã từng nộp tự luận trước đó -> Cập nhật ghi đè vào đúng dòng cũ
      let existingTuLuanRow = -1;
      const tlData = sheetTuLuan.getDataRange().getValues();
      for (let t = 1; t < tlData.length; t++) {
        if (String(tlData[t][0]).trim().toUpperCase() === usernameHS.toUpperCase() && String(tlData[t][7]).trim() === maDe) {
          existingTuLuanRow = t + 1;
          break;
        }
      }

      if (existingTuLuanRow > 0) {
        // Cập nhật lại thời gian nộp và câu trả lời các câu tự luận
        sheetTuLuan.getRange(existingTuLuanRow, 10, 1, essayCount + 1).setValues([[
          thoiGianNop,
          ...rowTuLuan.slice(10, 10 + essayCount)
        ]]);
      } else {
        sheetTuLuan.appendRow(rowTuLuan);
      }
    } catch (tuLuanErr) {
      Logger.log("Lỗi ghi DATA_TULUAN: " + tuLuanErr.toString());
    }
  }

  // 4. Ghi vào DATA_KETQUA
  // 0: Tài khoản HS | 1: Lớp | 2: Họ tên | 3: Ngày sinh | 4: Giới tính | 5: Trường
  // 6: Thời gian đăng nhập | 7: Mã đề thi | 8: Tài khoản GV của đề thi | 9: Điểm tổng
  // 10: Số câu đúng/sai | 11: Thời gian nộp bài | 12: Chi tiết trả lời (gồm trắc nghiệm + tự luận)
  const fullDetailObject = {
    tracNghiem: detailedResults,
    tuLuan: essayDetailsForStudent,
    viPham: payload.soLanViPham ? {
      soLan: Number(payload.soLanViPham) || 0,
      lyDo: String(payload.lyDoNop || "Vi phạm quy chế thi")
    } : null
  };

  // QUY TẮC 2: ĐỐI VỚI ĐỀ ÔN TẬP / LUYỆN TẬP
  // Cho làm nhiều lần và GHI NHẬN KẾT QUẢ LẦN CUỐI CÙNG (cập nhật đè dòng cũ)
  if (choXemLaiBai && existingKqRowIndex !== -1) {
    const targetRow = existingKqRowIndex + 1;
    sheetKetQua.getRange(targetRow, 7, 1, 7).setValues([[
      thoiGianVaoThi || thoiGianNop,
      maDe,
      usernameGV,
      diemTracNghiem,
      soCauDungSaiText,
      thoiGianNop,
      JSON.stringify(fullDetailObject)
    ]]);
  } else {
    // Nếu học sinh nộp lần đầu tiên
    sheetKetQua.appendRow([
      usernameHS,
      lop.includes("/") ? "'" + lop : lop,
      hoTen,
      ngaySinh,
      gioiTinh,
      truong,
      thoiGianVaoThi || thoiGianNop,
      maDe,
      usernameGV,
      diemTracNghiem,
      soCauDungSaiText,
      thoiGianNop,
      JSON.stringify(fullDetailObject)
    ]);
  }

  const choXemDiem = (originalExamData.choXemDiem !== false);

  return createJsonResponse({
    success: true,
    message: (choXemLaiBai && existingKqRowIndex !== -1) 
      ? "Đã nộp bài & cập nhật kết quả lần làm bài mới nhất thành công!" 
      : "Nộp bài thành công!",
    diemTong: diemTracNghiem,
    diemTracNghiem: diemTracNghiem,
    tongDiemTracNghiem: tongDiemTracNghiem,
    soCauDung: correctCount,
    tongSoCau: questions.length,
    soCauDungSai: soCauDungSaiText,
    thoiGianNop: thoiGianNop,
    choXemLaiBai: choXemLaiBai,
    choXemDiem: choXemDiem,
    chiTietKetQua: choXemLaiBai ? detailedResults : [],
    baiLamTuLuan: essayDetailsForStudent,
    danhSachCauHoiTuLuan: choXemLaiBai ? essayQuestions : [],
    linkTuLuan: (originalExamData.tuLuan && originalExamData.tuLuan.linkForm) ? originalExamData.tuLuan.linkForm : ""
  });
}

/**
 * Format ngày sinh chuẩn dd/MM/yyyy (loại bỏ hoàn toàn phần giờ 00:00:00)
 */
function formatBirthDateValue(val) {
  if (val === null || val === undefined || val === "") return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  var s = String(val).trim();
  if (s.indexOf(" ") !== -1) {
    s = s.split(" ")[0].trim();
  }
  if (s.indexOf("T") !== -1) {
    s = s.split("T")[0].trim();
  }
  return s;
}

/**
 * Format tên lớp chuẩn hóa (Xử lý triệt để lỗi Google Sheets tự chuyển các lớp có dấu "/" như 8/3, 8/4, 9/2, 9/3 thành Ngày tháng Date)
 */
function formatClassValue(val) {
  if (val === null || val === undefined || val === "") return "";
  
  // 1. Trường hợp Google Sheets trả về Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    var d = val.getDate();
    var m = val.getMonth() + 1;
    // Khối 6..12: nếu d là khối và m là số lớp
    if (d >= 6 && d <= 12 && m >= 1 && m <= 15) {
      return d + "/" + m;
    }
    // Nếu m là khối và d là số lớp
    if (m >= 6 && m <= 12 && d >= 1 && d <= 15) {
      return m + "/" + d;
    }
    // Khối tiểu học 1..5
    if (d >= 1 && d <= 5 && m >= 1 && m <= 15) {
      return d + "/" + m;
    }
    return d + "/" + m;
  }

  var s = String(val).trim();
  if (s.startsWith("'")) {
    s = s.substring(1).trim();
  }

  // 2. Chuỗi Date tiếng Anh (VD: "Sun Mar 08 2026 ...", "Mon Feb 09 2026 ...")
  if (s.indexOf("GMT") !== -1 || /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}/.test(s)) {
    var parsedDate = new Date(s);
    if (!isNaN(parsedDate.getTime())) {
      var pd = parsedDate.getDate();
      var pm = parsedDate.getMonth() + 1;
      if (pd >= 6 && pd <= 12 && pm >= 1 && pm <= 15) return pd + "/" + pm;
      if (pm >= 6 && pm <= 12 && pd >= 1 && pd <= 15) return pm + "/" + pd;
      return pd + "/" + pm;
    }
  }

  // 3. Chuỗi chuẩn ISO (VD: "2026-02-09T00:00:00.000Z")
  if (s.indexOf("T") !== -1 && s.indexOf("-") !== -1) {
    var iso = new Date(s);
    if (!isNaN(iso.getTime())) {
      var id = iso.getDate();
      var im = iso.getMonth() + 1;
      if (id >= 6 && id <= 12 && im >= 1 && im <= 15) return id + "/" + im;
      if (im >= 6 && im <= 12 && id >= 1 && id <= 15) return im + "/" + id;
      return id + "/" + im;
    }
  }

  // 4. Chuỗi ngày tháng dạng "08/03/2026" hoặc "09/02/2026"
  var mDate = s.match(/^0?(\d{1,2})[-/]0?(\d{1,2})[-/]\d{4}$/);
  if (mDate) {
    var n1 = parseInt(mDate[1], 10);
    var n2 = parseInt(mDate[2], 10);
    if (n1 >= 6 && n1 <= 12 && n2 >= 1 && n2 <= 15) return n1 + "/" + n2;
    if (n2 >= 6 && n2 <= 12 && n1 >= 1 && n1 <= 15) return n2 + "/" + n1;
    return n1 + "/" + n2;
  }

  return s;
}

/**
 * Format ngày tháng tránh trả về định dạng Date thô của Google Sheets
 */
function formatDateValue(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
  return String(val || "");
}

/**
 * Xuất phản hồi JSON chuẩn MIME Type và cho phép CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Chuẩn hóa giá trị Boolean tránh lỗi kiểu dữ liệu chuỗi/số từ client hoặc Sheets
 */
function parseBooleanVal(val) {
  if (val === true || val === 1 || val === "1") return true;
  if (val === false || val === 0 || val === "0") return false;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "đúng" || s === "dung" || s === "t" || s === "đ" || s === "d";
  }
  return false;
}




/**
 * Xóa một bản ghi kết quả bài làm của học sinh (ở cả DATA_KETQUA và DATA_TULUAN)
 * Payload: { action: "deleteStudentResult", usernameHS, maDe, thoiGianNop, usernameGV }
 */
function handleDeleteStudentResult(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetKetQua = ss.getSheetByName(SHEETS.KETQUA);
    if (!sheetKetQua) {
      return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_KETQUA!" });
    }

    const usernameHS = String(payload.usernameHS || "").trim();
    const maDe = String(payload.maDe || "").trim();
    const thoiGianNop = String(payload.thoiGianNop || "").trim();
    const usernameGV = String(payload.usernameGV || "").trim().toLowerCase();

    if (!usernameHS || !maDe) {
      return createJsonResponse({ success: false, message: "Thiếu thông tin mã học sinh hoặc mã đề thi để xóa!" });
    }

    const dataKetQua = sheetKetQua.getDataRange().getValues();
    let deletedFromKetQua = false;

    // DATA_KETQUA: 0: TK HS | 1: Lớp | 2: Họ tên | 3: Ngày sinh | 4: Giới tính | 5: Trường
    // 6: TG Đăng nhập | 7: Mã đề | 8: TK GV đề thi | 9: Điểm tổng | 10: Đúng/sai | 11: TG nộp | 12: Chi tiết
    for (let i = dataKetQua.length - 1; i >= 1; i--) {
      const row = dataKetQua[i];
      const rowHS = String(row[0] || "").trim();
      const rowMaDe = String(row[7] || "").trim();
      const rowGV = String(row[8] || "").trim().toLowerCase();
      const rowThoiGianNop = formatDateValue(row[11]);

      const isMatchHS = rowHS.toUpperCase() === usernameHS.toUpperCase();
      const isMatchMaDe = rowMaDe === maDe;
      const cleanGv = s => String(s || "").trim().toLowerCase().replace(/^0+/, "");
      const isMatchGV = !usernameGV || rowGV === usernameGV || cleanGv(rowGV) === cleanGv(usernameGV);
      const isMatchTime = !thoiGianNop || rowThoiGianNop === thoiGianNop || String(row[11]).includes(thoiGianNop);

      if (isMatchHS && isMatchMaDe && isMatchGV && isMatchTime) {
        sheetKetQua.deleteRow(i + 1);
        deletedFromKetQua = true;
        break; // Xóa 1 lần nộp bài cụ thể
      }
    }

    // Xóa bản ghi tương ứng trong DATA_TULUAN nếu có
    const sheetTuLuan = ss.getSheetByName(SHEETS.TULUAN);
    if (sheetTuLuan) {
      const dataTuLuan = sheetTuLuan.getDataRange().getValues();
      for (let i = dataTuLuan.length - 1; i >= 1; i--) {
        const row = dataTuLuan[i];
        const rowHS = String(row[0] || "").trim();
        const rowMaDe = String(row[7] || "").trim();
        const rowThoiGianNop = formatDateValue(row[9]);

        const isMatchHS = rowHS.toUpperCase() === usernameHS.toUpperCase();
        const isMatchMaDe = rowMaDe === maDe;
        const isMatchTime = !thoiGianNop || rowThoiGianNop === thoiGianNop || String(row[9]).includes(thoiGianNop);

        if (isMatchHS && isMatchMaDe && isMatchTime) {
          sheetTuLuan.deleteRow(i + 1);
          break;
        }
      }
    }

    if (deletedFromKetQua) {
      return createJsonResponse({
        success: true,
        message: "Đã xóa kết quả bài làm khỏi Google Sheets thành công!",
        usernameHS: usernameHS,
        maDe: maDe
      });
    } else {
      return createJsonResponse({
        success: false,
        message: "Không tìm thấy bản ghi kết quả phù hợp trên Google Sheets để xóa!"
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xóa kết quả bài thi: " + err.toString()
    });
  }
}

/**
 * Xóa một học sinh khỏi Sheet DATA_HOCSINH
 * Payload: { action: "deleteStudent", usernameHS }
 */
function handleDeleteStudent(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
    if (!sheetHS) {
      return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_HOCSINH!" });
    }

    const usernameHS = String(payload.usernameHS || "").trim();
    if (!usernameHS) {
      return createJsonResponse({ success: false, message: "Thiếu mã tài khoản học sinh cần xóa!" });
    }

    const dataHS = sheetHS.getDataRange().getValues();
    let deleted = false;
    let deletedName = "";

    for (let i = dataHS.length - 1; i >= 1; i--) {
      const row = dataHS[i];
      const rowHS = String(row[0] || "").trim();
      if (rowHS.toUpperCase() === usernameHS.toUpperCase()) {
        deletedName = String(row[3] || usernameHS);
        sheetHS.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    if (deleted) {
      return createJsonResponse({
        success: true,
        message: "Đã xóa học sinh \"" + deletedName + "\" (" + usernameHS + ") khỏi Google Sheets thành công!",
        usernameHS: usernameHS
      });
    } else {
      return createJsonResponse({
        success: false,
        message: "Không tìm thấy học sinh có mã \"" + usernameHS + "\" trên Sheet DATA_HOCSINH!"
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xóa học sinh: " + err.toString()
    });
  }
}

/**
 * Thêm mới một học sinh thủ công vào Sheet DATA_HOCSINH
 * Payload: { action: "addStudent", username, password, lop, hoTen, ngaySinh, gioiTinh, truong }
 */
function handleAddStudent(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetHS = ss.getSheetByName(SHEETS.HOCSINH);
    if (!sheetHS) {
      sheetHS = ss.insertSheet(SHEETS.HOCSINH);
      const headers = ["Tài khoản HS", "Mật khẩu", "Lớp", "Họ tên", "Ngày sinh", "Giới tính", "Trường"];
      sheetHS.appendRow(headers);
      formatHeaderRow(sheetHS);
    }

    const username = String(payload.username || "").trim();
    const password = String(payload.password || "123").trim();
    const lop = formatClassValue(payload.lop || "").trim().toUpperCase();
    const hoTen = String(payload.hoTen || "").trim();
    const ngaySinh = formatBirthDateValue(payload.ngaySinh || "");
    const gioiTinh = String(payload.gioiTinh || "Nam").trim();
    const truong = String(payload.truong || "").trim();

    if (!username) {
      return createJsonResponse({ success: false, message: "Mã tài khoản học sinh không được để trống!" });
    }
    if (!hoTen) {
      return createJsonResponse({ success: false, message: "Họ và tên học sinh không được để trống!" });
    }
    if (!lop) {
      return createJsonResponse({ success: false, message: "Lớp học không được để trống!" });
    }

    const dataHS = sheetHS.getDataRange().getValues();
    for (let i = 1; i < dataHS.length; i++) {
      const existingUser = String(dataHS[i][0] || "").trim();
      if (existingUser.toUpperCase() === username.toUpperCase()) {
        return createJsonResponse({
          success: false,
          message: "Mã tài khoản \"" + username + "\" đã tồn tại trên Sheet DATA_HOCSINH! Vui lòng chọn mã khác."
        });
      }
    }

    // Thêm dòng mới: [Tài khoản HS, Mật khẩu, Lớp, Họ tên, Ngày sinh, Giới tính, Trường]
    const lopToSave = lop.includes("/") ? "'" + lop : lop;
    const newRow = [username, password, lopToSave, hoTen, ngaySinh, gioiTinh, truong];
    sheetHS.appendRow(newRow);

    return createJsonResponse({
      success: true,
      message: "Đã thêm mới học sinh \"" + hoTen + "\" (" + username + ") vào Google Sheets thành công!",
      student: {
        username: username,
        password: password,
        lop: lop,
        hoTen: hoTen,
        ngaySinh: ngaySinh,
        gioiTinh: gioiTinh,
        truong: truong
      }
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi thêm học sinh: " + err.toString()
    });
  }
}

// ============================================================================
// MODULE 4: QUẢN LÝ GIÁO VIÊN & KẾT NỐI MÁY CHỦ HUB (DÀNH CHO QUẢN TRỊ VIÊN ADMIN)
// ============================================================================

/**
 * 1. Lấy danh sách toàn bộ tài khoản giáo viên trong DATA_GIAOVIEN
 * Trả về: [ { username, password, hoTenGV, quyen, isAdmin, lopGiangDay, truong, backendVersion } ]
 */
function handleGetAdminTeachers(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) {
      return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });
    }

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);
    const data = sheetGV.getDataRange().getValues();

    // Lập bản đồ tra cứu lớp từ HUB_STUDENTS phòng trường hợp trên DATA_GIAOVIEN chưa có lớp
    const hubClassMap = {};
    try {
      const sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS);
      if (sheetHubStudents) {
        const hsData = sheetHubStudents.getDataRange().getValues();
        for (let j = 1; j < hsData.length; j++) {
          const maGV = String(hsData[j][4] || "").trim().toLowerCase();
          const lopHS = formatClassValue(hsData[j][2] || "").trim();
          if (maGV && lopHS) {
            if (!hubClassMap[maGV]) hubClassMap[maGV] = [];
            if (!hubClassMap[maGV].includes(lopHS)) hubClassMap[maGV].push(lopHS);
            const clean = maGV.replace(/^0+/, "");
            if (!hubClassMap[clean]) hubClassMap[clean] = [];
            if (!hubClassMap[clean].includes(lopHS)) hubClassMap[clean].push(lopHS);
          }
        }
      }
    } catch (eHsMap) {}

    const teachers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rawUser = String(row[cols.colUser] !== null && row[cols.colUser] !== undefined ? row[cols.colUser] : "").trim();
      const rawPass = String(row[cols.colPass] !== null && row[cols.colPass] !== undefined ? row[cols.colPass] : "").trim();
      if (!rawUser && !rawPass) continue;

      // CHỈ CÓ TÀI KHOẢN CÓ CỘT D (QUYỀN) LÀ 'admin' THÌ MỚI LÀ ADMIN
      // Tài khoản có tên là 'admin' nhưng Cột D là 'gv' thì KHÔNG PHẢI là Admin!
      const quyenVal = cols.colRole >= 0 ? String(row[cols.colRole] || "").trim().toLowerCase() : "";
      const isAdmin = (quyenVal === "admin");

      let lopVal = String(row[cols.colClass] || "").trim();
      if (!lopVal && !isAdmin) {
        const fromHub = hubClassMap[rawUser.toLowerCase()] || hubClassMap[rawUser.replace(/^0+/, "").toLowerCase()];
        if (fromHub && fromHub.length > 0) {
          lopVal = fromHub.join(", ");
        }
      }

      teachers.push({
        username: rawUser,
        password: rawPass,
        hoTenGV: String(row[cols.colName] || ""),
        quyen: quyenVal || "gv",
        isAdmin: isAdmin,
        lopGiangDay: lopVal,
        truong: String(row[cols.colSchool] || ""),
        backendVersion: formatBackendVersion(row[cols.colVer], "2.0")
      });
    }

    return createJsonResponse({
      success: true,
      teachers: teachers,
      total: teachers.length
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi lấy danh sách giáo viên: " + err.toString()
    });
  }
}

/**
 * 2. Thêm mới tài khoản giáo viên vào Sheet DATA_GIAOVIEN
 * Payload: { username, password, hoTenGV, quyen, lopGiangDay, truong }
 */
function handleAddTeacher(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) {
      initDatabase();
      sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    }

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);

    const username = String(payload.username || "").trim();
    const password = String(payload.password || "123").trim();
    const hoTenGV = String(payload.hoTenGV || "").trim();
    const quyen = String(payload.quyen || "gv").trim().toLowerCase();
    const lopGiangDay = String(payload.lopGiangDay || "").trim();
    const truong = String(payload.truong || "").trim();

    if (!username) {
      return createJsonResponse({ success: false, message: "Mã tài khoản Giáo viên (hoặc SĐT) không được để trống!" });
    }
    if (!hoTenGV) {
      return createJsonResponse({ success: false, message: "Họ và tên Giáo viên không được để trống!" });
    }

    const data = sheetGV.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const existingUser = String(data[i][cols.colUser] || "").trim();
      if (isSameTeacherAccount(existingUser, username)) {
        return createJsonResponse({
          success: false,
          message: `Tài khoản Giáo viên "${username}" đã tồn tại trên Sheet DATA_GIAOVIEN! Vui lòng chọn mã khác.`
        });
      }
    }

    const maxCol = Math.max(sheetGV.getLastColumn(), 7);
    const newRow = new Array(maxCol).fill("");
    newRow[cols.colUser] = username.startsWith("0") ? "'" + username : username;
    newRow[cols.colPass] = "'" + password;
    newRow[cols.colName] = hoTenGV;
    if (cols.colRole >= 0) newRow[cols.colRole] = quyen;
    newRow[cols.colClass] = lopGiangDay;
    newRow[cols.colSchool] = truong;
    if (cols.colVer >= 0) newRow[cols.colVer] = (quyen === "admin" ? CURRENT_BACKEND_VERSION : "2.0");

    sheetGV.appendRow(newRow);

    return createJsonResponse({
      success: true,
      message: `Đã thêm mới tài khoản Giáo viên "${hoTenGV}" (${username}) vào Google Sheets thành công!`,
      teacher: {
        username: username,
        password: password,
        hoTenGV: hoTenGV,
        quyen: quyen,
        lopGiangDay: lopGiangDay,
        truong: truong
      }
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi thêm Giáo viên: " + err.toString()
    });
  }
}

/**
 * 3. Cập nhật thông tin tài khoản giáo viên trong DATA_GIAOVIEN
 * Payload: { username, originalUsername, password, hoTenGV, quyen, lopGiangDay, truong }
 */
function handleUpdateTeacher(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);
    const targetUser = String(payload.originalUsername || payload.username || "").trim();
    if (!targetUser) return createJsonResponse({ success: false, message: "Thiếu mã tài khoản GV cần sửa!" });

    const data = sheetGV.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (isSameTeacherAccount(data[i][cols.colUser], targetUser)) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow === -1) {
      return createJsonResponse({ success: false, message: `Không tìm thấy tài khoản "${targetUser}" trên Sheet DATA_GIAOVIEN!` });
    }

    if (payload.hoTenGV !== undefined) {
      sheetGV.getRange(foundRow, cols.colName + 1).setValue(String(payload.hoTenGV).trim());
    }
    if (cols.colRole >= 0 && payload.quyen !== undefined) {
      sheetGV.getRange(foundRow, cols.colRole + 1).setValue(String(payload.quyen).trim().toLowerCase());
    }
    if (payload.lopGiangDay !== undefined) {
      sheetGV.getRange(foundRow, cols.colClass + 1).setValue(String(payload.lopGiangDay).trim());
    }
    if (payload.truong !== undefined) {
      sheetGV.getRange(foundRow, cols.colSchool + 1).setValue(String(payload.truong).trim());
    }
    if (payload.password !== undefined && String(payload.password).trim() !== "") {
      const passCell = sheetGV.getRange(foundRow, cols.colPass + 1);
      passCell.setNumberFormat("@");
      passCell.setValue(String(payload.password).trim());
    }

    return createJsonResponse({
      success: true,
      message: `Đã cập nhật thông tin Giáo viên "${payload.hoTenGV || targetUser}" thành công!`
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi cập nhật Giáo viên: " + err.toString()
    });
  }
}

/**
 * 4. Xóa tài khoản giáo viên khỏi DATA_GIAOVIEN
 * Payload: { username }
 */
function handleDeleteTeacher(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });

    const username = String(payload.username || "").trim();
    if (!username) return createJsonResponse({ success: false, message: "Thiếu mã tài khoản GV cần xóa!" });

    if (username.toLowerCase() === "admin") {
      return createJsonResponse({ success: false, message: "Không thể xóa tài khoản Quản trị viên mặc định 'admin'!" });
    }

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);
    const data = sheetGV.getDataRange().getValues();
    let deleted = false;
    let deletedName = "";

    for (let i = data.length - 1; i >= 1; i--) {
      if (isSameTeacherAccount(data[i][cols.colUser], username)) {
        deletedName = String(data[i][cols.colName] || username);
        sheetGV.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    if (deleted) {
      return createJsonResponse({
        success: true,
        message: `Đã xóa tài khoản Giáo viên "${deletedName}" (${username}) khỏi Google Sheets thành công!`,
        username: username
      });
    } else {
      return createJsonResponse({
        success: false,
        message: `Không tìm thấy tài khoản "${username}" trên Sheet DATA_GIAOVIEN!`
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xóa Giáo viên: " + err.toString()
    });
  }
}

/**
 * 5. Admin đổi / cấp lại mật khẩu cho bất kỳ Giáo viên nào
 * Payload: { username, newPassword }
 */
function handleAdminResetTeacherPassword(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });

    const username = String(payload.username || "").trim();
    const newPassword = String(payload.newPassword || "").trim();

    if (!username) return createJsonResponse({ success: false, message: "Thiếu mã tài khoản Giáo viên!" });
    if (!newPassword) return createJsonResponse({ success: false, message: "Mật khẩu mới không được để trống!" });

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);
    const data = sheetGV.getDataRange().getValues();
    let updated = false;
    let teacherName = "";

    for (let i = 1; i < data.length; i++) {
      if (isSameTeacherAccount(data[i][cols.colUser], username)) {
        teacherName = String(data[i][cols.colName] || username);
        const cell = sheetGV.getRange(i + 1, cols.colPass + 1);
        cell.setNumberFormat("@");
        cell.setValue(newPassword);
        updated = true;
        break;
      }
    }

    if (updated) {
      return createJsonResponse({
        success: true,
        message: `Đã đổi mật khẩu thành công cho Giáo viên "${teacherName}" (${username})!`,
        username: username
      });
    } else {
      return createJsonResponse({
        success: false,
        message: `Không tìm thấy Giáo viên có tài khoản "${username}" trên Sheet DATA_GIAOVIEN!`
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi đổi mật khẩu Giáo viên: " + err.toString()
    });
  }
}

/**
 * 6. Lấy danh sách kết nối máy chủ từ HUB_SERVERS
 */
function handleGetAdminHubServers(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetHub = ss.getSheetByName(SHEETS.HUB_SERVERS);
    if (!sheetHub) {
      sheetHub = ss.insertSheet(SHEETS.HUB_SERVERS);
      sheetHub.appendRow(["Mã GV", "Họ tên GV", "Trường", "URL Web App (Server)", "Trạng thái", "Ngày cập nhật"]);
      formatHeaderRow(sheetHub, "#4f46e5");
    }

    const data = sheetHub.getDataRange().getValues();
    const servers = [];
    for (let i = 1; i < data.length; i++) {
      const maGV = String(data[i][0] || "").trim();
      if (!maGV) continue;
      servers.push({
        maGV: maGV,
        hoTenGV: String(data[i][1] || "").trim(),
        truong: String(data[i][2] || "").trim(),
        serverUrl: String(data[i][3] || "").trim(),
        trangThai: String(data[i][4] || "Hoạt động").trim(),
        ngayCapNhat: String(data[i][5] || "").trim()
      });
    }

    return createJsonResponse({
      success: true,
      servers: servers,
      total: servers.length
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi lấy danh bạ kết nối HUB: " + err.toString()
    });
  }
}

/**
 * 7. Admin thêm hoặc cập nhật Link URL Web App cho Giáo viên vào sheet HUB_SERVERS
 * Payload: { maGV, hoTenGV, truong, serverUrl, trangThai }
 */
function handleSaveHubServer(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetHub = ss.getSheetByName(SHEETS.HUB_SERVERS);
    if (!sheetHub) {
      sheetHub = ss.insertSheet(SHEETS.HUB_SERVERS);
      sheetHub.appendRow(["Mã GV", "Họ tên GV", "Trường", "URL Web App (Server)", "Trạng thái", "Ngày cập nhật"]);
      formatHeaderRow(sheetHub, "#4f46e5");
    }

    const maGV = String(payload.maGV || "").trim();
    let hoTenGV = String(payload.hoTenGV || "").trim();
    let truong = String(payload.truong || "").trim();
    const serverUrl = String(payload.serverUrl || "").trim();
    const trangThai = String(payload.trangThai || "Hoạt động").trim();

    if (!maGV) {
      return createJsonResponse({ success: false, message: "Mã Giáo viên không được để trống!" });
    }

    if (serverUrl && (!serverUrl.startsWith("https://script.google.com/macros/s/") || !serverUrl.includes("/exec"))) {
      return createJsonResponse({
        success: false,
        message: "URL Web App không đúng định dạng chuẩn (phải là https://script.google.com/macros/s/.../exec)!"
      });
    }

    // Nếu chưa có Họ tên hoặc Trường, tự động tra cứu từ DATA_GIAOVIEN
    if (!hoTenGV || !truong) {
      try {
        const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
        if (sheetGV) {
          const gvCols = getGiaoVienColMap(sheetGV);
          const gvData = sheetGV.getDataRange().getValues();
          for (let r = 1; r < gvData.length; r++) {
            if (isSameTeacherAccount(gvData[r][gvCols.colUser], maGV)) {
              if (!hoTenGV) hoTenGV = String(gvData[r][gvCols.colName] || "").trim();
              if (!truong) truong = String(gvData[r][gvCols.colSchool] || "").trim();
              break;
            }
          }
        }
      } catch (eGvLookup) {}
    }

    const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    const data = sheetHub.getDataRange().getValues();
    let foundRow = -1;

    for (let r = 1; r < data.length; r++) {
      if (isSameTeacherAccount(data[r][0], maGV)) {
        foundRow = r + 1;
        break;
      }
    }

    if (foundRow > 0) {
      sheetHub.getRange(foundRow, 2, 1, 5).setValues([[
        hoTenGV || data[foundRow - 1][1],
        truong || data[foundRow - 1][2],
        serverUrl,
        trangThai,
        nowStr
      ]]);
    } else {
      const maGVToSave = maGV.startsWith("0") ? "'" + maGV : maGV;
      sheetHub.appendRow([maGVToSave, hoTenGV, truong, serverUrl, trangThai, nowStr]);
    }

    // Đồng thời cập nhật URL mới sang HUB_STUDENTS nếu có học sinh đang kết nối với GV này
    if (serverUrl) {
      try {
        const sheetHubStudents = ss.getSheetByName(SHEETS.HUB_STUDENTS);
        if (sheetHubStudents) {
          const hsData = sheetHubStudents.getDataRange().getValues();
          let hsUpdated = false;
          for (let h = 1; h < hsData.length; h++) {
            if (isSameTeacherAccount(hsData[h][4], maGV)) {
              hsData[h][5] = serverUrl;
              hsData[h][6] = nowStr;
              hsUpdated = true;
            }
          }
          if (hsUpdated) {
            sheetHubStudents.getRange(1, 1, hsData.length, hsData[0].length).setValues(hsData);
          }
        }
      } catch (eHs) {}
    }

    return createJsonResponse({
      success: true,
      message: `Đã lưu cấu hình kết nối máy chủ cho Giáo viên "${hoTenGV || maGV}" thành công vào Sheet HUB_SERVERS!`,
      server: {
        maGV: maGV,
        hoTenGV: hoTenGV,
        truong: truong,
        serverUrl: serverUrl,
        trangThai: trangThai,
        ngayCapNhat: nowStr
      }
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi lưu kết nối HUB_SERVERS: " + err.toString()
    });
  }
}

/**
 * 8. Xóa kết nối máy chủ khỏi Sheet HUB_SERVERS
 * Payload: { maGV }
 */
function handleDeleteHubServer(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetHub = ss.getSheetByName(SHEETS.HUB_SERVERS);
    if (!sheetHub) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet HUB_SERVERS!" });

    const maGV = String(payload.maGV || "").trim();
    if (!maGV) return createJsonResponse({ success: false, message: "Thiếu mã Giáo viên cần xóa kết nối!" });

    const data = sheetHub.getDataRange().getValues();
    let deleted = false;
    let deletedName = "";

    for (let i = data.length - 1; i >= 1; i--) {
      if (isSameTeacherAccount(data[i][0], maGV)) {
        deletedName = String(data[i][1] || maGV);
        sheetHub.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    if (deleted) {
      return createJsonResponse({
        success: true,
        message: `Đã xóa kết nối máy chủ của Giáo viên "${deletedName}" (${maGV}) khỏi Sheet HUB_SERVERS thành công!`,
        maGV: maGV
      });
    } else {
      return createJsonResponse({
        success: false,
        message: `Không tìm thấy kết nối của Giáo viên "${maGV}" trên Sheet HUB_SERVERS!`
      });
    }
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi xóa kết nối HUB_SERVERS: " + err.toString()
    });
  }
}

/**
 * 9. ĐỒNG BỘ LỚP GIẢNG DẠY TỪ MÁY CHỦ RIÊNG / GOOGLE SHEETS CỦA GIÁO VIÊN VÀO DATA_GIAOVIEN TRUNG TÂM (CỘT E)
 * Quét toàn bộ URL máy chủ trong HUB_SERVERS, gọi API của từng GV để lấy chuỗi lớp và lưu vào Cột E
 * Payload: { usernameGV: "..." } (Tùy chọn: chỉ định 1 GV hoặc đồng bộ tất cả)
 */
function handleSyncClassesFromHubServers(payload) {
  try {
    const ss = getSpreadsheet();
    let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN || "DATA_GIAOVIEN");
    let sheetHub = ss.getSheetByName(SHEETS.HUB_SERVERS || "HUB_SERVERS");
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });
    if (!sheetHub) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet HUB_SERVERS!" });

    ensureGiaoVienSheetColumns(sheetGV);
    const gvCols = getGiaoVienColMap(sheetGV);
    const gvData = sheetGV.getDataRange().getValues();
    const hubData = sheetHub.getDataRange().getValues();

    const targetUser = payload && payload.usernameGV ? String(payload.usernameGV).trim().toLowerCase() : "";

    // Lập bản đồ dòng của từng GV trên DATA_GIAOVIEN (1-based row index)
    const gvRowMap = {};
    for (let i = 1; i < gvData.length; i++) {
      const u = String(gvData[i][gvCols.colUser] || "").trim();
      if (u) {
        gvRowMap[u.toLowerCase()] = i + 1;
        gvRowMap[u.replace(/^0+/, "").toLowerCase()] = i + 1;
      }
    }

    const results = [];
    let updatedCount = 0;

    for (let h = 1; h < hubData.length; h++) {
      const maGV = String(hubData[h][0] || "").trim();
      const hoTen = String(hubData[h][1] || "").trim();
      const serverUrl = String(hubData[h][3] || "").trim();

      if (!maGV || !serverUrl) continue;
      if (targetUser && !isSameTeacherAccount(maGV, targetUser)) continue;

      // Bỏ qua nếu serverUrl chính là link của trung tâm (tránh loop)
      if (SPREADSHEET_URL && serverUrl.includes(SPREADSHEET_URL)) continue;

      try {
        const queryUrl = serverUrl + (serverUrl.includes("?") ? "&" : "?") + "action=getStudentsForTeacher&usernameGV=" + encodeURIComponent(maGV) + "&_t=" + Date.now();
        const response = UrlFetchApp.fetch(queryUrl, {
          method: "get",
          muteHttpExceptions: true,
          followRedirects: true,
          validateHttpsCertificates: true
        });

        if (response.getResponseCode() === 200) {
          const respText = response.getContentText();
          if (respText && !respText.trim().startsWith("<")) {
            const data = JSON.parse(respText);
            if (data && data.success) {
              let classesStr = "";
              if (data.allowedClasses && String(data.allowedClasses).trim() !== "") {
                classesStr = String(data.allowedClasses).trim();
              } else if (Array.isArray(data.classes) && data.classes.length > 0) {
                classesStr = data.classes.filter(Boolean).join(", ");
              } else if (Array.isArray(data.students) && data.students.length > 0) {
                const uniqueLop = [];
                data.students.forEach(st => {
                  const l = formatClassValue(st.lop || "").trim();
                  if (l && !uniqueLop.includes(l)) uniqueLop.push(l);
                });
                classesStr = uniqueLop.join(", ");
              }

              if (classesStr) {
                const targetRow = gvRowMap[maGV.toLowerCase()] || gvRowMap[maGV.replace(/^0+/, "").toLowerCase()];
                if (targetRow) {
                  sheetGV.getRange(targetRow, gvCols.colClass + 1).setValue(classesStr);
                  updatedCount++;
                  results.push({ maGV: maGV, hoTen: hoTen, classes: classesStr, status: "updated" });
                } else {
                  const maxCol = Math.max(sheetGV.getLastColumn(), 7);
                  const newRow = new Array(maxCol).fill("");
                  newRow[gvCols.colUser] = maGV.startsWith("0") ? "'" + maGV : maGV;
                  newRow[gvCols.colPass] = "'123456";
                  newRow[gvCols.colName] = hoTen || maGV;
                  if (gvCols.colRole >= 0) newRow[gvCols.colRole] = "gv";
                  newRow[gvCols.colClass] = classesStr;
                  newRow[gvCols.colSchool] = String(hubData[h][2] || "").trim();
                  if (gvCols.colVer >= 0) newRow[gvCols.colVer] = "2.0";
                  sheetGV.appendRow(newRow);
                  gvRowMap[maGV.toLowerCase()] = sheetGV.getLastRow();
                  gvRowMap[maGV.replace(/^0+/, "").toLowerCase()] = sheetGV.getLastRow();
                  updatedCount++;
                  results.push({ maGV: maGV, hoTen: hoTen, classes: classesStr, status: "created" });
                }
              } else {
                results.push({ maGV: maGV, hoTen: hoTen, status: "no_classes_found" });
              }
            }
          }
        } else {
          results.push({ maGV: maGV, hoTen: hoTen, status: "http_error_" + response.getResponseCode() });
        }
      } catch (errFetch) {
        results.push({ maGV: maGV, hoTen: hoTen, status: "error", error: errFetch.toString() });
      }
    }

    return createJsonResponse({
      success: true,
      message: `Đã đồng bộ thành công lớp giảng dạy cho ${updatedCount} giáo viên từ Google Sheets riêng về Sheet Trung Tâm!`,
      updatedCount: updatedCount,
      details: results
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi đồng bộ lớp giảng dạy từ máy chủ GV: " + err.toString()
    });
  }
}

/**
 * 10. Cập nhật lớp giảng dạy cho một giáo viên cụ thể trên Sheet DATA_GIAOVIEN trung tâm
 * Payload: { usernameGV: "...", lopGiangDay: "..." }
 */
function handleUpdateTeacherClasses(payload) {
  try {
    const ss = getSpreadsheet();
    const sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
    if (!sheetGV) return createJsonResponse({ success: false, message: "Không tìm thấy Sheet DATA_GIAOVIEN!" });

    const usernameGV = String(payload.usernameGV || "").trim();
    const lopGiangDay = String(payload.lopGiangDay || "").trim();
    if (!usernameGV) return createJsonResponse({ success: false, message: "Thiếu mã tài khoản giáo viên!" });

    ensureGiaoVienSheetColumns(sheetGV);
    const cols = getGiaoVienColMap(sheetGV);
    const data = sheetGV.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (isSameTeacherAccount(data[i][cols.colUser], usernameGV)) {
        sheetGV.getRange(i + 1, cols.colClass + 1).setValue(lopGiangDay);
        return createJsonResponse({
          success: true,
          message: `Đã cập nhật lớp giảng dạy "${lopGiangDay}" cho giáo viên ${usernameGV} vào Sheet DATA_GIAOVIEN trung tâm!`,
          lopGiangDay: lopGiangDay
        });
      }
    }

    return createJsonResponse({ success: false, message: `Không tìm thấy giáo viên ${usernameGV} trên Sheet DATA_GIAOVIEN!` });
  } catch (err) {
    return createJsonResponse({ success: false, message: "Lỗi cập nhật lớp GV: " + err.toString() });
  }
}
