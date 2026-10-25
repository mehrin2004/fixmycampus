// Base URL: since the frontend is served by the same Express server, relative paths work.
// If you serve the frontend separately (e.g. Live Server), change this to 'http://localhost:5000'.
const API_BASE = '';

// Register the service worker so the app is installable and has an offline app shell across all networks.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

/* ---------- Network Status & Offline Resilience Engine ---------- */
const NetworkManager = {
  init() {
    window.addEventListener('online', () => {
      this.removeOfflineBanner();
      const connInfo = this.getConnectionInfo();
      Toast.success(`Online 🟢 Connected to network (${connInfo})!`);
    });
    window.addEventListener('offline', () => {
      this.showOfflineBanner();
      Toast.warning('Offline 📡 Connection lost. Working from offline cache.');
    });

    // Monitor network quality changes across mobile connections (2G, 3G, 4G, Wi-Fi)
    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        const info = this.getConnectionInfo();
        if (navigator.onLine && info) {
          console.log('Network condition update:', info);
        }
      });
    }

    document.addEventListener('DOMContentLoaded', () => {
      if (!navigator.onLine) {
        this.showOfflineBanner();
      }
    });
  },
  getConnectionInfo() {
    if (!navigator.connection) return 'Active';
    const type = navigator.connection.effectiveType || navigator.connection.type || '';
    return type ? type.toUpperCase() : 'Mobile/Wi-Fi';
  },
  showOfflineBanner() {
    let banner = document.getElementById('offlineBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offlineBanner';
      banner.className = 'offline-alert-banner';
      banner.innerHTML = `📡 You are currently offline. FixMyCampus works from offline cache & syncs automatically.`;
      document.body.prepend(banner);
    }
  },
  removeOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (banner) banner.remove();
  }
};
NetworkManager.init();

const Auth = {
  getToken() { return localStorage.getItem('fmc_token'); },
  getUser() {
    const raw = localStorage.getItem('fmc_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('fmc_token', token);
    localStorage.setItem('fmc_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('fmc_token');
    localStorage.removeItem('fmc_user');
  },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  },
  // Redirects to login if not authenticated. Call at the top of protected pages.
  requireStudent() {
    if (!this.isLoggedIn() || this.isAdmin()) {
      window.location.href = 'login.html';
    }
  },
  requireAdmin() {
    if (!this.isLoggedIn() || !this.isAdmin()) {
      window.location.href = 'admin-login.html';
    }
  },
  logout(redirectTo = 'welcome.html') {
    this.clearSession();
    window.location.href = redirectTo;
  }
};

// Generic fetch wrapper that attaches the JWT and parses JSON responses.
async function apiRequest(path, { method = 'GET', body = null, isFormData = false } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
  });

  let data;
  try { data = await res.json(); } catch (e) { data = {}; }

  if (!res.ok) {
    if (res.status === 401 || (res.status === 403 && data.message && data.message.toLowerCase().includes('token'))) {
      const wasAdmin = Auth.isAdmin();
      Auth.clearSession();
      const currentPath = window.location.pathname;
      if (!currentPath.endsWith('login.html') && !currentPath.endsWith('welcome.html') && !currentPath.endsWith('register.html') && !currentPath.endsWith('admin-login.html')) {
        Toast.error('Session expired. Please log in again.');
        setTimeout(() => {
          window.location.href = wasAdmin ? 'admin-login.html' : 'login.html';
        }, 600);
      }
    }
    const err = new Error(data.message || 'Something went wrong.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const Api = {
  register: (payload) => apiRequest('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => apiRequest('/api/auth/login', { method: 'POST', body: payload }),
  adminLogin: (payload) => apiRequest('/api/auth/admin-login', { method: 'POST', body: payload }),
  getProfile: () => apiRequest('/api/auth/profile'),
  updateProfile: (payload) => apiRequest('/api/auth/profile', { method: 'PUT', body: payload }),

  createComplaint: (formData) => apiRequest('/api/complaints', { method: 'POST', body: formData, isFormData: true }),
  getMyComplaints: () => apiRequest('/api/complaints/my'),
  getMyStats: () => apiRequest('/api/complaints/stats/summary'),
  getComplaint: (id) => apiRequest(`/api/complaints/${id}`),

  getAdminStats: () => apiRequest('/api/admin/stats'),
  getAllComplaints: (query = '') => apiRequest(`/api/admin/complaints${query}`),
  updateComplaint: (id, payload, isFormData = false) => apiRequest(`/api/admin/complaints/${id}`, { method: 'PUT', body: payload, isFormData }),

  getNotifications: () => apiRequest('/api/notifications'),
  markNotificationsRead: () => apiRequest('/api/notifications/read', { method: 'PUT' }),
  markNotificationRead: (id) => apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' })
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function statusClass(status) {
  return status.replace(' ', '-');
}

/* ---------- Theme & View Mode Engine ---------- */
const ThemeManager = {
  getTheme() {
    return localStorage.getItem('fmc_theme') || 'light';
  },
  setTheme(theme) {
    localStorage.setItem('fmc_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.updateToggleIcon();
  },
  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    Toast.info(`Switched to ${next === 'dark' ? 'Dark 🌙' : 'Light ☀️'} Theme`);
  },
  getViewMode() {
    return localStorage.getItem('fmc_viewmode') || 'phone';
  },
  setViewMode(mode) {
    localStorage.setItem('fmc_viewmode', mode);
    const screen = document.querySelector('.phone-screen');
    if (screen) {
      if (mode === 'desktop') {
        screen.classList.add('desktop-wide');
      } else {
        screen.classList.remove('desktop-wide');
      }
    }
    this.updateViewModeIcon();
  },
  toggleViewMode() {
    const current = this.getViewMode();
    const next = current === 'desktop' ? 'phone' : 'desktop';
    this.setViewMode(next);
    Toast.info(`Switched to ${next === 'desktop' ? 'Wide Desktop 🖥️' : 'Mobile Frame 📱'} View`);
  },
  updateToggleIcon() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = this.getTheme() === 'dark' ? '☀️' : '🌙';
      btn.title = this.getTheme() === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
  },
  updateViewModeIcon() {
    const btn = document.getElementById('viewModeToggleBtn');
    if (btn) {
      btn.innerHTML = this.getViewMode() === 'desktop' ? '📱' : '🖥️';
      btn.title = this.getViewMode() === 'desktop' ? 'Switch to Phone View' : 'Switch to Wide Desktop View';
    }
  },
  init() {
    document.documentElement.setAttribute('data-theme', this.getTheme());
    document.addEventListener('DOMContentLoaded', () => {
      this.setViewMode(this.getViewMode());
      this.injectTopbarActions();
      this.updateToggleIcon();
      this.updateViewModeIcon();
    });
  },
  injectTopbarActions() {
    const topbar = document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.topbar-actions')) {
      const actions = document.createElement('div');
      actions.className = 'topbar-actions';
      actions.innerHTML = `
        <button id="viewModeToggleBtn" class="topbar-btn" onclick="ThemeManager.toggleViewMode()" title="Toggle View Mode">🖥️</button>
        <button id="themeToggleBtn" class="topbar-btn" onclick="ThemeManager.toggleTheme()" title="Toggle Dark/Light Theme">🌙</button>
      `;
      const logo = topbar.querySelector('.topbar-logo');
      if (logo) {
        topbar.insertBefore(actions, logo);
      } else {
        topbar.appendChild(actions);
      }
    }
  }
};

ThemeManager.init();

/* ---------- Toast Notification Engine ---------- */
const Toast = {
  getContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    return container;
  },
  show(message, type = 'info', duration = 800) {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '⚠️',
      warning: '🔔',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span style="font-size:18px;">${icons[type] || '📌'}</span>
      <span style="flex:1; line-height:1.4;">${message}</span>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },
  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration) { this.show(msg, 'error', duration); },
  warning(msg, duration) { this.show(msg, 'warning', duration); },
  info(msg, duration) { this.show(msg, 'info', duration); }
};

/* ---------- Skeleton Loader Renderer ---------- */
function renderSkeletons(count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton-shimmer skeleton-thumb"></div>
        <div class="skeleton-info">
          <div class="skeleton-shimmer skeleton-line long"></div>
          <div class="skeleton-shimmer skeleton-line medium"></div>
          <div class="skeleton-shimmer skeleton-line short"></div>
        </div>
      </div>
    `;
  }
  return html;
}

/* ---------- Interactive Lightbox Image Zoom System ---------- */
const ImageViewer = {
  currentScale: 1,
  modalEl: null,
  imgEl: null,

  init() {
    if (document.getElementById('imageZoomModal')) return;

    const modal = document.createElement('div');
    modal.id = 'imageZoomModal';
    modal.className = 'image-zoom-modal';
    modal.innerHTML = `
      <button class="zoom-close-btn" id="zoomCloseBtn" title="Close Zoom View">✕</button>
      <div class="zoom-viewport" id="zoomViewport">
        <img src="" alt="Enlarged View" class="zoom-img-target" id="zoomImgTarget">
      </div>
      <div class="zoom-controls-bar">
        <button class="zoom-btn" id="zoomInBtn">🔍 Zoom In (+)</button>
        <button class="zoom-btn" id="zoomOutBtn">🔎 Zoom Out (-)</button>
        <button class="zoom-btn" id="zoomResetBtn">🔄 100% Reset</button>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;
    this.imgEl = document.getElementById('zoomImgTarget');

    document.getElementById('zoomCloseBtn').addEventListener('click', () => this.close());
    document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(0.3));
    document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(-0.3));
    document.getElementById('zoomResetBtn').addEventListener('click', () => this.reset());

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.id === 'zoomViewport') this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.classList.contains('active')) this.close();
    });

    // Attach global delegate listener for image clicks (including admin portal detail photos)
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img.preview, .complaint-thumb, .zoomable-img, .detail-photo, #currentResImg, #resPreviewImg, img[data-zoomable="true"], .content img');
      if (img && img.src && !img.src.includes('logo.png') && !img.classList.contains('topbar-logo') && !img.classList.contains('brand-logo-img')) {
        this.open(img.src);
      }
    });
  },

  open(src) {
    this.init();
    this.imgEl.src = src;
    this.reset();
    this.modalEl.classList.add('active');
  },

  close() {
    if (this.modalEl) this.modalEl.classList.remove('active');
  },

  zoom(delta) {
    this.currentScale = Math.min(Math.max(0.5, this.currentScale + delta), 4);
    this.imgEl.style.transform = `scale(${this.currentScale})`;
  },

  reset() {
    this.currentScale = 1;
    if (this.imgEl) this.imgEl.style.transform = 'scale(1)';
  }
};

/* ---------- Notification Bell & Drawer Engine ---------- */
const NotificationSystem = {
  drawerEl: null,
  bellBtnEl: null,
  badgeEl: null,

  async init() {
    if (!Auth.isLoggedIn()) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('topbarBellBtn')) return;

    // Inject Bell button into topbar before spacer/actions
    const bellBtn = document.createElement('button');
    bellBtn.id = 'topbarBellBtn';
    bellBtn.className = 'topbar-bell-btn';
    bellBtn.title = 'Notifications';
    bellBtn.innerHTML = `🔔 <span class="bell-badge" id="bellBadge" style="display:none;">0</span>`;

    const spacer = topbar.querySelector('.spacer');
    if (spacer) topbar.insertBefore(bellBtn, spacer);
    else topbar.appendChild(bellBtn);

    // Create Notification Drawer
    const drawer = document.createElement('div');
    drawer.id = 'notificationDrawer';
    drawer.className = 'notification-drawer';
    drawer.innerHTML = `
      <div class="notification-drawer-header">
        <span>🔔 Recent Notifications</span>
      </div>
      <div class="notification-list" id="notificationList">
        <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">Loading notifications...</div>
      </div>
    `;
    document.body.appendChild(drawer);

    this.drawerEl = drawer;
    this.bellBtnEl = bellBtn;
    this.badgeEl = document.getElementById('bellBadge');

    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDrawer();
    });

    document.addEventListener('click', (e) => {
      if (this.drawerEl && !this.drawerEl.contains(e.target) && e.target !== this.bellBtnEl) {
        this.drawerEl.style.display = 'none';
      }
    });

    // Initial fetch & poll every 15s
    this.fetchUnread();
    setInterval(() => this.fetchUnread(), 15000);
  },

  async fetchUnread() {
    try {
      const data = await Api.getNotifications();
      if (this.badgeEl) {
        if (data.unreadCount > 0) {
          this.badgeEl.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
          this.badgeEl.style.display = 'flex';
        } else {
          this.badgeEl.style.display = 'none';
        }
      }
    } catch (err) { /* silent */ }
  },

  async toggleDrawer() {
    if (this.drawerEl.style.display === 'flex') {
      this.drawerEl.style.display = 'none';
    } else {
      this.drawerEl.style.display = 'flex';
      await this.renderList();
    }
  },

  async markItemRead(cardEl, id, complaintId) {
    try {
      if (cardEl && cardEl.classList.contains('unread')) {
        cardEl.classList.remove('unread');
        await Api.markNotificationRead(id);
        this.fetchUnread();
      }
      if (complaintId) {
        this.drawerEl.style.display = 'none';
        if (Auth.isAdmin()) {
          window.location.href = `complaint-management.html?id=${complaintId}`;
        } else {
          window.location.href = `student-home.html`;
        }
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  },

  async renderList() {
    const listEl = document.getElementById('notificationList');
    try {
      const data = await Api.getNotifications();
      if (!data.notifications || data.notifications.length === 0) {
        listEl.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">No notifications yet 🔕</div>`;
        return;
      }
      let html = '';
      data.notifications.forEach(n => {
        html += `
          <div class="notification-item-card ${n.is_read ? '' : 'unread'}" style="cursor:pointer;" onclick="NotificationSystem.markItemRead(this, ${n.id}, ${n.complaint_id || 'null'})" title="Click to view & mark as read">
            <div style="font-size:18px;">${n.role === 'admin' ? '🚨' : '🔔'}</div>
            <div style="flex:1;">
              <div class="nt-title">${n.title}</div>
              <div class="nt-msg">${n.message}</div>
              <div class="nt-time">${formatDate(n.created_at)}</div>
            </div>
          </div>
        `;
      });
      listEl.innerHTML = html;
    } catch (err) {
      listEl.innerHTML = `<div style="padding:16px; color:var(--danger); font-size:13px;">${err.message || 'Failed to load alerts.'}</div>`;
    }
  }
};

// Initialize systems on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ImageViewer.init();
  NotificationSystem.init();
});


