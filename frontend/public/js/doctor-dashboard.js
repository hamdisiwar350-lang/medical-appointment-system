const user = getUser();
const allowed = !!(getToken() && user && user.role === 'doctor');
if (!allowed) {
  const destinations = { assistant: 'assistant-dashboard.html', patient: 'dashboard.html' };
  window.location.replace(user ? (destinations[user.role] || 'index.html') : 'index.html');
}

let appointments = [];
let activeFilter = 'today';
let selectedTooth = 24;
let searchTerm = '';

const upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
const language = () => (typeof getLang === 'function' ? getLang() : 'fr');
const isArabic = () => language() === 'ar';
const text = (fr, ar) => isArabic() ? ar : fr;
const parseDate = value => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtTime = value => {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }) : '—';
};
const fmtDate = value => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};
const isToday = value => {
  const d = parseDate(value);
  return !!d && d.toDateString() === new Date().toDateString();
};
const safeInitials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';

function appointmentLabel(status) {
  const labels = {
    pending: ['En attente', 'في الانتظار'],
    confirmed: ['Confirmé', 'مؤكد'],
    cancelled: ['Annulé', 'ملغى'],
    completed: ['Terminé', 'مكتمل']
  };
  const item = labels[status] || [status || '—', status || '—'];
  return text(item[0], item[1]);
}

function nextAppointment() {
  return appointments
    .filter(a => ['pending', 'confirmed'].includes(a.status))
    .map(a => ({ ...a, _date: parseDate(a.appointmentDate) }))
    .filter(a => a._date && a._date >= new Date(Date.now() - 60 * 60 * 1000))
    .sort((a, b) => a._date - b._date)[0] || null;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function renderProfile() {
  const name = user?.name || text('Dentiste', 'طبيب الأسنان');
  const initials = safeInitials(name);
  setText('docName', name);
  setText('docAvatar', initials);
  setText('fdTopAvatar', initials);
  setText('docGreeting', `${text('Bonjour', 'مرحباً')}, ${name}`);
  setText('todayDate', new Date().toLocaleDateString(localeTag(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  setText('docSpecialty', text('Chirurgien-dentiste', 'طبيب أسنان'));
}

function renderStats() {
  const today = appointments.filter(a => isToday(a.appointmentDate) && a.status !== 'cancelled');
  const completed = today.filter(a => a.status === 'completed').length;
  const patientCount = new Set(appointments.map(a => a.patientId || a.patientEmail || a.patientName).filter(Boolean)).size;
  const next = nextAppointment();
  setText('statToday', String(today.length));
  setText('statPending', next ? fmtTime(next.appointmentDate) : '—');
  setText('fdNextHint', next ? text('Prochain rendez-vous', 'الموعد القادم') : text('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
  setText('statPatients', String(patientCount));
  setText('fdStatCompleted', String(completed));
  setText('fdNextName', next ? (next.patientName || text('Patient', 'مريض')) : text('Aucun rendez-vous à venir', 'لا يوجد موعد قادم'));
  setText('fdNextTime', next ? `${fmtDate(next.appointmentDate)} · ${fmtTime(next.appointmentDate)}` : '—');
  setText('fdNextInitials', next ? safeInitials(next.patientName) : '—');
  setText('fdPatientInitials', next ? safeInitials(next.patientName) : '—');
  setText('fdPatientName', next ? next.patientName || text('Patient', 'مريض') : text('Aucun patient sélectionné', 'لم يتم اختيار مريض'));
  setText('fdPatientDetails', next
    ? `${fmtDate(next.appointmentDate)} · ${fmtTime(next.appointmentDate)} · ${appointmentLabel(next.status)}`
    : text('Aucun rendez-vous confirmé ou en attente à venir.', 'لا يوجد موعد قادم مؤكد أو في الانتظار.'));
  const nextCta = document.getElementById('fdNextCta');
  if (nextCta) nextCta.classList.toggle('is-empty', !next);
}

function toothName(number) {
  const names = {
    18: ['Troisième molaire supérieure droite', 'الضرس الثالث العلوي الأيمن'],
    17: ['Deuxième molaire supérieure droite', 'الضرس الثاني العلوي الأيمن'],
    16: ['Première molaire supérieure droite', 'الضرس الأول العلوي الأيمن'],
    15: ['Deuxième prémolaire supérieure droite', 'الضاحك الثاني العلوي الأيمن'],
    14: ['Première prémolaire supérieure droite', 'الضاحك الأول العلوي الأيمن'],
    13: ['Canine supérieure droite', 'الناب العلوي الأيمن'],
    12: ['Incisive latérale supérieure droite', 'القاطع الجانبي العلوي الأيمن'],
    11: ['Incisive centrale supérieure droite', 'القاطع المركزي العلوي الأيمن'],
    21: ['Incisive centrale supérieure gauche', 'القاطع المركزي العلوي الأيسر'],
    22: ['Incisive latérale supérieure gauche', 'القاطع الجانبي العلوي الأيسر'],
    23: ['Canine supérieure gauche', 'الناب العلوي الأيسر'],
    24: ['Première prémolaire supérieure gauche', 'الضاحك الأول العلوي الأيسر'],
    25: ['Deuxième prémolaire supérieure gauche', 'الضاحك الثاني العلوي الأيسر'],
    26: ['Première molaire supérieure gauche', 'الضرس الأول العلوي الأيسر'],
    27: ['Deuxième molaire supérieure gauche', 'الضرس الثاني العلوي الأيسر'],
    28: ['Troisième molaire supérieure gauche', 'الضرس الثالث العلوي الأيسر'],
    48: ['Troisième molaire inférieure droite', 'الضرس الثالث السفلي الأيمن'],
    47: ['Deuxième molaire inférieure droite', 'الضرس الثاني السفلي الأيمن'],
    46: ['Première molaire inférieure droite', 'الضرس الأول السفلي الأيمن'],
    45: ['Deuxième prémolaire inférieure droite', 'الضاحك الثاني السفلي الأيمن'],
    44: ['Première prémolaire inférieure droite', 'الضاحك الأول السفلي الأيمن'],
    43: ['Canine inférieure droite', 'الناب السفلي الأيمن'],
    42: ['Incisive latérale inférieure droite', 'القاطع الجانبي السفلي الأيمن'],
    41: ['Incisive centrale inférieure droite', 'القاطع المركزي السفلي الأيمن'],
    31: ['Incisive centrale inférieure gauche', 'القاطع المركزي السفلي الأيسر'],
    32: ['Incisive latérale inférieure gauche', 'القاطع الجانبي السفلي الأيسر'],
    33: ['Canine inférieure gauche', 'الناب السفلي الأيسر'],
    34: ['Première prémolaire inférieure gauche', 'الضاحك الأول السفلي الأيسر'],
    35: ['Deuxième prémolaire inférieure gauche', 'الضاحك الثاني السفلي الأيسر'],
    36: ['Première molaire inférieure gauche', 'الضرس الأول السفلي الأيسر'],
    37: ['Deuxième molaire inférieure gauche', 'الضرس الثاني السفلي الأيسر'],
    38: ['Troisième molaire inférieure gauche', 'الضرس الثالث السفلي الأيسر']
  };
  const item = names[number] || ['Dent permanente', 'سن دائم'];
  return text(item[0], item[1]);
}

function renderTeethRow(id, numbers, lower = false) {
  const root = document.getElementById(id);
  if (!root) return;
  root.innerHTML = numbers.map(number => `
    <button type="button" class="fd-tooth ${selectedTooth === number ? 'selected' : ''}" data-tooth="${number}" aria-label="${text('Dent', 'سن')} ${number}">
      ${lower ? '' : `<span>${number}</span>`}
      <span class="fd-tooth-icon" data-icon="tooth" data-size="30"></span>
      ${lower ? `<span>${number}</span>` : ''}
    </button>`).join('');
  if (typeof renderIcons === 'function') renderIcons(root);
}

function renderOdontogram() {
  renderTeethRow('fdUpperTeeth', upperTeeth, false);
  renderTeethRow('fdLowerTeeth', lowerTeeth, true);
  setText('fdSelectedTooth', `${selectedTooth} · ${toothName(selectedTooth)}`);
}

function visibleAppointments() {
  let result = appointments;
  if (activeFilter === 'today') result = result.filter(a => isToday(a.appointmentDate));
  if (activeFilter === 'upcoming') result = result.filter(a => {
    const date = parseDate(a.appointmentDate);
    return date && date > new Date() && a.status !== 'cancelled';
  });
  if (searchTerm) {
    const q = searchTerm.toLocaleLowerCase();
    result = result.filter(a => `${a.patientName || ''} ${a.patientEmail || ''}`.toLocaleLowerCase().includes(q));
  }
  return result.slice().sort((a, b) => (parseDate(a.appointmentDate)?.getTime() || 0) - (parseDate(b.appointmentDate)?.getTime() || 0));
}

function actionButtons(a) {
  if (a.status === 'pending') {
    return `<button class="fd-action confirm" data-id="${escapeHtml(a.id)}" data-status="confirmed">${text('Confirmer', 'تأكيد')}</button><button class="fd-action cancel" data-id="${escapeHtml(a.id)}" data-status="cancelled">${text('Annuler', 'إلغاء')}</button>`;
  }
  if (a.status === 'confirmed') {
    return `<button class="fd-action confirm" data-id="${escapeHtml(a.id)}" data-status="completed">${text('Terminer', 'إنهاء')}</button><button class="fd-action cancel" data-id="${escapeHtml(a.id)}" data-status="cancelled">${text('Annuler', 'إلغاء')}</button>`;
  }
  return '<span class="fd-no-action">—</span>';
}

function renderTable() {
  const body = document.getElementById('apptBody');
  if (!body) return;
  const rows = visibleAppointments();
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" class="fd-empty-row">${text('Aucun rendez-vous pour ce filtre.', 'لا توجد مواعيد ضمن هذا الاختيار.')}</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.patientName || text('Patient', 'مريض'))}</strong><small>${escapeHtml(a.patientEmail || '')}</small></td>
      <td><strong>${fmtTime(a.appointmentDate)}</strong><small>${fmtDate(a.appointmentDate)}</small></td>
      <td><span class="fd-status ${escapeHtml(a.status)}">${appointmentLabel(a.status)}</span></td>
      <td><div class="fd-actions">${actionButtons(a)}</div></td>
    </tr>`).join('');
}

async function loadData() {
  const body = document.getElementById('apptBody');
  try {
    const data = await apiRequest('/appointments');
    appointments = Array.isArray(data.appointments) ? data.appointments : [];
    renderProfile();
    renderStats();
    renderTable();
  } catch (err) {
    if (body) body.innerHTML = `<tr><td colspan="4" class="fd-empty-row">${escapeHtml(err.message || text('Erreur de chargement', 'تعذّر تحميل البيانات'))}</td></tr>`;
  }
}

function applyFigmaLanguage() {
  document.querySelectorAll('[data-fr][data-ar]').forEach(node => {
    node.textContent = isArabic() ? node.dataset.ar : node.dataset.fr;
  });
  document.querySelectorAll('[data-fr-placeholder][data-ar-placeholder]').forEach(node => {
    node.placeholder = isArabic() ? node.dataset.arPlaceholder : node.dataset.frPlaceholder;
  });
  document.documentElement.dir = isArabic() ? 'rtl' : 'ltr';
  renderProfile();
  renderStats();
  renderTable();
  renderOdontogram();
}

function initMobileNavigation() {
  const sidebar = document.getElementById('fdSidebar');
  const scrim = document.getElementById('fdScrim');
  const open = () => { sidebar.classList.add('open'); scrim.hidden = false; };
  const close = () => { sidebar.classList.remove('open'); scrim.hidden = true; };
  document.getElementById('fdMobileMenu')?.addEventListener('click', open);
  document.getElementById('fdMobileClose')?.addEventListener('click', close);
  scrim?.addEventListener('click', close);
  sidebar?.querySelectorAll('.fd-nav-item').forEach(link => link.addEventListener('click', close));
}

function init() {
  document.getElementById('docLogout')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });

  document.getElementById('apptFilter')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll('#apptFilter button').forEach(item => item.classList.toggle('active', item === button));
    renderTable();
  });

  document.getElementById('apptBody')?.addEventListener('click', async event => {
    const button = event.target.closest('button[data-id][data-status]');
    if (!button) return;
    button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(button.dataset.id)}/status`, 'PUT', { status: button.dataset.status });
      await loadData();
    } catch (err) {
      alert(err.message || text('Impossible de modifier ce rendez-vous.', 'تعذّر تعديل الموعد.'));
      button.disabled = false;
    }
  });

  document.getElementById('doctorSearch')?.addEventListener('input', event => {
    searchTerm = event.target.value.trim();
    renderTable();
  });

  document.getElementById('fdUpperTeeth')?.addEventListener('click', selectTooth);
  document.getElementById('fdLowerTeeth')?.addEventListener('click', selectTooth);
  document.getElementById('fdNoteDisabled')?.addEventListener('click', () => {
    alert(text('La sauvegarde des notes médicales sera activée après la mise en place du service médical sécurisé.', 'سيتم تفعيل حفظ الملاحظات بعد إعداد الخدمة الطبية الآمنة.'));
  });

  initMobileNavigation();
  renderProfile();
  renderOdontogram();
  loadData();
}

function selectTooth(event) {
  const button = event.target.closest('button[data-tooth]');
  if (!button) return;
  selectedTooth = Number(button.dataset.tooth);
  renderOdontogram();
}

window.onLanguageChange = () => applyFigmaLanguage();
if (allowed) init();
