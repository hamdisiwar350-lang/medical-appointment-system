(function() {
  const NOTIF_POLL_MS = 30000;

  function currentUserEmail() {
    const u = getUser();
    return u ? u.email : null;
  }

  function translateNotification(n) {
    const date = new Date(n.data.appointmentDate).toLocaleString(localeTag());
    if (n.type === 'new_appointment_patient') {
      return t('notifNewAppointmentPatient', { doctorName: n.data.doctorName, date });
    }
    if (n.type === 'new_appointment_doctor') {
      return t('notifNewAppointmentDoctor', { patientName: n.data.patientName, date });
    }
    if (n.type === 'status_update') {
      const key = n.data.status === 'confirmed' ? 'notifStatusConfirmed'
        : n.data.status === 'cancelled' ? 'notifStatusCancelled'
        : 'notifStatusCompleted';
      return t(key, { doctorName: n.data.doctorName, date });
    }
    return '';
  }

  let cachedNotifications = [];

  async function fetchNotifications() {
    const email = currentUserEmail();
    if (!email) return [];
    try {
      const data = await apiRequest(`/notifications?email=${encodeURIComponent(email)}`);
      cachedNotifications = data.notifications || [];
      return cachedNotifications;
    } catch (err) {
      return [];
    }
  }

  async function markOneRead(id) {
    try { await apiRequest(`/notifications/${id}/read`, 'PUT'); } catch (err) {}
  }

  async function markAllRead() {
    const email = currentUserEmail();
    if (!email) return;
    try { await apiRequest('/notifications/read-all', 'PUT', { email }); } catch (err) {}
  }

  function renderBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function renderDropdown() {
    const list = document.getElementById('notifDropdownList');
    if (!list) return;
    const items = cachedNotifications.slice(0, 6);
    if (items.length === 0) {
      list.innerHTML = `<p class="notif-empty">${t('notifEmpty')}</p>`;
      return;
    }
    list.innerHTML = items.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <p>${escapeHtml(translateNotification(n))}</p>
        <small>${new Date(n.createdAt).toLocaleString(localeTag())}</small>
      </div>`).join('');
  }

  function renderPage() {
    const list = document.getElementById('notifPageList');
    if (!list) return;
    if (cachedNotifications.length === 0) {
      list.innerHTML = `<p class="notif-empty">${t('notifEmpty')}</p>`;
      return;
    }
    list.innerHTML = cachedNotifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <p>${escapeHtml(translateNotification(n))}</p>
        <small>${new Date(n.createdAt).toLocaleString(localeTag())}</small>
      </div>`).join('');
  }

  async function refreshAll() {
    await fetchNotifications();
    renderBadge(cachedNotifications.filter(n => !n.read).length);
    renderDropdown();
    renderPage();
  }

  function wireDropdownToggle() {
    const bellBtn = document.getElementById('notifBellBtn');
    const dropdown = document.getElementById('notifDropdown');
    if (!bellBtn || !dropdown) return;

    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== bellBtn) {
        dropdown.classList.remove('open');
      }
    });
  }

  function wireItemClicks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      const id = item.dataset.id;
      const n = cachedNotifications.find(x => x.id === id);
      if (n && !n.read) {
        n.read = true;
        item.classList.remove('unread');
        await markOneRead(id);
        renderBadge(cachedNotifications.filter(x => !x.read).length);
      }
    });
  }

  function wireMarkAllButtons() {
    document.querySelectorAll('[data-notif-mark-all]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await markAllRead();
        cachedNotifications.forEach(n => n.read = true);
        renderBadge(0);
        renderDropdown();
        renderPage();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireDropdownToggle();
    wireItemClicks('notifDropdownList');
    wireItemClicks('notifPageList');
    wireMarkAllButtons();
    refreshAll();
    setInterval(refreshAll, NOTIF_POLL_MS);
  });

  const prevOnLangChange = window.onLanguageChange;
  window.onLanguageChange = () => {
    if (prevOnLangChange) prevOnLangChange();
    renderDropdown();
    renderPage();
  };
})();
