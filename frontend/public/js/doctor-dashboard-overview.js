(() => {
  'use strict';

  const currentUser = typeof getUser === 'function' ? getUser() : null;
  const token = typeof getToken === 'function' ? getToken() : null;
  if (!token || !currentUser || currentUser.role !== 'doctor') {
    const destinations = { assistant: 'assistant-dashboard.html', patient: 'dashboard.html' };
    window.location.replace(currentUser ? (destinations[currentUser.role] || 'index.html') : 'index.html');
    return;
  }

  const state = { appointments: [], loading: true, failed: false };
  const byId = id => document.getElementById(id);
  const lang = () => (typeof getLang === 'function' ? getLang() : 'fr');
  const isArabic = () => lang() === 'ar';
  const tr = (fr, ar) => isArabic() ? ar : fr;
  const locale = () => typeof localeTag === 'function' ? localeTag() : (isArabic() ? 'ar-TN' : 'fr-FR');
  const parseDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const setText = (id, value) => {
    const node = byId(id);
    if (node) node.textContent = value == null ? '' : String(value);
  };
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2)
    .map(part => part.charAt(0) || '').join('').toUpperCase() || '?';
  const formatTime = value => {
    const date = parseDate(value);
    return date ? date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '—';
  };
  const formatDate = value => {
    const date = parseDate(value);
    return date ? date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  };
  const isToday = value => {
    const date = parseDate(value);
    const now = new Date();
    return !!date && date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  };
  const statusLabel = status => ({
    pending: tr('En attente', 'في الانتظار'),
    confirmed: tr('Confirmé', 'مؤكد'),
    completed: tr('Terminé', 'مكتمل'),
    cancelled: tr('Annulé', 'ملغى')
  }[status] || '—');

  function extractAppointments(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.appointments)) return response.appointments;
    if (Array.isArray(response?.data?.appointments)) return response.data.appointments;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  // The overview must show only a future appointment, never fall back to a past/last patient.
  function getNextAppointment() {
    const now = Date.now();
    return state.appointments
      .filter(item => ['pending', 'confirmed'].includes(item.status))
      .map(item => ({ ...item, _date: parseDate(item.appointmentDate) }))
      .filter(item => item._date && item._date.getTime() >= now)
      .sort((a, b) => a._date - b._date)[0] || null;
  }

  function renderProfile() {
    const name = currentUser.name || tr('Dentiste', 'طبيب الأسنان');
    const date = byId('todayDate');
    setText('docGreeting', `${tr('Bonjour', 'مرحباً')}, ${name}`);
    setText('fdTopAvatar', initials(name));
    if (date) date.textContent = new Date().toLocaleDateString(locale(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function renderNextPatient(appointment) {
    const card = byId('nextAppointmentCard');
    const status = byId('nextPatientStatus');
    if (!appointment) {
      setText('nextPatientAvatar', '—');
      setText('nextPatientName', state.failed
        ? tr('Impossible de charger le prochain patient', 'تعذّر تحميل المريض القادم')
        : tr('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
      setText('nextPatientDetails', state.failed
        ? tr('Vérifiez la connexion au service des rendez-vous.', 'تحقق من الاتصال بخدمة المواعيد.')
        : tr('Aucun patient passé ou dossier médical ne sera affiché ici.', 'لن يظهر هنا أي مريض سابق أو ملف طبي.'));
      if (status) status.hidden = true;
      card?.classList.add('is-empty');
      setText('nextTimeHint', tr('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
      setText('dashboardMessage', state.failed
        ? tr('Erreur de synchronisation des rendez-vous.', 'خطأ في مزامنة المواعيد.')
        : tr('Les autres dossiers sont accessibles depuis « Dossiers patients ».', 'يمكن الوصول إلى بقية الملفات من «ملفات المرضى».'));
      return;
    }

    const patientName = appointment.patientName || tr('Patient', 'مريض');
    setText('nextPatientAvatar', initials(patientName));
    setText('nextPatientName', patientName);
    setText('nextPatientDetails', `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentDate)}`);
    if (status) {
      status.hidden = false;
      status.className = `fd-status ${appointment.status}`;
      status.textContent = statusLabel(appointment.status);
    }
    card?.classList.remove('is-empty');
    setText('nextTimeHint', tr('Prochain rendez-vous confirmé ou en attente', 'الموعد القادم المؤكد أو قيد الانتظار'));
    setText('dashboardMessage', tr(
      'Le tableau de bord affiche uniquement le prochain patient. Tous les dossiers sont accessibles depuis « Dossiers patients ».',
      'تعرض لوحة التحكم المريض القادم فقط. يمكن فتح جميع الملفات من «ملفات المرضى». '
    ));
  }

  function renderStats() {
    if (state.loading || state.failed) {
      ['statToday', 'statPending', 'statPatients', 'fdStatCompleted'].forEach(id => setText(id, '—'));
      renderNextPatient(null);
      return;
    }
    const todayAppointments = state.appointments.filter(item => isToday(item.appointmentDate) && item.status !== 'cancelled');
    const completedToday = todayAppointments.filter(item => item.status === 'completed').length;
    const patientKeys = new Set(state.appointments
      .map(item => item.patientId || item.patientEmail || item.patientName)
      .filter(Boolean));
    const next = getNextAppointment();

    setText('statToday', todayAppointments.length);
    setText('statPending', next ? formatTime(next.appointmentDate) : '—');
    setText('statPatients', patientKeys.size);
    setText('fdStatCompleted', completedToday);
    renderNextPatient(next);
  }

  function applyLanguage() {
    document.querySelectorAll('[data-fr][data-ar]').forEach(node => {
      node.textContent = isArabic() ? node.dataset.ar : node.dataset.fr;
    });
    document.querySelectorAll('[data-fr-placeholder][data-ar-placeholder]').forEach(node => {
      node.placeholder = isArabic() ? node.dataset.arPlaceholder : node.dataset.frPlaceholder;
    });
    document.documentElement.lang = isArabic() ? 'ar' : 'fr';
    document.documentElement.dir = isArabic() ? 'rtl' : 'ltr';
    renderProfile();
    renderStats();
  }

  async function loadAppointments() {
    state.loading = true;
    state.failed = false;
    renderStats();
    try {
      const response = await apiRequest('/appointments');
      state.appointments = extractAppointments(response);
      state.failed = false;
    } catch (error) {
      state.appointments = [];
      state.failed = true;
      console.error('[Dentist overview] Could not load appointments:', error);
    } finally {
      state.loading = false;
      renderStats();
    }
  }

  byId('doctorSearch')?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const query = event.currentTarget.value.trim();
    if (query) window.location.href = `doctor-patients.html?q=${encodeURIComponent(query)}`;
    else window.location.href = 'doctor-patients.html';
  });

  window.onLanguageChange = applyLanguage;
  document.addEventListener('app:languagechange', applyLanguage);
  renderProfile();
  if (typeof renderIcons === 'function') renderIcons(document);
  loadAppointments();
})();
