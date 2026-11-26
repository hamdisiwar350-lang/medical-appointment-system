from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd()
BUNDLE = ROOT / 'assistant-figma-v9' / 'frontend' / 'public'

required = [
    ROOT / 'frontend/public/assistant-dashboard.html',
    ROOT / 'frontend/public/js/api.js',
    ROOT / 'appointment-service/src/controllers/appointmentController.js',
    ROOT / 'appointment-service/src/routes/appointments.js',
    ROOT / 'appointment-service/src/models/AppointmentCheckIn.js',
    ROOT / 'api-gateway/src/index.js',
]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit('Run from the existing medical-appointment repository root. Missing: ' + ', '.join(missing))

# V9 is a visual integration over the V8 reception API. Refuse to install a visual
# shell that would show Check-in / Waiting Room / Walk-in controls without endpoints.
controller = (ROOT / 'appointment-service/src/controllers/appointmentController.js').read_text(encoding='utf-8')
routes = (ROOT / 'appointment-service/src/routes/appointments.js').read_text(encoding='utf-8')
gateway = (ROOT / 'api-gateway/src/index.js').read_text(encoding='utf-8')
service_index = (ROOT / 'appointment-service/src/index.js').read_text(encoding='utf-8')
checks = {
    'waiting-room controller': 'exports.getWaitingRoom' in controller,
    'check-in controller': 'exports.checkInAppointment' in controller,
    'walk-in controller': 'exports.createWalkIn' in controller,
    'queue model bootstrap': "require('./models/AppointmentCheckIn')" in service_index,
    'waiting-room route': 'getWaitingRoom' in routes and "router.get('/waiting-room'" in routes,
    'check-in route': 'checkInAppointment' in routes and "router.post('/:id/check-in'" in routes,
    'walk-in route': 'createWalkIn' in routes and "router.post('/walk-ins'" in routes,
    'waiting-room gateway protection': "'/appointments/waiting-room'" in gateway,
    'walk-in gateway protection': "'/appointments/walk-ins'" in gateway,
    'check-in gateway protection': "'/appointments/:id/check-in'" in gateway,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('V8 reception backend is not fully installed; no files were changed. Missing: ' + ', '.join(failed))

source_files = [
    BUNDLE / 'assistant-dashboard.html',
    BUNDLE / 'css/assistant-figma.css',
    BUNDLE / 'js/assistant-dashboard-figma.js',
]
missing_bundle = [str(path) for path in source_files if not path.is_file()]
if missing_bundle:
    raise SystemExit('Patch bundle is incomplete: ' + ', '.join(missing_bundle))

# Back up only the three Assistant frontend files. No API, database, or other role pages are changed.
timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
backup = ROOT.parent / f'medical-appointment-before-assistant-figma-v9-{timestamp}'
backup.mkdir(parents=True, exist_ok=False)
targets = [
    ROOT / 'frontend/public/assistant-dashboard.html',
    ROOT / 'frontend/public/js/assistant-dashboard.js',
    ROOT / 'frontend/public/css/assistant-workflow.css',
    ROOT / 'frontend/public/css/dental-theme.css',
    ROOT / 'frontend/public/css/style.css',
]
for path in targets:
    if path.is_file():
        dest = backup / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)

# Install new, versioned Assistant page assets.
for src in source_files:
    rel = src.relative_to(BUNDLE)
    dest = ROOT / 'frontend/public' / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)

print('Assistant Figma V9 installed.')
print('Backup:', backup)
print('Changed files: assistant-dashboard.html, css/assistant-figma.css, js/assistant-dashboard-figma.js')
print('Backend, PostgreSQL data, Dentist pages, and Patient pages were not modified.')
