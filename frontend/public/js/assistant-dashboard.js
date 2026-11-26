(function () {
  'use strict';

  const assistantUser = typeof getUser === 'function' ? getUser() : null;
  const token = typeof getToken === 'function' ? getToken() : null;

  function redirectForRole(role) {
    if (role === 'doctor') return 'doctor-dashboard.html';
    if (role === 'patient') return 'dashboard.html';
    if (role === 'assistant') return 'assistant-dashboard.html';
    return 'index.html';
  }

  if (!token || !assistantUser || assistantUser.role !== 'assistant') {
    window.location.replace(assistantUser ? redirectForRole(assistantUser.role) : 'index.html');
    return;
  }

  let appointments = [];
  let waitingRoom = [];
  let activeFilter = 'today';
  let searchQuery = '';
  let loading = false;

  const workflowText = {
    fr: {
      checkIn: 'Enregistrer l’arrivée', afterConfirmation: 'Après confirmation',
      waitingTitle: 'Salle d’attente', waitingHint: 'Les patients enregistrés à l’accueil apparaissent ici. Seul le dentiste peut appeler le prochain patient.',
      waitingStatLabel: 'Patients en attente',
      walkInTitle: 'Patient sans rendez-vous', walkInHint: 'Enregistrez un patient présent au cabinet. Il sera ajouté à l’agenda et à la salle d’attente.',
      patientName: 'Nom complet du patient', patientEmail: 'Adresse e-mail', addWalkIn: 'Ajouter à la salle d’attente',
      checkInColumn: 'Accueil', patient: 'Patient', arrival: 'Arrivée', appointment: 'Rendez-vous', state: 'État',
      searchPlaceholder: 'Rechercher un patient…',
      waiting: 'En attente', called: 'Appelé par le dentiste', inConsultation: 'En consultation',
      noWaiting: 'Aucun patient dans la salle d’attente.', noToday: 'Aucun rendez-vous aujourd’hui.', noAppointments: 'Aucun rendez-vous à afficher.',
      walkInRequired: 'Le nom et l’e-mail du patient sont obligatoires.',
      walkInSuccess: 'Patient ajouté et placé dans la salle d’attente.',
      walkInError: 'Impossible d’ajouter ce patient.',
      checkInError: 'Impossible d’enregistrer l’arrivée. Vérifiez que le rendez-vous est confirmé.',
      cancelPrompt: 'Confirmer l’annulation de ce rendez-vous ?',
      updateError: 'La mise à jour a échoué.',
      loadError: 'Impossible de charger les rendez-vous.'
    },
    ar: {
      checkIn: 'تسجيل وصول المريض', afterConfirmation: 'بعد تأكيد الموعد',
      waitingTitle: 'قاعة الانتظار', waitingHint: 'المرضى الذين تم تسجيل وصولهم يظهرون هنا. طبيب الأسنان وحده ينادي المريض التالي.',
      waitingStatLabel: 'مرضى في الانتظار',
      walkInTitle: 'مريض دون موعد', walkInHint: 'سجّل مريضاً حضر إلى العيادة دون موعد، وسيُضاف إلى جدول المواعيد وقاعة الانتظار.',
      patientName: 'الاسم الكامل للمريض', patientEmail: 'البريد الإلكتروني', addWalkIn: 'إضافة إلى قاعة الانتظار',
      checkInColumn: 'الاستقبال', patient: 'المريض', arrival: 'وقت الوصول', appointment: 'الموعد', state: 'الحالة',
      searchPlaceholder: 'ابحث عن مريض…',
      waiting: 'في الانتظار', called: 'ناداه الطبيب', inConsultation: 'في الاستشارة',
      noWaiting: 'لا يوجد مرضى في قاعة الانتظار.', noToday: 'لا توجد مواعيد اليوم.', noAppointments: 'لا توجد مواعيد للعرض.',
      walkInRequired: 'اسم المريض وبريده الإلكتروني مطلوبان.', walkInSuccess: 'تمت إضافة المريض إلى قاعة الانتظار.',
      walkInError: 'تعذرت إضافة المريض.', checkInError: 'تعذر تسجيل الوصول. تأكد من تأكيد الموعد أولاً.',
      cancelPrompt: 'هل تريد تأكيد إلغاء هذا الموعد؟', updateError: 'تعذر تحديث الموعد.',
      loadError: 'تعذر تحميل المواعيد.'
    }
  };
  const lang = () => (typeof getLang === 'function' && getLang() === 'ar') ? 'ar' : 'fr';
  const label = key => workflowText[lang()][key] || workflowText.fr[key] || key;
  const applyWorkflowTranslations = () => {
    document.querySelectorAll('[data-assistant-i18n]').forEach(element => {
      element.textContent = label(element.dataset.assistantI18n);
    });
    document.querySelectorAll('[data-assistant-i18n-placeholder]').forEach(element => {
      element.placeholder = label(element.dataset.assistantI18nPlaceholder);
    });
  };

  const $ = id => document.getElementById(id);
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const text = (key, fallback) => {
    try {
      const value = typeof t === 'function' ? t(key) : '';
      return value && value !== key ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };
  const locale = () => typeof localeTag === 'function' ? localeTag() : 'fr-FR';
  const isToday = value => new Date(value).toDateString() === new Date().toDateString();
  const formatTime = value => new Date(value).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const formatDate = value => new Date(value).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  const queueLabels = () => ({
    waiting: label('waiting'),
    called: label('called'),
    in_consultation: label('inConsultation')
  });

  function renderProfile() {
    const name = assistantUser.name || '';
    if ($('assistantName')) $('assistantName').textContent = name;
    if ($('assistantAvatar')) $('assistantAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'A';
    if ($('assistantGreeting')) {
      const greeting = typeof t === 'function' ? t('assistantGreeting', { name }) : `Bonjour, ${name}`;
      $('assistantGreeting').textContent = greeting || `Bonjour, ${name}`;
    }
    if ($('assistantTodayDate')) {
      $('assistantTodayDate').textContent = new Date().toLocaleDateString(locale(), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }
  }

  function visibleAppointments() {
    let result;
    if (activeFilter === 'upcoming') {
      const now = Date.now();
      result = appointments.filter(item => new Date(item.appointmentDate).getTime() >= now && item.status !== 'cancelled');
    } else if (activeFilter === 'today') {
      result = appointments.filter(item => isToday(item.appointmentDate));
    } else {
      result = appointments.slice();
    }
    const query = searchQuery.trim().toLocaleLowerCase();
    if (query) {
      result = result.filter(item => `${item.patientName || ''} ${item.patientEmail || ''}`.toLocaleLowerCase().includes(query));
    }
    return result;
  }

  function renderStats() {
    const activeToday = appointments.filter(item => isToday(item.appointmentDate) && item.status !== 'cancelled');
    if ($('assistantStatToday')) $('assistantStatToday').textContent = activeToday.length;
    if ($('assistantStatPending')) $('assistantStatPending').textContent = appointments.filter(item => item.status === 'pending').length;
    if ($('assistantStatConfirmed')) $('assistantStatConfirmed').textContent = appointments.filter(item => item.status === 'confirmed').length;
    if ($('assistantStatWaiting')) $('assistantStatWaiting').textContent = waitingRoom.filter(item => item.queueStatus === 'waiting').length;
    if ($('assistantWaitingCount')) $('assistantWaitingCount').textContent = waitingRoom.length;
  }

  function appointmentActions(item) {
    const id = safe(item.id);
    if (item.status === 'pending') {
      return `<button class="act-btn act-confirm" data-assistant-action="confirmed" data-id="${id}">${safe(text('btnConfirm', 'Confirmer'))}</button>
        <button class="act-btn act-cancel" data-assistant-action="cancelled" data-id="${id}">${safe(text('btnCancel', 'Annuler'))}</button>`;
    }
    if (item.status === 'confirmed') {
      const alreadyCheckedIn = waitingRoom.some(entry => entry.id === item.id);
      if (alreadyCheckedIn) return `<span class="assistant-queue-state">${safe(label('checkIn'))}</span>`;
      return `<button class="act-btn act-cancel" data-assistant-action="cancelled" data-id="${id}">${safe(text('btnCancel', 'Annuler'))}</button>`;
    }
    return '<span class="muted">—</span>';
  }

  function checkInAction(item) {
    const existing = waitingRoom.find(entry => entry.id === item.id);
    if (existing) {
      return `<span class="assistant-queue-state">${safe(queueLabels()[existing.queueStatus] || existing.queueStatus)}</span>`;
    }
    if (item.status === 'confirmed') {
      return `<button class="assistant-checkin-btn" data-check-in="${safe(item.id)}">${safe(label('checkIn'))}</button>`;
    }
    if (item.status === 'pending') return `<span class="muted">${safe(label('afterConfirmation'))}</span>`;
    return '<span class="muted">—</span>';
  }

  function renderAppointments() {
    const body = $('assistantAppointmentBody');
    if (!body) return;
    const visible = visibleAppointments();
    if (!visible.length) {
      const message = activeFilter === 'today' ? label('noToday') : label('noAppointments');
      body.innerHTML = `<tr><td colspan="5" class="empty">${safe(message)}</td></tr>`;
      return;
    }

    body.innerHTML = visible.map(item => `
      <tr>
        <td><strong>${safe(item.patientName)}</strong><small>${safe(item.patientEmail)}</small></td>
        <td><strong>${safe(formatTime(item.appointmentDate))}</strong><small>${safe(formatDate(item.appointmentDate))}</small></td>
        <td><span class="badge badge-${safe(item.status)}">${safe(typeof translateStatus === 'function' ? translateStatus(item.status) : item.status)}</span></td>
        <td><div class="actions">${appointmentActions(item)}</div></td>
        <td>${checkInAction(item)}</td>
      </tr>`).join('');
  }

  function renderWaitingRoom() {
    const body = $('assistantWaitingBody');
    if (!body) return;
    if (!waitingRoom.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty">${safe(label('noWaiting'))}</td></tr>`;
      return;
    }
    body.innerHTML = waitingRoom.map(item => `
      <tr>
        <td><strong>${safe(item.patientName)}</strong><small>${safe(item.patientEmail)}</small></td>
        <td>${safe(formatTime(item.arrivedAt))}</td>
        <td>${safe(formatTime(item.appointmentDate))}</td>
        <td><span class="assistant-queue-state queue-${safe(item.queueStatus)}">${safe(queueLabels()[item.queueStatus] || item.queueStatus)}</span></td>
      </tr>`).join('');
  }

  async function loadAppointments() {
    const body = $('assistantAppointmentBody');
    if (body) body.innerHTML = '<tr><td colspan="5" class="empty">Chargement…</td></tr>';
    loading = true;
    try {
      const [appointmentResult, queueResult] = await Promise.all([
        apiRequest('/appointments'),
        apiRequest('/appointments/waiting-room').catch(error => {
          console.error('Assistant waiting room:', error);
          return { queue: [] };
        })
      ]);
      appointments = Array.isArray(appointmentResult.appointments) ? appointmentResult.appointments : [];
      waitingRoom = Array.isArray(queueResult.queue) ? queueResult.queue : [];
      renderStats();
      renderAppointments();
      renderWaitingRoom();
    } catch (error) {
      if (body) body.innerHTML = `<tr><td colspan="5" class="empty">${safe(error.message || label('loadError'))}</td></tr>`;
      console.error('Assistant appointments:', error);
    } finally {
      loading = false;
    }
  }

  async function updateAppointmentStatus(id, status, button) {
    if (status === 'cancelled' && !window.confirm(text('assistantCancelPrompt', label('cancelPrompt')))) return;
    button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(id)}/status`, 'PUT', { status });
      await loadAppointments();
    } catch (error) {
      window.alert(error.message || label('updateError'));
      button.disabled = false;
    }
  }

  async function checkInAppointment(id, button) {
    button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(id)}/check-in`, 'POST', {});
      await loadAppointments();
    } catch (error) {
      window.alert(error.message || label('checkInError'));
      button.disabled = false;
    }
  }

  async function createWalkIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const patientName = $('walkInPatientName')?.value.trim();
    const patientEmail = $('walkInPatientEmail')?.value.trim();
    const message = $('assistantWalkInMessage');
    if (message) message.textContent = '';
    if (!patientName || !patientEmail) {
      if (message) message.textContent = label('walkInRequired');
      return;
    }
    submit.disabled = true;
    try {
      await apiRequest('/appointments/walk-ins', 'POST', { patientName, patientEmail });
      form.reset();
      if (message) message.textContent = label('walkInSuccess');
      await loadAppointments();
    } catch (error) {
      if (message) message.textContent = error.message || label('walkInError');
    } finally {
      submit.disabled = false;
    }
  }

  function init() {
    $('assistantLogout')?.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });

    $('assistantAppointmentSearch')?.addEventListener('input', event => {
      searchQuery = event.target.value || '';
      renderAppointments();
    });

    $('assistantAppointmentFilter')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      renderAppointments();
    });

    $('assistantAppointmentBody')?.addEventListener('click', event => {
      const statusButton = event.target.closest('[data-assistant-action]');
      if (statusButton && !statusButton.disabled) {
        updateAppointmentStatus(statusButton.dataset.id, statusButton.dataset.assistantAction, statusButton);
        return;
      }
      const checkInButton = event.target.closest('[data-check-in]');
      if (checkInButton && !checkInButton.disabled) checkInAppointment(checkInButton.dataset.checkIn, checkInButton);
    });

    $('assistantWalkInForm')?.addEventListener('submit', createWalkIn);
    applyWorkflowTranslations();
    renderProfile();
    loadAppointments();
  }

  window.onLanguageChange = () => {
    applyWorkflowTranslations();
    renderProfile();
    renderStats();
    renderAppointments();
    renderWaitingRoom();
  };

  init();
})();
