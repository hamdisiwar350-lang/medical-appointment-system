(() => {
  'use strict';
  const patientId = new URLSearchParams(window.location.search).get('patientId');
  const $ = id => document.getElementById(id);
  const escape = value => escapeHtml(value ?? '');
  const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const validFdi = new Set([
    18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,
    48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38
  ]);
  const requestedTooth = Number.parseInt(new URLSearchParams(window.location.search).get('tooth') || '24', 10);
  const state = { data: null, selectedTooth: validFdi.has(requestedTooth) ? requestedTooth : 24 };
  const statusLabels = { unreported: 'Non renseignée', healthy: 'Saine', caries: 'Carie', filled: 'Obturée', crown: 'Couronne', missing: 'Absente' };
  const diagnosisStatusLabels = { active: 'Actif', monitoring: 'À surveiller', resolved: 'Résolu' };
  const planStatusLabels = { proposed: 'Proposé', accepted: 'Accepté', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
  const planPriorityLabels = { low: 'Basse', normal: 'Normale', high: 'Haute' };
  const toothSvg = '<svg class="fd-tooth-svg" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 3c1.7-.7 3 .5 4.5.5s2.8-1.2 4.5-.5c3.8 1.5 3.3 7 1.8 10.3-1.1 2.3-1.4 7.7-3.3 7.7-1.8 0-1.3-5.8-3-5.8S10.8 21 9 21c-1.9 0-2.2-5.4-3.3-7.7C4.2 10 3.7 4.5 7.5 3Z"/></svg>';
  const fmtDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric' }); };
  const fmtTime = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }); };
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase();

  if (!patientId) {
    $('recordPatientName').textContent = 'Aucun patient sélectionné';
    $('recordPatientEmail').textContent = 'Ouvrez un dossier depuis la liste des patients.';
    document.querySelectorAll('#patientMedicalProfileForm input, #patientMedicalProfileForm textarea, #clinicalNoteForm textarea, #diagnosisForm input, #diagnosisForm textarea, #diagnosisForm select, #treatmentPlanForm input, #treatmentPlanForm textarea, #treatmentPlanForm select, #saveProfileButton, #saveClinicalNoteButton, #saveDiagnosisButton, #saveTreatmentPlanButton, #recordToothStatus, #recordToothNote, #saveToothButton').forEach(node => { node.disabled = true; });
    return;
  }

  function renderToothRows() {
    const odontogram = state.data?.record?.odontogram || {};
    const renderRow = (numbers, lower) => numbers.map(number => {
      const finding = odontogram[String(number)] || { status: 'unreported', note: '' };
      const selected = number === state.selectedTooth;
      const status = statusLabels[finding.status] ? finding.status : 'unreported';
      return `<button type="button" class="fd-tooth status-${status}${selected ? ' selected' : ''}" data-tooth="${number}" aria-pressed="${selected}" title="Dent ${number} — ${statusLabels[status]}">${lower ? '' : `<span>${number}</span>`}<span class="fd-tooth-visual">${toothSvg}</span>${lower ? `<span>${number}</span>` : ''}</button>`;
    }).join('');
    $('recordUpperTeeth').innerHTML = renderRow(UPPER, false);
    $('recordLowerTeeth').innerHTML = renderRow(LOWER, true);
    renderSelectedTooth();
  }

  function renderSelectedTooth() {
    const finding = state.data?.record?.odontogram?.[String(state.selectedTooth)] || { status: 'unreported', note: '' };
    $('recordSelectedTooth').textContent = String(state.selectedTooth);
    $('recordToothDescription').textContent = `${statusLabels[finding.status] || 'Non renseignée'}${finding.note ? ` · ${finding.note}` : ''}`;
    $('recordToothStatus').value = finding.status || 'unreported';
    $('recordToothNote').value = finding.note || '';
    document.querySelectorAll('[data-tooth]').forEach(button => {
      button.classList.toggle('selected', Number(button.dataset.tooth) === state.selectedTooth);
      button.setAttribute('aria-pressed', String(Number(button.dataset.tooth) === state.selectedTooth));
    });
  }

  function renderNotes() {
    const notes = state.data?.notes || [];
    $('clinicalNotesList').innerHTML = notes.length ? notes.map(note => `<article class="fd-note-item"><p>${escape(note.note)}</p><time>${fmtDate(note.createdAt)} · ${fmtTime(note.createdAt)}</time></article>`).join('') : '<div class="fd-empty-state">Aucune note clinique enregistrée pour ce patient.</div>';
  }

  function renderDiagnosisAndPlans() {
    const diagnoses = state.data?.diagnoses || [];
    const plans = state.data?.treatmentPlans || [];
    const diagnosisList = $('diagnosesList');
    const planList = $('treatmentPlansList');
    const toothOptions = ['<option value="">Aucune dent précise</option>', ...[...UPPER, ...LOWER].map(number => `<option value="${number}">${number}</option>`)].join('');
    $('diagnosisToothNumber').innerHTML = toothOptions;
    const diagnosisOptions = ['<option value="">Sans diagnostic associé</option>', ...diagnoses.map(item => `<option value="${escape(item.id)}">${escape(item.diagnosis)}</option>`)].join('');
    $('planDiagnosisId').innerHTML = diagnosisOptions;

    diagnosisList.innerHTML = diagnoses.length ? diagnoses.map(item => `
      <article class="fd-clinical-record-item">
        <div class="fd-clinical-record-title"><strong>${escape(item.diagnosis)}</strong>${item.toothNumber ? `<span class="fd-module-state">Dent ${item.toothNumber}</span>` : ''}</div>
        ${item.details ? `<p>${escape(item.details)}</p>` : ''}
        <div class="fd-clinical-record-meta"><time>${fmtDate(item.createdAt)}</time><label>État <select data-diagnosis-status="${escape(item.id)}"><option value="active" ${item.status === 'active' ? 'selected' : ''}>Actif</option><option value="monitoring" ${item.status === 'monitoring' ? 'selected' : ''}>À surveiller</option><option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Résolu</option></select></label></div>
      </article>`).join('') : '<div class="fd-empty-state">Aucun diagnostic enregistré pour ce patient.</div>';

    const diagnosisById = new Map(diagnoses.map(item => [item.id, item.diagnosis]));
    planList.innerHTML = plans.length ? plans.map(item => `
      <article class="fd-clinical-record-item">
        <div class="fd-clinical-record-title"><strong>${escape(item.title)}</strong><span class="fd-priority priority-${escape(item.priority)}">${planPriorityLabels[item.priority] || 'Normale'}</span></div>
        ${item.description ? `<p>${escape(item.description)}</p>` : ''}
        <div class="fd-clinical-record-meta"><span>${item.diagnosisId && diagnosisById.has(item.diagnosisId) ? `Diagnostic : ${escape(diagnosisById.get(item.diagnosisId))}` : 'Sans diagnostic associé'}${item.plannedDate ? ` · Prévu le ${fmtDate(item.plannedDate)}` : ''}</span><label>État <select data-plan-status="${escape(item.id)}"><option value="proposed" ${item.status === 'proposed' ? 'selected' : ''}>Proposé</option><option value="accepted" ${item.status === 'accepted' ? 'selected' : ''}>Accepté</option><option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>En cours</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Terminé</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Annulé</option></select></label></div>
      </article>`).join('') : '<div class="fd-empty-state">Aucun plan de traitement enregistré pour ce patient.</div>';
  }

  function renderAppointments() {
    const items = state.data?.appointments || [];
    $('recordAppointmentRows').innerHTML = items.length ? items.map(item => `<tr><td>${fmtDate(item.appointmentDate)}</td><td>${fmtTime(item.appointmentDate)}</td><td><span class="fd-status ${escape(item.status)}">${escape(({pending:'En attente',confirmed:'Confirmé',cancelled:'Annulé',completed:'Terminé'})[item.status] || item.status)}</span></td><td>${escape(item.requestMessage || '—')}</td></tr>`).join('') : '<tr><td colspan="4" class="fd-empty-row">Aucun rendez-vous trouvé.</td></tr>';
  }

  function render() {
    const patient = state.data.patient;
    const record = state.data.record;
    $('recordAvatar').textContent = initials(patient.name);
    $('recordPatientName').textContent = patient.name || 'Patient';
    $('recordPatientEmail').textContent = patient.email || '—';
    $('recordPatientMeta').textContent = `${state.data.appointments.length} rendez-vous enregistrés · Dossier créé le ${fmtDate(record.createdAt)}`;
    $('medicalHistory').value = record.medicalHistory || '';
    $('patientAllergies').value = record.allergies || '';
    $('patientMedications').value = record.medications || '';
    $('recordSaveState').textContent = `Mis à jour : ${fmtDate(record.updatedAt)}`;
    renderToothRows();
    renderNotes();
    renderDiagnosisAndPlans();
    renderAppointments();
  }

  async function loadRecord() {
    $('recordPatientName').textContent = 'Chargement du dossier…';
    try {
      state.data = await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}`);
      render();
    } catch (error) {
      $('recordPatientName').textContent = 'Dossier introuvable';
      $('recordPatientEmail').textContent = error.message || 'Impossible de charger ce dossier.';
      $('recordSaveState').textContent = 'Erreur de chargement';
      ['saveProfileButton','saveToothButton','saveClinicalNoteButton','saveDiagnosisButton','saveTreatmentPlanButton'].forEach(id => { if ($(id)) $(id).disabled = true; });
      console.error('[Patient file] API error:', error);
    }
  }

  $('patientMedicalProfileForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('saveProfileButton');
    const feedback = $('profileFeedback');
    button.disabled = true; feedback.className = 'fd-feedback'; feedback.textContent = 'Enregistrement…';
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}`, 'PUT', {
        medicalHistory: $('medicalHistory').value,
        allergies: $('patientAllergies').value,
        medications: $('patientMedications').value
      });
      feedback.className = 'fd-feedback success'; feedback.textContent = 'Informations médicales enregistrées.';
      await loadRecord();
    } catch (error) {
      feedback.className = 'fd-feedback error'; feedback.textContent = error.message || 'Échec de l’enregistrement.';
    } finally { button.disabled = false; }
  });

  $('clinicalNoteForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('saveClinicalNoteButton');
    const feedback = $('noteFeedback');
    const note = $('clinicalNoteInput').value.trim();
    if (!note) return;
    button.disabled = true; feedback.className = 'fd-feedback'; feedback.textContent = 'Enregistrement…';
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/notes`, 'POST', { note });
      $('clinicalNoteInput').value = '';
      feedback.className = 'fd-feedback success'; feedback.textContent = 'Note clinique enregistrée.';
      await loadRecord();
    } catch (error) {
      feedback.className = 'fd-feedback error'; feedback.textContent = error.message || 'Échec de l’enregistrement.';
    } finally { button.disabled = false; }
  });

  $('diagnosisForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('saveDiagnosisButton');
    const feedback = $('diagnosisFeedback');
    button.disabled = true; feedback.className = 'fd-feedback'; feedback.textContent = 'Enregistrement…';
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/diagnoses`, 'POST', {
        diagnosis: $('diagnosisName').value.trim(),
        toothNumber: $('diagnosisToothNumber').value || null,
        details: $('diagnosisDetails').value.trim()
      });
      $('diagnosisForm').reset();
      feedback.className = 'fd-feedback success'; feedback.textContent = 'Diagnostic enregistré.';
      await loadRecord();
    } catch (error) {
      feedback.className = 'fd-feedback error'; feedback.textContent = error.message || 'Échec de l’enregistrement.';
    } finally { button.disabled = false; }
  });

  $('treatmentPlanForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('saveTreatmentPlanButton');
    const feedback = $('planFeedback');
    button.disabled = true; feedback.className = 'fd-feedback'; feedback.textContent = 'Enregistrement…';
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/treatment-plans`, 'POST', {
        title: $('planTitle').value.trim(),
        diagnosisId: $('planDiagnosisId').value || null,
        description: $('planDescription').value.trim(),
        plannedDate: $('planDate').value || null,
        priority: $('planPriority').value
      });
      $('treatmentPlanForm').reset();
      feedback.className = 'fd-feedback success'; feedback.textContent = 'Plan de traitement enregistré.';
      await loadRecord();
    } catch (error) {
      feedback.className = 'fd-feedback error'; feedback.textContent = error.message || 'Échec de l’enregistrement.';
    } finally { button.disabled = false; }
  });

  $('diagnosesList').addEventListener('change', async event => {
    const select = event.target.closest('select[data-diagnosis-status]');
    if (!select) return;
    select.disabled = true;
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/diagnoses/${encodeURIComponent(select.dataset.diagnosisStatus)}`, 'PUT', { status: select.value });
      await loadRecord();
    } catch (error) {
      window.alert(error.message || 'Impossible de modifier le diagnostic.');
      await loadRecord();
    } finally { select.disabled = false; }
  });

  $('treatmentPlansList').addEventListener('change', async event => {
    const select = event.target.closest('select[data-plan-status]');
    if (!select) return;
    select.disabled = true;
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/treatment-plans/${encodeURIComponent(select.dataset.planStatus)}`, 'PUT', { status: select.value });
      await loadRecord();
    } catch (error) {
      window.alert(error.message || 'Impossible de modifier le plan de traitement.');
      await loadRecord();
    } finally { select.disabled = false; }
  });

  ['recordUpperTeeth','recordLowerTeeth'].forEach(id => $(id).addEventListener('click', event => {
    const tooth = event.target.closest('button[data-tooth]');
    if (!tooth) return;
    state.selectedTooth = Number(tooth.dataset.tooth);
    renderToothRows();
  }));

  $('saveToothButton').addEventListener('click', async () => {
    const button = $('saveToothButton');
    const feedback = $('toothFeedback');
    button.disabled = true; feedback.className = 'fd-feedback'; feedback.textContent = 'Enregistrement…';
    try {
      await apiRequest(`/clinical/patients/${encodeURIComponent(patientId)}/teeth/${state.selectedTooth}`, 'PUT', {
        status: $('recordToothStatus').value,
        note: $('recordToothNote').value.trim()
      });
      feedback.className = 'fd-feedback success'; feedback.textContent = `Dent ${state.selectedTooth} enregistrée.`;
      await loadRecord();
    } catch (error) {
      feedback.className = 'fd-feedback error'; feedback.textContent = error.message || 'Échec de l’enregistrement.';
    } finally { button.disabled = false; }
  });

  loadRecord();
})();
