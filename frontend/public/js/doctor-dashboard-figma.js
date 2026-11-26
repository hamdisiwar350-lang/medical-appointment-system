(() => {
  'use strict';

  const currentUser = typeof getUser === 'function' ? getUser() : null;
  const isAllowed = !!(
    typeof getToken === 'function' && getToken() &&
    currentUser && currentUser.role === 'doctor'
  );

  if (!isAllowed) {
    const destinations = { assistant: 'assistant-dashboard.html', patient: 'dashboard.html' };
    window.location.replace(currentUser ? (destinations[currentUser.role] || 'index.html') : 'index.html');
    return;
  }

  const state = {
    appointments: [],
    patients: null,
    patientRecord: null,
    selectedPatientId: null,
    activeFilter: 'today',
    selectedTooth: 24,
    searchTerm: '',
    loading: true,
    loadError: false
  };

  const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const TOOTH_TYPES = {
    1: ['incisive centrale', 'قاطع مركزي'],
    2: ['incisive latérale', 'قاطع جانبي'],
    3: ['canine', 'ناب'],
    4: ['première prémolaire', 'ضاحك أول'],
    5: ['deuxième prémolaire', 'ضاحك ثان'],
    6: ['première molaire', 'ضرس أول'],
    7: ['deuxième molaire', 'ضرس ثان'],
    8: ['troisième molaire', 'ضرس ثالث']
  };
  const QUADRANTS = {
    1: ['supérieure droite', 'العلوي الأيمن'],
    2: ['supérieure gauche', 'العلوي الأيسر'],
    3: ['inférieure gauche', 'السفلي الأيسر'],
    4: ['inférieure droite', 'السفلي الأيمن']
  };

  const lang = () => (typeof getLang === 'function' ? getLang() : 'fr');
  const isArabic = () => lang() === 'ar';
  const tr = (fr, ar) => (isArabic() ? ar : fr);
  const locale = () => (typeof localeTag === 'function' ? localeTag() : (isArabic() ? 'ar-TN' : 'fr-FR'));

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function safeInitials(value) {
    return String(value || '?').trim().split(/\s+/).slice(0, 2)
      .map(part => part.charAt(0) || '').join('').toUpperCase() || '?';
  }

  function parseDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(value) {
    const date = parseDate(value);
    return date ? date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function formatDate(value) {
    const date = parseDate(value);
    return date ? date.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  function isToday(value) {
    const date = parseDate(value);
    const now = new Date();
    return !!date && date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  function escapeHtml(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function statusLabel(status) {
    const labels = {
      pending: ['En attente', 'في الانتظار'],
      confirmed: ['Confirmé', 'مؤكد'],
      cancelled: ['Annulé', 'ملغى'],
      completed: ['Terminé', 'مكتمل']
    };
    const pair = labels[status] || [status || '—', status || '—'];
    return tr(pair[0], pair[1]);
  }

  function toothName(number) {
    const quadrant = QUADRANTS[Math.floor(number / 10)];
    const type = TOOTH_TYPES[number % 10];
    if (!quadrant || !type) return tr('Dent permanente', 'سن دائم');
    return `${type[isArabic() ? 1 : 0]} ${quadrant[isArabic() ? 1 : 0]}`;
  }

  function toothSvg() {
    return '<svg class="fd-tooth-svg" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 3c1.7-.7 3 .5 4.5.5s2.8-1.2 4.5-.5c3.8 1.5 3.3 7 1.8 10.3-1.1 2.3-1.4 7.7-3.3 7.7-1.8 0-1.3-5.8-3-5.8S10.8 21 9 21c-1.9 0-2.2-5.4-3.3-7.7C4.2 10 3.7 4.5 7.5 3Z"/></svg>';
  }

  function renderTeethRow(containerId, numbers, isLower) {
    const root = el(containerId);
    if (!root) return;
    root.innerHTML = numbers.map(number => {
      const selected = state.selectedTooth === number;
      const finding = state.patientRecord?.record?.odontogram?.[String(number)] || { status: 'unreported', note: '' };
      const toothStatus = ['unreported', 'healthy', 'caries', 'filled', 'crown', 'missing'].includes(finding.status) ? finding.status : 'unreported';
      const label = `${tr('Dent', 'سن')} ${number} · ${toothName(number)}`;
      return `<button type="button" class="fd-tooth status-${toothStatus}${selected ? ' selected' : ''}" data-tooth="${number}" aria-label="${escapeHtml(label)}" aria-pressed="${selected}" title="${escapeHtml(label)}">
        ${isLower ? '' : `<span class="fd-tooth-number">${number}</span>`}
        <span class="fd-tooth-visual">${toothSvg()}</span>
        ${isLower ? `<span class="fd-tooth-number">${number}</span>` : ''}
      </button>`;
    }).join('');
  }

  function renderOdontogram() {
    renderTeethRow('fdUpperTeeth', UPPER_TEETH, false);
    renderTeethRow('fdLowerTeeth', LOWER_TEETH, true);
    setText('fdSelectedTooth', `${state.selectedTooth} · ${toothName(state.selectedTooth)}`);
    const selectedFinding = state.patientRecord?.record?.odontogram?.[String(state.selectedTooth)];
    setText('fdSelectedToothNote', selectedFinding ? `${selectedFinding.status}${selectedFinding.note ? ` · ${selectedFinding.note}` : ''}` : tr('Aucune donnée clinique enregistrée pour cette dent.', 'لا توجد بيانات سريرية مسجلة لهذا السن.'));
    if (state.selectedPatientId) {
      const toothLink = el('fdOdontogramRecordLink');
      if (toothLink) toothLink.href = `doctor-patient-file.html?patientId=${encodeURIComponent(state.selectedPatientId)}&tooth=${state.selectedTooth}#odontogramSection`;
    }
    const total = document.querySelectorAll('.fd-tooth[data-tooth]').length;
    const chart = document.querySelector('.fd-teeth-chart');
    if (chart) chart.dataset.toothCount = String(total);
  }

  function upcomingAppointment() {
    const now = Date.now();
    return state.appointments
      .filter(item => ['pending', 'confirmed'].includes(item.status))
      .map(item => ({ ...item, _date: parseDate(item.appointmentDate) }))
      .filter(item => item._date && item._date.getTime() >= now - 60 * 60 * 1000)
      .sort((left, right) => left._date - right._date)[0] || null;
  }

  function featuredPatientAppointment() {
    const next = upcomingAppointment();
    if (next) return next;
    return state.appointments
      .filter(item => item.status !== 'cancelled')
      .slice()
      .sort((left, right) => (parseDate(right.appointmentDate)?.getTime() || 0) - (parseDate(left.appointmentDate)?.getTime() || 0))[0] || null;
  }

  async function loadPatientRecord(patientId) {
    state.patientRecord = null;
    state.selectedPatientId = patientId || null;
    if (!patientId) {
      renderOdontogram();
      return;
    }
    try {
      state.patientRecord = await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}`);
      const latestNote = state.patientRecord.notes?.[0]?.note || '';
      const noteField = el('fdClinicalNote');
      if (noteField) noteField.value = latestNote;
      const noteStatus = el('fdClinicalNoteStatus');
      if (noteStatus) noteStatus.textContent = latestNote ? tr('Dernière note enregistrée', 'آخر ملاحظة محفوظة') : tr('Aucune note médicale n’est enregistrée.', 'لا توجد ملاحظة طبية مسجلة.');
      const recordUrl = `doctor-patient-file.html?patientId=${encodeURIComponent(patientId)}`;
      const notesLink = el('fdOpenPatientNotes');
      const toothLink = el('fdOdontogramRecordLink');
      if (notesLink) notesLink.href = `${recordUrl}#clinicalNoteForm`;
      if (toothLink) toothLink.href = `${recordUrl}&tooth=${state.selectedTooth}#odontogramSection`;
      renderOdontogram();
    } catch (error) {
      console.warn('[Dentist dashboard] Patient clinical file not available:', error.message);
      const noteStatus = el('fdClinicalNoteStatus');
      if (noteStatus) noteStatus.textContent = tr('Impossible de charger le dossier médical.', 'تعذر تحميل الملف الطبي.');
      renderOdontogram();
    }
  }

  function renderProfile() {
    const name = currentUser.name || tr('Dentiste', 'طبيب الأسنان');
    const initials = safeInitials(name);
    setText('docName', name);
    setText('docAvatar', initials);
    setText('fdTopAvatar', initials);
    setText('docGreeting', `${tr('Bonjour', 'مرحباً')}, ${name}`);
    setText('docSpecialty', tr('Chirurgien-dentiste', 'طبيب أسنان'));
    setText('todayDate', new Date().toLocaleDateString(locale(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }));
  }

  function setNextPatient(appointment) {
    const hasNext = !!appointment;
    const patientName = appointment?.patientName || tr('Aucun patient sélectionné', 'لم يتم اختيار مريض');
    setText('fdNextName', hasNext ? patientName : tr('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
    setText('fdNextTime', hasNext ? `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentDate)}` : '—');
    setText('fdNextInitials', hasNext ? safeInitials(patientName) : '—');
    setText('fdPatientInitials', hasNext ? safeInitials(patientName) : '—');
    setText('fdPatientName', patientName);
    setText('fdPatientDetails', hasNext
      ? `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentDate)} · ${statusLabel(appointment.status)}`
      : tr('Les informations du prochain rendez-vous apparaîtront ici.', 'ستظهر هنا معلومات الموعد القادم.'));
    const hasUpcoming = !!(appointment && ['pending', 'confirmed'].includes(appointment.status) && parseDate(appointment.appointmentDate)?.getTime() >= Date.now() - 60 * 60 * 1000);
    setText('fdNextHint', hasUpcoming
      ? tr('Prochain rendez-vous', 'الموعد القادم')
      : hasNext ? tr('Dernier patient enregistré', 'آخر مريض مسجل') : tr('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
    setText('fdPatientBannerLabel', hasUpcoming
      ? tr('PROCHAIN PATIENT À RECEVOIR', 'المريض التالي للاستقبال')
      : hasNext ? tr('DERNIER PATIENT ENREGISTRÉ', 'آخر مريض مسجل') : tr('PROCHAIN PATIENT À RECEVOIR', 'المريض التالي للاستقبال'));
    const cta = el('fdNextCta');
    if (cta) cta.classList.toggle('is-empty', !hasNext);
    const openFile = el('fdOpenPatientFile');
    if (openFile) {
      openFile.href = hasNext && appointment.patientId ? `doctor-patient-file.html?patientId=${encodeURIComponent(appointment.patientId)}` : 'doctor-patients.html';
      openFile.setAttribute('aria-disabled', String(!(hasNext && appointment.patientId)));
    }
    if (hasNext && appointment.patientId) {
      const recordUrl = `doctor-patient-file.html?patientId=${encodeURIComponent(appointment.patientId)}`;
      ['odontogram', 'plans', 'documents'].forEach(key => {
        const link = document.querySelector(`[data-nav-key="${key}"]`);
        if (link) link.href = `${recordUrl}${key === 'odontogram' ? `&tooth=${state.selectedTooth}` : ''}#${key === 'odontogram' ? 'odontogramSection' : key === 'plans' ? 'treatmentPlanSection' : 'patientDocuments'}`;
      });
    }
  }

  function renderStats() {
    if (state.loading || state.loadError) {
      ['statToday', 'statPending', 'statPatients', 'fdStatCompleted'].forEach(id => setText(id, '—'));
      if (!state.loading) setNextPatient(null);
      return;
    }
    const today = state.appointments.filter(item => isToday(item.appointmentDate) && item.status !== 'cancelled');
    const completedToday = today.filter(item => item.status === 'completed').length;
    const patientKeys = state.appointments
      .map(item => item.patientId || item.patientEmail || item.patientName)
      .filter(Boolean);
    const next = featuredPatientAppointment();
    const upcoming = upcomingAppointment();
    setText('statToday', today.length);
    setText('statPending', upcoming ? formatTime(upcoming.appointmentDate) : '—');
    setText('statPatients', state.patients ? state.patients.length : new Set(patientKeys).size);
    setText('fdStatCompleted', completedToday);
    setNextPatient(next);
  }

  function visibleAppointments() {
    let rows = state.appointments;
    if (state.activeFilter === 'today') rows = rows.filter(item => isToday(item.appointmentDate));
    if (state.activeFilter === 'upcoming') {
      rows = rows.filter(item => {
        const date = parseDate(item.appointmentDate);
        return date && date > new Date() && item.status !== 'cancelled';
      });
    }
    if (state.searchTerm) {
      const query = state.searchTerm.toLocaleLowerCase();
      rows = rows.filter(item => `${item.patientName || ''} ${item.patientEmail || ''}`
        .toLocaleLowerCase().includes(query));
    }
    return rows.slice().sort((left, right) =>
      (parseDate(left.appointmentDate)?.getTime() || 0) - (parseDate(right.appointmentDate)?.getTime() || 0));
  }

  function actionButtons(appointment) {
    const id = escapeHtml(appointment.id);
    if (appointment.status === 'pending') {
      return `<button class="fd-action confirm" data-id="${id}" data-status="confirmed">${tr('Confirmer', 'تأكيد')}</button><button class="fd-action cancel" data-id="${id}" data-status="cancelled">${tr('Annuler', 'إلغاء')}</button>`;
    }
    if (appointment.status === 'confirmed') {
      return `<button class="fd-action confirm" data-id="${id}" data-status="completed">${tr('Terminer', 'إنهاء')}</button><button class="fd-action cancel" data-id="${id}" data-status="cancelled">${tr('Annuler', 'إلغاء')}</button>`;
    }
    return '<span class="fd-no-action">—</span>';
  }

  function renderTable() {
    const body = el('apptBody');
    if (!body) return;
    if (state.loading) {
      body.innerHTML = `<tr><td colspan="4" class="fd-empty-row">${tr('Chargement des rendez-vous…', 'جار تحميل المواعيد…')}</td></tr>`;
      return;
    }
    const rows = visibleAppointments();
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="fd-empty-row">${tr('Aucun rendez-vous pour ce filtre.', 'لا توجد مواعيد ضمن هذا الاختيار.')}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(appointment => `
      <tr>
        <td><a class="fd-patient-link" href="doctor-patient-file.html?patientId=${encodeURIComponent(appointment.patientId || '')}">${escapeHtml(appointment.patientName || tr('Patient', 'مريض'))}</a><small>${escapeHtml(appointment.patientEmail || '')}</small></td>
        <td><strong>${formatTime(appointment.appointmentDate)}</strong><small>${formatDate(appointment.appointmentDate)}</small></td>
        <td><span class="fd-status ${escapeHtml(appointment.status)}">${statusLabel(appointment.status)}</span></td>
        <td><div class="fd-actions">${actionButtons(appointment)}</div></td>
      </tr>`).join('');
  }

  function extractAppointments(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.appointments)) return response.appointments;
    if (Array.isArray(response?.data?.appointments)) return response.data.appointments;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  async function loadData() {
    state.loading = true;
    renderStats();
    renderTable();
    try {
      const response = await apiRequest('/appointments');
      state.appointments = extractAppointments(response);
      state.loadError = false;
      try {
        const clinicalResponse = await apiRequest('/clinical/patients');
        state.patients = Array.isArray(clinicalResponse.patients) ? clinicalResponse.patients : [];
      } catch (clinicalError) {
        state.patients = null;
        console.warn('[Dentist dashboard] Could not load patient index:', clinicalError.message);
      }
      state.loading = false;
      renderStats();
      renderTable();
      const featured = featuredPatientAppointment();
      await loadPatientRecord(featured?.patientId || null);
      const status = el('fdDataStatus');
      if (status) status.textContent = state.patients
        ? tr('Rendez-vous et dossiers synchronisés', 'تمت مزامنة المواعيد والملفات')
        : tr('Rendez-vous synchronisés · dossiers indisponibles', 'المواعيد متزامنة · الملفات غير متاحة');
      renderStats();
    } catch (error) {
      state.appointments = [];
      state.patients = null;
      state.loadError = true;
      state.loading = false;
      renderStats();
      renderTable();
      const body = el('apptBody');
      const message = error?.message || tr('Impossible de charger les rendez-vous.', 'تعذّر تحميل المواعيد.');
      if (body) body.innerHTML = `<tr><td colspan="4" class="fd-empty-row fd-error-row">${escapeHtml(message)}</td></tr>`;
      const status = el('fdDataStatus');
      if (status) status.textContent = tr('Erreur de synchronisation', 'خطأ في تحديث البيانات');
      console.error('[Dentist dashboard] Failed to load appointments:', error);
    }
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
    renderTable();
    renderOdontogram();
  }


  function init() {
    el('apptFilter')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      state.activeFilter = button.dataset.filter;
      document.querySelectorAll('#apptFilter button').forEach(item => item.classList.toggle('active', item === button));
      renderTable();
    });

    el('apptBody')?.addEventListener('click', async event => {
      const button = event.target.closest('button[data-id][data-status]');
      if (!button) return;
      button.disabled = true;
      try {
        await apiRequest(`/appointments/${encodeURIComponent(button.dataset.id)}/status`, 'PUT', { status: button.dataset.status });
        await loadData();
      } catch (error) {
        window.alert(error?.message || tr('Impossible de modifier ce rendez-vous.', 'تعذّر تعديل الموعد.'));
        button.disabled = false;
      }
    });

    el('doctorSearch')?.addEventListener('input', event => {
      state.searchTerm = event.target.value.trim();
      renderTable();
    });
    document.addEventListener('doctor-search', event => {
      state.searchTerm = String(event.detail || '').trim();
      renderTable();
    });

    ['fdUpperTeeth', 'fdLowerTeeth'].forEach(id => {
      el(id)?.addEventListener('click', event => {
        const button = event.target.closest('button[data-tooth]');
        if (!button) return;
        state.selectedTooth = Number(button.dataset.tooth);
        renderOdontogram();
      });
    });

    window.onLanguageChange = applyLanguage;
    renderProfile();
    renderOdontogram();
    loadData();
  }

  init();
})();
