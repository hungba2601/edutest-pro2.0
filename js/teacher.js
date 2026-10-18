/**
 * ============================================================================
 * TEACHER DASHBOARD LOGIC - EDUTEST PRO 2.0
 * ============================================================================
 */

// Lấy API_URL từ cấu hình (hỗ trợ giáo viên cấu hình Backend Google Sheets riêng qua localStorage)
const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbw0WKZ9KjlMud7nEof6Kwqe6XYDRDeht4gHWVH_WsS2h48j_dzSvriiT9I4RT9t6zIG/exec";
let API_URL = localStorage.getItem("custom_gas_api_url") || DEFAULT_GAS_API_URL;

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

// State lưu trữ cục bộ
let currentTeacher = null;
let parsedQuestions = []; // Danh sách câu hỏi trắc nghiệm (Phần I & II)
let parsedEssayQuestions = []; // Danh sách câu hỏi tự luận (Phần III)
let currentExamsList = [];
let currentResultsList = [];
let currentTeacherStudents = []; // Danh sách học sinh các lớp GV phụ trách
let editingExamCode = null; // Mã đề đang trong chế độ chỉnh sửa (null = tạo mới)
let targetChangePwdStudent = null; // Học sinh đang được chọn để đổi mật khẩu

// ============================================================================
// 1. KHỞI TẠO & PHÂN QUYỀN TRANG
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  // Gắn sự kiện hủy chỉnh sửa đề
  const btnCancel = document.getElementById("btnCancelEdit");
  if (btnCancel) {
    btnCancel.addEventListener("click", cancelEditingMode);
  }
  // Kiểm tra phiên đăng nhập
  const rawUser = localStorage.getItem("currentUser");
  const role = localStorage.getItem("userRole");

  if (!rawUser || role !== "GV") {
    alert("Phiên đăng nhập không hợp lệ hoặc bạn không có quyền Giáo viên.");
    window.location.href = "index.html";
    return;
  }

  currentTeacher = JSON.parse(rawUser);

  // Hiển thị thông tin giáo viên lên navbar
  document.getElementById("gvFullName").textContent = currentTeacher.hoTenGV || currentTeacher.username;
  document.getElementById("gvClasses").textContent = `Lớp: ${currentTeacher.lopGiangDay || "Tất cả"}`;

  // Khởi tạo giao diện cấu hình Gemini API & Model
  initGeminiConfigUI();

  // Khởi tạo các chip chọn lớp
  initClassSelector(currentTeacher.lopGiangDay);

  // Gắn sự kiện chuyển Tab
  initTabSwitching();

  // Khởi tạo trình biên soạn câu hỏi tự luận & xuất Excel
  initEssayQuestionsUI();

  // Tải danh sách đề thi của giáo viên
  loadTeacherExams();

  // Lắng nghe sự kiện gõ phím để xóa cảnh báo lỗi khi nhập tên kỳ kiểm tra
  const examTitleInput = document.getElementById("examTitle");
  if (examTitleInput) {
    examTitleInput.addEventListener("input", () => {
      if (examTitleInput.value.trim()) {
        examTitleInput.style.borderColor = "";
        examTitleInput.style.backgroundColor = "";
        examTitleInput.style.boxShadow = "";
        const errorMsg = document.getElementById("examTitleErrorMsg");
        if (errorMsg) errorMsg.style.display = "none";
      }
    });
  }

  // Khởi tạo sự kiện chuyển chế độ xem lại bài (Ôn tập vs Thi chính thức)
  initReviewModeSelector();

  // Đăng xuất
  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    window.location.href = "index.html";
  });
});

// Cập nhật giao diện chuyển chế độ Xem lại bài
function updateReviewModeDisplay(isAllow) {
  const optReview = document.getElementById("optModeReview");
  const optExam = document.getElementById("optModeExam");
  const badgeMode = document.getElementById("badgeReviewMode");

  if (isAllow) {
    if (optReview) optReview.classList.add("selected");
    if (optExam) optExam.classList.remove("selected");
    if (badgeMode) {
      badgeMode.textContent = "📖 ÔN TẬP (ĐƯỢC XEM BÀI)";
      badgeMode.classList.remove("locked");
    }
  } else {
    if (optReview) optReview.classList.remove("selected");
    if (optExam) optExam.classList.add("selected");
    if (badgeMode) {
      badgeMode.textContent = "🔒 THI (KHÓA XEM BÀI)";
      badgeMode.classList.add("locked");
    }
  }
}

function initReviewModeSelector() {
  const radioAllow = document.getElementById("radioAllowReview");
  const radioDisallow = document.getElementById("radioDisallowReview");

  if (radioAllow) {
    radioAllow.addEventListener("change", () => updateReviewModeDisplay(true));
  }
  if (radioDisallow) {
    radioDisallow.addEventListener("change", () => updateReviewModeDisplay(false));
  }
}

// Render danh sách checkbox chọn lớp
function initClassSelector(classesString) {
  const container = document.getElementById("classSelectorContainer");
  container.innerHTML = "";

  const rawClasses = classesString ? classesString.split(/[,;\s]+/).filter(Boolean) : ["9A1", "9A2"];
  
  // Sắp xếp các lớp theo khối và tên (VD: 8A1, 8A2... rồi đến 9A1, 9A2...)
  const classes = Array.from(new Set(rawClasses)).sort((a, b) => {
    const ga = parseInt(getGradeFromClass(a)) || 0;
    const gb = parseInt(getGradeFromClass(b)) || 0;
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b);
  });

  // Thêm tùy chọn "Tất cả"
  const allChip = createClassChip("ALL", "Tất cả các lớp", true);
  container.appendChild(allChip);

  classes.forEach(cls => {
    const chip = createClassChip(cls, cls, true);
    container.appendChild(chip);
  });
}

function createClassChip(val, labelText, checked = false) {
  const div = document.createElement("div");
  const g = val === "ALL" ? "all" : (getGradeFromClass(val) || "other");
  div.className = `class-checkbox-chip chip-grade-${g}`;
  div.innerHTML = `
    <input type="checkbox" id="class_${val}" value="${val}" ${checked ? "checked" : ""}>
    <label for="class_${val}">${labelText}</label>
  `;
  return div;
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
  const tabCreate = document.getElementById("tabCreate");
  const tabResults = document.getElementById("tabResults");
  const tabStudents = document.getElementById("tabStudents");

  function switchTab(activeBtn, activeTab) {
    [tabBtnCreate, tabBtnResults, tabBtnStudents].forEach(b => {
      if (b) b.classList.remove("active");
    });
    [tabCreate, tabResults, tabStudents].forEach(t => {
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
      loadTeacherResults();
    });
  }

  if (tabBtnStudents) {
    tabBtnStudents.addEventListener("click", () => {
      switchTab(tabBtnStudents, tabStudents);
      loadTeacherStudents();
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
            noiDung: prompt,
            diem: itemDiem,
            dapAn: essayAns
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
          noiDung: pText,
          diem: p3DefaultDiem,
          dapAn: essayAns
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
        <textarea class="form-textarea essay-content-input" data-index="${idx}" rows="2" placeholder="Nhập nội dung đề bài câu hỏi tự luận ${eq.id}..." style="font-size: 0.9rem; width: 100%; box-sizing: border-box; background: #ffffff; border-radius: 8px;">${escapeHtml(eq.noiDung || '')}</textarea>
      </div>
      <div style="margin-top: 0.5rem; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 0.6rem 0.85rem;">
        <label style="font-size: 0.8rem; font-weight: 700; color: #065f46; display: flex; align-items: center; gap: 5px; margin-bottom: 0.25rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Đáp án đúng / Lời giải mẫu (hiện khi học sinh ôn tập, học bài):</span>
        </label>
        <textarea class="form-textarea essay-answer-input" data-index="${idx}" rows="2" placeholder="Nhập đáp án chuẩn, gợi ý trả lời hoặc lời giải chi tiết cho câu tự luận ${eq.id}..." style="font-size: 0.88rem; width: 100%; box-sizing: border-box; background: #ffffff; border-radius: 6px; border: 1px solid #6ee7b7; color: #064e3b; font-weight: 500; line-height: 1.45;">${escapeHtml(eq.dapAn || eq.dapAnDung || '')}</textarea>
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
      }
    });
    tx.addEventListener("blur", () => {
      renderQuestionsPreview(parsedQuestions);
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

  // ==========================================
  // PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN
  // ==========================================
  if (mcQuestions.length > 0) {
    const headerI = document.createElement("div");
    headerI.className = "preview-section-header mc-section";
    headerI.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="preview-section-badge" style="color: #1e40af;">PHẦN I</span>
        <span>Câu hỏi trắc nghiệm nhiều phương án lựa chọn</span>
      </div>
      <span style="font-size: 0.8rem; font-weight: 700; color: #2563eb;">${mcQuestions.length} câu</span>
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
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="preview-section-badge" style="color: #86198f;">PHẦN II</span>
        <span>Câu hỏi trắc nghiệm Đúng / Sai</span>
      </div>
      <span style="font-size: 0.8rem; font-weight: 700; color: #9333ea;">${tfQuestions.length} câu</span>
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
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="preview-section-badge" style="color: #065f46;">PHẦN III</span>
        <span>Câu hỏi Tự Luận (Học sinh gõ bài làm, GV chấm điểm)</span>
      </div>
      <span style="font-size: 0.8rem; font-weight: 700; color: #059669;">${essayQuestions.length} câu</span>
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
          <div class="q-prompt-editable q-essay-prompt" contenteditable="true" data-index="${eqIdx}" style="min-height: 48px; background: #ffffff; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${escapeHtml(eq.noiDung)}
          </div>
        </div>

        <div style="margin-top: 0.5rem; background: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 8px; padding: 0.55rem 0.85rem;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #166534; margin-bottom: 0.3rem; display: flex; align-items: center; gap: 4px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Đáp án câu tự luận đúng (Học sinh xem lại khi ôn tập):</span>
          </div>
          <div class="q-essay-answer-editable" contenteditable="true" data-index="${eqIdx}" placeholder="Nhập đáp án chuẩn hoặc lời giải chi tiết..." style="min-height: 38px; background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #bbf7d0; font-size: 0.88rem; color: #166534; line-height: 1.45;">${escapeHtml(eq.dapAn || eq.dapAnDung || '')}</div>
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

    <div class="q-prompt-editable" contenteditable="true" data-index="${realIdx}" data-field="noiDung">
      ${q.noiDung}
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
        <div class="q-opt-text" contenteditable="true" data-qidx="${qIdx}" data-optkey="${opt.key}">${opt.noiDung}</div>
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
          <div class="q-tf-text" contenteditable="true" data-qidx="${qIdx}" data-subidx="${sIdx}">${sub.noiDung}</div>
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
      }
    });
  });

  // 1. Sửa nội dung câu hỏi trắc nghiệm
  document.querySelectorAll(".q-prompt-editable:not(.q-essay-prompt)").forEach(el => {
    el.addEventListener("blur", (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (parsedQuestions[idx]) {
        parsedQuestions[idx].noiDung = e.target.innerText.trim();
      }
    });
  });

  // 1.1 Sửa nội dung câu hỏi tự luận trên bản xem trước
  document.querySelectorAll(".q-essay-prompt").forEach(el => {
    el.addEventListener("blur", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[eqIdx]) {
        parsedEssayQuestions[eqIdx].noiDung = e.target.innerText.trim();
        // Đồng bộ sang editor bên trái
        const leftTx = document.querySelector(`.essay-content-input[data-index="${eqIdx}"]`);
        if (leftTx) leftTx.value = parsedEssayQuestions[eqIdx].noiDung;
      }
    });
  });

  // 1.2 Sửa đáp án câu hỏi tự luận trên bản xem trước
  document.querySelectorAll(".q-essay-answer-editable").forEach(el => {
    el.addEventListener("blur", (e) => {
      const eqIdx = parseInt(e.target.dataset.index);
      if (parsedEssayQuestions[eqIdx]) {
        parsedEssayQuestions[eqIdx].dapAn = e.target.innerText.trim();
        // Đồng bộ sang editor bên trái
        const leftTx = document.querySelector(`.essay-answer-input[data-index="${eqIdx}"]`);
        if (leftTx) leftTx.value = parsedEssayQuestions[eqIdx].dapAn;
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
    el.addEventListener("blur", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const optKey = e.target.dataset.optkey;
      const q = parsedQuestions[qIdx];
      if (q && q.luaChon) {
        const found = q.luaChon.find(o => o.key === optKey);
        if (found) found.noiDung = e.target.innerText.trim();
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
    el.addEventListener("blur", (e) => {
      const qIdx = parseInt(e.target.dataset.qidx);
      const sIdx = parseInt(e.target.dataset.subidx);
      const q = parsedQuestions[qIdx];
      if (q && q.y && q.y[sIdx]) {
        q.y[sIdx].noiDung = e.target.innerText.trim();
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
    if (!parsedQuestions || parsedQuestions.length === 0) {
      showToast("Chưa có câu hỏi", "Vui lòng tải file hoặc thêm câu hỏi trước khi chia điểm!", "warning", 3000);
      return;
    }

    const n = parsedQuestions.length;
    // Làm tròn 2 số thập phân: ví dụ 12 câu -> 0.83 đ/câu, 10 câu -> 1.0 đ/câu, 20 câu -> 0.5 đ/câu
    const eachPoint = Math.round((10 / n) * 100) / 100;

    parsedQuestions.forEach((q, idx) => {
      q.diem = eachPoint;
      const inp = document.querySelector(`.q-points-input[data-index="${idx}"]`);
      if (inp) inp.value = eachPoint;
    });

    updateStats(
      parsedQuestions.length,
      parsedQuestions.filter(q => q.loaiCauHoi !== 'true_false').length,
      parsedQuestions.filter(q => q.loaiCauHoi === 'true_false').length
    );

    showToast(
      "Đã chia đều 10 điểm", 
      `Đã cập nhật ${eachPoint} điểm cho mỗi câu (${n} câu). Tổng: ${Math.round(eachPoint * n * 100) / 100} đ!`, 
      "success", 
      3000
    );
  });
}

// ============================================================================
// QUẢN LÝ BỘ NHỚ TẠM (LOCALSTORAGE CACHE) ĐỀ THI CHO GIÁO VIÊN
// ============================================================================
function getCachedExams() {
  try {
    const key = "cached_teacher_exams_" + (currentTeacher?.username || "gv01");
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCachedExams(exams) {
  try {
    const key = "cached_teacher_exams_" + (currentTeacher?.username || "gv01");
    localStorage.setItem(key, JSON.stringify(exams));
  } catch (e) {
    console.warn("Lỗi lưu cache đề thi:", e);
  }
}

// ============================================================================
// 6. LƯU ĐỀ THI LÊN GOOGLE SHEETS
// ============================================================================
const btnSaveExam = document.getElementById("btnSaveExam");

btnSaveExam.addEventListener("click", async () => {
  const tenKyThi = document.getElementById("examTitle").value.trim();
  const thoiGian = parseInt(document.getElementById("examDuration").value) || 45;
  const isOpening = document.getElementById("examStatusToggle").checked;
  const trangThai = isOpening ? "Mở" : "Đóng";

  // Lấy các lớp được chọn
  const checkedBoxes = document.querySelectorAll("#classSelectorContainer input[type='checkbox']:checked");
  const selectedClasses = Array.from(checkedBoxes).map(cb => cb.value).join(", ");

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

  // Lấy cấu hình Chế độ xem lại bài (Ôn tập vs Thi chính thức)
  const radioAllow = document.getElementById("radioAllowReview");
  const choXemLaiBai = radioAllow ? radioAllow.checked : true;

  // Đóng gói cấu trúc đề thi
  const examDataPayload = {
    action: "saveExam",
    usernameGV: currentTeacher.username,
    tenKyThi: tenKyThi,
    thoiGian: thoiGian,
    trangThai: trangThai,
    lopChoPhep: selectedClasses,
    choXemLaiBai: choXemLaiBai,
    duLieuDe: {
      cauHoi: parsedQuestions,
      choXemLaiBai: choXemLaiBai,
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
    lopChoPhep: selectedClasses,
    thoiGian: thoiGian,
    soCauHoi: parsedQuestions.length,
    hasTuLuan: !!(parsedEssayQuestions.length > 0 || essayFormLink),
    choXemLaiBai: choXemLaiBai,
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
      const res = await fetch(API_URL, {
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
        }
      }
    } catch (networkErr) {
      console.warn("Lỗi đồng bộ lên Google Sheets:", networkErr);
    }

    if (syncedSuccess) {
      const isUpdated = !!editingExamCode;
      showToast(isUpdated ? "Cập nhật thành công" : "Lưu thành công", syncMessage || "Đề thi đã được lưu đồng bộ lên Google Sheets!", "success", 4000);
    } else {
      showToast(
        "Đã lưu đề thi an toàn",
        `Đề thi "${tenKyThi}" đã được lưu an toàn vào danh sách trên máy của bạn! (Nếu muốn đồng bộ Google Sheets, vui lòng kiểm tra lại URL Web App).`,
        "success",
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
    document.getElementById("editingExamCodeDisplay").textContent = `${exam.maDe} - ${exam.tenKyThi}`;
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

  // 3. Tích chọn lại các lớp
  const allowedUpper = (exam.lopChoPhep || "").toUpperCase();
  const checkboxes = document.querySelectorAll("#classSelectorContainer input[type='checkbox']");
  checkboxes.forEach(cb => {
    const val = cb.value.toUpperCase();
    if (allowedUpper.includes("ALL") || allowedUpper.includes("TẤT CẢ")) {
      cb.checked = (val === "ALL");
    } else {
      const allowedArr = allowedUpper.split(/[,;\s]+/).map(s => s.trim());
      cb.checked = allowedArr.includes(val);
    }
  });

  // 4. Điền phần tự luận
  const tuLuan = exam.duLieuDe?.tuLuan || {};
  const essayLinkInput = document.getElementById("essayFormLink");
  if (essayLinkInput) essayLinkInput.value = tuLuan.linkForm || "";

  if (Array.isArray(tuLuan.danhSachCauHoi) && tuLuan.danhSachCauHoi.length > 0) {
    parsedEssayQuestions = JSON.parse(JSON.stringify(tuLuan.danhSachCauHoi)).map(eq => ({
      ...eq,
      dapAn: eq.dapAn || eq.dapAnDung || ""
    }));
  } else if (tuLuan.noiDung && String(tuLuan.noiDung).trim().length > 0) {
    parsedEssayQuestions = [{ id: 1, noiDung: tuLuan.noiDung, diem: 1, dapAn: tuLuan.dapAn || tuLuan.dapAnDung || "" }];
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

  // 6. Tải danh sách câu hỏi trắc nghiệm vào trình chỉnh sửa
  parsedQuestions = JSON.parse(JSON.stringify(exam.duLieuDe?.cauHoi || []));
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

  document.getElementById("examDuration").value = "45";
  document.getElementById("rawExamText").value = "";
  const essayFormLinkInput = document.getElementById("essayFormLink");
  if (essayFormLinkInput) essayFormLinkInput.value = "";
  uploadedFileContentText = "";
  document.getElementById("fileUploadInfo").style.display = "none";
  document.getElementById("uploadDropzone").style.display = "block";
  parsedQuestions = [];
  renderQuestionsPreview([]);
}

/**
 * Xem nhanh toàn bộ đề thi trong Modal pop-up (Cố định chính giữa màn hình, chữ đậm nét tương phản cao)
 */
function previewExamModal(maDe) {
  const exam = currentExamsList.find(e => e.maDe === maDe);
  if (!exam) return;

  document.getElementById("modalStudentTitle").textContent = `Xem nhanh: [${exam.maDe}] ${exam.tenKyThi}`;
  const body = document.getElementById("modalStudentContent");
  body.innerHTML = `
    <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 0.95rem 1.25rem; margin-bottom: 1.25rem; font-size: 0.92rem; color: #1e3a8a; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        Thời gian: <strong style="color: #0f172a; font-weight: 800;">${exam.thoiGian} phút</strong> | 
        Lớp thi: <strong style="color: #1d4ed8; font-weight: 800;">${exam.lopChoPhep}</strong> | 
        Số lượng: <strong style="color: #1d4ed8; font-weight: 800;">${exam.soCauHoi} câu</strong>
      </div>
      <div>
        Trạng thái: <strong style="color: ${exam.trangThai === 'Mở' ? '#16a34a' : '#dc2626'}; font-weight: 800; background: #ffffff; padding: 0.2rem 0.65rem; border-radius: 6px; border: 1px solid #cbd5e1;">${exam.trangThai === 'Mở' ? '🟢 Đang Mở' : '🔴 Đang Đóng'}</strong>
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
          <div style="font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.55; margin-bottom: 0.85rem;">
            ${q.noiDung}
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
                  <td style="padding: 0.65rem 0.75rem; color: #0f172a; font-weight: 600; line-height: 1.45;">${y.noiDung}</td>
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
          <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 0.78rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 6px;">4 LỰA CHỌN</span>
              <strong style="color: #0f172a; font-size: 1.05rem; font-weight: 800;">Câu ${idx + 1}</strong>
            </div>
            <span style="font-size: 0.82rem; font-weight: 800; color: #1d4ed8; background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 0.2rem 0.65rem; border-radius: 6px;">${qDiem} đ</span>
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: #0f172a; line-height: 1.55; margin-bottom: 0.85rem;">
            ${q.noiDung}
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.65rem;">
            ${(q.luaChon || []).map(opt => {
              const isCorrect = String(opt.key).toUpperCase() === String(q.dapAnDung).toUpperCase();
              return `
                <div style="padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.95rem; line-height: 1.45; display: flex; align-items: flex-start; gap: 0.65rem; ${isCorrect ? 'background: #ecfdf5; border: 2px solid #059669; color: #065f46; font-weight: 700;' : 'background: #f8fafc; border: 1.5px solid #cbd5e1; color: #0f172a; font-weight: 600;'}">
                  <strong style="color: ${isCorrect ? '#059669' : '#1d4ed8'}; font-size: 1rem;">${opt.key}.</strong> 
                  <span style="flex: 1;">${opt.noiDung}</span>
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
  if (tuLuan && (tuLuan.noiDung || tuLuan.linkForm)) {
    const essayDiv = document.createElement("div");
    essayDiv.style.background = "#faf5ff";
    essayDiv.style.border = "1.5px dashed #a855f7";
    essayDiv.style.borderRadius = "10px";
    essayDiv.style.padding = "1.15rem";
    essayDiv.style.marginTop = "1rem";
    essayDiv.innerHTML = `
      <h4 style="color: #7e22ce; margin-bottom: 0.5rem; font-weight: 800;">📝 Phần Tự Luận:</h4>
      ${tuLuan.noiDung ? `<p style="font-size: 0.95rem; color: #0f172a; font-weight: 600; line-height: 1.55; margin-bottom: 0.6rem;">${tuLuan.noiDung}</p>` : ''}
      ${tuLuan.linkForm ? `<a href="${tuLuan.linkForm}" target="_blank" rel="noopener" style="color: #2563eb; text-decoration: underline; font-size: 0.9rem; font-weight: 700;">Mở Google Form làm bài tự luận ↗</a>` : ''}
    `;
    body.appendChild(essayDiv);
  }

  // Thêm nút Mở sửa ngay từ modal
  const footerBtn = document.createElement("div");
  footerBtn.style.marginTop = "1.5rem";
  footerBtn.style.textAlign = "right";
  footerBtn.innerHTML = `
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

  // 2. GỬI YÊU CẦU ĐỒNG BỘ NGẦM LÊN GOOGLE APPS SCRIPT
  let loadedFromServer = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "getTeacherExams",
        usernameGV: currentTeacher.username
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    if (rawText && !rawText.trim().startsWith("<")) {
      const data = JSON.parse(rawText);
      if (data && Array.isArray(data.exams)) {
        loadedFromServer = data.exams;
      }
    }
  } catch (postErr) {
    console.warn("Lỗi đồng bộ ngầm POST:", postErr.message);
  }

  // 3. Fallback GET nếu POST không có kết quả và chưa có dữ liệu hiển thị
  if (!loadedFromServer && (!currentExamsList || currentExamsList.length === 0)) {
    try {
      const getUrl = `${API_URL}?action=getTeacherExams&usernameGV=${encodeURIComponent(currentTeacher.username)}&_t=${Date.now()}`;
      const getRes = await fetch(getUrl);
      const getText = await getRes.text();
      if (getText && !getText.trim().startsWith("<")) {
        const data = JSON.parse(getText);
        if (data && Array.isArray(data.exams)) {
          loadedFromServer = data.exams;
        }
      }
    } catch (getErr) {
      console.warn("Lỗi đồng bộ ngầm GET:", getErr.message);
    }
  }

  // Tắt animation xoay nút Tải lại
  if (btnRefresh) {
    btnRefresh.classList.remove("is-loading");
  }

  // 4. Nếu máy chủ phản hồi danh sách mới -> Cập nhật bảng và lưu cache
  if (loadedFromServer) {
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
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><code class="exam-clickable-title" data-made="${exam.maDe}" title="Bấm để mở chỉnh sửa đề này" style="color: #60a5fa; font-weight: 700; cursor: pointer;">${exam.maDe}</code></td>
      <td>
        <strong class="exam-clickable-title" data-made="${exam.maDe}" title="Bấm để mở chỉnh sửa đề này" style="cursor: pointer;">${exam.tenKyThi}</strong>
        ${isFromCache ? '<span style="font-size: 0.68rem; margin-left: 6px; padding: 1px 5px; border-radius: 4px; background: #eff6ff; color: #1d4ed8; font-weight: 600;" title="Dữ liệu hiển thị tức thì">Sẵn sàng</span>' : '<span style="font-size: 0.68rem; margin-left: 6px; padding: 1px 5px; border-radius: 4px; background: #ecfdf5; color: #047857; font-weight: 600;" title="Đã đồng bộ Google Sheets">Google Sheets</span>'}
      </td>
      <td><span style="color: #a78bfa;">${exam.lopChoPhep}</span></td>
      <td>${exam.thoiGian} phút</td>
      <td>${exam.soCauHoi} câu</td>
      <td>${exam.hasTuLuan ? '<span style="color: #34d399;">Có tự luận</span>' : '<span style="color: #64748b;">Không</span>'}</td>
      <td>
        ${isReviewAllowed 
          ? '<span class="badge-table-review allowed" title="Học sinh được xem lại bài và đáp án sau khi nộp (Chế độ Ôn tập)">📖 Cho xem</span>' 
          : '<span class="badge-table-review locked" title="Học sinh bị khóa xem lại bài và đáp án (Chế độ Thi chính thức)">🔒 Khóa xem</span>'}
      </td>
      <td>
        <button type="button" class="btn-toggle-status ${isOpening ? 'active' : ''}" data-made="${exam.maDe}" data-status="${exam.trangThai}">
          ${isOpening ? '🟢 Đang Mở' : '🔴 Đang Đóng'}
        </button>
      </td>
      <td>
        <div class="table-actions-cell">
          <button type="button" class="btn-action-copy-link" data-made="${exam.maDe}" style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; font-weight: 700;" title="Sao chép link làm bài gửi học sinh (kết nối đúng Google Sheet của thầy/cô)">
            🔗 Link thi
          </button>
          <button type="button" class="btn-action-edit" data-made="${exam.maDe}" title="Mở lên giao diện để chỉnh sửa">
            ✏ Sửa đề
          </button>
          <button type="button" class="btn-action-view" data-made="${exam.maDe}" title="Xem toàn bộ câu hỏi và đáp án">
            👁 Xem
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
  // 0. Gắn sự kiện Sao chép link phòng thi gửi học sinh
  tbody.querySelectorAll(".btn-action-copy-link").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const maDe = e.currentTarget.dataset.made;
      const baseUrl = window.location.href.split("?")[0].replace("teacher_dashboard.html", "student_dashboard.html");
      const examLink = `${baseUrl}?server=${encodeURIComponent(API_URL)}&exam=${encodeURIComponent(maDe)}`;
      try {
        await navigator.clipboard.writeText(examLink);
        showToast("Đã chép link phòng thi! 🔗", `Đã copy link đề ${maDe}. Học sinh mở link sẽ nộp bài chuẩn 100% về Google Sheet của thầy/cô!`, "success", 5000);
      } catch (err) {
        prompt("Sao chép link làm bài gửi cho học sinh:", examLink);
      }
    });
  });

  // 1. Gắn sự kiện Mở chỉnh sửa đề thi
  tbody.querySelectorAll(".btn-action-edit, .exam-clickable-title").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      openExamForEditing(maDe);
    });
  });

  // 2. Gắn sự kiện Xem nhanh đề thi (Modal)
  tbody.querySelectorAll(".btn-action-view").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const maDe = e.currentTarget.dataset.made;
      previewExamModal(maDe);
    });
  });

  // 3. Gắn sự kiện nút toggle trạng thái nhanh
  tbody.querySelectorAll(".btn-toggle-status").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const maDe = e.target.dataset.made;
      const currentStatus = e.target.dataset.status;
      const nextStatus = currentStatus === "Mở" ? "Đóng" : "Mở";

      e.target.disabled = true;
      e.target.textContent = "Đang xử lý...";

      // Cập nhật trạng thái ngay lập tức trên Local Cache
      let cached = getCachedExams();
      const examItem = cached.find(ex => ex.maDe === maDe);
      if (examItem) {
        examItem.trangThai = nextStatus;
        saveCachedExams(cached);
      }

      await toggleExamStatusApi(maDe, nextStatus);
      showToast("Cập nhật", `Đã chuyển bài thi sang trạng thái: "${nextStatus}"`, "success", 2500);
      loadTeacherExams(false);
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

        // Xóa ngay trong Local Cache
        let cached = getCachedExams().filter(ex => ex.maDe !== maDe);
        saveCachedExams(cached);

        try {
          fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "deleteExam",
              maDe: maDe,
              usernameGV: currentTeacher.username
            })
          }).catch(() => {});
        } catch (e) {}

        showToast("Đã xóa thành công", `Đã xóa đề thi "${maDe}"!`, "success", 3000);
        loadTeacherExams(false);
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
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "toggleExamStatus",
        maDe: maDe,
        trangThai: newStatus,
        usernameGV: currentTeacher.username
      })
    });
    const text = await res.text();
    if (text && !text.trim().startsWith("<")) {
      return JSON.parse(text);
    }
    return { success: true };
  } catch (err) {
    return { success: true, message: err.message };
  }
}

// ============================================================================
// 8. TAB 2: XEM KẾT QUẢ VÀ THỐNG KÊ (DASHBOARD)
// ============================================================================
function updateFilterExamDropdown(exams) {
  const select = document.getElementById("selectFilterExam");
  select.innerHTML = `<option value="ALL">-- Tất cả bài kiểm tra (${exams.length} đề) --</option>`;
  exams.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.maDe;
    opt.textContent = `[${ex.maDe}] ${ex.tenKyThi}`;
    select.appendChild(opt);
  });
}

document.getElementById("btnFilterResults").addEventListener("click", () => {
  const selectedMaDe = document.getElementById("selectFilterExam").value;
  loadTeacherResults(selectedMaDe);
});

async function loadTeacherResults(filterMaDe = "ALL") {
  const tbody = document.getElementById("resultsTableBody");
  tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Đang tải bảng điểm kết quả...</td></tr>`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "getTeacherResults",
        usernameGV: currentTeacher.username,
        maDe: filterMaDe
      })
    });

    const data = await res.json();
    currentResultsList = data.results || [];

    // Tính toán KPI
    computeAndRenderMetrics(currentResultsList);

    // Render bảng học sinh
    renderResultsTable(currentResultsList);

  } catch (err) {
    console.error("Lỗi lấy kết quả thi:", err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #f87171;">Lỗi tải kết quả: ${err.message}</td></tr>`;
  }
}

function computeAndRenderMetrics(results) {
  const total = results.length;
  document.getElementById("metricTotalSubmissions").textContent = total;

  if (total === 0) {
    document.getElementById("metricAvgScore").textContent = "0.0";
    document.getElementById("metricHighLow").textContent = "0.0 / 0.0";
    document.getElementById("metricPassRate").textContent = "0%";
    return;
  }

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  let passedCount = 0;

  results.forEach(r => {
    const score = Number(r.diemTong) || 0;
    sum += score;
    if (score > max) max = score;
    if (score < min) min = score;
    if (score >= 5.0) passedCount++;
  });

  const avg = total > 0 ? (Math.round((sum / total) * 100) / 100) : 0;
  const passRate = total > 0 ? Math.round((passedCount / total) * 100) : 0;
  const displayMax = total > 0 ? (Math.round(max * 100) / 100) : 0;
  const displayMin = total > 0 ? (Math.round(min * 100) / 100) : 0;

  document.getElementById("metricAvgScore").textContent = avg;
  document.getElementById("metricHighLow").textContent = `${displayMax} / ${displayMin}`;
  document.getElementById("metricPassRate").textContent = `${passRate}%`;
}

function renderResultsTable(results) {
  const tbody = document.getElementById("resultsTableBody");
  if (!results || results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Chưa có học sinh nào nộp bài cho kỳ thi này.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  results.forEach((row, idx) => {
    const score = Number(row.diemTong) || 0;
    const displayScore = Math.round(score * 100) / 100;
    let badgeClass = "low";
    if (score >= 8.0) badgeClass = "high";
    else if (score >= 5.0) badgeClass = "med";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${row.lop}</strong></td>
      <td>${row.hoTen}</td>
      <td>${row.ngaySinh}</td>
      <td>${row.gioiTinh}</td>
      <td><span class="score-badge ${badgeClass}">${displayScore}</span></td>
      <td>${row.soCauDungSai || "--"}</td>
      <td style="font-size: 0.8rem; color: #94a3b8;">${row.thoiGianNop}</td>
      <td>
        <button type="button" class="btn-secondary-sm btn-view-detail" data-index="${idx}">
          Xem bài làm
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Gắn sự kiện xem modal chi tiết bài làm
  tbody.querySelectorAll(".btn-view-detail").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.index);
      openStudentDetailModal(results[idx]);
    });
  });
}

// Tìm kiếm nhanh học sinh
document.getElementById("searchStudentInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = currentResultsList.filter(r => 
    (r.hoTen && r.hoTen.toLowerCase().includes(query)) ||
    (r.lop && r.lop.toLowerCase().includes(query)) ||
    (r.usernameHS && r.usernameHS.toLowerCase().includes(query))
  );
  renderResultsTable(filtered);
});

// ============================================================================
// 9. XUẤT FILE EXCEL (.XLSX) VỚI SHEETJS
// ============================================================================
document.getElementById("btnExportExcel").addEventListener("click", () => {
  if (!currentResultsList || currentResultsList.length === 0) {
    showToast("Không có dữ liệu", "Không có kết quả nào để xuất file Excel!", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Lỗi", "Thư viện SheetJS chưa được nạp!", "error");
    return;
  }

  // Định dạng dữ liệu bảng tính
  const exportData = currentResultsList.map((row, idx) => ({
    "STT": idx + 1,
    "Mã Học Sinh": row.usernameHS,
    "Họ và Tên": row.hoTen,
    "Lớp": row.lop,
    "Ngày Sinh": row.ngaySinh,
    "Giới Tính": row.gioiTinh,
    "Trường": row.truong,
    "Mã Đề Thi": row.maDe,
    "Điểm Tổng": row.diemTong,
    "Số Câu Đúng": row.soCauDungSai,
    "Thời Gian Nộp": row.thoiGianNop
  }));

  // Tạo worksheet và workbook
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Diem_Trac_Nghiem");

  // Đặt tên file xuất
  const selectedMaDe = document.getElementById("selectFilterExam").value;
  const fileName = `Bang_Diem_Trac_Nghiem_${selectedMaDe}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
  showToast("Thành công", `Đã xuất file Excel trắc nghiệm: ${fileName}`, "success");
});

// ============================================================================
// 9.1. XUẤT FILE EXCEL PHẦN TỰ LUẬN (.XLSX) ĐỂ GIÁO VIÊN CHẤM NHANH
// ============================================================================
function exportEssayResultsExcel() {
  if (!currentResultsList || currentResultsList.length === 0) {
    showToast("Không có dữ liệu", "Không có kết quả bài thi nào để xuất file tự luận!", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showToast("Lỗi", "Thư viện SheetJS chưa được nạp!", "error");
    return;
  }

  const selectedMaDe = document.getElementById("selectFilterExam").value;
  let targetResults = currentResultsList;
  if (selectedMaDe && selectedMaDe !== "ALL") {
    targetResults = currentResultsList.filter(r => r.maDe === selectedMaDe);
  }

  if (targetResults.length === 0) {
    showToast("Không có bài nộp", `Không tìm thấy bài thi nào cho mã đề ${selectedMaDe}!`, "warning");
    return;
  }

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
      "Ngày Sinh": row.ngaySinh || "",
      "Giới Tính": row.gioiTinh || "",
      "Trường": row.truong || "",
      "Mã Đề Thi": row.maDe || "",
      "Thời Gian Nộp": row.thoiGianNop || ""
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
      const foundAns = essayAnswers.find(a => (a.id || 0) == c);
      if (foundAns) {
        ansText = foundAns.baiLam || foundAns.traLoi || "";
      } else if (essayAnswers[c - 1]) {
        ansText = essayAnswers[c - 1].baiLam || essayAnswers[c - 1].traLoi || "";
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

  const fileName = `Bang_Cham_Tu_Luan_${selectedMaDe}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    return a.localeCompare(b);
  });

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
    const cacheData = {
      timestamp: Date.now(),
      lopGiangDay: String(currentTeacher.lopGiangDay || "").trim().toUpperCase(),
      classes: classes || [],
      students: students || []
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

    // Thử gửi POST
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "getStudentsForTeacher",
          usernameGV: currentTeacher.username
        })
      });

      const rawText = await response.text();
      if (rawText && !rawText.trim().startsWith("<")) {
        result = JSON.parse(rawText);
      } else {
        console.warn("POST trả về HTML, tự động chuyển sang chế độ GET fallback...");
      }
    } catch (postErr) {
      console.warn("Lỗi POST, thử GET fallback:", postErr);
    }

    // Tự động fallback sang GET nếu POST bị Google Redirect HTML
    if (!result || !result.success) {
      const getUrl = `${API_URL}?action=getStudentsForTeacher&usernameGV=${encodeURIComponent(currentTeacher.username)}&_t=${Date.now()}`;
      const getResponse = await fetch(getUrl);
      const getRawText = await getResponse.text();

      if (getRawText && !getRawText.trim().startsWith("<")) {
        result = JSON.parse(getRawText);
      } else {
        console.error("Dữ liệu từ Google Apps Script:", getRawText.slice(0, 300));
        throw new Error("Phản hồi từ Google Apps Script chứa trang HTML. Vui lòng kiểm tra quyền Deploy Web App thành 'Anyone'.");
      }
    }

    if (!result || !result.success) {
      throw new Error(result?.message || "Không thể tải danh sách học sinh từ Google Sheets.");
    }

    currentTeacherStudents = result.students || [];

    // LƯU VÀO BỘ NHỚ TRÌNH DUYỆT (LOCALSTORAGE CACHE) ĐỂ CÁC LẦN SAU MỞ TỨC THÌ
    saveCachedTeacherStudents(currentTeacherStudents, result.classes || []);

    // Xây dựng danh sách Checkboxes Khối & Lớp
    buildGradeAndClassFilters(result.classes || []);

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
function renderStudentsTable(students) {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;

  if (!students || students.length === 0) {
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

  let html = "";
  students.forEach((st, idx) => {
    let dobText = st.ngaySinh || "-";
    if (dobText && typeof dobText === "string") {
      dobText = dobText.trim();
      // Bỏ phần giờ nếu có (VD: "15/05/2010 00:00:00" -> "15/05/2010")
      if (dobText.includes(" ")) {
        dobText = dobText.split(" ")[0];
      }
      if (dobText.includes("T")) {
        const d = new Date(dobText);
        if (!isNaN(d.getTime())) {
          dobText = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
        }
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dobText)) {
        const parts = dobText.split("-");
        dobText = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

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
        <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
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
          <button type="button" class="btn-action-change-pwd" data-username="${safeUsername}" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 10px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Đổi MK</span>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
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

  // 8. Xử lý click trong bảng học sinh (Hiện/Ẩn MK, Copy MK, Đổi MK)
  const tbody = document.getElementById("studentsTableBody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
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
    let dobText = st.ngaySinh || "";
    if (dobText && typeof dobText === "string") {
      if (dobText.includes("T")) {
        const d = new Date(dobText);
        if (!isNaN(d.getTime())) {
          dobText = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
        }
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dobText.trim())) {
        const parts = dobText.trim().split("-");
        dobText = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

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

