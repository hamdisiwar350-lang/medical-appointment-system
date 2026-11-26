(function () {
  'use strict';

  const user = typeof getUser === 'function' ? getUser() : null;
  const token = typeof getToken === 'function' ? getToken() : null;
  const redirectForRole = role => role === 'doctor' ? 'doctor-dashboard.html'
    : role === 'patient' ? 'dashboard.html'
    : role === 'assistant' ? 'assistant-dashboard.html' : 'index.html';

  if (!token || !user || user.role !== 'assistant') {
    window.location.replace(user ? redirectForRole(user.role) : 'index.html');
    return;
  }
  if (typeof apiRequest !== 'function') {
    console.error('Assistant portal: apiRequest is unavailable.');
    return;
  }

  const translations = {
    fr: {
      clinicName: 'Clinique Dentaire Lina', clinicSubtitle: 'Espace de soins privé', clinicOpen: 'Cabinet ouvert',
      spaceLabel: 'ESPACE', navDashboard: 'Tableau de bord', navAgenda: 'Agenda', navWaiting: 'File d’attente',
      navPatients: 'Patients', navWalkIn: 'Patient sans RDV', navRequests: 'Demandes', supportTitle: 'Besoin d’aide ?',
      supportText: 'Notre équipe vous répond', supportButton: 'Voir l’accueil', assistantRole: 'Assistante du cabinet',
      topbarLabel: 'ESPACE ASSISTANT', searchPlaceholder: 'Rechercher un patient, un rendez-vous…',
      hello: 'Bonjour', welcomeDescription: 'Voici l’activité du cabinet aujourd’hui.', walkInCta: 'Patient sans rendez-vous',
      statAppointments: 'Rendez-vous', statWaiting: 'En salle d’attente', statRequests: 'Demandes en attente',
      statConfirmed: 'Patients confirmés', statWaitingHint: 'Présences enregistrées', statRequestsHint: 'À confirmer',
      statConfirmedHint: 'Aujourd’hui', weekTitle: 'Agenda de la semaine', todayButton: 'Aujourd’hui',
      calendarHint: 'Sélectionnez un jour ou un rendez-vous pour afficher la liste correspondante.',
      queueTitle: 'File d’attente', queueSubtitle: 'Mise à jour depuis l’accueil', liveLabel: 'LIVE',
      openQueue: 'Ouvrir la file d’attente', requestsTitle: 'Demandes en attente', seeRequests: 'Voir toutes les demandes',
      agendaTitle: 'Agenda du cabinet', agendaDescription: 'Les noms des patients ouvrent leur fiche administrative.',
      searchPatient: 'Rechercher un patient…', todayFilter: 'Aujourd’hui', upcomingFilter: 'À venir', allFilter: 'Tous',
      patientColumn: 'Patient', dateColumn: 'Date et heure', statusColumn: 'Statut', actionsColumn: 'Actions',
      checkinColumn: 'Accueil', waitingTitle: 'Salle d’attente', waitingDescription: 'Les arrivées enregistrées au cabinet, par ordre d’arrivée.',
      arrivalColumn: 'Arrivée', appointmentColumn: 'Rendez-vous', queueStatusColumn: 'État',
      queuePermissionHint: 'L’assistante enregistre les arrivées. Seul le dentiste appelle le patient suivant et démarre la consultation.',
      patientsTitle: 'Patients du cabinet', patientsDescription: 'Liste administrative extraite des rendez-vous du cabinet.',
      walkInTitle: 'Patient sans rendez-vous', walkInDescription: 'Enregistrer une personne présente au cabinet et l’ajouter à la salle d’attente.',
      patientNameLabel: 'Nom complet du patient', patientEmailLabel: 'Adresse e-mail', addToQueue: 'Ajouter à la salle d’attente',
      walkInInfoTitle: 'À l’accueil', walkInInfoText: 'Le patient sera ajouté comme rendez-vous sans compte de connexion. L’assistante peut enregistrer son arrivée, mais seul le dentiste gère le passage en consultation.',
      requestsDescription: 'Les rendez-vous qui nécessitent une confirmation.', privacyNote: 'Espace administratif sécurisé · Les dossiers médicaux et les notes cliniques restent réservés au dentiste.',
      loading: 'Chargement…', noAppointments: 'Aucun rendez-vous à afficher.', noToday: 'Aucun rendez-vous aujourd’hui.',
      noWaiting: 'Aucun patient dans la salle d’attente.', noRequests: 'Aucune demande en attente.', noPatients: 'Aucun patient trouvé dans les rendez-vous.',
      confirm: 'Confirmer', cancel: 'Annuler', checkIn: 'Enregistrer l’arrivée', afterConfirm: 'Après confirmation',
      pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé', completed: 'Terminé',
      waiting: 'En attente', called: 'Appelé par le dentiste', in_consultation: 'En consultation',
      walkInRequired: 'Le nom et l’adresse e-mail sont obligatoires.', walkInSuccess: 'Patient ajouté à la salle d’attente.',
      walkInError: 'Impossible d’ajouter ce patient.', checkInError: 'Impossible d’enregistrer l’arrivée. Vérifiez que le rendez-vous est confirmé.',
      cancelPrompt: 'Confirmer l’annulation de ce rendez-vous ?', updateError: 'La mise à jour a échoué.',
      loadError: 'Impossible de charger les données du cabinet.', patientsCount: 'rendez-vous', appointmentCount: 'rendez-vous',
      selectedDay: 'Jour sélectionné', noEmail: 'Adresse e-mail non disponible', walkInDuplicate: 'Vérifiez si ce patient a déjà un rendez-vous.'
    },
    ar: {
      clinicName: 'عيادة طب الأسنان', clinicSubtitle: 'مساحة رعاية خاصة', clinicOpen: 'العيادة مفتوحة',
      spaceLabel: 'القائمة', navDashboard: 'لوحة المتابعة', navAgenda: 'جدول المواعيد', navWaiting: 'قاعة الانتظار',
      navPatients: 'المرضى', navWalkIn: 'مريض دون موعد', navRequests: 'الطلبات', supportTitle: 'هل تحتاج إلى مساعدة؟',
      supportText: 'فريقنا يجيب عن استفساراتك', supportButton: 'الاستقبال', assistantRole: 'مساعدة العيادة',
      topbarLabel: 'فضاء المساعدة', searchPlaceholder: 'ابحث عن مريض أو موعد…',
      hello: 'مرحباً', welcomeDescription: 'إليك نشاط العيادة لهذا اليوم.', walkInCta: 'مريض دون موعد',
      statAppointments: 'المواعيد', statWaiting: 'في قاعة الانتظار', statRequests: 'طلبات قيد الانتظار',
      statConfirmed: 'مواعيد مؤكدة', statWaitingHint: 'تم تسجيل الوصول', statRequestsHint: 'في انتظار التأكيد',
      statConfirmedHint: 'اليوم', weekTitle: 'جدول الأسبوع', todayButton: 'اليوم',
      calendarHint: 'اختر يوماً أو موعداً لعرض القائمة المناسبة.',
      queueTitle: 'قاعة الانتظار', queueSubtitle: 'تحديث من مكتب الاستقبال', liveLabel: 'مباشر',
      openQueue: 'فتح قائمة الانتظار', requestsTitle: 'طلبات قيد الانتظار', seeRequests: 'عرض كل الطلبات',
      agendaTitle: 'جدول العيادة', agendaDescription: 'تظهر هنا المواعيد الإدارية للمرضى.',
      searchPatient: 'ابحث عن مريض…', todayFilter: 'اليوم', upcomingFilter: 'القادمة', allFilter: 'الكل',
      patientColumn: 'المريض', dateColumn: 'التاريخ والوقت', statusColumn: 'الحالة', actionsColumn: 'الإجراءات',
      checkinColumn: 'الاستقبال', waitingTitle: 'قاعة الانتظار', waitingDescription: 'المرضى الذين تم تسجيل وصولهم، حسب وقت الوصول.',
      arrivalColumn: 'وقت الوصول', appointmentColumn: 'الموعد', queueStatusColumn: 'الحالة',
      queuePermissionHint: 'تسجل المساعدة وصول المرضى. طبيب الأسنان وحده ينادي المريض التالي ويبدأ الاستشارة.',
      patientsTitle: 'مرضى العيادة', patientsDescription: 'قائمة إدارية مستخرجة من مواعيد العيادة.',
      walkInTitle: 'مريض دون موعد', walkInDescription: 'تسجيل مريض حضر إلى العيادة وإضافته إلى قاعة الانتظار.',
      patientNameLabel: 'الاسم الكامل للمريض', patientEmailLabel: 'البريد الإلكتروني', addToQueue: 'إضافة إلى قاعة الانتظار',
      walkInInfoTitle: 'مكتب الاستقبال', walkInInfoText: 'يضاف المريض كموعد إداري دون إنشاء حساب دخول. يمكن للمساعدة تسجيل وصوله، بينما يتولى الطبيب إدارة بدء الاستشارة.',
      requestsDescription: 'المواعيد التي تحتاج إلى تأكيد.', privacyNote: 'فضاء إداري آمن · الملفات الطبية والملاحظات السريرية متاحة لطبيب الأسنان فقط.',
      loading: 'جارٍ التحميل…', noAppointments: 'لا توجد مواعيد للعرض.', noToday: 'لا توجد مواعيد اليوم.',
      noWaiting: 'لا يوجد مرضى في قاعة الانتظار.', noRequests: 'لا توجد طلبات معلّقة.', noPatients: 'لا يوجد مرضى ضمن المواعيد.',
      confirm: 'تأكيد', cancel: 'إلغاء', checkIn: 'تسجيل الوصول', afterConfirm: 'بعد التأكيد',
      pending: 'في الانتظار', confirmed: 'مؤكد', cancelled: 'ملغى', completed: 'مكتمل',
      waiting: 'في الانتظار', called: 'يناديه الطبيب', in_consultation: 'في الاستشارة',
      walkInRequired: 'اسم المريض والبريد الإلكتروني مطلوبان.', walkInSuccess: 'تمت إضافة المريض إلى قاعة الانتظار.',
      walkInError: 'تعذرت إضافة المريض.', checkInError: 'تعذر تسجيل الوصول. تأكد من تأكيد الموعد أولاً.',
      cancelPrompt: 'هل تريد تأكيد إلغاء هذا الموعد؟', updateError: 'تعذر تحديث الموعد.',
      loadError: 'تعذر تحميل بيانات العيادة.', patientsCount: 'مواعيد', appointmentCount: 'مواعيد',
      selectedDay: 'اليوم المحدد', noEmail: 'البريد الإلكتروني غير متوفر', walkInDuplicate: 'تحقق مما إذا كان للمريض موعد سابق.'
    }
  };

  let currentLang = 'fr';
  let appointments = [];
  let waitingRoom = [];
  let activeFilter = 'today';
  let searchQuery = '';
  let weekOffset = 0;
  let selectedDateKey = dateKey(new Date());
  let dataError = '';
  let isLoading = false;
  let globalSearchHasFocused = false;

  const $ = id => document.getElementById(id);
  const t = key => translations[currentLang][key] || translations.fr[key] || key;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const locale = () => currentLang === 'ar' ? 'ar-TN' : 'fr-FR';
  const today = () => new Date();
  const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const sameDay = (a, b) => dateKey(a) === dateKey(b);
  const formatDate = value => new Date(value).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = value => new Date(value).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const formatWeekday = value => new Date(value).toLocaleDateString(locale(), { weekday: 'short' });
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(x => x.charAt(0)).join('').toUpperCase() || '?';

  function setLanguage(language) {
    currentLang = language === 'ar' ? 'ar' : 'fr';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(node => {
      const key = node.dataset.t;
      if (translations[currentLang][key]) node.textContent = translations[currentLang][key];
    });
    document.querySelectorAll('[data-placeholder]').forEach(node => {
      const key = node.dataset.placeholder;
      if (translations[currentLang][key]) node.placeholder = translations[currentLang][key];
    });
    $('assistantLanguageToggle').textContent = currentLang === 'fr' ? 'AR' : 'FR';
    $('assistantLanguageToggle').setAttribute('aria-label', currentLang === 'fr' ? 'Passer en arabe' : 'Switch to French');
    renderAll();
  }

  function renderProfile() {
    const name = user.name || t('assistantRole');
    const avatar = initials(name);
    $('assistantName').textContent = name;
    $('assistantGreetingName').textContent = name;
    $('assistantAvatar').textContent = avatar;
    $('assistantTopAvatar').textContent = avatar;
    const now = new Date();
    const dateText = now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase(currentLang === 'ar' ? 'ar-TN' : 'fr-FR');
    $('assistantWelcomeEyebrow').textContent = `${t('topbarLabel')} · ${dateText}`;
  }

  function mondayFor(date) {
    const result = startOfDay(date);
    const day = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - day);
    return result;
  }
  function weekDates() {
    const monday = mondayFor(today());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return Array.from({ length: 6 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return day;
    });
  }
  function getVisibleAppointments() {
    let result = appointments.slice();
    const now = Date.now();
    if (activeFilter === 'today') result = result.filter(item => sameDay(item.appointmentDate, today()));
    else if (activeFilter === 'upcoming') result = result.filter(item => new Date(item.appointmentDate).getTime() >= now && item.status !== 'cancelled');
    else if (activeFilter === 'selected-date') result = result.filter(item => dateKey(item.appointmentDate) === selectedDateKey);
    else if (activeFilter === 'pending') result = result.filter(item => item.status === 'pending');
    const query = searchQuery.trim().toLocaleLowerCase(currentLang === 'ar' ? 'ar-TN' : 'fr-FR');
    if (query) result = result.filter(item => `${item.patientName || ''} ${item.patientEmail || ''}`.toLocaleLowerCase().includes(query));
    return result.sort((a,b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  }

  function statusLabel(status) { return t(status) || status; }
  function statusBadge(status) { return `<span class="assistant-status ${escape(status)}">${escape(statusLabel(status))}</span>`; }

  function renderStats() {
    const day = appointments.filter(item => sameDay(item.appointmentDate, today()) && item.status !== 'cancelled');
    const pending = appointments.filter(item => item.status === 'pending');
    const confirmed = new Set(day.filter(item => item.status === 'confirmed').map(item => String(item.patientEmail || item.patientName).toLowerCase()));
    const waiting = waitingRoom.filter(item => item.queueStatus === 'waiting');
    $('assistantStatToday').textContent = String(day.length);
    $('assistantStatWaiting').textContent = String(waiting.length);
    $('assistantStatPending').textContent = String(pending.length);
    $('assistantStatConfirmed').textContent = String(confirmed.size);
    $('assistantPendingNavCount').textContent = String(pending.length);
    $('assistantRequestsCount').textContent = String(pending.length);
    $('assistantAgendaCount').textContent = String(appointments.length);
    $('assistantWaitingCount').textContent = String(waitingRoom.length);
    $('assistantPatientCount').textContent = String(getUniquePatients().length);
    $('assistantPendingCount').textContent = String(pending.length);
    $('assistantStatTodayHint').textContent = `${appointments.filter(item => sameDay(item.appointmentDate, today()) && item.status === 'completed').length} ${currentLang === 'ar' ? 'مكتملة' : 'terminés'}`;
  }

  function renderCalendar() {
    const days = weekDates();
    const first = days[0];
    const last = days[days.length - 1];
    $('assistantWeekRange').textContent = `${first.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })} – ${last.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const dayHeaders = days.map((date, index) => `
      <button type="button" class="day-head ${sameDay(date,today()) ? 'today' : ''} ${dateKey(date) === selectedDateKey ? 'selected-day' : ''}" data-calendar-day="${dateKey(date)}" aria-label="${escape(date.toLocaleDateString(locale(), { weekday:'long',day:'numeric',month:'long' }))}">
        <span>${escape(formatWeekday(date))}</span><strong>${date.getDate()}</strong>
      </button>`).join('');
    const times = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
    const timeMarkup = `<div class="times">${times.map(time => `<span>${time}</span>`).join('')}</div>`;
    const weekEnd = new Date(last); weekEnd.setDate(weekEnd.getDate()+1);
    const weekAppointments = appointments.filter(item => {
      const date = new Date(item.appointmentDate);
      return date >= first && date < weekEnd && item.status !== 'cancelled' && date.getHours() >= 8 && date.getHours() < 17;
    });
    const colors = ['mint','blue','lavender','peach','rose'];
    const eventMarkup = weekAppointments.map((item, index) => {
      const date = new Date(item.appointmentDate);
      const dayIndex = Math.floor((startOfDay(date) - first) / 86400000);
      const minutes = date.getHours() * 60 + date.getMinutes() - 480;
      const top = Math.max(0, Math.min(98, minutes / 540 * 100));
      const duration = 48 / 540 * 100;
      const color = colors[index % colors.length];
      return `<button type="button" class="appointment assistant-calendar-event ${color}" data-calendar-id="${escape(item.id)}" style="left:calc(${dayIndex * 16.666}% + 4px);top:${top}%;width:calc(16.666% - 8px);height:${duration}%" title="${escape(item.patientName)} · ${escape(formatTime(item.appointmentDate))}"><strong>${escape(item.patientName)}</strong><span>${escape(formatTime(item.appointmentDate))}</span></button>`;
    }).join('');
    const now = new Date();
    const nowLine = weekOffset === 0 && now.getHours() >= 8 && now.getHours() < 17
      ? `<div class="now-line" style="top:${((now.getHours()*60+now.getMinutes()-480)/540*100)}%"><span></span></div>` : '';
    const hourLines = Array.from({length:9},(_,i)=>`<i class="hour-line" style="top:${(i+1)*10}%"></i>`).join('');
    const dayLines = Array.from({length:5},(_,i)=>`<i class="day-line" style="left:${(i+1)*16.666}%"></i>`).join('');
    $('assistantCalendarGrid').innerHTML = `<div class="time-head"></div>${dayHeaders}${timeMarkup}<div class="schedule-field">${hourLines}${dayLines}${eventMarkup}${nowLine}</div>`;
    $('assistantCalendarHint').textContent = `${t('selectedDay')} : ${new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString(locale(), { weekday:'long', day:'numeric', month:'long' })}`;
  }

  function appointmentActions(item) {
    const checkedIn = waitingRoom.some(entry => entry.id === item.id);
    if (item.status === 'pending') {
      return `<div class="assistant-actions"><button type="button" class="assistant-action confirm" data-assistant-action="confirmed" data-id="${escape(item.id)}">${escape(t('confirm'))}</button><button type="button" class="assistant-action cancel" data-assistant-action="cancelled" data-id="${escape(item.id)}">${escape(t('cancel'))}</button></div>`;
    }
    if (item.status === 'confirmed' && !checkedIn) {
      return `<button type="button" class="assistant-action cancel" data-assistant-action="cancelled" data-id="${escape(item.id)}">${escape(t('cancel'))}</button>`;
    }
    if (checkedIn) return `<span class="assistant-status waiting">${escape(t('waiting'))}</span>`;
    return '<span class="muted">—</span>';
  }

  function checkInAction(item) {
    const entry = waitingRoom.find(queueItem => queueItem.id === item.id);
    if (entry) return `<span class="assistant-queue-state ${escape(entry.queueStatus)}">${escape(t(entry.queueStatus))}</span>`;
    if (item.status === 'confirmed') return `<button type="button" class="assistant-action checkin" data-check-in="${escape(item.id)}">${escape(t('checkIn'))}</button>`;
    if (item.status === 'pending') return `<span class="muted">${escape(t('afterConfirm'))}</span>`;
    return '<span class="muted">—</span>';
  }

  function renderAppointments() {
    const body = $('assistantAppointmentBody');
    const visible = getVisibleAppointments();
    if (!visible.length) {
      const empty = activeFilter === 'today' ? t('noToday') : t('noAppointments');
      body.innerHTML = `<tr><td colspan="5" class="empty">${escape(dataError || empty)}</td></tr>`;
      return;
    }
    body.innerHTML = visible.map(item => `
      <tr id="appointment-row-${escape(item.id)}">
        <td><strong>${escape(item.patientName)}</strong><small>${escape(item.patientEmail || t('noEmail'))}</small></td>
        <td><strong>${escape(formatDate(item.appointmentDate))}</strong><small>${escape(formatTime(item.appointmentDate))}</small></td>
        <td>${statusBadge(item.status)}</td><td>${appointmentActions(item)}</td><td>${checkInAction(item)}</td>
      </tr>`).join('');
    if (activeFilter === 'pending') $('assistantAgendaCount').textContent = String(visible.length);
  }

  function renderWaitingRoom() {
    const body = $('assistantWaitingBody');
    if (!waitingRoom.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty">${escape(t('noWaiting'))}</td></tr>`;
    } else {
      body.innerHTML = waitingRoom.map(item => `
        <tr><td><strong>${escape(item.patientName)}</strong><small>${escape(item.patientEmail || t('noEmail'))}</small></td>
        <td>${escape(formatTime(item.arrivedAt))}</td><td>${escape(formatDate(item.appointmentDate))} · ${escape(formatTime(item.appointmentDate))}</td>
        <td><span class="assistant-queue-state ${escape(item.queueStatus)}">${escape(t(item.queueStatus))}</span></td></tr>`).join('');
    }
    const preview = $('assistantQueuePreview');
    if (!waitingRoom.length) {
      preview.innerHTML = `<div class="assistant-queue-empty">${escape(t('noWaiting'))}</div>`;
    } else {
      preview.innerHTML = waitingRoom.slice(0,3).map(item => `
        <div class="queue-row"><div class="avatar soft">${escape(initials(item.patientName))}</div><div class="queue-person"><strong>${escape(item.patientName)}</strong><span>${escape(formatTime(item.arrivedAt))} · ${escape(formatTime(item.appointmentDate))}</span></div><span class="status ${escape(item.queueStatus === 'waiting' ? 'waiting' : item.queueStatus === 'called' ? 'next' : 'arrived')}">${escape(t(item.queueStatus))}</span></div>`).join('');
    }
  }

  function renderRequests() {
    const pending = appointments.filter(item => item.status === 'pending').sort((a,b)=>new Date(a.appointmentDate)-new Date(b.appointmentDate));
    const preview = $('assistantRequestsPreview');
    if (!pending.length) preview.innerHTML = `<div class="assistant-queue-empty">${escape(t('noRequests'))}</div>`;
    else preview.innerHTML = pending.slice(0,2).map(item => `
      <div class="request"><span class="request-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></span><div><strong>${escape(item.patientName)}</strong><p>${escape(formatDate(item.appointmentDate))} · ${escape(formatTime(item.appointmentDate))}</p></div><span>${escape(t('pending'))}</span></div>`).join('');
    const body = $('assistantRequestsBody');
    if (!pending.length) body.innerHTML = `<tr><td colspan="4" class="empty">${escape(t('noRequests'))}</td></tr>`;
    else body.innerHTML = pending.map(item => `
      <tr><td><strong>${escape(item.patientName)}</strong><small>${escape(item.patientEmail || t('noEmail'))}</small></td><td><strong>${escape(formatDate(item.appointmentDate))}</strong><small>${escape(formatTime(item.appointmentDate))}</small></td><td>${statusBadge(item.status)}</td><td>${appointmentActions(item)}</td></tr>`).join('');
  }

  function getUniquePatients() {
    const map = new Map();
    appointments.forEach(item => {
      const key = String(item.patientEmail || item.patientName || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, { name:item.patientName || '', email:item.patientEmail || '', count:0, latest:item.appointmentDate });
      const patient = map.get(key);
      patient.count += 1;
      if (new Date(item.appointmentDate) > new Date(patient.latest)) patient.latest = item.appointmentDate;
    });
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name, locale()));
  }

  function renderPatients() {
    const patients = getUniquePatients();
    const grid = $('assistantPatientGrid');
    if (!patients.length) {
      grid.innerHTML = `<div class="assistant-panel card assistant-queue-empty">${escape(t('noPatients'))}</div>`;
      return;
    }
    grid.innerHTML = patients.map(patient => `
      <article class="assistant-patient-card"><div class="avatar">${escape(initials(patient.name))}</div><div><strong>${escape(patient.name)}</strong><small>${escape(patient.email)} · ${patient.count} ${escape(t('appointmentCount'))}</small><small>${escape(t('dateColumn'))}: ${escape(formatDate(patient.latest))}</small></div></article>`).join('');
  }

  function renderAll() {
    renderProfile();
    renderStats();
    renderCalendar();
    renderAppointments();
    renderWaitingRoom();
    renderRequests();
    renderPatients();
  }

  async function loadData() {
    isLoading = true;
    dataError = '';
    $('assistantAppointmentBody').innerHTML = `<tr><td colspan="5" class="empty">${escape(t('loading'))}</td></tr>`;
    try {
      const results = await Promise.allSettled([
        apiRequest('/appointments'),
        apiRequest('/appointments/waiting-room')
      ]);
      if (results[0].status === 'rejected') throw results[0].reason;
      appointments = Array.isArray(results[0].value.appointments) ? results[0].value.appointments : [];
      if (results[1].status === 'fulfilled') waitingRoom = Array.isArray(results[1].value.queue) ? results[1].value.queue : [];
      else {
        waitingRoom = [];
        console.error('Waiting room endpoint:', results[1].reason);
      }
      renderAll();
    } catch (error) {
      dataError = error && error.message ? error.message : t('loadError');
      $('assistantAppointmentBody').innerHTML = `<tr><td colspan="5" class="empty">${escape(dataError)}</td></tr>`;
      $('assistantWaitingBody').innerHTML = `<tr><td colspan="4" class="empty">${escape(dataError)}</td></tr>`;
      $('assistantQueuePreview').innerHTML = `<div class="assistant-queue-empty">${escape(dataError)}</div>`;
      console.error('Assistant dashboard load:', error);
    } finally {
      isLoading = false;
    }
  }

  async function updateAppointmentStatus(id, status, button) {
    if (status === 'cancelled' && !window.confirm(t('cancelPrompt'))) return;
    if (button) button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(id)}/status`, 'PUT', { status });
      await loadData();
    } catch (error) {
      window.alert(error && error.message ? error.message : t('updateError'));
      if (button) button.disabled = false;
    }
  }

  async function checkInAppointment(id, button) {
    if (button) button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(id)}/check-in`, 'POST', {});
      await loadData();
    } catch (error) {
      window.alert(error && error.message ? error.message : t('checkInError'));
      if (button) button.disabled = false;
    }
  }

  async function createWalkIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $('assistantWalkInSubmit');
    const name = $('walkInPatientName').value.trim();
    const email = $('walkInPatientEmail').value.trim();
    const message = $('assistantWalkInMessage');
    message.textContent = '';
    message.classList.remove('error');
    if (!name || !email) { message.textContent = t('walkInRequired'); message.classList.add('error'); return; }
    submit.disabled = true;
    try {
      await apiRequest('/appointments/walk-ins', 'POST', { patientName:name, patientEmail:email });
      form.reset();
      message.textContent = t('walkInSuccess');
      await loadData();
      $('walkInPatientName').focus();
    } catch (error) {
      message.textContent = error && error.message ? error.message : t('walkInError');
      message.classList.add('error');
    } finally { submit.disabled = false; }
  }

  function applyFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    renderAppointments();
  }

  function goToSection(id) {
    const section = $(id);
    if (!section) return;
    section.scrollIntoView({ behavior:'smooth', block:'start' });
    document.querySelectorAll('.assistant-sidebar .nav-item').forEach(button => {
      const active = button.dataset.navTarget === id;
      button.classList.toggle('active', active);
      const pip = button.querySelector('.active-pip');
      if (pip) pip.remove();
      if (active && !button.querySelector('.active-pip')) button.insertAdjacentHTML('beforeend','<span class="active-pip"></span>');
    });
    closeMobileMenu();
  }

  function closeMobileMenu() {
    $('assistantSidebar').classList.remove('sidebar-open');
    $('assistantSidebarScrim').hidden = true;
  }

  function bindEvents() {
    document.querySelectorAll('[data-nav-target]').forEach(button => button.addEventListener('click', () => goToSection(button.dataset.navTarget)));
    $('assistantLogout').addEventListener('click', () => { if (typeof clearSession === 'function') clearSession(); window.location.href = 'index.html'; });
    $('assistantLanguageToggle').addEventListener('click', () => setLanguage(currentLang === 'fr' ? 'ar' : 'fr'));
    $('assistantMobileMenu').addEventListener('click', () => { $('assistantSidebar').classList.add('sidebar-open'); $('assistantSidebarScrim').hidden = false; });
    $('assistantSidebarClose').addEventListener('click', closeMobileMenu);
    $('assistantSidebarScrim').addEventListener('click', closeMobileMenu);
    $('assistantNotificationsButton').addEventListener('click', () => goToSection('requestsSection'));
    $('assistantSeeRequests').addEventListener('click', () => { applyFilter('pending'); goToSection('requestsSection'); });
    $('assistantAppointmentSearch').addEventListener('input', event => { searchQuery = event.target.value || ''; $('assistantGlobalSearch').value = searchQuery; renderAppointments(); });
    $('assistantGlobalSearch').addEventListener('focus', () => { if (!globalSearchHasFocused) { globalSearchHasFocused = true; goToSection('agendaSection'); } });
    $('assistantGlobalSearch').addEventListener('input', event => { searchQuery = event.target.value || ''; $('assistantAppointmentSearch').value = searchQuery; activeFilter = 'all'; document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all')); renderAppointments(); });
    $('assistantAppointmentFilter').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (button) applyFilter(button.dataset.filter); });
    $('assistantRequestsNav').addEventListener('click', () => applyFilter('pending'));
    $('assistantCalendarToday').addEventListener('click', () => { weekOffset = 0; selectedDateKey = dateKey(today()); activeFilter = 'today'; document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === 'today')); renderCalendar(); renderAppointments(); });
    $('assistantWeekPrev').addEventListener('click', () => { weekOffset -= 1; renderCalendar(); });
    $('assistantWeekNext').addEventListener('click', () => { weekOffset += 1; renderCalendar(); });
    $('assistantCalendarGrid').addEventListener('click', event => {
      const eventButton = event.target.closest('[data-calendar-id]');
      if (eventButton) {
        activeFilter = 'all';
        document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
        renderAppointments();
        goToSection('agendaSection');
        const row = $(`appointment-row-${eventButton.dataset.calendarId}`);
        if (row) { row.classList.add('calendar-highlight'); setTimeout(() => row.classList.remove('calendar-highlight'), 1800); }
        return;
      }
      const dayButton = event.target.closest('[data-calendar-day]');
      if (dayButton) {
        selectedDateKey = dayButton.dataset.calendarDay;
        activeFilter = 'selected-date';
        document.querySelectorAll('#assistantAppointmentFilter [data-filter]').forEach(button => button.classList.remove('active'));
        renderCalendar(); renderAppointments(); goToSection('agendaSection');
      }
    });
    $('assistantAppointmentBody').addEventListener('click', event => {
      const action = event.target.closest('[data-assistant-action]');
      if (action && !action.disabled) { updateAppointmentStatus(action.dataset.id, action.dataset.assistantAction, action); return; }
      const checkin = event.target.closest('[data-check-in]');
      if (checkin && !checkin.disabled) checkInAppointment(checkin.dataset.checkIn, checkin);
    });
    $('assistantRequestsBody').addEventListener('click', event => {
      const action = event.target.closest('[data-assistant-action]');
      if (action && !action.disabled) updateAppointmentStatus(action.dataset.id, action.dataset.assistantAction, action);
    });
    $('assistantWalkInForm').addEventListener('submit', createWalkIn);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      document.querySelectorAll('.assistant-sidebar .nav-item').forEach(button => {
        const active = button.dataset.navTarget === visible.target.id;
        button.classList.toggle('active', active);
        const pip = button.querySelector('.active-pip');
        if (pip) pip.remove();
        if (active) button.insertAdjacentHTML('beforeend','<span class="active-pip"></span>');
      });
    }, { rootMargin:'-20% 0px -65% 0px', threshold:[0,.15,.35] });
    ['dashboardSection','agendaSection','waitingSection','patientsSection','walkInSection','requestsSection'].forEach(id => observer.observe($(id)));
  }

  function init() {
    setLanguage('fr');
    bindEvents();
    loadData();
    window.setInterval(() => { if (!isLoading && document.visibilityState === 'visible') loadData(); }, 45000);
  }

  init();
})();
