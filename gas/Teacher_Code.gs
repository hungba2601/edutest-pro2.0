/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT (GAS) - DÀNH CHO GOOGLE SHEET CÁ NHÂN GIÁO VIÊN
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
const SPREADSHEET_URL = ""; 

// PHIÊN BẢN BACKEND HIỆN TẠI DÀNH CHO GIÁO VIÊN (DẠNG SỐ: 2.1, 2.2, 2.3, 2.4,...)
const TEACHER_BACKEND_VERSION = "2.4"; 

// ĐỊNH NGHĨA TÊN CÁC SHEET DỮ LIỆU
const SHEETS = {
  HOCSINH: "DATA_HOCSINH",
  GIAOVIEN: "DATA_GIAOVIEN",
  DETHI: "DATA_DETHI",
  KETQUA: "DATA_KETQUA",
  TULUAN: "DATA_TULUAN"
};

/**
 * Hàm lấy đối tượng Spreadsheet linh hoạt (hỗ trợ cả URL hoặc Sheet hiện hành)
 */
function getSpreadsheet() {
  if (SPREADSHEET_URL && SPREADSHEET_URL.trim() !== "") {
    return SpreadsheetApp.openByUrl(SPREADSHEET_URL.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
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

  // 2. Cấu trúc Sheet DATA_GIAOVIEN
  let sheetGV = ss.getSheetByName(SHEETS.GIAOVIEN);
  if (!sheetGV) {
    sheetGV = ss.insertSheet(SHEETS.GIAOVIEN);
    const headers = ["Tài khoản GV", "Mật khẩu", "Họ tên GV", "Lớp giảng dạy", "Trường"];
    sheetGV.appendRow(headers);
    formatHeaderRow(sheetGV);

    // Thêm dữ liệu giáo viên mẫu
    sheetGV.appendRow(["GV001", "123", "Thầy Lê Hoàng Nam", "9A1, 9A2", "THCS Chu Văn An"]);
    sheetGV.appendRow(["GV002", "123", "Cô Nguyễn Thùy Chi", "9A1, 9A3", "THCS Chu Văn An"]);
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

  Logger.log("✅ Khởi tạo cơ sở dữ liệu thành công với đầy đủ 5 Sheets dành cho Giáo viên!");
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
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action) {
      const payload = e.parameter;
      const action = payload.action;

      switch (action) {
        case "checkBackendVersion":
          return createJsonResponse({
            success: true,
            version: TEACHER_BACKEND_VERSION,
            message: "Phiên bản Teacher_Code.gs: " + TEACHER_BACKEND_VERSION
          });
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
        case "toggleExamStatus":
          return handleToggleExamStatus(payload);
        case "deleteExam":
          return handleDeleteExam(payload);
        case "verifyAdminPassword":
          return handleVerifyAdminPassword(payload);
      }
    }

    const response = {
      status: "online",
      version: TEACHER_BACKEND_VERSION,
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

    const data = sheetGV.getDataRange().getValues();
    // Cột: 0: Tài khoản GV | 1: Mật khẩu | 2: Họ tên GV | 3: Lớp giảng dạy | 4: Trường
    let userFound = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue; // Bỏ qua dòng trống

      const gvUser = String(row[0] !== null && row[0] !== undefined ? row[0] : "").trim().replace(/\u00A0/g, "");
      const gvPass = String(row[1] !== null && row[1] !== undefined ? row[1] : "").trim().replace(/\u00A0/g, "");

      if (gvUser.toLowerCase() === username.toLowerCase()) {
        userFound = true;
        if (gvPass === password) {
          let personalServerUrl = "";
          try {
            if (typeof ScriptApp !== "undefined" && ScriptApp.getService) {
              personalServerUrl = ScriptApp.getService().getUrl() || "";
            }
          } catch (eUrl) {}

          return createJsonResponse({
            success: true,
            message: "Đăng nhập Giáo viên thành công!",
            role: "GV",
            data: {
              username: gvUser,
              hoTenGV: String(row[2] || ""),
              lopGiangDay: String(row[3] || ""),
              truong: String(row[4] || ""),
              ngaySinh: row[5] ? formatBirthDateValue(row[5]) : "",
              serverUrl: personalServerUrl || ""
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
    const hsCols = getHocSinhColMap(sheetHS);
    let userFound = false;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[hsCols.colUser] && !row[hsCols.colPass]) continue; // Bỏ qua dòng trống

      const hsUser = String(row[hsCols.colUser] !== null && row[hsCols.colUser] !== undefined ? row[hsCols.colUser] : "").trim().replace(/\u00A0/g, "");
      const hsPass = String(row[hsCols.colPass] !== null && row[hsCols.colPass] !== undefined ? row[hsCols.colPass] : "").trim().replace(/\u00A0/g, "");

      if (hsUser.toLowerCase() === username.toLowerCase()) {
        userFound = true;
        if (hsPass === password) {
          return createJsonResponse({
            success: true,
            message: "Đăng nhập Học sinh thành công!",
            role: "HS",
            data: {
              username: hsUser,
              lop: formatClassValue(row[hsCols.colClass]),
              hoTen: String(row[hsCols.colName] || ""),
              ngaySinh: formatBirthDateValue(row[hsCols.colDob]),
              gioiTinh: String(row[hsCols.colGender] || ""),
              truong: String(row[hsCols.colSchool] || "")
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
        : `Tài khoản Học sinh "${username}" không tồn tại trên hệ thống hoặc chưa được đồng bộ lên Trạm Trung Tâm!`
    });
  }
}

/**
 * XÁC THỰC MẬT KHẨU BẢO MẬT CẤU HÌNH BACKEND (ĐỌC LINH HOẠT TẠI Ô F2, G1 HOẶC CẠNH CHỮ CẤU HÌNH BACKEND)
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

    // Đọc danh sách các ô tiềm năng (F2 nơi người dùng đặt 1234, G1, G2, F1)
    const candidates = [];
    
    // 1. Ô F2 (vị trí người dùng đang đặt 1234 cạnh chữ CẤU HÌNH BACKEND)
    try { candidates.push(String(sheet.getRange("F2").getValue() || "").trim()); } catch(e) {}
    // 2. Ô G1
    try { candidates.push(String(sheet.getRange("G1").getValue() || "").trim()); } catch(e) {}
    // 3. Ô G2
    try { candidates.push(String(sheet.getRange("G2").getValue() || "").trim()); } catch(e) {}
    // 4. Ô F1
    try { candidates.push(String(sheet.getRange("F1").getValue() || "").trim()); } catch(e) {}

    // 5. Quét tìm ô bên cạnh nhãn "CẤU HÌNH BACKEND"
    try {
      const topData = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 10), Math.min(sheet.getLastColumn(), 10)).getValues();
      for (let r = 0; r < topData.length; r++) {
        for (let c = 0; c < topData[r].length; c++) {
          const cellStr = String(topData[r][c] || "").toUpperCase();
          if (cellStr.includes("CẤU HÌNH") || cellStr.includes("BACKEND")) {
            if (c > 0) candidates.push(String(topData[r][c - 1] || "").trim());
            if (c + 1 < topData[r].length) candidates.push(String(topData[r][c + 1] || "").trim());
          }
        }
      }
    } catch(e) {}

    // Lọc các giá trị hợp lệ
    const validPasswords = candidates.filter(p => p && !p.toUpperCase().includes("CẤU HÌNH") && !p.toUpperCase().includes("BACKEND"));

    if (validPasswords.length === 0) {
      return createJsonResponse({
        success: false,
        message: "Chưa cấu hình mật khẩu quản trị tại ô F2 hoặc G1 của sheet DATA_GIAOVIEN!"
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
        message: "Mật khẩu quản trị không chính xác! Vui lòng kiểm tra lại ô F2 hoặc G1 trong sheet DATA_GIAOVIEN."
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

  const canhBaoViPhamText = !choXemLaiBai ? ((Number(payload.soLanViPhamChoPhep) > 0 ? Number(payload.soLanViPhamChoPhep) : 5) + " lần") : "Không giới hạn";

  let maDe = String(payload.maDe || "").trim();

  if (!tenKyThi) {
    return createJsonResponse({ success: false, message: "Tên kỳ kiểm tra không được để trống!" });
  }

  const data = sheetDeThi.getDataRange().getValues();
  let updated = false;

  // 1. Nếu đã có mã đề, tìm dòng để cập nhật
  if (maDe) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === maDe) {
        const rowNum = i + 1;
        sheetDeThi.getRange(rowNum, 2).setValue(tenKyThi);
        if (usernameGV) sheetDeThi.getRange(rowNum, 3).setValue(usernameGV);
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
      if (String(data[i][1]).trim().toLowerCase() === tenKyThi.toLowerCase()) {
        const rowNum = i + 1;
        maDe = String(data[i][0]).trim(); // Giữ nguyên mã đề cũ đã có
        sheetDeThi.getRange(rowNum, 2).setValue(tenKyThi);
        if (usernameGV) sheetDeThi.getRange(rowNum, 3).setValue(usernameGV);
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
    message: updated ? "Cập nhật đề thi thành công!" : "Tạo đề thi mới thành công!",
    maDe: maDe,
    choXemLaiBai: choXemLaiBai,
    choXemDiem: choXemDiem
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
    // Trên Sheet cá nhân của Giáo viên, toàn bộ đề thi trong DATA_DETHI đều hiển thị cho Giáo viên này
    // (Bao gồm đề tự tạo và đề được chia sẻ từ Admin hoặc đồng nghiệp gửi qua)
    {
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
  const usernameGV = String(payload.usernameGV || "").trim();

  const data = sheetDeThi.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === maDe) {
      // Trên Sheet cá nhân của Giáo viên, toàn bộ đề thi đều thuộc quyền quản lý của Giáo viên
      sheetDeThi.getRange(i + 1, 6).setValue(newStatus);
      if (usernameGV && !data[i][2]) {
        sheetDeThi.getRange(i + 1, 3).setValue(usernameGV);
      }
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

  const data = sheetDeThi.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === maDe) {
      // Trên Sheet cá nhân của Giáo viên, Giáo viên có toàn quyền xóa đề thi trên Sheet của mình
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

    if (!usernameGV || usernameGV === "all" || isSameTeacherAccount(rowGV, usernameGV) || !rowGV) {
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
  
  // Trên Sheet cá nhân của Giáo viên, toàn bộ học sinh trong Sheet DATA_HOCSINH đều thuộc quyền quản lý của Giáo viên
  // Mặc định lấy toàn bộ học sinh để đồng bộ và quản lý đầy đủ, trừ khi payload yêu cầu lọc cụ thể theo 1 lớp
  const targetClassFilter = payload && payload.lop ? String(payload.lop).trim().toUpperCase() : "";
  const isAll = !targetClassFilter || targetClassFilter === "ALL" || targetClassFilter === "TẤT CẢ";
  const allowedClasses = targetClassFilter ? [targetClassFilter] : [];

  const dataHS = sheetHS.getDataRange().getValues();
  const students = [];
  const cols = getHocSinhColMap(sheetHS);

  // DATA_HOCSINH: tự động map đúng cột thông qua getHocSinhColMap (hỗ trợ cả Sheet có thêm cột STT ở cột A)
  for (let i = 1; i < dataHS.length; i++) {
    const row = dataHS[i];
    const formattedClass = formatClassValue(row[cols.colClass]);
    const rowClass = formattedClass.trim().toUpperCase();

    if (isAll || allowedClasses.includes(rowClass)) {
      students.push({
        username: String(row[cols.colUser] !== null && row[cols.colUser] !== undefined ? row[cols.colUser] : "").trim(),
        password: String(row[cols.colPass] !== null && row[cols.colPass] !== undefined ? row[cols.colPass] : "").trim(),
        lop: formattedClass,
        hoTen: String(row[cols.colName] || "").trim(),
        ngaySinh: formatBirthDateValue(row[cols.colDob]),
        gioiTinh: String(row[cols.colGender] || "").trim(),
        truong: String(row[cols.colSchool] || "").trim()
      });
    }
  }

  const uniqueClasses = [];
  students.forEach(s => {
    if (s.lop && !uniqueClasses.includes(s.lop)) {
      uniqueClasses.push(s.lop);
    }
  });

  return createJsonResponse({
    success: true,
    students: students,
    classes: uniqueClasses,
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

  const dataGV = sheetGV.getDataRange().getValues();
  // Sheet DATA_GIAOVIEN: Cột 0: Tài khoản GV | Cột 1: Mật khẩu | Cột 2: Họ tên GV | Cột 3: Lớp giảng dạy | Cột 4: Trường
  for (let i = 1; i < dataGV.length; i++) {
    if (String(dataGV[i][0]).trim().toUpperCase() === usernameGV.toUpperCase()) {
      const currentPass = String(dataGV[i][1] !== null && dataGV[i][1] !== undefined ? dataGV[i][1] : "").trim();

      // Nếu có truyền oldPassword thì kiểm tra mật khẩu cũ
      if (oldPassword !== null && currentPass !== oldPassword) {
        return createJsonResponse({
          success: false,
          message: "Mật khẩu hiện tại không chính xác! Vui lòng kiểm tra lại."
        });
      }

      // Cột 2 (index 1) là Mật khẩu
      sheetGV.getRange(i + 1, 2).setValue(newPassword);

      const hoTen = String(dataGV[i][2] || usernameGV);
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
        const rHs = String(kqData[r][0] !== null && kqData[r][0] !== undefined ? kqData[r][0] : "").trim();
        const rMaDe = String(kqData[r][7] || "").trim();
        if (isSameStudentAccount(rHs, usernameHS) && rMaDe) {
          const rawDiem = kqData[r][9];
          let parsedDiem = rawDiem;
          if (rawDiem !== "" && rawDiem !== null && rawDiem !== undefined) {
            const numVal = parseFloat(String(rawDiem).replace(",", "."));
            if (!isNaN(numVal)) {
              parsedDiem = numVal;
            }
          }
          submittedExamsMap[rMaDe] = {
            daLam: true,
            diemTong: parsedDiem,
            soCauDungSai: kqData[r][10],
            thoiGianNop: kqData[r][11]
          };
        }
      }
    } catch (eKq) {
      Logger.log("Lỗi tra cứu DATA_KETQUA trong Teacher_Code getStudentExams: " + eKq);
    }
  }

  // Lập bản đồ tra cứu Họ tên Giáo viên từ DATA_GIAOVIEN (Ưu tiên lấy tên GV, không lấy SĐT/Mã GV)
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
      Logger.log("Lỗi tra cứu DATA_GIAOVIEN trong Teacher_Code getStudentExams: " + eGv);
    }
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
    const rHs = String(kqData[r][0] !== null && kqData[r][0] !== undefined ? kqData[r][0] : "").trim();
    const rMaDe = String(kqData[r][7] || "").trim();
    if (isSameStudentAccount(rHs, usernameHS) && rMaDe === maDe) {
      existingKqRowIndex = r;
      if (!choXemLaiBai) {
        break; // Với bài thi chính thức, lấy ngay kết quả đầu tiên đã ghi nhận
      }
      // Với bài ôn tập, tiếp tục quét đến cuối để cập nhật đúng lượt nộp bài gần nhất
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

      // Thêm 2 cột cuối: Điểm Tự Luận (GV chấm), Nhận xét của GV (để trống cho GV chấm)
      rowTuLuan.push("", "");
      sheetTuLuan.appendRow(rowTuLuan);
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
    tuLuan: essayDetailsForStudent
  };

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
    message: "Nộp bài thành công!",
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
 * Tự động dò tìm chính xác index các cột của Sheet DATA_HOCSINH linh hoạt
 * Hỗ trợ nhận diện thông minh ngay cả khi giáo viên chèn thêm cột STT ở cột A hoặc thay đổi vị trí cột
 */
function getHocSinhColMap(sheetHS) {
  const map = {
    colUser: 0,
    colPass: 1,
    colClass: 2,
    colName: 3,
    colDob: 4,
    colGender: 5,
    colSchool: 6
  };
  try {
    if (!sheetHS) return map;
    const lastCol = Math.max(sheetHS.getLastColumn(), 7);
    const headers = sheetHS.getRange(1, 1, 1, Math.max(lastCol, 12)).getValues()[0];

    let foundUser = -1;
    let foundPass = -1;
    let foundClass = -1;
    let foundName = -1;
    let foundDob = -1;
    let foundGender = -1;
    let foundSchool = -1;
    let hasSttCol = false;

    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || "").trim().toLowerCase();
      if (!h) continue;

      if (h === "stt" || h === "số tt" || h === "số thứ tự" || h.startsWith("stt")) {
        hasSttCol = true;
      } else if (h.includes("tài khoản") || h.includes("mã hs") || h.includes("mã học sinh") || h.includes("username") || h.includes("tên đăng nhập") || h === "tk hs" || h === "mã sinh viên") {
        foundUser = c;
      } else if (h.includes("mật khẩu") || h.includes("password") || h === "pass" || h.includes("mk")) {
        foundPass = c;
      } else if (h.includes("lớp") || h === "class" || h.includes("lop")) {
        foundClass = c;
      } else if (h.includes("họ tên") || h.includes("họ và tên") || h.includes("tên hs") || h.includes("học sinh") || h.includes("hoten") || h === "họ tên học sinh") {
        foundName = c;
      } else if (h.includes("ngày sinh") || h.includes("năm sinh") || h === "dob" || h.includes("ngaysinh") || h.includes("sinh nhật")) {
        foundDob = c;
      } else if (h.includes("giới tính") || h === "phái" || h === "gender" || h.includes("gioitinh") || h === "nam/nữ") {
        foundGender = c;
      } else if (h.includes("trường") || h === "school" || h.includes("truong") || h.includes("đơn vị")) {
        foundSchool = c;
      }
    }

    if (foundUser !== -1) map.colUser = foundUser;
    if (foundPass !== -1) map.colPass = foundPass;
    if (foundClass !== -1) map.colClass = foundClass;
    if (foundName !== -1) map.colName = foundName;
    if (foundDob !== -1) map.colDob = foundDob;
    if (foundGender !== -1) map.colGender = foundGender;
    if (foundSchool !== -1) map.colSchool = foundSchool;

    // Nếu không tìm thấy header rõ ràng nhưng phát hiện cột A là STT (hasSttCol = true hoặc hàng 1 ô A1 là 'STT'):
    if (foundUser === -1 && (hasSttCol || String(headers[0] || "").trim().toUpperCase() === "STT")) {
      map.colUser = 1;
      map.colPass = 2;
      map.colClass = 3;
      map.colName = 4;
      map.colDob = 5;
      map.colGender = 6;
      map.colSchool = 7;
    }
  } catch (e) {
    Logger.log("Lỗi getHocSinhColMap: " + e.toString());
  }
  return map;
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
      const isMatchMaDe = !maDe || rowMaDe.toUpperCase() === maDe.toUpperCase();
      const cleanGv = s => String(s || "").trim().toLowerCase().replace(/^0+/, "");
      const isMatchGV = !usernameGV || usernameGV === "all" || rowGV === usernameGV || cleanGv(rowGV) === cleanGv(usernameGV);
      const isMatchTime = !thoiGianNop || rowThoiGianNop === thoiGianNop || String(row[11]).includes(thoiGianNop);

      if (isMatchHS && isMatchMaDe && isMatchGV && isMatchTime) {
        sheetKetQua.deleteRow(i + 1);
        deletedFromKetQua = true;
        break; // Xóa 1 lần nộp bài cụ thể
      }
    }

    // Nếu chưa tìm thấy với isMatchTime khắt khe, thử nới lỏng bỏ qua isMatchTime (vì 1 HS thường chỉ nộp 1 lần trong 1 đề thi)
    if (!deletedFromKetQua) {
      for (let i = dataKetQua.length - 1; i >= 1; i--) {
        const row = dataKetQua[i];
        const rowHS = String(row[0] || "").trim();
        const rowMaDe = String(row[7] || "").trim();
        const rowGV = String(row[8] || "").trim().toLowerCase();
        const cleanGv = s => String(s || "").trim().toLowerCase().replace(/^0+/, "");

        const isMatchHS = rowHS.toUpperCase() === usernameHS.toUpperCase();
        const isMatchMaDe = !maDe || rowMaDe.toUpperCase() === maDe.toUpperCase();
        const isMatchGV = !usernameGV || usernameGV === "all" || rowGV === usernameGV || cleanGv(rowGV) === cleanGv(usernameGV);

        if (isMatchHS && isMatchMaDe && isMatchGV) {
          sheetKetQua.deleteRow(i + 1);
          deletedFromKetQua = true;
          break;
        }
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
        const isMatchMaDe = !maDe || rowMaDe.toUpperCase() === maDe.toUpperCase();
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
      // Nếu trên Google Sheets không còn bản ghi (đã bị xóa từ trước hoặc không tồn tại),
      // thì mục tiêu xóa đã hoàn tất, trả về success: true để giao diện đồng bộ sạch
      return createJsonResponse({
        success: true,
        alreadyDeleted: true,
        message: "Bản ghi kết quả của học sinh đã được xóa / không còn trên Google Sheets!",
        usernameHS: usernameHS,
        maDe: maDe
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
 * Xóa một học sinh khỏi Sheet DATA_HOCSINH và Sheet HUB_STUDENTS (nếu có)
 * Payload: { action: "deleteStudent", usernameHS, usernameGV, hubUrl }
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

    // Nếu trên Sheet này có Sheet HUB_STUDENTS (trường hợp Sheet tổng) thì xóa luôn
    const sheetHubStudents = ss.getSheetByName("HUB_STUDENTS");
    if (sheetHubStudents) {
      const hubData = sheetHubStudents.getDataRange().getValues();
      for (let i = hubData.length - 1; i >= 1; i--) {
        const rowHS = String(hubData[i][0] || "").trim().toUpperCase();
        if (rowHS === usernameHS.toUpperCase()) {
          sheetHubStudents.deleteRow(i + 1);
        }
      }
    }

    // Nếu có truyền hubUrl thì tự động gọi sang Trạm Trung Tâm để xóa đồng bộ
    if (payload.hubUrl && typeof UrlFetchApp !== "undefined") {
      try {
        UrlFetchApp.fetch(payload.hubUrl, {
          method: "post",
          contentType: "text/plain;charset=utf-8",
          payload: JSON.stringify({
            action: "deleteStudent",
            usernameHS: usernameHS,
            usernameGV: payload.usernameGV || ""
          }),
          muteHttpExceptions: true
        });
      } catch (eHub) {}
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
    const sttTrongLop = parseInt(payload.sttTrongLop || 0, 10) || 0;
    const lopToSave = lop.includes("/") ? "'" + lop : lop;
    const newRow = [username, password, lopToSave, hoTen, ngaySinh, gioiTinh, truong];

    // Thu thập tất cả các dòng của lớp này trên Sheet (1-based index)
    const classRows = [];
    for (let i = 1; i < dataHS.length; i++) {
      const rowClass = formatClassValue(dataHS[i][2] || "").trim().toUpperCase();
      if (rowClass === lop) {
        classRows.push(i + 1);
      }
    }

    if (classRows.length > 0) {
      if (sttTrongLop > 0 && sttTrongLop <= classRows.length) {
        // Chèn đúng vị trí STT được chỉ định trong lớp (trước học sinh hiện tại của vị trí đó)
        const targetRow = classRows[sttTrongLop - 1];
        sheetHS.insertRowBefore(targetRow);
        sheetHS.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      } else {
        // Không nhập STT hoặc STT lớn hơn sĩ số lớp: chèn ngay sau học sinh cuối cùng của lớp
        const lastRowOfClass = classRows[classRows.length - 1];
        sheetHS.insertRowAfter(lastRowOfClass);
        sheetHS.getRange(lastRowOfClass + 1, 1, 1, newRow.length).setValues([newRow]);
      }
    } else {
      // Lớp chưa có trên Sheet:
      if (sttTrongLop > 0 && (sttTrongLop + 1) <= sheetHS.getLastRow()) {
        // Người dùng nhập STT cụ thể: Chèn đúng vào dòng thứ sttTrongLop của danh sách học sinh trên Sheet, đẩy toàn bộ học sinh phía sau xuống!
        const targetRow = sttTrongLop + 1; // Vì dòng 1 là tiêu đề
        sheetHS.insertRowBefore(targetRow);
        sheetHS.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      } else {
        // Không nhập STT hoặc STT vượt quá số dòng hiện tại: thêm vào cuối bảng
        sheetHS.appendRow(newRow);
      }
    }

    const positionMsg = sttTrongLop > 0
      ? (" (STT " + sttTrongLop + ")")
      : (" (cuối danh sách)");

    return createJsonResponse({
      success: true,
      message: "Đã thêm mới học sinh \"" + hoTen + "\" (" + username + ")" + positionMsg + " vào Google Sheets thành công!",
      student: {
        username: username,
        password: password,
        lop: lop,
        hoTen: hoTen,
        ngaySinh: ngaySinh,
        gioiTinh: gioiTinh,
        truong: truong,
        sttTrongLop: sttTrongLop
      }
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Lỗi thêm học sinh: " + err.toString()
    });
  }
}
