/**
 * ============================================================================
 * AUTHENTICATION LOGIC - HỆ THỐNG THI TRẮC NGHIỆM TRỰC TUYẾN
 * ============================================================================
 */

// 1. CẤU HÌNH API GOOGLE APPS SCRIPT
// URL Web App mặc định của hệ thống
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbw0WKZ9KjlMud7nEof6Kwqe6XYDRDeht4gHWVH_WsS2h48j_dzSvriiT9I4RT9t6zIG/exec";

// Lấy URL máy chủ đang kích hoạt (Ưu tiên URL cá nhân do giáo viên cấu hình)
function getActiveApiUrl() {
  const custom = (localStorage.getItem("custom_gas_api_url") || "").trim();
  if (custom.startsWith("https://script.google.com/macros/s/") && custom.includes("/exec")) {
    return custom;
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

    if (role === "GV") {
      usernameLabel.textContent = "Tài khoản giáo viên";
      usernameInput.placeholder = "Nhập mã GV (VD: GV001)";
      authSubtitle.textContent = "Không gian quản lý đề thi & lớp học";
    } else {
      usernameLabel.textContent = "Tài khoản học sinh";
      usernameInput.placeholder = "Nhập mã học sinh (VD: HS001)";
      authSubtitle.textContent = "Đăng nhập tài khoản để vào phòng thi";
    }

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
    const activeUrl = getActiveApiUrl();
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
    // XỬ LÝ KẾT QUẢ XÁC THỰC VỚI GOOGLE SHEETS
    // ========================================================================
    if (result && result.success) {
      // 1. Đúng tài khoản & mật khẩu -> Cho phép vào hệ thống
      hideLoginAlert();
      showToast("Thành công", result.message || "Đăng nhập thành công! Đang chuyển hướng...", "success", 2000);

      // Lưu thông tin người dùng vào Session / Local Storage
      localStorage.setItem("currentUser", JSON.stringify(result.data));
      localStorage.setItem("userRole", result.role || role);
      localStorage.setItem("loginTime", new Date().toISOString());

      // Chuyển hướng theo phân quyền
      setTimeout(() => {
        if (role === "GV") {
          window.location.href = "teacher_dashboard.html";
        } else {
          window.location.href = "student_dashboard.html";
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

// Cập nhật thông tin máy chủ hiển thị trên màn hình đăng nhập
function updateServerStatusBadge() {
  const loginServerBadge = document.getElementById("loginServerBadge");
  const loginServerSub = document.getElementById("loginServerSub");
  const apiHint = document.getElementById("apiHint");
  const custom = (localStorage.getItem("custom_gas_api_url") || "").trim();

  if (custom) {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🟢 Máy chủ: Google Sheet Cá Nhân (Riêng)";
      loginServerBadge.style.color = "#15803d";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "Phần mềm độc lập 100% • Tài khoản xác thực theo Sheet riêng";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#86efac";
      apiHint.style.background = "#f0fdf4";
      apiHint.style.color = "#166534";
    }
  } else {
    if (loginServerBadge) {
      loginServerBadge.textContent = "🔵 Máy chủ: Google Sheets Mặc định";
      loginServerBadge.style.color = "#0369a1";
    }
    if (loginServerSub) {
      loginServerSub.textContent = "Phần mềm độc lập • Bấm Cài đặt để dùng Sheet riêng";
    }
    if (apiHint) {
      apiHint.style.borderColor = "#bae6fd";
      apiHint.style.background = "#f0f9ff";
      apiHint.style.color = "#0369a1";
    }
  }
}

// Cập nhật trạng thái hiển thị trong Modal
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
    box.style.border = "1.5px solid #bae6fd";
    box.style.background = "#e0f2fe";
    box.style.color = "#0369a1";
    iconEl.textContent = "ℹ️";
  }
  titleEl.textContent = title;
  descEl.innerHTML = desc;
}

const backendConfigModal = document.getElementById("backendConfigModal");
const btnFloatingBackend = document.getElementById("btnFloatingBackend");
const btnConfigBackendInline = document.getElementById("btnConfigBackendInline");
const btnCloseBackendModal = document.getElementById("btnCloseBackendModal");
const btnCancelBackendModal = document.getElementById("btnCancelBackendModal");
const inputBackendUrl = document.getElementById("inputBackendUrl");

// Elements Modal Bảo Mật Quản Trị (Mật khẩu ô G1)
const adminAuthModal = document.getElementById("adminAuthModal");
const btnCloseAdminAuthModal = document.getElementById("btnCloseAdminAuthModal");
const btnCancelAdminAuth = document.getElementById("btnCancelAdminAuth");
const btnConfirmAdminAuth = document.getElementById("btnConfirmAdminAuth");
const adminSecurityPasswordInput = document.getElementById("adminSecurityPasswordInput");
const btnToggleAdminPass = document.getElementById("btnToggleAdminPass");
const adminSecurityErrorBox = document.getElementById("adminSecurityErrorBox");
const adminSecurityErrorMsg = document.getElementById("adminSecurityErrorMsg");

function showAdminPassError(msg) {
  if (!adminSecurityErrorBox) return;
  if (adminSecurityErrorMsg) adminSecurityErrorMsg.textContent = msg;
  adminSecurityErrorBox.style.display = "block";
  adminSecurityErrorBox.style.animation = "none";
  void adminSecurityErrorBox.offsetWidth;
  adminSecurityErrorBox.style.animation = "alertShake 0.4s ease";
}

function hideAdminPassError() {
  if (adminSecurityErrorBox) adminSecurityErrorBox.style.display = "none";
}

function openAdminAuthModal() {
  if (!adminAuthModal) return;
  if (adminSecurityPasswordInput) {
    adminSecurityPasswordInput.value = "";
    adminSecurityPasswordInput.type = "password";
  }
  if (btnToggleAdminPass) btnToggleAdminPass.textContent = "👁";
  hideAdminPassError();
  adminAuthModal.classList.add("is-active");
  setTimeout(() => {
    if (adminSecurityPasswordInput) adminSecurityPasswordInput.focus();
  }, 100);
}

function closeAdminAuthModal() {
  if (adminAuthModal) {
    adminAuthModal.classList.remove("is-active");
  }
  hideAdminPassError();
}

// Xác thực mật khẩu quản trị từ ô G1/F2 hoặc fallback tài khoản GV trên máy chủ cũ
async function verifyAdminSecurityPassword() {
  const pass = (adminSecurityPasswordInput?.value || "").trim();
  if (!pass) {
    showAdminPassError("Vui lòng nhập mật khẩu quản trị!");
    if (adminSecurityPasswordInput) adminSecurityPasswordInput.focus();
    return;
  }

  btnConfirmAdminAuth.disabled = true;
  btnConfirmAdminAuth.innerHTML = "<span>Đang xác thực...</span>";
  hideAdminPassError();

  try {
    let isSuccess = false;

    // 1. Thử gọi action mới verifyAdminPassword
    try {
      const resp = await fetch(DEFAULT_GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "verifyAdminPassword",
          password: pass
        })
      });

      if (resp.ok) {
        const result = await resp.json().catch(() => ({}));
        if (result && result.success) {
          isSuccess = true;
        } else if (result && result.message && result.message.includes("không hợp lệ hoặc chưa được hỗ trợ")) {
          // Web App đang chạy phiên bản cũ chưa có action verifyAdminPassword -> Chuyển sang fallback
          console.warn("Máy chủ Web App đang chạy phiên bản cũ, chuyển sang cơ chế fallback xác thực...");
        } else if (result && result.success === false) {
          // Máy chủ mới đã kiểm tra và báo sai mật khẩu
          showAdminPassError(result.message || "Mật khẩu quản trị không chính xác! Vui lòng kiểm tra lại.");
          if (adminSecurityPasswordInput) {
            adminSecurityPasswordInput.focus();
            adminSecurityPasswordInput.select();
          }
          return;
        }
      }
    } catch (e1) {
      console.warn("Lỗi gọi verifyAdminPassword, thử fallback:", e1);
    }

    // 2. Cơ chế TỰ ĐỘNG TƯƠNG THÍCH MÁY CHỦ CŨ:
    // Thử xác thực mật khẩu qua action "login" với các tài khoản GV trên Google Sheet của thầy/cô (hung26, hung2601, GV001...)
    if (!isSuccess) {
      const knownAccounts = ["hung26", "hung2601", "GV001", "GV002", "admin"];
      for (const uname of knownAccounts) {
        try {
          const loginResp = await fetch(DEFAULT_GAS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "login",
              username: uname,
              password: pass,
              role: "GV"
            })
          });

          if (loginResp.ok) {
            const loginRes = await loginResp.json().catch(() => ({}));
            if (loginRes && loginRes.success) {
              isSuccess = true;
              break;
            }
          }
        } catch (loginErr) {}
      }
    }

    if (isSuccess) {
      closeAdminAuthModal();
      openBackendModal();
      showToast("Xác thực thành công! 🎉", "Mật khẩu quản trị chính xác! Mời bạn cấu hình Backend.", "success", 3000);
    } else {
      showAdminPassError("Mật khẩu không chính xác! Vui lòng kiểm tra lại mật khẩu ô F2 hoặc mật khẩu GV.");
      if (adminSecurityPasswordInput) {
        adminSecurityPasswordInput.focus();
        adminSecurityPasswordInput.select();
      }
    }

  } catch (err) {
    console.error("Lỗi khi kiểm tra mật khẩu quản trị:", err);
    showAdminPassError("Không thể kết nối đến Google Sheets chính để xác thực. Vui lòng kiểm tra lại kết nối mạng.");
  } finally {
    btnConfirmAdminAuth.disabled = false;
    btnConfirmAdminAuth.innerHTML = "<span>Xác Thực Mật Khẩu</span>";
  }
}

// Gắn sự kiện cho Modal Bảo mật
if (btnToggleAdminPass) {
  btnToggleAdminPass.addEventListener("click", () => {
    if (!adminSecurityPasswordInput) return;
    const isPwd = adminSecurityPasswordInput.type === "password";
    adminSecurityPasswordInput.type = isPwd ? "text" : "password";
    btnToggleAdminPass.textContent = isPwd ? "🔒" : "👁";
  });
}

if (btnCloseAdminAuthModal) btnCloseAdminAuthModal.addEventListener("click", closeAdminAuthModal);
if (btnCancelAdminAuth) btnCancelAdminAuth.addEventListener("click", closeAdminAuthModal);
if (btnConfirmAdminAuth) btnConfirmAdminAuth.addEventListener("click", verifyAdminSecurityPassword);

if (adminSecurityPasswordInput) {
  adminSecurityPasswordInput.addEventListener("input", hideAdminPassError);
  adminSecurityPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      verifyAdminSecurityPassword();
    }
  });
}

// Bấm nút Cấu hình Backend: YÊU CẦU XÁC THỰC MẬT KHẨU Ô G1 TRƯỚC
if (btnFloatingBackend) btnFloatingBackend.addEventListener("click", openAdminAuthModal);
if (btnConfigBackendInline) btnConfigBackendInline.addEventListener("click", openAdminAuthModal);

function openBackendModal() {
  if (!backendConfigModal) return;
  const currentUrl = localStorage.getItem("custom_gas_api_url") || "";
  if (inputBackendUrl) inputBackendUrl.value = currentUrl;

  if (currentUrl) {
    setGasStatusInModal("info", "Đang dùng Sheet cá nhân (Chưa kiểm tra)", "Bấm <strong>⚡ Kiểm tra kết nối Sheet</strong> để xác nhận máy chủ của bạn đã sẵn sàng.");
  } else {
    setGasStatusInModal("info", "Đang dùng máy chủ mặc định của hệ thống", "Dữ liệu lưu tại máy chủ chung. Thầy/cô có thể tạo file Sheet riêng theo hướng dẫn 4 bước bên dưới.");
  }

  backendConfigModal.classList.add("is-active");
}

function closeBackendModal() {
  if (backendConfigModal) {
    backendConfigModal.classList.remove("is-active");
  }
}

if (btnCloseBackendModal) btnCloseBackendModal.addEventListener("click", closeBackendModal);
if (btnCancelBackendModal) btnCancelBackendModal.addEventListener("click", closeBackendModal);

window.addEventListener("click", (e) => {
  if (e.target === adminAuthModal) closeAdminAuthModal();
  if (e.target === backendConfigModal) closeBackendModal();
});

// Nút Đặt lại URL mặc định
const btnResetBackendUrl = document.getElementById("btnResetBackendUrl");
if (btnResetBackendUrl) {
  btnResetBackendUrl.addEventListener("click", () => {
    if (inputBackendUrl) inputBackendUrl.value = "";
    localStorage.removeItem("custom_gas_api_url");
    updateServerStatusBadge();
    setGasStatusInModal("info", "Đã đặt lại máy chủ mặc định", "Đã quay về sử dụng máy chủ Google Sheet mặc định của hệ thống.");
    showToast("Khôi phục thành công", "Đã đặt lại máy chủ Google Sheet mặc định của hệ thống!", "info", 3000);
  });
}

// Nút Sao chép mã nguồn Code.gs
const btnCopyBackendCodeGs = document.getElementById("btnCopyBackendCodeGs");
if (btnCopyBackendCodeGs) {
  btnCopyBackendCodeGs.addEventListener("click", async () => {
    const codeText = window.GAS_CODE_GS_CONTENT || "";
    if (!codeText) {
      showToast("Lỗi", "Không tìm thấy nội dung mã nguồn Code.gs!", "error");
      return;
    }

    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(codeText);
        copied = true;
      } catch (err) {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const ta = document.createElement("textarea");
        ta.value = codeText;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) {
        copied = false;
      }
    }

    if (copied) {
      const lineCount = codeText.split(/\r?\n/).length;
      setGasStatusInModal("success", "ĐÃ SAO CHÉP MÃ NGUỒN CODE.GS! 📋", `Đã copy thành công toàn bộ ${lineCount} dòng mã nguồn. Mở Apps Script trên Google Sheet cá nhân và nhấn <strong>Ctrl + V</strong> để dán vào.`);
      showToast("Sao chép thành công! 🎉", `Đã copy toàn bộ ${lineCount} dòng mã nguồn Code.gs vào bộ nhớ tạm! Thầy/Cô chỉ cần mở Apps Script trên Google Sheet cá nhân và nhấn Ctrl + V để dán đè vào.`, "success", 6000);
    } else {
      showToast("Thông báo", "Trình duyệt chặn Clipboard tự động. Vui lòng mở file gas/Code.gs để copy thủ công.", "warning", 5000);
    }
  });
}

// Nút Kiểm tra kết nối Sheet
const btnTestBackendConnection = document.getElementById("btnTestBackendConnection");
if (btnTestBackendConnection) {
  btnTestBackendConnection.addEventListener("click", async () => {
    const inputUrl = (inputBackendUrl?.value || "").trim();
    const testUrl = inputUrl || DEFAULT_GAS_API_URL;

    if (!testUrl.startsWith("https://script.google.com/macros/s/") || !testUrl.includes("/exec")) {
      setGasStatusInModal("error", "URL Google Apps Script không hợp lệ!", "URL phải bắt đầu bằng <code>https://script.google.com/macros/s/</code> và kết thúc bằng <code>/exec</code>.");
      showToast("URL không hợp lệ", "URL Google Apps Script phải có định dạng https://script.google.com/macros/s/.../exec", "error", 5000);
      return;
    }

    btnTestBackendConnection.disabled = true;
    btnTestBackendConnection.textContent = "Đang kiểm tra kết nối...";
    setGasStatusInModal("loading", "Đang kiểm tra kết nối Google Sheet...", `Đang gửi tín hiệu gọi API tới Web App: <code style="word-break: break-all;">${testUrl}</code>`);

    try {
      const resp = await fetch(`${testUrl}?action=getTeacherExams&gv=test_ping`, { method: "GET" });
      if (resp.ok) {
        setGasStatusInModal("success", "KẾT NỐI THÀNH CÔNG! (HTTP 200 OK) 🎉", "Máy chủ Google Sheet của bạn phản hồi rất tốt! Tài khoản trong Sheet đã sẵn sàng để đăng nhập.");
        showToast("Kết nối thành công! 🎉", "Máy chủ Google Sheet của bạn phản hồi rất tốt và sẵn sàng nhận dữ liệu!", "success", 5000);
      } else {
        throw new Error(`Mã lỗi HTTP: ${resp.status}`);
      }
    } catch (err) {
      console.warn("Lỗi kết nối Gas:", err);
      setGasStatusInModal("error", "KẾT NỐI THẤT BẠI!", `Không thể kết nối tới Google Apps Script.<br><strong>Nguyên nhân thường gặp:</strong> Khi bấm <em>Triển khai (Deploy) > Triển khai mới (New deployment)</em> trong Google Sheet, mục <strong>Ai có quyền truy cập (Who has access)</strong> chưa chọn là <strong>Bất kỳ ai (Anyone)</strong>.`);
      showToast("Không thể kết nối", "Vui lòng kiểm tra lại URL và chắc chắn rằng khi Triển khai (Deploy) bạn đã chọn quyền truy cập là 'Bất kỳ ai' (Anyone).", "warning", 6000);
    } finally {
      btnTestBackendConnection.disabled = false;
      btnTestBackendConnection.textContent = "⚡ Kiểm tra kết nối Sheet";
    }
  });
}

// Nút Lưu Cấu Hình Máy Chủ
const btnSaveBackendConfig = document.getElementById("btnSaveBackendConfig");
if (btnSaveBackendConfig) {
  btnSaveBackendConfig.addEventListener("click", () => {
    const inputUrl = (inputBackendUrl?.value || "").trim();

    if (inputUrl) {
      if (!inputUrl.startsWith("https://script.google.com/macros/s/") || !inputUrl.includes("/exec")) {
        setGasStatusInModal("error", "URL Google Apps Script không hợp lệ!", "URL phải có dạng https://script.google.com/macros/s/.../exec");
        showToast("URL không hợp lệ", "URL Google Apps Script phải có dạng https://script.google.com/macros/s/.../exec", "error", 5000);
        if (inputBackendUrl) inputBackendUrl.focus();
        return;
      }
      localStorage.setItem("custom_gas_api_url", inputUrl);
      showToast("Đã lưu cấu hình", "Đã kết nối máy chủ Google Sheet riêng! Bây giờ bạn có thể đăng nhập bằng tài khoản có trong Sheet của mình.", "success", 5000);
    } else {
      localStorage.removeItem("custom_gas_api_url");
      showToast("Đã lưu cấu hình", "Đã chuyển về sử dụng máy chủ mặc định của hệ thống.", "info", 4000);
    }

    updateServerStatusBadge();
    closeBackendModal();
  });
}

// Khi tải trang đăng nhập: Xóa sạch phiên đăng nhập cũ và cập nhật thông tin máy chủ
window.addEventListener("DOMContentLoaded", () => {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("userRole");
  hideLoginAlert();
  updateServerStatusBadge();
  if (usernameInput) usernameInput.focus();
});
