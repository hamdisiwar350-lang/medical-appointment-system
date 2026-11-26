(() => {
  'use strict';
  const grid = document.getElementById('doctorPatientGrid');
  if (!grid) return;

  let patients = [];
  const pageParams = new URLSearchParams(window.location.search);
  let search = pageParams.get('q')?.trim() || '';

  const initialSearch = document.getElementById('patientDirectorySearch');
  if (initialSearch && search) initialSearch.value = search;
  const text = id => document.getElementById(id);
  const escape = value => escapeHtml(value ?? '');
  const locale = () => typeof localeTag === 'function' ? localeTag() : 'fr-FR';
  const date = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();

  function render() {
    const q = search.toLocaleLowerCase();
    const visible = patients.filter(patient => `${patient.patientName || ''} ${patient.patientEmail || ''}`.toLocaleLowerCase().includes(q));
    if (!visible.length) {
      grid.innerHTML = `<div class="fd-empty-state">${patients.length ? 'Aucun patient ne correspond à cette recherche.' : 'Aucun patient réel enregistré dans les rendez-vous de ce cabinet.'}</div>`;
      return;
    }
    grid.innerHTML = visible.map(patient => {
      const href = `doctor-patient-file.html?patientId=${encodeURIComponent(patient.patientId)}`;
      const actionLabel = 'Ouvrir le dossier patient';
      return `<article class="fd-patient-card">
        <div class="fd-patient-card-head"><div class="fd-patient-card-avatar">${escape(initials(patient.patientName))}</div><div><h3>${escape(patient.patientName)}</h3><p>${escape(patient.patientEmail)}</p></div></div>
        <div class="fd-patient-card-meta"><div><span>Dernier rendez-vous</span><strong>${escape(date(patient.lastAppointment))}</strong></div><div><span>Nombre de rendez-vous</span><strong>${Number(patient.appointmentCount) || 0}</strong></div></div>
        <div class="fd-patient-card-meta"><div><span>Consultations terminées</span><strong>${Number(patient.completedCount) || 0}</strong></div><div><span>Dossier médical</span><strong>Créé</strong></div></div>
        <a class="fd-primary" href="${href}">${escape(actionLabel)}</a>
      </article>`;
    }).join('');
  }

  async function loadPatients() {
    grid.innerHTML = '<div class="fd-empty-state">Chargement des dossiers patients…</div>';
    try {
      const response = await apiRequest('/clinical/patients');
      patients = Array.isArray(response.patients) ? response.patients : [];
      text('patientCount').textContent = String(response.count ?? patients.length);
      text('patientAppointmentTotal').textContent = String(patients.reduce((sum, patient) => sum + (Number(patient.appointmentCount) || 0), 0));
      text('patientsSync').textContent = 'Dossiers synchronisés';
      render();
    } catch (error) {
      grid.innerHTML = `<div class="fd-empty-state">Impossible de charger les dossiers : ${escape(error.message || 'Erreur API')}</div>`;
      text('patientsSync').textContent = 'Erreur de synchronisation';
      console.error('[Dentist patients] Failed to load patient files:', error);
    }
  }

  document.getElementById('patientDirectorySearch')?.addEventListener('input', event => {
    search = event.target.value.trim();
    render();
  });
  document.addEventListener('doctor-search', event => {
    search = String(event.detail || '').trim();
    const localSearch = document.getElementById('patientDirectorySearch');
    if (localSearch) localSearch.value = search;
    render();
  });
  loadPatients();
})();
