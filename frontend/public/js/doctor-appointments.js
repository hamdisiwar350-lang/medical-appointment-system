(() => {
  'use strict';
  let appointments = [];
  let activeFilter = 'today';
  let searchTerm = '';
  const $ = id => document.getElementById(id);
  const escape = value => escapeHtml(value ?? '');
  const parse = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
  const isToday = value => { const d = parse(value), n = new Date(); return !!d && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
  const fmtDate = value => parse(value)?.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' }) || '—';
  const fmtTime = value => parse(value)?.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }) || '—';
  const labels = { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé', completed: 'Terminé' };

  function visibleRows() {
    let rows = appointments;
    if (activeFilter === 'today') rows = rows.filter(a => isToday(a.appointmentDate));
    if (activeFilter === 'upcoming') rows = rows.filter(a => parse(a.appointmentDate) > new Date() && a.status !== 'cancelled');
    if (searchTerm) rows = rows.filter(a => `${a.patientName || ''} ${a.patientEmail || ''}`.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()));
    return rows.slice().sort((a, b) => (parse(a.appointmentDate)?.getTime() || 0) - (parse(b.appointmentDate)?.getTime() || 0));
  }

  function render() {
    const today = appointments.filter(a => isToday(a.appointmentDate) && a.status !== 'cancelled');
    $('appointmentTodayCount').textContent = String(today.length);
    $('appointmentPendingCount').textContent = String(appointments.filter(a => a.status === 'pending').length);
    $('appointmentCompletedCount').textContent = String(appointments.filter(a => a.status === 'completed').length);
    $('appointmentPatientCount').textContent = String(new Set(appointments.map(a => a.patientId).filter(Boolean)).size);
    const body = $('doctorAppointmentRows');
    const rows = visibleRows();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="fd-empty-row">Aucun rendez-vous pour ce filtre.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(a => {
      const patientLink = `doctor-patient-file.html?patientId=${encodeURIComponent(a.patientId || '')}`;
      let actions = '<span class="fd-no-action">—</span>';
      if (a.status === 'pending') actions = `<button class="fd-action confirm" data-id="${escape(a.id)}" data-status="confirmed">Confirmer</button><button class="fd-action cancel" data-id="${escape(a.id)}" data-status="cancelled">Annuler</button>`;
      else if (a.status === 'confirmed') actions = `<button class="fd-action confirm" data-id="${escape(a.id)}" data-status="completed">Terminer</button><button class="fd-action cancel" data-id="${escape(a.id)}" data-status="cancelled">Annuler</button>`;
      return `<tr><td><a class="fd-patient-link" href="${patientLink}">${escape(a.patientName || 'Patient')}</a><small>${escape(a.patientEmail || '')}</small></td><td><strong>${fmtDate(a.appointmentDate)}</strong><small>${fmtTime(a.appointmentDate)}</small></td><td><span class="fd-status ${escape(a.status)}">${labels[a.status] || escape(a.status)}</span></td><td><div class="fd-actions">${actions}</div></td></tr>`;
    }).join('');
  }

  async function load() {
    $('doctorAppointmentRows').innerHTML = '<tr><td colspan="4" class="fd-empty-row">Chargement…</td></tr>';
    try {
      const response = await apiRequest('/appointments');
      appointments = Array.isArray(response.appointments) ? response.appointments : [];
      $('appointmentsSync').textContent = 'Données synchronisées';
      render();
    } catch (error) {
      $('appointmentsSync').textContent = 'Erreur API';
      $('doctorAppointmentRows').innerHTML = `<tr><td colspan="4" class="fd-empty-row">${escape(error.message || 'Impossible de charger les rendez-vous.')}</td></tr>`;
      console.error('[Dentist appointments] API error:', error);
    }
  }

  $('appointmentFilters')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll('#appointmentFilters button').forEach(item => item.classList.toggle('active', item === button));
    render();
  });
  $('doctorAppointmentRows')?.addEventListener('click', async event => {
    const button = event.target.closest('button[data-id][data-status]');
    if (!button || button.disabled) return;
    if (button.dataset.status === 'cancelled' && !window.confirm('Confirmer l’annulation de ce rendez-vous ?')) return;
    button.disabled = true;
    try {
      await apiRequest(`/appointments/${encodeURIComponent(button.dataset.id)}/status`, 'PUT', { status: button.dataset.status });
      await load();
    } catch (error) {
      window.alert(error.message || 'Impossible de modifier ce rendez-vous.');
      button.disabled = false;
    }
  });
  document.addEventListener('doctor-search', event => { searchTerm = String(event.detail || '').trim(); render(); });
  load();
})();
