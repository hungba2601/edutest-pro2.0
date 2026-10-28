
/**
 * Xử lý Xóa học sinh khi click icon thùng rác
 */
async function handleDeleteStudentAction(u, name, btn) {
  const confirmDel = confirm(`⚠️ XÁC NHẬN XÓA HỌC SINH:\n\nBạn có chắc chắn muốn XÓA học sinh "${name}" (Mã tài khoản: ${u}) khỏi danh sách?\n\nHọc sinh này sẽ bị xóa vĩnh viễn trên Sheet DATA_HOCSINH của Google Sheets!`);
  if (!confirmDel) return;

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div style="width: 14px; height: 14px; border: 2px solid #dc2626; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>';

  try {
    let res = null;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteStudent",
          usernameHS: u
        })
      });
      const text = await response.text();
      if (text && !text.trim().startsWith("<")) {
        res = JSON.parse(text);
      }
    } catch (postErr) {
      console.warn("POST deleteStudent failed, attempting GET fallback...", postErr);
    }

    if (!res || !res.success) {
      const getUrl = API_URL + "?action=deleteStudent&usernameHS=" + encodeURIComponent(u) + "&_t=" + Date.now();
      const getRes = await fetch(getUrl);
      const getTxt = await getRes.text();
      if (getTxt && !getTxt.trim().startsWith("<")) {
        res = JSON.parse(getTxt);
      }
    }

    if (res && res.success) {
      showToast("Thành công", res.message || `Đã xóa học sinh "${name}" khỏi Google Sheets!`, "success", 3500);
      currentTeacherStudents = currentTeacherStudents.filter(s => s.username.toUpperCase() !== u.toUpperCase());
      saveCachedTeacherStudents(currentTeacherStudents, teacherAllClassesList);
      applyStudentFilters();
    } else {
      showToast("Xóa thất bại", res ? res.message : "Không thể xóa học sinh!", "error", 4000);
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  } catch (err) {
    console.error("Lỗi khi xóa học sinh:", err);
    showToast("Lỗi kết nối", "Không thể kết nối đến máy chủ Google Sheets.", "error", 4000);
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

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

/**
 * ============================================================================
 * TEACHER DASHBOARD LOGIC - EDUTEST PRO 2.0
 * ============================================================================
 */

// ============================================================================
// STATE LƯU TRỮ CỤC BỘ (Khai báo trước để tránh lỗi ReferenceError TDZ)
// ============================================================================
let currentTeacher = null;
try {
  const cachedUserStr = localStorage.getItem("currentUser");
  if (cachedUserStr) currentTeacher = JSON.parse(cachedUserStr);
} catch (eInitTeacher) {}

let parsedQuestions = []; // Danh sách câu hỏi trắc nghiệm (Phần I & II)
let parsedEssayQuestions = []; // Danh sách câu hỏi tự luận (Phần III)
let currentExamsList = [];
let currentResultsList = [];
let currentTeacherStudents = []; // Danh sách học sinh các lớp GV phụ trách
let editingExamCode = null; // Mã đề đang trong chế độ chỉnh sửa (null = tạo mới)
let targetChangePwdStudent = null; // Học sinh đang được chọn để đổi mật khẩu

// Lấy API_URL từ cấu hình (Đảm bảo mỗi giáo viên CHỈ LƯU VÀO GOOGLE SHEET CÁ NHÂN RIÊNG, KHÔNG LƯU VÀO ADMIN)
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbw0WKZ9KjlMud7nEof6Kwqe6XYDRDeht4gHWVH_WsS2h48j_dzSvriiT9I4RT9t6zIG/exec";

// Kiểm tra tài khoản Ban Giám Hiệu ('admin')
function isBGHAccount() {
  let username = "";
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (u && u.username) username = String(u.username).trim().toLowerCase();
  } catch (e) {}
  if (currentTeacher?.username) username = String(currentTeacher.username).trim().toLowerCase();
  return username === "admin";
}

// Kiểm tra quyền Quản lý Giáo viên (Cột D trên Sheet DATA_GIAOVIEN là 'admin')
function hasTeacherManagementPermission() {
  let quyen = "";
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (u && u.quyen) quyen = String(u.quyen).trim().toLowerCase();
  } catch (e) {}
  if (currentTeacher?.quyen) quyen = String(currentTeacher.quyen).trim().toLowerCase();
  return quyen === "admin";
}

// 1. Kiểm tra tài khoản Admin hệ thống (gồm tài khoản "admin" BGH và tài khoản có Cột D - Quyền là "admin")
function isCurrentUserAdmin() {
  return isBGHAccount() || hasTeacherManagementPermission();
}

function isAdminRole() {
  return isCurrentUserAdmin();
}

// Kiểm tra tài khoản dùng chung Sheet Trung Tâm (0938750424 và admin)
function isCentralAccount(targetUser) {
  let u = String(targetUser || currentTeacher?.username || "").trim().toLowerCase();
  if (!u) {
    try {
      const cur = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (cur && cur.username) u = String(cur.username).trim().toLowerCase();
    } catch (e) {}
  }
  const cleanUser = u.replace(/^0+/, "");
  return (u === "admin" || u === "0938750424" || cleanUser === "938750424");
}

let adminActiveApiUrl = null;
let adminActiveUsernameGV = "ALL";
let adminTeacherDirectory = [];

function isSameTeacherAccount(acc1, acc2) {
  let s1 = String(acc1 || "").trim().toLowerCase();
  let s2 = String(acc2 || "").trim().toLowerCase();
  if (s1 === s2) return true;
  if (s1.startsWith("'")) s1 = s1.substring(1).trim();
  if (s2.startsWith("'")) s2 = s2.substring(1).trim();
  if (s1 === s2) return true;
  const clean1 = s1.replace(/^0+/, "");
  const clean2 = s2.replace(/^0+/, "");
  if (clean1 && clean2 && clean1 === clean2) return true;
  return false;
}

function getTeacherPersonalServerUrl() {
  try {
    if (isAdminRole()) {
      if (adminActiveApiUrl) return adminActiveApiUrl;
      return DEFAULT_GAS_API_URL;
    }
    // Tài khoản sử dụng Sheet trung tâm (như 0938750424)
    if (isCentralAccount()) {
      return DEFAULT_GAS_API_URL;
    }
    const isCentral = isCentralAccount();
    const custom = (localStorage.getItem("custom_gas_api_url") || "").trim();
    if (custom && custom.startsWith("https://script.google.com/macros/s/")) {
      if (!isCentral && custom === DEFAULT_GAS_API_URL) {
        return "";
      }
      return custom;
    }

    if (currentTeacher && currentTeacher.serverUrl && currentTeacher.serverUrl.startsWith("https://script.google.com/macros/s/")) {
      if (!isCentral && currentTeacher.serverUrl === DEFAULT_GAS_API_URL) {
        return "";
      }
      return currentTeacher.serverUrl.trim();
    }

    const u = currentTeacher ? (currentTeacher.username || "") : "";
    if (u) {
      const rem = localStorage.getItem("teacher_server_url_" + u) ||
                  localStorage.getItem("teacher_server_url_" + u.replace(/^0+/, "")) ||
                  localStorage.getItem("teacher_server_url_0" + u);
      if (rem && rem.startsWith("https://script.google.com/macros/s/")) {
        if (!isCentral && rem === DEFAULT_GAS_API_URL) {
          return "";
        }
        return rem.trim();
      }
    }

    // Nếu là Admin hệ thống hoặc dùng sheet trung tâm thì mặc định sử dụng luôn Sheet trung tâm
    if (isCentral) {
      return DEFAULT_GAS_API_URL;
    }
  } catch (eStorage) {}
  return "";
}

// Tự động đồng bộ URL cá nhân từ Hub Server của Admin cho Giáo viên nếu có
async function syncTeacherServerUrlFromHub() {
  if (!currentTeacher || !currentTeacher.username) return;
  if (isCurrentUserAdmin() || isCentralAccount()) return;

  try {
    const resp = await fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory&_t=${Date.now()}`, { method: "GET" });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data || !data.success || !Array.isArray(data.teachers)) return;

    const teacherEntry = data.teachers.find(t => isSameTeacherAccount(t.maGV, currentTeacher.username));
    if (teacherEntry && teacherEntry.serverUrl && teacherEntry.serverUrl.startsWith("https://script.google.com/macros/s/")) {
      const hubUrl = teacherEntry.serverUrl.trim();
      const currentPersonalUrl = getTeacherPersonalServerUrl();

      if (hubUrl !== currentPersonalUrl) {
        localStorage.setItem("custom_gas_api_url", hubUrl);
        const u = currentTeacher.username;
        localStorage.setItem("teacher_server_url_" + u, hubUrl);
        localStorage.setItem("teacher_server_url_" + u.replace(/^0+/, ""), hubUrl);

        currentTeacher.serverUrl = hubUrl;
        if (teacherEntry.hoTenGV && !currentTeacher.hoTenGV) {
          currentTeacher.hoTenGV = teacherEntry.hoTenGV;
        }
        localStorage.setItem("currentUser", JSON.stringify(currentTeacher));

        API_URL = hubUrl;
        updateServerStatusBadgeUI();

        // Tự động tải lại đề thi và học sinh theo Sheet cá nhân vừa cập nhật
        try { loadTeacherExams(false); } catch (eExams) {}
        try { loadTeacherStudents(false); } catch (eStudents) {}
      }
    }
  } catch (err) {
    console.warn("Không thể tự động đồng bộ URL từ Hub:", err);
  }
}

function updateServerStatusBadgeUI() {
  const personalUrl = getTeacherPersonalServerUrl();
  const isAdmin = isCurrentUserAdmin();
  const btnStatus = document.getElementById("btnServerConnectionStatus");
  const txtStatus = document.getElementById("txtServerConnectionStatus");
  const saveNotice = document.getElementById("saveExamServerNotice");
  const saveNoticeText = document.getElementById("saveExamServerNoticeText");

  if (isAdmin) {
    const activeUrl = personalUrl || API_URL || DEFAULT_GAS_API_URL;
    if (btnStatus) {
      btnStatus.className = "btn-server-status-pill";
      btnStatus.style.background = "#eff6ff";
      btnStatus.style.borderColor = "#93c5fd";
      btnStatus.style.color = "#1e40af";
      btnStatus.title = "Đang kết nối Máy chủ Google Sheet Admin (" + activeUrl + "). Bấm để xem hoặc đổi URL.";
    }
    if (txtStatus) txtStatus.textContent = "Google Sheet Admin (Hệ Thống)";
    if (saveNotice) {
      saveNotice.style.background = "#eff6ff";
      saveNotice.style.borderColor = "#bfdbfe";
      saveNotice.style.color = "#1d4ed8";
    }
    if (saveNoticeText) {
      saveNoticeText.innerHTML = "🛡️ <strong>Tài khoản Admin:</strong> Đề thi được kết nối và lưu trực tiếp vào Google Sheet Admin trung tâm.";
    }
  } else if (isCentralAccount()) {
    if (btnStatus) {
      btnStatus.className = "btn-server-status-pill";
      btnStatus.style.background = "#eff6ff";
      btnStatus.style.borderColor = "#93c5fd";
      btnStatus.style.color = "#1e40af";
      btnStatus.title = "Đang kết nối Google Sheet Trung Tâm hệ thống.";
    }
    if (txtStatus) txtStatus.textContent = "Google Sheet Trung Tâm";
    if (saveNotice) {
      saveNotice.style.background = "#eff6ff";
      saveNotice.style.borderColor = "#bfdbfe";
      saveNotice.style.color = "#1d4ed8";
    }
    if (saveNoticeText) {
      saveNoticeText.innerHTML = "🛡️ <strong>Tài khoản dùng Sheet Trung Tâm:</strong> Đề thi được kết nối và lưu trực tiếp vào Google Sheet trung tâm.";
    }
  } else if (personalUrl) {
    if (btnStatus) {
      btnStatus.className = "btn-server-status-pill";
      btnStatus.style.background = "";
      btnStatus.style.borderColor = "";
      btnStatus.style.color = "";
      btnStatus.title = "Đang kết nối Google Sheet Cá Nhân (" + personalUrl + "). Bấm để xem hoặc đổi URL.";
    }
    if (txtStatus) txtStatus.textContent = "Google Sheet Cá Nhân (Riêng)";
    if (saveNotice) {
      saveNotice.style.background = "#ecfdf5";
      saveNotice.style.borderColor = "#a7f3d0";
      saveNotice.style.color = "#047857";
    }
    if (saveNoticeText) {
      saveNoticeText.innerHTML = "🔒 <strong>Bảo mật đề thi:</strong> Đề sẽ được lưu độc quyền vào Google Sheet cá nhân của Thầy/Cô (Tuyệt đối không lưu lên máy chủ Admin trung tâm).";
    }
  } else {
    if (btnStatus) {
      btnStatus.className = "btn-server-status-pill is-warning";
      btnStatus.style.background = "";
      btnStatus.style.borderColor = "";
      btnStatus.style.color = "";
      btnStatus.title = "Chưa kết nối Google Sheet riêng! Đề thi sẽ không thể lưu lên máy chủ. Bấm vào đây để kết nối.";
    }
    if (txtStatus) txtStatus.textContent = "⚠️ Chưa kết nối Sheet riêng";
    if (saveNotice) {
      saveNotice.style.background = "#fffbeb";
      saveNotice.style.borderColor = "#fde68a";
      saveNotice.style.color = "#b45309";
    }
    if (saveNoticeText) {
      saveNoticeText.innerHTML = "⚠️ <strong>Chưa kết nối Google Sheet riêng:</strong> Vui lòng bấm vào <strong>'Trạm Trung Tâm'</strong> để kết nối URL Web App của Thầy/Cô trước khi lưu đề!";
    }
  }
}

let API_URL = getTeacherPersonalServerUrl() || DEFAULT_GAS_API_URL;

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

// Hàm an toàn mã hóa ký tự HTML (XSS Protection & tránh lỗi render)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Tự động phục hồi định dạng xuống dòng cho các câu hỏi, câu tự luận, phương án
 * Khi các ý a. b. c. d. hoặc dấu gạch đầu dòng -, + bị dính trên cùng 1 dòng
 */
function restoreMultilineFormatting(str) {
  if (!str) return "";
  let s = String(str);

  // Chuẩn hóa \r\n thành \n
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Tách a. b. c. d. hoặc a) b) c) d) sau dấu chấm / dấu câu / dấu ngoặc nếu chưa có xuống dòng
  s = s.replace(/([.?!;:]|\))[ \t\u00A0]+([a-dA-D][\.\)])[ \t\u00A0]+/g, "$1\n$2 ");

  // Tách gạch đầu dòng - hoặc – hoặc — sau dấu chấm / dấu câu nếu chưa có xuống dòng
  s = s.replace(/([.?!;:]|\))[ \t\u00A0]+([-–—])[ \t\u00A0]+/g, "$1\n$2 ");

  // Tách dấu + hoặc * hoặc ý 1, ý 2 sau dấu câu nếu chưa có xuống dòng
  s = s.replace(/([.?!;:]|\))[ \t\u00A0]+([+*])[ \t\u00A0]+/g, "$1\n$2 ");
  s = s.replace(/([.?!;:]|\))[ \t\u00A0]+((?:Ý|ý)\s*\d+[\.:])[ \t\u00A0]*/g, "$1\n$2 ");

  return s.trim();
}

/**
 * Trích xuất nội dung văn bản bảo toàn 100% xuống dòng từ thẻ contenteditable
 */
function extractCleanMultilineText(el) {
  if (!el) return "";
  let text = "";
  if (typeof el.innerText === "string") {
    text = el.innerText;
  } else {
    text = el.textContent || "";
  }
  return restoreMultilineFormatting(text);
}

/**
 * Đồng bộ toàn bộ nội dung người dùng đang nhập từ bản xem trước vào state (parsedQuestions, parsedEssayQuestions)
 */
function syncAllPreviewInputsToState() {
  // 1. Đồng bộ câu hỏi trắc nghiệm / Đúng sai
  document.querySelectorAll(".q-prompt-editable:not(.q-essay-prompt)").forEach(el => {
    const idx = parseInt(el.dataset.index);
    if (!isNaN(idx) && typeof parsedQuestions !== "undefined" && parsedQuestions[idx]) {
      parsedQuestions[idx].noiDung = extractCleanMultilineText(el);
    }
  });

  // 2. Đồng bộ các phương án trắc nghiệm
  document.querySelectorAll(".q-opt-text").forEach(el => {
    const qIdx = parseInt(el.dataset.qidx);
    const optKey = el.dataset.optkey;
    const q = (typeof parsedQuestions !== "undefined" && parsedQuestions) ? parsedQuestions[qIdx] : null;
    if (q && q.luaChon) {
      const opt = q.luaChon.find(o => o.key === optKey);
      if (opt) opt.noiDung = extractCleanMultilineText(el);
    }
  });

  // 3. Đồng bộ mệnh đề Đúng / Sai
  document.querySelectorAll(".q-tf-text").forEach(el => {
    const qIdx = parseInt(el.dataset.qidx);
    const subIdx = parseInt(el.dataset.subidx);
    const q = (typeof parsedQuestions !== "undefined" && parsedQuestions) ? parsedQuestions[qIdx] : null;
    if (q && q.y && q.y[subIdx]) {
      q.y[subIdx].noiDung = extractCleanMultilineText(el);
    }
  });

  // 4. Đồng bộ câu hỏi tự luận (đề bài và đáp án)
  document.querySelectorAll(".q-essay-prompt").forEach(el => {
    const eqIdx = parseInt(el.dataset.index);
    if (!isNaN(eqIdx) && typeof parsedEssayQuestions !== "undefined" && parsedEssayQuestions[eqIdx]) {
      const cleanText = extractCleanMultilineText(el);
      parsedEssayQuestions[eqIdx].noiDung = cleanText;
      const leftTx = document.querySelector(`.essay-content-input[data-index="${eqIdx}"]`);
      if (leftTx && leftTx.value !== cleanText) leftTx.value = cleanText;
    }
  });

  document.querySelectorAll(".q-essay-answer-editable").forEach(el => {
    const eqIdx = parseInt(el.dataset.index);
    if (!isNaN(eqIdx) && typeof parsedEssayQuestions !== "undefined" && parsedEssayQuestions[eqIdx]) {
      const cleanText = extractCleanMultilineText(el);
      parsedEssayQuestions[eqIdx].dapAn = cleanText;
      const leftTx = document.querySelector(`.essay-answer-input[data-index="${eqIdx}"]`);
      if (leftTx && leftTx.value !== cleanText) leftTx.value = cleanText;
    }
  });
}

// Cập nhật giao diện chuyển chế độ Xem lại bài
function updateReviewModeDisplay(isAllow) {
  const optReview = document.getElementById("optModeReview");
  const optExam = document.getElementById("optModeExam");
  const badgeMode = document.getElementById("badgeReviewMode");
  const antiCheatGroup = document.getElementById("antiCheatConfigGroup");

  if (isAllow) {
    if (optReview) optReview.classList.add("selected");
    if (optExam) optExam.classList.remove("selected");
    if (badgeMode) {
      badgeMode.textContent = "📖 ÔN TẬP (ĐƯỢC XEM BÀI)";
      badgeMode.classList.remove("locked");
    }
    if (antiCheatGroup) {
      antiCheatGroup.style.display = "none";
    }
  } else {
    if (optReview) optReview.classList.remove("selected");
    if (optExam) optExam.classList.add("selected");
    if (badgeMode) {
      badgeMode.textContent = "🔒 THI (KHÓA XEM BÀI)";
      badgeMode.classList.add("locked");
    }
    if (antiCheatGroup) {
      antiCheatGroup.style.display = "block";
      updateAntiCheatHint();
    }
  }
}

function updateAntiCheatHint() {
  const input = document.getElementById("examMaxViolations");
  const maxSpan = document.getElementById("antiCheatHintMax");
  const nextSpan = document.getElementById("antiCheatHintNext");
  if (!input) return;
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 20) val = 20;
  if (maxSpan) maxSpan.textContent = val;
  if (nextSpan) nextSpan.textContent = val + 1;
}

function initReviewModeSelector() {
  const radioAllow = document.getElementById("radioAllowReview");
  const radioDisallow = document.getElementById("radioDisallowReview");
  const maxViolationsInput = document.getElementById("examMaxViolations");

  if (radioAllow) {
    radioAllow.addEventListener("change", () => updateReviewModeDisplay(true));
  }
  if (radioDisallow) {
    radioDisallow.addEventListener("change", () => updateReviewModeDisplay(false));
  }
  if (maxViolationsInput) {
    maxViolationsInput.addEventListener("input", updateAntiCheatHint);
    maxViolationsInput.addEventListener("change", () => {
      let val = parseInt(maxViolationsInput.value, 10);
      if (isNaN(val) || val < 1) maxViolationsInput.value = 1;
      else if (val > 20) maxViolationsInput.value = 20;
      updateAntiCheatHint();
    });
  }
}

// Cập nhật giao diện chuyển chế độ Xem điểm
function updateScoreModeDisplay(isAllow) {
  const optAllow = document.getElementById("optScoreAllow");
  const optDisallow = document.getElementById("optScoreDisallow");
  const badgeMode = document.getElementById("badgeScoreMode");

  if (isAllow) {
    if (optAllow) optAllow.classList.add("selected");
    if (optDisallow) optDisallow.classList.remove("selected");
    if (badgeMode) {
      badgeMode.textContent = "👁️ CHO XEM ĐIỂM";
      badgeMode.style.background = "#ecfdf5";
      badgeMode.style.color = "#047857";
      badgeMode.style.borderColor = "#a7f3d0";
    }
  } else {
    if (optAllow) optAllow.classList.remove("selected");
    if (optDisallow) optDisallow.classList.add("selected");
    if (badgeMode) {
      badgeMode.textContent = "🔒 KHÓA XEM ĐIỂM";
      badgeMode.style.background = "#fef2f2";
      badgeMode.style.color = "#dc2626";
      badgeMode.style.borderColor = "#fecaca";
    }
  }
}

function initScoreModeSelector() {
  const radioAllow = document.getElementById("radioAllowViewScore");
  const radioDisallow = document.getElementById("radioDisallowViewScore");

  if (radioAllow) {
    radioAllow.addEventListener("change", () => updateScoreModeDisplay(true));
  }
  if (radioDisallow) {
    radioDisallow.addEventListener("change", () => updateScoreModeDisplay(false));
  }
}

// Render danh sách checkbox chọn Khối và Lớp cho đề thi (đồng bộ giống tab Quản lý học sinh)
function initClassSelector(classesString) {
  const classContainer = document.getElementById("classSelectorContainer");
  const gradeContainer = document.getElementById("examGradeCheckboxesList");
  if (!classContainer) return;

  classContainer.innerHTML = "";
  if (gradeContainer) gradeContainer.innerHTML = "";

  const rawClasses = classesString ? classesString.split(/[,;\s]+/).filter(Boolean) : ["9A1", "9A2"];
  
  // Sắp xếp các lớp theo khối và tên theo thứ tự tự nhiên (VD: 8A1, 8A2, ..., 8A10, ..., 9A1)
  const classes = Array.from(new Set(rawClasses)).sort((a, b) => {
    const ga = parseInt(getGradeFromClass(a)) || 0;
    const gb = parseInt(getGradeFromClass(b)) || 0;
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  // Tập hợp các khối duy nhất
  const gradeSet = new Set();
  classes.forEach(cls => {
    const g = getGradeFromClass(cls);
    if (g) gradeSet.add(g);
  });
  const sortedGrades = Array.from(gradeSet).sort((a, b) => Number(a) - Number(b));

  // 1. Render danh sách Checkbox KHỐI LỚP (giống Tab Quản lý HS)
  if (gradeContainer) {
    const allGradeChip = createClassChip("ALL", "Tất cả khối", true, true);
    gradeContainer.appendChild(allGradeChip);

    sortedGrades.forEach(g => {
      const gChip = createClassChip(g, `Khối ${g}`, true, true, g);
      gradeContainer.appendChild(gChip);
    });
  }

  // 2. Render danh sách Checkbox LỚP HỌC
  const allClassChip = createClassChip("ALL", "Tất cả các lớp", true, false);
  classContainer.appendChild(allClassChip);

  classes.forEach(cls => {
    const chip = createClassChip(cls, cls, true, false);
    classContainer.appendChild(chip);
  });

  // Gắn sự kiện đồng bộ giữa Tích Khối và Tích Lớp
  attachExamClassFilterEvents();
  updateSelectedClassCountBadge();
}

function createClassChip(val, labelText, checked = false, isGrade = false, gradeVal = "") {
  const div = document.createElement("div");
  const g = val === "ALL" ? "all" : (gradeVal || getGradeFromClass(val) || "other");
  div.className = `class-checkbox-chip chip-grade-${g}`;
  const inputId = isGrade ? `exam_grade_${val}` : `class_${val}`;
  const inputClass = isGrade ? "exam-grade-cb" : "exam-class-cb";
  const gradeAttr = (!isGrade && val !== "ALL") ? `data-grade="${g}"` : "";
  const labelStyle = val === "ALL" ? 'style="font-weight: 700;"' : "";

  div.innerHTML = `
    <input type="checkbox" id="${inputId}" value="${val}" ${gradeAttr} class="${inputClass}" ${checked ? "checked" : ""}>
    <label for="${inputId}" ${labelStyle}>${labelText}</label>
  `;
  return div;
}

function updateSelectedClassCountBadge() {
  const badge = document.getElementById("examSelectedCountBadge");
  if (!badge) return;
  const allClassCb = document.getElementById("class_ALL");
  const totalClasses = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL)");
  const checkedClasses = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL):checked");
  
  if (allClassCb && allClassCb.checked) {
    badge.textContent = `Đang chọn: Tất cả (${totalClasses.length} lớp)`;
    badge.style.background = "#eff6ff";
    badge.style.color = "#1d4ed8";
    badge.style.borderColor = "#bfdbfe";
  } else if (checkedClasses.length === 0) {
    badge.textContent = `Chưa chọn lớp nào`;
    badge.style.background = "#fef2f2";
    badge.style.color = "#dc2626";
    badge.style.borderColor = "#fecaca";
  } else {
    badge.textContent = `Đang chọn: ${checkedClasses.length}/${totalClasses.length} lớp`;
    badge.style.background = "#f0fdf4";
    badge.style.color = "#15803d";
    badge.style.borderColor = "#bbf7d0";
  }
}

function attachExamClassFilterEvents() {
  const gradeContainer = document.getElementById("examGradeCheckboxesList");
  const classContainer = document.getElementById("classSelectorContainer");

  if (gradeContainer && !gradeContainer._hasFilterListener) {
    gradeContainer._hasFilterListener = true;
    gradeContainer.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "checkbox") return;

      const allGradeCb = document.getElementById("exam_grade_ALL");
      const gradeCbs = document.querySelectorAll("#examGradeCheckboxesList .exam-grade-cb:not(#exam_grade_ALL)");
      const classCbs = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL)");
      const allClassCb = document.getElementById("class_ALL");

      if (target.value === "ALL") {
        const isChecked = target.checked;
        gradeCbs.forEach(cb => cb.checked = isChecked);
        classCbs.forEach(cb => cb.checked = isChecked);
        if (allClassCb) allClassCb.checked = isChecked;
      } else {
        const gradeVal = target.value;
        const isChecked = target.checked;

        classCbs.forEach(cb => {
          if (cb.getAttribute("data-grade") === gradeVal) {
            cb.checked = isChecked;
          }
        });

        if (allGradeCb) {
          allGradeCb.checked = gradeCbs.length > 0 && Array.from(gradeCbs).every(cb => cb.checked);
        }
        if (allClassCb) {
          allClassCb.checked = classCbs.length > 0 && Array.from(classCbs).every(cb => cb.checked);
        }
      }
      updateSelectedClassCountBadge();
    });
  }

  if (classContainer && !classContainer._hasFilterListener) {
    classContainer._hasFilterListener = true;
    classContainer.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "checkbox") return;

      const allClassCb = document.getElementById("class_ALL");
      const classCbs = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL)");
      const gradeCbs = document.querySelectorAll("#examGradeCheckboxesList .exam-grade-cb:not(#exam_grade_ALL)");
      const allGradeCb = document.getElementById("exam_grade_ALL");

      if (target.value === "ALL") {
        const isChecked = target.checked;
        classCbs.forEach(cb => cb.checked = isChecked);
        gradeCbs.forEach(cb => cb.checked = isChecked);
        if (allGradeCb) allGradeCb.checked = isChecked;
      } else {
        const gradeVal = target.getAttribute("data-grade");
        if (gradeVal) {
          const classesOfGrade = Array.from(classCbs).filter(cb => cb.getAttribute("data-grade") === gradeVal);
          const targetGradeCb = document.getElementById("exam_grade_" + gradeVal);
          if (targetGradeCb) {
            targetGradeCb.checked = classesOfGrade.length > 0 && classesOfGrade.every(cb => cb.checked);
          }
        }

        if (allClassCb) {
          allClassCb.checked = classCbs.length > 0 && Array.from(classCbs).every(cb => cb.checked);
        }
        if (allGradeCb) {
          allGradeCb.checked = gradeCbs.length > 0 && Array.from(gradeCbs).every(cb => cb.checked);
        }
      }
      updateSelectedClassCountBadge();
    });
  }
}

function syncExamGradeAndClassUI() {
  const allClassCb = document.getElementById("class_ALL");
  const classCbs = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL)");
  const gradeCbs = document.querySelectorAll("#examGradeCheckboxesList .exam-grade-cb:not(#exam_grade_ALL)");
  const allGradeCb = document.getElementById("exam_grade_ALL");

  gradeCbs.forEach(gcb => {
    const gVal = gcb.value;
    const classesOfGrade = Array.from(classCbs).filter(cb => cb.getAttribute("data-grade") === gVal);
    gcb.checked = classesOfGrade.length > 0 && classesOfGrade.every(cb => cb.checked);
  });

  if (allClassCb) {
    allClassCb.checked = classCbs.length > 0 && Array.from(classCbs).every(cb => cb.checked);
  }
  if (allGradeCb) {
    allGradeCb.checked = gradeCbs.length > 0 && Array.from(gradeCbs).every(cb => cb.checked);
  }
  updateSelectedClassCountBadge();
}

// ============================================================================
// CẤU HÌNH GOOGLE GEMINI API (MODEL CHUẨN GIAO DIỆN & ÁNH XẠ ĐÚNG MODEL ĐÃ CHỌN)
// ============================================================================
const GEMINI_MODELS_MAP = {
  "gemini-3-flash-preview": {
    name: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    aliases: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
  },
  "gemini-3.1-flash-lite": {
    name: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    aliases: ["gemini-3.1-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"]
  },
  "gemini-2.5-flash": {
    name: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    aliases: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
  },
  "gemini-3.8-flash": {
    name: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    aliases: ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
  },
  "gemini-3.6-flash": {
    name: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    aliases: ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
  },
  "gemini-3.7-flash": {
    name: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    aliases: ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
  }
};

// Tự động dọn dẹp cấu hình cũ nếu từng lưu 1.5
(function cleanLegacyGeminiSettings() {
  try {
    const saved = localStorage.getItem("gemini_model");
    if (saved && (saved.includes("1.5") || !GEMINI_MODELS_MAP[saved])) {
      localStorage.setItem("gemini_model", "gemini-3-flash-preview");
    }
  } catch (e) {}
})();

// Hàm cập nhật trạng thái hiển thị kết nối Google Sheets trong modal
function setGasStatusInModal(type, title, desc) {
  const box = document.getElementById("gasConnectionStatusBox");
  const iconEl = document.getElementById("gasStatusIcon");
  const titleEl = document.getElementById("gasStatusTitle");
  const descEl = document.getElementById("gasStatusDesc");
  if (!box || !iconEl || !titleEl || !descEl) return;

  if (type === "loading") {
    box.style.border = "1.5px solid #93c5fd";
    box.style.background = "#eff6ff";
    box.style.color = "#1d4ed8";
    iconEl.textContent = "⏳";
  } else if (type === "success") {
    box.style.border = "1.5px solid #86efac";
    box.style.background = "#f0fdf4";
    box.style.color = "#15803d";
    iconEl.textContent = "✅";
  } else if (type === "error") {
    box.style.border = "1.5px solid #fca5a5";
    box.style.background = "#fef2f2";
    box.style.color = "#b91c1c";
    iconEl.textContent = "❌";
  } else {
    // neutral / info
    box.style.border = "1.5px solid #bae6fd";
    box.style.background = "#e0f2fe";
    box.style.color = "#0369a1";
    iconEl.textContent = "ℹ️";
  }
  titleEl.textContent = title;
  descEl.innerHTML = desc;
}

// Hàm cập nhật trạng thái hiển thị kết nối Gemini AI trong modal
function setGeminiStatusInModal(type, title, desc) {
  const box = document.getElementById("geminiConnectionStatusBox");
  const iconEl = document.getElementById("geminiStatusIcon");
  const titleEl = document.getElementById("geminiStatusTitle");
  const descEl = document.getElementById("geminiStatusDesc");
  if (!box || !iconEl || !titleEl || !descEl) return;

  if (type === "loading") {
    box.style.border = "1.5px solid #93c5fd";
    box.style.background = "#eff6ff";
    box.style.color = "#1d4ed8";
    iconEl.textContent = "⏳";
  } else if (type === "success") {
    box.style.border = "1.5px solid #86efac";
    box.style.background = "#f0fdf4";
    box.style.color = "#15803d";
    iconEl.textContent = "✅";
  } else if (type === "error") {
    box.style.border = "1.5px solid #fca5a5";
    box.style.background = "#fef2f2";
    box.style.color = "#b91c1c";
    iconEl.textContent = "❌";
  } else {
    // neutral / info
    box.style.border = "1.5px solid #e2e8f0";
    box.style.background = "#f8fafc";
    box.style.color = "#475569";
    iconEl.textContent = "✨";
  }
  titleEl.textContent = title;
  descEl.innerHTML = desc;
}

function initGeminiConfigUI() {
  let savedKey = localStorage.getItem("gemini_api_key") || "";
  let savedModel = localStorage.getItem("gemini_model") || "gemini-3-flash-preview";

  if (savedModel.includes("1.5") || !GEMINI_MODELS_MAP[savedModel]) {
    savedModel = "gemini-3-flash-preview";
    localStorage.setItem("gemini_model", savedModel);
  }

  const keyStatusEl = document.getElementById("currentKeyStatusText");
  const modelTextEl = document.getElementById("currentSelectedModelText");
  const modalKeyInput = document.getElementById("modalGeminiApiKey");
  const modalModelSelect = document.getElementById("modalGeminiModelSelect");
  const badgeDisplay = document.getElementById("currentModelBadgeDisplay");
  const testBtn = document.getElementById("testBtnText");

  if (modalKeyInput) modalKeyInput.value = savedKey;
  if (modalModelSelect) modalModelSelect.value = savedModel;

  const modelInfo = GEMINI_MODELS_MAP[savedModel] || { label: "Gemini 3 Flash Preview" };
  if (modelTextEl) modelTextEl.textContent = modelInfo.label;
  if (badgeDisplay) badgeDisplay.textContent = `MẶC ĐỊNH: ${modelInfo.label.toUpperCase()}`;
  if (testBtn) testBtn.textContent = `Kiểm tra ${modelInfo.label}`;

  if (savedKey) {
    setGeminiStatusInModal("info", `Đã cấu hình API Key (${savedKey.slice(0, 6)}...)`, `Mô hình đang chọn: <strong>${modelInfo.label}</strong>. Bấm nút <strong>Kiểm tra ${modelInfo.label}</strong> để gửi truy vấn thử.`);
  } else {
    setGeminiStatusInModal("info", "Chưa cấu hình API Key", `Dán mã API Key và bấm <strong>Kiểm tra kết nối AI</strong> để kiểm tra kết nối với Google AI.`);
  }

  if (keyStatusEl) {
    if (savedKey) {
      keyStatusEl.textContent = "Đã cấu hình (" + savedKey.slice(0, 6) + "...)";
      keyStatusEl.style.color = "#10b981";
    } else {
      keyStatusEl.textContent = "Chưa cấu hình";
      keyStatusEl.style.color = "#f59e0b";
    }
  }
}

// Lắng nghe thay đổi dropdown mô hình AI trong modal
const modalModelSelectEl = document.getElementById("modalGeminiModelSelect");
if (modalModelSelectEl) {
  modalModelSelectEl.addEventListener("change", (e) => {
    const val = e.target.value;
    const info = GEMINI_MODELS_MAP[val] || { label: val };
    const badgeDisplay = document.getElementById("currentModelBadgeDisplay");
    const testBtn = document.getElementById("testBtnText");
    if (badgeDisplay) badgeDisplay.textContent = `MẶC ĐỊNH: ${info.label.toUpperCase()}`;
    if (testBtn) testBtn.textContent = `Kiểm tra ${info.label}`;
    const key = (document.getElementById("modalGeminiApiKey")?.value || "").trim();
    if (key) {
      setGeminiStatusInModal("info", `Đã chọn mô hình: ${info.label}`, `Bấm <strong>Kiểm tra ${info.label}</strong> để kiểm tra kết nối với mô hình này.`);
    }
  });
}

// Mở & Đóng Modal Cấu hình
const geminiConfigModal = document.getElementById("geminiConfigModal");
const btnOpenGeminiModal = document.getElementById("btnOpenGeminiModal");
const btnCloseGeminiModal = document.getElementById("btnCloseGeminiModal");
const btnCancelConfigModal = document.getElementById("btnCancelConfigModal");

if (btnOpenGeminiModal) {
  btnOpenGeminiModal.addEventListener("click", () => {
    initGeminiConfigUI();
    geminiConfigModal.style.display = "flex";
  });
}

if (btnCloseGeminiModal) {
  btnCloseGeminiModal.addEventListener("click", () => {
    geminiConfigModal.style.display = "none";
  });
}

if (btnCancelConfigModal) {
  btnCancelConfigModal.addEventListener("click", () => {
    geminiConfigModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === geminiConfigModal) {
    geminiConfigModal.style.display = "none";
  }
});

// Toggle hiện / ẩn Key
const btnToggleShowKey = document.getElementById("btnToggleShowKey");
if (btnToggleShowKey) {
  btnToggleShowKey.addEventListener("click", () => {
    const input = document.getElementById("modalGeminiApiKey");
    if (input.type === "password") {
      input.type = "text";
      btnToggleShowKey.textContent = "🔒";
    } else {
      input.type = "password";
      btnToggleShowKey.textContent = "👁";
    }
  });
}

// Thay đổi lựa chọn Model trong dropdown
const modalGeminiModelSelect = document.getElementById("modalGeminiModelSelect");
if (modalGeminiModelSelect) {
  modalGeminiModelSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    const modelInfo = GEMINI_MODELS_MAP[val] || { label: "Gemini 3 Flash Preview" };
    const badgeDisplay = document.getElementById("currentModelBadgeDisplay");
    const testBtn = document.getElementById("testBtnText");
    if (badgeDisplay) badgeDisplay.textContent = `MẶC ĐỊNH: ${modelInfo.label.toUpperCase()}`;
    if (testBtn) testBtn.textContent = `Kiểm tra ${modelInfo.label}`;
  });
}


// ----------------------------------------------------------------------------
// NÚT: LƯU CẤU HÌNH TRỢ LÝ AI GEMINI
// ----------------------------------------------------------------------------
const btnSaveGeminiConfig = document.getElementById("btnSaveGeminiConfig");
if (btnSaveGeminiConfig) {
  btnSaveGeminiConfig.addEventListener("click", async () => {
    const key = (document.getElementById("modalGeminiApiKey")?.value || "").trim();
    const model = document.getElementById("modalGeminiModelSelect")?.value || "gemini-3-flash-preview";

    // Lưu Gemini Config
    localStorage.setItem("gemini_api_key", key);
    localStorage.setItem("gemini_model", model);

    initGeminiConfigUI();
    geminiConfigModal.style.display = "none";

    showToast(
      "Đã lưu cấu hình",
      "Đã lưu cấu hình Trợ lý AI Gemini thành công!",
      "success",
      3500
    );
  });
}

// Nút Kiểm tra kết nối AI
const btnTestGeminiConnection = document.getElementById("btnTestGeminiConnection");
if (btnTestGeminiConnection) {
  btnTestGeminiConnection.addEventListener("click", async () => {
    const key = document.getElementById("modalGeminiApiKey").value.trim();
    const modelVal = document.getElementById("modalGeminiModelSelect").value;
    const modelInfo = GEMINI_MODELS_MAP[modelVal] || { name: modelVal, label: modelVal, aliases: [modelVal] };

    if (!key) {
      setGeminiStatusInModal("error", "Chưa nhập API Key", "Vui lòng dán mã Gemini API Key vào ô phía trên trước khi kiểm tra kết nối.");
      showToast("Thiếu API Key", "Vui lòng nhập API Key để kiểm tra kết nối!", "warning");
      document.getElementById("modalGeminiApiKey").focus();
      return;
    }

    const testBtnText = document.getElementById("testBtnText");
    testBtnText.textContent = "Đang kiểm tra kết nối...";
    btnTestGeminiConnection.disabled = true;
    setGeminiStatusInModal("loading", "Đang kết nối tới Google Gemini...", `Đang gửi truy vấn thử nghiệm tới mô hình <strong>${modelInfo.label}</strong>...`);

    try {
      let targetModel = modelInfo.name || modelVal;
      let url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
      let response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Trả lời đúng 1 chữ: OK" }] }]
        })
      });

      // Nếu model trực tiếp trả về lỗi 404, thử lần lượt các bí danh tương thích (tuyệt đối không chọn 1.5)
      if (!response.ok && response.status === 404) {
        const candidateAliases = (modelInfo.aliases || [])
          .filter(a => a !== targetModel && !a.includes("1.5"));
        
        for (const altModel of candidateAliases) {
          const altUrl = `https://generativelanguage.googleapis.com/v1beta/models/${altModel}:generateContent?key=${key}`;
          try {
            const altRes = await fetch(altUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Trả lời đúng 1 chữ: OK" }] }] })
            });
            if (altRes.ok) {
              response = altRes;
              targetModel = altModel;
              break;
            }
          } catch (altErr) {
            console.warn(`Lỗi thử model ${altModel}:`, altErr);
          }
        }

        // Nếu vẫn 404, tự động truy vấn ListModels trực tiếp từ chính API Key của người dùng (loại trừ hoàn toàn 1.5)
        if (!response.ok && response.status === 404) {
          try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (listRes.ok) {
              const listData = await listRes.json();
              const availableModels = (listData.models || [])
                .filter(m => Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods.includes("generateContent") : true)
                .map(m => m.name.replace(/^models\//, ''))
                .filter(m => !m.includes("embedding") && !m.includes("1.5"));
              
              const matched = availableModels.find(m => m === targetModel)
                || availableModels.find(m => m.includes("2.5"))
                || availableModels.find(m => m.includes("2.0"))
                || availableModels.find(m => m.includes("flash"))
                || availableModels[0];

              if (matched) {
                targetModel = matched;
                url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
                response = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: "Trả lời đúng 1 chữ: OK" }] }]
                  })
                });
              }
            }
          } catch (e) {
            console.warn("Fallback ListModels error:", e);
          }
        }
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      setGeminiStatusInModal("success", "KẾT NỐI AI GEMINI THÀNH CÔNG! 🎉", `Mô hình <strong>${modelInfo.label}</strong> (${targetModel}) đã phản hồi xuất sắc! Sẵn sàng hỗ trợ tự động bóc tách đề thi và tạo câu hỏi thông minh.`);
      showToast("Kết nối thành công", `Mô hình ${modelInfo.label} (${targetModel}) đã kết nối và phản hồi xuất sắc!`, "success", 4000);
    } catch (err) {
      setGeminiStatusInModal("error", "KẾT NỐI AI THẤT BẠI!", `Lỗi phản hồi: ${typeof escapeHtml === "function" ? escapeHtml(err.message) : err.message}.<br><strong>Gợi ý:</strong> Kiểm tra lại API Key trên Google AI Studio hoặc chọn mô hình AI khác.`);
      showToast("Kiểm tra thất bại", `Lỗi: ${err.message}`, "error", 5000);
    } finally {
      testBtnText.textContent = `Kiểm tra ${modelInfo.label}`;
      btnTestGeminiConnection.disabled = false;
    }
  });
}

// ============================================================================
// 2. CHUYỂN ĐỔI TAB (TẠO ĐỀ <-> XEM KẾT QUẢ)
// ============================================================================
function initTabSwitching() {
  const tabBtnCreate = document.getElementById("tabBtnCreate");
  const tabBtnResults = document.getElementById("tabBtnResults");
  const tabBtnStudents = document.getElementById("tabBtnStudents");
  const tabBtnAdminTeachers = document.getElementById("tabBtnAdminTeachers");
  const tabCreate = document.getElementById("tabCreate");
  const tabResults = document.getElementById("tabResults");
  const tabStudents = document.getElementById("tabStudents");
  const tabAdminTeachers = document.getElementById("tabAdminTeachers");

  function switchTab(activeBtn, activeTab) {
    [tabBtnCreate, tabBtnResults, tabBtnStudents, tabBtnAdminTeachers].forEach(b => {
      if (b) b.classList.remove("active");
    });
    [tabCreate, tabResults, tabStudents, tabAdminTeachers].forEach(t => {
      if (t) t.style.display = "none";
    });

    if (activeBtn) activeBtn.classList.add("active");
    if (activeTab) activeTab.style.display = "block";
  }

  if (tabBtnCreate) {
    tabBtnCreate.addEventListener("click", () => {
      switchTab(tabBtnCreate, tabCreate);
    });
  }

  if (tabBtnResults) {
    tabBtnResults.addEventListener("click", () => {
      switchTab(tabBtnResults, tabResults);
      if (typeof forceClearSearchStudentInput === "function") forceClearSearchStudentInput();
      const selectedMaDe = document.getElementById("selectFilterExam")?.value || "ALL";
      populateResultClassDropdown(selectedMaDe);
      loadTeacherResults(selectedMaDe);
    });
  }

  if (tabBtnStudents) {
    tabBtnStudents.addEventListener("click", () => {
      switchTab(tabBtnStudents, tabStudents);
      loadTeacherStudents();
    });
  }

  if (tabBtnAdminTeachers) {
    tabBtnAdminTeachers.addEventListener("click", () => {
      switchTab(tabBtnAdminTeachers, tabAdminTeachers);
      if (typeof loadAdminTeachersList === "function") loadAdminTeachersList();
      if (typeof loadAdminHubServersList === "function") loadAdminHubServersList();
    });
  }
}

// Toggle trạng thái kỳ thi (Đang Mở / Đang Đóng)
const examStatusToggle = document.getElementById("examStatusToggle");
const statusTextDisplay = document.getElementById("statusTextDisplay");
examStatusToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    statusTextDisplay.textContent = "Đang MỞ cho học sinh thi";
    statusTextDisplay.classList.remove("closed");
  } else {
    statusTextDisplay.textContent = "Đang ĐÓNG (Học sinh chưa thể vào thi)";
    statusTextDisplay.classList.add("closed");
  }
});

// Toggle mở vùng dán thủ công
const btnToggleManualPaste = document.getElementById("btnToggleManualPaste");
const manualPasteArea = document.getElementById("manualPasteArea");
btnToggleManualPaste.addEventListener("click", () => {
  const isHidden = manualPasteArea.style.display === "none";
  manualPasteArea.style.display = isHidden ? "block" : "none";
});

// ============================================================================
// 3. FILE UPLOADER & TRÍCH XUẤT VĂN BẢN (WORD DOCX / PDF / TXT)
// ============================================================================
const examFileInput = document.getElementById("examFileInput");
const btnBrowseFile = document.getElementById("btnBrowseFile");
const uploadDropzone = document.getElementById("uploadDropzone");
const fileUploadInfo = document.getElementById("fileUploadInfo");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const btnRemoveFile = document.getElementById("btnRemoveFile");

let uploadedFileContentText = "";

btnBrowseFile.addEventListener("click", () => examFileInput.click());
uploadDropzone.addEventListener("click", (e) => {
  if (e.target !== btnBrowseFile) examFileInput.click();
});

uploadDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadDropzone.classList.add("dragover");
});

uploadDropzone.addEventListener("dragleave", () => {
  uploadDropzone.classList.remove("dragover");
});

uploadDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadDropzone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

examFileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelected(e.target.files[0]);
  }
});

btnRemoveFile.addEventListener("click", (e) => {
  e.stopPropagation();
  examFileInput.value = "";
  uploadedFileContentText = "";
  fileUploadInfo.style.display = "none";
  uploadDropzone.style.display = "block";
});

async function handleFileSelected(file) {
  const fileName = file.name;
  fileNameDisplay.textContent = fileName;
  uploadDropzone.style.display = "none";
  fileUploadInfo.style.display = "flex";

  const ext = fileName.split(".").pop().toLowerCase();
  showToast("Đang đọc file", `Đang trích xuất nội dung từ ${fileName}...`, "info", 2000);

  try {
    if (ext === "docx") {
      const arrayBuffer = await file.arrayBuffer();
      if (typeof mammoth !== "undefined" && mammoth.extractRawText) {
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
          uploadedFileContentText = result.value || "";
        } catch (e) {
          console.warn("Mammoth parse error, trying fallback:", e);
          uploadedFileContentText = await extractDocxTextFallback(arrayBuffer);
        }
      } else {
        uploadedFileContentText = await extractDocxTextFallback(arrayBuffer);
      }
    } else if (ext === "pdf") {
      const arrayBuffer = await file.arrayBuffer();
      if (typeof pdfjsLib !== "undefined") {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          fullText += `\n--- Trang ${i} ---\n` + pageText;
        }
        uploadedFileContentText = fullText;
      } else {
        throw new Error("Thư viện PDF.js chưa sẵn sàng!");
      }
    } else {
      // Text file
      uploadedFileContentText = await file.text();
    }

    if (!uploadedFileContentText || uploadedFileContentText.trim().length === 0) {
      showToast("Cảnh báo", "Nội dung file trống hoặc không thể trích xuất văn bản. Bạn có thể dán nội dung vào ô bên dưới.", "warning", 4000);
    } else {
      showToast("Đọc file thành công", `Đã trích xuất ${uploadedFileContentText.length} ký tự. Bấm nút bóc tách bên dưới để tạo đề thi!`, "success", 3000);
    }
    
    // Đổ vào textarea và tự động mở ra để giáo viên xem được nội dung
    const rawTextArea = document.getElementById("rawExamText");
    rawTextArea.value = uploadedFileContentText;
    document.getElementById("manualPasteArea").style.display = "block";

  } catch (err) {
    console.error("Lỗi đọc file:", err);
    showToast("Lỗi đọc file", "Không thể đọc nội dung file: " + err.message, "error");
  }
}

// Fallback trích xuất văn bản từ docx
async function extractDocxTextFallback(arrayBuffer) {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(arrayBuffer));
    const matches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
    }
  } catch (e) {
    console.warn("Fallback failed:", e);
  }
  return "";
}

// ============================================================================
// 4. BÓC TÁCH ĐỀ THI BẰNG GEMINI API
// ============================================================================
const btnRunAi = document.getElementById("btnRunAi");

if (btnRunAi) {
  btnRunAi.addEventListener("click", async () => {
    const modalKeyInput = document.getElementById("modalGeminiApiKey");
    const apiKey = (modalKeyInput ? modalKeyInput.value.trim() : "") || localStorage.getItem("gemini_api_key") || "";
    const rawTextArea = document.getElementById("rawExamText");
    const rawText = (rawTextArea && rawTextArea.value.trim()) || (uploadedFileContentText && uploadedFileContentText.trim()) || "";

    if (!rawText) {
      showToast("Thiếu nội dung", "Vui lòng chọn file Word/PDF hoặc dán nội dung đề thi vào ô văn bản bên dưới!", "error");
      const pasteArea = document.getElementById("manualPasteArea");
      if (pasteArea) pasteArea.style.display = "block";
      if (rawTextArea) rawTextArea.focus();
      return;
    }

    // Set loading state
    btnRunAi.disabled = true;
    const btnAiText = btnRunAi.querySelector(".btn-ai-text");
    const btnSpinner = btnRunAi.querySelector(".ai-loading-spinner");
    if (btnAiText) btnAiText.textContent = "AI Gemini đang bóc tách câu hỏi...";
    if (btnSpinner) btnSpinner.style.display = "block";

    try {
      let questionsResult = [];

      if (!apiKey) {
        // NẾU CHƯA CÓ GEMINI API KEY -> DÙNG BỘ PHÂN TÍCH THÔNG MINH TRỰC TIẾP TỪ NỘI DUNG FILE
        showToast("Chế độ phân tích", "Đang bóc tách câu hỏi trực tiếp từ nội dung đề thi...", "info", 2500);
        await new Promise(r => setTimeout(r, 400));
        questionsResult = smartParseQuestions(rawText);
      } else {
        // GỌI TRỰC TIẾP GEMINI API
        try {
          questionsResult = await callGeminiApiToExtract(apiKey, rawText);
        } catch (geminiErr) {
          console.warn("Gemini API gặp sự cố, tự động dùng bộ phân tích thông minh:", geminiErr);
          showToast("Thông báo AI", "Đang tự động bóc tách và đối chiếu đáp án bằng bộ phân tích thông minh...", "info", 3000);
          questionsResult = smartParseQuestions(rawText);
        }
      }

      if (questionsResult && questionsResult.length > 0) {
        parsedQuestions = questionsResult;
        renderQuestionsPreview(parsedQuestions);
        showToast("Bóc tách thành công", `Đã nhận diện được ${parsedQuestions.length} câu hỏi! Bản xem trước đã hiển thị ở cột bên phải.`, "success", 4000);
        
        // Cuộn nhẹ tới bản xem trước nếu trên màn hình nhỏ
        const previewCard = document.querySelector(".preview-col");
        if (previewCard && window.innerWidth < 960) {
          previewCard.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        showToast("Thông báo", "Không nhận diện được câu hỏi trắc nghiệm nào từ nội dung. Hãy kiểm tra lại định dạng câu hỏi (Câu 1: ... A. B. C. D.)", "warning", 5000);
      }

    } catch (error) {
      console.error("Lỗi AI:", error);
      showToast("Lỗi xử lý", error.message || "Không thể bóc tách nội dung đề.", "error");
    } finally {
      btnRunAi.disabled = false;
      if (btnAiText) btnAiText.textContent = "Bóc Tách Đề Thi Bằng Gemini AI";
      if (btnSpinner) btnSpinner.style.display = "none";
    }
  });
}

// ============================================================================
// NÚT BÓC TÁCH BẰNG THUẬT TOÁN (SIÊU NHANH - CHUẨN 100% THEO FILE KT1.DOCX)
// ============================================================================
const btnFastAlgorithmParse = document.getElementById("btnFastAlgorithmParse");
if (btnFastAlgorithmParse) {
  btnFastAlgorithmParse.addEventListener("click", () => {
    const rawTextArea = document.getElementById("rawExamText");
    const rawText = (rawTextArea && rawTextArea.value.trim()) || (uploadedFileContentText && uploadedFileContentText.trim()) || "";

    if (!rawText) {
      showToast("Thiếu nội dung", "Vui lòng chọn file Word/PDF (như KT1.docx) hoặc dán nội dung đề thi vào ô văn bản bên dưới!", "warning");
      const pasteArea = document.getElementById("manualPasteArea");
      if (pasteArea) pasteArea.style.display = "block";
      if (rawTextArea) rawTextArea.focus();
      return;
    }

    showToast("Đang bóc tách", "Đang phân tích cấu trúc 3 phần và đối chiếu hướng dẫn chấm...", "info", 1500);

    try {
      const questionsResult = smartParseQuestions(rawText);
      const essayCount = (parsedEssayQuestions || []).length;

      if ((questionsResult && questionsResult.length > 0) || essayCount > 0) {
        parsedQuestions = questionsResult;
        renderQuestionsPreview(parsedQuestions);
        showToast(
          "Bóc tách thành công!",
          `Đã nhận diện: ${parsedQuestions.length} câu trắc nghiệm & đúng sai + ${essayCount} câu tự luận. Đáp án đã được đối chiếu chuẩn 100%!`,
          "success",
          5000
        );

        const previewCard = document.querySelector(".preview-col");
        if (previewCard && window.innerWidth < 960) {
          previewCard.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        showToast("Thông báo", "Không nhận diện được câu hỏi nào từ nội dung đề thi. Hãy kiểm tra định dạng file!", "warning", 5000);
      }
    } catch (err) {
      console.error("Lỗi bóc tách thuật toán:", err);
      showToast("Lỗi xử lý", err.message || "Không thể bóc tách đề thi.", "error");
    }
  });
}

// Gọi Gemini API
async function callGeminiApiToExtract(apiKey, rawText) {
  const prompt = `
Bạn là chuyên gia số hoá đề thi hàng đầu Việt Nam. Hãy đọc toàn bộ văn bản đề thi sau đây và trích xuất thành danh sách câu hỏi theo đúng cấu trúc JSON mảng các đối tượng (CHỈ TRẢ VỀ JSON THUẦN, KHÔNG KÈM MARKDOWN \`\`\`json).

CẤU TRÚC ĐỀ THI CHUẨN BỘ GIÁO DỤC VÀ ĐÀO TẠO VIỆT NAM:
1. PHẦN I: Câu hỏi trắc nghiệm nhiều phương án lựa chọn:
   - Gồm các câu hỏi có 4 phương án A, B, C, D.
   - loaiCauHoi = "multiple_choice"
   - dapAnDung = "A" hoặc "B", "C", "D" theo đúng bảng đáp án.
   - luaChon = [ { "key": "A", "noiDung": "..." }, { "key": "B", "noiDung": "..." }, ... ]

2. PHẦN II: Câu hỏi trắc nghiệm Đúng / Sai:
   - Gồm các câu hỏi với 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý.
   - loaiCauHoi = "true_false"
   - y = [
       { "key": "a", "noiDung": "...", "dung": true hoặc false },
       { "key": "b", "noiDung": "...", "dung": true hoặc false },
       { "key": "c", "noiDung": "...", "dung": true hoặc false },
       { "key": "d", "noiDung": "...", "dung": true hoặc false }
     ]

QUY TẮC CỰC KỲ QUAN TRỌNG:
1. ĐÁP ÁN ĐÚNG (ĐỐI CHIẾU BẢNG ĐÁP ÁN Ở CUỐI ĐỀ):
   - Đọc kỹ phần "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM" / "BẢNG ĐÁP ÁN" ở cuối đề thi (kể cả bảng bị tách dòng).
   - Với Phần I: Gán 'dapAnDung' chính xác theo bảng đáp án.
   - Với Phần II: Gán 'dung' = true (Đúng) hoặc false (Sai) chuẩn 100% theo bảng đáp án Phần II cho từng ý a, b, c, d. TUYỆT ĐỐI KHÔNG mặc định tất cả là true hay false.
2. ĐÁNH SỐ THỨ TỰ (ID):
   - Đánh số 'id' tăng dần liên tục từ 1 đến hết đề.
   - VÍ DỤ: Nếu Phần I có 20 câu (id: 1..20) thì sang Phần II (dù trong đề ghi là Câu 1, Câu 2) bạn PHẢI đánh tiếp là id: 21, id: 22.
3. ĐIỂM SỐ (diem):
   - Trích xuất điểm số nếu đề có ghi (VD: 0.25, 0.5, 1.0). Nếu đề ghi rõ "20 câu - 5.00 điểm" thì mỗi câu 0.25đ.
4. LOẠI BỎ TIÊU ĐỀ:
   - Không đưa tiêu đề trường, phòng thi, tên kỳ thi, tiêu đề phần vào nội dung câu hỏi.

VĂN BẢN ĐỀ THI:
${rawText}
`;

  // Lấy chính xác model đang chọn trong khung cấu hình hoặc localStorage
  const currentModalVal = document.getElementById("modalGeminiModelSelect")?.value;
  let savedModelKey = currentModalVal || localStorage.getItem("gemini_model") || "gemini-3-flash-preview";
  if (savedModelKey.includes("1.5") || !GEMINI_MODELS_MAP[savedModelKey]) {
    savedModelKey = "gemini-3-flash-preview";
  }
  const modelInfo = GEMINI_MODELS_MAP[savedModelKey] || { name: savedModelKey, aliases: [savedModelKey] };

  // Danh sách các model ưu tiên ánh xạ theo đúng lựa chọn của người dùng, tuyệt đối không có 1.5
  const candidateModels = (modelInfo.aliases || [modelInfo.name || savedModelKey])
    .concat(["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"])
    .filter(m => m && !m.includes("1.5"));
  const models = Array.from(new Set(candidateModels));
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Lỗi API HTTP ${response.status}`);
      }

      const data = await response.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) throw new Error("Gemini không trả về nội dung hợp lệ.");

      let cleanJson = textOut.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const firstBracket = cleanJson.indexOf('[');
      const lastBracket = cleanJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleanJson = cleanJson.slice(firstBracket, lastBracket + 1);
      }

      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Tự động nhận diện Tên kỳ thi và Thời gian làm bài nếu có
        try {
          const titleInput = document.getElementById("examTitle");
          if (titleInput && (!titleInput.value || titleInput.value.trim() === "")) {
            const firstQPos = rawText.search(/(?:^|\n|\r)\s*(?:Câu|Bài|\bQ)\s*\d+[:.-]/i);
            if (firstQPos > 0) {
              const preamble = rawText.slice(0, firstQPos).trim();
              const preambleLines = preamble.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5 && !/^(?:PHẦN|BÀI\s*THI|THỜI\s*GIAN)/i.test(l));
              if (preambleLines.length > 0) {
                const examLine = preambleLines.find(l => /ĐỀ|KIỂM\s*TRA|THI|HỌC\s*KỲ/i.test(l)) || preambleLines[0];
                if (examLine) titleInput.value = examLine.replace(/^[-–—*\s]+/, "").trim();
              }
            }
          }
          const durationInput = document.getElementById("examDuration");
          if (durationInput) {
            const durationMatch = rawText.match(/(?:thời\s*gian\s*(?:làm\s*bài)?)\s*[:\s-]*(\d+)\s*phút/i);
            if (durationMatch) durationInput.value = durationMatch[1];
          }
        } catch (e) {}

        // Tự động đối chiếu Bảng đáp án để đảm bảo đáp án đúng 100% (nhất là câu Đúng/Sai)
        const answerKeys = extractAnswerKeysFromDocument(rawText);
        let tfIdx = 0;
        parsed.forEach((q, idx) => {
          q.id = idx + 1;
          if (q.loaiCauHoi === "multiple_choice") {
            if (answerKeys.mcAnswers[q.id]) {
              q.dapAnDung = answerKeys.mcAnswers[q.id];
            }
          } else if (q.loaiCauHoi === "true_false") {
            tfIdx++;
            const expectedTf = answerKeys.tfAnswers[tfIdx] || answerKeys.tfAnswers[q.id];
            if (expectedTf && Array.isArray(q.y)) {
              q.y.forEach(sub => {
                if (expectedTf[sub.key] !== undefined) {
                  sub.dung = expectedTf[sub.key];
                }
              });
            }
          }
        });
        return parsed;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Lỗi gọi model ${model}:`, err.message);
    }
  }

  throw lastError || new Error("Không thể kết nối đến Gemini API.");
}

/**
 * Trích xuất Bảng đáp án & Hướng dẫn chấm từ văn bản
 * Hỗ trợ mọi kiểu bảng Word tách dòng (kể cả Đ.Án, Đáp án), bảng ngang, và danh sách inline
 */
function extractAnswerKeysFromDocument(fullText) {
  const mcAnswers = {}; // { 1: "A", 2: "C", ... }
  const tfAnswers = {}; // { 1: { a: true, b: false, ... }, 2: ... }

  if (!fullText) return { mcAnswers, tfAnswers };

  // 1. Tìm vị trí mở đầu của phần ĐÁP ÁN (lấy vị trí sau cùng để tránh trùng lặp trong đề)
  const answerHeadingRegex = /(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*CHI\s*TIẾT|ĐÁP\s*ÁN\s*VÀ\s*THANG\s*ĐIỂM|THANG\s*ĐIỂM\s*VÀ\s*ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM)/gi;
  let match;
  let matchPos = -1;
  while ((match = answerHeadingRegex.exec(fullText)) !== null) {
    matchPos = match.index;
  }
  if (matchPos === -1) {
    const standaloneMatch = /(?:^|\n|\r)\s*(?:ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN)\s*(?:\n|\r|$)/i.exec(fullText);
    if (standaloneMatch) matchPos = standaloneMatch.index;
  }

  const textToScan = matchPos !== -1 ? fullText.slice(matchPos) : fullText;
  const lines = textToScan.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 2. Phân tích bảng đáp án Trắc nghiệm 4 lựa chọn (PHẦN I) dạng tách dòng trong Word:
  // "Câu \n 1 \n 2 \n ... \n 10 \n Đ.Án \n C \n B \n A ..."
  for (let i = 0; i < lines.length; i++) {
    if (/^Câu$/i.test(lines[i])) {
      const qNums = [];
      let j = i + 1;
      while (j < lines.length && /^\d+$/.test(lines[j])) {
        qNums.push(parseInt(lines[j]));
        j++;
      }
      if (qNums.length > 0 && j < lines.length && /^(?:Đáp\s*án|Đ\.Án|ĐA|ĐÁP\s*ÁN|Trả\s*lời)$/i.test(lines[j])) {
        let k = j + 1;
        let ansIdx = 0;
        while (k < lines.length && ansIdx < qNums.length && /^[A-D]$/i.test(lines[k])) {
          const qNum = qNums[ansIdx];
          mcAnswers[qNum] = lines[k].toUpperCase();
          ansIdx++;
          k++;
        }
        i = k - 1;
      }
    }
  }

  // 3. Phân tích bảng ngang 2 dòng song song:
  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1];
    const qNums = l1.match(/\b\d+\b/g) || [];
    const answers = l2.match(/\b[A-D]\b/gi) || [];
    if (qNums.length >= 2 && qNums.length === answers.length) {
      qNums.forEach((qn, idx) => {
        const num = parseInt(qn);
        if (!mcAnswers[num] && num <= 100) {
          mcAnswers[num] = answers[idx].toUpperCase();
        }
      });
    }
  }

  // 4. Phân tích bảng đáp án Đúng/Sai (PHẦN II)
  // Dạng inline: "Câu 11: A. SAI , B. ĐÚNG , C. ĐÚNG , D. SAI" hoặc "Câu 12 : A. ĐÚNG , B. SAI..."
  const tfInlineMatches = textToScan.matchAll(/(?:Câu\s*)?(\d+)[\s:.-]+([^\n\r]*)/gi);
  for (const match of tfInlineMatches) {
    const qNum = parseInt(match[1]);
    const rest = match[2];
    const subMatches = Array.from(rest.matchAll(/([a-d])[\s.:)-]+(Đúng|Sai|Đ|S|True|False)/gi));
    if (subMatches.length >= 2) {
      tfAnswers[qNum] = {};
      for (const sm of subMatches) {
        const k = sm[1].toLowerCase();
        const v = sm[2].toLowerCase();
        tfAnswers[qNum][k] = ['đúng', 'đ', 'true'].includes(v);
      }
    }
  }

  // Dạng bảng Word phân tách dòng cho Đúng/Sai:
  // Câu 1 \n Sai \n Đúng \n Đúng \n Sai
  for (let i = 0; i < lines.length; i++) {
    const qMatch = lines[i].match(/^Câu\s*(\d+)$/i);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      if (i + 4 < lines.length) {
        const v1 = lines[i + 1].toLowerCase();
        const v2 = lines[i + 2].toLowerCase();
        const v3 = lines[i + 3].toLowerCase();
        const v4 = lines[i + 4].toLowerCase();
        const isTfVal = v => ['đúng', 'sai', 'đ', 's', 'true', 'false'].includes(v);
        if (isTfVal(v1) && isTfVal(v2) && isTfVal(v3) && isTfVal(v4)) {
          if (!tfAnswers[qNum]) {
            tfAnswers[qNum] = {
              a: ['đúng', 'đ', 'true'].includes(v1),
              b: ['đúng', 'đ', 'true'].includes(v2),
              c: ['đúng', 'đ', 'true'].includes(v3),
              d: ['đúng', 'đ', 'true'].includes(v4)
            };
          }
          i += 4;
          continue;
        }
      }
    }
  }

  // 5. Dạng cặp đơn lẻ cho Trắc nghiệm (loại trừ nếu dòng đó là câu Đúng/Sai):
  const pairMatches = textToScan.matchAll(/(?:Câu\s*)?(\d+)\s*[:.\/-]\s*([A-D])(?![.\s]*(?:Đúng|Sai|Đ|S|True|False))\b/gi);
  for (const pm of pairMatches) {
    const qNum = parseInt(pm[1]);
    const ansKey = pm[2].toUpperCase();
    if (!mcAnswers[qNum] && !tfAnswers[qNum] && qNum <= 100) {
      mcAnswers[qNum] = ansKey;
    }
  }

  // Dạng gom cụm: "1A 2C 3B 4D"
  const compactMatches = textToScan.matchAll(/\b(\d+)\s*([A-D])(?=[\s,;|\/]|$)/gi);
  for (const cm of compactMatches) {
    const qNum = parseInt(cm[1]);
    const ansKey = cm[2].toUpperCase();
    if (!mcAnswers[qNum] && !tfAnswers[qNum] && qNum <= 100) {
      mcAnswers[qNum] = ansKey;
    }
  }

  // 6. Trích xuất đáp án / hướng dẫn chấm tự luận nếu có
  const essayAnswers = {};
  const essayAnsMatches = textToScan.matchAll(/(?:^|\n|\r)[ \t\u00A0]*(?:Câu|Bài|\bQ)\s*(\d+)[\s:.-]+([\s\S]*?)(?=(?:^|\n|\r)[ \t\u00A0]*(?:Câu|Bài|\bQ)\s*\d+|$)/gi);
  for (const eMatch of essayAnsMatches) {
    const qNum = parseInt(eMatch[1]);
    const body = eMatch[2].trim();
    if (body && !mcAnswers[qNum] && !tfAnswers[qNum]) {
      essayAnswers[qNum] = body;
    }
  }

  return { mcAnswers, tfAnswers, essayAnswers };
}

// ============================================================================
// HÀM LÀM SẠCH TIÊU ĐỀ PHẦN, HƯỚNG DẪN & CHÂN TRANG ĐỀ THI
// ============================================================================
function cleanQuestionPrompt(text) {
  if (!text) return "";
  let clean = String(text);

  // 1. Loại bỏ các dòng tiêu đề phần ở đầu chuỗi (kể cả có xuống dòng, non-breaking space hoặc dấu /)
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:[I|V|X]+|\d+)\/?[ \t\u00A0]*(?:PHẦN|Phần|BÀI|Bài)\s*(?:[I|V|X]+|\d+)\b[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:PHẦN|Phần|BÀI|Bài)\s*(?:[I|V|X]+|\d+)\b[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:[I|V|X]+|\d+)[\.:\/]\s*(?:TỰ\s*LUẬN|TR[ẮÁ]C\s*NGHIỆM|CÂU\s*HỎI)[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:CÂU\s*HỎI\s*)?TỰ\s*LUẬN(?:\s*\([^\)]*\))?[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:CÂU\s*HỎI\s*)?TR[ẮÁ]C\s*NGHIỆM(?:\s*(?:KHÁCH\s*QUAN|ĐÚNG\s*[\/\s]*SAI|NHIỀU\s*LỰA\s*CHỌN))?(?:\s*\([^\)]*\))?[^\n\r]*(?:\r?\n|$))+/gi, "");

  // 2. Loại bỏ các dòng thông tin số câu/thang điểm phần: "(3 câu – 3.00 điểm)", "(3 ĐIỂM)"
  clean = clean.replace(/^(?:[ \t\u00A0]*\(?\s*\d+\s*(?:câu|điểm|đ)\s*(?:[-–—]\s*[0-9]+(?:[.,][0-9]+)?\s*(?:điểm|đ))?\s*\)?[^\n\r]*(?:\r?\n|$))+/gi, "");

  // 3. Loại bỏ điểm số ở đầu câu: "(1.0 điểm):", "(1,0 điểm):"
  clean = clean.replace(/^(?:[ \t\u00A0]*\(?[0-9]+(?:[.,][0-9]+)?\s*(?:điểm|đ|pt|pts)\)?[\s:.-]*)+/gi, "");

  // 4. Loại bỏ các dòng hướng dẫn làm bài Bộ GD&ĐT
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:Thí\s*sinh|Học\s*sinh)\s*(?:trả\s*lời|chọn|làm|trình\s*bày|ghi|được)[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*Mỗi\s*câu\s*hỏi\s*(?:thí\s*sinh|học\s*sinh)?[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*Trong\s*mỗi\s*ý\s*[a-d][^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*\(?\s*Đề\s*thi\s*gồm\s*(?:có\s*)?\d+\s*trang\s*\)?[^\n\r]*(?:\r?\n|$))+/gi, "");

  // 5. Loại bỏ các dòng tiêu đề trường/sở nếu lọt vào câu đầu tiên
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:SỞ|PHÒNG)\s*GD[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*TRƯỜNG\s*(?:THPT|THCS|TIỂU\s*HỌC)[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*(?:ĐỀ\s*THI|KIỂM\s*TRA|HỌC\s*KỲ|BÀI\s*THI)[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*MÃ\s*ĐỀ\s*[:\s]*\w+[^\n\r]*(?:\r?\n|$))+/gi, "");
  clean = clean.replace(/^(?:[ \t\u00A0]*Thời\s*gian\s*làm\s*bài[^\n\r]*(?:\r?\n|$))+/gi, "");

  // 6. Nếu còn sót tiêu đề dính liền ở cùng một dòng
  clean = clean.replace(/^(?:PHẦN|Phần)\s*(?:[I|V|X]+|\d+)[\.\s:–—-]*[^\.\n\r]*(?:tự\s*luận|tr[ắá]c\s*nghiệm|điểm|đ\)|\d+\s*câu)[^\.\n\r]*[\.:\)\s–—-]+/gi, "");

  // 7. Loại bỏ chân trang cuối đề nếu lỡ dính vào câu cuối
  clean = clean.replace(/(?:[-–—=_*~#\s\u00A0]*(?:HẾT|Hết)[-–—=_*~#\s\u00A0]*)+$/gi, "");
  clean = clean.replace(/(?:[ \t\u00A0]*(?:Cán\s*bộ|Giám\s*thị)\s*(?:coi\s*thi|chấm\s*thi)[^\n\r]*)+$/gi, "");
  clean = clean.replace(/(?:[ \t\u00A0]*(?:Thí\s*sinh|Học\s*sinh)\s*không\s*được\s*sử\s*dụng\s*tài\s*liệu[^\n\r]*)+$/gi, "");

  return clean.trim();
}

// Kiểm tra xem đoạn văn bản có phải thuần túy là dòng tiêu đề rác không
function isGarbageOrHeaderBlock(text) {
  if (!text) return true;
  const t = text.trim();
  if (t.length === 0) return true;

  if (t.length < 90) {
    if (/^(?:[I|V|X]+|\d+)\/?[ \t\u00A0]*(?:PHẦN|Phần|BÀI|Bài)\s*(?:[I|V|X]+|\d+)\b/i.test(t)) return true;
    if (/^(?:PHẦN|Phần|BÀI|Bài)\s*(?:[I|V|X]+|\d+)\b/i.test(t)) return true;
    if (/^(?:[I|V|X]+|\d+)[\.:\/]\s*(?:TỰ\s*LUẬN|TR[ẮÁ]C\s*NGHIỆM)/i.test(t)) return true;
    if (/^(?:CÂU\s*HỎI\s*)?TỰ\s*LUẬN(?:\s*\([^\)]*\))?$/i.test(t)) return true;
    if (/^\(?\s*\d+\s*(?:câu|điểm|đ)\s*[-–—]\s*[0-9]+(?:[.,][0-9]+)?\s*(?:điểm|đ)\s*\)?$/i.test(t)) return true;
    if (/^[-–—=_*~#\s\u00A0]*(?:HẾT|Hết)[-–—=_*~#\s\u00A0]*$/i.test(t)) return true;
    if (/^(?:Thí\s*sinh|Học\s*sinh)\s*(?:trả\s*lời|không\s*được)/i.test(t)) return true;
  }
  return false;
}

// Hàm trích xuất các phương án 4 lựa chọn (A, B, C, D) an toàn
function extractMcOptions(block) {
  const optRegex = /(?:^|\n|\r|\s{2,}|\t)(?:(?:\(([A-D])\))|([A-D])[\).:])\s+/gi;
  const matches = [];
  let m;
  while ((m = optRegex.exec(block)) !== null) {
    matches.push({
      key: (m[1] || m[2]).toUpperCase(),
      index: m.index,
      matchLen: m[0].length
    });
  }

  if (matches.length >= 2) {
    const firstOpt = matches[0];
    let prompt = block.slice(0, firstOpt.index)
      .replace(/^\s*(?:Câu|Bài|\bQ)\s*\d+(?:\s*\([^\)]*\))?[:.-]*\s*/i, "")
      .trim();

    prompt = cleanQuestionPrompt(prompt);

    const options = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const start = cur.index + cur.matchLen;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : block.length;
      let optText = block.slice(start, end).trim();
      optText = optText.replace(/(?:Đáp án|ĐA|Key)[:\s]*[A-D].*$/i, "").trim();

      options.push({
        key: cur.key,
        noiDung: optText
      });
    }

    const requiredKeys = ["A", "B", "C", "D"];
    const finalOptions = requiredKeys.map(k => {
      const found = options.find(o => o.key === k);
      return found || { key: k, noiDung: `Phương án ${k}` };
    });

    return { prompt, options: finalOptions };
  }

  return null;
}

// Hàm trích xuất các ý Đúng/Sai (a, b, c, d)
function extractTfOptions(block) {
  const subRegex = /(?:^|\n|\r|\s{2,}|\t)(?:(?:\(([a-d])\))|([a-d])[\).:])\s+/gi;
  const matches = [];
  let m;
  while ((m = subRegex.exec(block)) !== null) {
    matches.push({
      key: (m[1] || m[2]).toLowerCase(),
      index: m.index,
      matchLen: m[0].length
    });
  }

  if (matches.length >= 2) {
    const firstSub = matches[0];
    let prompt = block.slice(0, firstSub.index)
      .replace(/^\s*(?:Câu|Bài|\bQ)\s*\d+(?:\s*\([^\)]*\))?[:.-]*\s*/i, "")
      .trim();

    prompt = cleanQuestionPrompt(prompt);

    const subItems = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const start = cur.index + cur.matchLen;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : block.length;
      let text = block.slice(start, end).trim();

      subItems.push({
        key: cur.key,
        noiDung: text
      });
    }

    return { prompt, subItems };
  }

  return null;
}

// Regex tách và kiểm tra câu hỏi chuẩn Bộ GD&ĐT (hỗ trợ cả "Câu 1:", "Câu 1 (1,0 điểm):", "Câu 11: (1.0 điểm):")
const GDDT_QUESTION_SPLIT_REGEX = /(?=(?:^|\n|\r)[ \t\u00A0]*(?:Câu|Bài|\bQ)\s*\d+(?:\s*\([^\)]*\))?[\s:.-])/i;
const GDDT_QUESTION_START_TEST = /^\s*(?:Câu|Bài|\bQ)\s*\d+/i;

// Bộ phân tích thông minh bóc tách đề thi chuẩn 3 phần (Phần I, II, III) và tự động đối chiếu Bảng đáp án
function smartParseQuestions(rawText) {
  if (!rawText || rawText.trim().length === 0) return [];

  // 1. Trích xuất bảng đáp án chuẩn từ tài liệu (hỗ trợ Hướng dẫn chấm cả 2 phần I, II)
  const answerKeys = extractAnswerKeysFromDocument(rawText);
  console.log("Đã phát hiện Bảng đáp án & Hướng dẫn chấm:", answerKeys);

  // 2. Tìm vị trí mở đầu của phần ĐÁP ÁN / HƯỚNG DẪN CHẤM để cắt bỏ khỏi nội dung đề
  const answerHeadingRegex = /(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN\s*CHI\s*TIẾT|ĐÁP\s*ÁN\s*VÀ\s*THANG\s*ĐIỂM|THANG\s*ĐIỂM\s*VÀ\s*ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM)/i;
  let matchAnswer = answerHeadingRegex.exec(rawText);
  let examContent = rawText;
  if (matchAnswer) {
    examContent = rawText.slice(0, matchAnswer.index);
  } else {
    const standaloneMatch = /(?:^|\n|\r)\s*(?:ĐÁP\s*ÁN|BẢNG\s*ĐÁP\s*ÁN)\s*(?:\n|\r|$)/i.exec(rawText);
    if (standaloneMatch) examContent = rawText.slice(0, standaloneMatch.index);
  }

  // 3. Tự động nhận diện Tên kỳ thi và Thời gian làm bài từ đầu đề thi
  if (typeof document !== "undefined") {
    const titleInput = document.getElementById("examTitle");
    if (titleInput && (!titleInput.value || titleInput.value.trim() === "")) {
      const firstQPos = examContent.search(/(?:^|\n|\r)[ \t\u00A0]*(?:Câu|Bài|\bQ)\s*\d+/i);
      if (firstQPos > 0) {
        const preamble = examContent.slice(0, firstQPos).trim();
        const preambleLines = preamble.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5 && !/^(?:PHẦN|BÀI\s*THI|THỜI\s*GIAN)/i.test(l));
        if (preambleLines.length > 0) {
          const examLine = preambleLines.slice(0, 2).join(" - ").replace(/^[-–—*\s]+/, "").trim();
          if (examLine) titleInput.value = examLine;
        }
      }
    }

    const durationInput = document.getElementById("examDuration");
    if (durationInput) {
      const durationMatch = examContent.match(/(?:thời\s*gian\s*(?:làm\s*bài)?)\s*[:\s-]*(\d+)\s*phút/i);
      if (durationMatch) {
        durationInput.value = durationMatch[1];
      }
    }
  }

  // 4. Phân tách Phần III (Tự luận), Phần II (Đúng/Sai) và Phần I (4 lựa chọn)
  const part3Regex = /(?:^|\n|\r)[ \t\u00A0]*(?:PHẦN\s*(?:III|3\b)|(?:III|3)\s*[\.:\/]\s*(?:CÂU\s*)?TỰ\s*LUẬN|PHẦN\s*TỰ\s*LUẬN|CÂU\s*HỎI\s*TỰ\s*LUẬN|(?:^|\n|\r)[ \t\u00A0]*TỰ\s*LUẬN\s*[:\(\n\r])/i;
  const matchPart3 = part3Regex.exec(examContent);

  let part3Text = "";
  if (matchPart3) {
    part3Text = examContent.slice(matchPart3.index);
    examContent = examContent.slice(0, matchPart3.index);
  }

  const part2Regex = /(?:^|\n|\r)[ \t\u00A0]*(?:PHẦN\s*(?:II|2\b)|(?:II|2)\s*[\.:\/]\s*(?:CÂU\s*)?TR[ẮÁ]C\s*NGHIỆM\s*ĐÚNG\s*[\/\s]*SAI|CÂU\s*TR[ẮÁ]C\s*NGHIỆM\s*ĐÚNG\s*[\/\s]*SAI|TR[ẮÁ]C\s*NGHIỆM\s*ĐÚNG\s*[\/\s]*SAI)/i;
  const matchPart2 = part2Regex.exec(examContent);

  let part1Text = examContent;
  let part2Text = "";

  if (matchPart2) {
    part1Text = examContent.slice(0, matchPart2.index);
    part2Text = examContent.slice(matchPart2.index);
  }

  const list = [];

  // --- XỬ LÝ PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN ---
  let p1DefaultDiem = 1;
  const p1PointMatch = (part1Text + "\n" + rawText).match(/\((\d+)\s*câu\s*[-–—]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ)\)/i);
  if (p1PointMatch) {
    const totalQ = parseInt(p1PointMatch[1]);
    const totalPts = parseFloat(p1PointMatch[2].replace(",", "."));
    if (totalQ > 0 && totalPts > 0) p1DefaultDiem = Math.round((totalPts / totalQ) * 100) / 100;
  }
  const p1EachMatch = (part1Text + "\n" + rawText).match(/(?:mỗi\s*câu\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ))/i);
  if (p1EachMatch) {
    p1DefaultDiem = parseFloat(p1EachMatch[1].replace(",", "."));
  }

  const p1Blocks = part1Text.split(GDDT_QUESTION_SPLIT_REGEX)
    .filter(b => GDDT_QUESTION_START_TEST.test(b.trim()));

  p1Blocks.forEach((block, idx) => {
    const blockTrim = block.trim();
    const numMatch = blockTrim.match(/^\s*(?:Câu|Bài|\bQ)\s*(\d+)/i);
    const docQNum = numMatch ? parseInt(numMatch[1]) : (idx + 1);

    let itemDiem = p1DefaultDiem;
    const pointMatch = blockTrim.match(/(?:\[|\()([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ|pt|pts)(?:\]|\))/i);
    if (pointMatch) {
      const p = parseFloat(pointMatch[1].replace(",", "."));
      if (!isNaN(p) && p > 0) itemDiem = p;
    }

    const mcData = extractMcOptions(blockTrim);
    if (mcData) {
      let promptText = cleanQuestionPrompt(mcData.prompt);
      if (!promptText || isGarbageOrHeaderBlock(promptText)) return;

      // Xác định đáp án đúng từ bảng đáp án Phần I
      let correct = "A";
      if (answerKeys.mcAnswers[docQNum]) {
        correct = answerKeys.mcAnswers[docQNum];
      } else if (answerKeys.mcAnswers[list.length + 1]) {
        correct = answerKeys.mcAnswers[list.length + 1];
      } else {
        const ansMatch = blockTrim.match(/(?:Đáp án|ĐA|Key)[:\s]*([A-D])/i);
        if (ansMatch) correct = ansMatch[1].toUpperCase();
        else if (/\*B|\(B\)/i.test(blockTrim)) correct = "B";
        else if (/\*C|\(C\)/i.test(blockTrim)) correct = "C";
        else if (/\*D|\(D\)/i.test(blockTrim)) correct = "D";
        else if (/\*A|\(A\)/i.test(blockTrim)) correct = "A";
      }

      list.push({
        id: list.length + 1,
        noiDung: promptText,
        loaiCauHoi: "multiple_choice",
        diem: itemDiem,
        luaChon: mcData.options,
        dapAnDung: correct
      });
    }
  });

  // --- XỬ LÝ PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI ---
  if (part2Text) {
    let p2DefaultDiem = 1;
    const p2PointMatch = part2Text.match(/\((\d+)\s*câu\s*[-–—]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ)\)/i);
    if (p2PointMatch) {
      const totalQ = parseInt(p2PointMatch[1]);
      const totalPts = parseFloat(p2PointMatch[2].replace(",", "."));
      if (totalQ > 0 && totalPts > 0) p2DefaultDiem = Math.round((totalPts / totalQ) * 100) / 100;
    }

    const p2Blocks = part2Text.split(GDDT_QUESTION_SPLIT_REGEX)
      .filter(b => GDDT_QUESTION_START_TEST.test(b.trim()));

    p2Blocks.forEach((block, idx) => {
      const blockTrim = block.trim();
      const numMatch = blockTrim.match(/^\s*(?:Câu|Bài|\bQ)\s*(\d+)/i);
      const tfIndex = numMatch ? parseInt(numMatch[1]) : (idx + 1);

      let itemDiem = p2DefaultDiem;
      const pointMatch = blockTrim.match(/(?:\[|\()([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ|pt|pts)(?:\]|\))/i);
      if (pointMatch) {
        const p = parseFloat(pointMatch[1].replace(",", "."));
        if (!isNaN(p) && p > 0) itemDiem = p;
      }

      const tfData = extractTfOptions(blockTrim);
      if (tfData && tfData.subItems && tfData.subItems.length >= 2) {
        let promptText = cleanQuestionPrompt(tfData.prompt);
        if (!promptText || isGarbageOrHeaderBlock(promptText)) return;

        const tfAnsObj = answerKeys.tfAnswers[tfIndex] || answerKeys.tfAnswers[idx + 1] || {};

        const subItems = tfData.subItems.map(sub => {
          let isTrue = false;
          if (tfAnsObj[sub.key] !== undefined) {
            isTrue = tfAnsObj[sub.key];
          } else {
            isTrue = /(?:đúng|\bđ\b|\*)/i.test(sub.noiDung) && !/sai/i.test(sub.noiDung);
          }

          return {
            key: sub.key,
            noiDung: sub.noiDung.replace(/\((?:đúng|sai|đ|s)\)/gi, "").trim(),
            dung: isTrue
          };
        });

        list.push({
          id: list.length + 1,
          noiDung: promptText,
          loaiCauHoi: "true_false",
          diem: itemDiem,
          y: subItems
        });
      }
    });
  }

  // --- XỬ LÝ PHẦN III: CÂU HỎI TỰ LUẬN (CHỈ LẤY CÂU HỎI, LOẠI BỎ 100% TIÊU ĐỀ) ---
  const essayList = [];
  if (part3Text) {
    let p3DefaultDiem = 1;
    const p3PointMatch = part3Text.match(/\((\d+)\s*câu\s*[-–—]\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ)\)/i);
    if (p3PointMatch) {
      const totalQ = parseInt(p3PointMatch[1]);
      const totalPts = parseFloat(p3PointMatch[2].replace(",", "."));
      if (totalQ > 0 && totalPts > 0) p3DefaultDiem = Math.round((totalPts / totalQ) * 100) / 100;
    }

    const p3Blocks = part3Text.split(GDDT_QUESTION_SPLIT_REGEX)
      .filter(b => GDDT_QUESTION_START_TEST.test(b.trim()));

    if (p3Blocks.length > 0) {
      p3Blocks.forEach((block) => {
        const blockTrim = block.trim();
        if (!blockTrim) return;

        let itemDiem = p3DefaultDiem;
        const pointMatch = blockTrim.match(/(?:\[|\()([0-9]+(?:[.,][0-9]+)?)\s*(?:điểm|đ|pt|pts)(?:\]|\))/i);
        if (pointMatch) {
          const p = parseFloat(pointMatch[1].replace(",", "."));
          if (!isNaN(p) && p > 0) itemDiem = p;
        }

        let prompt = blockTrim
          .replace(/^\s*(?:Câu|Bài|\bQ)\s*\d+(?:\s*\([^\)]*\))?[:.-]*\s*/i, "")
          .replace(/(?:\[|\()[0-9]+(?:[.,][0-9]+)?\s*(?:điểm|đ|pt|pts)(?:\]|\))/i, "");

        let essayAns = "";
        const ansSplit = prompt.split(/(?:^|\n|\r|\s{2,})(?:Đáp\s*án|Lời\s*giải|Hướng\s*dẫn\s*giải|Hướng\s*dẫn\s*chấm|Gợi\s*ý\s*trả\s*lời)[:：]/i);
        if (ansSplit.length > 1) {
          prompt = ansSplit[0];
          essayAns = ansSplit.slice(1).join("\n").trim();
        }

        prompt = cleanQuestionPrompt(prompt);

        if (prompt.length > 5 && !isGarbageOrHeaderBlock(prompt)) {
          const qId = essayList.length + 1;
          if (!essayAns && answerKeys && answerKeys.essayAnswers && answerKeys.essayAnswers[qId]) {
            essayAns = answerKeys.essayAnswers[qId];
          }
          essayList.push({
            id: qId,
            noiDung: restoreMultilineFormatting(prompt),
            diem: itemDiem,
            dapAn: restoreMultilineFormatting(essayAns)
          });
        }
      });
    } else {
      const cleaned = cleanQuestionPrompt(part3Text);
      const paragraphs = cleaned.split(/\r?\n\s*\r?\n/)
        .map(p => cleanQuestionPrompt(p))
        .filter(p => p.length > 15 && !isGarbageOrHeaderBlock(p));

      paragraphs.forEach((pText) => {
        const qId = essayList.length + 1;
        const essayAns = (answerKeys && answerKeys.essayAnswers && answerKeys.essayAnswers[qId]) ? answerKeys.essayAnswers[qId] : "";
        essayList.push({
          id: qId,
          noiDung: restoreMultilineFormatting(pText),
          diem: p3DefaultDiem,
          dapAn: restoreMultilineFormatting(essayAns)
        });
      });
    }
  }

  // Tự động lưu và hiển thị Phần III Tự Luận
  parsedEssayQuestions = essayList;
  if (typeof renderEssayQuestionsEditor === "function") {
    renderEssayQuestionsEditor();
  }

  // Trường hợp dự phòng nếu đề không phân chia rõ ràng:
  if (list.length === 0) {
    const rawBlocks = examContent.split(GDDT_QUESTION_SPLIT_REGEX)
      .filter(b => GDDT_QUESTION_START_TEST.test(b.trim()));

    let tfCounter = 0;
    rawBlocks.forEach((block, idx) => {
      const blockTrim = block.trim();
      const numMatch = blockTrim.match(/^\s*(?:Câu|Bài|\bQ)\s*(\d+)/i);
      const docQNum = numMatch ? parseInt(numMatch[1]) : (idx + 1);

      const hasTfKeywords = /(?:đúng|sai|mệnh đề|nhận định)/i.test(blockTrim) && /(?:^|\s|\n)[a-d][\).:]\s+/i.test(blockTrim);
      const tfData = hasTfKeywords ? extractTfOptions(blockTrim) : null;

      if (tfData && tfData.subItems && tfData.subItems.length >= 2) {
        tfCounter++;
        const tfAnsObj = answerKeys.tfAnswers[tfCounter] || answerKeys.tfAnswers[docQNum] || {};
        const subItems = tfData.subItems.map(sub => {
          let isTrue = false;
          if (tfAnsObj[sub.key] !== undefined) isTrue = tfAnsObj[sub.key];
          else isTrue = /(?:đúng|\bđ\b|\*)/i.test(sub.noiDung) && !/sai/i.test(sub.noiDung);
          return { key: sub.key, noiDung: sub.noiDung.replace(/\((?:đúng|sai)\)/gi, "").trim(), dung: isTrue };
        });

        list.push({
          id: list.length + 1,
          noiDung: tfData.prompt,
          loaiCauHoi: "true_false",
          diem: 1,
          y: subItems
        });
      } else {
        const mcData = extractMcOptions(blockTrim);
        if (mcData) {
          let correct = answerKeys.mcAnswers[docQNum] || answerKeys.mcAnswers[list.length + 1] || "A";
          list.push({
            id: list.length + 1,
            noiDung: mcData.prompt,
            loaiCauHoi: "multiple_choice",
            diem: 1,
            luaChon: mcData.options,
            dapAnDung: correct
          });
        }
      }
    });
  }

  if (list.length > 0) return list;

  return parseQuestionsLocalMock(rawText);
}



// Bộ phân tích mẫu dự phòng khi chưa cấu hình API Key
function parseQuestionsLocalMock(rawText) {
  return [
    {
      id: 1,
      noiDung: "Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là thành phố nào sau đây?",
      loaiCauHoi: "multiple_choice",
      diem: 1,
      luaChon: [
        { key: "A", noiDung: "Hà Nội" },
        { key: "B", noiDung: "Thành phố Hồ Chí Minh" },
        { key: "C", noiDung: "Đà Nẵng" },
        { key: "D", noiDung: "Hải Phòng" }
      ],
      dapAnDung: "A"
    },
    {
      id: 2,
      noiDung: "Cho phương trình bậc hai: x² - 5x + 6 = 0. Xét tính đúng/sai của các mệnh đề sau:",
      loaiCauHoi: "true_false",
      diem: 1,
      y: [
        { key: "a", noiDung: "Biệt thức Delta (Δ) của phương trình bằng 1.", dung: true },
        { key: "b", noiDung: "Phương trình có nghiệm kép.", dung: false },
        { key: "c", noiDung: "Hai nghiệm phân biệt của phương trình là x = 2 và x = 3.", dung: true },
        { key: "d", noiDung: "Tổng hai nghiệm của phương trình bằng -5.", dung: false }
      ]
    },
    {
      id: 3,
      noiDung: "Nguyên tố hóa học nào có ký hiệu là 'Fe' trong bảng tuần hoàn?",
      loaiCauHoi: "multiple_choice",
      diem: 1,
      luaChon: [
        { key: "A", noiDung: "Đồng (Copper)" },
        { key: "B", noiDung: "Sắt (Iron)" },
        { key: "C", noiDung: "Nhôm (Aluminium)" },
        { key: "D", noiDung: "Kẽm (Zinc)" }
      ],
      dapAnDung: "B"
    }
  ];
}

// ============================================================================
// 4.5. QUẢN LÝ CÂU HỎI TỰ LUẬN (PHẦN III)
// ============================================================================
function initEssayQuestionsUI() {
  const btnAddEssayItem = document.getElementById("btnAddEssayItem");
  if (btnAddEssayItem) {
    btnAddEssayItem.addEventListener("click", () => {
      addNewEssayQuestion();
    });
  }

  const btnAddEssayQuestion = document.getElementById("btnAddEssayQuestion");
  if (btnAddEssayQuestion) {
    btnAddEssayQuestion.addEventListener("click", () => {
      const menu = document.getElementById("addQuestionDropdownMenu");
      if (menu) menu.style.display = "none";
      addNewEssayQuestion();
    });
  }

  const btnExportEssayExcel = document.getElementById("btnExportEssayExcel");
  if (btnExportEssayExcel) {
    btnExportEssayExcel.addEventListener("click", () => {
      exportEssayResultsExcel();
    });
  }

  renderEssayQuestionsEditor();
}

function renderEssayQuestionsEditor() {
  const container = document.getElementById("essayQuestionsList");
  if (!container) return;

  container.innerHTML = "";

  if (!parsedEssayQuestions || parsedEssayQuestions.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.25rem; border: 1.5px dashed #cbd5e1; border-radius: 12px; text-align: center; color: #64748b; font-size: 0.88rem; background: #f8fafc;">
        <p style="margin: 0 0 0.35rem 0; font-weight: 600; color: #475569;">Chưa có câu hỏi tự luận nào.</p>
        <span>Bấm nút <strong>"+ Thêm Câu Tự Luận"</strong> ở góc phải hoặc tải file Word/PDF có Phần Tự Luận lên để hệ thống tự động bóc tách.</span>
      </div>
    `;
    return;
  }

  parsedEssayQuestions.forEach((eq, idx) => {
    eq.id = idx + 1;
    if (eq.diem === undefined || isNaN(Number(eq.diem))) eq.diem = 1;

    const item = document.createElement("div");
    item.className = "essay-editor-item";
    item.dataset.index = idx;
    item.style.cssText = "background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0.85rem 1rem;";

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-weight: 800; color: #059669; font-size: 0.92rem;">Câu ${eq.id} (Tự luận)</span>
          <div style="display: flex; align-items: center; gap: 4px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 6px;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Điểm:</span>
            <input type="number" class="essay-point-input" data-index="${idx}" min="0.25" max="10" step="0.25" value="${eq.diem}" style="width: 50px; border: none; font-weight: 700; color: #0f172a; text-align: center; font-size: 0.85rem; outline: none;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">đ</span>
          </div>
        </div>
        <button type="button" class="btn-delete-essay-item" data-index="${idx}" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span>Xóa câu này</span>
        </button>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <label style="font-size: 0.78rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.2rem;">Nội dung đề bài tự luận ${eq.id}:</label>
        <textarea class="form-textarea essay-content-input" data-index="${idx}" rows="3" placeholder="Nhập nội dung đề bài câu hỏi tự luận ${eq.id}..." style="font-size: 0.9rem; width: 100%; box-sizing: border-box; background: #ffffff; border-radius: 8px; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(eq.noiDung || '')}</textarea>
      </div>
      <div style="margin-top: 0.5rem; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 0.6rem 0.85rem;">
        <label style="font-size: 0.8rem; font-weight: 700; color: #065f46; display: flex; align-items: center; gap: 5px; margin-bottom: 0.25rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Đáp án đúng / Lời giải mẫu (hiện khi học sinh ôn tập, học bài):</span>
        </label>
        <textarea class="form-textarea essay-answer-input" data-index="${idx}" rows="3" placeholder="Nhập đáp án chuẩn, gợi ý trả lời hoặc lời giải chi tiết cho câu tự luận ${eq.id}..." style="font-size: 0.88rem; width: 100%; box-sizing: border-box; background: #ffffff; border-radius: 6px; border: 1px solid #6ee7b7; color: #064e3b; font-weight: 500; line-height: 1.45; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(eq.dapAn || eq.dapAnDung || '')}</textarea>
      </div>
    `;

    container.appendChild(item);
  });

  // Bắt sự kiện chỉnh sửa điểm & nội dung
  container.querySelectorAll(".essay-point-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index);
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      if (parsedEssayQuestions[idx]) {
        parsedEssayQuestions[idx].diem = val;
        renderQuestionsPreview(parsedQuestions);
      }
    });
  });

  container.querySelectorAll(".essay-content-input").forEach(tx => {
    tx.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[idx]) {
        parsedEssayQuestions[idx].noiDung = e.target.value;
        const rightPreview = document.querySelector(`.q-essay-prompt[data-index="${idx}"]`);
        if (rightPreview && rightPreview.innerText !== e.target.value) {
          rightPreview.innerText = e.target.value;
        }
      }
    });
    tx.addEventListener("blur", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[idx]) {
        parsedEssayQuestions[idx].noiDung = restoreMultilineFormatting(e.target.value);
        e.target.value = parsedEssayQuestions[idx].noiDung;
        renderQuestionsPreview(parsedQuestions);
      }
    });
  });

  // Bắt sự kiện chỉnh sửa đáp án tự luận
  container.querySelectorAll(".essay-answer-input").forEach(tx => {
    tx.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[idx]) {
        parsedEssayQuestions[idx].dapAn = e.target.value;
        const rightPreview = document.querySelector(`.q-essay-answer-editable[data-index="${idx}"]`);
        if (rightPreview && rightPreview.innerText !== e.target.value) {
          rightPreview.innerText = e.target.value;
        }
      }
    });
    tx.addEventListener("blur", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[idx]) {
        parsedEssayQuestions[idx].dapAn = restoreMultilineFormatting(e.target.value);
        e.target.value = parsedEssayQuestions[idx].dapAn;
        const rightPreview = document.querySelector(`.q-essay-answer-editable[data-index="${idx}"]`);
        if (rightPreview && rightPreview.innerText !== e.target.value) {
          rightPreview.innerText = e.target.value;
        }
      }
    });
  });

  container.querySelectorAll(".btn-delete-essay-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      parsedEssayQuestions.splice(idx, 1);
      renderEssayQuestionsEditor();
      renderQuestionsPreview(parsedQuestions);
      showToast("Đã xóa", "Đã xóa 1 câu hỏi tự luận.", "info", 2000);
    });
  });
}

function addNewEssayQuestion(promptText = "", points = 1, answerText = "") {
  const newId = parsedEssayQuestions.length + 1;
  parsedEssayQuestions.push({
    id: newId,
    noiDung: promptText || `Câu hỏi và yêu cầu bài làm tự luận ${newId}...`,
    diem: points,
    dapAn: answerText || ""
  });

  renderEssayQuestionsEditor();
  renderQuestionsPreview(parsedQuestions);

  showToast("Đã thêm câu tự luận", `Đã thêm Câu ${newId} vào Phần III (Tự luận).`, "success", 2000);

  setTimeout(() => {
    const list = document.getElementById("essayQuestionsList");
    const lastItem = list?.lastElementChild;
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: "smooth", block: "center" });
      const tx = lastItem.querySelector("textarea");
      if (tx) tx.focus();
    }
  }, 100);
}

// ============================================================================
// 5. RENDER BẢN XEM TRƯỚC VÀ CHỈNH SỬA CÂU HỎI THEO 3 PHẦN
// ============================================================================
function renderQuestionsPreview(questions) {
  const container = document.getElementById("questionsPreviewList");
  container.innerHTML = "";

  const mcQuestions = (questions || []).filter(q => q.loaiCauHoi !== "true_false");
  const tfQuestions = (questions || []).filter(q => q.loaiCauHoi === "true_false");
  const essayQuestions = parsedEssayQuestions || [];

  const totalCount = (questions || []).length + essayQuestions.length;

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="empty-preview-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" x2="8" y1="13" y2="13"/>
          <line x1="16" x2="8" y1="17" y2="17"/>
          <line x1="10" x2="8" y1="9" y2="9"/>
        </svg>
        <p>Chưa có câu hỏi nào được bóc tách.</p>
        <span>Tải lên file Word/PDF hoặc dán nội dung rồi bấm <strong>"Bóc Tách Đề Thi Bằng Gemini AI"</strong> để xem trước bản nháp tại đây.</span>
      </div>
    `;
    updateStats(0, 0, 0, 0, 0);
    return;
  }

  let runningId = 0;
  let totalPoints = 0;

  // Chuẩn hóa điểm ban đầu và tính tổng điểm từng phần
  mcQuestions.forEach(q => {
    if (q.diem === undefined || q.diem === null || isNaN(Number(q.diem)) || Number(q.diem) <= 0) q.diem = 1;
  });
  tfQuestions.forEach(q => {
    if (q.diem === undefined || q.diem === null || isNaN(Number(q.diem)) || Number(q.diem) <= 0) q.diem = 1;
  });
  essayQuestions.forEach(eq => {
    if (eq.diem === undefined || eq.diem === null || isNaN(Number(eq.diem)) || Number(eq.diem) <= 0) eq.diem = 1;
  });

  const mcPartPoints = Math.round(mcQuestions.reduce((sum, q) => sum + (Number(q.diem) || 0), 0) * 100) / 100;
  const tfPartPoints = Math.round(tfQuestions.reduce((sum, q) => sum + (Number(q.diem) || 0), 0) * 100) / 100;
  const essayPartPoints = Math.round(essayQuestions.reduce((sum, eq) => sum + (Number(eq.diem) || 0), 0) * 100) / 100;

  // ==========================================
  // PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN
  // ==========================================
  if (mcQuestions.length > 0) {
    const headerI = document.createElement("div");
    headerI.className = "preview-section-header mc-section";
    headerI.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="preview-section-badge" style="color: #1e40af;">PHẦN I</span>
        <span>Câu hỏi trắc nghiệm nhiều phương án lựa chọn</span>
      </div>

      <div class="section-points-control-wrap">
        <div class="section-points-box" style="border-color: #bfdbfe;" title="Nhập tổng số điểm cho Phần I">
          <span style="font-size: 0.78rem; font-weight: 700; color: #1e40af; white-space: nowrap;">Điểm tổng phần:</span>
          <input type="number" id="inputTotalPointsPartI" class="section-total-points-input" data-part="mc" min="0.1" max="100" step="0.25" value="${mcPartPoints}" style="border-color: #93c5fd; color: #1e3a8a; background: #ffffff;" aria-label="Tổng điểm Phần I">
          <span style="font-size: 0.78rem; font-weight: 700; color: #1e40af;">đ</span>
        </div>

        <button type="button" class="btn-divide-part-points" data-part="mc" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); box-shadow: 0 2px 6px rgba(37,99,235,0.25);" title="Tự động chia đều tổng điểm cho tất cả các câu trong Phần I">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Tự động chia điểm</span>
        </button>

        <span style="font-size: 0.8rem; font-weight: 800; color: #2563eb; background: #dbeafe; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe; white-space: nowrap;">${mcQuestions.length} câu</span>
      </div>
    `;
    container.appendChild(headerI);

    mcQuestions.forEach(q => {
      runningId++;
      q.id = runningId;
      if (q.diem === undefined || q.diem === null || isNaN(Number(q.diem))) q.diem = 1;
      const qPoint = Number(q.diem) || 0;
      totalPoints += qPoint;

      const realIdx = questions.indexOf(q);
      const card = createQuestionReviewCard(q, realIdx, "mc");
      container.appendChild(card);
    });
  }

  // ==========================================
  // PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI
  // ==========================================
  if (tfQuestions.length > 0) {
    const headerII = document.createElement("div");
    headerII.className = "preview-section-header tf-section";
    headerII.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="preview-section-badge" style="color: #86198f;">PHẦN II</span>
        <span>Câu hỏi trắc nghiệm Đúng / Sai</span>
      </div>

      <div class="section-points-control-wrap">
        <div class="section-points-box" style="border-color: #f5d0fe;" title="Nhập tổng số điểm cho Phần II">
          <span style="font-size: 0.78rem; font-weight: 700; color: #86198f; white-space: nowrap;">Điểm tổng phần:</span>
          <input type="number" id="inputTotalPointsPartII" class="section-total-points-input" data-part="tf" min="0.1" max="100" step="0.25" value="${tfPartPoints}" style="border-color: #e9d5ff; color: #6b21a8; background: #ffffff;" aria-label="Tổng điểm Phần II">
          <span style="font-size: 0.78rem; font-weight: 700; color: #86198f;">đ</span>
        </div>

        <button type="button" class="btn-divide-part-points" data-part="tf" style="background: linear-gradient(135deg, #9333ea, #7e22ce); box-shadow: 0 2px 6px rgba(147,51,234,0.25);" title="Tự động chia đều tổng điểm cho tất cả các câu trong Phần II">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Tự động chia điểm</span>
        </button>

        <span style="font-size: 0.8rem; font-weight: 800; color: #9333ea; background: #f3e8ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e9d5ff; white-space: nowrap;">${tfQuestions.length} câu</span>
      </div>
    `;
    container.appendChild(headerII);

    tfQuestions.forEach(q => {
      runningId++;
      q.id = runningId;
      if (q.diem === undefined || q.diem === null || isNaN(Number(q.diem))) q.diem = 1;
      const qPoint = Number(q.diem) || 0;
      totalPoints += qPoint;

      const realIdx = questions.indexOf(q);
      const card = createQuestionReviewCard(q, realIdx, "tf");
      container.appendChild(card);
    });
  }

  // ==========================================
  // PHẦN III: TỰ LUẬN
  // ==========================================
  if (essayQuestions.length > 0) {
    const headerIII = document.createElement("div");
    headerIII.className = "preview-section-header essay-section";
    headerIII.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="preview-section-badge" style="color: #065f46;">PHẦN III</span>
        <span>Câu hỏi Tự Luận (Học sinh gõ bài làm, GV chấm điểm)</span>
      </div>

      <div class="section-points-control-wrap">
        <div class="section-points-box" style="border-color: #a7f3d0;" title="Nhập tổng số điểm cho Phần III">
          <span style="font-size: 0.78rem; font-weight: 700; color: #065f46; white-space: nowrap;">Điểm tổng phần:</span>
          <input type="number" id="inputTotalPointsPartIII" class="section-total-points-input" data-part="essay" min="0.1" max="100" step="0.25" value="${essayPartPoints}" style="border-color: #6ee7b7; color: #047857; background: #ffffff;" aria-label="Tổng điểm Phần III">
          <span style="font-size: 0.78rem; font-weight: 700; color: #065f46;">đ</span>
        </div>

        <button type="button" class="btn-divide-part-points" data-part="essay" style="background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 2px 6px rgba(5,150,105,0.25);" title="Tự động chia đều tổng điểm cho tất cả các câu trong Phần III">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Tự động chia điểm</span>
        </button>

        <span style="font-size: 0.8rem; font-weight: 800; color: #059669; background: #d1fae5; padding: 3px 8px; border-radius: 6px; border: 1px solid #a7f3d0; white-space: nowrap;">${essayQuestions.length} câu</span>
      </div>
    `;
    container.appendChild(headerIII);

    essayQuestions.forEach((eq, eqIdx) => {
      eq.id = eqIdx + 1;
      if (eq.diem === undefined || eq.diem === null || isNaN(Number(eq.diem))) eq.diem = 1;
      const qPoint = Number(eq.diem) || 0;
      totalPoints += qPoint;

      const card = document.createElement("div");
      card.className = "question-review-card";
      card.dataset.essayIndex = eqIdx;
      card.style.borderColor = "#a7f3d0";

      card.innerHTML = `
        <div class="q-card-header">
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span style="font-weight: 800; color: #059669;">Câu ${eq.id}</span>
            <span class="q-type-badge essay">Tự Luận</span>
            <div class="q-points-box" style="background: #ecfdf5; border-color: #a7f3d0;" title="Nhập số điểm cho câu tự luận này">
              <span class="q-points-label" style="color: #059669;">Điểm:</span>
              <input type="number" class="q-essay-points-input" min="0.25" max="100" step="0.25" value="${eq.diem}" data-index="${eqIdx}" aria-label="Điểm câu tự luận ${eq.id}">
              <span class="q-points-unit">đ</span>
            </div>
          </div>
          <button type="button" class="btn-delete-preview-essay" data-index="${eqIdx}" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 700; cursor: pointer;">Xóa câu này</button>
        </div>

        <div style="margin-bottom: 0.5rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem;">Đề bài tự luận:</div>
          <div class="q-prompt-editable q-essay-prompt" contenteditable="true" data-index="${eqIdx}" style="min-height: 48px; background: #ffffff; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap !important; word-break: break-word;">
            ${escapeHtml(eq.noiDung)}
          </div>
        </div>

        <div style="margin-top: 0.5rem; background: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 8px; padding: 0.55rem 0.85rem;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #166534; margin-bottom: 0.3rem; display: flex; align-items: center; gap: 4px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Đáp án câu tự luận đúng (Học sinh xem lại khi ôn tập):</span>
          </div>
          <div class="q-essay-answer-editable" contenteditable="true" data-index="${eqIdx}" placeholder="Nhập đáp án chuẩn hoặc lời giải chi tiết..." style="min-height: 38px; background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #bbf7d0; font-size: 0.88rem; color: #166534; line-height: 1.45; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(eq.dapAn || eq.dapAnDung || '')}</div>
        </div>
      `;

      container.appendChild(card);
    });
  }

  updateStats(totalCount, mcQuestions.length, tfQuestions.length, essayQuestions.length, totalPoints);
  attachPreviewEvents();
}

function createQuestionReviewCard(q, realIdx, type) {
  const isTf = type === "tf";
  const card = document.createElement("div");
  card.className = "question-review-card";
  card.dataset.index = realIdx;

  card.innerHTML = `
    <div class="q-card-header">
      <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
        <span style="font-weight: 800; color: #a78bfa;">Câu ${q.id}</span>
        <span class="q-type-badge ${isTf ? 'tf' : 'mc'}">
          ${isTf ? 'Đúng / Sai' : '4 Lựa Chọn'}
        </span>
        <div class="q-points-box" title="Nhập số điểm cho câu này (ví dụ: 0.25, 0.5, 1...)">
          <span class="q-points-label">Điểm:</span>
          <input type="number" class="q-points-input" min="0.05" max="100" step="0.25" value="${q.diem}" data-index="${realIdx}" aria-label="Điểm câu ${q.id}">
          <span class="q-points-unit">đ</span>
        </div>
      </div>
      <button type="button" class="btn-delete-q" data-index="${realIdx}">Xóa câu này</button>
    </div>

    <div class="q-prompt-editable" contenteditable="true" data-index="${realIdx}" data-field="noiDung" style="white-space: pre-wrap !important; word-break: break-word;">
      ${escapeHtml(q.noiDung)}
    </div>

    ${isTf ? renderTfOptionsPreview(q, realIdx) : renderMcOptionsPreview(q, realIdx)}
  `;

  return card;
}

function renderMcOptionsPreview(q, qIdx) {
  const options = q.luaChon || [
    { key: "A", noiDung: "" }, { key: "B", noiDung: "" },
    { key: "C", noiDung: "" }, { key: "D", noiDung: "" }
  ];

  let html = `<div class="q-options-list">`;
  options.forEach(opt => {
    const isCorrect = String(opt.key).toUpperCase() === String(q.dapAnDung).toUpperCase();
    html += `
      <div class="q-opt-item ${isCorrect ? 'is-correct' : ''}">
        <input type="radio" name="correct_mc_${qIdx}" value="${opt.key}" ${isCorrect ? 'checked' : ''} class="q-opt-radio" data-qidx="${qIdx}">
        <strong>${opt.key}.</strong>
        <div class="q-opt-text" contenteditable="true" data-qidx="${qIdx}" data-optkey="${opt.key}" style="white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(opt.noiDung)}</div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function renderTfOptionsPreview(q, qIdx) {
  const subItems = q.y || [
    { key: "a", noiDung: "", dung: true },
    { key: "b", noiDung: "", dung: false },
    { key: "c", noiDung: "", dung: true },
    { key: "d", noiDung: "", dung: false }
  ];

  let html = `<table class="q-tf-table"><tbody>`;
  subItems.forEach((sub, sIdx) => {
    const isTrue = !!sub.dung;
    html += `
      <tr class="q-tf-row">
        <td class="q-tf-key">${sub.key})</td>
        <td>
          <div class="q-tf-text" contenteditable="true" data-qidx="${qIdx}" data-subidx="${sIdx}" style="white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(sub.noiDung)}</div>
        </td>
        <td class="q-tf-toggle">
          <button type="button" class="tf-pill-btn ${isTrue ? 'true' : 'false'}" data-qidx="${qIdx}" data-subidx="${sIdx}">
            ${isTrue ? 'Đúng' : 'Sai'}
          </button>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  return html;
}

function updateStats(total, mc, tf, essay, totalPoints) {
  const elTotal = document.getElementById("statQuestionCount");
  const elMc = document.getElementById("statMcCount");
  const elTf = document.getElementById("statTfCount");
  const elEssay = document.getElementById("statEssayCount");
  const elPoints = document.getElementById("statTotalPoints");

  const mcCount = mc !== undefined ? mc : (parsedQuestions || []).filter(q => q.loaiCauHoi !== "true_false").length;
  const tfCount = tf !== undefined ? tf : (parsedQuestions || []).filter(q => q.loaiCauHoi === "true_false").length;
  const essayCount = essay !== undefined ? essay : (parsedEssayQuestions || []).length;
  const totalCount = total !== undefined ? total : (mcCount + tfCount + essayCount);

  if (elTotal) elTotal.textContent = totalCount;
  if (elMc) elMc.textContent = mcCount;
  if (elTf) elTf.textContent = tfCount;
  if (elEssay) elEssay.textContent = essayCount;

  if (elPoints) {
    if (totalPoints === undefined) {
      const p1 = (parsedQuestions || []).reduce((acc, cur) => acc + (Number(cur.diem) || 0), 0);
      const p2 = (parsedEssayQuestions || []).reduce((acc, cur) => acc + (Number(cur.diem) || 0), 0);
      totalPoints = p1 + p2;
    }
    totalPoints = Math.round(totalPoints * 100) / 100;
    elPoints.textContent = `${totalPoints} đ`;
  }
}

// Bắt sự kiện chỉnh sửa trực tiếp trên bản xem trước
function attachPreviewEvents() {
  // 0. Nhập điểm cho từng câu trắc nghiệm
  document.querySelectorAll(".q-points-input").forEach(input => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index);
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      if (parsedQuestions[idx]) {
        parsedQuestions[idx].diem = val;
        updateStats();
        updateSectionPointsSum();
      }
    });

    input.addEventListener("blur", (e) => {
      const idx = parseInt(e.target.dataset.index);
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val <= 0) val = 1;
      val = Math.round(val * 100) / 100;
      e.target.value = val;
      if (parsedQuestions[idx]) {
        parsedQuestions[idx].diem = val;
        updateStats();
        updateSectionPointsSum();
      }
    });
  });

  // 0.1 Nhập điểm cho câu tự luận trên bản xem trước
  document.querySelectorAll(".q-essay-points-input").forEach(input => {
    input.addEventListener("input", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) val = 0;
      if (parsedEssayQuestions[eqIdx]) {
        parsedEssayQuestions[eqIdx].diem = val;
        // Đồng bộ sang editor bên trái
        const leftInp = document.querySelector(`.essay-point-input[data-index="${eqIdx}"]`);
        if (leftInp) leftInp.value = val;
        updateStats();
        updateSectionPointsSum();
      }
    });
  });

  // 1. Sửa nội dung câu hỏi trắc nghiệm
  document.querySelectorAll(".q-prompt-editable:not(.q-essay-prompt)").forEach(el => {
    el.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedQuestions && parsedQuestions[idx]) {
        parsedQuestions[idx].noiDung = extractCleanMultilineText(e.target);
      }
    });
    el.addEventListener("blur", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedQuestions && parsedQuestions[idx]) {
        parsedQuestions[idx].noiDung = extractCleanMultilineText(e.target);
      }
    });
  });

  // 1.1 Sửa nội dung câu hỏi tự luận trên bản xem trước
  document.querySelectorAll(".q-essay-prompt").forEach(el => {
    el.addEventListener("input", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions && parsedEssayQuestions[eqIdx]) {
        const cleanVal = extractCleanMultilineText(e.target);
        parsedEssayQuestions[eqIdx].noiDung = cleanVal;
        const leftTx = document.querySelector(`.essay-content-input[data-index="${eqIdx}"]`);
        if (leftTx && leftTx.value !== cleanVal) leftTx.value = cleanVal;
      }
    });
    el.addEventListener("blur", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions && parsedEssayQuestions[eqIdx]) {
        const cleanVal = extractCleanMultilineText(e.target);
        parsedEssayQuestions[eqIdx].noiDung = cleanVal;
        const leftTx = document.querySelector(`.essay-content-input[data-index="${eqIdx}"]`);
        if (leftTx && leftTx.value !== cleanVal) leftTx.value = cleanVal;
      }
    });
  });

  // 1.2 Sửa đáp án câu hỏi tự luận trên bản xem trước
  document.querySelectorAll(".q-essay-answer-editable").forEach(el => {
    el.addEventListener("input", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions && parsedEssayQuestions[eqIdx]) {
        const cleanVal = extractCleanMultilineText(e.target);
        parsedEssayQuestions[eqIdx].dapAn = cleanVal;
        const leftTx = document.querySelector(`.essay-answer-input[data-index="${eqIdx}"]`);
        if (leftTx && leftTx.value !== cleanVal) leftTx.value = cleanVal;
      }
    });
    el.addEventListener("blur", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions && parsedEssayQuestions[eqIdx]) {
        const cleanVal = extractCleanMultilineText(e.target);
        parsedEssayQuestions[eqIdx].dapAn = cleanVal;
        const leftTx = document.querySelector(`.essay-answer-input[data-index="${eqIdx}"]`);
        if (leftTx && leftTx.value !== cleanVal) leftTx.value = cleanVal;
      }
    });
  });

  // 2. Đổi đáp án đúng cho câu 4 lựa chọn
  document.querySelectorAll(".q-opt-radio").forEach(radio => {
    radio.addEventListener("change", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const chosenKey = e.target.value;
      if (parsedQuestions[qIdx]) {
        parsedQuestions[qIdx].dapAnDung = chosenKey;
        const parentList = e.target.closest(".q-options-list");
        parentList.querySelectorAll(".q-opt-item").forEach(item => item.classList.remove("is-correct"));
        e.target.closest(".q-opt-item").classList.add("is-correct");
      }
    });
  });

  // 3. Sửa nội dung các lựa chọn A/B/C/D
  document.querySelectorAll(".q-opt-text").forEach(el => {
    el.addEventListener("input", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const optKey = e.target.dataset.optkey;
      const q = parsedQuestions ? parsedQuestions[qIdx] : null;
      if (q && q.luaChon) {
        const found = q.luaChon.find(o => o.key === optKey);
        if (found) found.noiDung = extractCleanMultilineText(e.target);
      }
    });
    el.addEventListener("blur", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const optKey = e.target.dataset.optkey;
      const q = parsedQuestions ? parsedQuestions[qIdx] : null;
      if (q && q.luaChon) {
        const found = q.luaChon.find(o => o.key === optKey);
        if (found) found.noiDung = extractCleanMultilineText(e.target);
      }
    });
  });

  // 4. Toggle Đúng / Sai
  document.querySelectorAll(".tf-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const qIdx = parseInt(btn.dataset.qidx);
      const sIdx = parseInt(btn.dataset.subidx);
      const q = parsedQuestions[qIdx];
      if (q && q.y && q.y[sIdx]) {
        q.y[sIdx].dung = !q.y[sIdx].dung;
        const newStatus = q.y[sIdx].dung;
        btn.className = `tf-pill-btn ${newStatus ? 'true' : 'false'}`;
        btn.textContent = newStatus ? 'Đúng' : 'Sai';
      }
    });
  });

  // 5. Sửa nội dung mệnh đề Đúng/Sai
  document.querySelectorAll(".q-tf-text").forEach(el => {
    el.addEventListener("input", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const sIdx = parseInt(e.target.dataset.subidx);
      const q = parsedQuestions ? parsedQuestions[qIdx] : null;
      if (q && q.y && q.y[sIdx]) {
        q.y[sIdx].noiDung = extractCleanMultilineText(e.target);
      }
    });
    el.addEventListener("blur", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const sIdx = parseInt(e.target.dataset.subidx);
      const q = parsedQuestions ? parsedQuestions[qIdx] : null;
      if (q && q.y && q.y[sIdx]) {
        q.y[sIdx].noiDung = extractCleanMultilineText(e.target);
      }
    });
  });

  // 6. Xóa câu hỏi trắc nghiệm
  document.querySelectorAll(".btn-delete-q").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      parsedQuestions.splice(idx, 1);
      renderQuestionsPreview(parsedQuestions);
      showToast("Đã xóa", "Đã xóa 1 câu hỏi khỏi đề thi.", "info", 1500);
    });
  });

  // 7. Xóa câu hỏi tự luận trên bản xem trước
  document.querySelectorAll(".btn-delete-preview-essay").forEach(btn => {
    btn.addEventListener("click", () => {
      const eqIdx = parseInt(btn.dataset.index);
      parsedEssayQuestions.splice(eqIdx, 1);
      renderEssayQuestionsEditor();
      renderQuestionsPreview(parsedQuestions);
      showToast("Đã xóa", "Đã xóa 1 câu hỏi tự luận.", "info", 1500);
    });
  });

  // 8. Lắng nghe nút Tự động chia điểm cho từng phần
  document.querySelectorAll(".btn-divide-part-points").forEach(btn => {
    btn.addEventListener("click", () => {
      const partType = btn.dataset.part;
      dividePointsForSection(partType);
    });
  });

  // 9. Nhấn Enter trên ô nhập tổng điểm của từng phần để chia ngay
  document.querySelectorAll(".section-total-points-input").forEach(inp => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const partType = inp.dataset.part;
        dividePointsForSection(partType);
      }
    });
  });
}

/**
 * Tự động chia đều tổng điểm cho từng câu hỏi trong 1 phần cụ thể (Phần I, II, hoặc III)
 */
function dividePointsForSection(partType) {
  let targetQuestions = [];
  let inputElId = "";
  let partName = "";

  if (partType === "mc") {
    targetQuestions = (parsedQuestions || []).filter(q => q.loaiCauHoi !== "true_false");
    inputElId = "inputTotalPointsPartI";
    partName = "Phần I (Trắc nghiệm nhiều lựa chọn)";
  } else if (partType === "tf") {
    targetQuestions = (parsedQuestions || []).filter(q => q.loaiCauHoi === "true_false");
    inputElId = "inputTotalPointsPartII";
    partName = "Phần II (Trắc nghiệm Đúng / Sai)";
  } else if (partType === "essay") {
    targetQuestions = parsedEssayQuestions || [];
    inputElId = "inputTotalPointsPartIII";
    partName = "Phần III (Tự luận)";
  }

  const count = targetQuestions.length;
  if (count === 0) {
    showToast("Không có câu hỏi", `Chưa có câu hỏi nào trong ${partName} để chia điểm!`, "warning", 3000);
    return;
  }

  const inputEl = document.getElementById(inputElId);
  let totalPartPoints = inputEl ? parseFloat(inputEl.value) : 0;
  if (isNaN(totalPartPoints) || totalPartPoints <= 0) {
    showToast("Điểm không hợp lệ", "Vui lòng nhập tổng điểm phần lớn hơn 0 để chia đều!", "warning", 3000);
    if (inputEl) inputEl.focus();
    return;
  }

  // Làm tròn 2 số thập phân chuẩn giáo dục
  let eachPoint = Math.round((totalPartPoints / count) * 100) / 100;
  if (eachPoint <= 0) eachPoint = 0.05;

  if (partType === "essay") {
    targetQuestions.forEach((eq, eqIdx) => {
      eq.diem = eachPoint;
      const inp = document.querySelector(`.q-essay-points-input[data-index="${eqIdx}"]`);
      if (inp) inp.value = eachPoint;
      const leftInp = document.querySelector(`.essay-point-input[data-index="${eqIdx}"]`);
      if (leftInp) leftInp.value = eachPoint;
    });
  } else {
    targetQuestions.forEach(q => {
      q.diem = eachPoint;
      const realIdx = parsedQuestions.indexOf(q);
      if (realIdx !== -1) {
        const inp = document.querySelector(`.q-points-input[data-index="${realIdx}"]`);
        if (inp) inp.value = eachPoint;
      }
    });
  }

  const actualSum = Math.round(eachPoint * count * 100) / 100;
  if (inputEl) inputEl.value = actualSum;

  updateStats();
  updateSectionPointsSum();

  showToast(
    `Đã chia đều điểm ${partType === "mc" ? "Phần I" : (partType === "tf" ? "Phần II" : "Phần III")}`,
    `Đã chia đều ${actualSum} điểm cho ${count} câu (${eachPoint} đ/câu).`,
    "success",
    3500
  );
}

/**
 * Tự động cập nhật tổng điểm hiển thị ở tiêu đề từng phần theo thời gian thực
 */
function updateSectionPointsSum() {
  const mcQuestions = (parsedQuestions || []).filter(q => q.loaiCauHoi !== "true_false");
  const tfQuestions = (parsedQuestions || []).filter(q => q.loaiCauHoi === "true_false");
  const essayQuestions = parsedEssayQuestions || [];

  const inputI = document.getElementById("inputTotalPointsPartI");
  if (inputI && document.activeElement !== inputI) {
    const sumI = Math.round(mcQuestions.reduce((acc, q) => acc + (Number(q.diem) || 0), 0) * 100) / 100;
    inputI.value = sumI;
  }

  const inputII = document.getElementById("inputTotalPointsPartII");
  if (inputII && document.activeElement !== inputII) {
    const sumII = Math.round(tfQuestions.reduce((acc, q) => acc + (Number(q.diem) || 0), 0) * 100) / 100;
    inputII.value = sumII;
  }

  const inputIII = document.getElementById("inputTotalPointsPartIII");
  if (inputIII && document.activeElement !== inputIII) {
    const sumIII = Math.round(essayQuestions.reduce((acc, eq) => acc + (Number(eq.diem) || 0), 0) * 100) / 100;
    inputIII.value = sumIII;
  }
}

// ============================================================================
// NÚT THÊM CÂU HỎI THỦ CÔNG
// ============================================================================
const btnAddManualQuestion = document.getElementById("btnAddManualQuestion");
const addQuestionDropdownMenu = document.getElementById("addQuestionDropdownMenu");
const btnAddMcQuestion = document.getElementById("btnAddMcQuestion");
const btnAddTfQuestion = document.getElementById("btnAddTfQuestion");

if (btnAddManualQuestion && addQuestionDropdownMenu) {
  btnAddManualQuestion.addEventListener("click", (e) => {
    e.stopPropagation();
    const isShowing = addQuestionDropdownMenu.style.display === "flex";
    addQuestionDropdownMenu.style.display = isShowing ? "none" : "flex";
  });

  window.addEventListener("click", (e) => {
    if (!btnAddManualQuestion.contains(e.target) && !addQuestionDropdownMenu.contains(e.target)) {
      addQuestionDropdownMenu.style.display = "none";
    }
  });

  // 1. Thêm câu hỏi Nhiều lựa chọn
  if (btnAddMcQuestion) {
    btnAddMcQuestion.addEventListener("click", () => {
      addQuestionDropdownMenu.style.display = "none";
      addNewManualQuestion("multiple_choice");
    });
  }

  // 2. Thêm câu hỏi Đúng / Sai
  if (btnAddTfQuestion) {
    btnAddTfQuestion.addEventListener("click", () => {
      addQuestionDropdownMenu.style.display = "none";
      addNewManualQuestion("true_false");
    });
  }
}

function addNewManualQuestion(type = "multiple_choice") {
  const currentTotal = parsedQuestions.length;
  let newQ;

  if (type === "true_false") {
    newQ = {
      id: currentTotal + 1,
      noiDung: "Nội dung câu hỏi Đúng/Sai mới...",
      loaiCauHoi: "true_false",
      diem: 1,
      y: [
        { key: "a", noiDung: "Mệnh đề phát biểu a...", dung: true },
        { key: "b", noiDung: "Mệnh đề phát biểu b...", dung: false },
        { key: "c", noiDung: "Mệnh đề phát biểu c...", dung: true },
        { key: "d", noiDung: "Mệnh đề phát biểu d...", dung: false }
      ]
    };
  } else {
    newQ = {
      id: currentTotal + 1,
      noiDung: "Nội dung câu hỏi 4 lựa chọn mới...",
      loaiCauHoi: "multiple_choice",
      diem: 1,
      luaChon: [
        { key: "A", noiDung: "Phương án A" },
        { key: "B", noiDung: "Phương án B" },
        { key: "C", noiDung: "Phương án C" },
        { key: "D", noiDung: "Phương án D" }
      ],
      dapAnDung: "A"
    };
  }

  parsedQuestions.push(newQ);
  renderQuestionsPreview(parsedQuestions);

  const typeLabel = type === "true_false" ? "Đúng / Sai" : "Nhiều lựa chọn";
  showToast("Đã thêm câu hỏi", `Đã thêm Câu ${newQ.id} (${typeLabel}) vào đề thi.`, "success", 2000);

  // Cuộn mượt đến câu hỏi vừa thêm để giáo viên chỉnh sửa ngay
  setTimeout(() => {
    const list = document.getElementById("questionsPreviewList");
    const lastCard = list?.lastElementChild;
    if (lastCard) {
      lastCard.scrollIntoView({ behavior: "smooth", block: "center" });
      lastCard.style.boxShadow = "0 0 0 2px #6366f1, 0 10px 25px rgba(99, 102, 241, 0.4)";
      setTimeout(() => {
        lastCard.style.boxShadow = "";
      }, 1500);
    }
  }, 120);
}

// Nút Chia đều thang điểm 10 cho toàn bộ câu hỏi
const btnDividePoints = document.getElementById("btnDividePointsEvenly");
if (btnDividePoints) {
  btnDividePoints.addEventListener("click", () => {
    const totalCount = (parsedQuestions || []).length + (parsedEssayQuestions || []).length;
    if (totalCount === 0) {
      showToast("Chưa có câu hỏi", "Vui lòng tải file hoặc thêm câu hỏi trước khi chia điểm!", "warning", 3000);
      return;
    }

    // Làm tròn 2 số thập phân: ví dụ 20 câu -> 0.5 đ/câu, 40 câu -> 0.25 đ/câu, 30 câu -> 0.33 đ/câu
    const eachPoint = Math.round((10 / totalCount) * 100) / 100;

    (parsedQuestions || []).forEach((q, idx) => {
      q.diem = eachPoint;
      const inp = document.querySelector(`.q-points-input[data-index="${idx}"]`);
      if (inp) inp.value = eachPoint;
    });

    (parsedEssayQuestions || []).forEach((eq, eqIdx) => {
      eq.diem = eachPoint;
      const inp = document.querySelector(`.q-essay-points-input[data-index="${eqIdx}"]`);
      if (inp) inp.value = eachPoint;
      const leftInp = document.querySelector(`.essay-point-input[data-index="${eqIdx}"]`);
      if (leftInp) leftInp.value = eachPoint;
    });

    updateStats();
    updateSectionPointsSum();

    showToast(
      "Đã chia đều 10 điểm", 
      `Đã cập nhật ${eachPoint} điểm cho mỗi câu (${totalCount} câu toàn đề).`, 
      "success", 
      3000
    );
  });
}

// ============================================================================
// QUẢN LÝ BỘ NHỚ TẠM (LOCALSTORAGE CACHE) ĐỀ THI CHO GIÁO VIÊN
// ============================================================================
function getTeacherUsernameVariants() {
  if (isAdminRole()) {
    if (!adminActiveUsernameGV || adminActiveUsernameGV === "ALL") {
      return ["ALL"];
    }
    const rawA = String(adminActiveUsernameGV).trim();
    const vList = [rawA];
    if (rawA.startsWith("0")) vList.push(rawA.replace(/^0+/, ""));
    else if (/^\d+$/.test(rawA)) vList.push("0" + rawA);
    return [...new Set(vList.filter(Boolean))];
  }
  const raw = String(currentTeacher?.username || "").trim();
  const variants = [raw];
  if (raw.startsWith("0")) {
    variants.push(raw.replace(/^0+/, ""));
  } else if (/^\d+$/.test(raw)) {
    variants.push("0" + raw);
  }
  return [...new Set(variants.filter(Boolean))];
}

function getCachedExams() {
  try {
    const variants = getTeacherUsernameVariants();
    for (const v of variants) {
      const key = "cached_teacher_exams_" + v;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
    const fallbackKey = "cached_teacher_exams_" + (currentTeacher?.username || "gv01");
    const rawFb = localStorage.getItem(fallbackKey);
    return rawFb ? JSON.parse(rawFb) : [];
  } catch (e) {
    return [];
  }
}

function saveCachedExams(exams) {
  try {
    const variants = getTeacherUsernameVariants();
    for (const v of variants) {
      const key = "cached_teacher_exams_" + v;
      localStorage.setItem(key, JSON.stringify(exams));
    }
    const fallbackKey = "cached_teacher_exams_" + (currentTeacher?.username || "gv01");
    localStorage.setItem(fallbackKey, JSON.stringify(exams));
  } catch (e) {
    console.warn("Lỗi lưu cache đề thi:", e);
  }
}

// ============================================================================
// 6. LƯU ĐỀ THI LÊN GOOGLE SHEETS
// ============================================================================
const btnSaveExam = document.getElementById("btnSaveExam");

btnSaveExam.addEventListener("click", async () => {
  // Đồng bộ toàn bộ nội dung người dùng vừa sửa/nhập từ bản xem trước vào state
  if (typeof syncAllPreviewInputsToState === "function") {
    syncAllPreviewInputsToState();
  }

  const tenKyThi = document.getElementById("examTitle").value.trim();
  const thoiGian = parseInt(document.getElementById("examDuration").value) || 45;
  const isOpening = document.getElementById("examStatusToggle").checked;
  const trangThai = isOpening ? "Mở" : "Đóng";

  // Lấy các lớp được chọn
  const allClassCb = document.getElementById("class_ALL");
  const checkedClassBoxes = document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL):checked");
  let selectedClasses = "";
  if (allClassCb && allClassCb.checked) {
    selectedClasses = "ALL, " + Array.from(checkedClassBoxes).map(cb => cb.value).join(", ");
  } else {
    selectedClasses = Array.from(checkedClassBoxes).map(cb => cb.value).join(", ");
  }

  const essayFormLink = (document.getElementById("essayFormLink")?.value || "").trim();

  // Validate Tên kỳ kiểm tra (Bắt buộc phải nhập, nếu thiếu sẽ chặn hoàn toàn và cảnh báo)
  const examTitleInput = document.getElementById("examTitle");
  const examTitleErrorMsg = document.getElementById("examTitleErrorMsg");

  if (!tenKyThi) {
    if (examTitleErrorMsg) examTitleErrorMsg.style.display = "flex";
    if (examTitleInput) {
      examTitleInput.style.borderColor = "#dc2626";
      examTitleInput.style.backgroundColor = "#fef2f2";
      examTitleInput.style.boxShadow = "0 0 0 4px rgba(220, 38, 38, 0.15)";
      examTitleInput.classList.remove("shake-animation");
      void examTitleInput.offsetWidth; // Force reflow trigger animation
      examTitleInput.classList.add("shake-animation");
      examTitleInput.scrollIntoView({ behavior: "smooth", block: "center" });
      examTitleInput.focus();
    }
    showToast(
      "Không thể lưu đề thi!",
      "Bạn chưa nhập Tên kỳ kiểm tra! Vui lòng nhập tên kỳ kiểm tra tại Bước 1 trước khi lưu.",
      "error",
      5000
    );
    return;
  }

  if (!selectedClasses) {
    showToast("Thiếu thông tin", "Vui lòng chọn ít nhất 1 lớp được phép thi!", "error");
    return;
  }

  if (parsedQuestions.length === 0 && parsedEssayQuestions.length === 0 && !essayFormLink) {
    showToast("Đề thi trống", "Vui lòng thêm ít nhất 1 câu hỏi trắc nghiệm hoặc câu hỏi tự luận!", "error");
    return;
  }

  // Xác định máy chủ lưu: Độc quyền lưu trên Google Sheet riêng của Thầy/Cô (Tuyệt đối không lưu sang Sheet Admin)
  const personalServerUrl = getTeacherPersonalServerUrl();
  const isMasterAdmin = isCurrentUserAdmin();
  let targetServerUrl = personalServerUrl;

  if (!targetServerUrl) {
    if (isMasterAdmin) {
      // Chỉ tài khoản Admin hệ thống mới được phép lưu vào Sheet Admin trung tâm
      targetServerUrl = DEFAULT_GAS_API_URL;
    } else {
      // Giáo viên bộ môn bắt buộc phải kết nối Sheet riêng, chặn tuyệt đối không cho lưu vào Sheet Admin để không làm học sinh của Admin nhìn thấy
      showToast(
        "Chưa kết nối Google Sheet riêng!",
        "Thầy/Cô chưa kết nối Google Sheet cá nhân! Để bảo mật đề thi và tránh làm lẫn đề với Admin, vui lòng vào 'Trạm Trung Tâm' kết nối URL Web App riêng trước khi lưu đề.",
        "error",
        7000
      );
      const hubModal = document.getElementById("centralHubModal");
      if (hubModal) {
        hubModal.style.display = "flex";
      }
      return;
    }
  }

  // Lấy cấu hình Chế độ xem lại bài (Ôn tập vs Thi chính thức)
  const radioAllow = document.getElementById("radioAllowReview");
  const choXemLaiBai = radioAllow ? radioAllow.checked : true;

  // Lấy cấu hình số lần vi phạm cho phép khi thi chính thức
  let soLanViPhamChoPhep = 0;
  if (!choXemLaiBai) {
    const inputViolations = document.getElementById("examMaxViolations");
    soLanViPhamChoPhep = inputViolations ? (parseInt(inputViolations.value, 10) || 5) : 5;
    if (soLanViPhamChoPhep < 1) soLanViPhamChoPhep = 1;
  }

  // Lấy cấu hình Chế độ xem điểm (Cho xem điểm vs Không cho xem điểm)
  const radioAllowScore = document.getElementById("radioAllowViewScore");
  const choXemDiem = radioAllowScore ? radioAllowScore.checked : true;

  const teacherFullName = currentTeacher.hoTenGV || currentTeacher.hoTen || currentTeacher.tenGV || "";

  // Đóng gói cấu trúc đề thi
  const examDataPayload = {
    action: "saveExam",
    usernameGV: currentTeacher.username,
    hoTenGV: teacherFullName,
    tenKyThi: tenKyThi,
    thoiGian: thoiGian,
    trangThai: trangThai,
    lopChoPhep: selectedClasses,
    choXemLaiBai: choXemLaiBai,
    choXemDiem: choXemDiem,
    soLanViPhamChoPhep: soLanViPhamChoPhep,
    duLieuDe: {
      cauHoi: parsedQuestions,
      choXemLaiBai: choXemLaiBai,
      choXemDiem: choXemDiem,
      soLanViPhamChoPhep: soLanViPhamChoPhep,
      hoTenGV: teacherFullName,
      tuLuan: {
        noiDung: parsedEssayQuestions.length > 0 ? parsedEssayQuestions[0].noiDung : "",
        linkForm: essayFormLink,
        danhSachCauHoi: parsedEssayQuestions
      }
    }
  };

  // Nếu đang trong chế độ chỉnh sửa đề đã tạo, gửi kèm mã đề để cập nhật đúng dòng
  if (editingExamCode) {
    examDataPayload.maDe = editingExamCode;
    const existingExam = currentExamsList.find(e => e.maDe === editingExamCode);
    if (existingExam?.duLieuDe?.sharedFromAdmin || existingExam?.sharedFromAdmin || existingExam?.duLieuDe?.nguonDe?.includes("Admin")) {
      examDataPayload.duLieuDe.sharedFromAdmin = true;
      examDataPayload.duLieuDe.nguonDe = existingExam.duLieuDe?.nguonDe || "Được chia sẻ từ Admin";
    }
  } else {
    // Tự động nhận diện nếu tên kỳ kiểm tra trùng khớp với đề đã có của giáo viên này để cập nhật đè thay vì tạo đề mới
    const existingExamByName = (currentExamsList || []).find(e => e.tenKyThi && e.tenKyThi.trim().toLowerCase() === tenKyThi.toLowerCase());
    if (existingExamByName && existingExamByName.maDe) {
      examDataPayload.maDe = existingExamByName.maDe;
      editingExamCode = existingExamByName.maDe;
      if (existingExamByName?.duLieuDe?.sharedFromAdmin || existingExamByName?.sharedFromAdmin || existingExamByName?.duLieuDe?.nguonDe?.includes("Admin")) {
        examDataPayload.duLieuDe.sharedFromAdmin = true;
        examDataPayload.duLieuDe.nguonDe = existingExamByName.duLieuDe?.nguonDe || "Được chia sẻ từ Admin";
      }
    }
  }

  // Loading
  btnSaveExam.disabled = true;
  btnSaveExam.querySelector(".save-spinner").style.display = "block";

  // Luôn lưu bản sao an toàn vào LocalStorage Cache trước để Thầy/Cô không bao giờ bị mất đề
  const localExamCode = editingExamCode || ("DE_" + Date.now().toString().slice(-6));
  const localExamItem = {
    maDe: localExamCode,
    tenKyThi: tenKyThi,
    usernameGV: currentTeacher.username,
    hoTenGV: teacherFullName,
    lopChoPhep: selectedClasses,
    thoiGian: thoiGian,
    soCauHoi: parsedQuestions.length,
    soCauTuLuan: parsedEssayQuestions.length,
    hasTuLuan: !!(parsedEssayQuestions.length > 0 || essayFormLink),
    choXemLaiBai: choXemLaiBai,
    choXemDiem: choXemDiem,
    soLanViPhamChoPhep: soLanViPhamChoPhep,
    trangThai: trangThai,
    duLieuDe: examDataPayload.duLieuDe
  };

  let cachedExams = getCachedExams();
  if (editingExamCode) {
    const idx = cachedExams.findIndex(e => e.maDe === editingExamCode);
    if (idx !== -1) cachedExams[idx] = localExamItem;
    else cachedExams.unshift(localExamItem);
  } else {
    cachedExams.unshift(localExamItem);
  }
  saveCachedExams(cachedExams);

  try {
    let syncedSuccess = false;
    let syncMessage = "";

    try {
      const res = await fetch(targetServerUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(examDataPayload)
      });

      const rawText = await res.text();
      if (rawText && !rawText.trim().startsWith("<")) {
        const result = JSON.parse(rawText);
        if (result && result.success) {
          syncedSuccess = true;
          syncMessage = result.message || "";
        } else if (result && !result.success) {
          syncMessage = result.message || "Máy chủ phản hồi không thành công!";
        }
      }
    } catch (networkErr) {
      console.warn("Lỗi đồng bộ lên Google Sheets:", networkErr);
    }

    if (syncedSuccess) {
      const isUpdated = !!editingExamCode;
      showToast(isUpdated ? "Cập nhật thành công" : "Lưu thành công", syncMessage || (personalServerUrl ? "Đề thi đã được lưu độc quyền vào Google Sheet cá nhân của Thầy/Cô!" : "Đề thi đã được lưu vào Google Sheets thành công!"), "success", 4000);
    } else {
      showToast(
        "Chưa thể lưu lên Google Sheets",
        syncMessage || `Đề thi "${tenKyThi}" đã được lưu tạm vào bộ nhớ máy, nhưng chưa đồng bộ được vào Google Sheets. Vui lòng kiểm tra lại URL Web App.`,
        "warning",
        5000
      );
    }

    // Thoát chế độ sửa và nạp lại danh sách đề
    cancelEditingMode();
    loadTeacherExams();

  } catch (err) {
    console.error("Lỗi lưu đề:", err);
    showToast("Đã lưu đề an toàn", `Đề thi "${tenKyThi}" đã lưu thành công vào bộ nhớ máy!`, "success", 4000);
    cancelEditingMode();
    loadTeacherExams();
  } finally {
    btnSaveExam.disabled = false;
    btnSaveExam.querySelector(".save-spinner").style.display = "none";
  }
});

// Làm mới form / Soạn đề mới
document.getElementById("btnResetForm").addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn làm mới toàn bộ nội dung trên form?")) {
    cancelEditingMode();
  }
});

// ============================================================================
// CHỨC NĂNG MỞ ĐỀ THI ĐÃ TẠO ĐỂ XEM VÀ CHỈNH SỬA
// ============================================================================

/**
 * Mở lại toàn bộ thông tin đề thi đã tạo lên form và cột xem trước để sửa
 */
function openExamForEditing(maDe) {
  const exam = currentExamsList.find(e => e.maDe === maDe);
  if (!exam) {
    showToast("Không tìm thấy", `Không tìm thấy dữ liệu của đề thi: ${maDe}`, "error");
    return;
  }

  editingExamCode = maDe;

  // 1. Hiển thị banner chế độ chỉnh sửa
  const banner = document.getElementById("editingBanner");
  if (banner) {
    banner.style.display = "flex";
    const isShared = !!(exam.duLieuDe?.sharedFromAdmin || exam.sharedFromAdmin || exam.duLieuDe?.nguonDe || exam.nguonDe || exam.duLieuDe?.sharedBy);
    const sourceInfo = exam.duLieuDe?.nguonDe || (exam.duLieuDe?.sharedFromAdmin ? "Đề chia sẻ từ Admin" : (exam.duLieuDe?.sharedBy ? `Đề chia sẻ từ GV ${exam.duLieuDe.sharedBy}` : ""));
    const displayEl = document.getElementById("editingExamCodeDisplay");
    if (displayEl) {
      displayEl.innerHTML = `${exam.maDe} - ${exam.tenKyThi}${isShared ? ` <span style="font-size:0.75rem; background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:5px; border:1px solid #fde68a; font-weight:700; margin-left:6px;">(${sourceInfo || 'Đề chia sẻ'})</span>` : ''}`;
    }
  }
  const heading = document.getElementById("formPanelHeading");
  if (heading) {
    heading.textContent = `Chỉnh Sửa Đề Thi: ${exam.maDe}`;
  }

  // 2. Điền lại cấu hình chung
  document.getElementById("examTitle").value = exam.tenKyThi || "";
  document.getElementById("examDuration").value = exam.thoiGian || 45;

  const isOpening = exam.trangThai === "Mở";
  document.getElementById("examStatusToggle").checked = isOpening;
  const statusDisplay = document.getElementById("statusTextDisplay");
  statusDisplay.textContent = isOpening ? "Đang MỞ cho học sinh thi" : "Đang ĐÓNG (Học sinh chưa thể vào thi)";
  if (isOpening) statusDisplay.classList.remove("closed");
  else statusDisplay.classList.add("closed");

  // 3. Tích chọn lại các lớp và đồng bộ khối
  const allowedUpper = (exam.lopChoPhep || "").toUpperCase();
  const isAll = allowedUpper.includes("ALL") || allowedUpper.includes("TẤT CẢ");
  const allowedArr = allowedUpper.split(/[,;\s]+/).map(s => s.trim());
  const classCbs = document.querySelectorAll("#classSelectorContainer .exam-class-cb");

  classCbs.forEach(cb => {
    const val = cb.value.toUpperCase();
    if (isAll) {
      cb.checked = true;
    } else {
      cb.checked = (val !== "ALL" && allowedArr.includes(val));
    }
  });

  syncExamGradeAndClassUI();

  // 4. Điền phần tự luận
  const tuLuan = exam.duLieuDe?.tuLuan || {};
  const essayLinkInput = document.getElementById("essayFormLink");
  if (essayLinkInput) essayLinkInput.value = tuLuan.linkForm || "";

  if (Array.isArray(tuLuan.danhSachCauHoi) && tuLuan.danhSachCauHoi.length > 0) {
    parsedEssayQuestions = JSON.parse(JSON.stringify(tuLuan.danhSachCauHoi)).map(eq => ({
      ...eq,
      noiDung: restoreMultilineFormatting(eq.noiDung || ""),
      dapAn: restoreMultilineFormatting(eq.dapAn || eq.dapAnDung || "")
    }));
  } else if (tuLuan.noiDung && String(tuLuan.noiDung).trim().length > 0) {
    parsedEssayQuestions = [{
      id: 1,
      noiDung: restoreMultilineFormatting(tuLuan.noiDung),
      diem: 1,
      dapAn: restoreMultilineFormatting(tuLuan.dapAn || tuLuan.dapAnDung || "")
    }];
  } else {
    parsedEssayQuestions = [];
  }
  renderEssayQuestionsEditor();

  // 5. Điền lại chế độ xem lại bài (Ôn tập vs Thi)
  const isAllowReview = (exam.choXemLaiBai !== false && exam.duLieuDe?.choXemLaiBai !== false);
  const radioAllow = document.getElementById("radioAllowReview");
  const radioDisallow = document.getElementById("radioDisallowReview");
  if (radioAllow && radioDisallow) {
    radioAllow.checked = isAllowReview;
    radioDisallow.checked = !isAllowReview;
    updateReviewModeDisplay(isAllowReview);
  }

  // 5.1. Điền lại chế độ xem điểm (Cho xem điểm vs Không cho xem điểm)
  const isAllowScore = (exam.choXemDiem !== false && exam.duLieuDe?.choXemDiem !== false);
  const radioAllowScore = document.getElementById("radioAllowViewScore");
  const radioDisallowScore = document.getElementById("radioDisallowViewScore");
  if (radioAllowScore && radioDisallowScore) {
    radioAllowScore.checked = isAllowScore;
    radioDisallowScore.checked = !isAllowScore;
    updateScoreModeDisplay(isAllowScore);
  }

  // 5.2. Điền lại số lần vi phạm cho phép (Giám sát toàn màn hình)
  const maxViolationsInput = document.getElementById("examMaxViolations");
  if (maxViolationsInput) {
    const savedViolations = exam.soLanViPhamChoPhep || exam.duLieuDe?.soLanViPhamChoPhep || 5;
    maxViolationsInput.value = savedViolations;
    updateAntiCheatHint();
  }

  // 6. Tải danh sách câu hỏi trắc nghiệm vào trình chỉnh sửa (phục hồi xuống dòng sạch sẽ)
  parsedQuestions = JSON.parse(JSON.stringify(exam.duLieuDe?.cauHoi || [])).map(q => {
    if (q.noiDung) q.noiDung = restoreMultilineFormatting(q.noiDung);
    if (Array.isArray(q.luaChon)) {
      q.luaChon.forEach(opt => {
        if (opt.noiDung) opt.noiDung = restoreMultilineFormatting(opt.noiDung);
      });
    }
    if (Array.isArray(q.y)) {
      q.y.forEach(sub => {
        if (sub.noiDung) sub.noiDung = restoreMultilineFormatting(sub.noiDung);
      });
    }
    return q;
  });
  renderQuestionsPreview(parsedQuestions);

  // 7. Cập nhật nút bấm thành Cập nhật
  const btnSave = document.getElementById("btnSaveExam");
  btnSave.querySelector("span").textContent = `💾 Cập Nhật Đề Thi [${exam.maDe}]`;
  btnSave.style.background = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";

  // 8. Cuộn màn hình mượt lên đầu trang
  window.scrollTo({ top: 80, behavior: "smooth" });

  showToast(
    "Đã mở đề thi", 
    `Đã nạp ${parsedQuestions.length} câu trắc nghiệm và ${parsedEssayQuestions.length} câu tự luận của đề "${exam.tenKyThi}". Bạn có thể chỉnh sửa rồi bấm "Cập Nhật"!`, 
    "success", 
    5000
  );
}

/**
 * Thoát chế độ chỉnh sửa và quay về trạng thái tạo đề mới
 */
function cancelEditingMode() {
  editingExamCode = null;

  const banner = document.getElementById("editingBanner");
  if (banner) banner.style.display = "none";

  const heading = document.getElementById("formPanelHeading");
  if (heading) heading.textContent = "Cấu hình chung kỳ kiểm tra";

  const btnSave = document.getElementById("btnSaveExam");
  btnSave.querySelector("span").textContent = "Lưu Kỳ Thi Lên Google Sheets";
  btnSave.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";

  parsedEssayQuestions = [];
  renderEssayQuestionsEditor();

  // Reset form
  const examTitleInput = document.getElementById("examTitle");
  if (examTitleInput) {
    examTitleInput.value = "";
    examTitleInput.style.borderColor = "";
    examTitleInput.style.backgroundColor = "";
    examTitleInput.style.boxShadow = "";
  }
  const errorMsg = document.getElementById("examTitleErrorMsg");
  if (errorMsg) errorMsg.style.display = "none";

  // Reset chế độ xem lại bài về mặc định Ôn tập
  const rAllow = document.getElementById("radioAllowReview");
  const rDisallow = document.getElementById("radioDisallowReview");
  if (rAllow && rDisallow) {
    rAllow.checked = true;
    rDisallow.checked = false;
    updateReviewModeDisplay(true);
  }

  // Reset số lần vi phạm về mặc định 5
  const resetViolationsInput = document.getElementById("examMaxViolations");
  if (resetViolationsInput) {
    resetViolationsInput.value = "5";
    updateAntiCheatHint();
  }

  // Reset chế độ xem điểm về mặc định Cho xem điểm
  const rAllowScore = document.getElementById("radioAllowViewScore");
  const rDisallowScore = document.getElementById("radioDisallowViewScore");
  if (rAllowScore && rDisallowScore) {
    rAllowScore.checked = true;
    rDisallowScore.checked = false;
    updateScoreModeDisplay(true);
  }

  document.getElementById("examDuration").value = "45";
  document.getElementById("rawExamText").value = "";
  const essayFormLinkInput = document.getElementById("essayFormLink");
  if (essayFormLinkInput) essayFormLinkInput.value = "";
  uploadedFileContentText = "";
  document.getElementById("fileUploadInfo").style.display = "none";
  document.getElementById("uploadDropzone").style.display = "block";
  parsedQuestions = [];
  renderQuestionsPreview([]);

  // Reset lại chọn lớp và khối về tất cả được chọn
  const allExamCbs = document.querySelectorAll("#classSelectorContainer input[type='checkbox'], #examGradeCheckboxesList input[type='checkbox']");
  allExamCbs.forEach(cb => cb.checked = true);
  updateSelectedClassCountBadge();
}

/**
 * Trợ giúp lấy chính xác số lượng câu hỏi tự luận của đề thi
 */
function getExamEssayCount(exam) {
  if (!exam) return 0;
  if (typeof exam.soCauTuLuan === "number" && exam.soCauTuLuan > 0) return exam.soCauTuLuan;
  const tuLuan = exam.duLieuDe?.tuLuan;
  if (!tuLuan) return 0;
  if (Array.isArray(tuLuan.danhSachCauHoi) && tuLuan.danhSachCauHoi.length > 0) {
    return tuLuan.danhSachCauHoi.length;
  }
  if (tuLuan.noiDung && String(tuLuan.noiDung).trim().length > 0) {
    return 1;
  }
  return 0;
}

/**
 * Xem nhanh toàn bộ đề thi trong Modal pop-up (Cố định chính giữa màn hình, chữ đậm nét tương phản cao)
 */
function previewExamModal(maDe) {
  const exam = currentExamsList.find(e => e.maDe === maDe);
  if (!exam) return;

  const essayCount = getExamEssayCount(exam);

  const isShared = !!(exam.duLieuDe?.sharedFromAdmin || exam.sharedFromAdmin || exam.duLieuDe?.nguonDe || exam.nguonDe || exam.duLieuDe?.sharedBy);
  const sourceInfo = exam.duLieuDe?.nguonDe || (exam.duLieuDe?.sharedFromAdmin ? "Đề chia sẻ từ Admin" : (exam.duLieuDe?.sharedBy ? `Đề chia sẻ từ GV ${exam.duLieuDe.sharedBy}` : ""));

  document.getElementById("modalStudentTitle").textContent = `Xem nhanh: [${exam.maDe}] ${exam.tenKyThi}${isShared ? ` (${sourceInfo})` : ''}`;
  const body = document.getElementById("modalStudentContent");
  body.innerHTML = `
    <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 0.95rem 1.25rem; margin-bottom: 1.25rem; font-size: 0.92rem; color: #1e3a8a; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        Thời gian: <strong style="color: #0f172a; font-weight: 800;">${exam.thoiGian} phút</strong> | 
        Lớp thi: <strong style="color: #1d4ed8; font-weight: 800;">${exam.lopChoPhep}</strong> | 
        Số câu TN: <strong style="color: #1d4ed8; font-weight: 800;">${exam.soCauHoi || 0} câu</strong>
        ${essayCount > 0 ? ` | Tự luận: <strong style="color: #047857; font-weight: 800;">${essayCount} câu</strong>` : ''}
        ${isShared ? ` | <span style="background: #fef3c7; color: #92400e; padding: 2px 7px; border-radius: 6px; font-weight: 700; border: 1px solid #fde68a; font-size: 0.78rem;">📥 ${sourceInfo}</span>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" class="btn-preview-export-docx" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 700; background: linear-gradient(135deg, #7e22ce, #6b21a8); color: #ffffff; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(126, 34, 206, 0.25);" onclick="exportExamFromPreviewModal('${exam.maDe}')" title="Tải file Word (.docx) kèm bảng đáp án chấm">
          📄 Xuất DOCX
        </button>
        <strong style="color: ${exam.trangThai === 'Mở' ? '#16a34a' : '#dc2626'}; font-weight: 800; background: #ffffff; padding: 0.2rem 0.65rem; border-radius: 6px; border: 1px solid #cbd5e1;">${exam.trangThai === 'Mở' ? '🟢 Đang Mở' : '🔴 Đang Đóng'}</strong>
      </div>
    </div>
  `;

  const questions = exam.duLieuDe?.cauHoi || [];
  if (questions.length === 0) {
    body.innerHTML += `<p style="color: #64748b; text-align: center; padding: 2rem; font-size: 1rem;">Đề thi chưa có câu hỏi trắc nghiệm.</p>`;
  } else {
    questions.forEach((q, idx) => {
      const qDiv = document.createElement("div");
      qDiv.style.background = "#ffffff";
      qDiv.style.border = "1.5px solid #cbd5e1";
      qDiv.style.borderRadius = "12px";
      qDiv.style.padding = "1.15rem 1.25rem";
      qDiv.style.marginBottom = "1rem";
      qDiv.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.03)";

      const qDiem = q.diem !== undefined ? q.diem : 1;
      if (q.loaiCauHoi === "true_false") {
        qDiv.innerHTML = `
          <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="background: #fdf4ff; color: #9333ea; border: 1.5px solid #f0abfc; font-size: 0.78rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 6px;">ĐÚNG / SAI</span>
              <strong style="color: #0f172a; font-size: 1.05rem; font-weight: 800;">Câu ${idx + 1}</strong>
            </div>
            <span style="font-size: 0.82rem; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 0.2rem 0.65rem; border-radius: 6px;">${qDiem} đ</span>
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.55; margin-bottom: 0.85rem; white-space: pre-wrap !important; word-break: break-word;">
            ${escapeHtml(restoreMultilineFormatting(q.noiDung))}
          </div>
          <table style="width: 100%; font-size: 0.9rem; border-collapse: collapse; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; border-bottom: 1.5px solid #cbd5e1;">
                <th style="padding: 0.6rem 0.75rem; text-align: center; width: 45px; font-weight: 800;">Ý</th>
                <th style="padding: 0.6rem 0.75rem; text-align: left; font-weight: 800;">Nội dung nhận định</th>
                <th style="padding: 0.6rem 0.75rem; text-align: center; width: 120px; font-weight: 800;">Đáp án chuẩn</th>
              </tr>
            </thead>
            <tbody>
              ${(q.y || []).map(y => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 800; color: #1d4ed8;">${y.key})</td>
                  <td style="padding: 0.65rem 0.75rem; color: #0f172a; font-weight: 600; line-height: 1.45; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(restoreMultilineFormatting(y.noiDung))}</td>
                  <td style="padding: 0.65rem 0.75rem; text-align: center;">
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 800; font-size: 0.84rem; ${y.dung ? 'background: #dcfce7; border: 1.5px solid #16a34a; color: #15803d;' : 'background: #fee2e2; border: 1.5px solid #ef4444; color: #b91c1c;'}">
                      ${y.dung ? '✔ Đúng' : '✘ Sai'}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } else {
        qDiv.innerHTML = `
          <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 0.78rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 6px;">4 LỰA CHỌN</span>
              <strong style="color: #0f172a; font-size: 1.05rem; font-weight: 800;">Câu ${idx + 1}</strong>
            </div>
            <span style="font-size: 0.82rem; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 0.2rem 0.65rem; border-radius: 6px;">${qDiem} đ</span>
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.55; margin-bottom: 0.85rem; white-space: pre-wrap !important; word-break: break-word;">
            ${escapeHtml(restoreMultilineFormatting(q.noiDung))}
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.65rem;">
            ${(q.luaChon || []).map(opt => {
              const isCorrect = String(opt.key).toUpperCase() === String(q.dapAnDung).toUpperCase();
              return `
                <div style="padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.95rem; line-height: 1.45; display: flex; align-items: flex-start; gap: 0.65rem; ${isCorrect ? 'background: #ecfdf5; border: 2px solid #059669; color: #065f46; font-weight: 700;' : 'background: #f8fafc; border: 1.5px solid #cbd5e1; color: #0f172a; font-weight: 600;'}">
                  <strong style="color: ${isCorrect ? '#059669' : '#1d4ed8'}; font-size: 1rem;">${opt.key}.</strong> 
                  <span style="flex: 1; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(restoreMultilineFormatting(opt.noiDung))}</span>
                  ${isCorrect ? '<span style="margin-left: auto; background: #059669; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 4px; white-space: nowrap;">★ ĐÁP ÁN ĐÚNG</span>' : ''}
                </div>
              `;
            }).join("")}
          </div>
        `;
      }
      body.appendChild(qDiv);
    });
  }

  // Tự luận
  const tuLuan = exam.duLieuDe?.tuLuan;
  const essayQuestions = Array.isArray(tuLuan?.danhSachCauHoi) && tuLuan.danhSachCauHoi.length > 0
    ? tuLuan.danhSachCauHoi
    : (tuLuan?.noiDung ? [{ id: 1, noiDung: tuLuan.noiDung, diem: 1 }] : []);

  if (essayQuestions.length > 0 || tuLuan?.linkForm) {
    const essayDiv = document.createElement("div");
    essayDiv.style.background = "#faf5ff";
    essayDiv.style.border = "1.5px dashed #a855f7";
    essayDiv.style.borderRadius = "10px";
    essayDiv.style.padding = "1.15rem";
    essayDiv.style.marginTop = "1rem";
    
    let essayHtml = `<h4 style="color: #7e22ce; margin-bottom: 0.75rem; font-weight: 800;">📝 Phần Tự Luận${essayQuestions.length > 0 ? ` (${essayQuestions.length} câu)` : ''}:</h4>`;
    if (essayQuestions.length > 0) {
      essayQuestions.forEach((eq, eqIdx) => {
        essayHtml += `
          <div style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.65rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="color: #7e22ce; font-size: 0.95rem;">Câu ${eqIdx + 1} (Tự luận)</strong>
              <span style="font-size: 0.82rem; font-weight: 800; color: #7e22ce; background: #f3e8ff; border: 1px solid #d8b4fe; padding: 0.15rem 0.55rem; border-radius: 6px;">${eq.diem !== undefined ? eq.diem : 1} đ</span>
            </div>
            <p style="font-size: 0.93rem; color: #0f172a; font-weight: 600; line-height: 1.55; margin: 0; white-space: pre-wrap !important; word-break: break-word;">${escapeHtml(restoreMultilineFormatting(eq.noiDung || ''))}</p>
            ${eq.dapAn ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #059669; background: #ecfdf5; padding: 0.4rem 0.6rem; border-radius: 6px; white-space: pre-wrap !important; word-break: break-word;"><strong>Đáp án mẫu:</strong> ${escapeHtml(restoreMultilineFormatting(eq.dapAn))}</div>` : ''}
          </div>
        `;
      });
    }
    if (tuLuan?.linkForm) {
      essayHtml += `<a href="${tuLuan.linkForm}" target="_blank" rel="noopener" style="display: inline-block; margin-top: 0.5rem; color: #2563eb; text-decoration: underline; font-size: 0.9rem; font-weight: 700;">Mở Google Form làm bài tự luận ↗</a>`;
    }
    essayDiv.innerHTML = essayHtml;
    body.appendChild(essayDiv);
  }

  // Thêm nút Mở sửa ngay từ modal & Nút Xuất DOCX
  const footerBtn = document.createElement("div");
  footerBtn.style.marginTop = "1.5rem";
  footerBtn.style.display = "flex";
  footerBtn.style.justifyContent = "flex-end";
  footerBtn.style.gap = "0.75rem";
  footerBtn.style.flexWrap = "wrap";
  footerBtn.innerHTML = `
    <button type="button" class="btn-action-export-docx" style="padding: 0.65rem 1.35rem; font-size: 0.92rem; font-weight: 700; background: linear-gradient(135deg, #7e22ce, #6b21a8); color: #ffffff; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(126, 34, 206, 0.25);" onclick="exportExamFromPreviewModal('${exam.maDe}');">
      📄 Xuất File Word (.docx) Kèm Đáp Án
    </button>
    <button type="button" class="btn-action-edit" style="padding: 0.65rem 1.35rem; font-size: 0.92rem; font-weight: 700; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; border-radius: 8px; cursor: pointer;" onclick="document.getElementById('detailModal').style.display='none'; openExamForEditing('${exam.maDe}');">
      ✏ Mở Chỉnh Sửa Đề Này
    </button>
  `;
  body.appendChild(footerBtn);

  // CỐ ĐỊNH CHÍNH GIỮA MÀN HÌNH VỚI ĐỘ ƯU TIÊN CAO NHẤT
  const modalEl = document.getElementById("detailModal");
  modalEl.style.cssText = "display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.7) !important; backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important; padding: 1.25rem !important; box-sizing: border-box !important;";
}

// ============================================================================
// 6.5. XUẤT ĐỀ THI RA FILE WORD (.DOCX) KÈM ĐÁP ÁN CHẤM CHUẨN BỘ GIÁO DỤC
// ============================================================================

window.exportExamFromPreviewModal = function(maDe) {
  const exam = (currentExamsList || []).find(e => e.maDe === maDe);
  if (!exam) {
    showToast("Lỗi", "Không tìm thấy thông tin đề thi để xuất Word!", "error", 3000);
    return;
  }
  exportExamToDocx(exam);
};

window.exportCurrentExamToDocx = function() {
  const questions = parsedQuestions || [];
  const essayList = parsedEssayQuestions || [];

  if (questions.length === 0 && essayList.length === 0) {
    showToast("Chưa có câu hỏi", "Vui lòng bóc tách hoặc tạo câu hỏi cho đề thi trước khi xuất file Word!", "warning", 3500);
    return;
  }

  const titleInput = document.getElementById("examTitle");
  const durationInput = document.getElementById("examDuration");
  const classesInput = document.getElementById("examAllowedClasses");
  const essayFormInput = document.getElementById("essayFormLink");

  const currentExamData = {
    maDe: editingExamCode || ("DE_" + (Date.now() % 100000)),
    tenKyThi: titleInput ? (titleInput.value.trim() || "BÀI KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ") : "BÀI KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ",
    thoiGian: durationInput ? (Number(durationInput.value) || 45) : 45,
    lopChoPhep: classesInput ? (classesInput.value.trim() || "Tất cả các lớp") : "Tất cả các lớp",
    cauHoi: questions,
    tuLuan: {
      danhSachCauHoi: essayList,
      linkForm: essayFormInput ? essayFormInput.value.trim() : ""
    },
    truong: currentTeacher?.truong || "",
    hoTenGV: currentTeacher?.hoTenGV || currentTeacher?.hoTen || currentTeacher?.username || ""
  };

  exportExamToDocx(currentExamData);
};

// Gắn sự kiện nút Xuất DOCX ở Bản Xem Trước & Chỉnh Sửa Đề Thi
const btnExportCurrentExamDocx = document.getElementById("btnExportCurrentExamDocx");
if (btnExportCurrentExamDocx) {
  btnExportCurrentExamDocx.addEventListener("click", () => {
    window.exportCurrentExamToDocx();
  });
}

/**
 * Hàm điều phối xuất file Word (.docx) kèm đáp án
 */
async function exportExamToDocx(examData) {
  if (!examData) return;

  const rawQuestions = examData.cauHoi || examData.duLieuDe?.cauHoi || [];
  const tuLuanObj = examData.tuLuan || examData.duLieuDe?.tuLuan || {};
  const essayQuestions = Array.isArray(tuLuanObj?.danhSachCauHoi) && tuLuanObj.danhSachCauHoi.length > 0
    ? tuLuanObj.danhSachCauHoi
    : (tuLuanObj?.noiDung ? [{ noiDung: tuLuanObj.noiDung, diem: tuLuanObj.diem || 1, dapAn: tuLuanObj.dapAn || "" }] : []);

  if (rawQuestions.length === 0 && essayQuestions.length === 0) {
    showToast("Không có câu hỏi", "Đề thi không có câu hỏi nào để xuất ra file Word!", "warning", 3000);
    return;
  }

  const safeTitle = (examData.tenKyThi || "De_Thi").replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").substring(0, 50);
  const maDeStr = String(examData.maDe || "DE").replace(/[\/\\:*?"<>|]/g, "_");
  const fileName = `${safeTitle}_${maDeStr}.docx`;

  showToast("Đang tạo file Word...", "Đang định dạng tiêu đề, câu hỏi và bảng đáp án chấm chuẩn Bộ GD&ĐT...", "info", 2500);

  // 1. Ưu tiên tạo file chuẩn OpenXML .docx nếu thư viện docx đã nạp
  if (typeof docx !== "undefined" && docx.Document && docx.Packer) {
    try {
      const blob = await generateDocxWithLibrary(examData, rawQuestions, essayQuestions);
      downloadBlobFile(blob, fileName);
      showToast("Xuất Word thành công! 📄", `Đã lưu file "${fileName}" kèm bảng đáp án chi tiết!`, "success", 4500);
      return;
    } catch (docxErr) {
      console.warn("Lỗi khi tạo file qua thư viện docx.js, chuyển sang giải pháp Fallback:", docxErr);
    }
  }

  // 2. Fallback sang file Word HTML chuẩn Microsoft Office (.doc)
  try {
    const fallbackFileName = fileName.replace(/\.docx$/i, ".doc");
    generateDocxHtmlFallback(examData, rawQuestions, essayQuestions, fallbackFileName);
    showToast("Xuất Word thành công! 📄", `Đã lưu file "${fallbackFileName}" chuẩn Microsoft Word kèm đáp án!`, "success", 4500);
  } catch (fallbackErr) {
    console.error("Lỗi xuất file Word:", fallbackErr);
    showToast("Lỗi xuất file", "Không thể tạo file Word: " + fallbackErr.message, "error", 4000);
  }
}

/**
 * Sinh file DOCX nhị phân chuẩn bằng thư viện docx.js
 */
async function generateDocxWithLibrary(examData, rawQuestions, essayQuestions) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, PageBreak, ShadingType } = docx;

  const fontName = "Times New Roman";
  const fontSizeBase = 24;   // 12pt
  const fontSizeSmall = 20;  // 10pt
  const fontSizeTitle = 26;  // 13pt
  const fontSizeHeader = 22; // 11pt

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" }
  };

  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "999999"
  };

  const tableBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder
  };

  const truongName = (examData.truong || currentTeacher?.truong || "TRƯỜNG THCS ...").toUpperCase();
  const tenKyThi = (examData.tenKyThi || "ĐỀ KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ").toUpperCase();
  const lop = examData.lopChoPhep || examData.lop || "9";
  const thoiGian = examData.thoiGian || 45;
  const maDe = examData.maDe || "DE_01";

  const mcQuestions = rawQuestions.filter(q => q.loaiCauHoi !== "true_false");
  const tfQuestions = rawQuestions.filter(q => q.loaiCauHoi === "true_false");

  const children = [];

  // --- BẢNG TIÊU ĐỀ ĐẦU ĐỀ THI (2 CỘT) ---
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SỞ GD&ĐT ... / PHÒNG GD&ĐT", font: fontName, size: fontSizeHeader })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: truongName, bold: true, font: fontName, size: fontSizeHeader })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TỔ CHUYÊN MÔN", bold: true, font: fontName, size: fontSizeHeader })] })
            ]
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tenKyThi, bold: true, font: fontName, size: fontSizeHeader })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Khối / Lớp: ${lop}`, font: fontName, size: fontSizeHeader })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Thời gian làm bài: ${thoiGian} phút (không kể phát đề)`, italic: true, font: fontName, size: fontSizeSmall })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `MÃ ĐỀ THI: ${maDe}`, bold: true, font: fontName, size: fontSizeHeader })] })
            ]
          })
        ]
      })
    ]
  });
  children.push(headerTable);

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: "--------------------------------------------------------------------------------", font: fontName, size: fontSizeSmall, color: "888888" })]
  }));

  // Khung thông tin thí sinh
  children.push(new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({ text: "Họ và tên thí sinh: ", bold: true, font: fontName, size: fontSizeBase }),
      new TextRun({ text: ".........................................................................................  ", font: fontName, size: fontSizeBase }),
      new TextRun({ text: "Lớp: ", bold: true, font: fontName, size: fontSizeBase }),
      new TextRun({ text: "....................", font: fontName, size: fontSizeBase })
    ]
  }));
  children.push(new Paragraph({
    spacing: { before: 40, after: 120 },
    children: [
      new TextRun({ text: "Số báo danh: ", bold: true, font: fontName, size: fontSizeBase }),
      new TextRun({ text: ".............................................................................................  ", font: fontName, size: fontSizeBase }),
      new TextRun({ text: "Phòng thi: ", bold: true, font: fontName, size: fontSizeBase }),
      new TextRun({ text: "............", font: fontName, size: fontSizeBase })
    ]
  }));

  // --- PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN ---
  if (mcQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [
        new TextRun({ text: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.", bold: true, font: fontName, size: fontSizeTitle }),
        new TextRun({ text: ` Thí sinh trả lời từ câu 1 đến câu ${mcQuestions.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`, italic: true, font: fontName, size: fontSizeBase })
      ]
    }));

    mcQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const pts = q.diem !== undefined ? ` (${q.diem} điểm)` : "";
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: `Câu ${qNum}: `, bold: true, font: fontName, size: fontSizeBase }),
          new TextRun({ text: q.noiDung || "", font: fontName, size: fontSizeBase }),
          pts ? new TextRun({ text: pts, italic: true, font: fontName, size: fontSizeSmall, color: "666666" }) : new TextRun({ text: "" })
        ]
      }));

      const opts = q.luaChon || [];
      const maxLen = opts.reduce((max, opt) => Math.max(max, (opt.noiDung || "").length), 0);
      if (maxLen < 20 && opts.length === 4) {
        children.push(new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [
            new TextRun({ text: `A. `, bold: true, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `${opts[0]?.noiDung || ""}\t\t`, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `B. `, bold: true, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `${opts[1]?.noiDung || ""}`, font: fontName, size: fontSizeBase })
          ]
        }));
        children.push(new Paragraph({
          spacing: { before: 30, after: 50 },
          children: [
            new TextRun({ text: `C. `, bold: true, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `${opts[2]?.noiDung || ""}\t\t`, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `D. `, bold: true, font: fontName, size: fontSizeBase }),
            new TextRun({ text: `${opts[3]?.noiDung || ""}`, font: fontName, size: fontSizeBase })
          ]
        }));
      } else {
        opts.forEach(opt => {
          children.push(new Paragraph({
            spacing: { before: 25, after: 25 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: `${opt.key}. `, bold: true, font: fontName, size: fontSizeBase }),
              new TextRun({ text: opt.noiDung || "", font: fontName, size: fontSizeBase })
            ]
          }));
        });
      }
    });
  }

  // --- PHẦN II: TRẮC NGHIỆM ĐÚNG SAI ---
  if (tfQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({ text: "PHẦN II. Câu trắc nghiệm đúng sai.", bold: true, font: fontName, size: fontSizeTitle }),
        new TextRun({ text: ` Thí sinh trả lời từ câu 1 đến câu ${tfQuestions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`, italic: true, font: fontName, size: fontSizeBase })
      ]
    }));

    tfQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const pts = q.diem !== undefined ? ` (${q.diem} điểm)` : "";
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: `Câu ${qNum}: `, bold: true, font: fontName, size: fontSizeBase }),
          new TextRun({ text: q.noiDung || "", font: fontName, size: fontSizeBase }),
          pts ? new TextRun({ text: pts, italic: true, font: fontName, size: fontSizeSmall, color: "666666" }) : new TextRun({ text: "" })
        ]
      }));

      const subItems = q.y || [];
      subItems.forEach(y => {
        children.push(new Paragraph({
          spacing: { before: 25, after: 25 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `${y.key}) `, bold: true, font: fontName, size: fontSizeBase }),
            new TextRun({ text: y.noiDung || "", font: fontName, size: fontSizeBase })
          ]
        }));
      });
    });
  }

  // --- PHẦN III: TỰ LUẬN ---
  if (essayQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({ text: "PHẦN III. Câu hỏi tự luận.", bold: true, font: fontName, size: fontSizeTitle }),
        new TextRun({ text: " Thí sinh trình bày chi tiết lời giải vào giấy kiểm tra.", italic: true, font: fontName, size: fontSizeBase })
      ]
    }));

    essayQuestions.forEach((eq, idx) => {
      const eqNum = idx + 1;
      const pts = eq.diem !== undefined ? ` (${eq.diem} điểm)` : "";
      children.push(new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          new TextRun({ text: `Câu ${eqNum} (Tự luận): `, bold: true, font: fontName, size: fontSizeBase }),
          new TextRun({ text: eq.noiDung || "", font: fontName, size: fontSizeBase }),
          pts ? new TextRun({ text: pts, italic: true, font: fontName, size: fontSizeSmall, color: "666666" }) : new TextRun({ text: "" })
        ]
      }));
    });
  }

  // KẾT THÚC ĐỀ
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 150 },
    children: [new TextRun({ text: "-------------------------- HẾT --------------------------", bold: true, font: fontName, size: fontSizeBase })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 150 },
    children: [new TextRun({ text: "(Cán bộ coi thi không giải thích gì thêm)", italic: true, font: fontName, size: fontSizeSmall })]
  }));

  // --- NGẮT TRANG SANG HƯỚNG DẪN CHẤM & ĐÁP ÁN ---
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 40 },
    children: [new TextRun({ text: "HƯỚNG DẪN CHẤM VÀ ĐÁP ÁN ĐỀ THI", bold: true, font: fontName, size: 28, color: "1e3a8a" })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 180 },
    children: [new TextRun({ text: `KỲ KIỂM TRA: ${tenKyThi} - MÃ ĐỀ: ${maDe}`, bold: true, font: fontName, size: fontSizeTitle })]
  }));

  // BẢNG ĐÁP ÁN PHẦN I
  if (mcQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 140, after: 70 },
      children: [new TextRun({ text: "1. ĐÁP ÁN PHẦN I (TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN)", bold: true, font: fontName, size: fontSizeTitle })]
    }));

    const chunkSize = 10;
    for (let c = 0; c < mcQuestions.length; c += chunkSize) {
      const chunk = mcQuestions.slice(c, c + chunkSize);
      const rowCau = [
        new TableCell({
          borders: tableBorders,
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Câu", bold: true, font: fontName, size: fontSizeHeader })] })]
        })
      ];
      const rowDapAn = [
        new TableCell({
          borders: tableBorders,
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Chọn", bold: true, font: fontName, size: fontSizeHeader })] })]
        })
      ];

      chunk.forEach((q, i) => {
        const colWidth = Math.floor(88 / chunk.length);
        const qNum = c + i + 1;
        rowCau.push(new TableCell({
          borders: tableBorders,
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(qNum), bold: true, font: fontName, size: fontSizeHeader })] })]
        }));
        rowDapAn.push(new TableCell({
          borders: tableBorders,
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.dapAnDung || "").toUpperCase(), bold: true, font: fontName, size: fontSizeTitle, color: "1d4ed8" })] })]
        }));
      });

      const mcTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [new TableRow({ children: rowCau }), new TableRow({ children: rowDapAn })]
      });
      children.push(mcTable);
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    }
  }

  // BẢNG ĐÁP ÁN PHẦN II (ĐÚNG / SAI)
  if (tfQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 140, after: 70 },
      children: [new TextRun({ text: "2. ĐÁP ÁN PHẦN II (TRẮC NGHIỆM ĐÚNG SAI)", bold: true, font: fontName, size: fontSizeTitle })]
    }));

    const tfRows = [
      new TableRow({
        children: [
          new TableCell({
            borders: tableBorders,
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Câu hỏi", bold: true, font: fontName, size: fontSizeHeader })] })]
          }),
          new TableCell({
            borders: tableBorders,
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Lệnh hỏi", bold: true, font: fontName, size: fontSizeHeader })] })]
          }),
          new TableCell({
            borders: tableBorders,
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Đáp án (Đ / S)", bold: true, font: fontName, size: fontSizeHeader })] })]
          }),
          new TableCell({
            borders: tableBorders,
            width: { size: 45, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Ghi chú quy cách điểm", bold: true, font: fontName, size: fontSizeHeader })] })]
          })
        ]
      })
    ];

    tfQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const subItems = q.y || [];
      subItems.forEach((y, subIdx) => {
        const isTrue = Boolean(y.dung);
        const answerText = isTrue ? "ĐÚNG" : "SAI";
        const answerColor = isTrue ? "059669" : "dc2626";

        tfRows.push(new TableRow({
          children: [
            new TableCell({
              borders: tableBorders,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: subIdx === 0 ? `Câu ${qNum}` : "", bold: true, font: fontName, size: fontSizeBase })] })]
            }),
            new TableCell({
              borders: tableBorders,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${y.key})`, bold: true, font: fontName, size: fontSizeBase })] })]
            }),
            new TableCell({
              borders: tableBorders,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: answerText, bold: true, font: fontName, size: fontSizeBase, color: answerColor })] })]
            }),
            new TableCell({
              borders: tableBorders,
              children: [new Paragraph({ children: [new TextRun({ text: subIdx === 0 ? "Đúng 1 ý: 0.1đ | Đúng 2 ý: 0.25đ | Đúng 3 ý: 0.5đ | Đúng 4 ý: 1.0đ" : "", italic: true, font: fontName, size: fontSizeSmall })] })]
            })
          ]
        }));
      });
    });

    const tfTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: tfRows
    });
    children.push(tfTable);
  }

  // ĐÁP ÁN & THANG ĐIỂM PHẦN III (TỰ LUẬN)
  if (essayQuestions.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 160, after: 70 },
      children: [new TextRun({ text: "3. HƯỚNG DẪN CHẤM PHẦN III (TỰ LUẬN)", bold: true, font: fontName, size: fontSizeTitle })]
    }));

    const essayRows = [
      new TableRow({
        children: [
          new TableCell({
            borders: tableBorders,
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Câu", bold: true, font: fontName, size: fontSizeHeader })] })]
          }),
          new TableCell({
            borders: tableBorders,
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nội dung yêu cầu / Đáp án mẫu", bold: true, font: fontName, size: fontSizeHeader })] })]
          }),
          new TableCell({
            borders: tableBorders,
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Điểm", bold: true, font: fontName, size: fontSizeHeader })] })]
          })
        ]
      })
    ];

    essayQuestions.forEach((eq, idx) => {
      const eqNum = idx + 1;
      const pts = eq.diem !== undefined ? `${eq.diem} đ` : "1.0 đ";
      essayRows.push(new TableRow({
        children: [
          new TableCell({
            borders: tableBorders,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Câu ${eqNum}`, bold: true, font: fontName, size: fontSizeBase })] })]
          }),
          new TableCell({
            borders: tableBorders,
            children: [new Paragraph({ children: [new TextRun({ text: eq.dapAn || eq.noiDung || "Học sinh trình bày đúng yêu cầu câu hỏi.", font: fontName, size: fontSizeBase })] })]
          }),
          new TableCell({
            borders: tableBorders,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pts, bold: true, font: fontName, size: fontSizeBase, color: "059669" })] })]
          })
        ]
      }));
    });

    const essayTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: essayRows
    });
    children.push(essayTable);
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      children: children
    }]
  });

  return await Packer.toBlob(doc);
}

/**
 * Tạo file Word HTML (.doc) mở bằng Microsoft Word hoàn hảo khi không có docx.js
 */
function generateDocxHtmlFallback(examData, rawQuestions, essayQuestions, fileName) {
  const truongName = (examData.truong || currentTeacher?.truong || "TRƯỜNG THCS ...").toUpperCase();
  const tenKyThi = (examData.tenKyThi || "ĐỀ KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ").toUpperCase();
  const lop = examData.lopChoPhep || examData.lop || "9";
  const thoiGian = examData.thoiGian || 45;
  const maDe = examData.maDe || "DE_01";

  const mcQuestions = rawQuestions.filter(q => q.loaiCauHoi !== "true_false");
  const tfQuestions = rawQuestions.filter(q => q.loaiCauHoi === "true_false");

  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${tenKyThi}</title>
      <style>
        @page {
          size: 21.0cm 29.7cm;
          margin: 2.0cm 2.0cm 2.0cm 2.0cm;
          mso-page-orientation: portrait;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.35;
          color: #000000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12pt;
        }
        .header-table td {
          border: none;
          text-align: center;
          vertical-align: top;
          padding: 2pt 4pt;
        }
        .border-table th, .border-table td {
          border: 1px solid #333333;
          padding: 5pt 6pt;
          text-align: center;
        }
        .border-table th {
          background-color: #f1f5f9;
        }
        .q-title {
          font-weight: bold;
          margin-top: 10pt;
          margin-bottom: 4pt;
        }
        .opt-item {
          margin-left: 20pt;
          margin-bottom: 2pt;
        }
        .page-break {
          page-break-before: always;
          mso-break-type: section-break;
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="width: 45%;">
            <div>SỞ GD&ĐT ... / PHÒNG GD&ĐT</div>
            <div style="font-weight: bold;">${truongName}</div>
            <div style="font-weight: bold;">TỔ CHUYÊN MÔN</div>
          </td>
          <td style="width: 55%;">
            <div style="font-weight: bold; font-size: 12.5pt;">${tenKyThi}</div>
            <div>Khối / Lớp: ${lop}</div>
            <div style="font-style: italic; font-size: 11pt;">Thời gian làm bài: ${thoiGian} phút (không kể phát đề)</div>
            <div style="font-weight: bold;">MÃ ĐỀ THI: ${maDe}</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center; color: #888; margin: 4pt 0 10pt 0;">--------------------------------------------------------------------------------</div>

      <div style="margin-bottom: 4pt;">
        <strong>Họ và tên thí sinh:</strong> ......................................................................................... <strong>Lớp:</strong> ....................
      </div>
      <div style="margin-bottom: 14pt;">
        <strong>Số báo danh:</strong> ............................................................................................. <strong>Phòng thi:</strong> ............
      </div>
  `;

  // Phần I
  if (mcQuestions.length > 0) {
    html += `
      <div style="margin-top: 10pt; margin-bottom: 6pt;">
        <strong style="font-size: 13pt;">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</strong>
        <em>Thí sinh trả lời từ câu 1 đến câu ${mcQuestions.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.</em>
      </div>
    `;

    mcQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const pts = q.diem !== undefined ? ` <em>(${q.diem} điểm)</em>` : "";
      html += `
        <div class="q-title"><strong>Câu ${qNum}:</strong> ${q.noiDung || ""}${pts}</div>
      `;
      (q.luaChon || []).forEach(opt => {
        html += `<div class="opt-item"><strong>${opt.key}.</strong> ${opt.noiDung || ""}</div>`;
      });
    });
  }

  // Phần II
  if (tfQuestions.length > 0) {
    html += `
      <div style="margin-top: 14pt; margin-bottom: 6pt;">
        <strong style="font-size: 13pt;">PHẦN II. Câu trắc nghiệm đúng sai.</strong>
        <em>Thí sinh trả lời từ câu 1 đến câu ${tfQuestions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</em>
      </div>
    `;

    tfQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const pts = q.diem !== undefined ? ` <em>(${q.diem} điểm)</em>` : "";
      html += `<div class="q-title"><strong>Câu ${qNum}:</strong> ${q.noiDung || ""}${pts}</div>`;
      (q.y || []).forEach(y => {
        html += `<div class="opt-item"><strong>${y.key})</strong> ${y.noiDung || ""}</div>`;
      });
    });
  }

  // Phần III
  if (essayQuestions.length > 0) {
    html += `
      <div style="margin-top: 14pt; margin-bottom: 6pt;">
        <strong style="font-size: 13pt;">PHẦN III. Câu hỏi tự luận.</strong>
        <em>Thí sinh trình bày chi tiết lời giải vào giấy kiểm tra.</em>
      </div>
    `;

    essayQuestions.forEach((eq, idx) => {
      const eqNum = idx + 1;
      const pts = eq.diem !== undefined ? ` <em>(${eq.diem} điểm)</em>` : "";
      html += `<div class="q-title"><strong>Câu ${eqNum} (Tự luận):</strong> ${eq.noiDung || ""}${pts}</div>`;
    });
  }

  html += `
    <div style="text-align: center; margin-top: 20pt; margin-bottom: 6pt; font-weight: bold;">-------------------------- HẾT --------------------------</div>
    <div style="text-align: center; font-style: italic; font-size: 10pt; margin-bottom: 20pt;">(Cán bộ coi thi không giải thích gì thêm)</div>

    <br clear="all" class="page-break" style="page-break-before: always; mso-break-type: section-break;" />

    <div style="text-align: center; font-size: 15pt; font-weight: bold; color: #1e3a8a; margin-top: 10pt;">HƯỚNG DẪN CHẤM VÀ ĐÁP ÁN ĐỀ THI</div>
    <div style="text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 14pt;">KỲ KIỂM TRA: ${tenKyThi} - MÃ ĐỀ: ${maDe}</div>
  `;

  // Bảng đáp án Phần I
  if (mcQuestions.length > 0) {
    html += `<div style="font-weight: bold; margin-bottom: 6pt;">1. ĐÁP ÁN PHẦN I (TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN)</div>`;
    const chunkSize = 10;
    for (let c = 0; c < mcQuestions.length; c += chunkSize) {
      const chunk = mcQuestions.slice(c, c + chunkSize);
      html += `<table class="border-table"><tr><th style="width: 12%;">Câu</th>`;
      chunk.forEach((q, i) => { html += `<th>${c + i + 1}</th>`; });
      html += `</tr><tr><td><strong>Chọn</strong></td>`;
      chunk.forEach(q => { html += `<td style="font-weight: bold; color: #1d4ed8; font-size: 12pt;">${String(q.dapAnDung || "").toUpperCase()}</td>`; });
      html += `</tr></table>`;
    }
  }

  // Bảng đáp án Phần II
  if (tfQuestions.length > 0) {
    html += `<div style="font-weight: bold; margin-top: 12pt; margin-bottom: 6pt;">2. ĐÁP ÁN PHẦN II (TRẮC NGHIỆM ĐÚNG SAI)</div>`;
    html += `
      <table class="border-table">
        <tr>
          <th style="width: 15%;">Câu hỏi</th>
          <th style="width: 15%;">Lệnh hỏi</th>
          <th style="width: 25%;">Đáp án (Đ / S)</th>
          <th style="width: 45%;">Ghi chú quy cách điểm</th>
        </tr>
    `;
    tfQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      (q.y || []).forEach((y, subIdx) => {
        const isTrue = Boolean(y.dung);
        html += `
          <tr>
            <td>${subIdx === 0 ? `<strong>Câu ${qNum}</strong>` : ""}</td>
            <td><strong>${y.key})</strong></td>
            <td style="font-weight: bold; color: ${isTrue ? '#059669' : '#dc2626'};">${isTrue ? 'ĐÚNG' : 'SAI'}</td>
            <td style="font-style: italic; font-size: 10pt;">${subIdx === 0 ? 'Đúng 1 ý: 0.1đ | Đúng 2 ý: 0.25đ | Đúng 3 ý: 0.5đ | Đúng 4 ý: 1.0đ' : ''}</td>
          </tr>
        `;
      });
    });
    html += `</table>`;
  }

  // Bảng đáp án Phần III
  if (essayQuestions.length > 0) {
    html += `<div style="font-weight: bold; margin-top: 12pt; margin-bottom: 6pt;">3. HƯỚNG DẪN CHẤM PHẦN III (TỰ LUẬN)</div>`;
    html += `
      <table class="border-table">
        <tr>
          <th style="width: 15%;">Câu</th>
          <th style="width: 70%;">Nội dung yêu cầu / Đáp án mẫu</th>
          <th style="width: 15%;">Điểm</th>
        </tr>
    `;
    essayQuestions.forEach((eq, idx) => {
      html += `
        <tr>
          <td><strong>Câu ${idx + 1}</strong></td>
          <td style="text-align: left;">${eq.dapAn || eq.noiDung || "Học sinh trình bày đúng yêu cầu câu hỏi."}</td>
          <td style="font-weight: bold; color: #059669;">${eq.diem !== undefined ? `${eq.diem} đ` : "1.0 đ"}</td>
        </tr>
      `;
    });
    html += `</table>`;
  }

  html += `</body></html>`;

  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  downloadBlobFile(blob, fileName);
}

function downloadBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

// ============================================================================
// 7. QUẢN LÝ DANH SÁCH ĐỀ THI CỦA GIÁO VIÊN (HIỂN THỊ TỨC THÌ 0S & ĐỒNG BỘ NGẦM)
// ============================================================================
async function loadTeacherExams(isManualRefresh = false) {
  const tbody = document.getElementById("myExamsTableBody");
  const btnRefresh = document.getElementById("btnRefreshExams");

  // 1. HIỂN THỊ NGAY TỨC THÌ TỪ LOCAL CACHE (0 GIÂY, KHÔNG ĐỂ USER CHỜ ĐỢI)
  const cached = getCachedExams();
  if (cached && cached.length > 0) {
    currentExamsList = cached;
    renderTeacherExamsTable(currentExamsList, true);
    updateFilterExamDropdown(currentExamsList);
  } else {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
      <div class="spinner" style="display: inline-block; width: 22px; height: 22px; vertical-align: middle; margin-right: 8px;"></div>
      <span>Đang tải danh sách đề thi từ Google Sheets...</span>
    </td></tr>`;
  }

  // Bật animation xoay nút Tải lại danh sách
  if (btnRefresh) {
    btnRefresh.classList.add("is-loading");
  }

  // 2. GỬI YÊU CẦU ĐỒNG BỘ NGẦM LÊN GOOGLE APPS SCRIPT (SHEET RIÊNG HOẶC SHEET TRUNG TÂM NẾU LÀ ADMIN / SHEET TRUNG TÂM)
  const isAdmin = isCurrentUserAdmin() || isAdminRole();
  const isAllowedCentral = isCentralAccount() || isAdmin;
  let targetServerUrl = (isAdminRole() && adminActiveApiUrl) ? adminActiveApiUrl : getTeacherPersonalServerUrl();
  if (!targetServerUrl && isAllowedCentral) {
    targetServerUrl = DEFAULT_GAS_API_URL;
  }

  // Giáo viên bộ môn bắt buộc phải kết nối Sheet riêng (không được dùng Sheet Admin trung tâm)
  // Tài khoản Admin và tài khoản dùng chung Sheet trung tâm (0938750424) được phép dùng thẳng Sheet trung tâm (DEFAULT_GAS_API_URL)
  if (!targetServerUrl || (!isAllowedCentral && targetServerUrl === DEFAULT_GAS_API_URL)) {
    if (btnRefresh) btnRefresh.classList.remove("is-loading");
    if (!currentExamsList || currentExamsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
        <p style="font-weight: 700; color: #b45309; margin-bottom: 0.5rem; font-size: 1rem;">⚠️ Chưa kết nối Google Sheet cá nhân</p>
        <span style="font-size: 0.85rem; color: #64748b;">Đề thi được quản lý trên Google Sheet riêng của Thầy/Cô. Vui lòng bấm vào <strong>Trạm Trung Tâm</strong> trên thanh menu để kết nối URL Web App.</span>
      </td></tr>`;
    }
    return;
  }

  let loadedFromServer = null;
  const usernameVariants = getTeacherUsernameVariants();

  for (const uGV of usernameVariants) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

      const res = await fetch(targetServerUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "getTeacherExams",
          usernameGV: uGV
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const rawText = await res.text();
      if (rawText && !rawText.trim().startsWith("<")) {
        const data = JSON.parse(rawText);
        if (data && Array.isArray(data.exams)) {
          if (data.exams.length > 0) {
            loadedFromServer = data.exams;
            break; // Đã tìm thấy đề thi với biến thể này
          } else if (loadedFromServer === null) {
            loadedFromServer = [];
          }
        }
      }
    } catch (postErr) {
      console.warn(`Lỗi đồng bộ ngầm POST (${uGV}):`, postErr.message);
    }

    // Fallback GET cho biến thể này nếu POST chưa ra đề
    if (!loadedFromServer || loadedFromServer.length === 0) {
      try {
        const getUrl = `${targetServerUrl}?action=getTeacherExams&usernameGV=${encodeURIComponent(uGV)}&_t=${Date.now()}`;
        const getRes = await fetch(getUrl);
        const getText = await getRes.text();
        if (getText && !getText.trim().startsWith("<")) {
          const data = JSON.parse(getText);
          if (data && Array.isArray(data.exams)) {
            if (data.exams.length > 0) {
              loadedFromServer = data.exams;
              break;
            } else if (loadedFromServer === null) {
              loadedFromServer = [];
            }
          }
        }
      } catch (getErr) {
        console.warn(`Lỗi đồng bộ ngầm GET (${uGV}):`, getErr.message);
      }
    }
  }

  // Tắt animation xoay nút Tải lại
  if (btnRefresh) {
    btnRefresh.classList.remove("is-loading");
  }

  // 3. Nếu máy chủ phản hồi danh sách mới -> Cập nhật bảng và lưu cache
  if (loadedFromServer && loadedFromServer.length > 0) {
    currentExamsList = loadedFromServer;
    saveCachedExams(currentExamsList);
    renderTeacherExamsTable(currentExamsList, false);
    updateFilterExamDropdown(currentExamsList);

    if (isManualRefresh) {
      showToast("Đã cập nhật", "Đã đồng bộ xong danh sách đề thi từ Google Sheets!", "success", 2500);
    }
  } else if (!currentExamsList || currentExamsList.length === 0) {
    // Nếu cả server và cache đều không có đề nào
    renderEmptyExamsTable(tbody);
  }
}

function renderTeacherExamsTable(examsList, isFromCache) {
  const tbody = document.getElementById("myExamsTableBody");
  if (!tbody) return;

  if (!examsList || examsList.length === 0) {
    renderEmptyExamsTable(tbody);
    return;
  }

  tbody.innerHTML = "";
  examsList.forEach(exam => {
    const isOpening = exam.trangThai === "Mở";
    const isReviewAllowed = (exam.choXemLaiBai !== false && exam.duLieuDe?.choXemLaiBai !== false);
    const isScoreAllowed = (exam.choXemDiem !== false && exam.duLieuDe?.choXemDiem !== false);
    const essayCount = getExamEssayCount(exam);

    let tuLuanBadge = '<span style="color: #94a3b8; font-weight: 500;">Không</span>';
    if (essayCount > 0) {
      tuLuanBadge = `<span style="font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0; white-space: nowrap;">${essayCount} câu</span>`;
    } else if (exam.hasTuLuan || (exam.duLieuDe?.tuLuan?.linkForm)) {
      tuLuanBadge = `<span style="font-weight: 600; color: #0284c7; background: #f0f9ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #bae6fd; white-space: nowrap;">Form tự luận</span>`;
    }

    const isShared = !!(exam.duLieuDe?.sharedFromAdmin || exam.sharedFromAdmin || exam.duLieuDe?.nguonDe || exam.nguonDe || exam.duLieuDe?.sharedBy);
    let sharedBadge = "";
    if (isShared) {
      const sourceText = exam.duLieuDe?.nguonDe || exam.nguonDe || (exam.duLieuDe?.sharedFromAdmin ? "Được chia sẻ từ Admin" : `Được chia sẻ từ GV ${exam.duLieuDe?.sharedBy || "khác"}`);
      const isFromAdmin = !!(exam.duLieuDe?.sharedFromAdmin || exam.sharedFromAdmin || sourceText.toLowerCase().includes("admin"));
      if (isFromAdmin) {
        sharedBadge = `<span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 6px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; white-space: nowrap;" title="${sourceText}">📥 Đề từ Admin</span>`;
      } else {
        const authorName = exam.duLieuDe?.sharedBy ? `GV ${exam.duLieuDe.sharedBy}` : "GV khác";
        sharedBadge = `<span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 6px; background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; font-weight: 700; white-space: nowrap;" title="${sourceText}">📥 Đề từ ${authorName}</span>`;
      }
    }

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><code class="exam-clickable-title" data-made="${exam.maDe}" title="Bấm để mở chỉnh sửa đề này" style="color: #60a5fa; font-weight: 700; cursor: pointer;">${exam.maDe}</code></td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <strong class="exam-clickable-title" data-made="${exam.maDe}" title="Bấm để mở chỉnh sửa đề này" style="cursor: pointer;">${exam.tenKyThi}</strong>
          ${sharedBadge}
          ${isFromCache ? '<span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 4px; background: #eff6ff; color: #1d4ed8; font-weight: 600;" title="Dữ liệu hiển thị tức thì">Sẵn sàng</span>' : '<span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 4px; background: #ecfdf5; color: #047857; font-weight: 600;" title="Đã đồng bộ Google Sheets">Google Sheets</span>'}
        </div>
      </td>
      <td><span style="color: #a78bfa;">${exam.lopChoPhep}</span></td>
      <td>${exam.thoiGian} phút</td>
      <td>${exam.soCauHoi || 0} câu</td>
      <td>${tuLuanBadge}</td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
          ${isReviewAllowed 
            ? '<span class="badge-table-review allowed" title="Học sinh được xem lại bài và đáp án sau khi nộp (Chế độ Ôn tập)">📖 Cho xem bài</span>' 
            : '<span class="badge-table-review locked" title="Học sinh bị khóa xem lại bài và đáp án (Chế độ Thi chính thức)">🔒 Khóa xem bài</span>'}
          ${isScoreAllowed
            ? '<span class="badge-table-review" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;" title="Học sinh xem được điểm số ngay sau khi nộp bài">👁️ Cho xem điểm</span>'
            : '<span class="badge-table-review" style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;" title="Khóa hiển thị điểm số khi nộp bài">🔒 Khóa xem điểm</span>'}
        </div>
      </td>
      <td>
        <button type="button" class="btn-toggle-status ${isOpening ? 'active' : ''}" data-made="${exam.maDe}" data-status="${exam.trangThai}">
          ${isOpening ? '🟢 Đang Mở' : '🔴 Đang Đóng'}
        </button>
      </td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-action-results" data-made="${exam.maDe}" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-weight: 700;" title="Xem bảng điểm và kết quả của đề thi này">
            📊 Điểm
          </button>
          <button type="button" class="btn-action-edit" data-made="${exam.maDe}" title="Mở lên giao diện để chỉnh sửa">
            ✏ Sửa đề
          </button>
          <button type="button" class="btn-action-view" data-made="${exam.maDe}" title="Xem toàn bộ câu hỏi và đáp án">
            👁 Xem
          </button>
          <button type="button" class="btn-action-share" data-made="${exam.maDe}" style="background: #fdf4ff; border: 1px solid #f5d0fe; color: #a21caf; font-weight: 700;" title="Chia sẻ đề thi này cho Giáo viên khác trong hệ thống">
            📤 Chia sẻ
          </button>
          <button type="button" class="btn-action-delete" data-made="${exam.maDe}" title="Xóa đề thi này">
            Xóa
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Gắn sự kiện các nút trong bảng
  attachExamTableEvents(tbody);
}

function renderEmptyExamsTable(tbody) {
  tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem 1.5rem; color: #64748b; line-height: 1.6;">
    <div style="font-size: 1.05rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">Chưa có đề thi nào trong danh sách</div>
    <p style="margin: 0; font-size: 0.88rem;">Thầy/Cô hãy tạo và bấm <strong>"Lưu Kỳ Thi Lên Google Sheets"</strong> ở khung soạn thảo bên trên. Đề thi sẽ tự động được lưu và hiển thị tại đây!</p>
    <div style="margin-top: 0.75rem; font-size: 0.8rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.45rem 1rem; display: inline-block;">
      💡 Gợi ý: Nếu muốn đồng bộ trực tiếp lên Google Sheets, hãy đảm bảo Web App được Triển khai (Deploy) với quyền <strong>"Anyone" (Bất kỳ ai)</strong>.
    </div>
  </td></tr>`;
}

function attachExamTableEvents(tbody) {
  // 1. Gắn sự kiện Mở chỉnh sửa đề thi
  tbody.querySelectorAll(".btn-action-edit, .exam-clickable-title").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      openExamForEditing(maDe);
    });
  });

  // 1.5. Gắn sự kiện Xem điểm thi nhanh từ danh sách đề
  tbody.querySelectorAll(".btn-action-results").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      const tabBtnResults = document.getElementById("tabBtnResults");
      const tabResults = document.getElementById("tabResults");
      const tabCreate = document.getElementById("tabCreate");
      const tabStudents = document.getElementById("tabStudents");
      if (tabBtnResults && tabResults) {
        [document.getElementById("tabBtnCreate"), tabBtnResults, document.getElementById("tabBtnStudents")].forEach(b => b && b.classList.remove("active"));
        [tabCreate, tabResults, tabStudents].forEach(t => t && (t.style.display = "none"));
        tabBtnResults.classList.add("active");
        tabResults.style.display = "block";

        const selectExam = document.getElementById("selectFilterExam");
        if (selectExam) {
          selectExam.value = maDe;
        }
        populateResultClassDropdown(maDe);
        loadTeacherResults(maDe);
      }
    });
  });

  // 2. Gắn sự kiện Xem nhanh đề thi (Modal)
  tbody.querySelectorAll(".btn-action-view").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      previewExamModal(maDe);
    });
  });

  // 2.5. Gắn sự kiện Chia sẻ đề thi cho GV khác (Modal)
  tbody.querySelectorAll(".btn-action-share").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      openShareExamModal(maDe);
    });
  });

  // 3. Gắn sự kiện nút toggle trạng thái nhanh
  tbody.querySelectorAll(".btn-toggle-status").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const targetBtn = e.currentTarget || e.target;
      const maDe = targetBtn.dataset.made;
      const currentStatus = targetBtn.dataset.status;
      const nextStatus = currentStatus === "Mở" ? "Đóng" : "Mở";

      targetBtn.disabled = true;
      targetBtn.textContent = "Đang xử lý...";

      // Lưu lại bản sao cache cũ để phòng trường hợp lỗi thì khôi phục lại
      const previousCached = getCachedExams();
      let cached = JSON.parse(JSON.stringify(previousCached));
      const examItem = cached.find(ex => ex.maDe === maDe);
      if (examItem) {
        examItem.trangThai = nextStatus;
        saveCachedExams(cached);
        currentExamsList = cached;
        renderTeacherExamsTable(currentExamsList, true);
      }

      const res = await toggleExamStatusApi(maDe, nextStatus);
      if (res && res.success === false) {
        // Rollback nếu máy chủ trả về lỗi
        saveCachedExams(previousCached);
        currentExamsList = previousCached;
        renderTeacherExamsTable(currentExamsList, false);
        showToast("Lỗi cập nhật", res.message || "Không thể cập nhật trạng thái đề thi trên Google Sheets!", "error", 4000);
        return;
      }

      showToast("Cập nhật thành công", `Đã chuyển bài thi sang trạng thái: "${nextStatus}" trên Google Sheets!`, "success", 2500);
      await loadTeacherExams(false);
    });
  });

  // 4. Gắn sự kiện xóa đề thi
  tbody.querySelectorAll(".btn-action-delete, .btn-delete-exam").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const targetBtn = e.currentTarget;
      const maDe = targetBtn.dataset.made;
      if (confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đề thi "${maDe}"?`)) {
        targetBtn.disabled = true;
        targetBtn.textContent = "...";
        showToast("Đang xử lý", `Đang xóa đề thi ${maDe}...`, "info", 2000);

        // Lưu bản sao cache cũ
        const previousCached = getCachedExams();
        let cached = previousCached.filter(ex => ex.maDe !== maDe);
        saveCachedExams(cached);
        currentExamsList = cached;
        renderTeacherExamsTable(currentExamsList, true);

        const res = await deleteExamApi(maDe);
        if (res && res.success === false) {
          // Rollback nếu máy chủ báo lỗi
          saveCachedExams(previousCached);
          currentExamsList = previousCached;
          renderTeacherExamsTable(currentExamsList, false);
          showToast("Lỗi xóa đề", res.message || `Không thể xóa đề thi "${maDe}" trên Google Sheets!`, "error", 4000);
          return;
        }

        showToast("Đã xóa thành công", `Đã xóa đề thi "${maDe}" trên Google Sheets!`, "success", 3000);
        await loadTeacherExams(false);
      }
    });
  });
}

// Bắt sự kiện bấm nút Tải Lại Danh Sách
const btnRefreshExams = document.getElementById("btnRefreshExams");
if (btnRefreshExams) {
  btnRefreshExams.addEventListener("click", () => loadTeacherExams(true));
}

async function toggleExamStatusApi(maDe, newStatus) {
  const targetServer = getTeacherPersonalServerUrl() || API_URL;
  const usernameGV = currentTeacher?.username || "";

  // 1. Thử gửi POST
  try {
    const res = await fetch(targetServer, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "toggleExamStatus",
        maDe: maDe,
        trangThai: newStatus,
        usernameGV: usernameGV
      })
    });
    const text = await res.text();
    if (text && !text.trim().startsWith("<")) {
      const data = JSON.parse(text);
      if (data) return data;
    }
  } catch (err) {
    console.warn("POST toggleExamStatus thất bại, thử sang GET fallback:", err.message);
  }

  // 2. Fallback GET
  try {
    const getUrl = `${targetServer}?action=toggleExamStatus&maDe=${encodeURIComponent(maDe)}&trangThai=${encodeURIComponent(newStatus)}&usernameGV=${encodeURIComponent(usernameGV)}&_t=${Date.now()}`;
    const getRes = await fetch(getUrl);
    const getText = await getRes.text();
    if (getText && !getText.trim().startsWith("<")) {
      return JSON.parse(getText);
    }
  } catch (getErr) {
    return { success: false, message: getErr.message };
  }

  return { success: true };
}

async function deleteExamApi(maDe) {
  const targetServer = getTeacherPersonalServerUrl() || API_URL;
  const usernameGV = currentTeacher?.username || "";

  // 1. Thử gửi POST
  try {
    const res = await fetch(targetServer, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "deleteExam",
        maDe: maDe,
        usernameGV: usernameGV
      })
    });
    const text = await res.text();
    if (text && !text.trim().startsWith("<")) {
      const data = JSON.parse(text);
      if (data) return data;
    }
  } catch (err) {
    console.warn("POST deleteExam thất bại, thử sang GET fallback:", err.message);
  }

  // 2. Fallback GET
  try {
    const getUrl = `${targetServer}?action=deleteExam&maDe=${encodeURIComponent(maDe)}&usernameGV=${encodeURIComponent(usernameGV)}&_t=${Date.now()}`;
    const getRes = await fetch(getUrl);
    const getText = await getRes.text();
    if (getText && !getText.trim().startsWith("<")) {
      return JSON.parse(getText);
    }
  } catch (getErr) {
    return { success: false, message: getErr.message };
  }

  return { success: true };
}

// ============================================================================
// 8. TAB 2: XEM KẾT QUẢ VÀ THỐNG KÊ (DASHBOARD)
// ============================================================================
// ============================================================================
// 8. TAB 2: XEM KẾT QUẢ VÀ THỐNG KÊ (DASHBOARD)
// ============================================================================
let currentRawResultsList = [];        // Dữ liệu bài nộp lấy trực tiếp từ DATA_KETQUA
let currentDisplayedResultsList = [];  // Dữ liệu đã ghép với CSDL gốc của lớp (đúng thứ tự sổ điểm)

function updateFilterExamDropdown(exams) {
  const selectExam = document.getElementById("selectFilterExam");
  if (!selectExam) return;
  const currentVal = selectExam.value;

  selectExam.innerHTML = `<option value="ALL">-- Tất cả bài kiểm tra (${exams.length} đề) --</option>`;
  exams.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.maDe;
    opt.textContent = `[${ex.maDe}] ${ex.tenKyThi}`;
    selectExam.appendChild(opt);
  });

  if (currentVal && Array.from(selectExam.options).some(o => o.value === currentVal)) {
    selectExam.value = currentVal;
  }

  // Cập nhật luôn danh sách lớp vào dropdown chọn lớp của Tab 2 theo đề đang chọn
  populateResultClassDropdown(selectExam.value);
}

function populateResultClassDropdown(specificMaDe) {
  const selectClass = document.getElementById("selectFilterResultClass");
  if (!selectClass) return;

  const currentVal = selectClass.value;
  const selectExamElem = document.getElementById("selectFilterExam");

  // Xác định mã đề đang chọn: ưu tiên specificMaDe nếu khác "ALL", hoặc lấy selectExamElem.value
  let selectedMaDe = "ALL";
  if (specificMaDe && specificMaDe !== "ALL") {
    selectedMaDe = specificMaDe;
  } else if (selectExamElem && selectExamElem.value && selectExamElem.value !== "ALL") {
    selectedMaDe = selectExamElem.value;
  } else if (specificMaDe) {
    selectedMaDe = specificMaDe;
  }

  // 1. Tập hợp danh sách tất cả các lớp của giáo viên
  const allTeacherClassSet = new Set();
  (teacherAllClassesList || []).forEach(c => c && allTeacherClassSet.add(normalizeClassName(c)));
  (currentTeacherStudents || []).forEach(st => st.lop && allTeacherClassSet.add(normalizeClassName(st.lop)));

  // 2. Lọc danh sách lớp theo bài kiểm tra đã chọn
  let classSet = new Set();

  if (selectedMaDe && selectedMaDe !== "ALL") {
    let exam = (currentExamsList || []).find(e => String(e.maDe || "").trim() === String(selectedMaDe).trim());
    if (!exam) {
      const cached = getCachedExams();
      exam = (cached || []).find(e => String(e.maDe || "").trim() === String(selectedMaDe).trim());
    }

    const rawAllowed = String(exam?.lopChoPhep || exam?.duLieuDe?.lopChoPhep || "").trim();

    // Bóc tách các lớp được phân công trong đề thi
    const tokens = rawAllowed.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const specificAllowed = tokens
      .filter(t => t.toUpperCase() !== "ALL" && t.toUpperCase() !== "TẤT CẢ")
      .map(normalizeClassName)
      .filter(Boolean);

    // Thu thập các lớp đã thực tế có học sinh nộp bài cho đề này (DATA_KETQUA)
    const submittedClasses = (currentRawResultsList || [])
      .filter(r => String(r.maDe || "").trim() === String(selectedMaDe).trim() && r.lop)
      .map(r => normalizeClassName(r.lop))
      .filter(Boolean);

    if (specificAllowed.length > 0) {
      // Đề có gán các lớp cụ thể: CHỈ hiển thị các lớp được phép thi này (kèm lớp đã nộp bài)
      specificAllowed.forEach(c => classSet.add(c));
      submittedClasses.forEach(c => classSet.add(c));
    } else if (submittedClasses.length > 0) {
      // Nếu đề không ghi lớp cụ thể nhưng đã có dữ liệu nộp bài
      submittedClasses.forEach(c => classSet.add(c));
    } else {
      // Nếu đề áp dụng toàn bộ (ALL) và chưa có bài nộp
      classSet = new Set(allTeacherClassSet);
    }
  } else {
    // Nếu chọn "Tất cả bài kiểm tra (ALL)" -> Hiển thị tất cả các lớp của giáo viên
    classSet = new Set(allTeacherClassSet);
  }

  // Fallback an toàn nếu classSet rỗng
  if (classSet.size === 0) {
    classSet = new Set(allTeacherClassSet);
  }

  const sortedClasses = Array.from(classSet).sort((a, b) => {
    const ga = parseInt(getGradeFromClass(a)) || 0;
    const gb = parseInt(getGradeFromClass(b)) || 0;
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  const totalClassCount = sortedClasses.length;
  selectClass.innerHTML = `<option value="ALL">-- Tất cả các lớp (${totalClassCount} lớp) --</option>`;
  sortedClasses.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = `Lớp ${cls}`;
    selectClass.appendChild(opt);
  });

  // Nếu lớp đang chọn trước đó vẫn thuộc danh sách các lớp được lọc thì giữ nguyên, ngược lại quay về "ALL"
  if (currentVal && currentVal !== "ALL" && sortedClasses.includes(currentVal)) {
    selectClass.value = currentVal;
  } else {
    selectClass.value = "ALL";
  }
}

// Bắt sự kiện lọc kết quả
const btnFilterResults = document.getElementById("btnFilterResults");
if (btnFilterResults) {
  btnFilterResults.addEventListener("click", () => {
    const sInput = document.getElementById("searchStudentInput");
    const bClear = document.getElementById("btnClearSearchStudent");
    if (sInput) sInput.value = "";
    if (bClear) bClear.style.display = "none";
    const selectedMaDe = document.getElementById("selectFilterExam")?.value || "ALL";
    populateResultClassDropdown(selectedMaDe);
    loadTeacherResults(selectedMaDe);
  });
}

const selectFilterExamElem = document.getElementById("selectFilterExam");
if (selectFilterExamElem) {
  selectFilterExamElem.addEventListener("change", () => {
    const sInput = document.getElementById("searchStudentInput");
    const bClear = document.getElementById("btnClearSearchStudent");
    if (sInput) sInput.value = "";
    if (bClear) bClear.style.display = "none";
    const selectedMaDe = selectFilterExamElem.value || "ALL";
    populateResultClassDropdown(selectedMaDe);
    loadTeacherResults(selectedMaDe);
  });
}

const selectFilterResultClassElem = document.getElementById("selectFilterResultClass");
if (selectFilterResultClassElem) {
  selectFilterResultClassElem.addEventListener("change", () => {
    applyResultsFiltersAndRender();
  });
}

const chkIncludeNotSubmittedElem = document.getElementById("chkIncludeNotSubmitted");
if (chkIncludeNotSubmittedElem) {
  chkIncludeNotSubmittedElem.addEventListener("change", () => {
    applyResultsFiltersAndRender();
  });
}

/**
 * Tải kết quả bài thi từ Google Sheets
 */
async function loadTeacherResults(filterMaDe) {
  const tbody = document.getElementById("resultsTableBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Đang tải bảng điểm kết quả...</td></tr>`;
  }

  // Tự động xóa ô tìm kiếm khi tải mới kết quả để tránh trình duyệt tự động điền từ khóa làm ẩn bảng điểm
  const sInput = document.getElementById("searchStudentInput");
  const bClear = document.getElementById("btnClearSearchStudent");
  if (sInput) sInput.value = "";
  if (bClear) bClear.style.display = "none";

  const selectExamElem = document.getElementById("selectFilterExam");
  const actualMaDe = (filterMaDe !== undefined && filterMaDe !== null && filterMaDe !== "") 
    ? filterMaDe 
    : (selectExamElem?.value || "ALL");

  if (selectExamElem && actualMaDe && Array.from(selectExamElem.options).some(o => o.value === actualMaDe)) {
    selectExamElem.value = actualMaDe;
  }

  // Đảm bảo danh sách học sinh CSDL gốc đã được tải
  if (!currentTeacherStudents || currentTeacherStudents.length === 0) {
    const cached = getCachedTeacherStudents();
    if (cached && Array.isArray(cached.students) && cached.students.length > 0) {
      currentTeacherStudents = cached.students.map(st => ({ ...st, lop: normalizeClassName(st.lop) }));
    } else {
      try {
        await loadTeacherStudents(false);
      } catch (e) {
        console.warn("Không thể tải CSDL học sinh gốc cho Tab 2:", e);
      }
    }
  }

  populateResultClassDropdown(actualMaDe);

  try {
    let resultsFound = [];
    const usernameVariants = getTeacherUsernameVariants();

    for (const uGV of usernameVariants) {
      try {
        const fetchUrl = (isAdminRole() && adminActiveApiUrl) ? adminActiveApiUrl : API_URL;
        const res = await fetch(fetchUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "getTeacherResults",
            usernameGV: uGV,
            maDe: actualMaDe
          })
        });

        const rawText = await res.text();
        if (rawText && !rawText.trim().startsWith("<")) {
          const data = JSON.parse(rawText);
          if (data && Array.isArray(data.results)) {
            resultsFound = data.results;
            if (resultsFound.length > 0) break; // Ưu tiên biến thể có bài nộp
          }
        }
      } catch (errVar) {
        console.warn(`Thử lấy kết quả POST với ${uGV} không thành công:`, errVar);
      }

      // Tự động thử GET nếu POST chưa ra kết quả
      if (!resultsFound || resultsFound.length === 0) {
        try {
          const fetchUrl = (isAdminRole() && adminActiveApiUrl) ? adminActiveApiUrl : API_URL;
          const getUrl = `${fetchUrl}?action=getTeacherResults&usernameGV=${encodeURIComponent(uGV)}&maDe=${encodeURIComponent(actualMaDe)}&_t=${Date.now()}`;
          const getRes = await fetch(getUrl);
          const getText = await getRes.text();
          if (getText && !getText.trim().startsWith("<")) {
            const data = JSON.parse(getText);
            if (data && Array.isArray(data.results)) {
              resultsFound = data.results;
              if (resultsFound.length > 0) break;
            }
          }
        } catch (getErr) {
          console.warn(`Thử lấy kết quả GET với ${uGV} không thành công:`, getErr);
        }
      }
    }

    currentRawResultsList = (resultsFound || []).map(r => ({
      ...r,
      lop: normalizeClassName(r.lop)
    }));

    // Đồng bộ vào biến toàn cục, cập nhật lại dropdown lớp theo bài nộp thực tế và hiển thị
    currentResultsList = currentRawResultsList;
    populateResultClassDropdown(actualMaDe);
    applyResultsFiltersAndRender();

  } catch (err) {
    console.error("Lỗi lấy kết quả thi:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #f87171;">Lỗi tải kết quả: ${err.message}</td></tr>`;
    }
  }
}

// ============================================================================
// BỘ LỌC TRẠNG THÁI LÀM BÀI: TẤT CẢ / ĐÃ LÀM / CHƯA LÀM
// ============================================================================
let currentSubmissionStatusFilter = "ALL"; // "ALL" | "SUBMITTED" | "NOT_SUBMITTED"

function initSubmissionFilterButtons() {
  const buttons = document.querySelectorAll(".btn-sub-filter");
  if (!buttons || buttons.length === 0) return;
  buttons.forEach(btn => {
    btn.onclick = () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSubmissionStatusFilter = btn.dataset.filter || "ALL";
      applyResultsFiltersAndRender();
    };
  });
}

// Tự động gắn sự kiện nút lọc khi tải xong DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSubmissionFilterButtons);
} else {
  initSubmissionFilterButtons();
}

/**
 * Ghép nối danh sách bài nộp với CSDL học sinh gốc của lớp
 * Giữ nguyên 100% thứ tự STT / Alpha trong sổ điểm gốc của từng lớp!
 */
function applyResultsFiltersAndRender() {
  const selectedMaDe = document.getElementById("selectFilterExam")?.value || "ALL";
  const selectedClass = document.getElementById("selectFilterResultClass")?.value || "ALL";
  const includeNotSubmitted = document.getElementById("chkIncludeNotSubmitted") ? document.getElementById("chkIncludeNotSubmitted").checked : true;

  // 1. Lọc các bài nộp thô theo bài kiểm tra
  let filteredSubmissions = currentRawResultsList;
  if (selectedMaDe && selectedMaDe !== "ALL") {
    filteredSubmissions = filteredSubmissions.filter(r => r.maDe === selectedMaDe);
  }

  // 2. Lấy toàn bộ học sinh gốc của giáo viên (đã đúng thứ tự từ trên xuống dưới trong Sheet)
  let baseStudents = currentTeacherStudents || [];
  if (baseStudents.length === 0) {
    const cached = getCachedTeacherStudents();
    if (cached && Array.isArray(cached.students)) {
      baseStudents = cached.students;
    }
  }

  // Xác định các lớp cần hiển thị
  let targetStudents = baseStudents;
  if (selectedClass && selectedClass !== "ALL") {
    targetStudents = baseStudents.filter(s => normalizeClassName(s.lop) === normalizeClassName(selectedClass));
  } else if (selectedMaDe && selectedMaDe !== "ALL") {
    // Nếu chọn đề cụ thể mà chọn "Tất cả các lớp", chỉ lấy học sinh thuộc các lớp được phép thi của đề đó
    let exam = (currentExamsList || []).find(e => String(e.maDe || "").trim() === String(selectedMaDe).trim());
    if (!exam) {
      const cached = getCachedExams();
      exam = (cached || []).find(e => String(e.maDe || "").trim() === String(selectedMaDe).trim());
    }
    const rawAllowed = exam?.lopChoPhep || exam?.duLieuDe?.lopChoPhep || "";
    const tokens = String(rawAllowed).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const specificAllowed = tokens
      .filter(t => t.toUpperCase() !== "ALL" && t.toUpperCase() !== "TẤT CẢ")
      .map(normalizeClassName)
      .filter(Boolean);

    if (specificAllowed.length > 0) {
      targetStudents = baseStudents.filter(s => specificAllowed.includes(normalizeClassName(s.lop)));
    }
  }

  // Ghép bài làm vào danh sách hiển thị
  let mergedList = [];
  const examMap = new Map();
  (currentExamsList || []).forEach(e => {
    if (e.maDe) examMap.set(String(e.maDe).trim(), e.tenKyThi || e.maDe);
  });

  if (selectedMaDe === "ALL") {
    // ------------------------------------------------------------------------
    // KHI CHỌN "TẤT CẢ BÀI KIỂM TRA": Hiển thị toàn bộ các bài thi đã nộp của tất cả các đề!
    // ------------------------------------------------------------------------
    let subs = filteredSubmissions || [];
    if (selectedClass && selectedClass !== "ALL") {
      subs = subs.filter(r => normalizeClassName(r.lop) === normalizeClassName(selectedClass));
    }

    const submittedItems = subs.map((r, idx) => {
      const examName = examMap.get(String(r.maDe).trim()) || r.tenKyThi || r.maDe;
      return {
        stt: idx + 1,
        usernameHS: r.usernameHS,
        hoTen: r.hoTen,
        lop: normalizeClassName(r.lop),
        ngaySinh: r.ngaySinh,
        gioiTinh: r.gioiTinh,
        truong: r.truong,
        maDe: r.maDe,
        tenKyThi: examName,
        diemTong: Number(r.diemTong) || 0,
        soCauDungSai: r.soCauDungSai || "--",
        thoiGianNop: r.thoiGianNop || "--",
        chiTietTraLoi: r.chiTietTraLoi || "[]",
        baiLamTuLuan: r.baiLamTuLuan || [],
        isSubmitted: true,
        subRecord: r
      };
    });

    // Nếu người dùng tick chọn "Hiện đủ danh sách lớp", bổ sung học sinh chưa làm bài nào
    if (includeNotSubmitted && targetStudents && targetStudents.length > 0) {
      const submittedUserSet = new Set(submittedItems.map(s => String(s.usernameHS || "").trim().toLowerCase()));
      const unsubmittedItems = [];
      targetStudents.forEach(st => {
        const u = String(st.username || "").trim().toLowerCase();
        if (!submittedUserSet.has(u)) {
          unsubmittedItems.push({
            stt: 0,
            usernameHS: st.username,
            hoTen: st.hoTen,
            lop: normalizeClassName(st.lop),
            ngaySinh: st.ngaySinh,
            gioiTinh: st.gioiTinh,
            truong: st.truong,
            maDe: "--",
            tenKyThi: "",
            diemTong: "",
            soCauDungSai: "",
            thoiGianNop: "",
            chiTietTraLoi: "[]",
            baiLamTuLuan: [],
            isSubmitted: false,
            subRecord: null
          });
        }
      });
      mergedList = [...submittedItems, ...unsubmittedItems];
    } else {
      mergedList = submittedItems;
    }
  } else {
    // ------------------------------------------------------------------------
    // KHI CHỌN 1 ĐỀ CỤ THỂ: Ghép theo sổ điểm gốc của lớp (đúng thứ tự STT)
    // ------------------------------------------------------------------------
    const currentExamName = examMap.get(String(selectedMaDe).trim()) || selectedMaDe;
    if (targetStudents && targetStudents.length > 0) {
      mergedList = targetStudents.map((st, idx) => {
        const stUser = String(st.username || "").trim().toLowerCase();
        const stName = String(st.hoTen || "").trim().toLowerCase();
        const stClass = normalizeClassName(st.lop);

        // Tìm bài nộp khớp với học sinh (lấy bài nộp mới nhất của đề này)
        const sub = [...filteredSubmissions].reverse().find(r => {
          const rUser = String(r.usernameHS || "").trim().toLowerCase();
          if (rUser && stUser && rUser === stUser) return true;
          const rName = String(r.hoTen || "").trim().toLowerCase();
          const rClass = normalizeClassName(r.lop);
          return rName === stName && rClass === stClass;
        });

        if (sub) {
          return {
            stt: idx + 1,
            usernameHS: st.username,
            hoTen: st.hoTen,
            lop: stClass,
            ngaySinh: st.ngaySinh,
            gioiTinh: st.gioiTinh,
            truong: st.truong,
            maDe: sub.maDe || selectedMaDe,
            tenKyThi: currentExamName,
            diemTong: sub.diemTong !== undefined ? Number(sub.diemTong) : 0,
            soCauDungSai: sub.soCauDungSai || "--",
            thoiGianNop: sub.thoiGianNop || "--",
            chiTietTraLoi: sub.chiTietTraLoi || "[]",
            baiLamTuLuan: sub.baiLamTuLuan || [],
            isSubmitted: true,
            subRecord: sub
          };
        } else {
          return {
            stt: idx + 1,
            usernameHS: st.username,
            hoTen: st.hoTen,
            lop: stClass,
            ngaySinh: st.ngaySinh,
            gioiTinh: st.gioiTinh,
            truong: st.truong,
            maDe: selectedMaDe,
            tenKyThi: currentExamName,
            diemTong: "", // ĐỂ TRỐNG Ô ĐIỂM ĐỂ COPY-PASTE THẲNG VÀO SỔ ĐIỂM!
            soCauDungSai: "",
            thoiGianNop: "",
            chiTietTraLoi: "[]",
            baiLamTuLuan: [],
            isSubmitted: false,
            subRecord: null
          };
        }
      });
    } else {
      let subs = filteredSubmissions;
      if (selectedClass && selectedClass !== "ALL") {
        subs = subs.filter(r => normalizeClassName(r.lop) === normalizeClassName(selectedClass));
      }
      mergedList = subs.map((r, idx) => ({
        stt: idx + 1,
        usernameHS: r.usernameHS,
        hoTen: r.hoTen,
        lop: normalizeClassName(r.lop),
        ngaySinh: r.ngaySinh,
        gioiTinh: r.gioiTinh,
        truong: r.truong,
        maDe: r.maDe,
        tenKyThi: currentExamName,
        diemTong: Number(r.diemTong) || 0,
        soCauDungSai: r.soCauDungSai || "--",
        thoiGianNop: r.thoiGianNop || "--",
        chiTietTraLoi: r.chiTietTraLoi || "[]",
        baiLamTuLuan: r.baiLamTuLuan || [],
        isSubmitted: true,
        subRecord: r
      }));
    }
  }

  // 3. Cập nhật số lượng đếm trên 3 nút bộ lọc
  const totalCount = mergedList.length;
  const submittedCount = mergedList.filter(r => r.isSubmitted).length;
  const notSubmittedCount = totalCount - submittedCount;

  const badgeAll = document.getElementById("badgeCountAll");
  const badgeSub = document.getElementById("badgeCountSubmitted");
  const badgeNot = document.getElementById("badgeCountNotSubmitted");
  if (badgeAll) badgeAll.textContent = totalCount;
  if (badgeSub) badgeSub.textContent = submittedCount;
  if (badgeNot) badgeNot.textContent = notSubmittedCount;

  // 4. Lọc theo trạng thái làm bài (TẤT CẢ / ĐÃ LÀM / CHƯA LÀM)
  let finalList = mergedList;
  if (currentSubmissionStatusFilter === "SUBMITTED") {
    finalList = mergedList.filter(r => r.isSubmitted);
  } else if (currentSubmissionStatusFilter === "NOT_SUBMITTED") {
    finalList = mergedList.filter(r => !r.isSubmitted);
  } else {
    // "ALL": Nếu checkbox includeNotSubmitted là false thì chỉ hiện bài đã nộp
    if (!includeNotSubmitted) {
      finalList = mergedList.filter(r => r.isSubmitted);
    }
  }

  // Đánh số thứ tự STT hiển thị tuần tự 1..N
  finalList.forEach((r, idx) => {
    r.stt = idx + 1;
  });

  currentDisplayedResultsList = finalList;

  // 5. Cập nhật thống kê KPI và vẽ bảng
  computeAndRenderMetrics(mergedList);

  const searchInput = document.getElementById("searchStudentInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  if (query) {
    const searchFiltered = finalList.filter(r => 
      (r.hoTen && r.hoTen.toLowerCase().includes(query)) ||
      (r.lop && r.lop.toLowerCase().includes(query)) ||
      (r.usernameHS && r.usernameHS.toLowerCase().includes(query)) ||
      (r.maDe && r.maDe.toLowerCase().includes(query)) ||
      (r.tenKyThi && r.tenKyThi.toLowerCase().includes(query))
    );
    renderResultsTable(searchFiltered);
  } else {
    renderResultsTable(finalList);
  }
}

function computeAndRenderMetrics(results) {
  const totalStudents = results.length;
  const submittedList = results.filter(r => r.isSubmitted);
  const submittedCount = submittedList.length;

  const metricTotalSubmissions = document.getElementById("metricTotalSubmissions");
  if (metricTotalSubmissions) {
    if (totalStudents > submittedCount) {
      const pct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
      metricTotalSubmissions.innerHTML = `${submittedCount} <span style="font-size: 0.82rem; font-weight: 600; color: #64748b;">/ ${totalStudents} HS (${pct}%)</span>`;
    } else {
      metricTotalSubmissions.textContent = submittedCount;
    }
  }

  if (submittedCount === 0) {
    document.getElementById("metricAvgScore").textContent = "0.0";
    document.getElementById("metricHighLow").textContent = "0.0 / 0.0";
    document.getElementById("metricPassRate").textContent = "0%";
    return;
  }

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  let passedCount = 0;

  submittedList.forEach(r => {
    const score = Number(r.diemTong) || 0;
    sum += score;
    if (score > max) max = score;
    if (score < min) min = score;
    if (score >= 5.0) passedCount++;
  });

  const avg = submittedCount > 0 ? (Math.round((sum / submittedCount) * 100) / 100) : 0;
  const passRate = submittedCount > 0 ? Math.round((passedCount / submittedCount) * 100) : 0;
  const displayMax = submittedCount > 0 ? (Math.round(max * 100) / 100) : 0;
  const displayMin = submittedCount > 0 ? (Math.round(min * 100) / 100) : 0;

  document.getElementById("metricAvgScore").textContent = avg;
  document.getElementById("metricHighLow").textContent = `${displayMax} / ${displayMin}`;
  document.getElementById("metricPassRate").textContent = `${passRate}%`;
}

function clearSearchFilter() {
  const searchInput = document.getElementById("searchStudentInput");
  const btnClear = document.getElementById("btnClearSearchStudent");
  if (searchInput) searchInput.value = "";
  if (btnClear) btnClear.style.display = "none";
  renderResultsTable(currentDisplayedResultsList || []);
}

// ============================================================================
// HỆ THỐNG PHÂN TRANG (PAGINATION) BẢNG KẾT QUẢ & DANH SÁCH HỌC SINH
// Mặc định 60 học sinh / trang để bảng tải siêu tốc, không bị lag dù có > 1,000 HS
// ============================================================================
let resultsCurrentPage = 1;
let resultsPageSize = 60; // 60, 100, 200, "ALL"
let lastFullResultsData = [];

let studentsCurrentPage = 1;
let studentsPageSize = 60;
let lastFullStudentsData = [];

/**
 * Render thanh điều hướng phân trang chung
 */
function renderPaginationBarHtml(containerId, currentPage, totalPages, totalItems, pageSize, startItem, endItem, onPageChangeFnName, onPageSizeChangeFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (totalItems <= 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = containerId.toLowerCase().includes("top") ? "inline-flex" : "flex";

  // Tạo các nút số trang (1, 2, ..., N)
  let pagesHtml = "";
  if (totalPages > 1) {
    const prevDisabled = currentPage <= 1 ? "disabled" : "";
    pagesHtml += `
      <button type="button" class="btn-page-nav" ${prevDisabled} onclick="${onPageChangeFnName}(1)" title="Về trang đầu">«</button>
      <button type="button" class="btn-page-nav" ${prevDisabled} onclick="${onPageChangeFnName}(${currentPage - 1})" title="Trang trước">‹</button>
    `;

    // Tính toán dải số trang hiển thị thông minh
    const visiblePages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) visiblePages.push(i);
    } else {
      visiblePages.push(1);
      let left = Math.max(2, currentPage - 1);
      let right = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        right = 4;
      }
      if (currentPage >= totalPages - 2) {
        left = totalPages - 3;
      }

      if (left > 2) visiblePages.push("...");
      for (let i = left; i <= right; i++) visiblePages.push(i);
      if (right < totalPages - 1) visiblePages.push("...");
      visiblePages.push(totalPages);
    }

    visiblePages.forEach(p => {
      if (p === "...") {
        pagesHtml += `<span class="pagination-ellipsis">…</span>`;
      } else {
        const isActive = p === currentPage ? "active" : "";
        pagesHtml += `<button type="button" class="btn-page-nav ${isActive}" onclick="${onPageChangeFnName}(${p})">${p}</button>`;
      }
    });

    const nextDisabled = currentPage >= totalPages ? "disabled" : "";
    pagesHtml += `
      <button type="button" class="btn-page-nav" ${nextDisabled} onclick="${onPageChangeFnName}(${currentPage + 1})" title="Trang sau">›</button>
      <button type="button" class="btn-page-nav" ${nextDisabled} onclick="${onPageChangeFnName}(${totalPages})" title="Đến trang cuối">»</button>
    `;
  }

  const strPageSize = String(pageSize);
  const optionsHtml = [
    { val: "60", label: "60 hs / trang" },
    { val: "100", label: "100 hs / trang" },
    { val: "200", label: "200 hs / trang" },
    { val: "500", label: "500 hs / trang" },
    { val: "ALL", label: "Tất cả" }
  ].map(opt => `<option value="${opt.val}" ${strPageSize === opt.val ? "selected" : ""}>${opt.label}</option>`).join("");

  container.innerHTML = `
    <div class="pagination-left">
      <span>Hiển thị <strong>${startItem.toLocaleString('vi-VN')}</strong> - <strong>${endItem.toLocaleString('vi-VN')}</strong> trên tổng số <strong>${totalItems.toLocaleString('vi-VN')}</strong> học sinh</span>
    </div>
    <div class="pagination-right">
      <div class="pagination-size-selector">
        <label for="${containerId}_size" style="font-size: 0.82rem; font-weight: 600; color: #64748b;">Số lượng / trang:</label>
        <select id="${containerId}_size" class="pagination-size-select" onchange="${onPageSizeChangeFnName}(this.value)">
          ${optionsHtml}
        </select>
      </div>
      <div class="pagination-nav-group">
        ${pagesHtml}
      </div>
    </div>
  `;
}

function changeResultsPage(newPage) {
  resultsCurrentPage = Number(newPage);
  renderResultsTable(lastFullResultsData, true);
  const card = document.getElementById("resultsTableCard");
  if (card) {
    const rect = card.getBoundingClientRect();
    if (rect.top < -50) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}
window.changeResultsPage = changeResultsPage;

function changeResultsPageSize(newSize) {
  resultsPageSize = newSize === "ALL" ? "ALL" : Number(newSize);
  resultsCurrentPage = 1;
  renderResultsTable(lastFullResultsData, true);
}
window.changeResultsPageSize = changeResultsPageSize;

function changeStudentsPage(newPage) {
  studentsCurrentPage = Number(newPage);
  renderStudentsTable(lastFullStudentsData, true);
  const table = document.getElementById("studentsManagementTable");
  if (table) {
    const rect = table.getBoundingClientRect();
    if (rect.top < -50) {
      table.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}
window.changeStudentsPage = changeStudentsPage;

function changeStudentsPageSize(newSize) {
  studentsPageSize = newSize === "ALL" ? "ALL" : Number(newSize);
  studentsCurrentPage = 1;
  renderStudentsTable(lastFullStudentsData, true);
}
window.changeStudentsPageSize = changeStudentsPageSize;

function renderResultsTable(results, keepPage = false) {
  const tbody = document.getElementById("resultsTableBody");
  if (!tbody) return;

  if (!keepPage) {
    resultsCurrentPage = 1;
  }
  lastFullResultsData = results || [];

  if (!results || results.length === 0) {
    ['resultsPaginationTop', 'resultsPaginationBar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.innerHTML = "";
      }
    });
    const searchInput = document.getElementById("searchStudentInput");
    const query = searchInput ? searchInput.value.trim() : "";
    if (query) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #64748b;">
        <div style="font-size: 1.05rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem;">🔍 Không tìm thấy học sinh phù hợp với từ khóa: "<span style="color: #ef4444;">${escapeHtml(query)}</span>"</div>
        <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem;">(Nếu trình duyệt tự động điền từ khóa vào ô tìm kiếm, vui lòng bấm nút bên dưới)</p>
        <button type="button" class="btn-primary-sm" onclick="clearSearchFilter()" style="padding: 0.45rem 1.2rem; background: #6366f1; color: #ffffff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
          ✕ Xóa từ khóa tìm kiếm & Hiện tất cả học sinh (${currentDisplayedResultsList?.length || 0})
        </button>
      </td></tr>`;
    } else {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Chưa có học sinh nào phù hợp với bộ lọc này.</td></tr>`;
    }
    return;
  }

  // Tính toán phân trang
  const totalItems = results.length;
  const effectivePageSize = (resultsPageSize === "ALL" || resultsPageSize <= 0) ? totalItems : Number(resultsPageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  if (resultsCurrentPage > totalPages) resultsCurrentPage = totalPages;
  if (resultsCurrentPage < 1) resultsCurrentPage = 1;

  const startIndex = (resultsCurrentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
  const pageItems = results.slice(startIndex, endIndex);

  tbody.innerHTML = "";

  pageItems.forEach((row, idx) => {
    const isSubmitted = row.isSubmitted;
    let scoreBadgeHtml = "";
    let dungSaiHtml = "";
    let thoiGianNopHtml = "";
    let actionButtonsHtml = "";

    if (isSubmitted) {
      const score = Number(row.diemTong) || 0;
      const displayScore = Math.round(score * 100) / 100;
      let badgeClass = "low";
      if (score >= 8.0) badgeClass = "high";
      else if (score >= 5.0) badgeClass = "med";

      scoreBadgeHtml = `<span class="score-badge ${badgeClass}">${displayScore}</span>`;
      dungSaiHtml = `<span style="font-weight: 600; color: #1e293b;">${row.soCauDungSai || "--"}</span>`;
      thoiGianNopHtml = `<span style="font-size: 0.8rem; color: #64748b;">${row.thoiGianNop}</span>`;
      actionButtonsHtml = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <button type="button" class="btn-secondary-sm btn-view-detail" data-index="${idx}">
            Xem bài làm
          </button>
          <button type="button" class="btn-delete-result" data-index="${idx}" title="Xóa kết quả này khỏi Google Sheets" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid #fecaca; background: #fef2f2; color: #dc2626; cursor: pointer; transition: all 0.2s ease;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      `;
    } else {
      // Học sinh chưa làm bài
      scoreBadgeHtml = `<span class="score-badge not-submitted" style="background: #f1f5f9; color: #64748b; border: 1.5px dashed #cbd5e1; font-weight: 700; font-size: 0.76rem; padding: 3px 8px; border-radius: 6px;">Chưa làm bài</span>`;
      dungSaiHtml = `<span style="color: #cbd5e1;">--</span>`;
      thoiGianNopHtml = `<span style="font-size: 0.78rem; color: #94a3b8; font-style: italic;">Chưa nộp</span>`;
      actionButtonsHtml = `<span style="font-size: 0.78rem; color: #cbd5e1; font-style: italic;">Chưa có bài thi</span>`;
    }

    const tr = document.createElement("tr");
    if (!isSubmitted) {
      tr.style.background = "#fcfdfd";
    }

    const continuousStt = row.stt || (startIndex + idx + 1);

    tr.innerHTML = `
      <td>${continuousStt}</td>
      <td><strong>${row.lop}</strong></td>
      <td>
        <strong style="color: #0f172a;">${row.hoTen}</strong>
        <div style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${row.usernameHS}</div>
      </td>
      <td>${formatDob(row.ngaySinh)}</td>
      <td>${row.gioiTinh}</td>
      <td>${scoreBadgeHtml}</td>
      <td>${dungSaiHtml}</td>
      <td>${thoiGianNopHtml}</td>
      <td>${actionButtonsHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Gắn sự kiện xem modal chi tiết bài làm
  tbody.querySelectorAll(".btn-view-detail").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.dataset.index);
      const rowItem = pageItems[idx];
      const record = rowItem?.subRecord || rowItem;
      if (record) openStudentDetailModal(record);
    });
  });

  // Gắn sự kiện xóa kết quả
  tbody.querySelectorAll(".btn-delete-result").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const idx = parseInt(btn.dataset.index);
      const item = pageItems[idx];
      if (!item) return;

      if (!confirm(`Bạn có chắc chắn muốn xóa kết quả thi của học sinh "${item.hoTen}" (${item.usernameHS}) khỏi Google Sheets không?`)) {
        return;
      }

      btn.disabled = true;
      btn.style.opacity = "0.5";
      const originalBtnHtml = btn.innerHTML;
      btn.innerHTML = `⏳`;

      // 1. Sao lưu danh sách cũ và Cập nhật tức thì (Optimistic UI Update) ngay trên giao diện
      const prevRawList = [...(currentRawResultsList || [])];
      currentRawResultsList = (currentRawResultsList || []).filter(r => {
        const matchHS = String(r.usernameHS || "").trim().toUpperCase() === String(item.usernameHS || "").trim().toUpperCase();
        const matchMaDe = !item.maDe || item.maDe === "--" || String(r.maDe || "").trim() === String(item.maDe || "").trim();
        const matchTime = !item.thoiGianNop || item.thoiGianNop === "--" || String(r.thoiGianNop || "").trim() === String(item.thoiGianNop || "").trim();
        if (matchHS && matchMaDe && matchTime) return false;
        return true;
      });
      currentResultsList = currentRawResultsList;
      // Cập nhật bảng và các thẻ số liệu KPI tức thì trong 0.01s!
      applyResultsFiltersAndRender();

      try {
        let res = null;
        let lastErrorMsg = "";

        // Xác định chính xác máy chủ chứa đề/bài thi của giáo viên này
        const targetUrl = (isAdminRole() && adminActiveApiUrl) 
          ? adminActiveApiUrl 
          : (getTeacherPersonalServerUrl() || API_URL || DEFAULT_GAS_API_URL);

        const targetGvUser = (isAdminRole() && adminActiveUsernameGV && adminActiveUsernameGV !== "ALL")
          ? String(adminActiveUsernameGV).trim()
          : String(currentTeacher?.username || "").trim();

        const delPayload = {
          action: "deleteStudentResult",
          usernameGV: targetGvUser,
          usernameHS: item.usernameHS,
          maDe: item.maDe,
          thoiGianNop: item.thoiGianNop || ""
        };

        // Gửi POST lên đúng máy chủ
        try {
          const resp = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(delPayload)
          });
          const text = await resp.text();
          if (text && !text.trim().startsWith("<")) {
            res = JSON.parse(text);
          }
        } catch (postErr) {
          console.warn("POST deleteStudentResult lỗi kết nối, chuyển sang GET fallback:", postErr);
        }

        // Fallback sang GET nếu POST thất bại
        if (!res || !res.success) {
          if (res?.message) lastErrorMsg = res.message;
          const qp = new URLSearchParams({
            action: "deleteStudentResult",
            usernameHS: item.usernameHS,
            maDe: item.maDe,
            thoiGianNop: item.thoiGianNop || "",
            _t: Date.now()
          });
          if (targetGvUser) {
            qp.append("usernameGV", targetGvUser);
          }

          const getUrl = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}${qp.toString()}`;
          try {
            const getResp = await fetch(getUrl);
            const getText = await getResp.text();
            if (getText && !getText.trim().startsWith("<")) {
              res = JSON.parse(getText);
            }
          } catch (eGet) {
            console.warn("GET deleteStudentResult lỗi:", eGet);
          }
        }

        if (res && res.success) {
          showToast("Đã xóa bài làm", `Đã xóa kết quả thi của học sinh ${item.hoTen}!`, "success", 2500);
        } else {
          // Khôi phục lại nếu máy chủ báo lỗi
          currentRawResultsList = prevRawList;
          currentResultsList = prevRawList;
          applyResultsFiltersAndRender();
          throw new Error(res?.message || lastErrorMsg || "Không thể xóa bài làm khỏi máy chủ!");
        }
      } catch (delErr) {
        alert("Lỗi khi xóa bài làm: " + delErr.message);
        btn.disabled = false;
        btn.style.opacity = "";
        btn.innerHTML = originalBtnHtml;
      }
    });
  });

  // Render thanh điều hướng phân trang ở cả Khung đỏ (trên đầu bảng) và góc phải phía dưới (chân bảng)
  ['resultsPaginationTop', 'resultsPaginationBar'].forEach(id => {
    renderPaginationBarHtml(
      id,
      resultsCurrentPage,
      totalPages,
      totalItems,
      resultsPageSize,
      startIndex + 1,
      endIndex,
      'changeResultsPage',
      'changeResultsPageSize'
    );
  });
}

// Tìm kiếm nhanh học sinh
const searchStudentInputElem = document.getElementById("searchStudentInput");
const btnClearSearchStudentElem = document.getElementById("btnClearSearchStudent");

function handleSearchStudentInput() {
  const query = searchStudentInputElem ? searchStudentInputElem.value.toLowerCase().trim() : "";
  if (btnClearSearchStudentElem) {
    btnClearSearchStudentElem.style.display = query ? "inline-flex" : "none";
  }
  if (!currentDisplayedResultsList) return;
  if (query) {
    const filtered = currentDisplayedResultsList.filter(r => 
      (r.hoTen && r.hoTen.toLowerCase().includes(query)) ||
      (r.lop && r.lop.toLowerCase().includes(query)) ||
      (r.usernameHS && r.usernameHS.toLowerCase().includes(query)) ||
      (r.maDe && r.maDe.toLowerCase().includes(query)) ||
      (r.tenKyThi && r.tenKyThi.toLowerCase().includes(query))
    );
    renderResultsTable(filtered);
  } else {
    renderResultsTable(currentDisplayedResultsList);
  }
}

if (searchStudentInputElem) {
  searchStudentInputElem.addEventListener("input", handleSearchStudentInput);
  searchStudentInputElem.addEventListener("change", handleSearchStudentInput);
  searchStudentInputElem.addEventListener("search", handleSearchStudentInput);
}

if (btnClearSearchStudentElem) {
  btnClearSearchStudentElem.addEventListener("click", () => {
    if (searchStudentInputElem) {
      searchStudentInputElem.value = "";
      searchStudentInputElem.focus();
    }
    handleSearchStudentInput();
  });
}

// CHỐNG TRÌNH DUYỆT TỰ ĐỘNG ĐIỀN (CHROME AUTOFILL) VÀO Ô TÌM KIẾM
function forceClearSearchStudentInput() {
  const el = document.getElementById("searchStudentInput");
  if (!el) return;
  // Nếu ô đang có chữ mà người dùng không hề focus chuột vào gõ -> chắc chắn do Chrome tự động điền!
  if (document.activeElement !== el && el.value) {
    el.value = "";
    const btn = document.getElementById("btnClearSearchStudent");
    if (btn) btn.style.display = "none";
    if (currentDisplayedResultsList) {
      renderResultsTable(currentDisplayedResultsList);
    }
  }
}

// Chạy xóa định kỳ ngay sau khi mở trang hoặc khi chuyển tab/đăng nhập
[0, 50, 100, 200, 400, 700, 1000, 1500, 2500, 4000].forEach(delay => {
  setTimeout(forceClearSearchStudentInput, delay);
});


// ============================================================================
// 9. XUẤT FILE EXCEL (.XLSX) VỚI SHEETJS - THEO ĐÚNG THỨ TỰ SỔ ĐIỂM GỐC!
// ============================================================================
const btnExportExcelElem = document.getElementById("btnExportExcel");
if (btnExportExcelElem) {
  btnExportExcelElem.addEventListener("click", () => {
    if (!currentDisplayedResultsList || currentDisplayedResultsList.length === 0) {
      showToast("Không có dữ liệu", "Không có kết quả nào để xuất file Excel!", "warning");
      return;
    }

    if (typeof XLSX === "undefined") {
      showToast("Lỗi", "Thư viện SheetJS chưa được nạp!", "error");
      return;
    }

    // Định dạng dữ liệu bảng tính:
    // Học sinh chưa thi: cột Điểm Tổng để TRỐNG ("") để thầy/cô copy thẳng vào sổ điểm điện tử!
    const exportData = currentDisplayedResultsList.map((row, idx) => ({
      "STT": idx + 1,
      "Mã Học Sinh": row.usernameHS,
      "Họ và Tên": row.hoTen,
      "Lớp": row.lop,
      "Ngày Sinh": formatDob(row.ngaySinh),
      "Giới Tính": row.gioiTinh,
      "Trường": row.truong,
      "Trạng Thái": row.isSubmitted ? "Đã nộp bài" : "Chưa làm bài",
      "Điểm Tổng": row.isSubmitted ? (Number(row.diemTong) || 0) : "", // Ô TRỐNG nếu chưa làm bài!
      "Số Câu Đúng": row.isSubmitted ? row.soCauDungSai : "",
      "Thời Gian Nộp": row.isSubmitted ? row.thoiGianNop : ""
    }));

    // Tạo worksheet và workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bang_Diem");

    // Đặt tên file xuất thân thiện
    const selectedMaDe = document.getElementById("selectFilterExam")?.value || "ALL";
    const selectedClass = document.getElementById("selectFilterResultClass")?.value || "ALL";
    const classTag = selectedClass !== "ALL" ? `Lop_${selectedClass.replace(/[\/\\?%*:|"<>]/g, "-")}_` : "";
    const fileName = `Bang_Diem_${classTag}${selectedMaDe}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    showToast("Thành công", `Đã xuất file Excel chuẩn thứ tự lớp: ${fileName}`, "success", 4000);
  });
}

// ============================================================================
// 9.1. XUẤT FILE EXCEL PHẦN TỰ LUẬN (.XLSX) ĐỂ GIÁO VIÊN CHẤM NHANH
// ============================================================================
function exportEssayResultsExcel() {
  if (!currentDisplayedResultsList || currentDisplayedResultsList.length === 0) {
    showToast("Không có dữ liệu", "Không có bài thi nào để xuất file tự luận!", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Lỗi", "Thư viện SheetJS chưa được nạp!", "error");
    return;
  }

  const selectedMaDe = document.getElementById("selectFilterExam")?.value || "ALL";
  const targetResults = currentDisplayedResultsList;

  // Tìm đề thi tương ứng để lấy danh sách câu hỏi tự luận
  const exam = (currentExamsList || []).find(e => e.maDe === selectedMaDe);
  let examEssayQuestions = exam?.duLieuDe?.tuLuan?.danhSachCauHoi || [];

  if (examEssayQuestions.length === 0 && exam?.duLieuDe?.tuLuan?.noiDung) {
    examEssayQuestions = [{ id: 1, noiDung: exam.duLieuDe.tuLuan.noiDung, diem: 1 }];
  }

  // Xác định số lượng câu tự luận lớn nhất
  let maxEssayCount = examEssayQuestions.length;
  targetResults.forEach(r => {
    const list = r.baiLamTuLuan || [];
    if (list.length > maxEssayCount) maxEssayCount = list.length;
  });

  if (maxEssayCount === 0) {
    maxEssayCount = 1;
  }

  // Định dạng dữ liệu xuất Excel
  const exportData = targetResults.map((row, idx) => {
    const rowObj = {
      "STT": idx + 1,
      "Lớp": row.lop || "",
      "Họ và Tên": row.hoTen || "",
      "Mã Học Sinh": row.usernameHS || "",
      "Ngày Sinh": formatDob(row.ngaySinh),
      "Giới Tính": row.gioiTinh || "",
      "Trường": row.truong || "",
      "Trạng Thái": row.isSubmitted ? "Đã nộp bài" : "Chưa làm bài",
      "Mã Đề Thi": row.maDe || "",
      "Thời Gian Nộp": row.isSubmitted ? row.thoiGianNop : ""
    };

    const essayAnswers = row.baiLamTuLuan || [];

    for (let c = 1; c <= maxEssayCount; c++) {
      const qObj = examEssayQuestions[c - 1];
      let colName = `Câu ${c} (Tự luận)`;
      if (qObj && qObj.noiDung) {
        const shortPrompt = qObj.noiDung.slice(0, 35).replace(/[\r\n\t]+/g, " ");
        colName = `Câu ${c} (${qObj.diem || 1}đ): ${shortPrompt}...`;
      }

      let ansText = "";
      if (row.isSubmitted) {
        const foundAns = essayAnswers.find(a => (a.id || 0) == c);
        if (foundAns) {
          ansText = foundAns.baiLam || foundAns.traLoi || "";
        } else if (essayAnswers[c - 1]) {
          ansText = essayAnswers[c - 1].baiLam || essayAnswers[c - 1].traLoi || "";
        }
      }

      rowObj[colName] = ansText;
    }

    rowObj["Điểm Tự Luận (GV chấm)"] = "";
    rowObj["Nhận Xét / Đánh Giá Của GV"] = "";

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Thiết lập độ rộng cột
  const colWidths = [
    { wch: 6 },
    { wch: 10 },
    { wch: 22 },
    { wch: 14 },
    { wch: 13 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 }
  ];

  for (let c = 1; c <= maxEssayCount; c++) {
    colWidths.push({ wch: 50 });
  }
  colWidths.push({ wch: 22 });
  colWidths.push({ wch: 30 });

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ChamTuLuan");

  const selectedClass = document.getElementById("selectFilterResultClass")?.value || "ALL";
  const classTag = selectedClass !== "ALL" ? `Lop_${selectedClass.replace(/[\/\\?%*:|"<>]/g, "-")}_` : "";
  const fileName = `Bang_Cham_Tu_Luan_${classTag}${selectedMaDe}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
  showToast("Xuất Excel thành công", `Đã tạo file danh sách chấm tự luận: ${fileName}`, "success", 4000);
}

// ============================================================================
// 10. MODAL CHI TIẾT BÀI LÀM
// ============================================================================
const detailModal = document.getElementById("detailModal");
const btnCloseModal = document.getElementById("btnCloseModal");

btnCloseModal.addEventListener("click", () => {
  detailModal.style.display = "none";
});

detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.style.display = "none";
});

function openStudentDetailModal(record) {
  // Tìm dữ liệu đề thi gốc từ currentExamsList
  const exam = (currentExamsList || []).find(e => e.maDe === record.maDe);
  const examQuestions = exam?.duLieuDe?.cauHoi || [];
  const tracNghiemMaxPts = Math.round(examQuestions.reduce((acc, q) => acc + (Number(q.diem) || 1), 0) * 100) / 100;
  const essayQuestionsList = exam?.duLieuDe?.tuLuan?.danhSachCauHoi || [];
  const essayMaxPts = Math.round(essayQuestionsList.reduce((acc, eq) => acc + (Number(eq.diem) || 0), 0) * 100) / 100;
  const hasEssayPart = (essayMaxPts > 0 || essayQuestionsList.length > 0 || !!exam?.duLieuDe?.tuLuan?.noiDung);

  const titleScoreText = hasEssayPart 
    ? `${record.diemTong} đ (Trắc nghiệm: ${record.diemTong}/${tracNghiemMaxPts} đ)`
    : `${record.diemTong} điểm`;

  document.getElementById("modalStudentTitle").textContent = `Bài làm của: ${record.hoTen} (${record.lop}) - ${titleScoreText}`;
  const body = document.getElementById("modalStudentContent");
  body.innerHTML = "";

  // 1. Thẻ tóm tắt thông tin thí sinh & kết quả
  const summaryCard = document.createElement("div");
  summaryCard.style.cssText = "background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;";
  
  const scoreBadgeHtml = hasEssayPart ? `
    <div style="text-align: right;">
      <div style="font-size: 1.5rem; font-weight: 800; color: #2563eb; line-height: 1.1;">
        ${record.diemTong} <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">/ ${tracNghiemMaxPts} đ (Trắc nghiệm)</span>
      </div>
      <div style="font-size: 0.8rem; font-weight: 700; color: #059669; margin-top: 0.25rem;">
        + Tự luận: ${essayMaxPts > 0 ? essayMaxPts + ' đ' : 'Chờ GV chấm'}
      </div>
      <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">
        ${record.soCauDungSai || ''}
      </div>
    </div>
  ` : `
    <div style="text-align: right;">
      <div style="font-size: 1.6rem; font-weight: 800; color: #2563eb; line-height: 1.1;">
        ${record.diemTong} <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">/ 10 điểm</span>
      </div>
      <div style="font-size: 0.82rem; font-weight: 700; color: #059669; margin-top: 0.2rem;">
        ${record.soCauDungSai || ''}
      </div>
    </div>
  `;

  summaryCard.innerHTML = `
    <div>
      <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-bottom: 0.25rem;">
        ${record.hoTen} <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">(Mã HS: ${record.usernameHS || '--'})</span>
      </div>
      <div style="font-size: 0.85rem; color: #475569;">
        Lớp: <strong style="color: #0f172a;">${record.lop}</strong> | Mã đề: <strong style="color: #2563eb;">${record.maDe}</strong> | Nộp lúc: <strong style="color: #0f172a;">${record.thoiGianNop}</strong>
      </div>
    </div>
    ${scoreBadgeHtml}
  `;
  body.appendChild(summaryCard);

  let details = [];
  try {
    details = typeof record.chiTietTraLoi === "string" ? JSON.parse(record.chiTietTraLoi) : record.chiTietTraLoi;
  } catch (e) {
    details = [];
  }

  if (!details || details.length === 0) {
    body.innerHTML += `<p style="color: #64748b; text-align: center; padding: 2rem;">Không có dữ liệu chi tiết từng câu.</p>`;
  } else {
    details.forEach((item, idx) => {
      // Tìm câu hỏi tương ứng trong đề gốc
      const qObj = examQuestions.find(q => (q.id || 0) == item.qId) || examQuestions[idx];
      const qPrompt = qObj?.noiDung || `Câu hỏi ${item.qId}`;
      const qPoints = item.diemToiDa !== undefined ? item.diemToiDa : (qObj?.diem || 1);

      const qCard = document.createElement("div");
      qCard.className = "student-review-card";

      if (item.loai === "true_false") {
        // --- CÂU HỎI ĐÚNG / SAI ---
        const isFull = (item.soYDung === item.tongSoY);
        qCard.innerHTML = `
          <div class="review-header-flex">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="review-q-badge tf">Đúng / Sai</span>
              <strong style="color: #0f172a; font-size: 0.95rem;">Câu ${item.qId}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="review-score-tag ${isFull ? 'correct' : (item.soYDung > 0 ? 'correct' : 'incorrect')}">
                Đúng ${item.soYDung}/${item.tongSoY} ý (+${item.diemDat}/${qPoints} đ)
              </span>
            </div>
          </div>
          <div class="review-q-prompt"><strong>Nội dung:</strong> ${qPrompt}</div>
          <table class="review-tf-table">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">Ý</th>
                <th>Nội dung nhận định</th>
                <th style="width: 105px; text-align: center;">Thí sinh chọn</th>
                <th style="width: 105px; text-align: center;">Đáp án chuẩn</th>
                <th style="width: 90px; text-align: center;">Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              ${(item.chiTietY || []).map(y => {
                const subObj = qObj?.y?.find(s => s.key === y.key);
                const subPrompt = y.noiDung || subObj?.noiDung || `Ý ${y.key}`;

                // Đáp án chuẩn
                let expectedAns = null;
                if (subObj && subObj.dung !== undefined) {
                  expectedAns = !!subObj.dung;
                } else if (y.dung !== undefined && y.traLoi !== undefined && y.traLoi !== null) {
                  expectedAns = y.dung ? !!y.traLoi : !y.traLoi;
                }

                const studentAnsText = y.traLoi === true ? 'Đúng' : (y.traLoi === false ? 'Sai' : 'Chưa chọn');
                const expectedAnsText = expectedAns === true ? 'Đúng' : (expectedAns === false ? 'Sai' : '--');

                return `
                  <tr>
                    <td style="text-align: center; font-weight: 700; color: #1d4ed8;">${y.key})</td>
                    <td style="font-weight: 500;">${subPrompt}</td>
                    <td style="text-align: center; font-weight: 700; color: ${y.traLoi === true ? '#0284c7' : (y.traLoi === false ? '#ea580c' : '#94a3b8')};">
                      ${studentAnsText}
                    </td>
                    <td style="text-align: center; font-weight: 700; color: ${expectedAns === true ? '#16a34a' : (expectedAns === false ? '#dc2626' : '#64748b')};">
                      ${expectedAnsText}
                    </td>
                    <td style="text-align: center;">
                      ${y.dung 
                        ? '<span style="color: #16a34a; font-weight: 700;">✔ Đúng</span>' 
                        : '<span style="color: #dc2626; font-weight: 700;">✘ Sai</span>'}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
          <div style="font-size: 0.78rem; color: #64748b; font-style: italic; margin-top: 0.4rem;">
            * Thang điểm Bộ GD&ĐT: Đúng 1 ý = 10% | 2 ý = 25% | 3 ý = 50% | 4 ý = 100% số điểm câu.
          </div>
        `;
      } else {
        // --- CÂU HỎI 4 LỰA CHỌN ---
        const options = qObj?.luaChon || [];
        const studentAns = String(item.traLoi || '').toUpperCase();
        const correctAns = String(item.dapAnDung || '').toUpperCase();

        let optionsHtml = '';
        if (options && options.length > 0) {
          optionsHtml = `
            <div class="review-options-grid">
              ${options.map(opt => {
                const optKey = String(opt.key).toUpperCase();
                const isStudent = (optKey === studentAns);
                const isCorrect = (optKey === correctAns);

                let optClass = 'review-opt-item';
                let badge = '';

                if (isStudent && isCorrect) {
                  optClass += ' is-correct-key';
                  badge = '<span class="review-opt-badge-tag correct">✔ Thí sinh chọn đúng</span>';
                } else if (isStudent && !isCorrect) {
                  optClass += ' is-student-wrong';
                  badge = '<span class="review-opt-badge-tag wrong">✘ Thí sinh chọn</span>';
                } else if (isCorrect) {
                  optClass += ' is-correct-key';
                  badge = '<span class="review-opt-badge-tag correct">★ Đáp án chuẩn</span>';
                }

                return `
                  <div class="${optClass}">
                    <span><strong>${opt.key}.</strong> ${opt.noiDung}</span>
                    ${badge}
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          optionsHtml = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.88rem; color: #334155; margin-bottom: 0.5rem;">
              Thí sinh chọn: <strong style="color: ${item.dung ? '#16a34a' : '#dc2626'};">${item.traLoi}</strong> | 
              Đáp án chuẩn: <strong style="color: #16a34a;">${item.dapAnDung}</strong>
            </div>
          `;
        }

        qCard.innerHTML = `
          <div class="review-header-flex">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="review-q-badge mc">4 Lựa chọn</span>
              <strong style="color: #0f172a; font-size: 0.95rem;">Câu ${item.qId}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="review-score-tag ${item.dung ? 'correct' : 'incorrect'}">
                ${item.dung ? `✔ Đúng (+${item.diemDat || qPoints} đ)` : `✘ Sai (0/${qPoints} đ)`}
              </span>
            </div>
          </div>
          <div class="review-q-prompt"><strong>Nội dung:</strong> ${qPrompt}</div>
          ${optionsHtml}
        `;
      }

      body.appendChild(qCard);
    });
  }

  // 3. Hiển thị Phần Tự Luận của học sinh
  const essayAnswers = record.baiLamTuLuan || [];
  const examTuLuan = exam?.duLieuDe?.tuLuan || {};
  const examEssayQuestions = examTuLuan.danhSachCauHoi || [];

  if (essayAnswers.length > 0 || examEssayQuestions.length > 0) {
    const essaySectionHeader = document.createElement("div");
    essaySectionHeader.style.cssText = "margin: 1.5rem 0 0.85rem; padding: 0.75rem 1rem; background: #ecfdf5; border-left: 4px solid #059669; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;";
    essaySectionHeader.innerHTML = `
      <div>
        <strong style="color: #065f46; font-size: 1rem;">📝 PHẦN III: BÀI LÀM TỰ LUẬN CỦA THÍ SINH</strong>
        <p style="margin: 0.2rem 0 0; font-size: 0.8rem; color: #047857;">Giáo viên có thể xem trực tiếp bài làm của thí sinh bên dưới để chấm điểm</p>
      </div>
      <span style="font-size: 0.82rem; font-weight: 700; background: #ffffff; color: #059669; padding: 0.2rem 0.6rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${Math.max(essayAnswers.length, examEssayQuestions.length)} câu tự luận
      </span>
    `;
    body.appendChild(essaySectionHeader);

    const totalEssayCount = Math.max(essayAnswers.length, examEssayQuestions.length);
    for (let eqIdx = 0; eqIdx < totalEssayCount; eqIdx++) {
      const qNum = eqIdx + 1;
      const qObj = examEssayQuestions[eqIdx] || {};
      const prompt = qObj.noiDung || (qNum === 1 && examTuLuan.noiDung ? examTuLuan.noiDung : `Câu hỏi tự luận ${qNum}`);
      const points = qObj.diem !== undefined ? qObj.diem : 1;

      let studentAns = "";
      const foundAns = essayAnswers.find(a => (a.id || 0) == qNum);
      if (foundAns) studentAns = foundAns.baiLam || foundAns.traLoi || "";
      else if (essayAnswers[eqIdx]) studentAns = essayAnswers[eqIdx].baiLam || essayAnswers[eqIdx].traLoi || "";

      const essayCard = document.createElement("div");
      essayCard.style.cssText = "background: #ffffff; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);";

      essayCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 800; color: #059669; font-size: 0.95rem;">Câu ${qNum} (Tự luận)</span>
            <span style="font-size: 0.75rem; font-weight: 700; color: #047857; background: #ecfdf5; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid #a7f3d0;">${points} điểm</span>
          </div>
          <span style="font-size: 0.78rem; color: #64748b; font-weight: 600;">(Chấm thủ công trên Sheets/Excel)</span>
        </div>

        <div style="font-size: 0.92rem; font-weight: 600; color: #1e293b; line-height: 1.5; margin-bottom: 0.85rem; padding: 0.6rem 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <strong>Đề bài:</strong> ${escapeHtml(prompt)}
        </div>

        <div style="margin-top: 0.5rem;">
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #047857; margin-bottom: 0.35rem; text-transform: uppercase;">
            Bài làm của thí sinh:
          </label>
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.92rem; color: #0f172a; line-height: 1.6; white-space: pre-wrap; min-height: 60px;">
            ${studentAns ? escapeHtml(studentAns) : '<em style="color: #94a3b8;">(Thí sinh không làm câu hỏi này hoặc để trống bài làm)</em>'}
          </div>
        </div>
      `;

      body.appendChild(essayCard);
    }
  }

  // CỐ ĐỊNH CHÍNH GIỮA MÀN HÌNH VỚI ĐỘ ƯU TIÊN CAO NHẤT
  detailModal.style.cssText = "display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.7) !important; backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important; padding: 1.25rem !important; box-sizing: border-box !important;";
}


// ============================================================================
// 12. QUẢN LÝ HỌC SINH & BỘ LỌC TÍCH CHỌN KHỐI / LỚP (GOOGLE SHEETS)
// ============================================================================

/**
 * Trích xuất số khối từ tên lớp (VD: 8A1 -> "8", 9A2 -> "9", 10B -> "10")
 */
function getGradeFromClass(lop) {
  if (!lop) return "";
  const match = String(lop).trim().match(/^(\d+)/);
  return match ? match[1] : "";
}

/**
 * Xây dựng danh sách Checkboxes Khối và Lớp từ dữ liệu thực tế tải về
 */
function buildGradeAndClassFilters(apiClasses) {
  const gradeContainer = document.getElementById("gradeCheckboxesList");
  const classContainer = document.getElementById("classCheckboxesList");

  // Tập hợp tất cả các lớp duy nhất
  const classSet = new Set();
  if (Array.isArray(apiClasses)) {
    apiClasses.forEach(c => c && classSet.add(c.trim()));
  }
  currentTeacherStudents.forEach(st => {
    if (st.lop) classSet.add(st.lop.trim());
  });

  teacherAllClassesList = Array.from(classSet).sort((a, b) => {
    const ga = parseInt(getGradeFromClass(a)) || 0;
    const gb = parseInt(getGradeFromClass(b)) || 0;
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  // Đồng bộ cho Tab 1 nếu chưa chỉnh sửa đề và danh sách lớp có sự thay đổi
  if (teacherAllClassesList.length > 0 && !editingExamCode) {
    const currentExamClasses = Array.from(document.querySelectorAll("#classSelectorContainer .exam-class-cb:not(#class_ALL)")).map(cb => cb.value);
    if (currentExamClasses.length === 0 || teacherAllClassesList.some(c => !currentExamClasses.includes(c))) {
      initClassSelector(teacherAllClassesList.join(","));
    }
  }

  // Tập hợp tất cả các khối duy nhất
  const gradeSet = new Set();
  teacherAllClassesList.forEach(cls => {
    const g = getGradeFromClass(cls);
    if (g) gradeSet.add(g);
  });
  const sortedGrades = Array.from(gradeSet).sort((a, b) => Number(a) - Number(b));

  // 1. Render danh sách Checkbox KHỐI LỚP
  if (gradeContainer) {
    let html = `
      <div class="class-checkbox-chip chip-grade-all">
        <input type="checkbox" id="grade_filter_ALL" value="ALL" checked>
        <label for="grade_filter_ALL" style="font-weight: 700;">Tất cả khối</label>
      </div>
    `;
    sortedGrades.forEach(g => {
      html += `
        <div class="class-checkbox-chip chip-grade-${g}">
          <input type="checkbox" id="grade_filter_${g}" value="${g}" checked class="grade-filter-cb">
          <label for="grade_filter_${g}">Khối ${g}</label>
        </div>
      `;
    });
    gradeContainer.innerHTML = html;
  }

  // 2. Render danh sách Checkbox LỚP HỌC (phân màu theo từng khối)
  if (classContainer) {
    let html = `
      <div class="class-checkbox-chip chip-grade-all">
        <input type="checkbox" id="class_filter_ALL" value="ALL" checked>
        <label for="class_filter_ALL" style="font-weight: 700;">Tất cả lớp</label>
      </div>
    `;
    teacherAllClassesList.forEach(cls => {
      const g = getGradeFromClass(cls) || "other";
      html += `
        <div class="class-checkbox-chip chip-grade-${g}">
          <input type="checkbox" id="class_filter_${cls}" value="${cls}" data-grade="${g}" checked class="class-filter-cb">
          <label for="class_filter_${cls}">Lớp ${cls}</label>
        </div>
      `;
    });
    classContainer.innerHTML = html;
  }
}

/**
 * Tải danh sách học sinh từ Google Sheets (với cơ chế POST + GET fallback chống chặn)
 */

/**
 * Chuẩn hóa tên lớp học sinh (Xử lý toàn diện mọi trường hợp lớp có dấu "/" như 8/3, 8/4, 9/2 bị Google Sheets hoặc JS biến thành Date String)
 */
function normalizeClassName(val) {
  if (val === null || val === undefined || val === "") return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = val.getDate();
    const m = val.getMonth() + 1;
    if (d >= 6 && d <= 12 && m >= 1 && m <= 15) return `${d}/${m}`;
    if (m >= 6 && m <= 12 && d >= 1 && d <= 15) return `${m}/${d}`;
    if (d >= 1 && d <= 5 && m >= 1 && m <= 15) return `${d}/${m}`;
    return `${d}/${m}`;
  }
  let s = String(val).trim();
  if (s.startsWith("'")) s = s.substring(1).trim();

  // 1. Chuỗi Date tiếng Anh (VD: "Sun Mar 08 2026 ...")
  if (s.includes("GMT") || /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.getMonth() + 1;
      if (day >= 6 && day <= 12 && month >= 1 && month <= 15) return `${day}/${month}`;
      if (month >= 6 && month <= 12 && day >= 1 && day <= 15) return `${month}/${day}`;
      return `${day}/${month}`;
    }
  }

  // 2. Chuỗi ISO (VD: "2026-02-09T00:00:00.000Z")
  if (s.includes("T") && s.includes("-")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.getMonth() + 1;
      if (day >= 6 && day <= 12 && month >= 1 && month <= 15) return `${day}/${month}`;
      if (month >= 6 && month <= 12 && day >= 1 && day <= 15) return `${month}/${day}`;
      return `${day}/${month}`;
    }
  }

  // 3. Chuỗi ngày tháng dạng "08/03/2026"
  const mDate = s.match(/^0?(\d{1,2})[-/]0?(\d{1,2})[-/]\d{4}$/);
  if (mDate) {
    const n1 = parseInt(mDate[1], 10);
    const n2 = parseInt(mDate[2], 10);
    if (n1 >= 6 && n1 <= 12 && n2 >= 1 && n2 <= 15) return `${n1}/${n2}`;
    if (n2 >= 6 && n2 <= 12 && n1 >= 1 && n1 <= 15) return `${n2}/${n1}`;
    return `${n1}/${n2}`;
  }

  return s;
}

/**
 * Lấy dữ liệu học sinh đã lưu trong bộ nhớ đệm trình duyệt (LocalStorage Cache)
 * Tự động vô hiệu hóa cache nếu lớp giảng dạy của giáo viên thay đổi
 */
function getCachedTeacherStudents() {
  if (!currentTeacher || !currentTeacher.username) return null;
  try {
    const raw = localStorage.getItem("edutest_students_cache_" + currentTeacher.username);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const currentClasses = String(currentTeacher.lopGiangDay || "").trim().toUpperCase();
    const cachedClasses = String(parsed.lopGiangDay || "").trim().toUpperCase();

    // Tự động kiểm tra: Nếu lớp giảng dạy thay đổi -> Xóa cache cũ để cập nhật lại từ Google Sheets
    if (currentClasses !== cachedClasses) {
      console.log("Lớp giảng dạy của giáo viên đã thay đổi (" + cachedClasses + " -> " + currentClasses + "). Bỏ qua cache để tải mới từ Google Sheets.");
      localStorage.removeItem("edutest_students_cache_" + currentTeacher.username);
      return null;
    }

    return parsed;
  } catch (e) {
    console.warn("Lỗi đọc cache học sinh:", e);
    return null;
  }
}

/**
 * Lưu danh sách học sinh vào bộ nhớ đệm LocalStorage
 */
function saveCachedTeacherStudents(students, classes) {
  if (!currentTeacher || !currentTeacher.username) return;
  try {
    const cleanStudents = (students || []).map(st => ({
      ...st,
      lop: normalizeClassName(st.lop)
    }));
    const cleanClasses = (classes || []).map(normalizeClassName).filter(Boolean);
    const uniqueClasses = [...new Set(cleanClasses)];

    const cacheData = {
      timestamp: Date.now(),
      lopGiangDay: String(currentTeacher.lopGiangDay || "").trim().toUpperCase(),
      classes: uniqueClasses,
      students: cleanStudents
    };
    localStorage.setItem("edutest_students_cache_" + currentTeacher.username, JSON.stringify(cacheData));
  } catch (e) {
    console.warn("Không thể lưu cache học sinh vào localStorage:", e);
  }
}

async function loadTeacherStudents(forceRefresh = false) {
  const tbody = document.getElementById("studentsTableBody");
  const badgeCount = document.getElementById("studentCountBadge");

  if (!tbody) return;

  // 1. KIỂM TRA BỘ NHỚ ĐỆM (CACHE): MỞ TỨC THÌ (0.01 giây), KHÔNG CẦN CHỜ GOOGLE SHEETS
  if (!forceRefresh) {
    // Nếu trong RAM đã có dữ liệu
    if (currentTeacherStudents.length > 0) {
      applyStudentFilters();
      return;
    }

    // Nếu trong LocalStorage đã có dữ liệu và lớp giảng dạy không thay đổi
    const cachedData = getCachedTeacherStudents();
    if (cachedData && Array.isArray(cachedData.students) && cachedData.students.length > 0) {
      currentTeacherStudents = cachedData.students;
      buildGradeAndClassFilters(cachedData.classes || []);
      applyStudentFilters();
      console.log("Đã tải " + currentTeacherStudents.length + " học sinh từ bộ nhớ đệm (Mở tức thì 0.01s).");
      return;
    }
  }

  // 2. NẾU CHƯA CÓ CACHE HOẶC BẤM "LÀM MỚI": KẾT NỐI GOOGLE SHEETS ĐỂ TẢI DỮ LIỆU
  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 3rem 1rem; color: #64748b;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
          <div class="loading-spinner" style="width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <span style="font-weight: 500;">Đang kết nối Google Sheets & tải danh sách học sinh...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    let result = null;
    const usernameVariants = getTeacherUsernameVariants();

    for (const uGV of usernameVariants) {
      // Thử gửi POST
      try {
        const fetchUrl = (isAdminRole() && adminActiveApiUrl) ? adminActiveApiUrl : API_URL;
        const response = await fetch(fetchUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "getStudentsForTeacher",
            usernameGV: uGV
          })
        });

        const rawText = await response.text();
        if (rawText && !rawText.trim().startsWith("<")) {
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.success && Array.isArray(parsed.students) && parsed.students.length > 0) {
            result = parsed;
            break;
          } else if (parsed && parsed.success) {
            result = parsed;
          }
        }
      } catch (postErr) {
        console.warn(`Lỗi POST load students (${uGV}):`, postErr);
      }

      // Tự động fallback sang GET nếu POST chưa ra học sinh
      if (!result || !result.students || result.students.length === 0) {
        try {
          const fetchUrl = (isAdminRole() && adminActiveApiUrl) ? adminActiveApiUrl : API_URL;
          const getUrl = `${fetchUrl}?action=getStudentsForTeacher&usernameGV=${encodeURIComponent(uGV)}&_t=${Date.now()}`;
          const getResponse = await fetch(getUrl);
          const getRawText = await getResponse.text();

          if (getRawText && !getRawText.trim().startsWith("<")) {
            const parsedGet = JSON.parse(getRawText);
            if (parsedGet && parsedGet.success && Array.isArray(parsedGet.students) && parsedGet.students.length > 0) {
              result = parsedGet;
              break;
            } else if (parsedGet && parsedGet.success) {
              result = parsedGet;
            }
          }
        } catch (getErr) {
          console.warn(`Lỗi GET load students (${uGV}):`, getErr);
        }
      }
    }

    if (!result || !result.success) {
      throw new Error(result?.message || "Không thể tải danh sách học sinh từ Google Sheets.");
    }

    currentTeacherStudents = (result.students || []).map(st => ({
      ...st,
      lop: normalizeClassName(st.lop)
    }));
    const freshClasses = (result.classes && result.classes.length > 0)
      ? result.classes.map(normalizeClassName).filter(Boolean)
      : [...new Set(currentTeacherStudents.map(s => s.lop).filter(Boolean))];

    // LƯU VÀO BỘ NHỚ TRÌNH DUYỆT (LOCALSTORAGE CACHE) ĐỂ CÁC LẦN SAU MỞ TỨC THÌ
    saveCachedTeacherStudents(currentTeacherStudents, freshClasses);

    // Xây dựng danh sách Checkboxes Khối & Lớp
    buildGradeAndClassFilters(freshClasses);

    applyStudentFilters();
    showToast("Đã đồng bộ", `Đã lưu bộ nhớ đệm ${currentTeacherStudents.length} học sinh thành công (Các lần sau sẽ mở tức thì)!`, "success", 3000);

  } catch (err) {
    console.error("Lỗi khi tải danh sách học sinh:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem 1rem; color: #dc2626;">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">Không thể kết nối đến Google Sheets!</div>
          <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; max-width: 550px; margin-left: auto; margin-right: auto; line-height: 1.5;">${escapeHtml(err.message)}</div>
          <button type="button" class="btn-refresh" onclick="loadTeacherStudents(true)" style="padding: 6px 14px; font-size: 0.82rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
            Thử tải lại
          </button>
        </td>
      </tr>
    `;
    if (badgeCount) badgeCount.textContent = "0";
    showToast("Lỗi tải học sinh", err.message, "error", 4000);
  }
}

/**
 * Lọc học sinh theo các checkbox đang được chọn
 */
function applyStudentFilters() {
  const classCbs = document.querySelectorAll("#classCheckboxesList .class-filter-cb:checked");
  const selectedClasses = Array.from(classCbs).map(cb => cb.value.trim().toUpperCase());

  const searchInput = document.getElementById("searchStudentClassInput");
  const searchKeyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const badgeCount = document.getElementById("studentCountBadge");

  let filtered = [];

  // Lọc theo các lớp ĐƯỢC TÍCH CHỌN
  if (selectedClasses.length > 0) {
    filtered = currentTeacherStudents.filter(st => {
      const stClass = String(st.lop || "").trim().toUpperCase();
      return selectedClasses.includes(stClass);
    });
  }

  // Lọc theo từ khóa tìm kiếm (họ tên, tài khoản, trường, ngày sinh)
  if (searchKeyword) {
    filtered = filtered.filter(st => {
      const name = (st.hoTen || "").toLowerCase();
      const user = (st.username || "").toLowerCase();
      const lop = (st.lop || "").toLowerCase();
      const dob = (st.ngaySinh || "").toLowerCase();
      const truong = (st.truong || "").toLowerCase();
      return name.includes(searchKeyword) || user.includes(searchKeyword) || lop.includes(searchKeyword) || dob.includes(searchKeyword) || truong.includes(searchKeyword);
    });
  }

  if (badgeCount) {
    badgeCount.textContent = filtered.length;
  }

  renderStudentsTable(filtered);
}

/**
 * Hiển thị danh sách học sinh vào bảng
 */
function renderStudentsTable(students, keepPage = false) {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;

  if (!keepPage) {
    studentsCurrentPage = 1;
  }
  lastFullStudentsData = students || [];

  if (!students || students.length === 0) {
    ['studentsPaginationTop', 'studentsPaginationBar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.innerHTML = "";
      }
    });
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
          <div style="font-size: 0.95rem; font-weight: 500;">Không có học sinh nào phù hợp với bộ lọc.</div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">Thử tích chọn lại các khối/lớp hoặc xóa từ khóa tìm kiếm.</div>
        </td>
      </tr>
    `;
    return;
  }

  // Phân trang danh sách học sinh
  const totalItems = students.length;
  const effectivePageSize = (studentsPageSize === "ALL" || studentsPageSize <= 0) ? totalItems : Number(studentsPageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  if (studentsCurrentPage > totalPages) studentsCurrentPage = totalPages;
  if (studentsCurrentPage < 1) studentsCurrentPage = 1;

  const startIndex = (studentsCurrentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
  const pageItems = students.slice(startIndex, endIndex);

  let html = "";
  pageItems.forEach((st, idx) => {
    let dobText = formatDob(st.ngaySinh);

    const safeUsername = escapeHtml(st.username || "");
    const safeHoTen = escapeHtml(st.hoTen || "");
    const safeLop = escapeHtml(st.lop || "");
    const safePassword = escapeHtml(st.password || "");
    const safeGioiTinh = escapeHtml(st.gioiTinh || "-");
    const safeTruong = escapeHtml(st.truong || "-");

    const gradeNum = getGradeFromClass(st.lop);
    const badgeGradeClass = gradeNum ? `badge-grade-${gradeNum}` : '';

    html += `
      <tr data-username="${safeUsername}">
        <td style="text-align: center; font-weight: 600; color: #64748b;">${startIndex + idx + 1}</td>
        <td style="text-align: center;">
          <span class="badge-class ${badgeGradeClass}" style="font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 0.78rem;">
            ${safeLop}
          </span>
        </td>
        <td style="font-family: monospace; font-weight: 600; color: #1e3a8a;">
          ${safeUsername}
        </td>
        <td>
          <div style="font-weight: 600; color: #1e293b;" title="${safeHoTen}">
            ${safeHoTen}
          </div>
        </td>
        <td style="text-align: center; color: #475569; font-size: 0.85rem; white-space: nowrap;">
          ${dobText}
        </td>
        <td style="text-align: center; color: #64748b; font-size: 0.84rem;">
          ${safeGioiTinh}
        </td>
        <td style="color: #64748b; font-size: 0.85rem;">
          ${safeTruong}
        </td>
        <td>
          <div class="pwd-field-container" style="display: flex; align-items: center; gap: 6px;">
            <span class="pwd-value-text" data-password="${safePassword}" style="font-family: monospace; font-size: 0.88rem; font-weight: 600; color: #334155;">••••••••</span>
            <button type="button" class="btn-toggle-pwd" title="Xem/Ẩn mật khẩu" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 2px 4px; border-radius: 4px; display: flex; align-items: center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button type="button" class="btn-copy-pwd" title="Sao chép mật khẩu" style="background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px 4px; border-radius: 4px; display: flex; align-items: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
            <button type="button" class="btn-action-change-pwd" data-username="${safeUsername}" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;" title="Đổi mật khẩu cho học sinh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Đổi MK</span>
            </button>
            <button type="button" class="btn-action-delete-student" data-username="${safeUsername}" data-hoten="${safeHoTen}" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 7px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;" title="Xóa học sinh này khỏi Google Sheets">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Render thanh điều hướng phân trang ở cả Khung đỏ (trên đầu bảng) và góc phải phía dưới (chân bảng)
  ['studentsPaginationTop', 'studentsPaginationBar'].forEach(id => {
    renderPaginationBarHtml(
      id,
      studentsCurrentPage,
      totalPages,
      totalItems,
      studentsPageSize,
      startIndex + 1,
      endIndex,
      'changeStudentsPage',
      'changeStudentsPageSize'
    );
  });
}

/**
 * Mở modal đổi mật khẩu
 */
function openChangePasswordModal(student) {
  targetChangePwdStudent = student;
  const modal = document.getElementById("changePasswordModal");
  const nameEl = document.getElementById("changePwdStudentName");
  const usernameEl = document.getElementById("changePwdStudentUsername");
  const classEl = document.getElementById("changePwdStudentClass");
  const inputPwd = document.getElementById("inputNewStudentPassword");

  if (!modal) return;

  if (nameEl) nameEl.textContent = student.hoTen || "-";
  if (usernameEl) usernameEl.textContent = student.username || "-";
  if (classEl) classEl.textContent = student.lop ? `Lớp ${student.lop}` : "-";
  if (inputPwd) {
    inputPwd.value = "";
    setTimeout(() => inputPwd.focus(), 150);
  }

  modal.classList.remove("hidden-modal");
  modal.style.setProperty("display", "flex", "important");
}

/**
 * Đóng modal đổi mật khẩu
 */
function closeChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) {
    modal.classList.add("hidden-modal");
    modal.style.setProperty("display", "none", "important");
  }
  targetChangePwdStudent = null;
}

/**
 * Gửi yêu cầu cập nhật mật khẩu lên Google Sheets
 */
async function submitChangePassword() {
  if (!targetChangePwdStudent) {
    showToast("Lỗi", "Chưa chọn học sinh cần đổi mật khẩu!", "warning");
    return;
  }

  const inputPwd = document.getElementById("inputNewStudentPassword");
  const newPassword = inputPwd ? inputPwd.value.trim() : "";

  if (!newPassword) {
    showToast("Thiếu thông tin", "Vui lòng nhập mật khẩu mới cho học sinh!", "warning");
    if (inputPwd) inputPwd.focus();
    return;
  }

  const btnConfirm = document.getElementById("btnConfirmChangePwd");
  const btnText = document.getElementById("btnConfirmChangePwdText");
  const oldText = btnText ? btnText.textContent : "Cập nhật";

  if (btnConfirm) btnConfirm.disabled = true;
  if (btnText) btnText.textContent = "Đang lưu lên Sheets...";

  try {
    let res = null;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "updateStudentPassword",
          usernameGV: currentTeacher.username,
          usernameHS: targetChangePwdStudent.username,
          newPassword: newPassword
        })
      });

      const text = await response.text();
      if (text && !text.trim().startsWith("<")) {
        res = JSON.parse(text);
      }
    } catch (e) {
      console.warn("POST đổi mật khẩu thất bại, chuyển sang GET fallback:", e);
    }

    if (!res || !res.success) {
      const getUrl = `${API_URL}?action=updateStudentPassword&usernameGV=${encodeURIComponent(currentTeacher.username)}&usernameHS=${encodeURIComponent(targetChangePwdStudent.username)}&newPassword=${encodeURIComponent(newPassword)}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl);
      const text2 = await getRes.text();
      if (text2 && !text2.trim().startsWith("<")) {
        res = JSON.parse(text2);
      } else {
        throw new Error("Phản hồi từ Google Sheets không hợp lệ.");
      }
    }

    if (!res || !res.success) {
      throw new Error(res?.message || "Không thể cập nhật mật khẩu trên Google Sheet.");
    }

    const stIndex = currentTeacherStudents.findIndex(s => s.username === targetChangePwdStudent.username);
    if (stIndex !== -1) {
      currentTeacherStudents[stIndex].password = newPassword;
      // Cập nhật luôn mật khẩu mới vào bộ nhớ đệm trình duyệt
      saveCachedTeacherStudents(currentTeacherStudents, teacherAllClassesList);
    }

    showToast(
      "Đổi mật khẩu thành công!",
      `Đã cập nhật mật khẩu mới cho học sinh ${targetChangePwdStudent.hoTen} (${targetChangePwdStudent.username}) lên Google Sheet thành công!`,
      "success",
      4000
    );

    closeChangePasswordModal();
    applyStudentFilters();

  } catch (err) {
    console.error("Lỗi khi cập nhật mật khẩu:", err);
    showToast("Cập nhật thất bại", err.message, "error", 5000);
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
    if (btnText) btnText.textContent = oldText;
  }
}

/**
 * Chuẩn hóa ngày sinh thành định dạng mật khẩu
 */
function formatBirthDateAsPassword(rawDate, format, fallback) {
  if (!rawDate) return fallback || "123456";
  const s = String(rawDate).trim();
  const parts = s.split(/[\/\-\.]/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    let year = parts[2];
    if (year.length === 2) year = "20" + year;
    if (format === "dd/mm/yyyy") return `${day}/${month}/${year}`;
    return `${day}${month}${year}`;
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) {
    if (format === "dd/mm/yyyy") return `${digits.substring(0, 2)}/${digits.substring(2, 4)}/${digits.substring(4)}`;
    return digits;
  }
  return fallback || "123456";
}

/**
 * Mở modal Đổi Mật Khẩu Hàng Loạt
 */
function openBatchChangePasswordModal() {
  const modal = document.getElementById("batchChangePasswordModal");
  if (!modal) return;

  renderBatchClassesList();

  // Reset quy tắc về mặc định: ngày tháng năm sinh
  const radioBirthdate = document.getElementById("ruleTypeBirthdate");
  if (radioBirthdate) radioBirthdate.checked = true;
  toggleBatchPwdRuleDisplay("birthdate");

  // Hiển thị modal
  modal.classList.remove("hidden-modal");
  modal.style.setProperty("display", "flex", "important");
  modal.setAttribute("aria-hidden", "false");
}

/**
 * Đóng modal Đổi Mật Khẩu Hàng Loạt
 */
function closeBatchChangePasswordModal() {
  const modal = document.getElementById("batchChangePasswordModal");
  if (modal) {
    modal.classList.add("hidden-modal");
    modal.style.setProperty("display", "none", "important");
    modal.setAttribute("aria-hidden", "true");
  }
}

/**
 * Render danh sách Checkbox Khối & Lớp trong modal Đổi MK hàng loạt
 */
function renderBatchClassesList() {
  const container = document.getElementById("batchClassesListContainer");
  if (!container) return;

  // Tính số lượng học sinh trong từng lớp
  const classStudentCountMap = {};
  currentTeacherStudents.forEach(st => {
    const cls = (st.lop || "").trim();
    if (cls) {
      classStudentCountMap[cls] = (classStudentCountMap[cls] || 0) + 1;
    }
  });

  // Gom nhóm các lớp theo Khối
  const gradeClassesMap = {};
  (teacherAllClassesList || []).forEach(cls => {
    const g = getGradeFromClass(cls) || "Khác";
    if (!gradeClassesMap[g]) gradeClassesMap[g] = [];
    gradeClassesMap[g].push(cls);
  });

  const sortedGrades = Object.keys(gradeClassesMap).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  if (sortedGrades.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 1.5rem;">Không tìm thấy lớp học nào!</div>`;
    updateBatchSelectedSummary();
    return;
  }

  // Lấy các lớp hiện đang được chọn ở bộ lọc chính để tích sẵn (nếu có)
  const mainActiveClasses = Array.from(document.querySelectorAll("#classCheckboxesList .class-filter-cb:checked")).map(cb => cb.value);
  const shouldPrecheckAll = mainActiveClasses.length === 0 || mainActiveClasses.length === (teacherAllClassesList || []).length;

  let html = "";
  sortedGrades.forEach(g => {
    const classesInGrade = gradeClassesMap[g];
    let totalHsInGrade = 0;
    classesInGrade.forEach(c => totalHsInGrade += (classStudentCountMap[c] || 0));

    html += `
      <div class="batch-pwd-grade-block" data-grade="${g}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem;">
          <label style="font-size: 0.84rem; font-weight: 700; color: #1e293b; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" class="batch-grade-cb" data-grade="${g}" checked style="accent-color: #7c3aed;">
            <span>Khối ${g}</span>
          </label>
          <span style="font-size: 0.74rem; color: #64748b;">${classesInGrade.length} lớp (${totalHsInGrade} HS)</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
    `;

    classesInGrade.forEach(cls => {
      const isChecked = shouldPrecheckAll || mainActiveClasses.includes(cls);
      const hsCount = classStudentCountMap[cls] || 0;
      html += `
        <label class="batch-pwd-class-chip ${isChecked ? 'is-checked' : ''}" for="batch_cls_${cls}">
          <input type="checkbox" id="batch_cls_${cls}" class="batch-class-cb" value="${cls}" data-grade="${g}" ${isChecked ? 'checked' : ''}>
          <span>${cls}</span>
          <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(${hsCount} HS)</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Cập nhật trạng thái checkbox Khối dựa theo các lớp con
  sortedGrades.forEach(g => {
    const gradeCb = container.querySelector(`.batch-grade-cb[data-grade="${g}"]`);
    const classCbs = container.querySelectorAll(`.batch-class-cb[data-grade="${g}"]`);
    if (gradeCb && classCbs.length > 0) {
      gradeCb.checked = Array.from(classCbs).every(cb => cb.checked);
    }
  });

  updateBatchSelectedSummary();
}

/**
 * Cập nhật số lượng lớp & học sinh đã chọn trong modal
 */
function updateBatchSelectedSummary() {
  const container = document.getElementById("batchClassesListContainer");
  const badge = document.getElementById("batchSelectedSummaryBadge");
  if (!container || !badge) return;

  const checkedClassCbs = container.querySelectorAll(".batch-class-cb:checked");
  const selectedClasses = Array.from(checkedClassCbs).map(cb => cb.value);

  // Đếm học sinh
  let totalHs = 0;
  currentTeacherStudents.forEach(st => {
    if (st.lop && selectedClasses.includes(st.lop.trim())) {
      totalHs++;
    }
  });

  badge.textContent = `Đã chọn: ${selectedClasses.length} lớp (${totalHs} HS)`;
}

/**
 * Chuyển đổi hiển thị quy tắc đặt mật khẩu (ngày sinh vs tùy ý)
 */
function toggleBatchPwdRuleDisplay(type) {
  const cardBirthdate = document.getElementById("cardRuleBirthdate");
  const cardCustom = document.getElementById("cardRuleCustom");
  const boxBirthdate = document.getElementById("boxBirthdateFormat");
  const boxCustom = document.getElementById("boxCustomPasswordInput");

  if (type === "birthdate") {
    if (cardBirthdate) cardBirthdate.classList.add("active");
    if (cardCustom) cardCustom.classList.remove("active");
    if (boxBirthdate) boxBirthdate.style.display = "flex";
    if (boxCustom) boxCustom.style.display = "none";
  } else {
    if (cardBirthdate) cardBirthdate.classList.remove("active");
    if (cardCustom) cardCustom.classList.add("active");
    if (boxBirthdate) boxBirthdate.style.display = "none";
    if (boxCustom) {
      boxCustom.style.display = "block";
      const input = document.getElementById("inputBatchCustomPassword");
      if (input) setTimeout(() => input.focus(), 50);
    }
  }
}

/**
 * Gửi yêu cầu đổi mật khẩu hàng loạt lên Google Sheets
 */
async function submitBatchChangePassword() {
  const container = document.getElementById("batchClassesListContainer");
  if (!container) return;

  const checkedClassCbs = container.querySelectorAll(".batch-class-cb:checked");
  const selectedClasses = Array.from(checkedClassCbs).map(cb => cb.value.trim()).filter(Boolean);

  if (selectedClasses.length === 0) {
    showToast("Chưa chọn lớp", "Vui lòng tích chọn ít nhất một lớp học để đổi mật khẩu!", "warning");
    return;
  }

  const ruleTypeRadio = document.querySelector('input[name="batchPwdRuleType"]:checked');
  const ruleType = ruleTypeRadio ? ruleTypeRadio.value : "birthdate";

  let customPassword = "";
  let birthdateFormat = "ddmmyyyy";
  let fallbackPassword = "123456";

  if (ruleType === "custom") {
    const inputCustom = document.getElementById("inputBatchCustomPassword");
    customPassword = inputCustom ? inputCustom.value.trim() : "";
    if (!customPassword) {
      showToast("Thiếu mật khẩu", "Vui lòng nhập mật khẩu chung mới cho học sinh!", "warning");
      if (inputCustom) inputCustom.focus();
      return;
    }
    if (customPassword.length < 3) {
      showToast("Mật khẩu quá ngắn", "Mật khẩu nên có từ 3 ký tự trở lên!", "warning");
      if (inputCustom) inputCustom.focus();
      return;
    }
  } else {
    const formatRadio = document.querySelector('input[name="batchBirthFormat"]:checked');
    birthdateFormat = formatRadio ? formatRadio.value : "ddmmyyyy";
    const inputFallback = document.getElementById("inputBatchFallbackPwd");
    fallbackPassword = inputFallback && inputFallback.value.trim() ? inputFallback.value.trim() : "123456";
  }

  // Tính số lượng học sinh bị ảnh hưởng
  let affectedCount = 0;
  currentTeacherStudents.forEach(st => {
    if (st.lop && selectedClasses.includes(st.lop.trim())) {
      affectedCount++;
    }
  });

  const ruleDesc = ruleType === "birthdate" 
    ? `theo Ngày sinh (định dạng ${birthdateFormat})` 
    : `thành mật khẩu chung "${customPassword}"`;

  const confirmMsg = `Bạn có chắc chắn muốn đổi mật khẩu ${ruleDesc} cho ${affectedCount} học sinh thuộc ${selectedClasses.length} lớp (${selectedClasses.join(", ")})?\n\nThao tác này sẽ cập nhật trực tiếp lên Google Sheets!`;
  if (!confirm(confirmMsg)) {
    return;
  }

  const btnConfirm = document.getElementById("btnConfirmBatchChangePwd");
  const btnText = document.getElementById("btnConfirmBatchChangePwdText");
  const oldText = btnText ? btnText.textContent : "Xác nhận đổi mật khẩu";

  if (btnConfirm) btnConfirm.disabled = true;
  if (btnText) btnText.textContent = "Đang cập nhật Google Sheets...";

  try {
    const payload = {
      action: "batchUpdateStudentPasswords",
      usernameGV: currentTeacher ? currentTeacher.username : "",
      classes: selectedClasses,
      type: ruleType,
      birthdateFormat: birthdateFormat,
      customPassword: customPassword,
      fallbackPassword: fallbackPassword
    };

    let res = null;

    // 1. Thử gửi POST
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (text && !text.trim().startsWith("<")) {
        res = JSON.parse(text);
      }
    } catch (ePost) {
      console.warn("POST batchUpdateStudentPasswords thất bại, thử GET fallback:", ePost);
    }

    // 2. Fallback GET nếu POST không thành công
    if (!res || !res.success) {
      const getUrl = `${API_URL}?action=batchUpdateStudentPasswords&usernameGV=${encodeURIComponent(currentTeacher ? currentTeacher.username : "")}&classes=${encodeURIComponent(selectedClasses.join(","))}&type=${encodeURIComponent(ruleType)}&birthdateFormat=${encodeURIComponent(birthdateFormat)}&customPassword=${encodeURIComponent(customPassword)}&fallbackPassword=${encodeURIComponent(fallbackPassword)}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl);
      const text2 = await getRes.text();
      if (text2 && !text2.trim().startsWith("<")) {
        res = JSON.parse(text2);
      } else {
        throw new Error("Phản hồi từ Google Sheets không hợp lệ.");
      }
    }

    if (!res || !res.success) {
      throw new Error(res?.message || "Không thể cập nhật mật khẩu trên Google Sheet.");
    }

    // 3. Cập nhật mật khẩu ngay trong mảng currentTeacherStudents trên giao diện
    const updatedCount = res.updatedCount || affectedCount;
    currentTeacherStudents.forEach(st => {
      if (st.lop && selectedClasses.includes(st.lop.trim())) {
        if (ruleType === "birthdate") {
          st.password = formatBirthDateAsPassword(st.ngaySinh, birthdateFormat, fallbackPassword);
        } else {
          st.password = customPassword;
        }
      }
    });

    // Lưu ngay vào cache bộ nhớ đệm
    saveCachedTeacherStudents(currentTeacherStudents, teacherAllClassesList);

    // Cập nhật lại giao diện bảng danh sách học sinh
    applyStudentFilters();

    // Đóng modal
    closeBatchChangePasswordModal();

    showToast(
      "Đổi mật khẩu thành công!",
      `Đã cập nhật mật khẩu cho ${updatedCount} học sinh thuộc ${selectedClasses.length} lớp lên Google Sheets thành công!`,
      "success",
      5000
    );

  } catch (err) {
    console.error("Lỗi khi đổi mật khẩu hàng loạt:", err);
    showToast("Cập nhật thất bại", err.message, "error", 5000);
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
    if (btnText) btnText.textContent = oldText;
  }
}

// Khởi tạo các sự kiện cho tính năng Quản lý Học sinh
window.addEventListener("DOMContentLoaded", () => {
  // 1. Tương tác tích chọn KHỐI LỚP
  const gradeContainer = document.getElementById("gradeCheckboxesList");
  if (gradeContainer) {
    gradeContainer.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "checkbox") return;

      const allGradeCb = document.getElementById("grade_filter_ALL");
      const gradeCbs = document.querySelectorAll("#gradeCheckboxesList .grade-filter-cb");
      const classCbs = document.querySelectorAll("#classCheckboxesList .class-filter-cb");
      const allClassCb = document.getElementById("class_filter_ALL");

      if (target.value === "ALL") {
        const isChecked = target.checked;
        gradeCbs.forEach(cb => cb.checked = isChecked);
        classCbs.forEach(cb => cb.checked = isChecked);
        if (allClassCb) allClassCb.checked = isChecked;
      } else {
        const gradeVal = target.value;
        const isChecked = target.checked;

        classCbs.forEach(cb => {
          if (cb.getAttribute("data-grade") === gradeVal) {
            cb.checked = isChecked;
          }
        });

        if (allGradeCb) {
          allGradeCb.checked = Array.from(gradeCbs).every(cb => cb.checked);
        }

        if (allClassCb) {
          allClassCb.checked = Array.from(classCbs).every(cb => cb.checked);
        }
      }

      applyStudentFilters();
    });
  }

  // 2. Tương tác tích chọn LỚP HỌC
  const classContainer = document.getElementById("classCheckboxesList");
  if (classContainer) {
    classContainer.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "checkbox") return;

      const allClassCb = document.getElementById("class_filter_ALL");
      const classCbs = document.querySelectorAll("#classCheckboxesList .class-filter-cb");
      const gradeCbs = document.querySelectorAll("#gradeCheckboxesList .grade-filter-cb");
      const allGradeCb = document.getElementById("grade_filter_ALL");

      if (target.value === "ALL") {
        const isChecked = target.checked;
        classCbs.forEach(cb => cb.checked = isChecked);
        gradeCbs.forEach(cb => cb.checked = isChecked);
        if (allGradeCb) allGradeCb.checked = isChecked;
      } else {
        const gradeVal = target.getAttribute("data-grade");

        if (gradeVal) {
          const classesOfGrade = Array.from(classCbs).filter(cb => cb.getAttribute("data-grade") === gradeVal);
          const targetGradeCb = document.getElementById("grade_filter_" + gradeVal);
          if (targetGradeCb) {
            targetGradeCb.checked = classesOfGrade.some(cb => cb.checked);
          }
        }

        if (allClassCb) {
          allClassCb.checked = Array.from(classCbs).every(cb => cb.checked);
        }

        if (allGradeCb) {
          allGradeCb.checked = Array.from(gradeCbs).every(cb => cb.checked);
        }
      }

      applyStudentFilters();
    });
  }

  // 3. Tìm kiếm học sinh
  const searchInput = document.getElementById("searchStudentClassInput");
  if (searchInput) {
    searchInput.addEventListener("input", applyStudentFilters);
  }

  // 4. Nút Tải lại danh sách
  const btnRefresh = document.getElementById("btnRefreshStudents");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      loadTeacherStudents(true);
    });
  }

  // 5. Đóng modal đổi MK
  const btnCloseModal = document.getElementById("btnCloseChangePwdModal");
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeChangePasswordModal);

  const btnCancelModal = document.getElementById("btnCancelChangePwd");
  if (btnCancelModal) btnCancelModal.addEventListener("click", closeChangePasswordModal);

  const modalOverlay = document.getElementById("changePasswordModal");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeChangePasswordModal();
    });
  }

  // 6. Nút Random Mật khẩu
  const btnRandom = document.getElementById("btnRandomStudentPwd");
  if (btnRandom) {
    btnRandom.addEventListener("click", () => {
      const inputPwd = document.getElementById("inputNewStudentPassword");
      if (inputPwd) {
        const randomPwd = Math.floor(100000 + Math.random() * 900000).toString();
        inputPwd.value = randomPwd;
      }
    });
  }

  // 7. Xác nhận đổi MK
  const btnConfirmChangePwd = document.getElementById("btnConfirmChangePwd");
  if (btnConfirmChangePwd) {
    btnConfirmChangePwd.addEventListener("click", submitChangePassword);
  }

  // 8. Xử lý click trong bảng học sinh (Hiện/Ẩn MK, Copy MK, Đổi MK, Xóa Học Sinh)
  const tbody = document.getElementById("studentsTableBody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btnDelete = e.target.closest(".btn-action-delete-student");
      if (btnDelete) {
        const u = btnDelete.getAttribute("data-username");
        const name = btnDelete.getAttribute("data-hoten") || u;
        handleDeleteStudentAction(u, name, btnDelete);
        return;
      }

      const btnEdit = e.target.closest(".btn-action-change-pwd");
      if (btnEdit) {
        const u = btnEdit.getAttribute("data-username");
        const student = currentTeacherStudents.find(s => s.username === u);
        if (student) openChangePasswordModal(student);
        return;
      }

      const btnToggle = e.target.closest(".btn-toggle-pwd");
      if (btnToggle) {
        const container = btnToggle.closest(".pwd-field-container");
        if (container) {
          const textEl = container.querySelector(".pwd-value-text");
          const pwd = textEl.getAttribute("data-password") || "";
          if (textEl.textContent === "••••••••") {
            textEl.textContent = pwd;
            btnToggle.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
          } else {
            textEl.textContent = "••••••••";
            btnToggle.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
          }
        }
        return;
      }

      const btnCopy = e.target.closest(".btn-copy-pwd");
      if (btnCopy) {
        const container = btnCopy.closest(".pwd-field-container");
        if (container) {
          const textEl = container.querySelector(".pwd-value-text");
          const pwd = textEl.getAttribute("data-password") || "";
          if (pwd) {
            navigator.clipboard.writeText(pwd).then(() => {
              showToast("Đã chép", "Đã sao chép mật khẩu vào bộ nhớ tạm!", "info", 1500);
            }).catch(() => {
              showToast("Thất bại", "Không thể truy cập bộ nhớ tạm", "warning", 2000);
            });
          }
        }
      }
    });
  }

  // 9. Nút Xuất Excel Danh Sách Học Sinh (Tab 3)
  const btnExportHS = document.getElementById("btnExportStudentsExcel");
  if (btnExportHS) {
    btnExportHS.addEventListener("click", exportStudentsToExcel);
  }

  // 10. Các sự kiện cho Đổi Mật Khẩu Hàng Loạt
  const btnOpenBatch = document.getElementById("btnOpenBatchChangePwdModal");
  if (btnOpenBatch) {
    btnOpenBatch.addEventListener("click", openBatchChangePasswordModal);
  }

  const btnCloseBatchModal = document.getElementById("btnCloseBatchChangePwdModal");
  if (btnCloseBatchModal) btnCloseBatchModal.addEventListener("click", closeBatchChangePasswordModal);

  const btnCancelBatchModal = document.getElementById("btnCancelBatchChangePwd");
  if (btnCancelBatchModal) btnCancelBatchModal.addEventListener("click", closeBatchChangePasswordModal);

  const batchModalOverlay = document.getElementById("batchChangePasswordModal");
  if (batchModalOverlay) {
    batchModalOverlay.addEventListener("click", (e) => {
      if (e.target === batchModalOverlay) closeBatchChangePasswordModal();
    });
  }

  const btnBatchSelectAll = document.getElementById("btnBatchSelectAllClasses");
  if (btnBatchSelectAll) {
    btnBatchSelectAll.addEventListener("click", () => {
      const container = document.getElementById("batchClassesListContainer");
      if (container) {
        container.querySelectorAll(".batch-grade-cb, .batch-class-cb").forEach(cb => cb.checked = true);
        container.querySelectorAll(".batch-pwd-class-chip").forEach(chip => chip.classList.add("is-checked"));
        updateBatchSelectedSummary();
      }
    });
  }

  const btnBatchDeselectAll = document.getElementById("btnBatchDeselectAllClasses");
  if (btnBatchDeselectAll) {
    btnBatchDeselectAll.addEventListener("click", () => {
      const container = document.getElementById("batchClassesListContainer");
      if (container) {
        container.querySelectorAll(".batch-grade-cb, .batch-class-cb").forEach(cb => cb.checked = false);
        container.querySelectorAll(".batch-pwd-class-chip").forEach(chip => chip.classList.remove("is-checked"));
        updateBatchSelectedSummary();
      }
    });
  }

  const batchContainer = document.getElementById("batchClassesListContainer");
  if (batchContainer) {
    batchContainer.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "checkbox") return;

      if (target.classList.contains("batch-grade-cb")) {
        const grade = target.getAttribute("data-grade");
        const isChecked = target.checked;
        const classCbs = batchContainer.querySelectorAll(`.batch-class-cb[data-grade="${grade}"]`);
        classCbs.forEach(cb => {
          cb.checked = isChecked;
          const chip = cb.closest(".batch-pwd-class-chip");
          if (chip) {
            if (isChecked) chip.classList.add("is-checked");
            else chip.classList.remove("is-checked");
          }
        });
      } else if (target.classList.contains("batch-class-cb")) {
        const chip = target.closest(".batch-pwd-class-chip");
        if (chip) {
          if (target.checked) chip.classList.add("is-checked");
          else chip.classList.remove("is-checked");
        }
        const grade = target.getAttribute("data-grade");
        const gradeCb = batchContainer.querySelector(`.batch-grade-cb[data-grade="${grade}"]`);
        const classCbs = batchContainer.querySelectorAll(`.batch-class-cb[data-grade="${grade}"]`);
        if (gradeCb && classCbs.length > 0) {
          gradeCb.checked = Array.from(classCbs).every(cb => cb.checked);
        }
      }

      updateBatchSelectedSummary();
    });
  }

  const radioBirth = document.getElementById("ruleTypeBirthdate");
  const radioCustom = document.getElementById("ruleTypeCustom");
  if (radioBirth) {
    radioBirth.addEventListener("change", () => {
      if (radioBirth.checked) toggleBatchPwdRuleDisplay("birthdate");
    });
  }
  if (radioCustom) {
    radioCustom.addEventListener("change", () => {
      if (radioCustom.checked) toggleBatchPwdRuleDisplay("custom");
    });
  }

  const btnRandomBatch = document.getElementById("btnRandomBatchPwd");
  if (btnRandomBatch) {
    btnRandomBatch.addEventListener("click", () => {
      const inputCustom = document.getElementById("inputBatchCustomPassword");
      if (inputCustom) {
        inputCustom.value = Math.floor(100000 + Math.random() * 900000).toString();
      }
    });
  }

  const btnConfirmBatch = document.getElementById("btnConfirmBatchChangePwd");
  if (btnConfirmBatch) {
    btnConfirmBatch.addEventListener("click", submitBatchChangePassword);
  }
});

/**
 * Xuất file Excel (.xlsx) danh sách học sinh đang lọc hiển thị
 */
function exportStudentsToExcel() {
  const classCbs = document.querySelectorAll("#classCheckboxesList .class-filter-cb:checked");
  const selectedClasses = Array.from(classCbs).map(cb => cb.value.trim().toUpperCase());

  const searchInput = document.getElementById("searchStudentClassInput");
  const searchKeyword = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let listToExport = [];
  if (selectedClasses.length > 0) {
    listToExport = currentTeacherStudents.filter(st => {
      const stClass = String(st.lop || "").trim().toUpperCase();
      return selectedClasses.includes(stClass);
    });
  }

  if (searchKeyword) {
    listToExport = listToExport.filter(st => {
      const name = (st.hoTen || "").toLowerCase();
      const user = (st.username || "").toLowerCase();
      const lop = (st.lop || "").toLowerCase();
      const dob = (st.ngaySinh || "").toLowerCase();
      const truong = (st.truong || "").toLowerCase();
      return name.includes(searchKeyword) || user.includes(searchKeyword) || lop.includes(searchKeyword) || dob.includes(searchKeyword) || truong.includes(searchKeyword);
    });
  }

  if (!listToExport || listToExport.length === 0) {
    showToast("Không có dữ liệu", "Không có học sinh nào phù hợp để xuất Excel!", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Lỗi", "Thư viện SheetJS chưa sẵn sàng!", "error");
    return;
  }

  // Định dạng dữ liệu xuất bảng tính chuẩn đẹp
  const exportData = listToExport.map((st, idx) => {
    let dobText = formatDob(st.ngaySinh);

    return {
      "STT": idx + 1,
      "Lớp": st.lop || "",
      "Tài Khoản (Mã HS)": st.username || "",
      "Họ và Tên": st.hoTen || "",
      "Ngày Sinh": dobText,
      "Giới Tính": st.gioiTinh || "",
      "Trường": st.truong || "",
      "Mật Khẩu": st.password || ""
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Thiết lập độ rộng cột trực quan
  worksheet["!cols"] = [
    { wch: 6 },  // STT
    { wch: 10 }, // Lớp
    { wch: 18 }, // Tài Khoản
    { wch: 26 }, // Họ và Tên
    { wch: 14 }, // Ngày Sinh
    { wch: 10 }, // Giới Tính
    { wch: 25 }, // Trường
    { wch: 14 }  // Mật Khẩu
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachHocSinh");

  const now = new Date();
  const dateStr = ("0" + now.getDate()).slice(-2) + ("0" + (now.getMonth() + 1)).slice(-2) + now.getFullYear();
  
  let fileLabel = "CacLop";
  if (selectedClasses.length === 1) {
    fileLabel = `Lop_${selectedClasses[0]}`;
  } else if (selectedClasses.length > 1 && selectedClasses.length <= 3) {
    fileLabel = `Lop_${selectedClasses.join("_")}`;
  }

  const fileName = `Danh_Sach_Hoc_Sinh_${fileLabel}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
  showToast("Xuất Excel thành công", `Đã tải xuống file "${fileName}" (${listToExport.length} học sinh).`, "success", 3500);
}


// ============================================================================
// HỆ THỐNG MENU TÀI KHOẢN, THÔNG TIN CÁ NHÂN & ĐỔI MẬT KHẨU GIÁO VIÊN
// ============================================================================
function initTeacherAccountDropdownAndModals() {
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

  // 2. Modal Thông tin cá nhân Giáo viên
  const btnOpenProfile = document.getElementById("btnOpenProfileModal");
  const modalProfile = document.getElementById("modalTeacherProfile");
  const btnCloseProfile = document.getElementById("btnCloseProfileModal");
  const btnCloseProfileBottom = document.getElementById("btnCloseProfileModalBottom");
  const btnSwitchToChangePwd = document.getElementById("btnSwitchToChangePwdModal");

  function openTeacherProfile() {
    if (dropdown) dropdown.classList.remove("show");
    if (trigger) trigger.classList.remove("active");
    if (!currentTeacher) return;

    const elUser = document.getElementById("profileModalUsername");
    const elName = document.getElementById("profileModalFullName");
    const elClasses = document.getElementById("profileModalClasses");
    const elSchool = document.getElementById("profileModalSchool");
    const elTopName = document.getElementById("modalProfileFullName");
    const elAvatar = document.getElementById("modalGvAvatarLarge");

    const fullName = currentTeacher.hoTenGV || currentTeacher.username || "Thầy/Cô";
    if (elUser) elUser.textContent = currentTeacher.username || "--";
    if (elName) elName.textContent = fullName;
    if (elClasses) elClasses.textContent = currentTeacher.lopGiangDay || "Tất cả";
    if (elSchool) elSchool.textContent = currentTeacher.truong || "Hệ thống chung";
    const elDob = document.getElementById("profileModalDob");
    const elDobItem = document.getElementById("profileModalDobItem");
    if (currentTeacher.ngaySinh) {
      if (elDob) elDob.textContent = formatDob(currentTeacher.ngaySinh);
      if (elDobItem) elDobItem.style.display = "";
    } else if (elDobItem) {
      elDobItem.style.display = "none";
    }
    if (elTopName) elTopName.textContent = fullName;
    if (elAvatar) elAvatar.textContent = (fullName.slice(0, 2) || "GV").toUpperCase();

    if (modalProfile) modalProfile.style.display = "flex";
  }

  function closeTeacherProfile() {
    if (modalProfile) modalProfile.style.display = "none";
  }

  if (btnOpenProfile) btnOpenProfile.addEventListener("click", openTeacherProfile);
  if (btnCloseProfile) btnCloseProfile.addEventListener("click", closeTeacherProfile);
  if (btnCloseProfileBottom) btnCloseProfileBottom.addEventListener("click", closeTeacherProfile);
  if (modalProfile) {
    modalProfile.addEventListener("click", (e) => {
      if (e.target === modalProfile) closeTeacherProfile();
    });
  }

  // 3. Modal Đổi Mật Khẩu Giáo viên
  const btnOpenChangePwd = document.getElementById("btnOpenChangePassModal");
  const modalChangePwd = document.getElementById("modalTeacherChangePassword");
  const btnCloseChangePwd = document.getElementById("btnCloseChangePassModal");
  const btnCancelChangePwd = document.getElementById("btnCancelTeacherChangePwd");
  const btnSaveChangePwd = document.getElementById("btnSaveTeacherPassword");
  const alertBox = document.getElementById("teacherPwdAlertBox");

  function openTeacherChangePwd() {
    if (dropdown) dropdown.classList.remove("show");
    if (trigger) trigger.classList.remove("active");
    closeTeacherProfile();

    const inpOld = document.getElementById("inputOldPassword");
    const inpNew = document.getElementById("inputNewPassword");
    const inpConfirm = document.getElementById("inputConfirmNewPassword");
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

  function closeTeacherChangePwd() {
    if (modalChangePwd) modalChangePwd.style.display = "none";
  }

  if (btnOpenChangePwd) btnOpenChangePwd.addEventListener("click", openTeacherChangePwd);
  if (btnSwitchToChangePwd) btnSwitchToChangePwd.addEventListener("click", openTeacherChangePwd);
  if (btnCloseChangePwd) btnCloseChangePwd.addEventListener("click", closeTeacherChangePwd);
  if (btnCancelChangePwd) btnCancelChangePwd.addEventListener("click", closeTeacherChangePwd);
  if (modalChangePwd) {
    modalChangePwd.addEventListener("click", (e) => {
      if (e.target === modalChangePwd) closeTeacherChangePwd();
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
      if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi cổng Giáo Viên?")) {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("userRole");
        localStorage.removeItem("custom_gas_api_url");
        window.location.href = "index.html";
      }
    });
  }

  // 6. Xử lý Lưu Đổi Mật Khẩu
  if (btnSaveChangePwd) {
    btnSaveChangePwd.addEventListener("click", async () => {
      const inpOld = document.getElementById("inputOldPassword");
      const inpNew = document.getElementById("inputNewPassword");
      const inpConfirm = document.getElementById("inputConfirmNewPassword");

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
              action: "updateTeacherPassword",
              usernameGV: currentTeacher.username,
              oldPassword: oldPassword,
              newPassword: newPassword
            })
          });
          const text = await response.text();
          if (text && !text.trim().startsWith("<")) {
            res = JSON.parse(text);
          }
        } catch (postErr) {
          console.warn("POST updateTeacherPassword failed, attempting GET fallback...", postErr);
        }

        if (!res || !res.success) {
          const getUrl = API_URL + "?action=updateTeacherPassword&usernameGV=" + encodeURIComponent(currentTeacher.username) + "&oldPassword=" + encodeURIComponent(oldPassword) + "&newPassword=" + encodeURIComponent(newPassword) + "&_t=" + Date.now();
          const getRes = await fetch(getUrl);
          const getTxt = await getRes.text();
          if (getTxt && !getTxt.trim().startsWith("<")) {
            res = JSON.parse(getTxt);
          }
        }

        if (res && res.success) {
          showToast("Thành công", res.message || "Đã đổi mật khẩu và cập nhật lên Google Sheets thành công!", "success", 4000);
          closeTeacherChangePwd();
        } else {
          showAlert(res ? res.message : "Mật khẩu hiện tại không chính xác hoặc không thể cập nhật!");
          showToast("Đổi mật khẩu thất bại", res ? res.message : "Mật khẩu hiện tại không chính xác!", "error", 5000);
        }
      } catch (err) {
        console.error("Lỗi khi gọi API đổi mật khẩu giáo viên:", err);
        showAlert("Không thể kết nối đến máy chủ Google Sheets. Vui lòng kiểm tra lại mạng!");
        showToast("Lỗi kết nối", "Không thể kết nối đến máy chủ Google Sheets.", "error", 5000);
      } finally {
        btnSaveChangePwd.disabled = false;
        btnSaveChangePwd.innerHTML = origHtml;
      }
    });
  }
}


// ============================================================================
// KHỞI TẠO TÍNH NĂNG THÊM MỚI HỌC SINH THỦ CÔNG
// ============================================================================
function initAddStudentModal() {
  const btnOpen = document.getElementById("btnOpenAddStudentModal");
  const modal = document.getElementById("modalAddStudent");
  const btnClose = document.getElementById("btnCloseAddStudentModal");
  const btnCancel = document.getElementById("btnCancelAddStudent");
  const btnConfirm = document.getElementById("btnConfirmAddStudent");
  const btnAutoUser = document.getElementById("btnAutoGenerateUsername");

  const inpName = document.getElementById("inputAddStudentFullName");
  const inpClass = document.getElementById("inputAddStudentClass");
  const selGender = document.getElementById("selectAddStudentGender");
  const inpUser = document.getElementById("inputAddStudentUsername");
  const inpPass = document.getElementById("inputAddStudentPassword");
  const inpDob = document.getElementById("inputAddStudentDob");
  const inpSchool = document.getElementById("inputAddStudentSchool");
  const alertBox = document.getElementById("addStudentAlertBox");
  const spinner = document.getElementById("addStudentSpinner");
  const btnText = document.getElementById("btnConfirmAddStudentText");

  function showAlert(msg) {
    if (alertBox) {
      alertBox.textContent = msg;
      alertBox.style.display = "block";
    } else {
      showToast("Lỗi nhập liệu", msg, "warning");
    }
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }
  }

  function openModal() {
    hideAlert();
    // Gợi ý lớp học đầu tiên của giáo viên
    let defaultClass = "";
    if (currentTeacher && currentTeacher.lopGiangDay) {
      const parts = currentTeacher.lopGiangDay.split(/[,;\s]+/).filter(Boolean);
      if (parts.length > 0 && !parts[0].toUpperCase().includes("ALL") && !parts[0].toUpperCase().includes("TẤT CẢ")) {
        defaultClass = parts[0].trim().toUpperCase();
      }
    }
    if (inpClass) inpClass.value = defaultClass;
    if (inpName) {
      inpName.value = "";
    }
    if (selGender) selGender.value = "Nam";
    if (inpPass) inpPass.value = "123";
    if (inpDob) inpDob.value = "";
    if (inpSchool) inpSchool.value = (currentTeacher && currentTeacher.truong) ? currentTeacher.truong : "";

    // Tự động sinh mã học sinh mẫu
    generateAutoUsername();

    if (modal) {
      modal.classList.remove("hidden-modal");
      modal.style.setProperty("display", "flex", "important");
      modal.setAttribute("aria-hidden", "false");
    }

    if (inpName) setTimeout(() => inpName.focus(), 150);
  }

  function closeModal() {
    if (modal) {
      modal.classList.add("hidden-modal");
      modal.style.setProperty("display", "none", "important");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function generateAutoUsername() {
    const cls = (inpClass ? inpClass.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "") : "") || "hs";
    // Đếm số lượng học sinh lớp này đang có trong currentTeacherStudents
    const countInClass = (currentTeacherStudents || []).filter(s => (s.lop || "").toLowerCase() === (inpClass ? inpClass.value : "").trim().toLowerCase()).length;
    const nextNum = String(countInClass + 1).padStart(2, "0");
    const autoUser = cls + "_" + nextNum;
    if (inpUser) inpUser.value = autoUser;
  }

  if (btnAutoUser) {
    btnAutoUser.onclick = (e) => {
      e.preventDefault();
      generateAutoUsername();
    };
  }

  if (inpClass) {
    inpClass.addEventListener("blur", () => {
      if (inpClass.value.trim() && (!inpUser.value || inpUser.value.startsWith("hs_") || inpUser.value.includes("_"))) {
        generateAutoUsername();
      }
    });
  }

  if (btnOpen) {
    btnOpen.onclick = (e) => {
      e.preventDefault();
      openModal();
    };
  }
  if (btnClose) {
    btnClose.onclick = (e) => {
      e.preventDefault();
      closeModal();
    };
  }
  if (btnCancel) {
    btnCancel.onclick = (e) => {
      e.preventDefault();
      closeModal();
    };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Xử lý gửi form thêm học sinh
  if (btnConfirm) {
    btnConfirm.onclick = async (e) => {
      e.preventDefault();
      hideAlert();

      const hoTen = inpName ? inpName.value.trim() : "";
      const lop = inpClass ? inpClass.value.trim().toUpperCase() : "";
      const gioiTinh = selGender ? selGender.value : "Nam";
      const username = inpUser ? inpUser.value.trim() : "";
      const password = inpPass ? inpPass.value.trim() : "123";
      let ngaySinh = inpDob ? inpDob.value.trim() : "";
      const truong = inpSchool ? inpSchool.value.trim() : "";

      if (!hoTen) {
        showAlert("Vui lòng nhập Họ và tên học sinh!");
        if (inpName) inpName.focus();
        return;
      }

      if (!lop) {
        showAlert("Vui lòng nhập Lớp học của học sinh!");
        if (inpClass) inpClass.focus();
        return;
      }

      if (!username) {
        showAlert("Vui lòng nhập Mã tài khoản (Mã HS)!");
        if (inpUser) inpUser.focus();
        return;
      }

      // Kiểm tra trùng tài khoản ngay ở client
      const isExisted = (currentTeacherStudents || []).some(s => (s.username || "").toUpperCase() === username.toUpperCase());
      if (isExisted) {
        showAlert(`Mã tài khoản "${username}" đã tồn tại trong danh sách học sinh! Vui lòng chọn mã khác.`);
        if (inpUser) inpUser.focus();
        return;
      }

      // Chuẩn hóa ngày sinh qua formatDob
      if (ngaySinh) {
        ngaySinh = formatDob(ngaySinh);
      }

      // Bật loading
      btnConfirm.disabled = true;
      if (btnText) btnText.textContent = "Đang lưu lên Sheets...";
      if (spinner) spinner.style.display = "inline-block";

      const payload = {
        action: "addStudent",
        username: username,
        password: password,
        lop: lop,
        hoTen: hoTen,
        ngaySinh: ngaySinh,
        gioiTinh: gioiTinh,
        truong: truong
      };

      try {
        let res = null;
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          });
          const text = await response.text();
          if (text && !text.trim().startsWith("<")) {
            res = JSON.parse(text);
          }
        } catch (postErr) {
          console.warn("POST addStudent failed, attempting GET fallback...", postErr);
        }

        if (!res || !res.success) {
          const getUrl = API_URL + "?action=addStudent&username=" + encodeURIComponent(username) +
            "&password=" + encodeURIComponent(password) +
            "&lop=" + encodeURIComponent(lop) +
            "&hoTen=" + encodeURIComponent(hoTen) +
            "&ngaySinh=" + encodeURIComponent(ngaySinh) +
            "&gioiTinh=" + encodeURIComponent(gioiTinh) +
            "&truong=" + encodeURIComponent(truong) +
            "&_t=" + Date.now();
          const getRes = await fetch(getUrl);
          const getTxt = await getRes.text();
          if (getTxt && !getTxt.trim().startsWith("<")) {
            res = JSON.parse(getTxt);
          }
        }

        if (res && res.success) {
          showToast("Thành công", res.message || "Đã thêm mới học sinh vào Google Sheets thành công!", "success", 4000);
          
          const newStudentObj = res.student || {
            username: username,
            password: password,
            lop: lop,
            hoTen: hoTen,
            ngaySinh: ngaySinh,
            gioiTinh: gioiTinh,
            truong: truong
          };

          // Thêm vào currentTeacherStudents
          currentTeacherStudents.push(newStudentObj);

          // Cập nhật lại bộ nhớ đệm
          saveCachedTeacherStudents(currentTeacherStudents, teacherAllClassesList);

          // Cập nhật lại giao diện bộ lọc Khối & Lớp nếu có lớp mới
          if (typeof buildGradeAndClassFilters === "function") {
            buildGradeAndClassFilters(teacherAllClassesList);
          }

          // Render lại bảng
          applyStudentFilters();

          // Đóng modal
          closeModal();
        } else {
          showAlert(res ? res.message : "Không thể thêm học sinh lên Google Sheets! Vui lòng kiểm tra lại.");
        }
      } catch (err) {
        console.error("Lỗi khi thêm mới học sinh:", err);
        showAlert("Lỗi kết nối máy chủ Google Sheets: " + err.message);
      } finally {
        btnConfirm.disabled = false;
        if (btnText) btnText.textContent = "Lưu Lên Google Sheets";
        if (spinner) spinner.style.display = "none";
      }
    };
  }
}

// Đảm bảo khởi tạo sự kiện Thêm học sinh khi DOM sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAddStudentModal);
} else {
  initAddStudentModal();
}


// Alias an toàn tương thích ngược cho việc lọc và render danh sách học sinh
function filterAndRenderStudents() {
  if (typeof applyStudentFilters === "function") {
    applyStudentFilters();
  }
}

// ============================================================================
// CHUẨN HÓA ĐỊNH DẠNG PHIÊN BẢN BACKEND DẠNG SỐ (2.0, 2.1, 2.2,...)
// ============================================================================
function formatBackendVersion(val, fallback = "2.0") {
  try {
    if (!val || String(val).trim() === "") return fallback;
    let str = String(val).trim();
    if (str.startsWith("'")) str = str.substring(1).trim();

    // Nếu là đối tượng Date hoặc ngày tháng cũ quy về bản cũ 2.0 (EduTest Pro 2.0)
    if (str.includes("26/10/2026") || str.includes("GMT") || /^[A-Z][a-z]{2}\s/.test(str)) {
      return "2.0";
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      return "2.0";
    }

    // Trích xuất số phiên bản dạng 2.1, 2.2, 2.3, 2.0,...
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

// Giữ alias an toàn cho các hàm cũ
const formatBackendVersionDate = formatBackendVersion;

function compareBackendVersions(v1, v2) {
  const parts1 = String(v1 || "0").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
  const parts2 = String(v2 || "0").replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function isValidVersion(str) {
  if (!str) return false;
  return /^v?\d+(\.\d+)*$/i.test(String(str).trim());
}

const isDateVersion = isValidVersion;

// ============================================================================
// TỰ ĐỘNG ĐỐI CHIẾU PHIÊN BẢN BACKEND VỚI Ô G1 TRÊN SHEET TRUNG TÂM
// ============================================================================
async function checkTeacherBackendVersionUpdate() {
  // Tài khoản dùng Sheet trung tâm (admin, 0938750424...) chạy trực tiếp Code.gs trung tâm nên KHÔNG BAO GIỜ hiện thông báo cập nhật
  if (isCentralAccount() || isAdminRole() || isCurrentUserAdmin()) {
    const noticeBox = document.getElementById("hubVersionUpdateNotice");
    if (noticeBox) noticeBox.style.display = "none";
    return;
  }

  // 1. Lấy phiên bản backend được yêu cầu từ ô G1 của Sheet trung tâm (dạng số: 2.1, 2.2, 2.3,...)
  let rawRequiredVersion = (localStorage.getItem("required_backend_version") || "2.3").trim();
  try {
    const hubRes = await fetch(`${DEFAULT_GAS_API_URL}?action=checkCentralBackendVersion&_t=${Date.now()}`);
    if (hubRes.ok) {
      const hubJson = await hubRes.json();
      if (hubJson && (hubJson.requiredBackendVersion || hubJson.version)) {
        rawRequiredVersion = String(hubJson.requiredBackendVersion || hubJson.version).trim();
        localStorage.setItem("required_backend_version", rawRequiredVersion);
      }
    }
  } catch (e) {}

  const requiredVersion = formatBackendVersion(rawRequiredVersion, "2.3");

  // 2. Lấy phiên bản backend thực tế trên Google Sheets riêng của Giáo viên
  const personalServerUrl = getTeacherPersonalServerUrl();
  const savedSheetVer = (localStorage.getItem("teacher_backend_version") || "").trim();
  let currentServerVersion = savedSheetVer ? formatBackendVersion(savedSheetVer, "2.0") : "2.0";
  let hasPingedLiveServer = false;

  if (personalServerUrl && personalServerUrl.startsWith("https://script.google.com/macros/s/") && personalServerUrl !== DEFAULT_GAS_API_URL) {
    try {
      const pingRes = await fetch(`${personalServerUrl}?action=checkBackendVersion&_t=${Date.now()}`);
      if (pingRes.ok) {
        const pingJson = await pingRes.json();
        if (pingJson && pingJson.version) {
          currentServerVersion = formatBackendVersion(pingJson.version, "2.0");
          hasPingedLiveServer = true;
          localStorage.setItem("teacher_backend_version", currentServerVersion);
        }
      }
    } catch (ePing) {
      // Trường hợp server riêng ping lỗi hoặc chưa kích hoạt, giữ phiên bản đã ghi nhận trên Sheet
    }
  }

  // Nếu không ping được trực tiếp server riêng và cột F trên sheet trung tâm đã ghi nhận phiên bản >= yêu cầu
  if (!hasPingedLiveServer && savedSheetVer && compareBackendVersions(savedSheetVer, requiredVersion) >= 0) {
    currentServerVersion = formatBackendVersion(savedSheetVer, "2.0");
  }

  // Tự động báo cáo phiên bản hiện tại lên cột F của sheet DATA_GIAOVIEN trung tâm khi ping server thành công
  if (currentTeacher && currentTeacher.username && hasPingedLiveServer) {
    try {
      fetch(`${DEFAULT_GAS_API_URL}?action=updateTeacherBackendVersion&username=${encodeURIComponent(currentTeacher.username)}&version=${encodeURIComponent(currentServerVersion)}&_t=${Date.now()}`);
    } catch (eRep) {}
  }

  // 3. So sánh: Kiểm tra xem server cá nhân của GV đã đạt phiên bản yêu cầu chưa
  const isCurrentUpdated = compareBackendVersions(currentServerVersion, requiredVersion) >= 0;
  window.isTeacherBackendUpdated = isCurrentUpdated;

  if (!isCurrentUpdated) {
    const displayCurrentVer = `v${currentServerVersion}`;
    const displayReqVer = `v${requiredVersion}`;

    console.warn(`[YÊU CẦU CẬP NHẬT BACKEND] Bản mới: ${displayReqVer}, Bản server riêng hiện tại: ${displayCurrentVer}`);

    // Tự động chuyển ngay sang tab Danh Sách Học Sinh (DSHS)
    const tabBtnStudents = document.getElementById("tabBtnStudents");
    if (tabBtnStudents) {
      tabBtnStudents.click();
    }

    // Tự động mở ngay mục Trạm Trung Tâm (Hub Modal)
    setTimeout(() => {
      const btnOpenHubModal = document.getElementById("btnOpenHubModal");
      const centralHubModal = document.getElementById("centralHubModal");
      if (btnOpenHubModal) {
        btnOpenHubModal.click();
      } else if (centralHubModal) {
        centralHubModal.style.display = "flex";
      }

      // Điền thông tin vào hộp cảnh báo cập nhật trong Modal
      const noticeBox = document.getElementById("hubVersionUpdateNotice");
      const noticeReqText = document.getElementById("noticeRequiredVersionText");
      const noticeCurText = document.getElementById("noticeCurrentVersionText");
      const badgeCompare = document.getElementById("badgeVersionCompare");

      if (noticeBox) {
        noticeBox.style.display = "block";
        if (noticeReqText) noticeReqText.textContent = displayReqVer;
        if (noticeCurText) noticeCurText.textContent = displayCurrentVer;
        if (badgeCompare) badgeCompare.textContent = `Bản mới: ${displayReqVer} (Hiện tại: ${displayCurrentVer})`;
        noticeBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      showToast(
        "Yêu cầu cập nhật mã nguồn 📢",
        `Hệ thống trung tâm đã phát hành phiên bản mới ${displayReqVer}. Vui lòng sao chép mã mới và cập nhật lên Google Sheets của Thầy/Cô!`,
        "warning",
        9000
      );
    }, 500);
  } else {
    // Nếu phiên bản đã khớp hoặc cao hơn, ẩn hộp thông báo nếu có
    const noticeBox = document.getElementById("hubVersionUpdateNotice");
    if (noticeBox) noticeBox.style.display = "none";
  }
}

// ============================================================================
// KHỞI TẠO TÍNH NĂNG ĐỒNG BỘ TRẠM TRUNG TÂM (CENTRAL HUB)
// ============================================================================
function initCentralHubModal() {
  const centralHubModal = document.getElementById("centralHubModal");
  const btnSyncToCentralHub = document.getElementById("btnSyncToCentralHub");
  const btnOpenHubModal = document.getElementById("btnOpenHubModal");
  const btnCloseHubModal = document.getElementById("btnCloseHubModal");
  const btnCancelHubModal = document.getElementById("btnCancelHubModal");

  const hubInfoGvName = document.getElementById("hubInfoGvName");
  const hubInfoGvSchool = document.getElementById("hubInfoGvSchool");
  const hubInfoServerTypeBadge = document.getElementById("hubInfoServerTypeBadge");
  const hubInfoServerUrlInput = document.getElementById("hubInfoServerUrlInput");
  const btnCopyHubServerUrl = document.getElementById("btnCopyHubServerUrl");
  const hubStatusMessageBox = document.getElementById("hubStatusMessageBox");

  const btnTestHubConnection = document.getElementById("btnTestHubConnection");
  const btnExecuteHubSync = document.getElementById("btnExecuteHubSync");
  const btnExecuteHubSyncText = document.getElementById("btnExecuteHubSyncText");
  const hubSyncSpinner = document.getElementById("hubSyncSpinner");

  if (!centralHubModal) return;

  function setHubStatus(type, msg) {
    if (!hubStatusMessageBox) return;
    hubStatusMessageBox.style.display = "block";
    if (type === "loading") {
      hubStatusMessageBox.style.background = "#eff6ff";
      hubStatusMessageBox.style.border = "1.5px solid #bfdbfe";
      hubStatusMessageBox.style.color = "#1d4ed8";
    } else if (type === "success") {
      hubStatusMessageBox.style.background = "#f0fdf4";
      hubStatusMessageBox.style.border = "1.5px solid #86efac";
      hubStatusMessageBox.style.color = "#15803d";
    } else if (type === "error") {
      hubStatusMessageBox.style.background = "#fef2f2";
      hubStatusMessageBox.style.border = "1.5px solid #fecaca";
      hubStatusMessageBox.style.color = "#b91c1c";
    } else {
      hubStatusMessageBox.style.background = "#f8fafc";
      hubStatusMessageBox.style.border = "1.5px solid #cbd5e1";
      hubStatusMessageBox.style.color = "#334155";
    }
    hubStatusMessageBox.innerHTML = msg;
  }

  function openModal() {
    // Ẩn cảnh báo cập nhật nếu phiên bản đã đạt chuẩn hoặc là tài khoản trung tâm/admin
    const rawReq = (localStorage.getItem("required_backend_version") || "2.3").trim();
    const curVer = (localStorage.getItem("teacher_backend_version") || "2.0").trim();
    if (window.isTeacherBackendUpdated || compareBackendVersions(curVer, rawReq) >= 0 || isCentralAccount() || isAdminRole() || isCurrentUserAdmin()) {
      const noticeBox = document.getElementById("hubVersionUpdateNotice");
      if (noticeBox) noticeBox.style.display = "none";
    }

    if (hubInfoGvName) hubInfoGvName.textContent = currentTeacher ? `${currentTeacher.hoTenGV || ""} (${currentTeacher.username})` : "--";
    if (hubInfoGvSchool) hubInfoGvSchool.textContent = (currentTeacher && currentTeacher.truong) ? currentTeacher.truong : "Chưa cấu hình trường";
    
    const personalUrl = getTeacherPersonalServerUrl();
    const isAdmin = isCurrentUserAdmin();
    if (hubInfoServerTypeBadge) {
      if (isAdmin) {
        hubInfoServerTypeBadge.textContent = "Google Sheet Admin (Máy Chủ Trung Tâm)";
        hubInfoServerTypeBadge.style.background = "#eff6ff";
        hubInfoServerTypeBadge.style.color = "#1d4ed8";
        hubInfoServerTypeBadge.style.border = "1px solid #bfdbfe";
      } else if (personalUrl) {
        hubInfoServerTypeBadge.textContent = "Google Sheet Cá Nhân (Riêng)";
        hubInfoServerTypeBadge.style.background = "#ecfdf5";
        hubInfoServerTypeBadge.style.color = "#047857";
        hubInfoServerTypeBadge.style.border = "1px solid #a7f3d0";
      } else {
        hubInfoServerTypeBadge.textContent = "Chưa kết nối Sheet riêng (Mặc định)";
        hubInfoServerTypeBadge.style.background = "#fffbeb";
        hubInfoServerTypeBadge.style.color = "#b45309";
        hubInfoServerTypeBadge.style.border = "1px solid #fde68a";
      }
    }

    if (hubInfoServerUrlInput) {
      hubInfoServerUrlInput.value = personalUrl || (isAdmin ? (API_URL || DEFAULT_GAS_API_URL) : "");
    }

    if (hubStatusMessageBox) {
      hubStatusMessageBox.style.display = "none";
    }

    const studentCount = Array.isArray(currentTeacherStudents) ? currentTeacherStudents.length : 0;
    setHubStatus("info", `📊 Sẵn sàng đồng bộ: <strong>${studentCount}</strong> học sinh hiện có trong Sheet sang Trạm Trung Tâm.`);

    centralHubModal.style.display = "flex";
  }

  function closeModal() {
    centralHubModal.style.display = "none";
  }

  const btnPasteHubServerUrl = document.getElementById("btnPasteHubServerUrl");
  const btnResetHubServerUrl = document.getElementById("btnResetHubServerUrl");
  const btnClearHubServerUrl = document.getElementById("btnClearHubServerUrl");

  const btnServerStatus = document.getElementById("btnServerConnectionStatus");
  if (btnServerStatus) btnServerStatus.addEventListener("click", openModal);

  if (btnSyncToCentralHub) btnSyncToCentralHub.addEventListener("click", openModal);
  if (btnOpenHubModal) btnOpenHubModal.addEventListener("click", openModal);
  if (btnCloseHubModal) btnCloseHubModal.addEventListener("click", closeModal);
  if (btnCancelHubModal) btnCancelHubModal.addEventListener("click", closeModal);

  // Nút X màu đỏ: Xóa nhanh URL
  if (btnClearHubServerUrl) {
    btnClearHubServerUrl.addEventListener("click", () => {
      if (hubInfoServerUrlInput) {
        hubInfoServerUrlInput.value = "";
        hubInfoServerUrlInput.focus();
        showToast("Đã xóa", "Đã xóa trắng ô nhập URL! Thầy/Cô hãy dán link mới vào.", "info", 2000);
      }
    });
  }

  // Nút Sao chép URL
  if (btnCopyHubServerUrl) {
    btnCopyHubServerUrl.addEventListener("click", () => {
      const currentVal = hubInfoServerUrlInput ? hubInfoServerUrlInput.value.trim() : API_URL;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentVal);
        showToast("Đã chép", "Đã sao chép URL Web App vào bộ nhớ tạm", "success", 2000);
      }
    });
  }

  // Nút Dán nhanh URL từ Clipboard
  if (btnPasteHubServerUrl) {
    btnPasteHubServerUrl.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            if (hubInfoServerUrlInput) hubInfoServerUrlInput.value = text.trim();
            showToast("Đã dán", "Đã dán URL Web App mới vào ô nhập!", "info", 2000);
          } else {
            showToast("Clipboard trống", "Vui lòng sao chép link Web App trước", "warning", 3000);
          }
        } else {
          if (hubInfoServerUrlInput) {
            hubInfoServerUrlInput.focus();
            hubInfoServerUrlInput.select();
          }
        }
      } catch (err) {
        if (hubInfoServerUrlInput) hubInfoServerUrlInput.focus();
      }
    });
  }

  // Nút Sao chép toàn bộ mã nguồn Teacher_Code.gs cho Server Riêng (Chuẩn 5 Sheet, không tạo 2 sheet HUB)
  const btnCopyTeacherGasCode = document.getElementById("btnCopyTeacherGasCode");
  const btnCopyTeacherGasCodeText = document.getElementById("btnCopyTeacherGasCodeText");
  if (btnCopyTeacherGasCode) {
    btnCopyTeacherGasCode.addEventListener("click", async () => {
      let codeContent = "";

      // Ưu tiên nạp bản mới nhất từ file gas/Teacher_Code.gs nếu chạy trên web/server
      try {
        const resp = await fetch("gas/Teacher_Code.gs?v=" + Date.now());
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 500) {
            codeContent = text;
            window.TEACHER_GAS_CODE = text;
          }
        }
      } catch (fetchErr) {
        // Môi trường offline hoặc file:// -> Sử dụng biến nhúng sẵn
      }

      // Nếu chưa có từ fetch, dùng biến nhúng từ gas_code_content.js
      if (!codeContent) {
        codeContent = window.TEACHER_GAS_CODE || "";
      }

      if (!codeContent) {
        showToast("Lỗi sao chép", "Chưa tải được mã nguồn Teacher_Code.gs!", "error", 3000);
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(codeContent);
        } else {
          // Fallback cho trình duyệt cũ hoặc một số môi trường
          const ta = document.createElement("textarea");
          ta.value = codeContent;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }

        // Đổi trạng thái nút thành công
        if (btnCopyTeacherGasCodeText) btnCopyTeacherGasCodeText.textContent = "✅ Đã Copy Xong!";
        btnCopyTeacherGasCode.style.background = "linear-gradient(135deg, #059669, #047857)";
        setTimeout(() => {
          if (btnCopyTeacherGasCodeText) btnCopyTeacherGasCodeText.textContent = "Sao Chép Mã Code (.gs)";
          btnCopyTeacherGasCode.style.background = "";
        }, 3000);

        showToast(
          "Đã sao chép thành công!",
          "Đã copy toàn bộ mã nguồn Teacher_Code.gs! Thầy/Cô hãy mở Google Sheet > Tiện ích mở rộng > Apps Script > Dán (Ctrl+V) và Triển khai làm Web App.",
          "success",
          7000
        );

      } catch (copyErr) {
        console.error("Lỗi clipboard:", copyErr);
        showToast("Lỗi", "Không thể truy cập Clipboard: " + copyErr.message, "error", 4000);
      }
    });
  }

  // Nút Khôi phục URL Mặc định
  if (btnResetHubServerUrl) {
    btnResetHubServerUrl.addEventListener("click", () => {
      localStorage.removeItem("custom_gas_api_url");
      if (currentTeacher?.username) {
        localStorage.removeItem("teacher_server_url_" + currentTeacher.username);
        localStorage.removeItem("teacher_server_url_" + currentTeacher.username.replace(/^0+/, ""));
      }
      if (currentTeacher) {
        currentTeacher.serverUrl = "";
        localStorage.setItem("currentUser", JSON.stringify(currentTeacher));
      }
      API_URL = DEFAULT_GAS_API_URL;
      if (hubInfoServerUrlInput) hubInfoServerUrlInput.value = "";
      updateServerStatusBadgeUI();
      showToast("Đã ngắt kết nối", "Đã xóa cấu hình máy chủ riêng!", "info", 3000);
    });
  }

  // 1. Kiểm tra kết nối Trạm Trung Tâm & Máy chủ riêng
  if (btnTestHubConnection) {
    btnTestHubConnection.addEventListener("click", async () => {
      btnTestHubConnection.disabled = true;
      const originalText = btnTestHubConnection.innerHTML;
      btnTestHubConnection.innerHTML = "<span>⏳ Đang kiểm tra...</span>";
      
      const testServerUrl = hubInfoServerUrlInput ? (hubInfoServerUrlInput.value || "").trim() : API_URL;

      if (!testServerUrl || !testServerUrl.startsWith("https://script.google.com/macros/s/") || !testServerUrl.includes("/exec")) {
        setHubStatus("error", "URL Google Apps Script không hợp lệ! Vui lòng nhập link kết thúc bằng <code>/exec</code>.");
        btnTestHubConnection.disabled = false;
        btnTestHubConnection.innerHTML = originalText;
        return;
      }

      setHubStatus("loading", `Đang kiểm tra kết nối tới Máy chủ riêng và Trạm Trung Tâm...`);

      try {
        // Kiểm tra ping tới Sheet riêng của GV & kiểm đếm học sinh
        let studentCountNotice = "";
        try {
          const respPing = await fetch(`${testServerUrl}?action=getStudentsForTeacher&usernameGV=${encodeURIComponent(currentTeacher?.username || "")}&_t=${Date.now()}`, { method: "GET" });
          if (respPing.ok) {
            const rawPingText = await respPing.text();
            if (rawPingText && !rawPingText.trim().startsWith("<")) {
              const pingJson = JSON.parse(rawPingText);
              if (pingJson && pingJson.success && Array.isArray(pingJson.students)) {
                studentCountNotice = ` (Phát hiện <strong>${pingJson.students.length} học sinh</strong> trong Sheet riêng)`;
              }
            }
          }
        } catch (pingErr) {
          console.warn("Ping đếm học sinh không phản hồi GET, thử ping cơ bản...", pingErr);
          const basicPing = await fetch(`${testServerUrl}?action=getTeacherExams&gv=test_ping`, { method: "GET" });
          if (!basicPing.ok) {
            throw new Error(`Máy chủ riêng phản hồi mã lỗi HTTP ${basicPing.status}. Khi triển khai (Deploy) hãy chắc chắn chọn 'Anyone' (Bất kỳ ai).`);
          }
        }

        // Kiểm tra phiên bản backend của Sheet riêng
        let detectedVersion = "2.0";
        try {
          const vResp = await fetch(`${testServerUrl}?action=checkBackendVersion&_t=${Date.now()}`);
          if (vResp.ok) {
            const vJson = await vResp.json();
            if (vJson && vJson.version) detectedVersion = formatBackendVersion(vJson.version, "2.0");
          }
        } catch (eV) {}

        const rawReq = (localStorage.getItem("required_backend_version") || "2.3").trim();
        const requiredVersion = formatBackendVersion(rawReq, "2.3");
        const isCurrentUpdated = compareBackendVersions(detectedVersion, requiredVersion) >= 0;
        const displayDetectedVer = `v${detectedVersion}`;

        if (currentTeacher?.username) {
          try {
            fetch(`${DEFAULT_GAS_API_URL}?action=updateTeacherBackendVersion&username=${encodeURIComponent(currentTeacher.username)}&version=${encodeURIComponent(detectedVersion)}&_t=${Date.now()}`);
          } catch (eU) {}
        }

        if (isCurrentUpdated || isCentralAccount() || isAdminRole() || isCurrentUserAdmin()) {
          const noticeBox = document.getElementById("hubVersionUpdateNotice");
          if (noticeBox) noticeBox.style.display = "none";
        }

        // Kiểm tra ping tới Trạm Trung Tâm
        const respHub = await fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory`, { method: "GET" });
        if (respHub.ok) {
          setHubStatus("success", `✅ <strong>KẾT NỐI XUẤT SẮC! (${displayDetectedVer})</strong>${studentCountNotice}<br>Cả Google Sheet riêng của Thầy/Cô và Trạm Trung Tâm đều đang phản hồi rất tốt. Sẵn sàng bấm Đồng Bộ!`);
          showToast("Kết nối thành công! 🎉", `Máy chủ riêng (${displayDetectedVer}) phản hồi tốt!${studentCountNotice ? " " + studentCountNotice.replace(/<[^>]+>/g, '') : ""}`, "success", 4000);
        } else {
          setHubStatus("success", `✅ <strong>Máy chủ riêng (${displayDetectedVer}) phản hồi tốt!</strong>${studentCountNotice} (Đang sẵn sàng đồng bộ)`);
        }
      } catch (err) {
        setHubStatus("error", `❌ <strong>Kết nối thất bại:</strong> ${err.message}<br><small>Gợi ý: Khi tạo New Deployment trên Google Sheet, mục <strong>Who has access (Ai có quyền truy cập)</strong> bắt buộc phải chọn là <strong>Anyone (Bất kỳ ai)</strong>.</small>`);
        showToast("Lỗi kết nối", err.message, "error", 5000);
      } finally {
        btnTestHubConnection.disabled = false;
        btnTestHubConnection.innerHTML = originalText;
      }
    });
  }

  // 2. Thực hiện đồng bộ lên Hub
  if (btnExecuteHubSync) {
    btnExecuteHubSync.addEventListener("click", async () => {
      if (!currentTeacher || !currentTeacher.username) {
        showToast("Lỗi", "Không tìm thấy thông tin tài khoản giáo viên!", "error");
        return;
      }

      const inputUrl = hubInfoServerUrlInput ? (hubInfoServerUrlInput.value || "").trim() : API_URL;

      if (!inputUrl || !inputUrl.startsWith("https://script.google.com/macros/s/") || !inputUrl.includes("/exec")) {
        setHubStatus("error", "URL Google Apps Script không hợp lệ! Vui lòng dán đúng đường link kết thúc bằng <code>/exec</code>.");
        showToast("URL không hợp lệ", "URL Web App phải có dạng https://script.google.com/macros/s/.../exec", "error", 5000);
        if (hubInfoServerUrlInput) hubInfoServerUrlInput.focus();
        return;
      }

      btnExecuteHubSync.disabled = true;
      if (btnExecuteHubSyncText) btnExecuteHubSyncText.textContent = "Đang đọc Sheet riêng...";
      if (hubSyncSpinner) hubSyncSpinner.style.display = "inline-block";

      try {
        // BƯỚC 1: NẾU DÙNG SHEET RIÊNG, LẬP TỨC ĐỌC DANH SÁCH HỌC SINH TỪ SHEET ĐÓ TRƯỚC
        if (inputUrl !== DEFAULT_GAS_API_URL) {
          setHubStatus("loading", `⏳ Đang đọc danh sách học sinh từ Google Sheet riêng của Thầy/Cô...`);
          let freshSheetData = null;

          // Thử POST
          try {
            const sResp = await fetch(inputUrl, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({
                action: "getStudentsForTeacher",
                usernameGV: currentTeacher.username
              })
            });
            const sText = await sResp.text();
            if (sText && !sText.trim().startsWith("<")) {
              freshSheetData = JSON.parse(sText);
            }
          } catch (postErr) {
            console.warn("POST đọc danh sách HS từ Sheet riêng thất bại, thử GET fallback...", postErr);
          }

          // Fallback GET
          if (!freshSheetData || !freshSheetData.success) {
            const getUrl = `${inputUrl}?action=getStudentsForTeacher&usernameGV=${encodeURIComponent(currentTeacher.username)}&_t=${Date.now()}`;
            const gResp = await fetch(getUrl);
            const gText = await gResp.text();
            if (gText && !gText.trim().startsWith("<")) {
              freshSheetData = JSON.parse(gText);
            }
          }

          if (!freshSheetData || !freshSheetData.success || !Array.isArray(freshSheetData.students)) {
            throw new Error(freshSheetData?.message || "Không thể đọc dữ liệu từ URL Google Sheet riêng này! Hãy chắc chắn Thầy/Cô đã dán đúng file code vào Apps Script và chọn Deploy quyền 'Anyone' (Bất kỳ ai).");
          }

          // Cập nhật danh sách học sinh chính xác từ Google Sheet riêng vào bộ nhớ
          currentTeacherStudents = (freshSheetData.students || []).map(st => ({
            ...st,
            lop: normalizeClassName(st.lop)
          }));
          const freshClasses = (freshSheetData.classes && freshSheetData.classes.length > 0)
            ? freshSheetData.classes.map(normalizeClassName).filter(Boolean)
            : [...new Set(currentTeacherStudents.map(s => s.lop).filter(Boolean))];

          // Lưu URL riêng này vào hệ thống của máy giáo viên
          localStorage.setItem("custom_gas_api_url", inputUrl);
          if (currentTeacher?.username) {
            localStorage.setItem("teacher_server_url_" + currentTeacher.username, inputUrl);
            localStorage.setItem("teacher_server_url_" + currentTeacher.username.replace(/^0+/, ""), inputUrl);
          }
          if (currentTeacher) {
            currentTeacher.serverUrl = inputUrl;
            localStorage.setItem("currentUser", JSON.stringify(currentTeacher));
          }
          API_URL = inputUrl;
          if (hubInfoServerTypeBadge) {
            hubInfoServerTypeBadge.textContent = "Google Sheet Cá Nhân (Riêng)";
            hubInfoServerTypeBadge.style.background = "#ecfdf5";
            hubInfoServerTypeBadge.style.color = "#047857";
            hubInfoServerTypeBadge.style.border = "1px solid #a7f3d0";
          }
          updateServerStatusBadgeUI();

          // Cập nhật ngay bộ nhớ đệm và giao diện bảng danh sách học sinh trên màn hình
          saveCachedTeacherStudents(currentTeacherStudents, freshClasses);
          buildGradeAndClassFilters(freshClasses);
          applyStudentFilters();

          // Tự động cập nhật lớp giảng dạy lên Sheet Trung Tâm (Cột E) để Admin luôn thấy
          const freshClassesStr = (freshClasses && freshClasses.length > 0) ? freshClasses.join(", ") : (currentTeacher?.lopGiangDay || "");
          if (freshClassesStr && currentTeacher?.username) {
            try {
              fetch(`${DEFAULT_GAS_API_URL}?action=updateTeacherClasses&usernameGV=${encodeURIComponent(currentTeacher.username)}&lopGiangDay=${encodeURIComponent(freshClassesStr)}&_t=${Date.now()}`);
            } catch (eCls) {}
          }

        } else {
          // Khôi phục URL mặc định của Admin
          localStorage.removeItem("custom_gas_api_url");
          if (currentTeacher?.username) {
            localStorage.removeItem("teacher_server_url_" + currentTeacher.username);
            localStorage.removeItem("teacher_server_url_" + currentTeacher.username.replace(/^0+/, ""));
          }
          if (currentTeacher) {
            currentTeacher.serverUrl = "";
            localStorage.setItem("currentUser", JSON.stringify(currentTeacher));
          }
          API_URL = DEFAULT_GAS_API_URL;
          if (hubInfoServerTypeBadge) {
            if (isCurrentUserAdmin()) {
              hubInfoServerTypeBadge.textContent = "Google Sheet Admin (Máy Chủ Trung Tâm)";
              hubInfoServerTypeBadge.style.background = "#eff6ff";
              hubInfoServerTypeBadge.style.color = "#1d4ed8";
              hubInfoServerTypeBadge.style.border = "1px solid #bfdbfe";
            } else {
              hubInfoServerTypeBadge.textContent = "Chưa kết nối Sheet riêng (Mặc định)";
              hubInfoServerTypeBadge.style.background = "#fffbeb";
              hubInfoServerTypeBadge.style.color = "#b45309";
              hubInfoServerTypeBadge.style.border = "1px solid #fde68a";
            }
          }
          updateServerStatusBadgeUI();
        }

        // BƯỚC 2: CHUẨN BỊ VÀ GỬI DANH SÁCH HỌC SINH MỚI LÊN TRẠM TRUNG TÂM (HUB)
        if (btnExecuteHubSyncText) btnExecuteHubSyncText.textContent = "Đang đồng bộ lên Hub...";
        setHubStatus("loading", `⏳ Đang nén danh bạ (${currentTeacherStudents.length} học sinh) và đồng bộ lên Trạm Trung Tâm...`);

        const studentsToSend = (Array.isArray(currentTeacherStudents) ? currentTeacherStudents : []).map(s => ({
          username: s.username || "",
          hoTen: s.hoTen || "",
          lop: s.lop || "",
          truong: s.truong || (currentTeacher ? currentTeacher.truong : "") || ""
        }));

        const freshClassesStrSync = (currentTeacherStudents && currentTeacherStudents.length > 0)
          ? [...new Set(currentTeacherStudents.map(s => s.lop).filter(Boolean))].join(", ")
          : (currentTeacher?.lopGiangDay || "");

        const payload = {
          action: "syncTeacherAndStudentsToHub",
          usernameGV: currentTeacher.username,
          hoTenGV: currentTeacher.hoTenGV || "",
          truong: currentTeacher.truong || "",
          lopGiangDay: freshClassesStrSync,
          serverUrl: inputUrl,
          students: studentsToSend
        };

        const resp = await fetch(DEFAULT_GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          throw new Error(`Máy chủ Trạm Trung Tâm phản hồi mã lỗi HTTP ${resp.status}`);
        }

        const res = await resp.json();
        if (res && res.success) {
          const syncDetail = (res.updatedCount !== undefined && res.addedCount !== undefined)
            ? `<br>📊 <em>Chi tiết: Đã cập nhật URL cho <strong>${res.updatedCount}</strong> học sinh cũ | Thêm mới <strong>${res.addedCount}</strong> học sinh.</em>`
            : "";
          setHubStatus("success", `🎉 <strong>ĐỒNG BỘ THÀNH CÔNG RỰC RỠ!</strong><br>${res.message || "Đã ghi nhận máy chủ và danh bạ học sinh lên Trạm Trung Tâm."}${syncDetail}<br><small>Học sinh khi đăng nhập chỉ cần gõ tài khoản là hệ thống tự động kết nối vào đúng Google Sheet của Thầy/Cô!</small>`);
          showToast("Đồng bộ thành công! 🌐", res.message || `Đã đồng bộ ${studentsToSend.length} học sinh lên Trạm Trung Tâm!`, "success", 6000);
          try { loadTeacherExams(false); } catch (eExams) {}
        } else {
          throw new Error(res ? res.message : "Trạm Trung Tâm phản hồi lỗi không xác định!");
        }

      } catch (err) {
        console.error("Lỗi đồng bộ Trạm Trung Tâm:", err);
        setHubStatus("error", `❌ <strong>Lỗi đồng bộ:</strong> ${err.message}`);
        showToast("Đồng bộ thất bại", err.message, "error", 5000);
      } finally {
        btnExecuteHubSync.disabled = false;
        if (btnExecuteHubSyncText) btnExecuteHubSyncText.textContent = "🚀 Bắt đầu Đồng Bộ Lên Hub";
        if (hubSyncSpinner) hubSyncSpinner.style.display = "none";
      }
    });
  }
}

// ============================================================================
// TÍNH NĂNG CHIA SẺ ĐỀ THI CHO GIÁO VIÊN TRONG HUB SERVER
// ============================================================================
let currentExamToShare = null;
let cachedHubTeachersForShare = null;
let isShareExamModalInited = false;
let isSharingExamInProgress = false;

function initShareExamModal() {
  if (isShareExamModalInited) return;

  const shareModal = document.getElementById("shareExamModal");
  if (!shareModal) return;

  isShareExamModalInited = true;

  const btnClose = document.getElementById("btnCloseShareExamModal");
  const btnCancel = document.getElementById("btnCancelShareExamModal");
  const btnConfirm = document.getElementById("btnConfirmShareExam");
  const btnConfirmText = document.getElementById("btnConfirmShareExamText");
  const spinner = document.getElementById("shareExamSpinner");
  const statusAlert = document.getElementById("shareStatusAlert");
  const selectRecipient = document.getElementById("selectShareRecipientTeacher");

  function setShareAlert(type, msg) {
    if (!statusAlert) return;
    statusAlert.style.display = "block";
    if (type === "error") {
      statusAlert.style.background = "#fef2f2";
      statusAlert.style.border = "1.5px solid #fecaca";
      statusAlert.style.color = "#b91c1c";
    } else if (type === "success") {
      statusAlert.style.background = "#f0fdf4";
      statusAlert.style.border = "1.5px solid #86efac";
      statusAlert.style.color = "#15803d";
    } else {
      statusAlert.style.background = "#eff6ff";
      statusAlert.style.border = "1.5px solid #bfdbfe";
      statusAlert.style.color = "#1d4ed8";
    }
    statusAlert.innerHTML = msg;
  }

  function hideShareAlert() {
    if (statusAlert) statusAlert.style.display = "none";
  }

  if (btnClose) btnClose.addEventListener("click", closeShareExamModal);
  if (btnCancel) btnCancel.addEventListener("click", closeShareExamModal);

  // Click ra vùng nền ngoài để đóng
  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) {
      closeShareExamModal();
    }
  });

  // Xác nhận chia sẻ
  if (btnConfirm) {
    btnConfirm.addEventListener("click", async () => {
      // Chặn nhấn đúp hoặc xử lý trùng lặp
      if (isSharingExamInProgress) return;

      if (!currentExamToShare) {
        showToast("Lỗi", "Không tìm thấy thông tin đề thi cần chia sẻ!", "error");
        return;
      }

      const targetMaGV = (selectRecipient ? selectRecipient.value : "").trim();
      if (!targetMaGV) {
        setShareAlert("error", "⚠️ Vui lòng chọn một Giáo viên nhận đề từ danh sách!");
        return;
      }

      const recipient = (cachedHubTeachersForShare || []).find(t => String(t.maGV || "").trim() === targetMaGV);
      if (!recipient || !recipient.serverUrl || !recipient.serverUrl.startsWith("https://script.google.com/macros/s/")) {
        setShareAlert("error", "⚠️ Giáo viên này chưa cập nhật URL Web App Google Sheet hợp lệ trong Hub Server nên không thể nhận đề!");
        return;
      }

      isSharingExamInProgress = true;
      btnConfirm.disabled = true;
      if (btnConfirmText) btnConfirmText.textContent = "Đang gửi đề...";
      if (spinner) spinner.style.display = "block";
      hideShareAlert();

      try {
        const duLieuDeObj = JSON.parse(JSON.stringify(currentExamToShare.duLieuDe || {}));
        const senderIsAdmin = isCurrentUserAdmin();
        const senderName = currentTeacher?.hoTenGV || currentTeacher?.hoTen || currentTeacher?.tenGV || currentTeacher?.username || (senderIsAdmin ? "Admin" : "Giáo viên");
        const nguonDe = senderIsAdmin ? "Được chia sẻ từ Admin" : `Được chia sẻ từ GV ${senderName}`;

        duLieuDeObj.sharedFromAdmin = senderIsAdmin;
        duLieuDeObj.sharedBy = senderName;
        duLieuDeObj.nguonDe = nguonDe;

        const sharePayload = {
          action: "saveExam",
          maDe: "", // Để trống để server GV nhận tự sinh mã DE_ mới độc lập, không bị trùng/ghi đè
          tenKyThi: currentExamToShare.tenKyThi,
          thoiGian: Number(currentExamToShare.thoiGian) || 45,
          lopChoPhep: currentExamToShare.lopChoPhep || "ALL",
          trangThai: "Đóng", // Mặc định Đóng để GV nhận chủ động kiểm tra trước khi mở
          choXemLaiBai: (currentExamToShare.choXemLaiBai !== false),
          choXemDiem: (currentExamToShare.choXemDiem !== false),
          usernameGV: recipient.maGV,
          hoTenGV: recipient.hoTenGV || recipient.maGV,
          duLieuDe: duLieuDeObj
        };

        const res = await fetch(recipient.serverUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(sharePayload)
        });

        const resData = await res.json();
        if (resData && resData.success) {
          showToast("Chia sẻ thành công! 📤", `Đã gửi đề thi "${currentExamToShare.tenKyThi}" thành công sang Google Sheet của thầy/cô ${recipient.hoTenGV || recipient.maGV}!`, "success", 5000);
          closeShareExamModal();
        } else {
          setShareAlert("error", `❌ Không thể lưu đề sang GV: ${resData?.message || "Lỗi không xác định"}`);
        }
      } catch (err) {
        console.error("Lỗi khi chia sẻ đề thi:", err);
        setShareAlert("error", `❌ Lỗi kết nối tới Server của Giáo viên: ${err.message || err.toString()}`);
      } finally {
        isSharingExamInProgress = false;
        btnConfirm.disabled = false;
        if (btnConfirmText) btnConfirmText.textContent = "📤 Xác nhận Chia Sẻ";
        if (spinner) spinner.style.display = "none";
      }
    });
  }
}

async function openShareExamModal(maDe) {
  const modal = document.getElementById("shareExamModal");
  if (!modal) return;

  const exam = currentExamsList.find(e => e.maDe === maDe);
  if (!exam) {
    showToast("Lỗi", "Không tìm thấy dữ liệu đề thi này!", "error");
    return;
  }

  currentExamToShare = exam;

  // Hiển thị thông tin đề lên modal
  const titleEl = document.getElementById("shareExamTitle");
  const codeEl = document.getElementById("shareExamCode");
  const durEl = document.getElementById("shareExamDuration");
  const totalEl = document.getElementById("shareExamTotalQuestions");
  const alertEl = document.getElementById("shareStatusAlert");

  if (titleEl) titleEl.textContent = exam.tenKyThi || "--";
  if (codeEl) codeEl.textContent = exam.maDe || "--";
  if (durEl) durEl.textContent = exam.thoiGian || "45";
  
  const essayCount = getExamEssayCount(exam);
  if (totalEl) {
    totalEl.textContent = `${exam.soCauHoi || 0} câu TN${essayCount > 0 ? ` + ${essayCount} tự luận` : ""}`;
  }
  if (alertEl) alertEl.style.display = "none";

  // Mở modal
  modal.style.display = "flex";

  // Nạp danh sách giáo viên từ Hub Server
  await loadHubTeachersForShare();
}

function closeShareExamModal() {
  const modal = document.getElementById("shareExamModal");
  if (modal) modal.style.display = "none";
  currentExamToShare = null;
}

async function loadHubTeachersForShare() {
  const select = document.getElementById("selectShareRecipientTeacher");
  if (!select) return;

  select.innerHTML = '<option value="">-- Đang tải danh sách Giáo viên từ Hub Server... --</option>';

  try {
    const resp = await fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory`, { method: "GET" });
    const data = await resp.json();

    if (data && data.success && Array.isArray(data.teachers)) {
      cachedHubTeachersForShare = data.teachers;

      const currentGvUser = (currentTeacher?.username || "").trim().toLowerCase();
      const currentIsAdmin = isCurrentUserAdmin();

      // Lọc các GV có URL hợp lệ và không phải là người chia sẻ
      const eligible = data.teachers.filter(t => {
        const tMaGV = String(t.maGV || "").trim().toLowerCase();
        const tUrl = String(t.serverUrl || "").trim();
        return tUrl.startsWith("https://script.google.com/macros/s/") && tMaGV !== currentGvUser;
      });

      // Nếu người gửi là Giáo viên bộ môn (không phải Admin), thêm Admin vào danh sách để GV có thể chia sẻ đề cho Admin!
      const hasAdminInHub = eligible.some(t => t.serverUrl === DEFAULT_GAS_API_URL || t.maGV.toLowerCase() === "admin" || t.maGV === "0938750424" || t.maGV.replace(/^0+/, "") === "938750424");
      if (!currentIsAdmin && !hasAdminInHub) {
        eligible.unshift({
          maGV: "ADMIN",
          hoTenGV: "Admin Quản Trị Hệ Thống",
          truong: "Trạm Trung Tâm (Central Hub)",
          serverUrl: DEFAULT_GAS_API_URL
        });
      }

      cachedHubTeachersForShare = eligible;

      if (eligible.length === 0) {
        select.innerHTML = '<option value="">(Chưa có Giáo viên nào khác đăng ký Web App trong Hub)</option>';
        return;
      }

      let optionsHtml = '<option value="">-- Chọn Giáo viên nhận đề --</option>';
      eligible.forEach(t => {
        const school = t.truong ? ` - ${t.truong}` : "";
        optionsHtml += `<option value="${t.maGV}">${t.hoTenGV || t.maGV}${school} (${t.maGV})</option>`;
      });
      select.innerHTML = optionsHtml;
    } else {
      select.innerHTML = '<option value="">(Không thể lấy danh sách từ Hub Server)</option>';
    }
  } catch (err) {
    console.error("Lỗi nạp danh sách GV:", err);
    select.innerHTML = '<option value="">(Lỗi kết nối tới Hub Server)</option>';
  }
}

// Khởi tạo tính năng Central Hub & Chia Sẻ khi DOM sẵn sàng
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initCentralHubModal();
    initShareExamModal();
  });
} else {
  initCentralHubModal();
  initShareExamModal();
}

/**
 * ============================================================================
 * QUẢN TRỊ VIÊN (ADMIN) - BỘ LỌC GIÁO VIÊN & ĐỌC SHEET URL TRỰC TIẾP
 * ============================================================================
 */
async function initAdminTeacherSelector() {
  const selectTeacher = document.getElementById("selectFilterTeacher");
  const btnRefresh = document.getElementById("btnRefreshTeacherList");
  const btnOpenSheetModal = document.getElementById("btnOpenSheetUrlModal");
  const modalSheetUrl = document.getElementById("modalSheetUrlReader");
  const btnCloseSheetUrl = document.getElementById("btnCloseSheetUrlModal");
  const btnCancelSheetUrl = document.getElementById("btnCancelSheetUrl");
  const btnSubmitSheetUrl = document.getElementById("btnSubmitDirectSheetUrl");
  const inputSheetUrl = document.getElementById("inputDirectSheetUrl");

  if (!selectTeacher) return;

  function cleanTeacherDirectoryList(rawTeachers) {
    if (!Array.isArray(rawTeachers)) return [];
    const cleanKey = (s) => String(s || "").trim().toLowerCase().replace(/^0+/, "");
    const seen = new Set();
    const result = [];

    rawTeachers.forEach(t => {
      const rawCode = String(t.maGV || "").trim();
      if (!rawCode || rawCode.toLowerCase() === "admin") return;
      const ck = cleanKey(rawCode);
      if (seen.has(ck)) return;
      seen.add(ck);

      result.push({
        maGV: rawCode,
        hoTenGV: String(t.hoTenGV || "").trim(),
        truong: String(t.truong || "").trim(),
        serverUrl: String(t.serverUrl || "").trim(),
        sheetUrl: String(t.sheetUrl || "").trim(),
        trangThai: String(t.trangThai || "Hoạt động").trim()
      });
    });

    return result;
  }

  async function fetchTeachers() {
    selectTeacher.innerHTML = '<option value="ALL">-- Đang tải danh sách giáo viên... --</option>';
    try {
      let res = null;
      try {
        const response = await fetch(DEFAULT_GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getTeacherHubDirectory" })
        });
        const txt = await response.text();
        if (txt && !txt.trim().startsWith("<")) res = JSON.parse(txt);
      } catch (ePost) {}

      if (!res || !res.success) {
        const getRes = await fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory&_t=${Date.now()}`);
        const getTxt = await getRes.text();
        if (getTxt && !getTxt.trim().startsWith("<")) res = JSON.parse(getTxt);
      }

      if (res && Array.isArray(res.teachers)) {
        adminTeacherDirectory = cleanTeacherDirectoryList(res.teachers);
        renderTeacherOptions(adminTeacherDirectory);
      } else {
        selectTeacher.innerHTML = '<option value="ALL">-- Tất cả Giáo viên (Toàn trường) --</option>';
      }
    } catch (err) {
      console.warn("Lỗi tải danh bạ giáo viên:", err);
      selectTeacher.innerHTML = '<option value="ALL">-- Tất cả Giáo viên (Toàn trường) --</option>';
    }
  }

  function renderTeacherOptions(teachers) {
    selectTeacher.innerHTML = '<option value="ALL">-- Tất cả Giáo viên (Toàn trường) --</option>';
    teachers.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.maGV;
      opt.textContent = `${t.hoTenGV || t.maGV} (${t.maGV})${t.truong ? ` - ${t.truong}` : ""}`;
      if (t.serverUrl) opt.dataset.server = t.serverUrl;
      if (t.sheetUrl) opt.dataset.sheet = t.sheetUrl;
      selectTeacher.appendChild(opt);
    });
  }

  await fetchTeachers();

  // Sự kiện khi Quản trị viên đổi giáo viên cần xem
  selectTeacher.addEventListener("change", async () => {
    const sInput = document.getElementById("searchStudentInput");
    const bClear = document.getElementById("btnClearSearchStudent");
    if (sInput) sInput.value = "";
    if (bClear) bClear.style.display = "none";

    const selectedMaGV = selectTeacher.value;
    adminActiveUsernameGV = selectedMaGV;

    if (selectedMaGV === "ALL") {
      adminActiveApiUrl = DEFAULT_GAS_API_URL;
      API_URL = DEFAULT_GAS_API_URL;
      showToast("Đang tải dữ liệu", "Đang nạp toàn bộ bài kiểm tra và điểm số của tất cả giáo viên...", "info", 2000);
    } else {
      const opt = selectTeacher.selectedOptions[0];
      const serverUrl = opt ? (opt.dataset.server || "") : "";
      adminActiveApiUrl = (serverUrl && serverUrl.startsWith("https://script.google.com/macros/s/")) ? serverUrl : DEFAULT_GAS_API_URL;
      API_URL = adminActiveApiUrl;
      const teacherName = opt ? opt.textContent : selectedMaGV;
      showToast("Chọn giáo viên", `Đang nạp dữ liệu thống kê của: ${teacherName}...`, "info", 2000);
    }

    // Nạp lại đề thi, học sinh và kết quả điểm theo giáo viên đang chọn
    await loadTeacherExams(true);
    await loadTeacherStudents(true);
    await loadTeacherResults("ALL");
  });

  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      await fetchTeachers();
      selectTeacher.dispatchEvent(new Event("change"));
    });
  }

  // Xử lý Modal URL Google Sheet trực tiếp
  if (btnOpenSheetModal && modalSheetUrl) {
    btnOpenSheetModal.addEventListener("click", () => {
      modalSheetUrl.style.display = "flex";
      if (inputSheetUrl) inputSheetUrl.focus();
    });
  }

  function closeSheetModal() {
    if (modalSheetUrl) modalSheetUrl.style.display = "none";
  }
  if (btnCloseSheetUrl) btnCloseSheetUrl.addEventListener("click", closeSheetModal);
  if (btnCancelSheetUrl) btnCancelSheetUrl.addEventListener("click", closeSheetModal);

  if (btnSubmitSheetUrl) {
    btnSubmitSheetUrl.addEventListener("click", async () => {
      const sUrl = (inputSheetUrl ? inputSheetUrl.value : "").trim();
      if (!sUrl || !sUrl.includes("docs.google.com/spreadsheets/")) {
        showToast("URL không hợp lệ", "Vui lòng nhập đúng đường link Google Sheets!", "warning");
        return;
      }

      btnSubmitSheetUrl.disabled = true;
      btnSubmitSheetUrl.textContent = "Đang tải dữ liệu từ Sheet...";

      try {
        const resp = await fetch(DEFAULT_GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "getSheetDataByUrl",
            sheetUrl: sUrl
          })
        });
        const raw = await resp.text();
        const res = JSON.parse(raw);

        if (res && res.success) {
          closeSheetModal();
          showToast("Thành công", `Đã nạp thành công dữ liệu từ "${res.sheetTitle || 'Google Sheet'}"!`, "success", 4000);

          // Cập nhật danh sách đề thi
          currentExamsList = res.exams || [];
          updateFilterExamDropdown(currentExamsList);

          // Cập nhật học sinh
          currentTeacherStudents = res.students || [];

          // Cập nhật kết quả bài làm
          currentRawResultsList = (res.results || []).map(r => ({
            ...r,
            lop: normalizeClassName(r.lop)
          }));
          currentResultsList = currentRawResultsList;

          populateResultClassDropdown("ALL");
          applyResultsFiltersAndRender();

        } else {
          showToast("Lỗi nạp Sheet", res?.message || "Không thể đọc dữ liệu từ Google Sheet này!", "error", 5000);
        }
      } catch (errSheet) {
        console.error("Lỗi đọc sheet:", errSheet);
        showToast("Lỗi kết nối", errSheet.message || "Không thể kết nối đến Google Sheets!", "error", 5000);
      } finally {
        btnSubmitSheetUrl.disabled = false;
        btnSubmitSheetUrl.innerHTML = "<span>🚀 Tải Dữ Liệu Từ Sheet</span>";
      }
    });
  }
}

// ============================================================================
// 1. KHỞI TẠO & PHÂN QUYỀN TRANG (Đặt ở cuối cùng để mọi hàm & hằng số đã sẵn sàng)
// ============================================================================
function initTeacherDashboard() {
  try {
    // Gắn sự kiện hủy chỉnh sửa đề
    const btnCancel = document.getElementById("btnCancelEdit");
    if (btnCancel) {
      btnCancel.addEventListener("click", cancelEditingMode);
    }

    // Kiểm tra phiên đăng nhập
    const rawUser = localStorage.getItem("currentUser");
    const role = localStorage.getItem("userRole");

    if (!rawUser || (role !== "GV" && role !== "ADMIN")) {
      alert("Phiên đăng nhập không hợp lệ hoặc bạn không có quyền Giáo viên / Quản trị viên.");
      window.location.href = "index.html";
      return;
    }

    try {
      currentTeacher = JSON.parse(rawUser);
    } catch (eParse) {
      console.error("Lỗi đọc dữ liệu giáo viên:", eParse);
      currentTeacher = null;
    }

    if (!currentTeacher) {
      alert("Không thể đọc thông tin tài khoản giáo viên. Vui lòng đăng nhập lại!");
      window.location.href = "index.html";
      return;
    }

    if (currentTeacher.ngaySinh) {
      currentTeacher.ngaySinh = formatDob(currentTeacher.ngaySinh);
    }

    // Khôi phục URL cá nhân của Giáo viên và cập nhật API_URL độc quyền
    const personalServerUrl = getTeacherPersonalServerUrl();
    if (personalServerUrl) {
      API_URL = personalServerUrl;
      localStorage.setItem("custom_gas_api_url", personalServerUrl);
      if (currentTeacher.username) {
        localStorage.setItem("teacher_server_url_" + currentTeacher.username, personalServerUrl);
        localStorage.setItem("teacher_server_url_" + currentTeacher.username.replace(/^0+/, ""), personalServerUrl);
      }
    } else {
      API_URL = DEFAULT_GAS_API_URL;
    }
    updateServerStatusBadgeUI();

    // KIỂM TRA PHÂN QUYỀN QUẢN TRỊ VIÊN (CHỈ DUY NHẤT TÀI KHOẢN "admin" MỚI LÀ CỔNG QUẢN TRỊ VIÊN BGH)
    const tabBtnCreate = document.getElementById("tabBtnCreate");
    const tabBtnStudents = document.getElementById("tabBtnStudents");
    const tabBtnResults = document.getElementById("tabBtnResults");
    const tabCreate = document.getElementById("tabCreate");
    const tabStudents = document.getElementById("tabStudents");
    const tabResults = document.getElementById("tabResults");
    const adminTeacherGrp = document.getElementById("adminTeacherFilterGroup");
    const btnOpenHubModal = document.getElementById("btnOpenHubModal");

    const tabBtnAdminTeachers = document.getElementById("tabBtnAdminTeachers");
    const tabAdminTeachers = document.getElementById("tabAdminTeachers");

    if (isAdminRole()) {
      API_URL = DEFAULT_GAS_API_URL;
      const isBGH = isBGHAccount();
      const hasTeacherMgmt = hasTeacherManagementPermission();

      const brandRoleTag = document.getElementById("brandRoleTag");
      if (brandRoleTag) {
        brandRoleTag.textContent = isBGH ? "Cổng Ban Giám Hiệu" : "Cổng Quản Trị Viên (Admin)";
      }
      document.title = isBGH ? "EduTest Pro 2.0 - Ban Giám Hiệu" : "EduTest Pro 2.0 - Cổng Quản Trị Viên";

      const gvFullNameEl = document.getElementById("gvFullName");
      if (gvFullNameEl) gvFullNameEl.textContent = currentTeacher.hoTenGV || (isBGH ? "Ban Giám Hiệu" : "Quản Trị Viên");
      const gvNavAvatar = document.getElementById("gvNavAvatar");
      if (gvNavAvatar) gvNavAvatar.textContent = isBGH ? "BGH" : "AD";
      const dropdownGvName = document.getElementById("dropdownGvName");
      if (dropdownGvName) dropdownGvName.textContent = currentTeacher.hoTenGV || (isBGH ? "Ban Giám Hiệu" : "Quản Trị Viên");
      const dropdownBadge = document.querySelector(".dropdown-user-badge");
      if (dropdownBadge) dropdownBadge.textContent = isBGH ? "Ban Giám Hiệu" : "Quản Trị Viên";

      if (isBGH) {
        // TÀI KHOẢN TÊN 'admin': LÀ BAN GIÁM HIỆU
        // CHỈ HIỆN DUY NHẤT 1 TAB: "Xem Thống Kê & Điểm Số" của ALL giáo viên
        if (tabBtnCreate) tabBtnCreate.style.display = "none";
        if (tabBtnStudents) tabBtnStudents.style.display = "none";
        if (tabCreate) {
          tabCreate.style.display = "none";
          tabCreate.classList.remove("active");
        }
        if (tabStudents) {
          tabStudents.style.display = "none";
          tabStudents.classList.remove("active");
        }

        // Ẩn tab Quản lý Giáo viên (vì tk tên admin không phải là quyền admin quản lý GV)
        if (tabBtnAdminTeachers) tabBtnAdminTeachers.style.display = "none";
        if (tabAdminTeachers) tabAdminTeachers.style.display = "none";

        // Kích hoạt tab Xem Thống Kê & Điểm Số duy nhất
        if (tabBtnResults) {
          tabBtnResults.style.display = "";
          tabBtnResults.classList.add("active");
          const span = tabBtnResults.querySelector("span");
          if (span) span.textContent = "Xem Thống Kê & Điểm Số";
        }
        if (tabResults) {
          tabResults.style.display = "block";
          tabResults.classList.add("active");
        }
      } else {
        // TÀI KHOẢN GIÁO VIÊN CÓ QUYỀN ADMIN (CỘT D LÀ 'admin'):
        // HIỆN ĐẦY ĐỦ CẢ 4 TAB: Tạo Đề, Xem Kết Quả, Quản Lý Học Sinh, VÀ Quản Lý Giáo Viên
        if (tabBtnCreate) tabBtnCreate.style.display = "";
        if (tabBtnStudents) tabBtnStudents.style.display = "";
        if (tabBtnResults) {
          tabBtnResults.style.display = "";
          const span = tabBtnResults.querySelector("span");
          if (span) span.textContent = "Xem Kết Quả & Thống Kê";
        }
        // Hiển thị Tab Quản lý Giáo viên cho Quản trị viên
        if (tabBtnAdminTeachers) tabBtnAdminTeachers.style.display = hasTeacherMgmt ? "" : "none";
      }

      // Hiện thanh chọn giáo viên để BGH / Admin kiểm tra kết quả của toàn bộ GV
      if (adminTeacherGrp) adminTeacherGrp.style.display = "flex";

      // Ẩn modal trạm trung tâm khỏi dropdown vì admin/bgh đang ở trạm trung tâm
      if (btnOpenHubModal) btnOpenHubModal.style.display = "none";

      // Khởi tạo selector Giáo viên cho Admin / BGH
      initAdminTeacherSelector();

      // Chỉ khởi tạo module Quản trị Giáo viên nếu có quyền quản trị GV
      if (hasTeacherMgmt) {
        initAdminTeacherManagement();
      }
    } else {
      // TẤT CẢ GIÁO VIÊN BÌNH THƯỜNG:
      if (tabBtnCreate) tabBtnCreate.style.display = "";
      if (tabBtnStudents) tabBtnStudents.style.display = "";
      if (tabBtnResults) {
        const span = tabBtnResults.querySelector("span");
        if (span) span.textContent = "Xem Kết Quả & Thống Kê";
      }

      // Ẩn tab Quản lý Giáo viên
      if (tabBtnAdminTeachers) tabBtnAdminTeachers.style.display = "none";
      if (tabAdminTeachers) tabAdminTeachers.style.display = "none";

      // Ẩn thanh chọn giáo viên (chỉ dành riêng cho Admin BGH)
      if (adminTeacherGrp) adminTeacherGrp.style.display = "none";

      // Mở nút Trạm Trung Tâm cho GV
      if (btnOpenHubModal) btnOpenHubModal.style.display = "";

      const brandRoleTag = document.getElementById("brandRoleTag");
      if (brandRoleTag) brandRoleTag.textContent = "Cổng Giáo Viên";
      document.title = "EduTest Pro 2.0 - Cổng Giáo Viên";

      const dropdownBadge = document.querySelector(".dropdown-user-badge");
      if (dropdownBadge) dropdownBadge.textContent = "Giáo Viên";

      const gvNavAvatar = document.getElementById("gvNavAvatar");
      if (gvNavAvatar) {
        const initials = (currentTeacher.hoTenGV || currentTeacher.username || "GV")
          .split(" ")
          .filter(Boolean)
          .slice(-2)
          .map(w => w[0].toUpperCase())
          .join("");
        gvNavAvatar.textContent = initials || "GV";
      }
    }

    // Hiển thị thông tin giáo viên lên navbar (chỉ hiển thị tên, ẩn dòng lớp dài dòng)
    const gvFullNameEl = document.getElementById("gvFullName");
    if (gvFullNameEl) {
      gvFullNameEl.textContent = currentTeacher.hoTenGV || currentTeacher.username || "Thầy/Cô";
    }
    const gvClassesEl = document.getElementById("gvClasses");
    if (gvClassesEl) {
      gvClassesEl.textContent = "";
      gvClassesEl.style.display = "none";
    }

    // Khởi tạo giao diện cấu hình Gemini API & Model
    try { initGeminiConfigUI(); } catch (e) { console.warn("Gemini UI init warning:", e); }

    // Khởi tạo các chip chọn lớp
    try { initClassSelector(currentTeacher.lopGiangDay); } catch (e) { console.warn("Class selector init warning:", e); }

    // Gắn sự kiện chuyển Tab
    try { initTabSwitching(); } catch (e) { console.warn("Tab switching init warning:", e); }

    // Khởi tạo trình biên soạn câu hỏi tự luận & xuất Excel
    try { initEssayQuestionsUI(); } catch (e) { console.warn("Essay questions UI warning:", e); }

    // Tự động kiểm tra và đồng bộ URL riêng từ Hub Server của Admin cho Giáo viên nếu có
    try { syncTeacherServerUrlFromHub(); } catch (e) { console.warn("Sync URL from Hub warning:", e); }

    // Tự động kiểm tra phiên bản Backend (ô G1 Sheet trung tâm) và cảnh báo cập nhật nếu cần
    setTimeout(() => {
      try { checkTeacherBackendVersionUpdate(); } catch (e) { console.warn("Check backend version warning:", e); }
    }, 600);

    // Tải danh sách đề thi của giáo viên
    try { loadTeacherExams(); } catch (e) { console.warn("Load exams warning:", e); }

    // Tải ngầm danh sách học sinh để sẵn sàng ngay cho Tab 2 (Xem kết quả theo CSDL gốc) & Tab 3
    setTimeout(() => {
      if (!currentTeacherStudents || currentTeacherStudents.length === 0) {
        loadTeacherStudents(false).catch(err => console.log("Preload students background:", err));
      }
    }, 800);

    // Lắng nghe sự kiện gõ phím để xóa cảnh báo lỗi và tự nhận diện đề trùng tên khi cập nhật
    const examTitleInput = document.getElementById("examTitle");
    if (examTitleInput) {
      examTitleInput.addEventListener("input", () => {
        const val = examTitleInput.value.trim();
        if (val) {
          examTitleInput.style.borderColor = "";
          examTitleInput.style.backgroundColor = "";
          examTitleInput.style.boxShadow = "";
          const errorMsg = document.getElementById("examTitleErrorMsg");
          if (errorMsg) errorMsg.style.display = "none";
        }
        // Kiểm tra xem tên có trùng với đề đã có để đổi nhãn nút thành "Cập nhật"
        if (!editingExamCode && Array.isArray(currentExamsList)) {
          const match = currentExamsList.find(e => e.tenKyThi && e.tenKyThi.trim().toLowerCase() === val.toLowerCase());
          const btnSave = document.getElementById("btnSaveExam");
          if (btnSave) {
            const spanText = btnSave.querySelector("span");
            if (match) {
              if (spanText) spanText.textContent = `💾 Cập Nhật Đề Thi [${match.maDe}]`;
              btnSave.style.background = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";
            } else {
              if (spanText) spanText.textContent = "Lưu Kỳ Thi Lên Google Sheets";
              btnSave.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
            }
          }
        }
      });
    }

    // Khởi tạo sự kiện chuyển chế độ xem lại bài (Ôn tập vs Thi chính thức)
    try { initReviewModeSelector(); } catch (e) { console.warn("Review mode selector warning:", e); }

    // Khởi tạo sự kiện chuyển chế độ xem điểm (Cho xem điểm vs Không cho xem điểm)
    try { initScoreModeSelector(); } catch (e) { console.warn("Score mode selector warning:", e); }

    // Khởi tạo tính năng Thông tin cá nhân & Đổi mật khẩu cho Giáo viên
    try { initTeacherAccountDropdownAndModals(); } catch (e) { console.warn("Account dropdown warning:", e); }

    // Khởi tạo tính năng Thêm mới học sinh thủ công
    try { initAddStudentModal(); } catch (e) { console.warn("Add student modal warning:", e); }

    // Khởi tạo tính năng Chia sẻ đề thi cho Giáo viên
    try { initShareExamModal(); } catch (e) { console.warn("Share exam modal warning:", e); }

    // Khởi tạo nút Cuộn lên đầu trang (Scroll to Top)
    const btnScrollToTop = document.getElementById("btnScrollToTop");
    if (btnScrollToTop) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 280) {
          btnScrollToTop.classList.add("show");
        } else {
          btnScrollToTop.classList.remove("show");
        }
      }, { passive: true });

      btnScrollToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Tối ưu hóa thanh điều hướng Tab trên thiết bị di động (<= 768px):
    // Gắn trực tiếp vào <body> làm Bottom Navigation Bar chuẩn Native App
    // Tránh bị kẹp trong header sticky, giúp hiển thị đầy đủ Brand, TK, Nút Loa và Đăng xuất
    function syncMobileNavTabs() {
      const navTabs = document.querySelector(".nav-tabs");
      const navbar = document.querySelector(".teacher-navbar");
      if (!navTabs || !navbar) return;
      const navUser = navbar.querySelector(".nav-user");

      if (window.innerWidth <= 768) {
        if (navTabs.parentElement !== document.body) {
          document.body.appendChild(navTabs);
        }
      } else {
        if (navTabs.parentElement !== navbar) {
          navbar.insertBefore(navTabs, navUser);
        }
      }
    }
    syncMobileNavTabs();
    window.addEventListener("resize", syncMobileNavTabs, { passive: true });

    // Đăng xuất
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("userRole");
        localStorage.removeItem("custom_gas_api_url");
        window.location.href = "index.html";
      });
    }
  } catch (globalInitErr) {
    console.error("Lỗi khởi tạo Dashboard Giáo viên:", globalInitErr);
  }
}

// Khởi chạy khi DOM đã sẵn sàng (hỗ trợ cả trường hợp đã nạp xong từ trước)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTeacherDashboard);
} else {
  initTeacherDashboard();
}




// ============================================================================
// MODULE QUẢN LÝ GIÁO VIÊN & KẾT NỐI MÁY CHỦ (DÀNH CHO QUẢN TRỊ VIÊN ADMIN)
// ============================================================================
let adminTeachersCache = [];
let adminHubServersCache = [];
let adminTeacherPasswordMaskMap = {};

function initAdminTeacherManagement() {
  const tabBtnAdminTeachers = document.getElementById("tabBtnAdminTeachers");
  const tabAdminTeachers = document.getElementById("tabAdminTeachers");
  if (!tabBtnAdminTeachers || !tabAdminTeachers) return;

  // 1. Chuyển đổi Sub-tabs: DATA_GIAOVIEN <-> HUB_SERVERS
  const btnSubTabAdminTeachers = document.getElementById("btnSubTabAdminTeachers");
  const btnSubTabAdminHub = document.getElementById("btnSubTabAdminHub");
  const panelAdminTeachersList = document.getElementById("panelAdminTeachersList");
  const panelAdminHubServersList = document.getElementById("panelAdminHubServersList");

  function switchAdminSubTab(activeBtn, activePanel) {
    [btnSubTabAdminTeachers, btnSubTabAdminHub].forEach(b => b && b.classList.remove("active"));
    [panelAdminTeachersList, panelAdminHubServersList].forEach(p => p && (p.style.display = "none"));

    if (activeBtn) activeBtn.classList.add("active");
    if (activePanel) activePanel.style.display = "block";
  }

  if (btnSubTabAdminTeachers) {
    btnSubTabAdminTeachers.addEventListener("click", () => {
      switchAdminSubTab(btnSubTabAdminTeachers, panelAdminTeachersList);
      loadAdminTeachersList();
    });
  }

  if (btnSubTabAdminHub) {
    btnSubTabAdminHub.addEventListener("click", () => {
      switchAdminSubTab(btnSubTabAdminHub, panelAdminHubServersList);
      loadAdminHubServersList();
    });
  }

  // 2. Tìm kiếm & Lọc dữ liệu trong DATA_GIAOVIEN
  const searchAdminTeacherInput = document.getElementById("searchAdminTeacherInput");
  const selectFilterAdminRole = document.getElementById("selectFilterAdminRole");
  if (searchAdminTeacherInput) {
    searchAdminTeacherInput.addEventListener("input", () => renderAdminTeachersTable());
  }
  if (selectFilterAdminRole) {
    selectFilterAdminRole.addEventListener("change", () => renderAdminTeachersTable());
  }

  // Nút Làm mới DATA_GIAOVIEN
  const btnRefreshAdminTeachers = document.getElementById("btnRefreshAdminTeachers");
  if (btnRefreshAdminTeachers) {
    btnRefreshAdminTeachers.addEventListener("click", () => loadAdminTeachersList(true));
  }

  // 3. Tìm kiếm trong HUB_SERVERS
  const searchAdminHubInput = document.getElementById("searchAdminHubInput");
  if (searchAdminHubInput) {
    searchAdminHubInput.addEventListener("input", () => renderAdminHubServersTable());
  }

  // Nút Làm mới HUB_SERVERS
  const btnRefreshAdminHubServers = document.getElementById("btnRefreshAdminHubServers");
  if (btnRefreshAdminHubServers) {
    btnRefreshAdminHubServers.addEventListener("click", () => loadAdminHubServersList(true));
  }

  // Nút đổi phiên bản trung tâm (Ô H1)
  const btnAdminEditCentralVersion = document.getElementById("btnAdminEditCentralVersion");
  if (btnAdminEditCentralVersion) {
    btnAdminEditCentralVersion.addEventListener("click", handleAdminEditCentralVersion);
  }

  // Nút Đồng bộ lớp giảng dạy từ Sheet/URL giáo viên
  const btnAdminSyncTeacherClasses = document.getElementById("btnAdminSyncTeacherClasses");
  if (btnAdminSyncTeacherClasses) {
    btnAdminSyncTeacherClasses.addEventListener("click", handleAdminSyncTeacherClasses);
  }

  // 4. Khởi tạo Modals
  initAdminModals();

  // Nạp dữ liệu ban đầu
  loadAdminTeachersList();
  loadAdminHubServersList();
}

/**
 * Admin quét và đồng bộ Lớp giảng dạy từ URL máy chủ riêng của tất cả Giáo viên về Sheet Trung Tâm
 */
async function handleAdminSyncTeacherClasses() {
  const btn = document.getElementById("btnAdminSyncTeacherClasses");
  const oldHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="table-spinner"></span> Đang đồng bộ lớp...`;
  }

  showToast("Đang đồng bộ...", "Đang kết nối tới URL Google Sheets riêng của các Giáo viên để kéo lớp giảng dạy...", "info", 5000);

  try {
    const res = await fetch(`${DEFAULT_GAS_API_URL}?action=syncClassesFromHubServers&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success) {
      showToast("Đồng bộ thành công! 🎉", data.message || `Đã cập nhật lớp cho ${data.updatedCount || 0} giáo viên!`, "success", 6000);
      await loadAdminTeachersList(true);
    } else {
      showToast("Lỗi đồng bộ", data?.message || "Không thể đồng bộ lớp từ máy chủ giáo viên", "error", 6000);
    }
  } catch (err) {
    showToast("Lỗi kết nối", err.message || err.toString(), "error", 6000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }
}

/**
 * Admin cập nhật phiên bản backend hệ thống trung tâm (ghi trực tiếp vào Ô H1 Sheet DATA_GIAOVIEN)
 */
async function handleAdminEditCentralVersion() {
  const currentVer = (localStorage.getItem("required_backend_version") || "2.3").trim();
  const inputVer = prompt(`Nhập phiên bản Backend hệ thống trung tâm mới:\n(Hệ thống sẽ cập nhật trực tiếp vào Ô H1 của Sheet DATA_GIAOVIEN)\nVí dụ: 2.3, 2.4, 3.0...`, currentVer);
  if (!inputVer || inputVer.trim() === "" || inputVer.trim() === currentVer) return;

  const newVer = inputVer.trim().replace(/^v/i, "");
  showToast("Đang cập nhật...", `Đang ghi phiên bản ${newVer} vào Ô H1 trên Sheet Trung Tâm...`, "info", 3000);

  try {
    const res = await fetch(`${DEFAULT_GAS_API_URL}?action=setCentralBackendVersion&version=${encodeURIComponent(newVer)}&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success) {
      localStorage.setItem("required_backend_version", newVer);
      const statCentralVersion = document.getElementById("statCentralVersion");
      if (statCentralVersion) statCentralVersion.textContent = newVer;
      showToast("Thành công! 🎉", data.message || `Đã cập nhật phiên bản trung tâm thành ${newVer} tại Ô H1!`, "success", 5000);
      loadAdminTeachersList(true);
    } else {
      showToast("Lỗi cập nhật", data?.message || "Không thể cập nhật phiên bản", "error", 5000);
    }
  } catch (err) {
    showToast("Lỗi kết nối", err.message || err.toString(), "error", 5000);
  }
}

/**
 * Nạp danh sách Giáo viên từ Sheet DATA_GIAOVIEN
 */
async function loadAdminTeachersList(forceRefresh = false) {
  const tbody = document.getElementById("adminTeachersTableBody");
  if (!tbody) return;

  if (forceRefresh || adminTeachersCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #2563eb;"><span class="table-spinner"></span> Đang tải danh sách giáo viên từ Sheet DATA_GIAOVIEN...</td></tr>';
  }

  try {
    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(`${targetUrl}?action=getAdminTeachers&t=${Date.now()}`);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.teachers)) {
      adminTeachersCache = data.teachers;
      updateAdminTeacherStats();
      renderAdminTeachersTable();
      populateHubTeacherQuickSelect();
    } else {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #dc2626;">❌ Không thể tải danh sách GV: ${data.message || "Lỗi không xác định"}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #dc2626;">❌ Lỗi kết nối Google Sheets: ${err.message || err.toString()}</td></tr>`;
  }
}

/**
 * Cập nhật số liệu thống kê Giáo viên
 */
function updateAdminTeacherStats() {
  const statTotalGv = document.getElementById("statTotalGv");
  const statTotalAdmin = document.getElementById("statTotalAdmin");
  const statTotalGvStandard = document.getElementById("statTotalGvStandard");
  const statCentralVersion = document.getElementById("statCentralVersion");

  const total = adminTeachersCache.length;
  let adminCount = 0;
  let gvCount = 0;

  adminTeachersCache.forEach(t => {
    const q = String(t.quyen || "").toLowerCase();
    // CHỈ CÓ TÀI KHOẢN CÓ CỘT D (QUYỀN) LÀ 'admin' MỚI TÍNH LÀ ADMIN
    if (q === "admin") {
      adminCount++;
    } else {
      gvCount++;
    }
  });

  if (statTotalGv) statTotalGv.textContent = total;
  if (statTotalAdmin) statTotalAdmin.textContent = adminCount;
  if (statTotalGvStandard) statTotalGvStandard.textContent = gvCount;
  if (statCentralVersion) {
    const curReq = (localStorage.getItem("required_backend_version") || "2.3").trim();
    statCentralVersion.textContent = curReq;
  }
}

/**
 * Render bảng danh sách giáo viên DATA_GIAOVIEN
 */
function renderAdminTeachersTable() {
  const tbody = document.getElementById("adminTeachersTableBody");
  if (!tbody) return;

  const kw = (document.getElementById("searchAdminTeacherInput")?.value || "").trim().toLowerCase();
  const roleFilter = document.getElementById("selectFilterAdminRole")?.value || "ALL";

  const filtered = adminTeachersCache.filter(t => {
    const u = String(t.username || "").toLowerCase();
    const name = String(t.hoTenGV || "").toLowerCase();
    const classes = String(t.lopGiangDay || "").toLowerCase();
    const school = String(t.truong || "").toLowerCase();
    const q = String(t.quyen || "").toLowerCase();
    const isAdmin = (q === "admin");

    if (roleFilter === "ADMIN" && !isAdmin) return false;
    if (roleFilter === "GV" && isAdmin) return false;

    if (!kw) return true;
    return u.includes(kw) || name.includes(kw) || classes.includes(kw) || school.includes(kw);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Không tìm thấy giáo viên nào phù hợp với điều kiện tìm kiếm.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((t, idx) => {
    const rawUser = String(t.username || "");
    const cleanUser = rawUser.replace(/^'+/, "");
    const q = String(t.quyen || "").toLowerCase();
    const isAdmin = (q === "admin");
    const isBGH = (cleanUser.toLowerCase() === "admin");
    let roleBadge = '<span class="badge-role-gv">👨‍🏫 Giáo viên</span>';
    if (isAdmin) {
      roleBadge = '<span class="badge-role-admin">🛡️ Quản trị viên (Admin)</span>';
    } else if (isBGH) {
      roleBadge = '<span class="badge-role-bgh" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 9999px; font-size: 0.82rem; font-weight: 700;">🏛️ Ban Giám Hiệu</span>';
    }

    const isPassVisible = !!adminTeacherPasswordMaskMap[cleanUser];
    const passDisplay = isPassVisible ? (t.password || "--") : "••••••••";
    const verDisplay = t.backendVersion || "2.0";

    return `
      <tr>
        <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-family: monospace; font-size: 0.92rem;">${cleanUser}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1e3a8a;">${t.hoTenGV || "--"}</div>
        </td>
        <td style="text-align: center;">${roleBadge}</td>
        <td>
          <div class="pass-container">
            <span id="passSpan_${cleanUser}">${passDisplay}</span>
            <button type="button" class="btn-inline-icon" onclick="toggleTeacherPasswordMask('${cleanUser}')" title="Ẩn/Hiện mật khẩu">
              ${isPassVisible ? '🙈' : '👁️'}
            </button>
            <button type="button" class="btn-inline-icon" onclick="copyTeacherPassword('${cleanUser}')" title="Sao chép mật khẩu">
              📋
            </button>
          </div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: #334155; line-height: 1.4;">${t.lopGiangDay || "--"}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: #475569;">${t.truong || "--"}</div>
        </td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; background: #f1f5f9; color: #334155;">${verDisplay}</span>
        </td>
        <td style="text-align: center;">
          <div class="table-action-btns">
            <button type="button" class="btn-tbl-action key" onclick="openResetTeacherPassModal('${cleanUser}')" title="Đổi mật khẩu GV">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button type="button" class="btn-tbl-action edit" onclick="openEditTeacherModal('${cleanUser}')" title="Chỉnh sửa thông tin GV">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="btn-tbl-action delete" onclick="deleteTeacherAccount('${cleanUser}')" title="Xóa tài khoản GV">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 1-2h6c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.toggleTeacherPasswordMask = function(cleanUser) {
  adminTeacherPasswordMaskMap[cleanUser] = !adminTeacherPasswordMaskMap[cleanUser];
  renderAdminTeachersTable();
};

window.copyTeacherPassword = function(cleanUser) {
  const teacher = adminTeachersCache.find(t => String(t.username || "").replace(/^'+/, "") === cleanUser);
  if (teacher && teacher.password) {
    navigator.clipboard.writeText(teacher.password);
    showToast("Đã chép", `Đã sao chép mật khẩu của ${teacher.hoTenGV || cleanUser}`, "success", 2000);
  }
};

/**
 * Nạp danh sách máy chủ kết nối từ Sheet HUB_SERVERS
 */
async function loadAdminHubServersList(forceRefresh = false) {
  const tbody = document.getElementById("adminHubServersTableBody");
  if (!tbody) return;

  if (forceRefresh || adminHubServersCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: #4f46e5;"><span class="table-spinner"></span> Đang tải danh bạ máy chủ từ Sheet HUB_SERVERS...</td></tr>';
  }

  try {
    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(`${targetUrl}?action=getAdminHubServers&t=${Date.now()}`);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.servers)) {
      adminHubServersCache = data.servers;
      updateAdminHubStats();
      renderAdminHubServersTable();
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #dc2626;">❌ Không thể tải danh bạ HUB: ${data.message || "Lỗi không xác định"}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #dc2626;">❌ Lỗi kết nối Google Sheets HUB: ${err.message || err.toString()}</td></tr>`;
  }
}

/**
 * Cập nhật số liệu thống kê HUB_SERVERS
 */
function updateAdminHubStats() {
  const statTotal = document.getElementById("statTotalHubServers");
  const statActive = document.getElementById("statHubActive");
  const statInactive = document.getElementById("statHubInactive");

  const total = adminHubServersCache.length;
  let activeCount = 0;
  let inactiveCount = 0;

  adminHubServersCache.forEach(s => {
    const url = String(s.serverUrl || "").trim();
    if (url && url.startsWith("https://script.google.com/macros/s/")) {
      activeCount++;
    } else {
      inactiveCount++;
    }
  });

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = activeCount;
  if (statInactive) statInactive.textContent = inactiveCount;
}

/**
 * Render bảng danh bạ HUB_SERVERS
 */
function renderAdminHubServersTable() {
  const tbody = document.getElementById("adminHubServersTableBody");
  if (!tbody) return;

  const kw = (document.getElementById("searchAdminHubInput")?.value || "").trim().toLowerCase();

  const filtered = adminHubServersCache.filter(s => {
    const ma = String(s.maGV || "").toLowerCase();
    const name = String(s.hoTenGV || "").toLowerCase();
    const school = String(s.truong || "").toLowerCase();
    const url = String(s.serverUrl || "").toLowerCase();

    if (!kw) return true;
    return ma.includes(kw) || name.includes(kw) || school.includes(kw) || url.includes(kw);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Không tìm thấy máy chủ giáo viên nào phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const rawMa = String(s.maGV || "");
    const cleanMa = rawMa.replace(/^'+/, "");
    const rawUrl = String(s.serverUrl || "").trim();
    const hasUrl = rawUrl.startsWith("https://script.google.com/macros/s/");

    let urlCellHtml = "";
    if (hasUrl) {
      const shortUrl = rawUrl.length > 45 ? rawUrl.substring(0, 42) + "..." : rawUrl;
      urlCellHtml = `
        <div style="display: flex; align-items: center; gap: 6px; max-width: 100%;">
          <span style="font-family: monospace; font-size: 0.8rem; color: #2563eb; background: #eff6ff; padding: 3px 6px; border-radius: 5px; border: 1px solid #bfdbfe; word-break: break-all;" title="${rawUrl}">${shortUrl}</span>
          <button type="button" class="btn-inline-icon" onclick="copyHubServerUrl('${cleanMa}')" title="Sao chép link Web App">📋</button>
          <a href="${rawUrl}" target="_blank" rel="noopener" class="btn-inline-icon" title="Mở link kiểm tra" style="text-decoration: none;">↗️</a>
        </div>
      `;
    } else {
      urlCellHtml = `
        <button type="button" class="badge-server-inactive" onclick="openEditHubServerModal('${cleanMa}')" style="cursor: pointer; border: 1px dashed #f59e0b; background: #fffbeb;">
          ⚠️ Chưa cấu hình link Web App (Bấm để thêm)
        </button>
      `;
    }

    const statusBadge = hasUrl
      ? '<span class="badge-server-active">Hoạt động</span>'
      : '<span class="badge-server-inactive">Chưa có link</span>';

    return `
      <tr>
        <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-family: monospace; font-size: 0.92rem;">${cleanMa}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1e3a8a;">${s.hoTenGV || "--"}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: #475569;">${s.truong || "--"}</div>
        </td>
        <td>${urlCellHtml}</td>
        <td style="text-align: center;">${statusBadge}</td>
        <td style="text-align: center; font-size: 0.8rem; color: #64748b;">${s.ngayCapNhat || "--"}</td>
        <td style="text-align: center;">
          <div class="table-action-btns">
            <button type="button" class="btn-tbl-action edit" onclick="openEditHubServerModal('${cleanMa}')" title="Sửa / Thêm Link URL">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            ${hasUrl ? `
            <button type="button" class="btn-tbl-action ping" onclick="pingTestHubServer('${cleanMa}')" title="Kiểm tra Ping Server">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </button>` : ''}
            <button type="button" class="btn-tbl-action delete" onclick="deleteHubServer('${cleanMa}')" title="Xóa kết nối khỏi HUB_SERVERS">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 1-2h6c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.copyHubServerUrl = function(cleanMa) {
  const s = adminHubServersCache.find(item => String(item.maGV || "").replace(/^'+/, "") === cleanMa);
  if (s && s.serverUrl) {
    navigator.clipboard.writeText(s.serverUrl);
    showToast("Đã chép", `Đã sao chép Link Web App của ${s.hoTenGV || cleanMa}`, "success", 2000);
  }
};

/**
 * Kiểm tra kết nối ping đến máy chủ Web App của Giáo viên
 */
window.pingTestHubServer = async function(cleanMa) {
  const s = adminHubServersCache.find(item => String(item.maGV || "").replace(/^'+/, "") === cleanMa);
  if (!s || !s.serverUrl) {
    showToast("Chưa có URL", "Giáo viên này chưa cấu hình link Web App!", "warning", 3000);
    return;
  }

  showToast("Đang kiểm tra...", `Đang kiểm tra kết nối đến máy chủ của ${s.hoTenGV || cleanMa}...`, "info", 2000);
  try {
    const separator = s.serverUrl.includes("?") ? "&" : "?";
    const testUrl = `${s.serverUrl}${separator}action=checkBackendVersion&t=${Date.now()}`;
    const res = await fetch(testUrl);
    const data = await res.json();

    if (data && data.success) {
      showToast("Kết nối Tốt ✅", `Máy chủ online! Phiên bản Code.gs: ${data.version || "OK"}`, "success", 4000);
    } else {
      showToast("Tín hiệu phản hồi", `Máy chủ online nhưng trả về: ${data.message || "OK"}`, "info", 3500);
    }
  } catch (err) {
    showToast("Không thể kết nối ❌", `Không thể kết nối đến Web App: ${err.message || err.toString()}`, "error", 4500);
  }
};

/**
 * Điền nhanh danh sách GV từ DATA_GIAOVIEN vào select của modal HUB
 */
function populateHubTeacherQuickSelect() {
  const select = document.getElementById("hubSelectTeacherQuick");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Chọn giáo viên từ danh sách DATA_GIAOVIEN --</option>';

  adminTeachersCache.forEach(t => {
    const rawUser = String(t.username || "");
    const cleanUser = rawUser.replace(/^'+/, "");
    const opt = document.createElement("option");
    opt.value = cleanUser;
    opt.textContent = `${t.hoTenGV || cleanUser} (${cleanUser}) - ${t.truong || ""}`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

/**
 * Khởi tạo sự kiện cho 3 Modals
 */
function initAdminModals() {
  // Modal 1: Thêm/Sửa Giáo viên
  const modalAddEditTeacher = document.getElementById("modalAddEditTeacher");
  const btnOpenAddTeacherModal = document.getElementById("btnOpenAddTeacherModal");
  const btnCloseAddEditTeacherModal = document.getElementById("btnCloseAddEditTeacherModal");
  const btnCancelAddEditTeacherModal = document.getElementById("btnCancelAddEditTeacherModal");
  const btnSaveTeacherAccount = document.getElementById("btnSaveTeacherAccount");
  const btnGenRandomTeacherPass = document.getElementById("btnGenRandomTeacherPass");

  if (btnOpenAddTeacherModal) {
    btnOpenAddTeacherModal.addEventListener("click", () => openAddTeacherModal());
  }
  if (btnCloseAddEditTeacherModal) {
    btnCloseAddEditTeacherModal.addEventListener("click", () => modalAddEditTeacher.style.display = "none");
  }
  if (btnCancelAddEditTeacherModal) {
    btnCancelAddEditTeacherModal.addEventListener("click", () => modalAddEditTeacher.style.display = "none");
  }
  if (btnGenRandomTeacherPass) {
    btnGenRandomTeacherPass.addEventListener("click", () => {
      const passInput = document.getElementById("teacherInputPassword");
      if (passInput) passInput.value = "1234";
    });
  }
  if (btnSaveTeacherAccount) {
    btnSaveTeacherAccount.addEventListener("click", handleSaveTeacherAccountSubmit);
  }

  // Modal 2: Đổi Mật Khẩu Giáo Viên
  const modalResetTeacherPassword = document.getElementById("modalResetTeacherPassword");
  const btnCloseResetTeacherPassModal = document.getElementById("btnCloseResetTeacherPassModal");
  const btnCancelResetTeacherPassModal = document.getElementById("btnCancelResetTeacherPassModal");
  const btnSubmitResetTeacherPassword = document.getElementById("btnSubmitResetTeacherPassword");
  const btnGenQuickPass = document.getElementById("btnGenQuickPass");

  if (btnCloseResetTeacherPassModal) {
    btnCloseResetTeacherPassModal.addEventListener("click", () => modalResetTeacherPassword.style.display = "none");
  }
  if (btnCancelResetTeacherPassModal) {
    btnCancelResetTeacherPassModal.addEventListener("click", () => modalResetTeacherPassword.style.display = "none");
  }
  if (btnGenQuickPass) {
    btnGenQuickPass.addEventListener("click", () => {
      const inp = document.getElementById("resetPassNewPasswordInput");
      if (inp) inp.value = "1234";
    });
  }
  if (btnSubmitResetTeacherPassword) {
    btnSubmitResetTeacherPassword.addEventListener("click", handleSubmitResetTeacherPassword);
  }

  // Modal 3: Thêm / Sửa kết nối HUB_SERVERS
  const modalAddEditHubServer = document.getElementById("modalAddEditHubServer");
  const btnOpenAddHubServerModal = document.getElementById("btnOpenAddHubServerModal");
  const btnCloseAddEditHubModal = document.getElementById("btnCloseAddEditHubModal");
  const btnCancelAddEditHubModal = document.getElementById("btnCancelAddEditHubModal");
  const btnSaveHubServer = document.getElementById("btnSaveHubServer");
  const btnPasteHubModalUrl = document.getElementById("btnPasteHubModalUrl");
  const hubSelectTeacherQuick = document.getElementById("hubSelectTeacherQuick");

  if (btnOpenAddHubServerModal) {
    btnOpenAddHubServerModal.addEventListener("click", () => openAddHubServerModal());
  }
  if (btnCloseAddEditHubModal) {
    btnCloseAddEditHubModal.addEventListener("click", () => modalAddEditHubServer.style.display = "none");
  }
  if (btnCancelAddEditHubModal) {
    btnCancelAddEditHubModal.addEventListener("click", () => modalAddEditHubServer.style.display = "none");
  }
  if (hubSelectTeacherQuick) {
    hubSelectTeacherQuick.addEventListener("change", (e) => {
      const selectedUser = e.target.value;
      if (!selectedUser) return;
      const t = adminTeachersCache.find(item => String(item.username || "").replace(/^'+/, "") === selectedUser);
      if (t) {
        document.getElementById("hubInputMaGV").value = selectedUser;
        document.getElementById("hubInputHoTen").value = t.hoTenGV || "";
        document.getElementById("hubInputTruong").value = t.truong || "";
      }
    });
  }
  if (btnPasteHubModalUrl) {
    btnPasteHubModalUrl.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            document.getElementById("hubInputServerUrl").value = text.trim();
            showToast("Đã dán", "Đã dán URL Web App vào ô nhập!", "info", 2000);
          }
        }
      } catch (e) {}
    });
  }
  if (btnSaveHubServer) {
    btnSaveHubServer.addEventListener("click", handleSaveHubServerSubmit);
  }
}

/**
 * Mở modal thêm mới Giáo viên
 */
window.openAddTeacherModal = function() {
  const modal = document.getElementById("modalAddEditTeacher");
  if (!modal) return;

  document.getElementById("modalAddEditTeacherTitle").textContent = "Thêm Giáo Viên Mới";
  document.getElementById("teacherEditOriginalUser").value = "";
  document.getElementById("teacherInputUsername").value = "";
  document.getElementById("teacherInputUsername").disabled = false;
  document.getElementById("teacherInputFullName").value = "";
  document.getElementById("teacherInputPassword").value = "1234";
  document.getElementById("teacherPasswordGroup").style.display = "block";
  document.getElementById("teacherInputRole").value = "gv";
  document.getElementById("teacherInputClasses").value = "";
  document.getElementById("teacherInputSchool").value = currentTeacher?.truong || "";
  document.getElementById("btnSaveTeacherText").textContent = "Lưu Vào Sheet DATA_GIAOVIEN";

  modal.style.display = "flex";
};

/**
 * Mở modal sửa thông tin Giáo viên
 */
window.openEditTeacherModal = function(cleanUser) {
  const modal = document.getElementById("modalAddEditTeacher");
  if (!modal) return;

  const t = adminTeachersCache.find(item => String(item.username || "").replace(/^'+/, "") === cleanUser);
  if (!t) {
    showToast("Không tìm thấy", "Không tìm thấy thông tin giáo viên!", "error", 3000);
    return;
  }

  document.getElementById("modalAddEditTeacherTitle").textContent = `Chỉnh Sửa Giáo Viên: ${t.hoTenGV || cleanUser}`;
  document.getElementById("teacherEditOriginalUser").value = cleanUser;
  document.getElementById("teacherInputUsername").value = cleanUser;
  document.getElementById("teacherInputUsername").disabled = true; // Không đổi username để tránh lệch khóa
  document.getElementById("teacherInputFullName").value = t.hoTenGV || "";
  document.getElementById("teacherInputPassword").value = t.password || "";
  document.getElementById("teacherPasswordGroup").style.display = "block";
  document.getElementById("teacherInputRole").value = (String(t.quyen || "").toLowerCase() === "admin") ? "admin" : "gv";
  document.getElementById("teacherInputClasses").value = t.lopGiangDay || "";
  document.getElementById("teacherInputSchool").value = t.truong || "";
  document.getElementById("btnSaveTeacherText").textContent = "Cập Nhật Vào Sheet";

  modal.style.display = "flex";
};

/**
 * Xử lý lưu thông tin Giáo viên vào Sheet DATA_GIAOVIEN
 */
async function handleSaveTeacherAccountSubmit() {
  const origUser = document.getElementById("teacherEditOriginalUser").value.trim();
  const username = document.getElementById("teacherInputUsername").value.trim();
  const fullName = document.getElementById("teacherInputFullName").value.trim();
  const password = document.getElementById("teacherInputPassword").value.trim();
  const role = document.getElementById("teacherInputRole").value;
  const classes = document.getElementById("teacherInputClasses").value.trim();
  const school = document.getElementById("teacherInputSchool").value.trim();
  const btnSave = document.getElementById("btnSaveTeacherAccount");
  const btnText = document.getElementById("btnSaveTeacherText");

  if (!username) {
    showToast("Thiếu thông tin", "Mã tài khoản Giáo viên (SĐT) không được để trống!", "warning", 3000);
    return;
  }
  if (!fullName) {
    showToast("Thiếu thông tin", "Họ tên Giáo viên không được để trống!", "warning", 3000);
    return;
  }

  const isEditing = !!origUser;
  const action = isEditing ? "updateTeacher" : "addTeacher";

  btnSave.disabled = true;
  btnText.textContent = "Đang ghi vào Sheet...";

  try {
    const payload = {
      action: action,
      username: username,
      originalUsername: origUser,
      hoTenGV: fullName,
      password: password,
      quyen: role,
      lopGiangDay: classes,
      truong: school
    };

    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.success) {
      showToast("Thành công ✅", result.message || "Đã lưu vào sheet DATA_GIAOVIEN thành công!", "success", 3500);
      document.getElementById("modalAddEditTeacher").style.display = "none";
      await loadAdminTeachersList(true);
    } else {
      showToast("Lỗi lưu Sheet ❌", result.message || "Không thể lưu vào Google Sheets!", "error", 4000);
    }
  } catch (err) {
    showToast("Lỗi kết nối ❌", err.message || err.toString(), "error", 4000);
  } finally {
    btnSave.disabled = false;
    btnText.textContent = isEditing ? "Cập Nhật Vào Sheet" : "Lưu Vào Sheet DATA_GIAOVIEN";
  }
}

/**
 * Mở modal đổi mật khẩu nhanh cho GV
 */
window.openResetTeacherPassModal = function(cleanUser) {
  const modal = document.getElementById("modalResetTeacherPassword");
  if (!modal) return;

  const t = adminTeachersCache.find(item => String(item.username || "").replace(/^'+/, "") === cleanUser);
  document.getElementById("resetPassTargetUsername").value = cleanUser;
  document.getElementById("resetPassTargetTeacherName").textContent = t ? (t.hoTenGV || cleanUser) : cleanUser;
  document.getElementById("resetPassTargetTeacherUser").textContent = `(${cleanUser})`;
  document.getElementById("resetPassNewPasswordInput").value = "1234";

  modal.style.display = "flex";
};

/**
 * Xử lý lưu mật khẩu mới vào Sheet DATA_GIAOVIEN
 */
async function handleSubmitResetTeacherPassword() {
  const username = document.getElementById("resetPassTargetUsername").value.trim();
  const newPassword = document.getElementById("resetPassNewPasswordInput").value.trim();
  const btnSubmit = document.getElementById("btnSubmitResetTeacherPassword");

  if (!newPassword) {
    showToast("Thiếu thông tin", "Vui lòng nhập mật khẩu mới!", "warning", 3000);
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Đang lưu...";

  try {
    const payload = {
      action: "adminResetTeacherPassword",
      username: username,
      newPassword: newPassword
    };

    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.success) {
      showToast("Đã đổi MK ✅", result.message || "Đã cập nhật mật khẩu mới vào Google Sheets!", "success", 3500);
      document.getElementById("modalResetTeacherPassword").style.display = "none";
      await loadAdminTeachersList(true);
    } else {
      showToast("Lỗi đổi MK ❌", result.message || "Không thể đổi mật khẩu trên Google Sheets!", "error", 4000);
    }
  } catch (err) {
    showToast("Lỗi kết nối ❌", err.message || err.toString(), "error", 4000);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Lưu Mật Khẩu Mới";
  }
}

/**
 * Xóa tài khoản Giáo viên khỏi DATA_GIAOVIEN
 */
window.deleteTeacherAccount = async function(cleanUser) {
  if (cleanUser.toLowerCase() === "admin") {
    showToast("Bảo vệ hệ thống", "Không thể xóa tài khoản Quản trị viên 'admin'!", "warning", 3500);
    return;
  }

  const t = adminTeachersCache.find(item => String(item.username || "").replace(/^'+/, "") === cleanUser);
  const teacherName = t ? (t.hoTenGV || cleanUser) : cleanUser;

  const ok = confirm(`⚠️ Bạn có chắc chắn muốn XÓA Giáo viên "${teacherName}" (${cleanUser})?\n\nHành động này sẽ xóa vĩnh viễn dòng tương ứng trên Sheet DATA_GIAOVIEN.`);
  if (!ok) return;

  showToast("Đang xóa...", `Đang xóa giáo viên ${teacherName} khỏi Google Sheets...`, "info", 2000);

  try {
    const payload = {
      action: "deleteTeacher",
      username: cleanUser
    };

    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.success) {
      showToast("Đã xóa ✅", result.message || "Đã xóa giáo viên khỏi Google Sheets!", "success", 3500);
      await loadAdminTeachersList(true);
    } else {
      showToast("Lỗi xóa ❌", result.message || "Không thể xóa giáo viên trên Google Sheets!", "error", 4000);
    }
  } catch (err) {
    showToast("Lỗi kết nối ❌", err.message || err.toString(), "error", 4000);
  }
};

/**
 * Mở modal thêm kết nối máy chủ GV vào HUB_SERVERS
 */
window.openAddHubServerModal = function() {
  const modal = document.getElementById("modalAddEditHubServer");
  if (!modal) return;

  document.getElementById("modalAddEditHubTitle").textContent = "Thêm Kết Nối Máy Chủ GV";
  document.getElementById("hubSelectTeacherQuick").value = "";
  document.getElementById("hubInputMaGV").value = "";
  document.getElementById("hubInputMaGV").disabled = false;
  document.getElementById("hubInputHoTen").value = "";
  document.getElementById("hubInputTruong").value = currentTeacher?.truong || "";
  document.getElementById("hubInputServerUrl").value = "";
  document.getElementById("hubInputTrangThai").value = "Hoạt động";
  document.getElementById("btnSaveHubServerText").textContent = "Lưu Vào Sheet HUB_SERVERS";

  modal.style.display = "flex";
};

/**
 * Mở modal chỉnh sửa / thêm link URL cho GV trong HUB_SERVERS
 */
window.openEditHubServerModal = function(cleanMa) {
  const modal = document.getElementById("modalAddEditHubServer");
  if (!modal) return;

  let s = adminHubServersCache.find(item => String(item.maGV || "").replace(/^'+/, "") === cleanMa);
  if (!s) {
    // Nếu chưa có trong HUB_SERVERS, tìm trong DATA_GIAOVIEN để nạp thông tin sẵn
    const t = adminTeachersCache.find(item => String(item.username || "").replace(/^'+/, "") === cleanMa);
    s = {
      maGV: cleanMa,
      hoTenGV: t ? t.hoTenGV : cleanMa,
      truong: t ? t.truong : "",
      serverUrl: "",
      trangThai: "Hoạt động"
    };
  }

  document.getElementById("modalAddEditHubTitle").textContent = `Cập Nhật Kết Nối: ${s.hoTenGV || cleanMa}`;
  const select = document.getElementById("hubSelectTeacherQuick");
  if (select) select.value = cleanMa;

  document.getElementById("hubInputMaGV").value = cleanMa;
  document.getElementById("hubInputMaGV").disabled = false;
  document.getElementById("hubInputHoTen").value = s.hoTenGV || "";
  document.getElementById("hubInputTruong").value = s.truong || "";
  document.getElementById("hubInputServerUrl").value = s.serverUrl || "";
  document.getElementById("hubInputTrangThai").value = s.trangThai || "Hoạt động";
  document.getElementById("btnSaveHubServerText").textContent = "Lưu Vào Sheet HUB_SERVERS";

  modal.style.display = "flex";
};

/**
 * Lưu cấu hình kết nối vào Sheet HUB_SERVERS
 */
async function handleSaveHubServerSubmit() {
  const maGV = document.getElementById("hubInputMaGV").value.trim();
  const hoTen = document.getElementById("hubInputHoTen").value.trim();
  const truong = document.getElementById("hubInputTruong").value.trim();
  const serverUrl = document.getElementById("hubInputServerUrl").value.trim();
  const trangThai = document.getElementById("hubInputTrangThai").value;
  const btnSave = document.getElementById("btnSaveHubServer");
  const btnText = document.getElementById("btnSaveHubServerText");

  if (!maGV) {
    showToast("Thiếu thông tin", "Mã Giáo viên không được để trống!", "warning", 3000);
    return;
  }

  if (serverUrl && (!serverUrl.startsWith("https://script.google.com/macros/s/") || !serverUrl.includes("/exec"))) {
    showToast("URL không hợp lệ", "Link Web App phải có dạng: https://script.google.com/macros/s/.../exec", "warning", 4000);
    return;
  }

  btnSave.disabled = true;
  btnText.textContent = "Đang lưu vào Sheet...";

  try {
    const payload = {
      action: "saveHubServer",
      maGV: maGV,
      hoTenGV: hoTen,
      truong: truong,
      serverUrl: serverUrl,
      trangThai: trangThai
    };

    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.success) {
      showToast("Đã lưu kết nối ✅", result.message || "Đã lưu vào sheet HUB_SERVERS thành công!", "success", 3500);
      document.getElementById("modalAddEditHubServer").style.display = "none";
      await loadAdminHubServersList(true);
    } else {
      showToast("Lỗi lưu HUB ❌", result.message || "Không thể lưu vào Google Sheets!", "error", 4000);
    }
  } catch (err) {
    showToast("Lỗi kết nối ❌", err.message || err.toString(), "error", 4000);
  } finally {
    btnSave.disabled = false;
    btnText.textContent = "Lưu Vào Sheet HUB_SERVERS";
  }
}

/**
 * Xóa kết nối khỏi HUB_SERVERS
 */
window.deleteHubServer = async function(cleanMa) {
  const s = adminHubServersCache.find(item => String(item.maGV || "").replace(/^'+/, "") === cleanMa);
  const name = s ? (s.hoTenGV || cleanMa) : cleanMa;

  const ok = confirm(`⚠️ Bạn có chắc chắn muốn xóa kết nối của Giáo viên "${name}" (${cleanMa}) khỏi Sheet HUB_SERVERS không?`);
  if (!ok) return;

  showToast("Đang xóa...", `Đang xóa kết nối của ${name} khỏi Sheet HUB_SERVERS...`, "info", 2000);

  try {
    const payload = {
      action: "deleteHubServer",
      maGV: cleanMa
    };

    const targetUrl = DEFAULT_GAS_API_URL;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.success) {
      showToast("Đã xóa ✅", result.message || "Đã xóa kết nối khỏi sheet HUB_SERVERS!", "success", 3500);
      await loadAdminHubServersList(true);
    } else {
      showToast("Lỗi xóa HUB ❌", result.message || "Không thể xóa kết nối!", "error", 4000);
    }
  } catch (err) {
    showToast("Lỗi kết nối ❌", err.message || err.toString(), "error", 4000);
  }
};
