const user = getUser();
const allowed = !!(getToken() && user && user.role === 'doctor');
if (!allowed) {
  window.location.href = (user && user.role === 'patient') ? 'dashboard.html' : 'index.html';
}

let appointments = [];
let activeFilter = 'today';
let doctorSpecialtyRaw = '';

const fmtTime = d => new Date(d).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
const fmtDate = d => new Date(d).toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric' });
const isToday = d => new Date(d).toDateString() === new Date().toDateString();

function actionBtn(id, status, label, kind) {
  return `<button class="act-btn act-${kind}" data-id="${id}" data-status="${status}">${label}</button>`;
}

function actionsFor(a) {
  if (a.status === 'pending') {
    return actionBtn(a.id, 'confirmed', t('btnConfirm'), 'confirm') + actionBtn(a.id, 'cancelled', t('btnCancel'), 'cancel');
  }
  if (a.status === 'confirmed') {
    return actionBtn(a.id, 'completed', t('btnComplete'), 'confirm') + actionBtn(a.id, 'cancelled', t('btnCancel'), 'cancel');
  }
  return '<span class="muted">—</span>';
}

function visibleAppointments() {
  if (activeFilter === 'today') return appointments.filter(a => isToday(a.appointmentDate));
  if (activeFilter === 'upcoming') {
    return appointments.filter(a => new Date(a.appointmentDate) > new Date() && !isToday(a.appointmentDate));
  }
  return appointments;
}

function renderStats() {
  document.getElementById('statToday').textContent =
    appointments.filter(a => isToday(a.appointmentDate) && a.status !== 'cancelled').length;
  document.getElementById('statPending').textContent =
    appointments.filter(a => a.status === 'pending').length;
  document.getElementById('statPatients').textContent =
    new Set(appointments.map(a => a.patientId)).size;
}

function renderTable() {
  const body = document.getElementById('apptBody');
  const rows = visibleAppointments();
  if (rows.length === 0) {
    const hint = activeFilter === 'today' ? t('emptyTodayHint') : t('emptyAllHint');
    body.innerHTML = `<tr><td colspan="4" class="empty">${hint}</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(a => `
    <tr>
      <td>
        <strong>${escapeHtml(a.patientName)}</strong>
        <small>${escapeHtml(a.patientEmail)}</small>
        ${a.notes ? `<small>${escapeHtml(a.notes)}</small>` : ''}
      </td>
      <td><strong>${fmtTime(a.appointmentDate)}</strong><small>${fmtDate(a.appointmentDate)}</small></td>
      <td><span class="badge badge-${a.status}">${translateStatus(a.status)}</span></td>
      <td><div class="actions">${actionsFor(a)}</div></td>
    </tr>`).join('');
}

function renderPatients() {
  const grid = document.getElementById('patientsGrid');
  const map = new Map();
  appointments.forEach(a => {
    const p = map.get(a.patientId) || { name: a.patientName, email: a.patientEmail, last: a.appointmentDate, visits: 0 };
    if (a.status !== 'cancelled') p.visits += 1;
    if (new Date(a.appointmentDate) > new Date(p.last)) p.last = a.appointmentDate;
    map.set(a.patientId, p);
  });
  if (map.size === 0) {
    grid.innerHTML = `<p class="empty">${t('noPatientsYet')}</p>`;
    return;
  }
  grid.innerHTML = [...map.values()].map(p => `
    <div class="card">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.email)}</p>
      <div class="patient-meta">
        <div><span>${t('lastAppointmentLabel')}</span><strong>${fmtDate(p.last)}</strong></div>
        <div><span>${t('visitCountLabel')}</span><strong>${p.visits}</strong></div>
      </div>
    </div>`).join('');
}

async function loadData() {
  try {
    const data = await apiRequest(`/appointments?doctorId=${encodeURIComponent(user.id)}`);
    appointments = data.appointments;
    renderStats();
    renderTable();
    renderPatients();
  } catch (err) {
    document.getElementById('apptBody').innerHTML =
      `<tr><td colspan="4" class="empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderProfileTexts() {
  const name = user.name || '';
  document.getElementById('docName').textContent = name;
  document.getElementById('docAvatar').textContent =
    name.replace(/^(د\.|dr\.?)\s*/i, '').trim().charAt(0) || 'د';
  document.getElementById('docGreeting').textContent = t('doctorGreeting', { name });
  document.getElementById('docSpecialty').textContent =
    doctorSpecialtyRaw ? translateSpecialty(doctorSpecialtyRaw) : t('doctorFallbackLabel');
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString(localeTag(), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

async function loadProfile() {
  renderProfileTexts();
  try {
    const doc = await apiRequest(`/doctors/${user.id}`);
    doctorSpecialtyRaw = doc.specialty;
    renderProfileTexts();
  } catch (err) {
    doctorSpecialtyRaw = '';
    renderProfileTexts();
  }
}

function init() {
  document.getElementById('docLogout').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });

  document.getElementById('apptFilter').addEventListener('click', e => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    document.querySelectorAll('#apptFilter .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  });

  document.getElementById('apptBody').addEventListener('click', async e => {
    const btn = e.target.closest('.act-btn');
    if (!btn) return;
    btn.disabled = true;
    try {
      await apiRequest(`/appointments/${btn.dataset.id}/status`, 'PUT', { status: btn.dataset.status });
      await loadData();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
    }
  });

  loadProfile();
  loadData();
}

window.onLanguageChange = () => {
  renderProfileTexts();
  renderTable();
  renderPatients();
};

if (allowed) init();
