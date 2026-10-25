/**
 * ============================================================================
 * BACKGROUND MUSIC SYSTEM - EDUTEST PRO 2.0
 * Icon Cái Loa Nhỏ Phía Trên Bên Phải (Gọn gàng & Hiện Popup Đầy Đủ Tính Năng)
 * Tự động phát nhạc nhẹ 30% khi đã đăng nhập (Giáo viên & Học sinh)
 * Danh sách phát ngẫu nhiên: "Love Story" & "Sealed With a Kiss"
 * ============================================================================
 */

(function () {
  "use strict";

  // Danh sách nhạc nền (Hỗ trợ phát ngẫu nhiên, xoay vòng khi hết bài hoặc đổi bài)
  const PLAYLIST = [
    {
      id: "lovestory",
      title: "Love Story",
      artist: "Taylor Swift (Du dương)",
      src: encodeURI("love story.mp3")
    },
    {
      id: "sealedwithakiss",
      title: "Sealed With a Kiss",
      artist: "Brian Hyland (Du dương)",
      src: encodeURI("Sealed with a kiss.m4a")
    }
  ];

  const DEFAULT_VOLUME = 0.3; // Mặc định 30% âm lượng theo yêu cầu

  // Chọn ngẫu nhiên 1 trong 2 bài khi mở trang
  let currentTrackIndex = Math.floor(Math.random() * PLAYLIST.length);
  let bgAudio = null;
  let isPlaying = false;
  let isMuted = false;
  let currentVolume = DEFAULT_VOLUME;
  let isPopoverOpen = false;

  /**
   * Lấy thông tin bản nhạc đang chọn
   */
  function getCurrentTrack() {
    return PLAYLIST[currentTrackIndex] || PLAYLIST[0];
  }

  /**
   * Kiểm tra phiên đăng nhập hợp lệ
   */
  function isUserLoggedIn() {
    try {
      const user = localStorage.getItem("currentUser");
      const role = localStorage.getItem("userRole");
      return !!(user && (role === "GV" || role === "HS"));
    } catch (e) {
      return false;
    }
  }

  /**
   * Khởi tạo đối tượng Audio
   */
  function initAudio() {
    if (bgAudio) return;

    const track = getCurrentTrack();
    bgAudio = new Audio(track.src);
    bgAudio.loop = false; // Tắt loop bài đơn để kích hoạt event 'ended' tự động chuyển bài
    bgAudio.preload = "auto";

    // Luôn luôn cố định mặc định âm lượng ở mức 30% (0.3) theo đúng yêu cầu
    currentVolume = DEFAULT_VOLUME;
    bgAudio.volume = currentVolume;
    try {
      localStorage.setItem("edutest_bg_music_vol", "0.3");
    } catch (e) {}

    bgAudio.addEventListener("play", () => {
      isPlaying = true;
      updateUI();
    });

    bgAudio.addEventListener("pause", () => {
      isPlaying = false;
      updateUI();
    });

    bgAudio.addEventListener("volumechange", () => {
      isMuted = bgAudio.muted || bgAudio.volume === 0;
      updateVolumeDisplay();
    });

    // Khi phát hết bài -> Tự động chuyển tiếp sang bản nhạc tiếp theo
    bgAudio.addEventListener("ended", () => {
      switchTrack((currentTrackIndex + 1) % PLAYLIST.length, true);
    });

    // Bắt lỗi nếu có vấn đề đọc file
    bgAudio.addEventListener("error", (e) => {
      console.warn("[EduTest Music] Lỗi tải file nhạc:", getCurrentTrack().title, e);
    });
  }

  /**
   * Chuyển đổi bài hát (chuyển sang bài tiếp theo hoặc chỉ định vị trí bài)
   */
  function switchTrack(targetIndex, forcePlay = true) {
    if (!bgAudio) initAudio();

    const wasPlaying = isPlaying;
    if (typeof targetIndex === "number") {
      currentTrackIndex = (targetIndex + PLAYLIST.length) % PLAYLIST.length;
    } else {
      currentTrackIndex = (currentTrackIndex + 1) % PLAYLIST.length;
    }

    const nextTrack = getCurrentTrack();

    try {
      bgAudio.pause();
    } catch (e) {}

    bgAudio.src = nextTrack.src;
    bgAudio.currentTime = 0;
    bgAudio.volume = currentVolume;

    updateTrackInfoDisplay();

    if (forcePlay || wasPlaying) {
      const playPromise = bgAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isPlaying = true;
            updateUI();
          })
          .catch((err) => {
            console.log("[EduTest Music] Tự động phát khi đổi bài:", err);
            updateUI();
          });
      }
    } else {
      updateUI();
    }
  }

  /**
   * Bắt đầu phát với hiệu ứng Fade-in du dương (0 -> 30%)
   */
  function startPlaybackWithFadeIn() {
    if (!bgAudio) initAudio();

    const targetVol = currentVolume;
    bgAudio.volume = 0;

    const playPromise = bgAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          let vol = 0;
          const step = 0.02;
          const fadeTimer = setInterval(() => {
            if (!bgAudio || bgAudio.paused) {
              clearInterval(fadeTimer);
              return;
            }
            vol += step;
            if (vol >= targetVol) {
              bgAudio.volume = targetVol;
              clearInterval(fadeTimer);
            } else {
              bgAudio.volume = vol;
            }
          }, 60);

          removeInteractionListeners();
          updateUI();
        })
        .catch((err) => {
          console.log("[EduTest Music] Chờ tương tác người dùng để phát:", err);
          const wrapper = document.getElementById("navMusicWidgetWrapper");
          if (wrapper) wrapper.classList.add("waiting-interaction");
          setupInteractionListeners();
        });
    }
  }

  /**
   * Phát nhạc ngay tại tương tác đầu tiên nếu bị trình duyệt chặn autoplay
   */
  function onUserGesture() {
    if (bgAudio && bgAudio.paused) {
      bgAudio.volume = currentVolume;
      bgAudio.play().then(() => {
        isPlaying = true;
        removeInteractionListeners();
        const wrapper = document.getElementById("navMusicWidgetWrapper");
        if (wrapper) wrapper.classList.remove("waiting-interaction");
        updateUI();
      }).catch((e) => console.log(e));
    }
  }

  function setupInteractionListeners() {
    window.addEventListener("click", onUserGesture, { once: true });
    window.addEventListener("keydown", onUserGesture, { once: true });
    window.addEventListener("touchstart", onUserGesture, { once: true });
  }

  function removeInteractionListeners() {
    window.removeEventListener("click", onUserGesture);
    window.removeEventListener("keydown", onUserGesture);
    window.removeEventListener("touchstart", onUserGesture);
  }

  /**
   * Toggle Play / Pause
   */
  function togglePlay() {
    if (!bgAudio) initAudio();

    if (bgAudio.paused) {
      bgAudio.play().catch(e => console.error(e));
    } else {
      bgAudio.pause();
    }
  }

  /**
   * Toggle Mute / Unmute
   */
  function toggleMute() {
    if (!bgAudio) return;
    bgAudio.muted = !bgAudio.muted;
    isMuted = bgAudio.muted;
    updateVolumeDisplay();
  }

  /**
   * Đặt âm lượng (0 - 100%)
   */
  function setVolume(valPercent) {
    if (!bgAudio) return;
    const vol = Math.max(0, Math.min(1, valPercent / 100));
    currentVolume = vol;
    bgAudio.volume = vol;
    if (bgAudio.muted && vol > 0) {
      bgAudio.muted = false;
    }
    localStorage.setItem("edutest_bg_music_vol", vol.toString());
    updateVolumeDisplay();
  }

  /**
   * Toggle hiển thị Popover
   */
  function togglePopover(show) {
    const popover = document.getElementById("navMusicPopover");
    if (!popover) return;

    if (typeof show === "boolean") {
      isPopoverOpen = show;
    } else {
      isPopoverOpen = !isPopoverOpen;
    }

    if (isPopoverOpen) {
      popover.classList.add("is-open");
    } else {
      popover.classList.remove("is-open");
    }
  }

  /**
   * Cập nhật thông tin bài hát hiển thị
   */
  function updateTrackInfoDisplay() {
    const track = getCurrentTrack();
    const popoverTitle = document.getElementById("popoverTrackTitle");
    const vinylDisc = document.querySelector(".popover-vinyl-disc");

    if (popoverTitle) {
      popoverTitle.textContent = `🎵 ${track.title}`;
    }
    if (vinylDisc) {
      vinylDisc.title = `Đang phát: ${track.title}`;
    }
  }

  /**
   * Cập nhật trạng thái hiển thị của Widget Loa và Popover
   */
  function updateUI() {
    const wrapper = document.getElementById("navMusicWidgetWrapper");
    if (!wrapper) return;

    const track = getCurrentTrack();
    const speakerBtn = document.getElementById("btnNavSpeaker");
    const popoverIconPlay = document.getElementById("popoverIconPlay");
    const popoverIconPause = document.getElementById("popoverIconPause");
    const popoverBtnPlayText = document.getElementById("popoverBtnPlayText");
    const popoverSub = document.getElementById("popoverTrackSub");

    updateTrackInfoDisplay();

    const effectivePercent = Math.round(currentVolume * 100);

    if (isPlaying) {
      wrapper.classList.add("is-playing");
      wrapper.classList.remove("waiting-interaction");

      if (popoverIconPlay) popoverIconPlay.style.display = "none";
      if (popoverIconPause) popoverIconPause.style.display = "block";
      if (popoverBtnPlayText) popoverBtnPlayText.textContent = "Tạm dừng";

      if (speakerBtn) {
        speakerBtn.title = `🎵 Đang phát: ${track.title} (${effectivePercent}%) - Bấm để tùy chỉnh`;
      }
      if (popoverSub) {
        popoverSub.textContent = `${track.artist} • ${effectivePercent}%`;
      }
    } else {
      wrapper.classList.remove("is-playing");

      if (popoverIconPlay) popoverIconPlay.style.display = "block";
      if (popoverIconPause) popoverIconPause.style.display = "none";
      if (popoverBtnPlayText) popoverBtnPlayText.textContent = "Phát nhạc";

      if (speakerBtn) {
        speakerBtn.title = `🔇 Nhạc nền: ${track.title} (Đang tạm dừng) - Bấm để mở`;
      }
      if (popoverSub) {
        popoverSub.textContent = `Tạm dừng • Bấm phát`;
      }
    }

    updateVolumeDisplay();
  }

  /**
   * Cập nhật hiển thị Âm lượng & Icon Loa
   */
  function updateVolumeDisplay() {
    const iconHigh = document.getElementById("speakerIconHigh");
    const iconMute = document.getElementById("speakerIconMute");
    const popoverIconMuteHigh = document.getElementById("popoverIconMuteHigh");
    const popoverIconMuteOff = document.getElementById("popoverIconMuteOff");
    const volSlider = document.getElementById("popoverVolSlider");
    const volPercentText = document.getElementById("popoverVolPercentText");
    const popoverSub = document.getElementById("popoverTrackSub");
    const track = getCurrentTrack();

    const isSilent = (bgAudio && bgAudio.muted) || currentVolume === 0;
    const effectivePercent = isSilent ? 0 : Math.round(currentVolume * 100);

    if (volSlider) volSlider.value = effectivePercent;
    if (volPercentText) volPercentText.textContent = `${effectivePercent}%`;

    // Cập nhật trạng thái các nút preset (15%, 30%, 50%, 80%)
    const presets = document.querySelectorAll(".btn-vol-preset");
    presets.forEach((btn) => {
      const pVal = Number(btn.getAttribute("data-val"));
      if (!isSilent && Math.abs(pVal - effectivePercent) <= 3) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });

    if (isSilent) {
      if (iconHigh) iconHigh.style.display = "none";
      if (iconMute) iconMute.style.display = "block";
      if (popoverIconMuteHigh) popoverIconMuteHigh.style.display = "none";
      if (popoverIconMuteOff) popoverIconMuteOff.style.display = "block";
      if (popoverSub && isPlaying) popoverSub.textContent = "Đang tắt tiếng (Mute)";
    } else {
      if (iconHigh) iconHigh.style.display = "block";
      if (iconMute) iconMute.style.display = "none";
      if (popoverIconMuteHigh) popoverIconMuteHigh.style.display = "block";
      if (popoverIconMuteOff) popoverIconMuteOff.style.display = "none";
      if (popoverSub && isPlaying) popoverSub.textContent = `${track.artist} • ${effectivePercent}%`;
    }
  }

  /**
   * Gắn Widget Icon Loa vào phía trên bên phải (Navbar)
   */
  function renderSpeakerWidget() {
    if (document.getElementById("navMusicWidgetWrapper")) return;

    const curTrack = getCurrentTrack();
    const widget = document.createElement("div");
    widget.id = "navMusicWidgetWrapper";
    widget.className = "nav-music-widget-wrapper";

    widget.innerHTML = `
      <!-- Nút Icon Hình Cái Loa Nhỏ -->
      <button type="button" class="btn-nav-speaker" id="btnNavSpeaker" title="Nhạc nền du dương: ${curTrack.title} (Bấm để tùy chỉnh)">
        <!-- Icon Loa Phát Tiếng -->
        <svg id="speakerIconHigh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <!-- Icon Loa Tắt Tiếng -->
        <svg id="speakerIconMute" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
        <!-- Chấm đèn phát sóng tín hiệu khi đang chạy -->
        <span class="speaker-pulse-dot" aria-hidden="true"></span>
      </button>

      <!-- Popup Bảng Điều Khiển Đầy Đủ Tính Năng khi Nhấp Vào -->
      <div class="nav-music-popover" id="navMusicPopover" role="dialog" aria-label="Bảng điều khiển nhạc nền">
        
        <!-- Header Popover -->
        <div class="popover-header">
          <div class="popover-header-left">
            <!-- Đĩa than xoay -->
            <div class="popover-vinyl-disc" title="Đang phát: ${curTrack.title}">
              <div class="popover-vinyl-center">♪</div>
            </div>
            <!-- Tên bài hát & Trạng thái -->
            <div class="popover-track-info">
              <span class="popover-track-title" id="popoverTrackTitle">🎵 ${curTrack.title}</span>
              <span class="popover-track-sub" id="popoverTrackSub">${curTrack.artist} • 30%</span>
            </div>
          </div>

          <!-- Sóng Equalizer & Nút Đóng -->
          <div class="popover-eq-bars" aria-hidden="true">
            <span class="popover-eq-bar b-1"></span>
            <span class="popover-eq-bar b-2"></span>
            <span class="popover-eq-bar b-3"></span>
            <span class="popover-eq-bar b-4"></span>
          </div>
          <button type="button" class="btn-close-popover" id="btnClosePopover" title="Đóng bảng nhạc">✕</button>
        </div>

        <!-- Cụm nút Play / Pause & Đổi bài ngẫu nhiên & Mute -->
        <div class="popover-main-controls">
          <button type="button" class="btn-popover-play" id="btnPopoverPlay" title="Phát hoặc Tạm dừng">
            <svg id="popoverIconPlay" style="display:none;" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"/>
            </svg>
            <svg id="popoverIconPause" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1.5"/>
              <rect x="14" y="4" width="4" height="16" rx="1.5"/>
            </svg>
            <span id="popoverBtnPlayText">Tạm dừng</span>
          </button>

          <!-- Nút Đổi bài tiếp theo (Next / Shuffle) -->
          <button type="button" class="btn-popover-next" id="btnPopoverNext" title="Chuyển sang bài tiếp theo (Love Story ↔ Sealed With a Kiss)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          <button type="button" class="btn-popover-mute" id="btnPopoverMute" title="Tắt / Bật nhanh tiếng">
            <svg id="popoverIconMuteHigh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <svg id="popoverIconMuteOff" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>
        </div>

        <!-- Thanh kéo Âm Lượng -->
        <div class="popover-volume-section">
          <div class="volume-row-top">
            <span>Âm lượng</span>
            <span id="popoverVolPercentText" style="color: #0284c7;">30%</span>
          </div>
          <input type="range" id="popoverVolSlider" class="popover-vol-slider" min="0" max="100" value="30" aria-label="Âm lượng nhạc nền" />
          
          <!-- Các nấc âm lượng nhanh -->
          <div class="popover-vol-presets">
            <button type="button" class="btn-vol-preset" data-val="15">15% Nhẹ</button>
            <button type="button" class="btn-vol-preset is-active" data-val="30">30% Chuẩn</button>
            <button type="button" class="btn-vol-preset" data-val="50">50% Vừa</button>
            <button type="button" class="btn-vol-preset" data-val="80">80% To</button>
          </div>
        </div>

        <!-- Ghi chú chân bảng -->
        <p class="popover-footer-tip">
          🎶 Tự động phát ngẫu nhiên: <b>Love Story</b> &amp; <b>Sealed With a Kiss</b>.
        </p>

      </div>
    `;

    // Định vị gắn vào phía trên bên phải:
    // Tìm cụm .nav-user (ở cả bên Giáo viên & Học sinh), chèn vào ngay trước nút #btnLogout
    const navUser = document.querySelector(".nav-user");
    const btnLogout = document.getElementById("btnLogout");

    if (navUser && btnLogout) {
      navUser.insertBefore(widget, btnLogout);
    } else if (navUser) {
      navUser.appendChild(widget);
    } else {
      // Dự phòng nếu không có .nav-user (gắn góc trên bên phải trang)
      widget.classList.add("fallback-fixed");
      document.body.appendChild(widget);
    }

    // Gắn sự kiện nút Loa
    const btnSpeaker = document.getElementById("btnNavSpeaker");
    const btnClose = document.getElementById("btnClosePopover");
    const btnPlay = document.getElementById("btnPopoverPlay");
    const btnNext = document.getElementById("btnPopoverNext");
    const btnMute = document.getElementById("btnPopoverMute");
    const slider = document.getElementById("popoverVolSlider");
    const presets = document.querySelectorAll(".btn-vol-preset");

    if (btnSpeaker) {
      btnSpeaker.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover();
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(false);
      });
    }

    if (btnPlay) {
      btnPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
      });
    }

    if (btnNext) {
      btnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        switchTrack();
      });
    }

    if (btnMute) {
      btnMute.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMute();
      });
    }

    if (slider) {
      slider.addEventListener("input", (e) => {
        setVolume(Number(e.target.value));
      });
    }

    presets.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = Number(btn.getAttribute("data-val"));
        setVolume(v);
      });
    });

    // Ngăn click bên trong popover làm đóng popover
    const popoverEl = document.getElementById("navMusicPopover");
    if (popoverEl) {
      popoverEl.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // Đóng popover khi click ra ngoài
    document.addEventListener("click", () => {
      if (isPopoverOpen) {
        togglePopover(false);
      }
    });
  }

  /**
   * Tự động tắt nhạc khi người dùng bấm Đăng xuất
   */
  function hookLogout() {
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        if (bgAudio) {
          bgAudio.pause();
          bgAudio.currentTime = 0;
        }
      });
    }
  }

  /**
   * Khởi chạy hệ thống nhạc nền
   */
  function startMusicSystem() {
    if (!isUserLoggedIn()) return;

    initAudio();
    renderSpeakerWidget();
    startPlaybackWithFadeIn();
    hookLogout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMusicSystem);
  } else {
    startMusicSystem();
  }

  window.EduTestMusic = {
    play: () => { if (bgAudio) bgAudio.play(); },
    pause: () => { if (bgAudio) bgAudio.pause(); },
    next: () => switchTrack(),
    setVolume: setVolume,
    toggle: togglePlay,
    openPopover: () => togglePopover(true),
    closePopover: () => togglePopover(false),
    getTrack: () => getCurrentTrack(),
    getPlaylist: () => PLAYLIST
  };

})();
