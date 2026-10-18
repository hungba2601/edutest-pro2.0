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
  (typeof localStorage !== "undefined" ? (localStorage.getItem("student_gas_api_url") || localStorage.getItem("custom_gas_api_url")) : null) || 
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
    window.location.href = "index.html";
    return;
  }

  currentStudent = JSON.parse(rawUser);

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

  // Đăng xuất
  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
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
  if (!raw || raw === "--") return "--";
  if (!isNaN(Date.parse(raw))) {
    const d = new Date(raw);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return raw;
}

// ============================================================================
// 2. TẢI DANH SÁCH BÀI KIỂM TRA ĐANG MỞ
// ============================================================================
async function loadAvailableExams() {
  const grid = document.getElementById("studentExamsGrid");
  grid.innerHTML = `
    <div class="loading-state-card">
      <div class="spinner" style="display: block; width: 30px; height: 30px; margin: 0 auto 1rem;"></div>
      <p>Đang tải danh sách bài kiểm tra cho lớp ${currentStudent.lop}...</p>
    </div>
  `;

  let exams = [];

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

    const data = await res.json();
    if (data && Array.isArray(data.exams)) {
      exams = data.exams;
    }
  } catch (err) {
    console.warn("Không thể tải từ máy chủ Apps Script, kích hoạt bộ nhớ đệm cục bộ:", err);
  }

  // FALLBACK LOCAL STORAGE: Nếu server không có bài hoặc offline, tìm trong các đề của giáo viên đã lưu
  if (!exams || exams.length === 0) {
    exams = getLocalAvailableExams(currentStudent.lop);
  }

  availableExams = exams;

  if (availableExams.length === 0) {
    grid.innerHTML = `
      <div class="loading-state-card">
        <svg style="width: 48px; height: 48px; margin: 0 auto 1rem; color: #64748b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <h3 style="color: #cbd5e1; margin-bottom: 0.5rem;">Hiện chưa có kỳ thi nào đang mở</h3>
        <p>Khi giáo viên mở đề thi cho lớp <strong>${currentStudent.lop}</strong>, bài thi sẽ tự động hiển thị tại đây.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";
  availableExams.forEach((exam, idx) => {
    const card = document.createElement("div");
    card.className = "exam-card-item";

    const hasTuLuan = !!(exam.tuLuan && (exam.tuLuan.noiDung || exam.tuLuan.linkForm));
    const isAllowReview = (exam.choXemLaiBai !== false);

    card.innerHTML = `
      <div class="exam-card-top">
        <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
          <span class="badge-open-live">
            <span class="dot-pulsing"></span>
            <span>Đang Mở Thi</span>
          </span>
          ${isAllowReview 
            ? `<span class="badge-review-tag allowed" title="Cho phép học sinh xem lại bài làm và đáp án sau khi nộp">📖 Ôn tập</span>`
            : `<span class="badge-review-tag locked" title="Khóa xem lại đề và đáp án để bảo mật kỳ thi">🔒 Thi chính thức</span>`}
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
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Giáo viên tạo: <strong>${exam.usernameGV || "Giáo viên"}</strong></span>
        </div>
        <div class="exam-meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Chế độ sau thi: <strong style="color: ${isAllowReview ? '#10b981' : '#f59e0b'};">${isAllowReview ? 'Cho xem lại bài & đáp án' : 'Khóa xem bài & đáp án'}</strong></span>
        </div>
        ${hasTuLuan ? `
          <div class="exam-meta-row" style="color: #6ee7b7;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>Kèm phần Tự luận (Google Form)</span>
          </div>
        ` : ''}
      </div>

      <button type="button" class="btn-start-exam" data-index="${idx}">
        <span>Bắt Đầu Làm Bài</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </button>
    `;

    grid.appendChild(card);
  });

  // Bắt sự kiện bấm vào thi
  grid.querySelectorAll(".btn-start-exam").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      enterExamRoom(availableExams[idx]);
    });
  });
}

// Lấy danh sách đề thi từ localStorage phù hợp với lớp học sinh
function getLocalAvailableExams(studentClass) {
  const result = [];
  const normalizedClass = String(studentClass || "").trim().toUpperCase();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("cached_teacher_exams_")) {
      try {
        const examsList = JSON.parse(localStorage.getItem(key)) || [];
        examsList.forEach(ex => {
          const status = String(ex.trangThai || "").trim().toLowerCase();
          if (status === "mở") {
            const allowed = String(ex.lopChoPhep || "").trim().toUpperCase();
            const isMatch = !allowed || allowed === "ALL" || allowed === "TẤT CẢ" || 
                            allowed.split(/[,;\s]+/).map(s => s.trim()).includes(normalizedClass);

            if (isMatch) {
              const duLieu = ex.duLieuDe || {};
              const questions = duLieu.cauHoi || ex.cauHoi || [];
              const choXem = (ex.choXemLaiBai !== false && duLieu.choXemLaiBai !== false);

              result.push({
                maDe: ex.maDe,
                tenKyThi: ex.tenKyThi,
                usernameGV: ex.usernameGV || key.replace("cached_teacher_exams_", ""),
                lopChoPhep: ex.lopChoPhep,
                thoiGian: Number(ex.thoiGian) || 45,
                trangThai: "Mở",
                soCauHoi: questions.length,
                cauHoi: questions,
                choXemLaiBai: choXem,
                tuLuan: duLieu.tuLuan || ex.tuLuan || {}
              });
            }
          }
        });
      } catch (e) {
        console.error("Lỗi đọc cache đề thi:", e);
      }
    }
  }
  return result;
}

// ============================================================================
// 3. VÀO PHÒNG THI TẬP TRUNG & BẬT ĐỒNG HỒ ĐẾM NGƯỢC
// ============================================================================
function enterExamRoom(exam) {
  const isAllowReview = (exam.choXemLaiBai !== false);
  const modeText = isAllowReview ? "ÔN TẬP (Xem được bài làm & đáp án sau khi nộp)" : "THI CHÍNH THỨC (Khóa xem bài & đáp án nhằm bảo mật đề)";

  if (!confirm(`Bạn có chắc chắn muốn bắt đầu làm bài kiểm tra: "${exam.tenKyThi}"?\n• Thời gian: ${exam.thoiGian} phút.\n• Chế độ: ${modeText}`)) {
    return;
  }

  activeExam = exam;
  examStartTime = new Date();
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

  // Đảm bảo cuộn về đỉnh sau khi toàn bộ câu hỏi và layout DOM đã được dựng xong
  requestAnimationFrame(scrollToTopExam);
  setTimeout(scrollToTopExam, 100);

  showToast("Bắt đầu thi", `Thời gian làm bài: ${exam.thoiGian} phút. Chúc bạn làm bài đạt kết quả cao!`, "info", 4000);
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

    part1Questions.forEach((q) => {
      const qId = q.id;
      const card = document.createElement("div");
      card.className = "exam-q-card";
      card.id = `q_card_${qId}`;
      const qPoints = q.diem !== undefined ? q.diem : 1;

      card.innerHTML = `
        <div class="exam-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="q-badge-num">Câu ${qId}</span>
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

    part2Questions.forEach((q) => {
      const qId = q.id;
      const card = document.createElement("div");
      card.className = "exam-q-card";
      card.id = `q_card_${qId}`;
      const qPoints = q.diem !== undefined ? q.diem : 1;

      card.innerHTML = `
        <div class="exam-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="q-badge-num">Câu ${qId}</span>
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

      // Kiểm tra xem đã làm đủ 4 ý của câu này chưa
      const qObj = (activeExam.cauHoi || []).find(q => (q.id || 0) == qId);
      const totalSub = (qObj && qObj.y) ? qObj.y.length : 4;
      const answeredSub = Object.keys(studentAnswers[qId]).length;

      if (answeredSub >= totalSub) {
        markPaletteAnswered(qId, true);
      }
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
    part1Questions.forEach((q) => {
      const qId = q.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn";
      btn.id = `palette_btn_${qId}`;
      btn.textContent = qId;
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
    part2Questions.forEach((q) => {
      const qId = q.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn";
      btn.id = `palette_btn_${qId}`;
      btn.textContent = qId;
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
  const mcTotal = (activeExam && activeExam.cauHoi) ? activeExam.cauHoi.length : 0;
  const essayList = getExamEssayQuestions(activeExam ? activeExam.tuLuan : null);
  const total = mcTotal + essayList.length;

  const answeredMc = Object.keys(studentAnswers).length;
  const answeredEssay = Object.values(studentEssayAnswers).filter(txt => !!(txt && txt.trim())).length;
  const totalAnswered = answeredMc + answeredEssay;

  const progressEl = document.getElementById("answeredCountText");
  if (progressEl) {
    progressEl.textContent = `Đã làm: ${totalAnswered} / ${total} câu`;
  }

  const mobileBadge = document.getElementById("mobileAnsweredBadge");
  if (mobileBadge) {
    mobileBadge.textContent = `${totalAnswered}/${total}`;
  }
}

// ============================================================================
// 6. NỘP BÀI THI & HIỂN THỊ KẾT QUẢ
// ============================================================================
const btnSubmitExam = document.getElementById("btnSubmitExam");

btnSubmitExam.addEventListener("click", () => {
  const mcTotal = (activeExam && activeExam.cauHoi) ? activeExam.cauHoi.length : 0;
  const essayList = getExamEssayQuestions(activeExam ? activeExam.tuLuan : null);
  const total = mcTotal + essayList.length;

  const answeredMc = Object.keys(studentAnswers).length;
  const answeredEssay = Object.values(studentEssayAnswers).filter(txt => !!(txt && txt.trim())).length;
  const totalAnswered = answeredMc + answeredEssay;
  const unanswered = total - totalAnswered;

  let confirmMsg = "Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?";
  if (unanswered > 0) {
    confirmMsg = `CẢNH BÁO: Bạn vẫn còn ${unanswered} câu chưa hoàn thành (trắc nghiệm hoặc tự luận)!\nBạn có chắc chắn muốn nộp bài thi không?`;
  }

  if (confirm(confirmMsg)) {
    submitStudentExam(false);
  }
});

async function submitStudentExam(isAutoTimeout = false) {
  // Dừng đồng hồ
  if (timerInterval) clearInterval(timerInterval);

  btnSubmitExam.disabled = true;
  btnSubmitExam.innerHTML = `<span>Đang chấm điểm...</span>`;

  showToast("Đang xử lý", "Hệ thống đang chấm điểm và ghi nhận bài thi...", "info", 3000);

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
    baiLamTuLuan: studentEssayAnswers
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result && result.success) {
      lastExamResult = result;
      showExamResultScreen(result);
    } else {
      alert("Lỗi nộp bài: " + (result?.message || "Không thể lưu kết quả."));
      btnSubmitExam.disabled = false;
      btnSubmitExam.innerHTML = `<span>Thử nộp lại</span>`;
    }

  } catch (err) {
    console.error("Lỗi gửi bài thi:", err);
    // Nếu offline hoặc lỗi mạng, thử chấm cục bộ
    try {
      const localResult = gradeExamLocally(activeExam, studentAnswers);
      lastExamResult = localResult;
      showExamResultScreen(localResult);
      showToast("Cảnh báo mạng", "Đã ghi nhận điểm cục bộ do lỗi kết nối server.", "warning", 6000);
    } catch (localErr) {
      alert("Lỗi kết nối khi gửi bài thi: " + err.message + "\nVui lòng bấm 'Nộp Bài Thi' lại!");
      btnSubmitExam.disabled = false;
      btnSubmitExam.innerHTML = `<span>Nộp Bài Thi</span>`;
    }
  }
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

  // Tính điểm tổng chuẩn xác:
  // Nếu đề thi đã được phân bổ điểm theo thang 10 (tổng điểm trắc nghiệm <= 10.05, ví dụ 0.25đ, 0.5đ, 1.0đ):
  // Giữ nguyên điểm thực tế học sinh đạt được (totalScore), KHÔNG chia tỷ lệ để tránh bị lệch và ra điểm số lẻ vô lý!
  // Chỉ quy đổi về thang 10 nếu tổng điểm thô > 10.
  let finalScore = totalScore;
  if (maxPossibleScore > 10.05) {
    finalScore = (totalScore / maxPossibleScore) * 10;
  } else {
    finalScore = totalScore;
  }
  const finalScore10 = Math.round(finalScore * 100) / 100;
  const isAllowReview = (exam.choXemLaiBai !== false);

  return {
    success: true,
    diemTong: finalScore10,
    soCauDung: correctCount,
    tongSoCau: questions.length,
    soCauDungSai: `${correctCount}/${questions.length} câu đúng`,
    thoiGianNop: UtilitiesFormatTime(),
    choXemLaiBai: isAllowReview,
    chiTietKetQua: isAllowReview ? detailedResults : [],
    linkTuLuan: (exam.tuLuan && exam.tuLuan.linkForm) ? exam.tuLuan.linkForm : "",
    baiLamTuLuan: studentEssayAnswers
  };
}

function UtilitiesFormatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Hiển thị màn hình kết quả điểm số
function showExamResultScreen(result) {
  lastExamResult = result;

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

  const rawScore = Number(result.diemTong || 0);
  const displayScore = Math.round(rawScore * 100) / 100;

  document.getElementById("resultGreeting").textContent = `Thí sinh ${currentStudent.hoTen || currentStudent.username} (${currentStudent.lop}) đã hoàn thành bài thi!`;
  document.getElementById("resultScore").textContent = displayScore;
  document.getElementById("resultCorrectStats").textContent = `${result.soCauDung || 0} / ${result.tongSoCau || 0} câu`;
  document.getElementById("resultSubmitTime").textContent = result.thoiGianNop || UtilitiesFormatTime();

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

  showToast("Thành công", `Bài thi của bạn đạt: ${displayScore} điểm!`, "success", 5000);
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

  const displayReviewScore = Math.round(Number(lastExamResult.diemTong || 0) * 100) / 100;
  if (modalTitle) modalTitle.textContent = `Chi Tiết Bài Làm: ${activeExam.tenKyThi || activeExam.maDe}`;
  if (modalScoreStats) {
    modalScoreStats.innerHTML = `Điểm số: <strong style="color: #2563eb;">${displayReviewScore} / 10</strong> | Đúng: <strong style="color: #16a34a;">${lastExamResult.soCauDung || 0}/${lastExamResult.tongSoCau || 0}</strong> câu | Chế độ: <strong style="color: #059669;">📖 Ôn tập có đáp án</strong>`;
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
        <div class="section-hdr-desc">Bài làm tự luận của bạn sẽ được giáo viên chấm thủ công</div>
      </div>
      <div class="section-hdr-badge">${essayList.length} câu</div>
    `;
    modalBody.appendChild(p3Hdr);

    const studentSavedEssays = (lastExamResult && lastExamResult.baiLamTuLuan) ? lastExamResult.baiLamTuLuan : studentEssayAnswers;

    essayList.forEach((item, idx) => {
      const essayId = item.id || (idx + 1);
      const studentAnsText = (studentSavedEssays && studentSavedEssays[essayId]) ? String(studentSavedEssays[essayId]).trim() : "";

      const card = document.createElement("div");
      card.className = "review-essay-card";
      card.style.marginBottom = "1rem";

      const pointBadge = (item.diem !== undefined && item.diem !== null && Number(item.diem) > 0)
        ? `<span class="q-badge-points" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;">${item.diem} điểm</span>`
        : '';

      card.innerHTML = `
        <div class="review-q-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 800; font-size: 0.95rem; color: #064e3b;">Câu ${essayId} (Tự luận)</span>
            ${pointBadge}
          </div>
          <span class="review-badge-status" style="background: #f0fdf4; color: #047857; border: 1px solid #a7f3d0;">📝 Chờ GV chấm</span>
        </div>
        <div style="font-size: 0.95rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; line-height: 1.5;">${item.noiDung || "Chưa có đề bài."}</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Bài làm của bạn:</div>
        <div class="review-essay-student-ans">
          ${studentAnsText ? studentAnsText : '<em style="color: #94a3b8;">(Thí sinh chưa nhập câu trả lời cho câu hỏi này)</em>'}
        </div>
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

  const card = document.createElement("div");
  card.className = "review-q-card";
  card.style.marginBottom = "1rem";

  let statusBadgeHtml = "";
  if (isTf) {
    const earned = detail ? detail.diemDat : 0;
    const maxPts = detail ? detail.diemToiDa : (q.diem || 1);
    if (earned === maxPts && maxPts > 0) {
      card.classList.add("is-correct");
      statusBadgeHtml = `<span class="review-badge-status correct">✓ Đúng trọn vẹn (${earned}/${maxPts}đ)</span>`;
    } else if (earned > 0) {
      card.classList.add("is-partial");
      statusBadgeHtml = `<span class="review-badge-status partial">⚡ Đúng 1 phần (${earned}/${maxPts}đ)</span>`;
    } else {
      card.classList.add("is-wrong");
      statusBadgeHtml = `<span class="review-badge-status wrong">✗ Chưa đạt (${earned}/${maxPts}đ)</span>`;
    }
  } else {
    const isCorrect = detail ? detail.dung : (studentAnswers[qId] && String(studentAnswers[qId]).toUpperCase() === String(q.dapAnDung).toUpperCase());
    const maxPts = q.diem !== undefined ? q.diem : 1;
    if (isCorrect) {
      card.classList.add("is-correct");
      statusBadgeHtml = `<span class="review-badge-status correct">✓ Đúng (+${maxPts}đ)</span>`;
    } else {
      card.classList.add("is-wrong");
      statusBadgeHtml = `<span class="review-badge-status wrong">✗ Sai (0/${maxPts}đ)</span>`;
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
    <div style="font-size: 0.95rem; font-weight: 600; color: #1e293b; margin-bottom: 0.5rem; line-height: 1.5;">${q.noiDung}</div>
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

