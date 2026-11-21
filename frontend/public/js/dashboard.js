const user = getUser();
if (!getToken() || !user) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  window.location.href = 'index.html';
});

let allDoctors = [];
let allAppointmentsCache = [];
let activeSpecialty = 'all';
let selectedSlot = null;

const dateInput = document.getElementById('appointmentDateInput');
dateInput.min = new Date().toISOString().slice(0, 10);

function renderWelcome() {
  document.getElementById('welcomeTitle').textContent = t('welcomeGreeting', { name: user.name });
}

async function loadSpecialtiesFilter() {
  try {
    const data = await apiRequest('/doctors/specialties');
    window._specialtiesRaw = data.specialties;
    renderSpecialtyFilter();
  } catch (err) {
    document.getElementById('specialtyFilter').innerHTML = '';
  }
}

function renderSpecialtyFilter() {
  const filterBox = document.getElementById('specialtyFilter');
  const specialties = window._specialtiesRaw || [];
  filterBox.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'pill' + (activeSpecialty === 'all' ? ' active' : '');
  allBtn.textContent = t('filterAll');
  allBtn.dataset.specialty = 'all';
  filterBox.appendChild(allBtn);

  specialties.forEach(spec => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (activeSpecialty === spec ? ' active' : '');
    btn.textContent = translateSpecialty(spec);
    btn.dataset.specialty = spec;
    filterBox.appendChild(btn);
  });

  filterBox.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSpecialty = btn.dataset.specialty;
      renderSpecialtyFilter();
      renderDoctors();
    });
  });
}

function renderDoctors() {
  const list = document.getElementById('doctorsList');
  const select = document.getElementById('doctorSelect');
  const previousSelection = select.value;
  const filtered = activeSpecialty === 'all'
    ? allDoctors
    : allDoctors.filter(d => d.specialty === activeSpecialty);

  list.innerHTML = filtered.length === 0 ? `<p>${t('noDoctorsForSpecialty')}</p>` : '';
  select.innerHTML = `<option value="">${t('selectDoctorPlaceholder')}</option>`;

  filtered.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${escapeHtml(doc.name)}</h3>
      <p>${t('specialtyFieldLabel')} ${escapeHtml(translateSpecialty(doc.specialty))}</p>
      <p>${t('emailFieldLabel')} ${escapeHtml(doc.email)}</p>
      <p>${t('hoursFieldLabel')} ${doc.availableFrom} - ${doc.availableTo}</p>`;
    list.appendChild(card);

    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = `${doc.name} - ${translateSpecialty(doc.specialty)}`;
    select.appendChild(opt);
  });

  if ([...select.options].some(o => o.value === previousSelection)) {
    select.value = previousSelection;
  }
}

async function loadDoctors() {
  const list = document.getElementById('doctorsList');
  list.innerHTML = `<p>${t('loading')}</p>`;
  try {
    const data = await apiRequest('/doctors');
    allDoctors = data.doctors;
    renderDoctors();
  } catch (err) {
    list.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadAvailability() {
  const doctorId = document.getElementById('doctorSelect').value;
  const date = dateInput.value;
  const container = document.getElementById('slotsContainer');
  selectedSlot = null;

  if (!doctorId || !date) {
    container.innerHTML = `<p class="slot-hint">${t('slotHint')}</p>`;
    return;
  }

  container.innerHTML = `<p class="slot-hint">${t('slotLoading')}</p>`;
  try {
    const data = await apiRequest(`/appointments/availability?doctorId=${doctorId}&date=${date}`);
    if (!data.slots || data.slots.length === 0) {
      container.innerHTML = `<p class="slot-empty">${data.message || t('slotEmptyDefault')}</p>`;
      return;
    }
    container.innerHTML = '';
    data.slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = slot;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSlot = slot;
      });
      container.appendChild(btn);
    });
  } catch (err) {
    container.innerHTML = `<p class="slot-empty">${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById('doctorSelect').addEventListener('change', loadAvailability);
dateInput.addEventListener('change', loadAvailability);
dateInput.addEventListener('input', loadAvailability);

function renderAppointments() {
  const list = document.getElementById('appointmentsList');
  const mine = allAppointmentsCache.filter(a => a.patientId === user.id);
  list.innerHTML = mine.length === 0 ? `<p>${t('noAppointmentsYet')}</p>` : '';
  mine.forEach(appt => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${t('withDoctorPrefix')} ${escapeHtml(appt.doctorName)}</h3>
      <p>${t('dateFieldLabel')} ${new Date(appt.appointmentDate).toLocaleString(localeTag())}</p>
      <p>${t('statusFieldLabel')} <span class="status-${appt.status}">${translateStatus(appt.status)}</span></p>
      <p>${t('notesFieldLabel')} ${escapeHtml(appt.notes) || '-'}</p>`;
    list.appendChild(card);
  });
}

async function loadAppointments() {
  const list = document.getElementById('appointmentsList');
  list.innerHTML = `<p>${t('loading')}</p>`;
  try {
    const data = await apiRequest('/appointments');
    allAppointmentsCache = data.appointments;
    renderAppointments();
  } catch (err) {
    list.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById('bookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const doctorId = document.getElementById('doctorSelect').value;
  const date = dateInput.value;
  const notes = document.getElementById('appointmentNotes').value;
  const msgBox = document.getElementById('bookMessage');
  msgBox.textContent = '';
  msgBox.className = '';

  if (!doctorId || !date || !selectedSlot) {
    msgBox.textContent = t('bookErrorMissing');
    msgBox.className = 'error';
    return;
  }

  try {
    await apiRequest('/appointments', 'POST', {
      patientId: user.id,
      patientName: user.name,
      patientEmail: user.email,
      doctorId,
      appointmentDate: `${date}T${selectedSlot}:00.000Z`,
      notes
    });
    msgBox.textContent = t('bookSuccess');
    msgBox.className = 'success';
    document.getElementById('bookForm').reset();
    selectedSlot = null;
    document.getElementById('slotsContainer').innerHTML = `<p class="slot-hint">${t('slotHint')}</p>`;
    loadAppointments();
  } catch (err) {
    msgBox.textContent = err.message === 'This time slot is no longer available'
      ? t('bookErrorSlotTaken')
      : err.message;
    msgBox.className = 'error';
    loadAvailability();
  }
});

window.onLanguageChange = () => {
  renderWelcome();
  renderSpecialtyFilter();
  renderDoctors();
  renderAppointments();
};

renderWelcome();
loadSpecialtiesFilter();
loadDoctors();
loadAppointments();
