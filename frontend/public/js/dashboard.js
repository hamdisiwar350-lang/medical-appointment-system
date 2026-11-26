const patientUser = getUser();

function patientDashboardForRole(role) {
  if (role === 'doctor') return 'doctor-dashboard.html';
  if (role === 'assistant') return 'assistant-dashboard.html';
  if (role === 'patient') return 'dashboard.html';
  return 'index.html';
}

if (!getToken() || !patientUser || patientUser.role !== 'patient') {
  window.location.replace(
    patientUser ? patientDashboardForRole(patientUser.role) : 'index.html'
  );
} else {
  let clinicDentist = null;
  let appointments = [];
  let selectedSlot = null;

  const dateInput = document.getElementById('appointmentDateInput');
  const slotsContainer = document.getElementById('slotsContainer');
  const bookForm = document.getElementById('bookForm');
  const bookMessage = document.getElementById('bookMessage');

  function localDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function renderPatientProfile() {
    const name = patientUser.name || '';
    document.getElementById('patientName').textContent = name;
    document.getElementById('patientAvatar').textContent =
      name.trim().charAt(0).toUpperCase() || 'P';
    document.getElementById('patientWelcome').textContent =
      t('welcomeGreeting', { name });
    document.getElementById('patientTodayDate').textContent =
      new Date().toLocaleDateString(localeTag(), {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
  }

  function showBookingMessage(message, type = '') {
    bookMessage.textContent = message;
    bookMessage.className = `booking-message ${type}`.trim();
  }

  function renderClinicDentist() {
    if (!clinicDentist) return;
    document.getElementById('clinicDentistName').textContent = clinicDentist.name || t('dentistRoleLabel');
    document.getElementById('clinicDentistDescription').textContent = t('patientDentistCardDescription');
    document.getElementById('clinicHours').textContent =
      `${clinicDentist.availableFrom || '09:00'} – ${clinicDentist.availableTo || '17:00'}`;
    document.getElementById('clinicPhone').textContent = clinicDentist.phone || t('patientPhoneNotProvided');
  }

  async function loadClinicDentist() {
    try {
      clinicDentist = await apiRequest('/doctors/clinic');
      renderClinicDentist();
    } catch (error) {
      document.getElementById('clinicDentistName').textContent = t('patientClinicUnavailable');
      showBookingMessage(t('patientClinicUnavailable'), 'error');
      console.error('Clinic dentist profile:', error);
    }
  }

  function clearSlots(messageKey = 'patientChooseDateHint') {
    selectedSlot = null;
    slotsContainer.innerHTML = '';
    const hint = document.createElement('p');
    hint.className = 'slot-hint';
    hint.textContent = t(messageKey);
    slotsContainer.appendChild(hint);
  }

  async function loadAvailability() {
    const date = dateInput.value;
    clearSlots('patientSlotsLoading');
    if (!date) {
      clearSlots();
      return;
    }

    try {
      const offset = new Date(`${date}T12:00:00`).getTimezoneOffset();
      const data = await apiRequest(
        `/appointments/availability?date=${encodeURIComponent(date)}&timezoneOffset=${offset}`
      );

      slotsContainer.innerHTML = '';
      if (!Array.isArray(data.slots) || data.slots.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'slot-empty';
        empty.textContent = data.message || t('slotEmptyDefault');
        slotsContainer.appendChild(empty);
        return;
      }

      data.slots.forEach(slot => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'clinic-slot';
        button.textContent = slot;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          slotsContainer.querySelectorAll('.clinic-slot').forEach(item => {
            item.classList.remove('selected');
            item.setAttribute('aria-pressed', 'false');
          });
          button.classList.add('selected');
          button.setAttribute('aria-pressed', 'true');
          selectedSlot = slot;
        });
        slotsContainer.appendChild(button);
      });
    } catch (error) {
      slotsContainer.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'slot-empty';
      message.textContent = error.message || t('patientAvailabilityError');
      slotsContainer.appendChild(message);
    }
  }

  function renderAppointments() {
    const body = document.getElementById('appointmentsBody');
    const count = document.getElementById('patientAppointmentCount');
    const sorted = [...appointments].sort(
      (a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate)
    );
    count.textContent = String(sorted.length);

    if (!sorted.length) {
      body.innerHTML = `<tr><td colspan="3" class="empty">${escapeHtml(t('patientEmptyAppointments'))}</td></tr>`;
      return;
    }

    body.innerHTML = sorted.map(appointment => {
      const date = new Date(appointment.appointmentDate).toLocaleString(localeTag(), {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const reason = appointment.notes || t('patientGeneralVisit');
      return `
        <tr>
          <td><strong>${escapeHtml(date)}</strong></td>
          <td>${escapeHtml(reason)}</td>
          <td><span class="badge badge-${escapeHtml(appointment.status)}">${escapeHtml(translateStatus(appointment.status))}</span></td>
        </tr>`;
    }).join('');
  }

  async function loadAppointments() {
    const body = document.getElementById('appointmentsBody');
    try {
      const data = await apiRequest('/appointments');
      appointments = Array.isArray(data.appointments) ? data.appointments : [];
      renderAppointments();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="3" class="empty">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function bookAppointment(event) {
    event.preventDefault();
    if (!clinicDentist) {
      showBookingMessage(t('patientClinicUnavailable'), 'error');
      return;
    }

    const date = dateInput.value;
    const reason = document.getElementById('appointmentReason').value;
    const note = document.getElementById('appointmentNotes').value.trim();

    if (!date || !reason || !selectedSlot) {
      showBookingMessage(t('bookErrorMissing'), 'error');
      return;
    }

    // Convert the selected clinic-local time to UTC before sending it to the API.
    const localAppointmentDate = new Date(`${date}T${selectedSlot}:00`);
    const appointmentDate = localAppointmentDate.toISOString();
    const notes = note ? `${reason} — ${note}` : reason;
    const submitButton = bookForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showBookingMessage(t('patientBookingSubmitting'), '');

    try {
      await apiRequest('/appointments', 'POST', {
        patientName: patientUser.name,
        appointmentDate,
        notes
      });
      showBookingMessage(t('bookSuccess'), 'success');
      bookForm.reset();
      selectedSlot = null;
      clearSlots();
      await loadAppointments();
    } catch (error) {
      showBookingMessage(
        error.message === 'This time slot is no longer available'
          ? t('bookErrorSlotTaken')
          : error.message,
        'error'
      );
      await loadAvailability();
    } finally {
      submitButton.disabled = false;
    }
  }

  function initPatientDashboard() {
    dateInput.min = localDateValue();
    dateInput.addEventListener('change', loadAvailability);
    dateInput.addEventListener('input', loadAvailability);
    bookForm.addEventListener('submit', bookAppointment);

    document.getElementById('logoutBtn').addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });

    document.getElementById('patientNav').addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      document.querySelectorAll('#patientNav .nav-item').forEach(item => {
        item.classList.toggle('active', item === link);
      });
    });

    renderPatientProfile();
    loadClinicDentist();
    loadAppointments();
  }

  window.onLanguageChange = () => {
    renderPatientProfile();
    renderClinicDentist();
    renderAppointments();
    if (dateInput.value) loadAvailability();
    else clearSlots();
  };

  initPatientDashboard();
}
