(() => {
  'use strict';

  const user = typeof getUser === 'function' ? getUser() : null;
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token || !user || user.role !== 'doctor') {
    const destination = user?.role === 'assistant' ? 'assistant-dashboard.html'
      : user?.role === 'patient' ? 'dashboard.html' : 'index.html';
    window.location.replace(destination);
    return;
  }

  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const initials = value => String(value || 'D').trim().split(/\s+/).slice(0, 2)
    .map(part => part[0] || '').join('').toUpperCase() || 'D';
  const currentPage = (window.location.pathname.split('/').pop() || 'doctor-dashboard.html').toLowerCase();

  // Global navigation only. Patient-specific clinical modules live inside the patient file.
  const navItems = [
    { key: 'overview', href: 'doctor-dashboard.html', icon: 'layout', fr: 'Vue clinique', ar: 'نظرة سريرية' },
    { key: 'appointments', href: 'doctor-appointments.html', icon: 'calendar', fr: 'Consultations', ar: 'الاستشارات' },
    { key: 'patients', href: 'doctor-patients.html', icon: 'users', fr: 'Dossiers patients', ar: 'ملفات المرضى' }
  ];
  const utilityItems = [
    { key: 'notifications', href: 'doctor-notifications.html', icon: 'bell', fr: 'Notifications', ar: 'الإشعارات' },
    { key: 'settings', href: 'doctor-settings.html', icon: 'settings', fr: 'Paramètres', ar: 'الإعدادات' }
  ];

  let activeKey = 'overview';
  if (currentPage === 'doctor-appointments.html') activeKey = 'appointments';
  else if (currentPage === 'doctor-patients.html' || currentPage === 'doctor-patient-file.html') activeKey = 'patients';
  else if (currentPage === 'doctor-dashboard.html') activeKey = 'overview';
  else if (currentPage === 'doctor-notifications.html') activeKey = 'notifications';
  else if (currentPage === 'doctor-settings.html') activeKey = 'settings';

  function itemMarkup(item) {
    const active = item.key === activeKey;
    return `<a class="fd-nav-item${active ? ' active' : ''}" data-nav-key="${escape(item.key)}" href="${escape(item.href)}" ${active ? 'aria-current="page"' : ''}>
      <span data-icon="${item.icon}" data-size="18"></span><span data-sidebar-fr="${escape(item.fr)}" data-sidebar-ar="${escape(item.ar)}">${escape(item.fr)}</span>${active ? '<i aria-hidden="true"></i>' : ''}
    </a>`;
  }

  function buildSidebar() {
    const sidebar = byId('fdSidebar');
    if (!sidebar) return;
    const name = user.name || 'Dentiste';
    sidebar.innerHTML = `
      <button class="fd-mobile-close" id="fdMobileClose" type="button" aria-label="Fermer le menu">×</button>
      <div class="fd-brand"><span class="fd-brand-mark" data-icon="tooth" data-size="25"></span><div><strong>Clinique Dentaire</strong><small data-sidebar-fr="Espace de soins privé" data-sidebar-ar="فضاء رعاية خاص">Espace de soins privé</small></div></div>
      <div class="fd-clinic-state"><i></i><span data-sidebar-fr="Cabinet ouvert" data-sidebar-ar="العيادة مفتوحة">Cabinet ouvert</span></div>
      <p class="fd-nav-label" data-sidebar-fr="ESPACE" data-sidebar-ar="القائمة">ESPACE</p>
      <nav class="fd-nav" aria-label="Navigation dentiste">${navItems.map(itemMarkup).join('')}</nav>
      <div class="fd-sidebar-utility">${utilityItems.map(itemMarkup).join('')}</div>
      <div class="fd-sidebar-bottom">
        <div class="fd-help-card"><span class="fd-help-icon" data-icon="heart" data-size="19"></span><strong data-sidebar-fr="Besoin d’aide ?" data-sidebar-ar="تحتاج مساعدة؟">Besoin d’aide ?</strong><small data-sidebar-fr="Votre espace clinique sécurisé" data-sidebar-ar="فضاء العيادة الآمن">Votre espace clinique sécurisé</small><span data-sidebar-fr="Cabinet dentaire" data-sidebar-ar="عيادة طب الأسنان">Cabinet dentaire</span></div>
        <div class="fd-profile-mini"><div class="fd-avatar" id="docAvatar">${escape(initials(name))}</div><div><strong id="docName">${escape(name)}</strong><span id="docSpecialty">Chirurgien-dentiste</span></div><button id="docLogout" class="fd-logout" type="button" title="Déconnexion" aria-label="Déconnexion" data-icon="logout" data-size="17"></button></div>
      </div>`;
    if (typeof renderIcons === 'function') renderIcons(sidebar);
  }

  function applySidebarLanguage() {
    const lang = typeof getLang === 'function' ? getLang() : 'fr';
    document.querySelectorAll('[data-sidebar-fr][data-sidebar-ar]').forEach(node => {
      node.textContent = lang === 'ar' ? node.dataset.sidebarAr : node.dataset.sidebarFr;
    });
    document.querySelectorAll('[data-record-fr][data-record-ar]').forEach(node => {
      node.textContent = lang === 'ar' ? node.dataset.recordAr : node.dataset.recordFr;
    });
    const specialty = byId('docSpecialty');
    if (specialty) specialty.textContent = lang === 'ar' ? 'طبيب الأسنان' : 'Chirurgien-dentiste';
  }

  function renderProfile() {
    const name = user.name || 'Dentiste';
    const avatar = initials(name);
    if (byId('docName')) byId('docName').textContent = name;
    if (byId('docAvatar')) byId('docAvatar').textContent = avatar;
    if (byId('fdTopAvatar')) byId('fdTopAvatar').textContent = avatar;
    const greeting = byId('docGreeting');
    if (greeting && currentPage !== 'doctor-dashboard.html') {
      greeting.textContent = (typeof getLang === 'function' && getLang() === 'ar')
        ? `مرحباً، ${name}` : `Bonjour, ${name}`;
    }
    const date = byId('todayDate') || byId('doctorTodayDate');
    if (date && typeof localeTag === 'function') {
      date.textContent = new Date().toLocaleDateString(localeTag(), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }
    applySidebarLanguage();
  }

  function syncPatientModuleTabs() {
    const currentHash = window.location.hash;
    document.querySelectorAll('.fd-record-module-nav a[data-record-section]').forEach(link => {
      const active = link.getAttribute('href') === currentHash;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function closeMobileMenu() {
    byId('fdSidebar')?.classList.remove('open');
    const scrim = byId('fdScrim');
    if (scrim) scrim.hidden = true;
  }

  buildSidebar();
  renderProfile();
  if (currentPage === 'doctor-patient-file.html') {
    syncPatientModuleTabs();
    window.addEventListener('hashchange', syncPatientModuleTabs);
    document.querySelector('.fd-record-module-nav')?.addEventListener('click', event => {
      if (event.target.closest('a[data-record-section]')) {
        window.setTimeout(syncPatientModuleTabs, 0);
      }
    });
  }
  if (['doctor-notifications.html', 'doctor-settings.html', 'doctor-patient-file.html'].includes(currentPage)) {
    const searchBox = document.querySelector('.fd-search');
    if (searchBox) searchBox.hidden = true;
  }

  byId('docLogout')?.addEventListener('click', () => {
    if (typeof clearSession === 'function') clearSession();
    window.location.replace('index.html');
  });
  byId('fdMobileMenu')?.addEventListener('click', () => {
    byId('fdSidebar')?.classList.add('open');
    if (byId('fdScrim')) byId('fdScrim').hidden = false;
  });
  byId('fdMobileClose')?.addEventListener('click', closeMobileMenu);
  byId('fdScrim')?.addEventListener('click', closeMobileMenu);
  byId('fdSidebar')?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMobileMenu();
  });
  byId('doctorSearch')?.addEventListener('input', event => {
    document.dispatchEvent(new CustomEvent('doctor-search', { detail: event.target.value || '' }));
  });
  document.addEventListener('app:languagechange', () => {
    renderProfile();
  });
})();
