from pathlib import Path
import shutil
import sys
from datetime import datetime

ROOT = Path.cwd()
BUNDLE = ROOT / 'assistant-workflow-v8'

required = [
    ROOT / 'appointment-service/src/controllers/appointmentController.js',
    ROOT / 'appointment-service/src/routes/appointments.js',
    ROOT / 'appointment-service/src/index.js',
    ROOT / 'api-gateway/src/index.js',
    ROOT / 'frontend/public/assistant-dashboard.html',
    ROOT / 'frontend/public/js/assistant-dashboard.js',
]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit('Run this installer from the medical-appointment repository root. Missing: ' + ', '.join(missing))

controller_path = ROOT / 'appointment-service/src/controllers/appointmentController.js'
routes_path = ROOT / 'appointment-service/src/routes/appointments.js'
service_index_path = ROOT / 'appointment-service/src/index.js'
gateway_path = ROOT / 'api-gateway/src/index.js'
html_path = ROOT / 'frontend/public/assistant-dashboard.html'

controller = controller_path.read_text(encoding='utf-8')
routes = routes_path.read_text(encoding='utf-8')
service_index = service_index_path.read_text(encoding='utf-8')
gateway = gateway_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

# Refuse to reapply the same patch over itself.
if 'exports.getWaitingRoom' in controller or 'assistant-workflow.css' in html:
    raise SystemExit('Assistant Workflow V8 appears to be already installed. No files were changed.')

# Check required integration anchors before creating any backup or writing files.
checks = [
    ('appointment controller Appointment model import', "const Appointment = require('../models/Appointment');" in controller),
    ('appointment controller updateStatus marker', 'exports.updateStatus = async' in controller),
    ('appointment routes controller import', "require('../controllers/appointmentController')" in routes),
    ('appointment routes getAllAppointments marker', 'router.get(\'/\', getAllAppointments);' in routes),
    ('Sequelize alter sync', 'sequelize.sync({ alter: true })' in service_index),
    ('TreatmentPlan model bootstrap marker', "require('./models/TreatmentPlan');" in service_index),
    ('publishStatusUpdated import', 'publishStatusUpdated' in controller),
    ('Gateway authorizeAppointmentRoute marker', 'function authorizeAppointmentRoute(req, res, next)' in gateway),
    ('Gateway requireRole middleware', "const requireRole = require('./middlewares/requireRole');" in gateway),
    ('Assistant stylesheet marker', '<link rel="stylesheet" href="css/dental-theme.css">' in html),
    ('Assistant action column marker', '<th data-i18n="colActions"></th>' in html),
    ('Assistant privacy note marker', '<p class="assistant-privacy-note"' in html),
]
failed = [name for name, ok in checks if not ok]
if failed:
    raise SystemExit('Installer safety check failed; no files were changed: ' + ', '.join(failed))

# Prepare a dated backup of every file this patch changes.
timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
backup = ROOT.parent / f'medical-appointment-before-assistant-v8-{timestamp}'
backup.mkdir(parents=True, exist_ok=False)
backup_targets = [
    controller_path,
    routes_path,
    service_index_path,
    gateway_path,
    html_path,
    ROOT / 'frontend/public/js/assistant-dashboard.js',
]
for path in backup_targets:
    relative = path.relative_to(ROOT)
    destination = backup / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)

# Install the new Sequelize model and utility.
new_files = [
    ('appointment-service/src/models/AppointmentCheckIn.js', 'appointment-service/src/models/AppointmentCheckIn.js'),
    ('appointment-service/src/utils/queueTransitions.js', 'appointment-service/src/utils/queueTransitions.js'),
    ('frontend/public/css/assistant-workflow.css', 'frontend/public/css/assistant-workflow.css'),
    ('frontend/public/js/assistant-dashboard.js', 'frontend/public/js/assistant-dashboard.js'),
    ('appointment-service/test/queueTransitions.test.js', 'appointment-service/test/queueTransitions.test.js'),
]
for source_rel, dest_rel in new_files:
    source = BUNDLE / source_rel
    if not source.is_file():
        raise SystemExit(f'Patch bundle is incomplete: {source_rel}')
    destination = ROOT / dest_rel
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

# Add model to the app bootstrap (controller also imports it, this makes sync order explicit).
model_marker = "require('./models/TreatmentPlan');"
if model_marker not in service_index:
    raise SystemExit('Unexpected appointment-service/src/index.js; backup exists, but bootstrap was not modified.')
service_index = service_index.replace(model_marker, model_marker + "\nrequire('./models/AppointmentCheckIn');", 1)
service_index_path.write_text(service_index, encoding='utf-8')

# Extend controller imports using unique aliases to avoid conflicts with existing imports.
controller = controller.replace(
    "const Appointment = require('../models/Appointment');",
    "const Appointment = require('../models/Appointment');\n"
    "const AppointmentCheckIn = require('../models/AppointmentCheckIn');\n"
    "const receptionSequelize = require('../config/database');\n"
    "const { Op: ReceptionOp } = require('sequelize');\n"
    "const { randomUUID: createReceptionUUID } = require('crypto');\n"
    "const { canUpdateQueueStatus } = require('../utils/queueTransitions');",
    1
)
insert_source = (BUNDLE / 'appointment-service/controller-insert.js').read_text(encoding='utf-8')
insert_source = insert_source.replace("const AppointmentCheckIn = require('../models/AppointmentCheckIn');\n", '')
insert_source = insert_source.replace("const sequelize = require('../config/database');\n", '')
insert_source = insert_source.replace("const { Op } = require('sequelize');\n", '')
insert_source = insert_source.replace("const { randomUUID } = require('crypto');\n", '')
insert_source = insert_source.replace("const { canUpdateQueueStatus } = require('../utils/queueTransitions');\n", '')
insert_source = insert_source.replace('Op.in', 'ReceptionOp.in')
insert_source = insert_source.replace('sequelize.transaction', 'receptionSequelize.transaction')
insert_source = insert_source.replace('randomUUID()', 'createReceptionUUID()')
controller = controller.replace('exports.updateStatus = async', insert_source + '\nexports.updateStatus = async', 1)

cancel_guard = '''    if (role === 'assistant' && status === 'cancelled') {
      const activeCheckIn = await AppointmentCheckIn.findOne({
        where: {
          appointmentId: appointment.id,
          status: { [ReceptionOp.in]: ['waiting', 'called', 'in_consultation'] }
        }
      });
      if (activeCheckIn) {
        return res.status(409).json({ error: 'This patient has already checked in; ask the dentist before cancelling' });
      }
    }

'''
transition_marker = '    const allowedNextStatuses = transitions[appointment.status] || [];'
if transition_marker not in controller:
    raise SystemExit('Could not find appointment status transition marker; no controller file was written.')
controller = controller.replace(transition_marker, cancel_guard + transition_marker, 1)

save_marker = '    appointment.status = status;\n    await appointment.save();'
queue_cancel_sync = '''    appointment.status = status;
    await appointment.save();

    if (status === 'cancelled' && role === 'doctor') {
      const activeCheckIn = await AppointmentCheckIn.findOne({
        where: {
          appointmentId: appointment.id,
          status: { [ReceptionOp.in]: ['waiting', 'called'] }
        }
      });
      if (activeCheckIn) await activeCheckIn.update({ status: 'left' });
    }'''
if save_marker not in controller:
    raise SystemExit('Could not find appointment save marker; no controller file was written.')
controller = controller.replace(save_marker, queue_cancel_sync, 1)
controller_path.write_text(controller, encoding='utf-8')

# Add service routes, with /waiting-room registered before the generic /:id route.
routes = routes.replace(
    '  updateStatus\n} = require',
    '  updateStatus,\n  getWaitingRoom,\n  checkInAppointment,\n  createWalkIn,\n  updateQueueStatus\n} = require',
    1
)
routes = routes.replace(
    "router.get('/', getAllAppointments);",
    "router.get('/', getAllAppointments);\n"
    "router.get('/waiting-room', getWaitingRoom);\n"
    "router.post('/walk-ins', createWalkIn);\n"
    "router.post('/:id/check-in', checkInAppointment);\n"
    "router.put('/:id/queue-status', updateQueueStatus);",
    1
)
if not all(name in routes for name in ['getWaitingRoom', 'checkInAppointment', 'createWalkIn', 'updateQueueStatus']):
    raise SystemExit('Appointment route injection failed; no route file was written.')
routes_path.write_text(routes, encoding='utf-8')

# Add narrow Gateway routes before the generic /appointments proxy.
gateway_routes = r'''
// Reception workflow: limited to administrative appointment data.
app.use(
  '/appointments/waiting-room',
  verifyToken,
  requireRole('doctor', 'assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => '/appointments/waiting-room'
  })
);

app.use(
  '/appointments/walk-ins',
  verifyToken,
  requireRole('assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => '/appointments/walk-ins'
  })
);

app.use(
  '/appointments/:id/check-in',
  verifyToken,
  requireRole('doctor', 'assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/check-in`
  })
);

// Only the dentist may call the next patient or advance the queue to consultation.
app.use(
  '/appointments/:id/queue-status',
  verifyToken,
  requireRole('doctor'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/queue-status`
  })
);
'''
marker = 'function authorizeAppointmentRoute(req, res, next) {'
gateway = gateway.replace(marker, gateway_routes + '\n' + marker, 1)
if not all(path in gateway for path in ['/appointments/waiting-room', '/appointments/walk-ins', '/appointments/:id/check-in', '/appointments/:id/queue-status']):
    raise SystemExit('Gateway route injection failed; no gateway file was written.')
gateway_path.write_text(gateway, encoding='utf-8')

# Extend the current Assistant page without replacing its overall shell/design.
html = html.replace(
    '<link rel="stylesheet" href="css/dental-theme.css">',
    '<link rel="stylesheet" href="css/dental-theme.css">\n  <link rel="stylesheet" href="css/assistant-workflow.css?v=20261126-8">',
    1
)
waiting_stat = '''        <div class="stat-card">
          <div class="stat-icon green" data-icon="users" data-size="22"></div>
          <div>
            <strong id="assistantStatWaiting">0</strong>
            <span class="label" data-assistant-i18n="waitingStatLabel">Patients en attente</span>
          </div>
        </div>
'''
html = html.replace(
    '      </section>\n\n      <section class="panel assistant-appointments-panel">',
    waiting_stat + '      </section>\n\n      <section class="panel assistant-appointments-panel">',
    1
)

search_markup = '''          <div class="assistant-agenda-tools">
            <input id="assistantAppointmentSearch" class="assistant-agenda-search" type="search"
              data-assistant-i18n-placeholder="searchPlaceholder" placeholder="Rechercher un patient…" autocomplete="off">
          </div>
'''
html = html.replace(
    '          <div class="pills-row" id="assistantAppointmentFilter">',
    search_markup + '          <div class="pills-row" id="assistantAppointmentFilter">',
    1
)

html = html.replace(
    '<th data-i18n="colActions"></th>',
    '<th data-i18n="colActions"></th>\n                <th data-assistant-i18n="checkInColumn">Accueil</th>',
    1
)
html = html.replace('colspan="4" class="empty" data-i18n="loading"', 'colspan="5" class="empty" data-i18n="loading"', 1)
workflow_markup = '''
      <div class="assistant-workflow-grid">
        <section class="panel assistant-workflow-panel assistant-waiting-panel">
          <div class="panel-head">
            <div class="assistant-reception-heading">
              <span class="icon-badge" data-icon="users" data-size="16"></span>
              <h2 class="section-title" data-assistant-i18n="waitingTitle">Salle d’attente</h2>
            </div>
            <span class="assistant-panel-count" id="assistantWaitingCount">0</span>
          </div>
          <p class="assistant-walkin-hint" data-assistant-i18n="waitingHint">Les patients enregistrés à l’accueil apparaissent ici. Seul le dentiste peut appeler le prochain patient.</p>
          <div class="table-wrap">
            <table class="appt-table">
              <thead><tr><th data-assistant-i18n="patient">Patient</th><th data-assistant-i18n="arrival">Arrivée</th><th data-assistant-i18n="appointment">Rendez-vous</th><th data-assistant-i18n="state">État</th></tr></thead>
              <tbody id="assistantWaitingBody"><tr><td colspan="4" class="empty">Chargement…</td></tr></tbody>
            </table>
          </div>
        </section>

        <section class="panel assistant-workflow-panel assistant-walkin-panel">
          <div class="panel-head">
            <div class="assistant-reception-heading">
              <span class="icon-badge" data-icon="user-plus" data-size="16"></span>
              <h2 class="section-title" data-assistant-i18n="walkInTitle">Patient sans rendez-vous</h2>
            </div>
          </div>
          <p class="assistant-walkin-hint" data-assistant-i18n="walkInHint">Enregistrez un patient présent au cabinet. Il sera ajouté à l’agenda et à la salle d’attente.</p>
          <form id="assistantWalkInForm" class="assistant-walkin-form">
            <label for="walkInPatientName" data-assistant-i18n="patientName">Nom complet du patient
              <input id="walkInPatientName" name="patientName" type="text" maxlength="255" autocomplete="name" required>
            </label>
            <label for="walkInPatientEmail" data-assistant-i18n="patientEmail">Adresse e-mail
              <input id="walkInPatientEmail" name="patientEmail" type="email" maxlength="255" autocomplete="email" required>
            </label>
            <p id="assistantWalkInMessage" class="assistant-form-message" role="status" aria-live="polite"></p>
            <button type="submit" class="assistant-walkin-submit" data-assistant-i18n="addWalkIn">Ajouter à la salle d’attente</button>
          </form>
        </section>
      </div>

'''
html = html.replace('<p class="assistant-privacy-note"', workflow_markup + '      <p class="assistant-privacy-note"', 1)
html_path.write_text(html, encoding='utf-8')

print('Assistant Workflow V8 installed.')
print('Code backup:', backup)
print('New queue table: AppointmentCheckIns (created by Sequelize sync).')
print('No database rows were changed by this installer.')
