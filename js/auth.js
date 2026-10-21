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
 * ============================================================================
 * AUTHENTICATION LOGIC - HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN
 * ============================================================================
 */

// 1. CẤU HÌNH API GOOGLE APPS SCRIPT
// URL Web App mặc định của hệ thống
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbw0WKZ9KjlMud7nEof6Kwqe6XYDRDeht4gHWVH_WsS2h48j_dzSvriiT9I4RT9t6zIG/exec";

// Lấy URL máy chủ đang kích hoạt (Hỗ trợ Chọn Giáo Viên, Trạm Trung Tâm & Link phòng thi)
function getActiveApiUrl(role = "HS") {
  const urlParams = new URLSearchParams(window.location.search);
  const serverParam = (urlParams.get("server") || "").trim();
  if (serverParam.startsWith("https://script.google.com/macros/s/") && serverParam.includes("/exec")) {
    return serverParam;
  }

  if (role === "GV") {
    // NGUYÊN LÝ CHUẨN: Đăng nhập Giáo viên luôn kết nối về Web App của Sheet Admin (DEFAULT_GAS_API_URL)
    // để xác thực tài khoản tập trung trên sheet DATA_GIAOVIEN và tra cứu server riêng từ HUB_SERVERS
    return DEFAULT_GAS_API_URL;
  } else {
    // Với học sinh: Ưu tiên Giáo viên mà học sinh chọn trên màn hình đăng nhập
    const selectTeacher = document.getElementById("selectTeacherServer");
    const chosenServer = selectTeacher ? (selectTeacher.value || "").trim() : "";
    if (chosenServer.startsWith("https://script.google.com/macros/s/") && chosenServer.includes("/exec")) {
      return chosenServer;
    }

    // Với học sinh: Nếu không chọn phòng thi cụ thể từ dropdown, luôn kết nối Trạm Trung Tâm (Central Hub) để tra cứu
    return DEFAULT_GAS_API_URL;
  }

  return DEFAULT_GAS_API_URL;
}

// Biến API_URL động theo cấu hình
let API_URL = getActiveApiUrl();

// Dữ liệu tài khoản giả lập để test giao diện khi chưa gắn API Google Apps Script
const MOCK_ACCOUNTS = {
  HS: [
    { username: "HS001", password: "123", hoTen: "Nguyễn Văn An", lop: "9A1", ngaySinh: "15/05/2010", gioiTinh: "Nam", truong: "THCS Chu Văn An" },
    { username: "HS002", password: "123", hoTen: "Trần Thị Mai", lop: "9A2", ngaySinh: "20/08/2010", gioiTinh: "Nữ", truong: "THCS Chu Văn An" }
  ],
  GV: [
    { username: "GV001", password: "123", hoTenGV: "Thầy Lê Hoàng Nam", lopGiangDay: "9A1, 9A2", truong: "THCS Chu Văn An" }
  ]
};

// 2. DOM ELEMENTS
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const usernameLabel = document.getElementById("usernameLabel");
const authSubtitle = document.getElementById("authSubtitle");
const btnLogin = document.getElementById("btnLogin");
const btnTogglePassword = document.getElementById("btnTogglePassword");
const eyeIconOpen = document.getElementById("eyeIconOpen");
const eyeIconClosed = document.getElementById("eyeIconClosed");
const toastContainer = document.getElementById("toast-container");
const roleRadios = document.querySelectorAll('input[name="userRole"]');

const loginAlertBox = document.getElementById("loginAlertBox");
const loginAlertText = document.getElementById("loginAlertText");

function showLoginAlert(msg) {
  if (!loginAlertBox) return;
  if (loginAlertText) loginAlertText.textContent = msg;
  loginAlertBox.style.display = "block";
  // Kích hoạt lại animation rung
  loginAlertBox.style.animation = "none";
  void loginAlertBox.offsetWidth;
  loginAlertBox.style.animation = "alertShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both";
}

function hideLoginAlert() {
  if (loginAlertBox) loginAlertBox.style.display = "none";
}

// Ẩn thông báo lỗi khi người dùng gõ lại
usernameInput.addEventListener("input", hideLoginAlert);
passwordInput.addEventListener("input", hideLoginAlert);

// 3. TOAST NOTIFICATION UTILITY
function showToast(title, message, type = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="9" y2="15"/></svg>`;
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

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// 4. ROLE SWITCHING INTERACTION
function getSelectedRole() {
  const selected = document.querySelector('input[name="userRole"]:checked');
  return selected ? selected.value : "HS";
}

roleRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const role = e.target.value;
    document.body.setAttribute("data-role", role);
    hideLoginAlert();

    const teacherSelectGroup = document.getElementById("teacherSelectGroup");

    if (role === "GV") {
      if (teacherSelectGroup) teacherSelectGroup.style.display = "none";
      usernameLabel.textContent = "Tài khoản giáo viên";
      usernameInput.placeholder = "Nhập mã GV (VD: GV001)";
      authSubtitle.textContent = "Không gian quản lý đề thi & lớp học";
    } else {
      if (teacherSelectGroup) teacherSelectGroup.style.display = "block";
      usernameLabel.textContent = "Tài khoản học sinh";
      usernameInput.placeholder = "Nhập mã học sinh (VD: HS001)";
      authSubtitle.textContent = "Đăng nhập tài khoản để vào phòng thi";
      updateTeacherSelectionVisual();
    }

    updateServerStatusBadge();
    usernameInput.focus();
  });
});

// 5. TOGGLE PASSWORD VISIBILITY
btnTogglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.getAttribute("type") === "password";
  if (isPassword) {
    passwordInput.setAttribute("type", "text");
    eyeIconOpen.style.display = "none";
    eyeIconClosed.style.display = "block";
  } else {
    passwordInput.setAttribute("type", "password");
    eyeIconOpen.style.display = "block";
    eyeIconClosed.style.display = "none";
  }
});

// 6. FORM SUBMISSION & API CALL
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideLoginAlert();

  const role = getSelectedRole();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  // Validate bắt buộc chọn Thầy/Cô đối với Học sinh để bảo đảm không bị mất bài làm
  if (role === "HS") {
    const selectTeacher = document.getElementById("selectTeacherServer");
    const chosenTeacher = selectTeacher ? (selectTeacher.value || "").trim() : "";
    if (!chosenTeacher) {
      const urgentBox = document.getElementById("teacherSelectGroup");
      if (urgentBox) {
        urgentBox.classList.remove("shake-urgent");
        void urgentBox.offsetWidth; // Trigger reflow
        urgentBox.classList.add("shake-urgent");
        urgentBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (selectTeacher) selectTeacher.focus();

      const urgentMsg = "🚨 BẮT BUỘC: Bạn chưa chọn Thầy/Cô phụ trách phòng thi! Nếu không chọn hoặc chọn sai, bạn sẽ KHÔNG THỂ ĐĂNG NHẬP hoặc BÀI LÀM SẼ BỊ MẤT!";
      showLoginAlert(urgentMsg);
      showToast("Chưa chọn Thầy/Cô", "Vui lòng chọn đúng Thầy/Cô phụ trách phòng thi của bạn trước khi đăng nhập để tránh mất bài thi!", "error", 6000);
      return;
    }
  }

  // Validate form cơ bản
  if (!username) {
    showLoginAlert("Vui lòng nhập tài khoản đăng nhập!");
    showToast("Thiếu thông tin", "Vui lòng nhập tài khoản đăng nhập", "error");
    usernameInput.focus();
    return;
  }

  if (!password) {
    showLoginAlert("Vui lòng nhập mật khẩu!");
    showToast("Thiếu thông tin", "Vui lòng nhập mật khẩu", "error");
    passwordInput.focus();
    return;
  }

  // Bật loading state trên nút bấm
  setLoading(true);

  const payload = {
    action: "login",
    username: username,
    password: password,
    role: role
  };

  try {
    let result;

    // GỌI API THỰC TẾ LÊN GOOGLE APPS SCRIPT
    // Sử dụng text/plain để vượt qua cơ chế CORS của Google Apps Script
    let activeUrl = getActiveApiUrl(role);
    let targetServerUsed = activeUrl;

    const response = await fetch(activeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Máy chủ Google phản hồi mã lỗi HTTP ${response.status}`);
    }

    result = await response.json();

    // ========================================================================
    // TỰ ĐỘNG CHUYỂN TIẾP TRẠM TRUNG TÂM (HUB REDIRECT CHO HỌC SINH)
    // ========================================================================
    if (result && result.isRedirect && result.redirectServerUrl) {
      targetServerUsed = result.redirectServerUrl;
      localStorage.setItem("student_gas_api_url", targetServerUsed);
      showToast("Chuyển tiếp lớp học 🌐", result.message || "Tài khoản thuộc lớp của Thầy/Cô. Đang tự động kết nối...", "info", 3500);

      // Gọi lần 2 sang máy chủ riêng của GV đó để hoàn tất xác thực
      const redirectResp = await fetch(targetServerUsed, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      if (!redirectResp.ok) {
        throw new Error(`Không thể kết nối đến máy chủ lớp học của Thầy/Cô (HTTP ${redirectResp.status})`);
      }

      result = await redirectResp.json();
    }

    // ========================================================================
    // DỰ PHÒNG CHO GIÁO VIÊN NẾU SHEET ADMIN BÁO KHÔNG TÌM THẤY TÀI KHOẢN
    // ========================================================================
    if (role === "GV" && result && !result.success && result.message && result.message.includes("không tồn tại")) {
      const customFallback = (localStorage.getItem("custom_gas_api_url") || "").trim();
      if (customFallback && customFallback !== DEFAULT_GAS_API_URL && customFallback.startsWith("https://script.google.com/macros/s/")) {
        try {
          const fbResp = await fetch(customFallback, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
          });
          if (fbResp.ok) {
            const fbResult = await fbResp.json();
            if (fbResult && fbResult.success) {
              result = fbResult;
              targetServerUsed = customFallback;
            }
          }
        } catch (eFb) {}
      }
    }

    // ========================================================================
    // XỬ LÝ KẾT QUẢ XÁC THỰC VỚI GOOGLE SHEETS
    // ========================================================================
    if (result && result.success) {
      // 1. Đúng tài khoản & mật khẩu -> Cho phép vào hệ thống
      hideLoginAlert();
      showToast("Thành công", result.message || "Đăng nhập thành công! Đang chuyển hướng...", "success", 2000);

      // Lưu thông tin người dùng vào Session / Local Storage
      if (result.data) {
        if (result.data.ngaySinh) result.data.ngaySinh = formatDob(result.data.ngaySinh);
        if (result.data.lop) result.data.lop = normalizeClassName(result.data.lop);
      }
      localStorage.setItem("currentUser", JSON.stringify(result.data));
      localStorage.setItem("userRole", result.role || role);
      localStorage.setItem("loginTime", new Date().toISOString());

      // Chuyển hướng theo phân quyền
      setTimeout(() => {
        if (role === "GV") {
          const gvUser = (result.data?.username || "").trim();
          if (result.data && result.data.serverUrl && result.data.serverUrl !== DEFAULT_GAS_API_URL) {
            localStorage.setItem("custom_gas_api_url", result.data.serverUrl);
            if (gvUser) {
              localStorage.setItem("teacher_server_url_" + gvUser, result.data.serverUrl);
              localStorage.setItem("teacher_server_url_" + gvUser.replace(/^0+/, ""), result.data.serverUrl);
            }
          } else {
            // Kiểm tra xem trình duyệt đã từng lưu URL cá nhân của Giáo viên này chưa
            const remembered = (gvUser ? (
              localStorage.getItem("teacher_server_url_" + gvUser) ||
              localStorage.getItem("teacher_server_url_" + gvUser.replace(/^0+/, "")) ||
              localStorage.getItem("teacher_server_url_0" + gvUser)
            ) : null) || localStorage.getItem("custom_gas_api_url");

            if (remembered && remembered !== DEFAULT_GAS_API_URL && remembered.startsWith("https://script.google.com/macros/s/")) {
              localStorage.setItem("custom_gas_api_url", remembered);
              if (result.data) result.data.serverUrl = remembered;
              localStorage.setItem("currentUser", JSON.stringify(result.data));
            } else {
              localStorage.removeItem("custom_gas_api_url");
            }
          }
          window.location.href = "teacher_dashboard.html";
        } else {
          localStorage.setItem("student_gas_api_url", targetServerUsed);
          const urlParams = new URLSearchParams(window.location.search);
          const examParam = urlParams.get("exam");
          let targetUrl = "student_dashboard.html";
          const qParts = [];
          if (targetServerUsed) qParts.push(`server=${encodeURIComponent(targetServerUsed)}`);
          if (examParam) qParts.push(`exam=${encodeURIComponent(examParam)}`);
          if (qParts.length > 0) targetUrl += `?${qParts.join("&")}`;
          window.location.href = targetUrl;
        }
      }, 700);

    } else {
      // 2. Không đúng với Google Sheet -> Báo lỗi cụ thể và CHẶN không cho vào
      const errorMsg = result?.message || "Tài khoản hoặc mật khẩu không chính xác với dữ liệu Google Sheets!";
      showLoginAlert(errorMsg);
      showToast("Đăng nhập thất bại", errorMsg, "error", 5000);

      passwordInput.focus();
      passwordInput.select();
    }

  } catch (error) {
    console.error("Lỗi khi kết nối API xác thực:", error);
    const connErrMsg = "Không thể kết nối đến máy chủ Google Sheets. Vui lòng kiểm tra đường truyền mạng hoặc kiểm tra lại Web App URL cấu hình.";
    showLoginAlert(connErrMsg);
    showToast("Lỗi kết nối", connErrMsg, "error", 5000);
  } finally {
    setLoading(false);
  }
});

// Helper quản lý trạng thái loading của nút Submit
function setLoading(isLoading) {
  if (isLoading) {
    btnLogin.classList.add("is-loading");
    btnLogin.disabled = true;
  } else {
    btnLogin.classList.remove("is-loading");
    btnLogin.disabled = false;
  }
}

// ============================================================================
// QUẢN LÝ CẤU HÌNH BACKEND GOOGLE SHEETS RIÊNG (TRANG ĐĂNG NHẬP)
// ============================================================================

// Đồng bộ trạng thái giao diện chọn Thầy/Cô
function updateTeacherSelectionVisual() {
  const selectTeacher = document.getElementById("selectTeacherServer");
  const teacherBox = document.getElementById("teacherSelectGroup");
  const confirmBox = document.getElementById("teacherSelectedConfirm");
  const confirmName = document.getElementById("teacherSelectedName");
  if (!selectTeacher || !teacherBox) return;

  const chosenVal = (selectTeacher.value || "").trim();
  if (chosenVal) {
    teacherBox.classList.add("is-selected");
    const chosenText = (selectTeacher.selectedIndex >= 0) 
      ? selectTeacher.options[selectTeacher.selectedIndex].text 
      : "";
    if (confirmBox && confirmName) {
      confirmName.textContent = chosenText.replace("👨‍🏫 ", "").replace(/^--\s*⚠️.*--$/, "");
      confirmBox.style.display = "flex";
    }
  } else {
    teacherBox.classList.remove("is-selected");
    if (confirmBox) {
      confirmBox.style.display = "none";
    }
  }
}

// Cập nhật thông tin máy chủ hiển thị trên màn hình đăng nhập
function updateServerStatusBadge() {
  const loginServerBadge = document.getElementById("loginServerBadge");
  const loginServerSub = document.getElementById("loginServerSub");
  const apiHint = document.getElementById("apiHint");

  const role = getSelectedRole();
  const urlParams = new URLSearchParams(window.location.search);
  const serverFromUrl = (urlParams.get("server") || "").trim();
  const custom = (localStorage.getItem("custom_gas_api_url") || "").trim();
  const selectTeacher = document.getElementById("selectTeacherServer");
  const selectedTeacherUrl = (role === "HS" && selectTeacher) ? (selectTeacher.value || "").trim() : "";
  const selectedTeacherText = (selectTeacher && selectTeacher.selectedIndex > 0) ? selectTeacher.options[selectTeacher.selectedIndex].text : "";

  if (serverFromUrl) {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🟢 Máy chủ: Phòng thi của Thầy/Cô (Từ liên kết)";
      loginServerBadge.style.color = "#15803d";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "Tự động kết nối đúng lớp học theo liên kết chia sẻ";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#86efac";
      apiHint.style.background = "#f0fdf4";
      apiHint.style.color = "#166534";
    }
  } else if (role === "HS" && selectedTeacherUrl) {
    if (loginServerBadge) {
      loginServerBadge.textContent = `🟢 Phòng thi trực tiếp: ${selectedTeacherText.replace("👨‍🏫 ", "")}`;
      loginServerBadge.style.color = "#15803d";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "Đã kết nối đúng Thầy/Cô. Bài thi sẽ được nộp an toàn về phòng này!";
      loginServerSub.style.color = "#166534";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#86efac";
      apiHint.style.background = "#f0fdf4";
      apiHint.style.color = "#166534";
    }
  } else if (role === "HS" && !selectedTeacherUrl) {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🔴 CẢNH BÁO: Chưa chọn Thầy/Cô phòng thi!";
      loginServerBadge.style.color = "#dc2626";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "BẮT BUỘC chọn Thầy/Cô ở khung màu đỏ phía trên trước khi đăng nhập!";
      loginServerSub.style.color = "#b91c1c";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#fca5a5";
      apiHint.style.background = "#fff1f2";
      apiHint.style.color = "#991b1b";
    }
  } else if (role === "GV") {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🌐 Trạm Trung Tâm (Xác thực Giáo viên qua Admin)";
      loginServerBadge.style.color = "#0369a1";
    }
    if (loginServerSub) {
      loginServerSub.textContent = custom 
        ? "Đã lưu Sheet riêng • Xác thực qua Admin và tự động phân luồng" 
        : "Tài khoản Giáo viên được xác thực tập trung từ Sheet Quản trị";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#bae6fd";
      apiHint.style.background = "#f0f9ff";
      apiHint.style.color = "#0369a1";
    }
  } else {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🌐 Trạm Trung Tâm (Central Hub Mặc định)";
      loginServerBadge.style.color = "#0369a1";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "Học sinh chọn đúng Thầy/Cô để kết nối trực tiếp phòng thi";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#bae6fd";
      apiHint.style.background = "#f0f9ff";
      apiHint.style.color = "#0369a1";
    }
  }
}

// ============================================================================
// KHỞI TẠO DANH SÁCH GIÁO VIÊN TRÊN FORM ĐĂNG NHẬP (TRÁNH NGHẼN MẠNG 100%)
// ============================================================================
function initTeacherDirectoryDropdown() {
  const selectTeacherServer = document.getElementById("selectTeacherServer");
  const badgeTeacherAutoDetect = document.getElementById("badgeTeacherAutoDetect");
  if (!selectTeacherServer) return;

  function renderTeacherList(teachers) {
    const urlParams = new URLSearchParams(window.location.search);
    const serverFromUrl = (urlParams.get("server") || "").trim();
    const currentVal = selectTeacherServer.value || serverFromUrl;

    let html = '<option value="">-- ⚠️ BẮT BUỘC: BẤM VÀO ĐÂY ĐỂ CHỌN THẦY / CÔ --</option>';
    let matchedOption = false;

    if (Array.isArray(teachers) && teachers.length > 0) {
      teachers.forEach(t => {
        if (!t.serverUrl) return;
        const isSel = (t.serverUrl === currentVal);
        if (isSel) matchedOption = true;
        const title = `👨‍🏫 ${t.hoTenGV || t.maGV} ${t.truong ? `(${t.truong})` : ""}`;
        html += `<option value="${t.serverUrl}" ${isSel ? "selected" : ""}>${title}</option>`;
      });
    }

    if (selectTeacherServer.innerHTML !== html) {
      selectTeacherServer.innerHTML = html;
    }

    if (serverFromUrl && matchedOption && badgeTeacherAutoDetect) {
      badgeTeacherAutoDetect.style.display = "inline";
    }

    updateTeacherSelectionVisual();
    updateServerStatusBadge();
  }

  // 1. Tải danh sách từ bộ nhớ cache cục bộ
  let cachedTeachers = [];
  try {
    const raw = localStorage.getItem("cached_teachers_directory");
    if (raw) cachedTeachers = JSON.parse(raw);
  } catch (e) {}

  if (cachedTeachers.length > 0) {
    renderTeacherList(cachedTeachers);
  }

  // 2. Tải ngầm danh bạ mới nhất từ Trạm Trung Tâm
  fetch(`${DEFAULT_GAS_API_URL}?action=getTeacherHubDirectory`, { method: "GET" })
    .then(res => res.ok ? res.json() : null)
    .then(res => {
      if (res && res.success && Array.isArray(res.teachers) && res.teachers.length > 0) {
        localStorage.setItem("cached_teachers_directory", JSON.stringify(res.teachers));
        renderTeacherList(res.teachers);
      }
    })
    .catch(err => {
      console.warn("Không thể tải danh bạ giáo viên từ Hub:", err);
    });

  // 3. Khi học sinh chọn một giáo viên cụ thể
  selectTeacherServer.addEventListener("change", () => {
    const chosen = selectTeacherServer.value;
    if (chosen) {
      localStorage.setItem("student_gas_api_url", chosen);
      hideLoginAlert();
    } else {
      localStorage.removeItem("student_gas_api_url");
    }
    updateTeacherSelectionVisual();
    updateServerStatusBadge();
  });

  updateTeacherSelectionVisual();
}

// Khi tải trang đăng nhập: Xóa sạch phiên đăng nhập cũ và cập nhật thông tin máy chủ
window.addEventListener("DOMContentLoaded", () => {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("userRole");

  // Nếu người dùng truy cập qua liên kết phòng thi có tham số ?server=...
  const urlParams = new URLSearchParams(window.location.search);
  const serverFromUrl = (urlParams.get("server") || "").trim();
  if (serverFromUrl.startsWith("https://script.google.com/macros/s/") && serverFromUrl.includes("/exec")) {
    localStorage.setItem("student_gas_api_url", serverFromUrl);
  }

  // Khởi tạo danh bạ giáo viên trên dropdown
  initTeacherDirectoryDropdown();

  hideLoginAlert();
  updateServerStatusBadge();
  if (usernameInput) usernameInput.focus();
});
