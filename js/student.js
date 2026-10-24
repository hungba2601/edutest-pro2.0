/**
 * ============================================================================
 * STUDENT DASHBOARD & EXAM ROOM LOGIC - EDUTEST PRO 2.0
 * ============================================================================
 */

// Lấy API_URL động (hỗ trợ học sinh kết nối đúng máy chủ Google Sheets của từng giáo viên qua link bài thi ?server=... hoặc cấu hình)
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbw0WKZ9KjlMud7nEof6Kwqe6XYDRDeht4gHWVH_WsS2h48j_dzSvriiT9I4RT9t6zIG/exec";
const urlParams = (typeof window !== "undefined" && window.location) ? new URLSearchParams(window.location.search) : null;
const serverFromUrl = urlParams ? urlParams.get("server") : null;
if (serverFromUrl) {
  try {
    localStorage.setItem("student_gas_api_url", serverFromUrl);
  } catch (e) {}
}

const API_URL = serverFromUrl || 
  (typeof localStorage !== "undefined" ? localStorage.getItem("student_gas_api_url") : null) || 
  DEFAULT_GAS_API_URL;

// ============================================================================
// HỆ THỐNG THÔNG BÁO TOAST
// ============================================================================
function showToast(title, message, type = "info", duration = 4000) {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${message}</div>
    </div>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Trạng thái cục bộ thí sinh và bài thi
let currentStudent = null;
let availableExams = [];
let activeExam = null;
let examStartTime = null;
let timerInterval = null;
let remainingSeconds = 0;
let studentAnswers = {}; // Lưu trữ: { [qId]: "A" } hoặc { [qId]: { a: true, b: false, ... } }
let studentEssayAnswers = {}; // Lưu trữ: { [qId]: "bài làm tự luận..." }
let lastExamResult = null; // Kết quả chấm bài thi mới nhất

// ============================================================================
// 1. KHỞI TẠO & PHÂN QUYỀN HỌC SINH
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  const rawUser = localStorage.getItem("currentUser");
  const role = localStorage.getItem("userRole");

  if (!rawUser || role !== "HS") {
    alert("Phiên đăng nhập không hợp lệ hoặc bạn không có quyền Học sinh.");
    const currentQuery = window.location.search || "";
    window.location.href = "index.html" + currentQuery;
    return;
  }

  currentStudent = JSON.parse(rawUser);
  if (currentStudent && currentStudent.ngaySinh) {
    currentStudent.ngaySinh = formatDob(currentStudent.ngaySinh);
  }

  // Hiển thị thông tin thí sinh lên Navbar và Profile Card
  document.getElementById("hsFullName").textContent = currentStudent.hoTen || currentStudent.username;
  document.getElementById("hsClassSchool").textContent = `Lớp: ${currentStudent.lop || "--"} | Trường: ${currentStudent.truong || "--"}`;

  document.getElementById("profileName").textContent = `Xin chào ${currentStudent.hoTen || "Thí sinh"}!`;
  document.getElementById("profileUsername").textContent = currentStudent.username || "--";
  document.getElementById("profileClass").textContent = currentStudent.lop || "--";
  document.getElementById("profileDob").textContent = formatDob(currentStudent.ngaySinh);
  document.getElementById("profileGender").textContent = currentStudent.gioiTinh || "--";
  document.getElementById("profileSchool").textContent = currentStudent.truong || "--";

  // Tải danh sách các bài thi mở cho lớp của học sinh
  loadAvailableExams();

  // Khởi tạo tính năng Thông tin cá nhân & Đổi mật khẩu cho Học sinh
  initStudentAccountDropdownAndModals();

  // Đăng xuất
  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("student_gas_api_url");
    localStorage.removeItem("student_gas_api_url");
    window.location.href = "index.html";
  });

  // Nút làm mới danh sách
  document.getElementById("btnRefreshStudentExams").addEventListener("click", loadAvailableExams);

  // Nút quay về danh sách sau khi xem kết quả
  const btnHome = document.getElementById("btnBackToHome");
  if (btnHome) {
    btnHome.addEventListener("click", () => {
      window.location.reload();
    });
  }

  // Nút xem lại chi tiết bài làm & đáp án (Chế độ Ôn tập)
  const btnReview = document.getElementById("btnReviewExamDetail");
  if (btnReview) {
    btnReview.addEventListener("click", openExamReviewModal);
  }

  // Đóng modal xem lại
  const btnCloseModal = document.getElementById("btnCloseReviewModal");
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", closeExamReviewModal);
  }

  const btnCloseFooter = document.getElementById("btnCloseReviewFooter");
  if (btnCloseFooter) {
    btnCloseFooter.addEventListener("click", closeExamReviewModal);
  }

  const reviewModalBackdrop = document.getElementById("reviewExamModal");
  if (reviewModalBackdrop) {
    reviewModalBackdrop.addEventListener("click", (e) => {
      if (e.target === reviewModalBackdrop) {
        closeExamReviewModal();
      }
    });
  }

  // Khởi tạo điều khiển Bảng câu hỏi trên Mobile (Bottom Sheet Drawer)
  const btnTogglePalette = document.getElementById("btnToggleMobilePalette");
  const paletteCol = document.getElementById("examPaletteCol");
  const paletteBackdrop = document.getElementById("paletteBackdrop");
  const btnClosePalette = document.getElementById("btnCloseMobilePalette");

  if (btnTogglePalette) {
    btnTogglePalette.addEventListener("click", () => {
      if (paletteCol && paletteCol.classList.contains("is-open-mobile")) {
        closeMobilePalette();
      } else {
        openMobilePalette();
      }
    });
  }

  if (btnClosePalette) {
    btnClosePalette.addEventListener("click", closeMobilePalette);
  }

  if (paletteBackdrop) {
    paletteBackdrop.addEventListener("click", closeMobilePalette);
  }
});

function formatDob(raw) {
  if (!raw || raw === "--" || raw === "-") return "--";
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const dd = String(raw.getDate()).padStart(2, '0');
    const mm = String(raw.getMonth() + 1).padStart(2, '0');
    const yyyy = raw.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  let s = String(raw || "").trim();
  if (!s || s === "--" || s === "-") return "--";

  // Cắt bỏ phần giờ phút giây nếu có (VD: "16/11/2013 00:00:00" -> "16/11/2013")
  if (s.includes(" ")) {
    s = s.split(" ")[0].trim();
  }

  // Xử lý chuẩn ISO (VD: "2013-11-16T00:00:00.000Z")
  if (s.includes("T")) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    s = s.split("T")[0].trim();
  }

  // Định dạng YYYY-MM-DD -> DD/MM/YYYY
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) {
    const parts = s.split(/[-/.]/);
    const dd = parts[2].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yyyy = parts[0];
    return `${dd}/${mm}/${yyyy}`;
  }

  // Định dạng DD/MM/YYYY chuẩn hóa padding (VD: 5/9/2013 -> 05/09/2013)
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(s)) {
    const parts = s.split(/[-/.]/);
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yyyy = parts[2];
    return `${dd}/${mm}/${yyyy}`;
  }

  return s;
}

// ============================================================================
// HÀM QUẢN LÝ LỊCH SỬ NỘP BÀI CỦA HỌC SINH (CACHE CỤC BỘ & ĐỒNG BỘ VỚI SERVER)
// ============================================================================
function getLocalSubmittedExams(usernameHS) {
  try {
    const raw = localStorage.getItem("EduTest_SubmittedExams_" + (usernameHS || "").trim().toUpperCase());
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalSubmittedExam(usernameHS, maDe, extraData) {
  try {
    const key = "EduTest_SubmittedExams_" + (usernameHS || "").trim().toUpperCase();
    const map = getLocalSubmittedExams(usernameHS);
    map[maDe] = {
      daLam: true,
      time: new Date().toLocaleString("vi-VN"),
      ...(extraData || {})
    };
    localStorage.setItem(key, JSON.stringify(map));
  } catch (e) {}
}

// ============================================================================
// 2. TẢI DANH SÁCH BÀI KIỂM TRA ĐANG MỞ
// ============================================================================
async function loadAvailableExams() {
  const grid = document.getElementById("studentExamsGrid");
  grid.innerHTML = `
    <div class="loading-state-card">
      <div class="spinner" style="display: block; width: 30px; height: 30px; margin: 0 auto 1rem;"></div>
      <p>Đang tải danh sách bài kiểm tra cho lớp ${escapeHtml(currentStudent.lop)}...</p>
    </div>
  `;

  let exams = [];

  // Tự động tải ngầm danh bạ giáo viên từ Hub để phân giải họ tên thay cho SĐT
  if (!localStorage.getItem("cached_teachers_directory")) {
    fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory`, { method: "GET" })
      .then(res => res.ok ? res.json() : null)
      .then(res => {
        if (res && res.success && Array.isArray(res.teachers) && res.teachers.length > 0) {
          localStorage.setItem("cached_teachers_directory", JSON.stringify(res.teachers));
          if (availableExams && availableExams.length > 0) {
            renderExamList(availableExams);
          }
        }
      })
      .catch(() => {});
  }

  try {
    let data = null;
    // 1. Thử gửi POST lên Google Sheet của giáo viên phụ trách phòng thi
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "getStudentExams",
          lop: currentStudent.lop,
          usernameHS: currentStudent.username
        })
      });
      const text = await res.text();
      if (text && !text.trim().startsWith("<")) {
        data = JSON.parse(text);
      }
    } catch (postErr) {
      console.warn("POST getStudentExams thất bại, thử GET fallback:", postErr);
    }

    // 2. Tự động fallback sang GET nếu POST bị redirect hoặc lỗi CORS
    if (!data || !data.success) {
      const getUrl = `${API_URL}?action=getStudentExams&lop=${encodeURIComponent(currentStudent.lop)}&usernameHS=${encodeURIComponent(currentStudent.username)}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl);
      const getText = await getRes.text();
      if (getText && !getText.trim().startsWith("<")) {
        data = JSON.parse(getText);
      }
    }

    if (data && Array.isArray(data.exams)) {
      exams = data.exams;
    }
  } catch (err) {
    console.warn("Không thể tải danh sách bài kiểm tra từ máy chủ:", err);
  }

  // Kết hợp trạng thái đã làm từ Server và LocalStorage của thiết bị
  const localSubmitted = getLocalSubmittedExams(currentStudent.username);
  exams = exams.map(exam => {
    const localInfo = localSubmitted[exam.maDe];
    const isDone = !!(exam.daLam || localInfo);

    // Đồng bộ ngược lại vào local nếu server báo đã làm
    if (exam.daLam && !localInfo) {
      saveLocalSubmittedExam(currentStudent.username, exam.maDe, {
        diemCu: exam.diemCu,
        thoiGianNopCu: exam.thoiGianNopCu
      });
    }

    return {
      ...exam,
      daLam: isDone,
      diemCu: (exam.diemCu !== undefined && exam.diemCu !== null) ? exam.diemCu : (localInfo ? localInfo.diemCu : null),
      thoiGianNopCu: exam.thoiGianNopCu || (localInfo ? localInfo.thoiGianNopCu || localInfo.time : null)
    };
  });

  // Danh sách đề thi CHỈ lấy từ đúng máy chủ Google Sheets của giáo viên phụ trách phòng thi!
  availableExams = exams;

  renderExamList(availableExams);
}

/**
 * Trợ giúp lấy tên hiển thị của Giáo viên tạo đề (Ưu tiên Họ tên GV, không lấy SĐT / Mã GV)
 */
function getTeacherDisplayName(exam) {
  if (!exam) return "Giáo viên";

  const isRawIdOrPhone = (val) => {
    if (!val) return false;
    const s = String(val).trim();
    return /^0?\d{8,11}$/.test(s) || /^GV\d+$/i.test(s) || /^\d+$/.test(s);
  };

  // 1. Nếu đề thi trả về sẵn hoTenGV hoặc tenGV hợp lệ
  if (exam.hoTenGV && String(exam.hoTenGV).trim() && !isRawIdOrPhone(exam.hoTenGV)) {
    return String(exam.hoTenGV).trim();
  }
  if (exam.tenGV && String(exam.tenGV).trim() && !isRawIdOrPhone(exam.tenGV)) {
    return String(exam.tenGV).trim();
  }
  if (exam.duLieuDe?.hoTenGV && String(exam.duLieuDe.hoTenGV).trim() && !isRawIdOrPhone(exam.duLieuDe.hoTenGV)) {
    return String(exam.duLieuDe.hoTenGV).trim();
  }
  if (exam.duLieuDe?.tenGV && String(exam.duLieuDe.tenGV).trim() && !isRawIdOrPhone(exam.duLieuDe.tenGV)) {
    return String(exam.duLieuDe.tenGV).trim();
  }

  // 2. Tra cứu theo mã giáo viên từ danh bạ Hub (cached_teachers_directory)
  const uGv = String(exam.usernameGV || "").trim().toLowerCase();
  try {
    const rawDir = localStorage.getItem("cached_teachers_directory");
    if (rawDir) {
      const teachers = JSON.parse(rawDir);
      if (Array.isArray(teachers)) {
        if (uGv) {
          const match = teachers.find(t => {
            const tu = String(t.maGV || t.username || t.usernameGV || "").trim().toLowerCase();
            return tu === uGv || tu.replace(/^0+/, "") === uGv.replace(/^0+/, "");
          });
          if (match && (match.hoTenGV || match.hoTen || match.tenGV)) {
            return String(match.hoTenGV || match.hoTen || match.tenGV).trim();
          }
        }
        // Thử khớp theo URL máy chủ Web App nếu có
        const currentServer = (typeof API_URL !== "undefined" ? API_URL : "") || localStorage.getItem("student_gas_api_url") || "";
        if (currentServer) {
          const sMatch = teachers.find(t => t.serverUrl && t.serverUrl.trim() === currentServer.trim());
          if (sMatch && (sMatch.hoTenGV || sMatch.hoTen || sMatch.tenGV)) {
            return String(sMatch.hoTenGV || sMatch.hoTen || sMatch.tenGV).trim();
          }
        }
      }
    }
  } catch (e) {}

  // 3. Nếu usernameGV không phải là SĐT/Mã ID thì hiển thị usernameGV
  if (exam.usernameGV && !isRawIdOrPhone(exam.usernameGV)) {
    return String(exam.usernameGV).trim();
  }

  return "Thầy/Cô bộ môn";
}

/**
 * Trợ giúp lấy chính xác số lượng câu hỏi tự luận của đề thi
 */
function getExamEssayCount(exam) {
  if (!exam) return 0;
  if (typeof exam.soCauTuLuan === "number" && exam.soCauTuLuan > 0) return exam.soCauTuLuan;
  const tuLuan = exam.tuLuan || exam.duLieuDe?.tuLuan;
  if (!tuLuan) return 0;
  if (Array.isArray(tuLuan.danhSachCauHoi) && tuLuan.danhSachCauHoi.length > 0) {
    return tuLuan.danhSachCauHoi.length;
  }
  if (tuLuan.noiDung && String(tuLuan.noiDung).trim().length > 0) {
    return 1;
  }
  return 0;
}

function renderExamList(availableExams) {
  const grid = document.getElementById("studentExamsGrid");
  if (!grid) return;

  if (availableExams.length === 0) {
    const isCentralHub = (API_URL === DEFAULT_GAS_API_URL);
    grid.innerHTML = `
      <div class="loading-state-card">
        <svg style="width: 48px; height: 48px; margin: 0 auto 1rem; color: #64748b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <h3 style="color: #cbd5e1; margin-bottom: 0.5rem;">${isCentralHub ? "Bạn đang ở Cổng Trung Tâm" : "Hiện chưa có kỳ thi nào đang mở"}</h3>
        <p>${isCentralHub ? `Để xem bài thi của lớp <strong>${escapeHtml(currentStudent.lop)}</strong>, bạn vui lòng đăng nhập và chọn đúng Thầy/Cô phụ trách phòng thi hoặc mở link bài thi do Thầy/Cô gửi.` : `Khi giáo viên mở đề thi cho lớp <strong>${escapeHtml(currentStudent.lop)}</strong>, bài thi sẽ tự động hiển thị tại đây.`}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";
  availableExams.forEach((exam, idx) => {
    const card = document.createElement("div");
    card.className = "exam-card-item";

    const essayCount = getExamEssayCount(exam);
    const hasGoogleForm = !!(exam.tuLuan && exam.tuLuan.linkForm);
    const isAllowReview = (exam.choXemLaiBai !== false);
    const isAllowScore = (exam.choXemDiem !== false);
    const hasDone = !!exam.daLam;

    // Thiết kế trạng thái hiển thị theo loại kỳ thi
    let statusBadgeHtml = "";
    let actionBtnHtml = "";
    let noticeAlertHtml = "";

    if (!isAllowReview) {
      // 1. THI / KIỂM TRA CHÍNH THỨC: CHỈ LÀM 1 LẦN
      if (hasDone) {
        statusBadgeHtml = `<span class="badge-review-tag" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 700;">🚫 ĐÃ LÀM BÀI (KHÓA LÀM LẠI)</span>`;
        noticeAlertHtml = `
          <div style="margin-top: 0.75rem; padding: 0.65rem 0.85rem; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; color: #9f1239; font-size: 0.82rem; line-height: 1.45;">
            ⚠️ <strong>Bạn đã hoàn thành bài thi này!</strong><br>
            Kỳ thi chính thức chỉ cho phép làm bài 1 lần duy nhất để ghi nhận điểm vào bảng điểm. Bạn không thể làm lại.
            ${(exam.diemCu !== null && exam.diemCu !== undefined && isAllowScore) ? `<br>📊 Điểm trắc nghiệm đã ghi nhận: <strong style="color: #dc2626; font-size: 0.95rem;">${exam.diemCu} điểm</strong>` : ''}
            ${exam.thoiGianNopCu ? `<br>⏱ Thời gian nộp: <strong>${exam.thoiGianNopCu}</strong>` : ''}
          </div>
        `;
        actionBtnHtml = `
          <button type="button" class="btn-start-exam btn-exam-locked" data-index="${idx}" disabled style="background: #94a3b8; cursor: not-allowed; box-shadow: none; opacity: 0.85; pointer-events: none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            <span>Đã Nộp Bài (Chỉ thi 1 lần)</span>
          </button>
        `;
      } else {
        statusBadgeHtml = `<span class="badge-review-tag locked" title="Khóa xem lại đề và đáp án để bảo mật kỳ thi">🔒 Thi chính thức (1 lần)</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-start-exam" data-index="${idx}">
            <span>Bắt Đầu Làm Bài</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        `;
      }
    } else {
      // 2. ÔN TẬP / LUYỆN TẬP: LÀM NHIỀU LẦN (GHI NHẬN LẦN CUỐI CÙNG)
      if (hasDone) {
        statusBadgeHtml = `<span class="badge-review-tag allowed" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-weight: 700;">🔄 ĐÃ LÀM (LUYỆN TẬP TIẾP ĐƯỢC)</span>`;
        noticeAlertHtml = `
          <div style="margin-top: 0.75rem; padding: 0.55rem 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 0.82rem; line-height: 1.45;">
            📖 <strong>Chế độ Ôn tập:</strong> Bạn được làm bài nhiều lần để rèn luyện. Kết quả nộp bài sẽ <strong>ghi nhận lần làm cuối cùng</strong>.
            ${(exam.diemCu !== null && exam.diemCu !== undefined && isAllowScore) ? `<br>📊 Điểm lần nộp gần nhất: <strong style="color: #15803d; font-size: 0.95rem;">${exam.diemCu} điểm</strong>` : ''}
          </div>
        `;
        actionBtnHtml = `
          <button type="button" class="btn-start-exam" data-index="${idx}" style="background: linear-gradient(135deg, #059669, #047857);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            <span>Luyện Tập Lại (Ghi nhận lần cuối)</span>
          </button>
        `;
      } else {
        statusBadgeHtml = `<span class="badge-review-tag allowed" title="Cho phép học sinh xem lại bài làm và đáp án sau khi nộp">📖 Ôn tập (Làm nhiều lần)</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-start-exam" data-index="${idx}">
            <span>Bắt Đầu Làm Bài</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        `;
      }
    }

    card.innerHTML = `
      <div class="exam-card-top">
        <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
          <span class="badge-open-live">
            <span class="dot-pulsing"></span>
            <span>Đang Mở Thi</span>
          </span>
          ${statusBadgeHtml}
          ${isAllowScore 
            ? `<span class="badge-score-tag allowed" title="Cho phép học sinh xem điểm số ngay sau khi nộp bài"><i class="fas fa-check-circle"></i> Cho xem điểm</span>`
            : `<span class="badge-score-tag locked" title="Khóa xem điểm - Điểm số được bảo mật, Giáo viên sẽ công bố sau"><i class="fas fa-lock"></i> Khóa xem điểm</span>`}
          ${essayCount > 0 
            ? `<span class="badge-essay-tag" title="Đề thi có ${essayCount} câu hỏi tự luận"><i class="fas fa-pen-nib"></i> ${essayCount} câu tự luận</span>` 
            : (hasGoogleForm ? `<span class="badge-essay-tag" title="Đề thi có kèm liên kết Google Form tự luận"><i class="fas fa-external-link-alt"></i> Form tự luận</span>` : '')}
        </div>
        <span class="exam-card-code">${exam.maDe}</span>
      </div>

      <h3 class="exam-card-title">${exam.tenKyThi}</h3>

      <div class="exam-meta-list">
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Thời gian: <strong>${exam.thoiGian} phút</strong></span>
        </div>
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Số câu trắc nghiệm: <strong>${exam.soCauHoi || (exam.cauHoi ? exam.cauHoi.length : 0)} câu</strong></span>
        </div>
        ${essayCount > 0 ? `
          <div class="exam-meta-row exam-meta-essay" style="color: #047857;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #059669;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>Số câu tự luận: <strong style="color: #047857;">${essayCount} câu</strong></span>
          </div>
        ` : ''}
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Giáo viên tạo: <strong>${escapeHtml(getTeacherDisplayName(exam))}</strong></span>
        </div>
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Chế độ kỳ thi: <strong style="color: ${isAllowReview ? '#10b981' : '#f59e0b'};">${isAllowReview ? 'Ôn tập (Làm nhiều lần, lấy điểm lần cuối)' : 'Thi chính thức (Chỉ làm 1 lần)'}</strong></span>
        </div>
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          <span>Xem điểm số: <strong style="color: ${isAllowScore ? '#10b981' : '#f59e0b'};">${isAllowScore ? 'Cho xem điểm' : 'Khóa xem điểm (Bảo mật điểm)'}</strong></span>
        </div>
      </div>

      ${noticeAlertHtml}
      <div style="margin-top: 1rem;">
        ${actionBtnHtml}
      </div>
    `;

    grid.appendChild(card);
  });

  // Bắt sự kiện bấm vào thi
  grid.querySelectorAll(".btn-start-exam").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      const exam = availableExams[idx];
      if (!exam) return;

      const isAllowReview = (exam.choXemLaiBai !== false);
      if (!isAllowReview && exam.daLam) {
        showToast("Đã hoàn thành", "Bạn đã nộp bài kiểm tra chính thức này rồi! Kỳ thi chính thức chỉ được làm bài 1 lần duy nhất.", "error", 5000);
        alert(`⚠️ THÔNG BÁO:\n\nBạn đã hoàn thành bài kiểm tra chính thức: "${exam.tenKyThi}" rồi!\n\nKỳ thi chính thức chỉ cho phép làm bài 1 lần duy nhất để đảm bảo tính công bằng. Bạn không thể làm lại.`);
        return;
      }

      enterExamRoom(exam);
    });
  });

  // Tự động kiểm tra nếu vào link trực tiếp phòng thi qua URL ?exam=...
  if (urlParams) {
    const directExamCode = urlParams.get("exam");
    if (directExamCode) {
      const directExam = availableExams.find(e => e.maDe === directExamCode);
      if (directExam && directExam.choXemLaiBai === false && directExam.daLam) {
        showToast("Đã hoàn thành", `Bạn đã hoàn thành bài kiểm tra "${directExam.tenKyThi}" rồi!`, "error", 6000);
        setTimeout(() => {
          alert(`⚠️ BẠN ĐÃ LÀM BÀI NÀY RỒI!\n\nBài kiểm tra: "${directExam.tenKyThi}" (${directExam.maDe}) là kỳ thi chính thức (chỉ được làm 1 lần).\nĐiểm số của bạn đã được ghi nhận vào hệ thống. Bạn không thể làm lại.`);
        }, 350);
      }
    }
  }
}

// Lấy danh sách đề thi từ localStorage phù hợp với lớp học sinh
function getLocalAvailableExams(studentClass) {
  return [];
}

/**
 * Thuật toán Fisher-Yates shuffle để xáo trộn ngẫu nhiên vị trí các câu hỏi
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================================
// HỆ THỐNG GIÁM SÁT TOÀN MÀN HÌNH & CHỐNG GIAN LẬN KHI THI (PROCTORING)
// ============================================================================
let isProctoringActive = false;
let currentExamMaxViolations = 5;
let currentExamViolations = 0;
let lastViolationTimestamp = 0;
let isViolationModalShowing = false;
let examPendingStart = null;

// Kiểm tra toàn màn hình
function isFullScreenActive() {
  return !!(
    document.fullscreenElement || 
    document.webkitFullscreenElement || 
    document.mozFullScreenElement || 
    document.msFullscreenElement
  );
}

// Bật Toàn Màn Hình
function enterFullScreen() {
  const elem = document.documentElement;
  try {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.warn("Fullscreen request error:", err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (err) {
    console.warn("enterFullScreen error:", err);
  }
}

// Thoát Toàn Màn Hình
function exitFullScreen() {
  try {
    if (isFullScreenActive()) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  } catch (err) {
    console.warn("exitFullScreen error:", err);
  }
}

// Lắng nghe các sự kiện vi phạm (Thoát fullscreen, rời tab, blur)
function handleFullscreenChange() {
  if (!isProctoringActive || isSubmittingExam) return;
  if (!isFullScreenActive()) {
    triggerExamViolation("Thoát chế độ toàn màn hình");
  }
}

function handleVisibilityChange() {
  if (!isProctoringActive || isSubmittingExam) return;
  if (document.visibilityState === "hidden") {
    triggerExamViolation("Mở tab mới hoặc thu nhỏ trình duyệt");
  }
}

function handleWindowBlur() {
  if (!isProctoringActive || isSubmittingExam) return;
  triggerExamViolation("Rời khỏi cửa sổ phòng thi");
}

function startProctoringListeners(maxAllowed) {
  isProctoringActive = true;
  currentExamMaxViolations = (Number(maxAllowed) > 0) ? Number(maxAllowed) : 5;
  currentExamViolations = 0;
  isViolationModalShowing = false;
  lastViolationTimestamp = 0;

  // Cập nhật tag header
  const proctoringTag = document.getElementById("examProctoringTag");
  const countSpan = document.getElementById("proctoringViolationCount");
  const maxSpan = document.getElementById("proctoringMaxAllowed");
  if (proctoringTag) proctoringTag.style.display = "inline-flex";
  if (countSpan) countSpan.textContent = "0";
  if (maxSpan) maxSpan.textContent = currentExamMaxViolations;

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
}

function stopProctoringListeners() {
  isProctoringActive = false;
  isViolationModalShowing = false;

  const proctoringTag = document.getElementById("examProctoringTag");
  if (proctoringTag) proctoringTag.style.display = "none";

  const violationModal = document.getElementById("modalExamViolation");
  if (violationModal) violationModal.style.display = "none";

  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
  document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("blur", handleWindowBlur);

  exitFullScreen();
}

function triggerExamViolation(reasonText = "Thoát toàn màn hình / Chuyển tab") {
  if (!isProctoringActive || isSubmittingExam) return;
  if (isViolationModalShowing) return;

  const now = Date.now();
  // Debounce 1.5s tránh kích hoạt đúp nhiều sự kiện cùng lúc
  if (now - lastViolationTimestamp < 1500) return;
  lastViolationTimestamp = now;

  currentExamViolations++;

  // Cập nhật tag trên header phòng thi
  const countSpan = document.getElementById("proctoringViolationCount");
  if (countSpan) countSpan.textContent = currentExamViolations;

  // KIỂM TRA: NẾU VƯỢT QUÁ SỐ LẦN CHO PHÉP (Ví dụ cấu hình 5, lần thứ 6 vi phạm) -> TỰ ĐỘNG NỘP BÀI!
  if (currentExamViolations > currentExamMaxViolations) {
    stopProctoringListeners();
    alert(`🚨 BẠN ĐÃ VI PHẠM QUY CHẾ THI QUÁ ${currentExamMaxViolations} LẦN CHO PHÉP!\n\n• Hành vi: ${reasonText}.\n• Số lần vi phạm: ${currentExamViolations}/${currentExamMaxViolations} lần.\n\nHệ thống ĐÃ TỰ ĐỘNG THU VÀ NỘP BÀI THI CỦA BẠN NGAY LẬP TỨC!`);
    submitStudentExam(false, true, `Vi phạm quy chế thi ${currentExamViolations} lần (${reasonText})`);
    return;
  }

  // NẾU CHƯA VƯỢT QUÁ SỐ LẦN CHO PHÉP -> MỞ MODAL CẢNH BÁO VI PHẠM
  isViolationModalShowing = true;
  const modal = document.getElementById("modalExamViolation");
  const reasonEl = document.getElementById("violationReasonText");
  const currentNumEl = document.getElementById("violationCurrentNum");
  const maxNumEl = document.getElementById("violationMaxNum");
  const alertMaxEl = document.getElementById("violationAlertMaxText");
  const alertNextEl = document.getElementById("violationAlertNextText");
  const alertMsgEl = document.getElementById("violationAlertMsg");

  if (reasonEl) reasonEl.textContent = reasonText;
  if (currentNumEl) currentNumEl.textContent = currentExamViolations;
  if (maxNumEl) maxNumEl.textContent = currentExamMaxViolations;
  if (alertMaxEl) alertMaxEl.textContent = currentExamMaxViolations;
  if (alertNextEl) alertNextEl.textContent = currentExamMaxViolations + 1;

  if (alertMsgEl) {
    if (currentExamViolations === currentExamMaxViolations) {
      alertMsgEl.style.background = "#fef2f2";
      alertMsgEl.style.borderColor = "#f87171";
      alertMsgEl.style.color = "#991b1b";
      alertMsgEl.innerHTML = `🚨 <strong>CẢNH BÁO NGUY HIỂM: ĐÂY LÀ LẦN VI PHẠM THỨ ${currentExamViolations}/${currentExamMaxViolations}!</strong><br>Nếu bạn thu nhỏ màn hình hoặc mở tab thêm 1 lần nữa (lần thứ ${currentExamMaxViolations + 1}), bài thi sẽ <strong>TỰ ĐỘNG BỊ NỘP NGAY LẬP TỨC</strong>!`;
    } else {
      const remaining = currentExamMaxViolations - currentExamViolations;
      alertMsgEl.style.background = "#fffbeb";
      alertMsgEl.style.borderColor = "#fde68a";
      alertMsgEl.style.color = "#92400e";
      alertMsgEl.innerHTML = `⚠️ <strong>Lưu ý:</strong> Bạn còn <strong>${remaining}</strong> lần cảnh báo. Nếu vi phạm quá ${currentExamMaxViolations} lần (đến lần thứ <strong>${currentExamMaxViolations + 1}</strong>), hệ thống sẽ <strong>TỰ ĐỘNG THU & NỘP BÀI THI NGAY</strong>!`;
    }
  }

  if (modal) modal.style.display = "flex";
}

// Học sinh bấm nút quay lại toàn màn hình từ modal vi phạm
function resumeExamFromViolation() {
  const modal = document.getElementById("modalExamViolation");
  if (modal) modal.style.display = "none";
  isViolationModalShowing = false;
  lastViolationTimestamp = Date.now();
  enterFullScreen();
}

// Mở modal xác nhận vào thi chính thức (Yêu cầu toàn màn hình)
function openStartExamConfirmationModal(exam) {
  examPendingStart = exam;
  const modal = document.getElementById("modalConfirmStartExam");
  const titleEl = document.getElementById("startExamModalTitle");
  const durEl = document.getElementById("startExamModalDuration");
  const qEl = document.getElementById("startExamModalQuestions");
  const allowedEl = document.getElementById("startExamAllowedViolations");
  const rulesMaxEl = document.getElementById("startExamRulesMax");
  const rulesNextEl = document.getElementById("startExamRulesNext");

  const maxAllowed = Number(exam.soLanViPhamChoPhep) > 0 ? Number(exam.soLanViPhamChoPhep) : 5;

  if (titleEl) titleEl.textContent = exam.tenKyThi || "Bài Thi Chính Thức";
  if (durEl) durEl.textContent = `${exam.thoiGian} phút`;
  if (qEl) qEl.textContent = `${exam.soCauHoi || (exam.cauHoi || []).length} câu`;
  if (allowedEl) allowedEl.textContent = maxAllowed;
  if (rulesMaxEl) rulesMaxEl.textContent = maxAllowed;
  if (rulesNextEl) rulesNextEl.textContent = maxAllowed + 1;

  if (modal) modal.style.display = "flex";
}

// ============================================================================
// 3. VÀO PHÒNG THI TẬP TRUNG & BẬT ĐỒNG HỒ ĐẾM NGƯỢC
// ============================================================================
function enterExamRoom(exam) {
  const isAllowReview = (exam.choXemLaiBai !== false);
  const isAllowScore = (exam.choXemDiem !== false);

  // CHẶN KHÔNG CHO VÀO PHÒNG THI NẾU ĐÃ LÀM BÀI THI CHÍNH THỨC
  if (!isAllowReview && exam.daLam) {
    alert(`⚠️ BẠN ĐÃ HOÀN THÀNH BÀI THI NÀY RỒI!\n\nBài kiểm tra: "${exam.tenKyThi}" là kỳ thi chính thức (chỉ được làm 1 lần duy nhất).\nĐiểm số đã được ghi nhận. Bạn không thể vào làm lại.`);
    return;
  }

  // NẾU LÀ ĐỀ ÔN TẬP ĐÃ LÀM: THÔNG BÁO GHI NHẬN KẾT QUẢ LẦN CUỐI
  const essayCount = getExamEssayCount(exam);
  const essayInfoText = essayCount > 0 ? `\n• Số câu tự luận: ${essayCount} câu.` : '';

  if (isAllowReview) {
    // CHẾ ĐỘ ÔN TẬP / LUYỆN TẬP: KHÔNG ÁP DỤNG GIÁM SÁT THI, HỌC SINH LÀM THOẢI MÁI
    if (exam.daLam) {
      if (!confirm(`Bạn có chắc chắn muốn làm lại bài ôn tập: "${exam.tenKyThi}"?\n• Thời gian: ${exam.thoiGian} phút.\n• Số câu trắc nghiệm: ${exam.soCauHoi || 0} câu.${essayInfoText}\n• Chế độ: Ôn tập (Được làm lại nhiều lần).\n• LƯU Ý QUAN TRỌNG: Kết quả nộp bài sẽ ghi nhận lần làm bài cuối cùng này!`)) {
        return;
      }
    } else {
      const scoreText = isAllowScore ? "Hiện điểm ngay khi nộp" : "Khóa xem điểm (GV công bố sau)";
      if (!confirm(`Bạn có chắc chắn muốn bắt đầu làm bài ôn tập: "${exam.tenKyThi}"?\n• Thời gian: ${exam.thoiGian} phút.\n• Số câu trắc nghiệm: ${exam.soCauHoi || 0} câu.${essayInfoText}\n• Chế độ: Ôn tập / Luyện tập (Làm nhiều lần, tự do tra cứu).\n• Chế độ xem điểm: ${scoreText}.`)) {
        return;
      }
    }
    proceedIntoExamRoom(exam, false);
  } else {
    // CHẾ ĐỘ THI / KIỂM TRA CHÍNH THỨC: BẬT MODAL NỘI QUY & YÊU CẦU TOÀN MÀN HÌNH
    openStartExamConfirmationModal(exam);
  }
}

// Bắt đầu vào phòng thi chính thức
function proceedIntoExamRoom(exam, isProctoring = false) {
  // ==========================================================================
  // ĐẢO VỊ TRÍ CÂU HỎI RANDOM CHO MỖI HỌC SINH:
  // - Phần I (Trắc nghiệm nhiều lựa chọn): ĐẢO NGẪU NHIÊN
  // - Phần II (Trắc nghiệm đúng/sai): ĐẢO NGẪU NHIÊN
  // - Đảo riêng biệt từng phần, không trộn lẫn Phần I sang Phần II
  // - Phần III (Tự luận): KHÔNG ĐẢO, giữ nguyên thứ tự
  // ==========================================================================
  const rawQuestions = JSON.parse(JSON.stringify(exam.cauHoi || []));
  const rawPart1 = rawQuestions.filter(q => q.loaiCauHoi !== "true_false");
  const rawPart2 = rawQuestions.filter(q => q.loaiCauHoi === "true_false");

  const shuffledPart1 = shuffleArray(rawPart1);
  const shuffledPart2 = shuffleArray(rawPart2);

  // Đánh số thứ tự hiển thị tuần tự cho học sinh
  let runningIndex = 1;
  shuffledPart1.forEach(q => {
    q.displayIndex = runningIndex++;
  });
  shuffledPart2.forEach(q => {
    q.displayIndex = runningIndex++;
  });

  const finalExamQuestions = [...shuffledPart1, ...shuffledPart2];

  // Tạo đối tượng phiên thi riêng của học sinh (Tự luận giữ nguyên 100%)
  activeExam = {
    ...exam,
    cauHoi: finalExamQuestions
  };

  examStartTime = new Date();
  isSubmittingExam = false;
  studentAnswers = {};
  studentEssayAnswers = {};
  lastExamResult = null;

  // Chuyển view
  document.getElementById("viewExamList").style.display = "none";
  document.getElementById("viewExamRoom").style.display = "flex";

  // Cuộn ngay lập tức về đỉnh trang để học sinh bắt đầu làm từ Câu 1
  const scrollToTopExam = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const room = document.getElementById("viewExamRoom");
    if (room) room.scrollTop = 0;
    const qContainer = document.getElementById("examQuestionsContainer");
    if (qContainer) qContainer.scrollTop = 0;
  };
  scrollToTopExam();

  // Cập nhật thông tin phòng thi
  document.getElementById("roomExamTitle").textContent = exam.tenKyThi;
  document.getElementById("roomExamCode").textContent = exam.maDe;

  // Khởi động đồng hồ đếm ngược
  startCountdownTimer(exam.thoiGian);

  // Render câu hỏi đề thi
  renderExamQuestions(exam.cauHoi || [], exam.tuLuan);

  // Render bảng điều hướng câu hỏi (Palette)
  renderQuestionPalette(exam.cauHoi || [], exam.tuLuan);

  // Kích hoạt giám sát thi nếu là bài thi chính thức
  if (isProctoring) {
    const maxAllowed = exam.soLanViPhamChoPhep || 5;
    startProctoringListeners(maxAllowed);
  } else {
    stopProctoringListeners();
  }

  // Đảm bảo cuộn về đỉnh sau khi toàn bộ câu hỏi và layout DOM đã được dựng xong
  requestAnimationFrame(scrollToTopExam);
  setTimeout(scrollToTopExam, 100);

  const modeToastText = isProctoring 
    ? `Chế độ Thi chính thức (Giám sát toàn màn hình). Cho phép cảnh báo tối đa ${exam.soLanViPhamChoPhep || 5} lần vi phạm.`
    : `Chế độ Ôn tập. Chúc bạn làm bài đạt kết quả cao!`;
  showToast("Bắt đầu làm bài", modeToastText, isProctoring ? "warning" : "info", 5000);
}

// Đồng hồ đếm ngược (Countdown Timer)
function startCountdownTimer(minutes) {
  if (timerInterval) clearInterval(timerInterval);

  remainingSeconds = minutes * 60;
  const timerBox = document.getElementById("timerBox");
  const minEl = document.getElementById("timerMinutes");
  const secEl = document.getElementById("timerSeconds");

  timerBox.className = "countdown-timer-box"; // reset styles

  function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    minEl.textContent = String(m).padStart(2, "0");
    secEl.textContent = String(s).padStart(2, "0");

    // Cảnh báo khi còn dưới 5 phút
    if (remainingSeconds <= 300 && remainingSeconds > 60) {
      if (!timerBox.classList.contains("warning")) {
        timerBox.classList.add("warning");
        showToast("Sắp hết giờ!", "Thời gian làm bài chỉ còn dưới 5 phút, hãy kiểm tra lại bài làm!", "warning", 5000);
      }
    }

    // Cảnh báo khẩn cấp khi còn dưới 1 phút (Nhấp nháy đỏ)
    if (remainingSeconds <= 60 && remainingSeconds > 0) {
      if (!timerBox.classList.contains("danger")) {
        timerBox.classList.remove("warning");
        timerBox.classList.add("danger");
        showToast("Khẩn cấp!", "Còn 1 phút cuối cùng! Hệ thống sẽ tự động nộp bài khi hết giờ.", "error", 6000);
      }
    }

    // Khi hết giờ -> Tự động nộp bài
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      showToast("Hết giờ làm bài!", "Hệ thống đang tự động nộp bài của bạn...", "warning", 3000);
      submitStudentExam(true);
    }

    remainingSeconds--;
  }

  updateDisplay();
  timerInterval = setInterval(updateDisplay, 1000);
}

// ============================================================================
// 4. RENDER CÂU HỎI PHẦN I, PHẦN II, PHẦN III TRONG PHÒNG THI
// ============================================================================
function getExamEssayQuestions(essayData) {
  if (!essayData) return [];
  if (Array.isArray(essayData.danhSachCauHoi) && essayData.danhSachCauHoi.length > 0) {
    return essayData.danhSachCauHoi;
  }
  if (essayData.noiDung && essayData.noiDung.trim()) {
    return [{ id: 1, noiDung: essayData.noiDung.trim(), diem: 0 }];
  }
  return [];
}

function renderExamQuestions(questions, essayData) {
  const container = document.getElementById("examQuestionsContainer");
  container.innerHTML = "";

  const essayList = getExamEssayQuestions(essayData);

  if (questions.length === 0 && essayList.length === 0 && (!essayData || !essayData.linkForm)) {
    container.innerHTML = `<div class="exam-q-card"><p>Đề thi này chưa có nội dung câu hỏi.</p></div>`;
    return;
  }

  const part1Questions = questions.filter(q => q.loaiCauHoi !== "true_false");
  const part2Questions = questions.filter(q => q.loaiCauHoi === "true_false");

  // ==========================================
  // PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN
  // ==========================================
  if (part1Questions.length > 0) {
    const p1Hdr = document.createElement("div");
    p1Hdr.className = "student-section-header part-1";
    p1Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN I: CÂU HỎI TRẮC NGHIỆM NHIỀU LỰA CHỌN</div>
        <div class="section-hdr-desc">Thí sinh chọn 1 phương án đúng duy nhất trong 4 lựa chọn (A, B, C, D)</div>
      </div>
      <div class="section-hdr-badge">${part1Questions.length} câu</div>
    `;
    container.appendChild(p1Hdr);

    part1Questions.forEach((q, idx) => {
      const qId = q.id;
      const displayNum = q.displayIndex || (idx + 1);
      const card = document.createElement("div");
      card.className = "exam-q-card";
      card.id = `q_card_${qId}`;
      const qPoints = q.diem !== undefined ? q.diem : 1;

      card.innerHTML = `
        <div class="exam-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="q-badge-num">Câu ${displayNum}</span>
            <span class="q-badge-points">${qPoints} điểm</span>
          </div>
          <span class="q-badge-type">Trắc nghiệm 4 lựa chọn</span>
        </div>
        <div class="exam-q-title">${q.noiDung}</div>
        ${renderStudentMcCard(q, qId)}
      `;
      container.appendChild(card);
    });
  }

  // ==========================================
  // PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI
  // ==========================================
  if (part2Questions.length > 0) {
    const p2Hdr = document.createElement("div");
    p2Hdr.className = "student-section-header part-2";
    p2Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN II: CÂU HỎI TRẮC NGHIỆM ĐÚNG / SAI</div>
        <div class="section-hdr-desc">Thí sinh trả lời Đúng hoặc Sai cho từng ý a), b), c), d) theo thang điểm Bộ GD&ĐT</div>
      </div>
      <div class="section-hdr-badge">${part2Questions.length} câu</div>
    `;
    container.appendChild(p2Hdr);

    part2Questions.forEach((q, idx) => {
      const qId = q.id;
      const displayNum = q.displayIndex || (part1Questions.length + idx + 1);
      const card = document.createElement("div");
      card.className = "exam-q-card";
      card.id = `q_card_${qId}`;
      const qPoints = q.diem !== undefined ? q.diem : 1;

      card.innerHTML = `
        <div class="exam-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="q-badge-num">Câu ${displayNum}</span>
            <span class="q-badge-points">${qPoints} điểm</span>
          </div>
          <span class="q-badge-type">Trắc nghiệm Đúng / Sai</span>
        </div>
        <div class="exam-q-title">${q.noiDung}</div>
        ${renderStudentTfCard(q, qId)}
      `;
      container.appendChild(card);
    });
  }

  // ==========================================
  // PHẦN III: TỰ LUẬN
  // ==========================================
  if (essayList.length > 0 || (essayData && essayData.linkForm)) {
    const p3Hdr = document.createElement("div");
    p3Hdr.className = "student-section-header part-3";
    p3Hdr.id = "studentPart3Header";
    p3Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN III: CÂU HỎI TỰ LUẬN</div>
        <div class="section-hdr-desc">Thí sinh đọc kỹ đề bài và nhập trực tiếp câu trả lời / lời giải vào các ô văn bản bên dưới</div>
      </div>
      <div class="section-hdr-badge">${essayList.length > 0 ? essayList.length + ' câu' : 'Tự luận'}</div>
    `;
    container.appendChild(p3Hdr);

    essayList.forEach((item, idx) => {
      const essayId = item.id || (idx + 1);
      const card = document.createElement("div");
      card.className = "student-essay-card";
      card.id = `essay_card_${essayId}`;

      const savedAnswer = studentEssayAnswers[essayId] || "";
      const pointBadge = (item.diem !== undefined && item.diem !== null && Number(item.diem) > 0)
        ? `<span class="q-badge-points" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;">${item.diem} điểm</span>`
        : '';

      card.innerHTML = `
        <div class="exam-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="q-badge-num">Câu ${essayId}</span>
            ${pointBadge}
          </div>
          <span class="q-badge-type">Tự luận</span>
        </div>
        <div class="exam-q-title">${item.noiDung || "Chưa có nội dung đề bài."}</div>
        <div class="student-essay-textarea-wrap">
          <textarea class="student-essay-textarea" id="essay_textarea_${essayId}" data-essay-id="${essayId}" placeholder="Nhập bài làm tự luận của bạn cho câu ${essayId} tại đây...">${savedAnswer}</textarea>
          <div class="student-essay-meta-row">
            <span>Bài làm sẽ được lưu và nộp tự động cùng đề thi</span>
            <span class="essay-word-counter" id="essay_word_counter_${essayId}">0 từ (0 ký tự)</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    if (essayData && essayData.linkForm) {
      const formCard = document.createElement("div");
      formCard.className = "essay-section-card";
      formCard.style.marginTop = "1rem";
      formCard.innerHTML = `
        <span class="essay-tag" style="background: #059669;">Biểu Mẫu Tự Luận Bổ Sung</span>
        <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.85rem; margin-top: 0.5rem;">
          Giáo viên có đính kèm thêm biểu mẫu nộp bài Google Form. Vui lòng bấm vào liên kết dưới nếu được yêu cầu:
        </p>
        <a href="${essayData.linkForm}" target="_blank" rel="noopener" class="btn-open-googleform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Mở Biểu Mẫu Tự Luận (Google Form) ↗</span>
        </a>
      `;
      container.appendChild(formCard);
    }
  }

  // Bắt sự kiện chọn đáp án trắc nghiệm & nhập tự luận
  attachStudentAnswerEvents();
}

// 4 Lựa chọn
function renderStudentMcCard(q, qId) {
  const options = q.luaChon || [];
  let html = `<div class="student-options-group">`;
  options.forEach(opt => {
    html += `
      <label class="student-option-label" data-qid="${qId}">
        <input type="radio" name="ans_mc_${qId}" value="${opt.key}">
        <span class="opt-key-circle">${opt.key}</span>
        <span>${opt.noiDung}</span>
      </label>
    `;
  });
  html += `</div>`;
  return html;
}

// Đúng / Sai nhiều ý
function renderStudentTfCard(q, qId) {
  const subItems = q.y || [];
  let html = `
    <div class="student-tf-table-wrap">
      <table class="student-tf-table">
        <thead>
          <tr>
            <th style="width: 38px;">Ý</th>
            <th>Nội dung nhận định</th>
            <th style="width: 70px; text-align: center;">Đúng</th>
            <th style="width: 70px; text-align: center;">Sai</th>
          </tr>
        </thead>
        <tbody>
  `;

  subItems.forEach(sub => {
    html += `
      <tr>
        <td class="tf-sub-key">${sub.key})</td>
        <td>${sub.noiDung}</td>
        <td class="tf-radio-cell">
          <input type="radio" name="ans_tf_${qId}_${sub.key}" value="true" data-qid="${qId}" data-key="${sub.key}">
        </td>
        <td class="tf-radio-cell">
          <input type="radio" name="ans_tf_${qId}_${sub.key}" value="false" data-qid="${qId}" data-key="${sub.key}">
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  return html;
}

// Bắt sự kiện người dùng chọn đáp án & nhập tự luận
function attachStudentAnswerEvents() {
  // Trắc nghiệm 4 lựa chọn
  document.querySelectorAll(".student-option-label input[type='radio']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      const qId = e.target.closest(".student-option-label").dataset.qid;
      const val = e.target.value;

      // Lưu câu trả lời
      studentAnswers[qId] = val;

      // Style highlight
      const group = e.target.closest(".student-options-group");
      group.querySelectorAll(".student-option-label").forEach(l => l.classList.remove("is-selected"));
      e.target.closest(".student-option-label").classList.add("is-selected");

      // Cập nhật bảng câu hỏi (Palette)
      markPaletteAnswered(qId, true);
    });
  });

  // Đúng / Sai
  document.querySelectorAll(".tf-radio-cell input[type='radio']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      const qId = e.target.dataset.qid;
      const subKey = e.target.dataset.key;
      const val = e.target.value === "true";

      if (!studentAnswers[qId] || typeof studentAnswers[qId] !== "object") {
        studentAnswers[qId] = {};
      }
      studentAnswers[qId][subKey] = val;

      // Kiểm tra xem đã làm đủ các ý của câu này chưa
      const qObj = (activeExam.cauHoi || []).find(q => (q.id || 0) == qId);
      const subItems = (qObj && qObj.y) ? qObj.y : [];
      const userAns = studentAnswers[qId] || {};
      const isAllSubAnswered = subItems.length > 0 && subItems.every(s => userAns[s.key] !== undefined && userAns[s.key] !== null);

      markPaletteAnswered(qId, isAllSubAnswered);
    });
  });

  // Tự luận: Học sinh gõ bài làm
  document.querySelectorAll(".student-essay-textarea").forEach(textarea => {
    const essayId = textarea.dataset.essayId;
    const counterEl = document.getElementById(`essay_word_counter_${essayId}`);

    const handleInput = () => {
      const content = textarea.value.trim();
      studentEssayAnswers[essayId] = textarea.value;

      const words = content ? content.split(/\s+/).filter(Boolean).length : 0;
      const chars = textarea.value.length;
      if (counterEl) {
        counterEl.textContent = `${words} từ (${chars} ký tự)`;
      }

      markPaletteEssayAnswered(essayId, content.length > 0);
    };

    textarea.addEventListener("input", handleInput);
    if (textarea.value) {
      handleInput();
    }
  });
}

// ============================================================================
// 5. BẢNG ĐIỀU HƯỚNG CÂU HỎI (PALETTE)
// ============================================================================
// Quản lý Drawer Bảng câu hỏi trên thiết bị di động (Mobile Bottom Sheet)
function openMobilePalette() {
  const paletteCol = document.getElementById("examPaletteCol");
  const paletteBackdrop = document.getElementById("paletteBackdrop");
  if (paletteCol) paletteCol.classList.add("is-open-mobile");
  if (paletteBackdrop) paletteBackdrop.classList.add("is-open");
  document.body.classList.add("palette-modal-open");
}

function closeMobilePalette() {
  const paletteCol = document.getElementById("examPaletteCol");
  const paletteBackdrop = document.getElementById("paletteBackdrop");
  if (paletteCol) paletteCol.classList.remove("is-open-mobile");
  if (paletteBackdrop) paletteBackdrop.classList.remove("is-open");
  document.body.classList.remove("palette-modal-open");
}

function renderQuestionPalette(questions, essayData) {
  const grid = document.getElementById("paletteGrid");
  grid.innerHTML = "";

  const part1Questions = questions.filter(q => q.loaiCauHoi !== "true_false");
  const part2Questions = questions.filter(q => q.loaiCauHoi === "true_false");
  const essayList = getExamEssayQuestions(essayData || (activeExam ? activeExam.tuLuan : null));

  // 1. Render câu hỏi Phần I
  if (part1Questions.length > 0) {
    if (part2Questions.length > 0 || essayList.length > 0) {
      const title = document.createElement("div");
      title.className = "palette-section-title";
      title.textContent = "Phần I: Trắc nghiệm";
      grid.appendChild(title);
    }
    part1Questions.forEach((q, idx) => {
      const qId = q.id;
      const displayNum = q.displayIndex || (idx + 1);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn";
      btn.id = `palette_btn_${qId}`;
      btn.textContent = displayNum;
      btn.title = `Câu hỏi trắc nghiệm số ${displayNum}`;
      btn.addEventListener("click", () => {
        closeMobilePalette();
        const targetCard = document.getElementById(`q_card_${qId}`);
        if (targetCard) targetCard.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grid.appendChild(btn);
    });
  }

  // 2. Render câu hỏi Phần II
  if (part2Questions.length > 0) {
    if (part1Questions.length > 0 || essayList.length > 0) {
      const title = document.createElement("div");
      title.className = "palette-section-title";
      title.textContent = "Phần II: Đúng/Sai";
      grid.appendChild(title);
    }
    part2Questions.forEach((q, idx) => {
      const qId = q.id;
      const displayNum = q.displayIndex || (part1Questions.length + idx + 1);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn";
      btn.id = `palette_btn_${qId}`;
      btn.textContent = displayNum;
      btn.title = `Câu hỏi Đúng/Sai số ${displayNum}`;
      btn.addEventListener("click", () => {
        closeMobilePalette();
        const targetCard = document.getElementById(`q_card_${qId}`);
        if (targetCard) targetCard.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      grid.appendChild(btn);
    });
  }

  // 3. Render câu hỏi Phần III (Tự luận)
  if (essayList.length > 0) {
    const title = document.createElement("div");
    title.className = "palette-section-title";
    title.textContent = "Phần III: Tự luận";
    grid.appendChild(title);

    essayList.forEach((item, idx) => {
      const essayId = item.id || (idx + 1);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn palette-essay";
      btn.id = `palette_essay_btn_${essayId}`;
      btn.textContent = `TL ${essayId}`;
      btn.title = `Câu tự luận số ${essayId}`;
      btn.addEventListener("click", () => {
        closeMobilePalette();
        const targetCard = document.getElementById(`essay_card_${essayId}`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: "smooth", block: "start" });
          const ta = targetCard.querySelector("textarea");
          if (ta) ta.focus();
        }
      });
      grid.appendChild(btn);
    });
  }

  updatePaletteProgress();
}

function markPaletteAnswered(qId, isAnswered) {
  const btn = document.getElementById(`palette_btn_${qId}`);
  if (btn) {
    if (isAnswered) btn.classList.add("answered");
    else btn.classList.remove("answered");
  }
  updatePaletteProgress();
}

function markPaletteEssayAnswered(essayId, isAnswered) {
  const btn = document.getElementById(`palette_essay_btn_${essayId}`);
  if (btn) {
    if (isAnswered) btn.classList.add("answered");
    else btn.classList.remove("answered");
  }
  updatePaletteProgress();
}

function updatePaletteProgress() {
  const status = checkExamCompletionStatus();
  const total = status.totalQuestionsCount;
  const answered = status.fullyAnsweredCount;

  const progressEl = document.getElementById("answeredCountText");
  if (progressEl) {
    progressEl.textContent = `Đã làm: ${answered} / ${total} câu`;
  }

  const mobileBadge = document.getElementById("mobileAnsweredBadge");
  if (mobileBadge) {
    mobileBadge.textContent = `${answered}/${total}`;
  }
}

/**
 * Kiểm tra trạng thái hoàn thành tất cả các câu hỏi và các phần trong bài thi
 */
function checkExamCompletionStatus() {
  const questions = (activeExam && activeExam.cauHoi) ? activeExam.cauHoi : [];
  const essayList = getExamEssayQuestions(activeExam ? activeExam.tuLuan : null);
  
  const incompleteItems = [];
  let fullyAnsweredCount = 0;
  const totalQuestionsCount = questions.length + essayList.length;

  const part1Questions = questions.filter(q => q.loaiCauHoi !== "true_false");
  const part2Questions = questions.filter(q => q.loaiCauHoi === "true_false");

  // 1. Kiểm tra Phần I: Trắc nghiệm 4 lựa chọn
  part1Questions.forEach((q, idx) => {
    const qId = q.id;
    const displayNum = q.displayIndex || (idx + 1);
    const userAns = studentAnswers[qId];

    if (!userAns || typeof userAns !== "string" || !userAns.trim()) {
      incompleteItems.push({
        type: "mc",
        qId: qId,
        cardId: `q_card_${qId}`,
        title: `Phần I - Câu ${displayNum}`,
        description: "Chưa chọn đáp án (A, B, C, D)",
        sectionBadge: "Trắc nghiệm"
      });
    } else {
      fullyAnsweredCount++;
    }
  });

  // 2. Kiểm tra Phần II: Trắc nghiệm Đúng / Sai
  part2Questions.forEach((q, idx) => {
    const qId = q.id;
    const displayNum = q.displayIndex || (part1Questions.length + idx + 1);
    const subItems = q.y || [];
    const userAnsMap = (studentAnswers[qId] && typeof studentAnswers[qId] === "object") ? studentAnswers[qId] : {};
    const missingKeys = [];

    subItems.forEach(sub => {
      if (userAnsMap[sub.key] === undefined || userAnsMap[sub.key] === null) {
        missingKeys.push(sub.key);
      }
    });

    if (missingKeys.length > 0) {
      let descText = "";
      if (missingKeys.length === subItems.length) {
        descText = "Chưa chọn ý nào (cần chọn đủ cả 4 ý)";
      } else {
        descText = `Chưa chọn nhận định ý: ${missingKeys.map(k => `"${k}"`).join(", ")}`;
      }

      incompleteItems.push({
        type: "tf",
        qId: qId,
        cardId: `q_card_${qId}`,
        title: `Phần II - Câu ${displayNum} (Đúng / Sai)`,
        description: descText,
        sectionBadge: "Đúng / Sai"
      });
    } else {
      fullyAnsweredCount++;
    }
  });

  // 3. Kiểm tra Phần III: Tự luận (nếu đề có câu hỏi tự luận)
  essayList.forEach((item, idx) => {
    const essayId = item.id || (idx + 1);
    const ans = studentEssayAnswers[essayId];

    if (!ans || typeof ans !== "string" || !ans.trim()) {
      incompleteItems.push({
        type: "essay",
        qId: essayId,
        cardId: `essay_card_${essayId}`,
        title: `Phần III - Câu tự luận ${essayId}`,
        description: "Chưa nhập nội dung bài làm tự luận",
        sectionBadge: "Tự luận"
      });
    } else {
      fullyAnsweredCount++;
    }
  });

  return {
    isComplete: incompleteItems.length === 0,
    incompleteItems: incompleteItems,
    fullyAnsweredCount: fullyAnsweredCount,
    totalQuestionsCount: totalQuestionsCount,
    unansweredCount: incompleteItems.length
  };
}

/**
 * Hiển thị Hộp thoại Cảnh báo Bắt buộc hoàn thành 100% trước khi nộp
 */
function showIncompleteExamModal(status) {
  const modal = document.getElementById("modalIncompleteExam");
  if (!modal) {
    alert(`CẢNH BÁO: Bạn vẫn còn ${status.unansweredCount} câu chưa hoàn thành!\nQuy định: Bạn bắt buộc phải làm đầy đủ tất cả các câu và các phần mới được nộp bài.`);
    return;
  }

  const badge = document.getElementById("incompleteModalBadge");
  if (badge) {
    badge.textContent = `Còn thiếu ${status.unansweredCount} câu`;
  }

  const listContainer = document.getElementById("incompleteQuestionsList");
  if (listContainer) {
    listContainer.innerHTML = "";
    status.incompleteItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "incomplete-q-row";
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #ffffff;
        border: 1.5px solid #fecaca;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      `;

      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.92rem;">${item.title}</strong>
            <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #fee2e2; color: #dc2626;">${item.sectionBadge}</span>
          </div>
          <span style="font-size: 0.8rem; color: #dc2626; font-weight: 600;">👉 ${item.description}</span>
        </div>
        <div style="font-size: 0.82rem; font-weight: 700; color: #2563eb; display: flex; align-items: center; gap: 4px; background: #eff6ff; padding: 6px 12px; border-radius: 8px; border: 1px solid #bfdbfe; flex-shrink: 0;">
          <span>Làm ngay</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;

      // Hover style
      row.addEventListener("mouseenter", () => {
        row.style.borderColor = "#2563eb";
        row.style.transform = "translateX(4px)";
        row.style.boxShadow = "0 4px 12px rgba(37,99,235,0.15)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.borderColor = "#fecaca";
        row.style.transform = "translateX(0)";
        row.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
      });

      // Bấm vào chuyển thẳng đến câu chưa làm
      row.addEventListener("click", () => {
        modal.style.display = "none";
        jumpAndHighlightQuestionCard(item.cardId);
      });

      listContainer.appendChild(row);
    });
  }

  initIncompleteExamModalEvents();
  modal.style.display = "flex";
}

/**
 * Cuộn mượt và highlight câu hỏi cần làm
 */
function jumpAndHighlightQuestionCard(cardId) {
  const card = document.getElementById(cardId);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Thêm hiệu ứng viền đỏ nhấp nháy thu hút sự chú ý
    card.style.transition = "all 0.3s ease";
    card.style.outline = "3px solid #ef4444";
    card.style.boxShadow = "0 0 25px rgba(239, 68, 68, 0.45)";
    
    setTimeout(() => {
      card.style.outline = "";
      card.style.boxShadow = "";
    }, 2800);

    // Nếu là câu tự luận, focus luôn vào textarea
    const textarea = card.querySelector("textarea");
    if (textarea) {
      setTimeout(() => textarea.focus(), 400);
    }
  } else {
    // Nếu không tìm thấy thẻ card id cụ thể, cuộn mượt về khung câu hỏi làm bài
    const qContainer = document.getElementById("examQuestionsContainer");
    if (qContainer) {
      qContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// ============================================================================
// 6. NỘP BÀI THI & HIỂN THỊ KẾT QUẢ
// ============================================================================
const btnSubmitExam = document.getElementById("btnSubmitExam");

// Hàm đóng modal cảnh báo câu hỏi chưa hoàn thành
function closeIncompleteExamModal() {
  const modal = document.getElementById("modalIncompleteExam");
  if (modal) {
    modal.style.display = "none";
  }
}
window.closeIncompleteExamModal = closeIncompleteExamModal;

// Hàm quay lại bài làm từ modal: đóng modal và cuộn tới câu chưa làm để thí sinh làm tiếp
function closeIncompleteExamModalAndResume() {
  closeIncompleteExamModal();
  try {
    const status = checkExamCompletionStatus();
    if (status && status.incompleteItems && status.incompleteItems.length > 0) {
      const firstIncomplete = status.incompleteItems[0];
      jumpAndHighlightQuestionCard(firstIncomplete.cardId);
    } else {
      const qContainer = document.getElementById("examQuestionsContainer");
      if (qContainer) {
        qContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  } catch (err) {
    console.warn("Lỗi khi quay lại bài làm:", err);
    const qContainer = document.getElementById("examQuestionsContainer");
    if (qContainer) {
      qContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}
window.closeIncompleteExamModalAndResume = closeIncompleteExamModalAndResume;

// Khởi tạo các sự kiện click cho modal Incomplete Exam
function initIncompleteExamModalEvents() {
  const btnClose = document.getElementById("btnCloseIncompleteModal");
  if (btnClose) {
    btnClose.onclick = closeIncompleteExamModal;
  }
  const btnResume = document.getElementById("btnResumeExamFromModal");
  if (btnResume) {
    btnResume.onclick = closeIncompleteExamModalAndResume;
  }
  const modal = document.getElementById("modalIncompleteExam");
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeIncompleteExamModal();
      }
    };
  }
}

// Đăng ký sự kiện khi DOM tải xong hoặc đã sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIncompleteExamModalEvents);
} else {
  initIncompleteExamModalEvents();
}

btnSubmitExam.addEventListener("click", () => {
  // Nếu nút đang ở chế độ "Thử nộp lại", ưu tiên gửi bài ngay mà không cần xác nhận lại
  const isRetry = btnSubmitExam.innerText.includes("nộp lại") || btnSubmitExam.innerText.includes("Gửi lại");
  if (isRetry) {
    submitStudentExam(false);
    return;
  }

  const status = checkExamCompletionStatus();

  // BẮT BUỘC: Nếu chưa làm hết tất cả các câu/phần thì TUYỆT ĐỐI KHÔNG CHO NỘP!
  if (!status.isComplete) {
    showIncompleteExamModal(status);
    return;
  }

  // Đã làm đủ 100% tất cả các câu
  const confirmMsg = `Bạn đã hoàn thành đầy đủ tất cả ${status.totalQuestionsCount}/${status.totalQuestionsCount} câu hỏi!\nBạn có chắc chắn muốn nộp bài thi ngay bây giờ?`;

  if (confirm(confirmMsg)) {
    submitStudentExam(false);
  }
});

let isSubmittingExam = false;

async function submitStudentExam(isAutoTimeout = false, isAutoViolation = false, violationReason = "") {
  if (isSubmittingExam) return;
  isSubmittingExam = true;

  // Dừng hệ thống giám sát thi & thoát toàn màn hình an toàn
  stopProctoringListeners();

  // Đóng modal cảnh báo chưa làm xong nếu đang mở
  const incModal = document.getElementById("modalIncompleteExam");
  if (incModal) incModal.style.display = "none";

  // Dừng đồng hồ
  if (timerInterval) clearInterval(timerInterval);

  btnSubmitExam.disabled = true;
  btnSubmitExam.innerHTML = `<span>Đang chấm điểm...</span>`;

  if (isAutoViolation) {
    showToast("Tự động nộp bài!", "Bài thi đã được tự động nộp do vi phạm quy chế thi quá số lần cho phép!", "error", 7000);
  } else if (isAutoTimeout) {
    showToast("Hết giờ làm bài!", "Đã hết thời gian làm bài, hệ thống đang tự động thu và nộp bài thi của bạn...", "warning", 5000);
  } else {
    showToast("Đang xử lý", "Hệ thống đang chấm điểm và ghi nhận bài thi...", "info", 3000);
  }

  const payload = {
    action: "submitExam",
    maDe: activeExam.maDe,
    usernameHS: currentStudent.username,
    lop: currentStudent.lop,
    hoTen: currentStudent.hoTen,
    ngaySinh: currentStudent.ngaySinh,
    gioiTinh: currentStudent.gioiTinh,
    truong: currentStudent.truong,
    thoiGianVaoThi: examStartTime ? examStartTime.toISOString() : new Date().toISOString(),
    cauTraLoi: studentAnswers,
    baiLamTuLuan: studentEssayAnswers,
    soLanViPham: currentExamViolations,
    lyDoNop: isAutoViolation ? violationReason : (isAutoTimeout ? "Hết giờ làm bài" : "Học sinh chủ động nộp bài")
  };

  try {
    // Timeout sau 35 giây để tránh treo trình duyệt nếu Google Apps Script xử lý chậm
    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    let abortTimeout = null;
    if (controller) {
      abortTimeout = setTimeout(() => {
        try { controller.abort(); } catch (e) {}
      }, 35000);
    }

    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    };
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const res = await fetch(API_URL, fetchOptions);
    if (abortTimeout) clearTimeout(abortTimeout);

    let result = null;
    try {
      result = await res.json();
    } catch (eParse) {
      console.warn("Không parse được JSON từ phản hồi:", eParse);
    }

    // Trường hợp 1: Backend trả về thành công
    if (result && result.success) {
      lastExamResult = result;

      // Lưu trạng thái đã hoàn thành bài thi vào máy khách ngay lập tức
      if (activeExam) {
        activeExam.daLam = true;
        activeExam.diemCu = (result.diemTracNghiem !== undefined && result.diemTracNghiem !== null)
          ? result.diemTracNghiem
          : result.diemTong;
        saveLocalSubmittedExam(currentStudent.username, activeExam.maDe, {
          diemCu: activeExam.diemCu,
          thoiGianNopCu: result.thoiGianNop || new Date().toLocaleString("vi-VN")
        });
      }

      showExamResultScreen(result);
      if (result.daLamRoi || result.daGhiNhan) {
        showToast("Nộp bài thành công!", "Hệ thống xác nhận bài thi của bạn đã được ghi nhận an toàn trước đó!", "success", 6000);
      }
      return;
    }

    // Trường hợp 2: Backend thông báo bài đã được nộp/lưu rồi (do lần gửi trước đã vào Sheets thành công)
    if (result && result.daLamRoi) {
      const localGraded = gradeExamLocally(activeExam, studentAnswers);
      const resolvedScore = (result.diemTracNghiem !== undefined && result.diemTracNghiem !== null)
        ? result.diemTracNghiem
        : (result.diemCu !== undefined && result.diemCu !== null
            ? result.diemCu
            : (result.diemTong !== undefined && result.diemTong !== null ? result.diemTong : localGraded.diemTracNghiem));

      const confirmedResult = {
        ...localGraded,
        ...result,
        success: true,
        diemTong: resolvedScore,
        diemTracNghiem: resolvedScore,
        tongDiemTracNghiem: result.tongDiemTracNghiem || localGraded.tongDiemTracNghiem,
        soCauDung: result.soCauDung !== undefined ? result.soCauDung : localGraded.soCauDung,
        tongSoCau: result.tongSoCau || (activeExam.cauHoi ? activeExam.cauHoi.length : localGraded.tongSoCau),
        soCauDungSai: result.soCauDungSai || localGraded.soCauDungSai,
        thoiGianNop: result.thoiGianNop || new Date().toLocaleString("vi-VN"),
        choXemLaiBai: (activeExam?.choXemLaiBai !== false && result.choXemLaiBai !== false),
        choXemDiem: (activeExam?.choXemDiem !== false && result.choXemDiem !== false),
        linkTuLuan: result.linkTuLuan || (activeExam.tuLuan?.linkForm || "")
      };

      lastExamResult = confirmedResult;
      if (activeExam) {
        activeExam.daLam = true;
        activeExam.diemCu = resolvedScore;
        saveLocalSubmittedExam(currentStudent.username, activeExam.maDe, {
          diemCu: resolvedScore,
          thoiGianNopCu: confirmedResult.thoiGianNop
        });
      }

      showExamResultScreen(confirmedResult);
      showToast("Nộp bài thành công!", "Hệ thống xác nhận bài thi của bạn đã được lưu trữ an toàn!", "success", 6000);
      return;
    }

    // Trường hợp 3: Có phản hồi nhưng không thành công
    showToast("Lưu ý nộp bài", (result?.message || "Máy chủ phản hồi chậm. Bạn vui lòng bấm 'Thử nộp lại'!"), "warning", 6000);
    btnSubmitExam.disabled = false;
    btnSubmitExam.innerHTML = `<span>Thử nộp lại</span>`;
    isSubmittingExam = false; // QUAN TRỌNG: Mở lại khóa để học sinh bấm lại được

  } catch (err) {
    console.error("Lỗi gửi bài thi:", err);
    // Nếu offline, timeout hoặc lỗi mạng:
    // Chấm cục bộ và mở màn hình kết quả để học sinh yên tâm
    try {
      const localResult = gradeExamLocally(activeExam, studentAnswers);
      lastExamResult = localResult;
      showExamResultScreen(localResult);
      showToast("Ghi nhận điểm thi", "Mạng gián đoạn hoặc máy chủ phản hồi chậm. Kết quả bài làm đã được ghi nhận an toàn trên máy của bạn!", "warning", 8000);
    } catch (localErr) {
      showToast("Lỗi kết nối", (err.message || "Mạng chập chờn") + ". Vui lòng bấm 'Thử nộp lại'!", "error", 6000);
      btnSubmitExam.disabled = false;
      btnSubmitExam.innerHTML = `<span>Thử nộp lại</span>`;
      isSubmittingExam = false;
    }
  } finally {
    // Đảm bảo mở lại khóa nếu chưa chuyển sang màn hình kết quả thành công
    if (!lastExamResult) {
      isSubmittingExam = false;
      if (btnSubmitExam) btnSubmitExam.disabled = false;
    }
  }
}

// ============================================================================
// ĐĂNG KÝ SỰ KIỆN CÁC MODAL GIÁM SÁT THI & VI PHẠM
// ============================================================================
function initProctoringModalEvents() {
  const btnConfirmStart = document.getElementById("btnConfirmStartExam");
  if (btnConfirmStart) {
    btnConfirmStart.addEventListener("click", () => {
      const modal = document.getElementById("modalConfirmStartExam");
      if (modal) modal.style.display = "none";
      if (examPendingStart) {
        const targetExam = examPendingStart;
        examPendingStart = null;
        // Bật toàn màn hình trực tiếp từ user gesture click
        enterFullScreen();
        proceedIntoExamRoom(targetExam, true);
      }
    });
  }

  const btnCancelStart = document.getElementById("btnCancelStartExam");
  if (btnCancelStart) {
    btnCancelStart.addEventListener("click", () => {
      const modal = document.getElementById("modalConfirmStartExam");
      if (modal) modal.style.display = "none";
      examPendingStart = null;
    });
  }

  const btnResumeViolation = document.getElementById("btnResumeFullscreenExam");
  if (btnResumeViolation) {
    btnResumeViolation.addEventListener("click", () => {
      resumeExamFromViolation();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProctoringModalEvents);
} else {
  initProctoringModalEvents();
}

/**
 * Chuẩn hóa giá trị Boolean tránh lệch kiểu dữ liệu chuỗi/số
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

// Chấm điểm cục bộ khi offline
function gradeExamLocally(exam, userAnswers) {
  const questions = exam.cauHoi || [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const detailedResults = [];

  questions.forEach((q, idx) => {
    const qId = q.id || (idx + 1);
    const qPoints = Number(q.diem) || 1;
    maxPossibleScore += qPoints;
    const userAns = userAnswers[qId];

    if (q.loaiCauHoi === "true_false") {
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

  // Tính điểm tổng trắc nghiệm:
  const diemTracNghiem = Math.round(totalScore * 100) / 100;
  const tongDiemTracNghiem = Math.round(maxPossibleScore * 100) / 100;
  const isAllowReview = (exam.choXemLaiBai !== false);
  const isAllowScore = (exam.choXemDiem !== false);

  return {
    success: true,
    diemTong: diemTracNghiem,
    diemTracNghiem: diemTracNghiem,
    tongDiemTracNghiem: tongDiemTracNghiem,
    soCauDung: correctCount,
    tongSoCau: questions.length,
    soCauDungSai: `${correctCount}/${questions.length} câu đúng`,
    thoiGianNop: UtilitiesFormatTime(),
    choXemLaiBai: isAllowReview,
    choXemDiem: isAllowScore,
    chiTietKetQua: isAllowReview ? detailedResults : [],
    linkTuLuan: (exam.tuLuan && exam.tuLuan.linkForm) ? exam.tuLuan.linkForm : "",
    baiLamTuLuan: studentEssayAnswers,
    danhSachCauHoiTuLuan: (exam.tuLuan && exam.tuLuan.danhSachCauHoi) ? exam.tuLuan.danhSachCauHoi : []
  };
}

function UtilitiesFormatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Hiển thị màn hình kết quả điểm số
function showExamResultScreen(result) {
  lastExamResult = result;
  stopProctoringListeners();

  document.getElementById("viewExamRoom").style.display = "none";
  document.getElementById("viewExamResult").style.display = "flex";

  // Cuộn ngay về đỉnh trang để học sinh thấy điểm số & kết quả
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 80);

  const rawScore = (result.diemTracNghiem !== undefined && result.diemTracNghiem !== null)
    ? Number(result.diemTracNghiem)
    : Number(result.diemTong || 0);
  const displayScore = Math.round(rawScore * 100) / 100;

  // Tính tổng điểm phần trắc nghiệm
  let maxTracNghiemScore = 0;
  if (result.tongDiemTracNghiem !== undefined && result.tongDiemTracNghiem !== null && Number(result.tongDiemTracNghiem) > 0) {
    maxTracNghiemScore = Math.round(Number(result.tongDiemTracNghiem) * 100) / 100;
  } else if (activeExam && Array.isArray(activeExam.cauHoi) && activeExam.cauHoi.length > 0) {
    maxTracNghiemScore = activeExam.cauHoi.reduce((sum, q) => sum + (Number(q.diem) || 1), 0);
    maxTracNghiemScore = Math.round(maxTracNghiemScore * 100) / 100;
  } else {
    maxTracNghiemScore = 10;
  }

  document.getElementById("resultGreeting").textContent = `Thí sinh ${currentStudent.hoTen || currentStudent.username} (${currentStudent.lop}) đã hoàn thành bài thi!`;
  document.getElementById("resultScore").textContent = displayScore;

  const scoreMaxEl = document.getElementById("resultScoreMax");
  if (scoreMaxEl) {
    scoreMaxEl.textContent = `/ ${maxTracNghiemScore} điểm`;
  }

  const essayList = getExamEssayQuestions(activeExam?.tuLuan);
  const hasEssay = essayList.length > 0 || !!(activeExam?.tuLuan && activeExam.tuLuan.linkForm);
  const noteEl = document.getElementById("resultScoreNote");
  if (noteEl) {
    if (hasEssay) {
      noteEl.innerHTML = `📝 <strong>Lưu ý:</strong> Điểm số trên là <strong>Điểm phần trắc nghiệm</strong> (${displayScore}/${maxTracNghiemScore} điểm). Phần tự luận giáo viên sẽ tự chấm và tổng kết điểm sau.`;
    } else {
      noteEl.innerHTML = `📝 <strong>Điểm phần trắc nghiệm:</strong> ${displayScore}/${maxTracNghiemScore} điểm.`;
    }
  }

  document.getElementById("resultSubmitTime").textContent = result.thoiGianNop || UtilitiesFormatTime();

  // ==========================================================================
  // XỬ LÝ CHẾ ĐỘ XEM ĐIỂM (CHO XEM ĐIỂM VS KHÔNG CHO XEM ĐIỂM)
  // ==========================================================================
  const isAllowScore = (activeExam?.choXemDiem !== false && result?.choXemDiem !== false);
  const scoreContainer = document.getElementById("resultScoreContainer");
  const scoreLockedNotice = document.getElementById("resultScoreLockedNotice");

  if (!isAllowScore) {
    if (scoreContainer) scoreContainer.style.display = "none";
    if (scoreLockedNotice) scoreLockedNotice.style.display = "block";
    document.getElementById("resultCorrectStats").textContent = "Đã bảo mật";
    showToast("Nộp bài thành công!", "Hệ thống đã ghi nhận bài thi của bạn an toàn.", "success", 5000);
  } else {
    if (scoreContainer) scoreContainer.style.display = "block";
    if (scoreLockedNotice) scoreLockedNotice.style.display = "none";
    document.getElementById("resultCorrectStats").textContent = `${result.soCauDung || 0} / ${result.tongSoCau || 0} câu`;
    showToast("Thành công", `Điểm phần trắc nghiệm của bạn: ${displayScore}/${maxTracNghiemScore} điểm!`, "success", 5000);
  }

  // Nếu có link bài tự luận
  if (result.linkTuLuan) {
    document.getElementById("resultEssayNotice").style.display = "block";
    document.getElementById("resultEssayLink").href = result.linkTuLuan;
  } else {
    document.getElementById("resultEssayNotice").style.display = "none";
  }

  // ==========================================================================
  // XỬ LÝ CHẾ ĐỘ XEM LẠI BÀI & ĐÁP ÁN THEO CẤU HÌNH CỦA GIÁO VIÊN
  // - Ôn tập (choXemLaiBai === true): Học sinh được bấm nút xem lại câu hỏi và đáp án chi tiết.
  // - Thi chính thức (choXemLaiBai === false): Khóa nút xem lại, hiển thị thông báo bảo mật.
  // ==========================================================================
  const isAllowReview = (activeExam?.choXemLaiBai !== false && result?.choXemLaiBai !== false);
  const btnReview = document.getElementById("btnReviewExamDetail");
  const lockedNotice = document.getElementById("resultReviewLockedNotice");

  if (isAllowReview) {
    if (btnReview) btnReview.style.display = "inline-flex";
    if (lockedNotice) lockedNotice.style.display = "none";
  } else {
    if (btnReview) btnReview.style.display = "none";
    if (lockedNotice) lockedNotice.style.display = "block";
  }
}

// ============================================================================
// 7. MODAL XEM LẠI CHI TIẾT BÀI LÀM & ĐÁP ÁN (DÀNH CHO CHẾ ĐỘ ÔN TẬP)
// ============================================================================
function openExamReviewModal() {
  if (!lastExamResult || !activeExam) {
    showToast("Thông báo", "Không tìm thấy dữ liệu bài thi để xem lại.", "warning");
    return;
  }

  const modal = document.getElementById("reviewExamModal");
  const modalTitle = document.getElementById("reviewModalExamTitle");
  const modalScoreStats = document.getElementById("reviewModalScoreStats");
  const modalBody = document.getElementById("reviewModalBody");

  const rawReviewScore = (lastExamResult.diemTracNghiem !== undefined && lastExamResult.diemTracNghiem !== null)
    ? Number(lastExamResult.diemTracNghiem)
    : Number(lastExamResult.diemTong || 0);
  const displayReviewScore = Math.round(rawReviewScore * 100) / 100;

  let maxTracNghiemScore = 0;
  if (lastExamResult.tongDiemTracNghiem !== undefined && lastExamResult.tongDiemTracNghiem !== null && Number(lastExamResult.tongDiemTracNghiem) > 0) {
    maxTracNghiemScore = Math.round(Number(lastExamResult.tongDiemTracNghiem) * 100) / 100;
  } else if (activeExam && Array.isArray(activeExam.cauHoi) && activeExam.cauHoi.length > 0) {
    maxTracNghiemScore = activeExam.cauHoi.reduce((sum, q) => sum + (Number(q.diem) || 1), 0);
    maxTracNghiemScore = Math.round(maxTracNghiemScore * 100) / 100;
  } else {
    maxTracNghiemScore = 10;
  }

  if (modalTitle) modalTitle.textContent = `Chi Tiết Bài Làm: ${activeExam.tenKyThi || activeExam.maDe}`;
  const isAllowScore = (activeExam?.choXemDiem !== false && lastExamResult?.choXemDiem !== false);
  if (modalScoreStats) {
    if (isAllowScore) {
      modalScoreStats.innerHTML = `Điểm phần trắc nghiệm: <strong style="color: #2563eb;">${displayReviewScore} / ${maxTracNghiemScore} điểm</strong> | Đúng: <strong style="color: #16a34a;">${lastExamResult.soCauDung || 0}/${lastExamResult.tongSoCau || 0}</strong> câu | Tự luận: <strong style="color: #059669;">Chờ GV chấm</strong> | Chế độ: <strong style="color: #059669;">📖 Ôn tập có đáp án</strong>`;
    } else {
      modalScoreStats.innerHTML = `Điểm số: <strong style="color: #b45309;">🔒 Giáo viên đã khóa xem điểm</strong> | Đúng: <strong style="color: #16a34a;">Đã bảo mật</strong> | Tự luận: <strong style="color: #059669;">Chờ GV chấm</strong> | Chế độ: <strong style="color: #059669;">📖 Ôn tập xem bài làm</strong>`;
    }
  }

  modalBody.innerHTML = "";
  modalBody.scrollTop = 0;

  const questions = activeExam.cauHoi || [];
  const detailedList = lastExamResult.chiTietKetQua || [];
  const part1Questions = questions.filter(q => q.loaiCauHoi !== "true_false");
  const part2Questions = questions.filter(q => q.loaiCauHoi === "true_false");
  const essayList = getExamEssayQuestions(activeExam.tuLuan);

  // Render Phần I trong modal
  if (part1Questions.length > 0) {
    const p1Hdr = document.createElement("div");
    p1Hdr.className = "student-section-header part-1";
    p1Hdr.style.margin = "0.75rem 0";
    p1Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN</div>
      </div>
      <div class="section-hdr-badge">${part1Questions.length} câu</div>
    `;
    modalBody.appendChild(p1Hdr);

    part1Questions.forEach(q => renderReviewQuestionCard(q, detailedList, modalBody));
  }

  // Render Phần II trong modal
  if (part2Questions.length > 0) {
    const p2Hdr = document.createElement("div");
    p2Hdr.className = "student-section-header part-2";
    p2Hdr.style.margin = "1.25rem 0 0.75rem";
    p2Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI</div>
      </div>
      <div class="section-hdr-badge">${part2Questions.length} câu</div>
    `;
    modalBody.appendChild(p2Hdr);

    part2Questions.forEach(q => renderReviewQuestionCard(q, detailedList, modalBody));
  }

  // Render Phần III Tự luận trong modal
  if (essayList.length > 0) {
    const p3Hdr = document.createElement("div");
    p3Hdr.className = "student-section-header part-3";
    p3Hdr.style.margin = "1.25rem 0 0.75rem";
    p3Hdr.innerHTML = `
      <div class="section-hdr-left">
        <div class="section-hdr-title">PHẦN III: BÀI LÀM TỰ LUẬN</div>
        <div class="section-hdr-desc">Bài làm tự luận của bạn sẽ được giáo viên chấm thủ công. Bên dưới có hiển thị đáp án đúng để bạn ôn tập, học bài.</div>
      </div>
      <div class="section-hdr-badge">${essayList.length} câu</div>
    `;
    modalBody.appendChild(p3Hdr);

    const studentSavedEssays = (lastExamResult && lastExamResult.baiLamTuLuan) ? lastExamResult.baiLamTuLuan : studentEssayAnswers;

    essayList.forEach((item, idx) => {
      const essayId = item.id || (idx + 1);
      let studentAnsText = "";
      if (studentSavedEssays) {
        if (Array.isArray(studentSavedEssays)) {
          const found = studentSavedEssays.find(e => (e.id || 0) == essayId);
          if (found) studentAnsText = found.baiLam || found.traLoi || "";
        } else if (typeof studentSavedEssays === "object") {
          studentAnsText = studentSavedEssays[essayId] || studentSavedEssays[String(essayId)] || "";
        }
      }
      studentAnsText = String(studentAnsText || "").trim();

      // Tìm đáp án tự luận chuẩn để học sinh ôn tập, học bài
      let correctModelAns = item.dapAn || item.dapAnDung || "";
      if (!correctModelAns && Array.isArray(lastExamResult?.baiLamTuLuan)) {
        const found = lastExamResult.baiLamTuLuan.find(e => (e.id || 0) == essayId);
        if (found && (found.dapAn || found.dapAnDung)) correctModelAns = found.dapAn || found.dapAnDung;
      }
      if (!correctModelAns && Array.isArray(lastExamResult?.danhSachCauHoiTuLuan)) {
        const found = lastExamResult.danhSachCauHoiTuLuan.find(e => (e.id || 0) == essayId);
        if (found && (found.dapAn || found.dapAnDung)) correctModelAns = found.dapAn || found.dapAnDung;
      }
      if (!correctModelAns && activeExam?.tuLuan?.danhSachCauHoi) {
        const found = activeExam.tuLuan.danhSachCauHoi.find(e => (e.id || 0) == essayId);
        if (found && (found.dapAn || found.dapAnDung)) correctModelAns = found.dapAn || found.dapAnDung;
      }

      const card = document.createElement("div");
      card.className = "review-essay-card";
      card.style.marginBottom = "1.25rem";

      const pointBadge = (item.diem !== undefined && item.diem !== null && Number(item.diem) > 0)
        ? `<span class="q-badge-points" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;">${item.diem} điểm</span>`
        : '';

      const modelAnswerHtml = correctModelAns ? `
        <div class="review-essay-correct-ans-box">
          <div class="review-essay-correct-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Đáp án câu tự luận đúng (Dành cho ôn tập & học bài):</span>
          </div>
          <div class="review-essay-correct-content">${escapeHtml(correctModelAns)}</div>
        </div>
      ` : `
        <div class="review-essay-correct-ans-box" style="background: #f8fafc; border-color: #e2e8f0;">
          <div class="review-essay-correct-title" style="color: #64748b;">
            <span>💡 Đáp án câu tự luận đúng:</span>
          </div>
          <div style="font-size: 0.88rem; color: #94a3b8; font-style: italic;">Giáo viên chưa cập nhật đáp án mẫu cho câu tự luận này.</div>
        </div>
      `;

      card.innerHTML = `
        <div class="review-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 800; font-size: 0.95rem; color: #064e3b;">Câu ${essayId} (Tự luận)</span>
            ${pointBadge}
          </div>
          <span class="review-badge-status" style="background: #f0fdf4; color: #047857; border: 1px solid #a7f3d0;">📝 Tự luận - Chờ GV chấm</span>
        </div>
        <div style="font-size: 0.95rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; line-height: 1.5; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(item.noiDung || "Chưa có đề bài.")}</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">✍️ Bài làm của bạn:</div>
        <div class="review-essay-student-ans">
          ${studentAnsText ? escapeHtml(studentAnsText) : '<em style="color: #94a3b8;">(Thí sinh chưa nhập câu trả lời cho câu hỏi này)</em>'}
        </div>
        ${modelAnswerHtml}
      `;
      modalBody.appendChild(card);
    });
  }

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function renderReviewQuestionCard(q, detailedList, container) {
  const qId = q.id;
  const isTf = q.loaiCauHoi === "true_false";
  const detail = detailedList.find(d => (d.qId || 0) == qId);
  const isAllowScore = (activeExam?.choXemDiem !== false && lastExamResult?.choXemDiem !== false);

  const card = document.createElement("div");
  card.className = "review-q-card";
  card.style.marginBottom = "1rem";

  let statusBadgeHtml = "";
  if (isTf) {
    const earned = detail ? detail.diemDat : 0;
    const maxPts = detail ? detail.diemToiDa : (q.diem || 1);
    if (earned === maxPts && maxPts > 0) {
      card.classList.add("is-correct");
      statusBadgeHtml = isAllowScore 
        ? `<span class="review-badge-status correct">✓ Đúng trọn vẹn (${earned}/${maxPts}đ)</span>`
        : `<span class="review-badge-status correct">✓ Đúng trọn vẹn</span>`;
    } else if (earned > 0) {
      card.classList.add("is-partial");
      statusBadgeHtml = isAllowScore 
        ? `<span class="review-badge-status partial">⚡ Đúng 1 phần (${earned}/${maxPts}đ)</span>`
        : `<span class="review-badge-status partial">⚡ Đúng 1 phần</span>`;
    } else {
      card.classList.add("is-wrong");
      statusBadgeHtml = isAllowScore 
        ? `<span class="review-badge-status wrong">✗ Chưa đạt (${earned}/${maxPts}đ)</span>`
        : `<span class="review-badge-status wrong">✗ Chưa đạt</span>`;
    }
  } else {
    const isCorrect = detail ? detail.dung : (studentAnswers[qId] && String(studentAnswers[qId]).toUpperCase() === String(q.dapAnDung).toUpperCase());
    const maxPts = q.diem !== undefined ? q.diem : 1;
    if (isCorrect) {
      card.classList.add("is-correct");
      statusBadgeHtml = isAllowScore 
        ? `<span class="review-badge-status correct">✓ Đúng (+${maxPts}đ)</span>`
        : `<span class="review-badge-status correct">✓ Đúng</span>`;
    } else {
      card.classList.add("is-wrong");
      statusBadgeHtml = isAllowScore 
        ? `<span class="review-badge-status wrong">✗ Sai (0/${maxPts}đ)</span>`
        : `<span class="review-badge-status wrong">✗ Sai</span>`;
    }
  }

  let qBodyHtml = "";
  if (isTf) {
    const subItems = q.y || [];
    const userAnswersMap = studentAnswers[qId] || {};
    const subDetails = (detail && detail.chiTietY) ? detail.chiTietY : [];

    qBodyHtml = `
      <table class="review-tf-table">
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">Ý</th>
            <th>Nội dung nhận định</th>
            <th style="width: 110px; text-align: center;">Bạn chọn</th>
            <th style="width: 110px; text-align: center;">Đáp án chuẩn</th>
            <th style="width: 90px; text-align: center;">Kết quả</th>
          </tr>
        </thead>
        <tbody>
    `;

    subItems.forEach(sub => {
      const subDet = subDetails.find(d => d.key === sub.key);
      let userRaw = null;
      if (userAnswersMap && userAnswersMap[sub.key] !== undefined && userAnswersMap[sub.key] !== null && userAnswersMap[sub.key] !== "") {
        userRaw = userAnswersMap[sub.key];
      } else if (subDet && subDet.traLoi !== undefined && subDet.traLoi !== null && subDet.traLoi !== "") {
        userRaw = subDet.traLoi;
      }
      const hasUserAns = (userRaw !== null);
      const userBool = hasUserAns ? parseBooleanVal(userRaw) : null;
      const userChoice = hasUserAns ? (userBool ? "Đúng" : "Sai") : "Chưa chọn";

      let isMatch = false;
      if (subDet && typeof subDet.dung === "boolean") {
        isMatch = subDet.dung;
      }

      let expectedBool = null;
      if (subDet && subDet.dapAnChuan !== undefined && subDet.dapAnChuan !== null) {
        expectedBool = parseBooleanVal(subDet.dapAnChuan);
      } else if (sub.dung !== undefined && sub.dung !== null) {
        expectedBool = parseBooleanVal(sub.dung);
      } else if (subDet && typeof subDet.dung === "boolean" && userBool !== null) {
        expectedBool = subDet.dung ? userBool : !userBool;
      }

      if (!subDet && userBool !== null && expectedBool !== null) {
        isMatch = (userBool === expectedBool);
      }

      const expectedChoice = (expectedBool !== null) ? (expectedBool ? "Đúng" : "Sai") : "Chưa rõ";
      const expectedColor = expectedChoice === "Đúng" ? "#166534" : (expectedChoice === "Sai" ? "#b91c1c" : "#64748b");
      const expectedBg = expectedChoice === "Đúng" ? "#dcfce7" : (expectedChoice === "Sai" ? "#fee2e2" : "#f1f5f9");

      qBodyHtml += `
        <tr style="background: ${isMatch ? '#f0fdf4' : '#fef2f2'}; border-bottom: 1px solid #e2e8f0;">
          <td style="text-align: center; font-weight: 700; color: #475569;">${sub.key})</td>
          <td style="color: #1e293b; line-height: 1.45;">${sub.noiDung}</td>
          <td style="text-align: center; font-weight: 700; color: ${userChoice === 'Chưa chọn' ? '#94a3b8' : (isMatch ? '#16a34a' : '#dc2626')};">
            ${userChoice}
          </td>
          <td style="text-align: center;">
            <span style="font-weight: 800; color: ${expectedColor}; background: ${expectedBg}; padding: 0.15rem 0.55rem; border-radius: 4px; display: inline-block;">
              ${expectedChoice}
            </span>
          </td>
          <td style="text-align: center;">
            ${isMatch ? '<span style="color: #16a34a; font-weight: 700; background: #dcfce7; padding: 0.15rem 0.45rem; border-radius: 4px;">✓ Khớp</span>' : '<span style="color: #dc2626; font-weight: 700; background: #fee2e2; padding: 0.15rem 0.45rem; border-radius: 4px;">✗ Lệch</span>'}
          </td>
        </tr>
      `;
    });

    qBodyHtml += `</tbody></table>`;
  } else {
    const userChoice = studentAnswers[qId] || (detail ? detail.traLoi : "Chưa chọn");
    const correctAns = (detail && detail.dapAnDung) ? detail.dapAnDung : (q.dapAnDung || "");

    qBodyHtml = `<div class="review-options-list">`;
    (q.luaChon || []).forEach(opt => {
      const isCorrectKey = String(opt.key).toUpperCase() === String(correctAns).toUpperCase();
      const isUserKey = String(opt.key).toUpperCase() === String(userChoice).toUpperCase();

      let itemClass = "review-opt-item";
      let markLabel = "";

      if (isCorrectKey && isUserKey) {
        itemClass += " correct-answer user-correct";
        markLabel = `<span style="font-size: 0.78rem; font-weight: 700; color: #16a34a; background: #dcfce7; padding: 0.2rem 0.5rem; border-radius: 4px;">✓ Bạn chọn đúng</span>`;
      } else if (isCorrectKey) {
        itemClass += " correct-answer";
        markLabel = `<span style="font-size: 0.78rem; font-weight: 700; color: #065f46; background: #a7f3d0; padding: 0.2rem 0.5rem; border-radius: 4px;">★ Đáp án đúng</span>`;
      } else if (isUserKey) {
        itemClass += " user-wrong";
        markLabel = `<span style="font-size: 0.78rem; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 0.2rem 0.5rem; border-radius: 4px;">✗ Bạn đã chọn câu này</span>`;
      }

      qBodyHtml += `
        <div class="${itemClass}">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-weight: 800; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.06); font-size: 0.85rem;">
              ${opt.key}
            </span>
            <span>${opt.noiDung}</span>
          </div>
          <div>${markLabel}</div>
        </div>
      `;
    });
    qBodyHtml += `</div>`;
  }

  card.innerHTML = `
    <div class="review-q-header">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">Câu ${qId}</span>
        <span style="font-size: 0.75rem; color: #64748b; background: #e2e8f0; padding: 0.15rem 0.45rem; border-radius: 4px;">${isTf ? 'Đúng/Sai nhiều ý' : 'Trắc nghiệm 4 lựa chọn'}</span>
      </div>
      ${statusBadgeHtml}
    </div>
    <div style="font-size: 0.95rem; font-weight: 600; color: #1e293b; margin-bottom: 0.5rem; line-height: 1.5; white-space: pre-wrap !important; word-break: break-word;">${q.noiDung}</div>
    ${qBodyHtml}
  `;

  container.appendChild(card);
}

function closeExamReviewModal() {
  const modal = document.getElementById("reviewExamModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
}


// ============================================================================
// HỆ THỐNG MENU TÀI KHOẢN, THÔNG TIN CÁ NHÂN & ĐỔI MẬT KHẨU HỌC SINH
// ============================================================================
function initStudentAccountDropdownAndModals() {
  const trigger = document.getElementById("userProfileTrigger");
  const dropdown = document.getElementById("userDropdownMenu");

  // 1. Toggle mở / đóng dropdown
  if (trigger && dropdown) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("show");
      if (isOpen) {
        dropdown.classList.remove("show");
        trigger.classList.remove("active");
      } else {
        dropdown.classList.add("show");
        trigger.classList.add("active");
      }
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.classList.remove("show");
        trigger.classList.remove("active");
      }
    });
  }

  // 2. Modal Thông tin cá nhân Học sinh
  const btnOpenProfile = document.getElementById("btnOpenProfileModal");
  const modalProfile = document.getElementById("modalStudentProfile");
  const btnCloseProfile = document.getElementById("btnCloseProfileModal");
  const btnCloseProfileBottom = document.getElementById("btnCloseProfileModalBottom");
  const btnSwitchToChangePwd = document.getElementById("btnSwitchToChangePwdModal");

  function openStudentProfile() {
    if (dropdown) dropdown.classList.remove("show");
    if (trigger) trigger.classList.remove("active");
    if (!currentStudent) return;

    const elUser = document.getElementById("profileModalUsername");
    const elName = document.getElementById("profileModalFullName");
    const elClass = document.getElementById("profileModalClass");
    const elSchool = document.getElementById("profileModalSchool");
    const elDob = document.getElementById("profileModalDob");
    const elGender = document.getElementById("profileModalGender");
    const elTopName = document.getElementById("modalProfileFullName");
    const elAvatar = document.getElementById("modalHsAvatarLarge");

    const fullName = currentStudent.hoTen || currentStudent.username || "Học Sinh";
    if (elUser) elUser.textContent = currentStudent.username || "--";
    if (elName) elName.textContent = fullName;
    if (elClass) elClass.textContent = currentStudent.lop || "--";
    if (elSchool) elSchool.textContent = currentStudent.truong || "Hệ thống chung";
    if (elDob) elDob.textContent = (typeof formatDob === "function" ? formatDob(currentStudent.ngaySinh) : currentStudent.ngaySinh) || "--";
    if (elGender) elGender.textContent = currentStudent.gioiTinh || "--";
    if (elTopName) elTopName.textContent = fullName;
    if (elAvatar) elAvatar.textContent = (fullName.slice(0, 2) || "HS").toUpperCase();

    if (modalProfile) modalProfile.style.display = "flex";
  }

  function closeStudentProfile() {
    if (modalProfile) modalProfile.style.display = "none";
  }

  if (btnOpenProfile) btnOpenProfile.addEventListener("click", openStudentProfile);
  if (btnCloseProfile) btnCloseProfile.addEventListener("click", closeStudentProfile);
  if (btnCloseProfileBottom) btnCloseProfileBottom.addEventListener("click", closeStudentProfile);
  if (modalProfile) {
    modalProfile.addEventListener("click", (e) => {
      if (e.target === modalProfile) closeStudentProfile();
    });
  }

  // 3. Modal Đổi Mật Khẩu Học sinh
  const btnOpenChangePwd = document.getElementById("btnOpenChangePassModal");
  const modalChangePwd = document.getElementById("modalStudentChangePassword");
  const btnCloseChangePwd = document.getElementById("btnCloseChangePassModal");
  const btnCancelChangePwd = document.getElementById("btnCancelStudentChangePwd");
  const btnSaveChangePwd = document.getElementById("btnSaveStudentPassword");
  const alertBox = document.getElementById("studentPwdAlertBox");

  function openStudentChangePwd() {
    if (dropdown) dropdown.classList.remove("show");
    if (trigger) trigger.classList.remove("active");
    closeStudentProfile();

    const inpOld = document.getElementById("inputStudentOldPassword") || document.getElementById("inputOldPassword");
    const inpNew = document.getElementById("inputStudentNewPassword") || document.getElementById("inputNewPassword");
    const inpConfirm = document.getElementById("inputStudentConfirmNewPassword") || document.getElementById("inputConfirmNewPassword");
    if (inpOld) inpOld.value = "";
    if (inpNew) inpNew.value = "";
    if (inpConfirm) inpConfirm.value = "";
    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }

    if (modalChangePwd) modalChangePwd.style.display = "flex";
    if (inpOld) setTimeout(() => inpOld.focus(), 150);
  }

  function closeStudentChangePwd() {
    if (modalChangePwd) modalChangePwd.style.display = "none";
  }

  if (btnOpenChangePwd) btnOpenChangePwd.addEventListener("click", openStudentChangePwd);
  if (btnSwitchToChangePwd) btnSwitchToChangePwd.addEventListener("click", openStudentChangePwd);
  if (btnCloseChangePwd) btnCloseChangePwd.addEventListener("click", closeStudentChangePwd);
  if (btnCancelChangePwd) btnCancelChangePwd.addEventListener("click", closeStudentChangePwd);
  if (modalChangePwd) {
    modalChangePwd.addEventListener("click", (e) => {
      if (e.target === modalChangePwd) closeStudentChangePwd();
    });
  }

  // 4. Toggle Eye cho ô mật khẩu
  document.querySelectorAll(".btn-toggle-eye").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute("data-target");
      const targetInp = document.getElementById(targetId);
      if (targetInp) {
        const isPwd = targetInp.type === "password";
        targetInp.type = isPwd ? "text" : "password";
        btn.innerHTML = isPwd 
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
    };
  });

  // 5. Nút Đăng xuất trong Dropdown
  const btnLogoutDrop = document.getElementById("btnLogoutDropdown");
  if (btnLogoutDrop) {
    btnLogoutDrop.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi cổng Học Sinh?")) {
        localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("student_gas_api_url");
    localStorage.removeItem("student_gas_api_url");
        window.location.href = "index.html";
      }
    });
  }

  // 6. Xử lý Lưu Đổi Mật Khẩu
  if (btnSaveChangePwd) {
    btnSaveChangePwd.addEventListener("click", async () => {
      const inpOld = document.getElementById("inputStudentOldPassword") || document.getElementById("inputOldPassword");
      const inpNew = document.getElementById("inputStudentNewPassword") || document.getElementById("inputNewPassword");
      const inpConfirm = document.getElementById("inputStudentConfirmNewPassword") || document.getElementById("inputConfirmNewPassword");

      const oldPassword = inpOld ? inpOld.value.trim() : "";
      const newPassword = inpNew ? inpNew.value.trim() : "";
      const confirmPassword = inpConfirm ? inpConfirm.value.trim() : "";

      const showAlert = (msg) => {
        if (alertBox) {
          alertBox.textContent = msg;
          alertBox.style.display = "block";
        } else {
          showToast("Lỗi nhập liệu", msg, "warning");
        }
      };

      if (!oldPassword) {
        showAlert("Vui lòng nhập mật khẩu hiện tại!");
        if (inpOld) inpOld.focus();
        return;
      }

      if (!newPassword) {
        showAlert("Vui lòng nhập mật khẩu mới!");
        if (inpNew) inpNew.focus();
        return;
      }

      if (newPassword.length < 3) {
        showAlert("Mật khẩu mới phải có ít nhất 3 ký tự!");
        if (inpNew) inpNew.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert("Xác nhận mật khẩu mới không khớp!");
        if (inpConfirm) inpConfirm.focus();
        return;
      }

      if (alertBox) alertBox.style.display = "none";

      const origHtml = btnSaveChangePwd.innerHTML;
      btnSaveChangePwd.disabled = true;
      btnSaveChangePwd.innerHTML = '<span>Đang lưu lên Sheets...</span><div class="save-pwd-spinner" style="display:inline-block; width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite;"></div>';

      try {
        let res = null;
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "updateStudentPassword",
              usernameHS: currentStudent.username,
              oldPassword: oldPassword,
              newPassword: newPassword
            })
          });
          const text = await response.text();
          if (text && !text.trim().startsWith("<")) {
            res = JSON.parse(text);
          }
        } catch (postErr) {
          console.warn("POST updateStudentPassword failed, attempting GET fallback...", postErr);
        }

        if (!res || !res.success) {
          const getUrl = API_URL + "?action=updateStudentPassword&usernameHS=" + encodeURIComponent(currentStudent.username) + "&oldPassword=" + encodeURIComponent(oldPassword) + "&newPassword=" + encodeURIComponent(newPassword) + "&_t=" + Date.now();
          const getRes = await fetch(getUrl);
          const getTxt = await getRes.text();
          if (getTxt && !getTxt.trim().startsWith("<")) {
            res = JSON.parse(getTxt);
          }
        }

        if (res && res.success) {
          showToast("Thành công", res.message || "Đã đổi mật khẩu và cập nhật lên Google Sheets thành công!", "success", 4000);
          if (currentStudent) {
            currentStudent.password = newPassword;
            try {
              localStorage.setItem("currentUser", JSON.stringify(currentStudent));
            } catch (e) {}
          }
          closeStudentChangePwd();
        } else {
          showAlert(res ? res.message : "Mật khẩu hiện tại không chính xác hoặc không thể cập nhật!");
          showToast("Đổi mật khẩu thất bại", res ? res.message : "Mật khẩu hiện tại không chính xác!", "error", 5000);
        }
      } catch (err) {
        console.error("Lỗi khi gọi API đổi mật khẩu học sinh:", err);
        showAlert("Không thể kết nối đến máy chủ Google Sheets. Vui lòng kiểm tra lại mạng!");
        showToast("Lỗi kết nối", "Không thể kết nối đến máy chủ Google Sheets.", "error", 5000);
      } finally {
        btnSaveChangePwd.disabled = false;
        btnSaveChangePwd.innerHTML = origHtml;
      }
    });
  }
}
