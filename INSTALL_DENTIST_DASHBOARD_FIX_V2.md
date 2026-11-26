# Dentist dashboard visual/data fix (v2)

This patch updates only the Dentist dashboard frontend. It does not change the API, database schema, Docker volumes, Patient portal, or Assistant portal.

## Included
- `doctor-dashboard.html` now loads a uniquely named, versioned script (`doctor-dashboard-figma.js?v=20261126-2`) to avoid stale browser cache and avoid replacing the older shared `doctor-dashboard.js` used by other Dentist pages.
- `doctor-dashboard-figma.js` draws all 32 permanent teeth using inline SVG, with correct FDI numbering and accessible tooth selection.
- Appointment summary cards and table read the authenticated `/appointments` response. API errors are shown as errors rather than being represented as zero counts.
- The existing CSS is extended for visible tooth controls and responsive sizing.

## Not included
Medical notes, odontogram conditions, diagnoses, and treatment plans are not persisted because the project does not yet have a secured clinical-record API/database module. All teeth therefore remain “not recorded” until real clinical data is implemented. No sample clinical values are inserted.

## Install from Git Bash
Run from the existing repository root. The command creates a timestamped backup of the two replaced frontend files, installs the patch, checks JavaScript syntax, and rebuilds only the frontend container.

```bash
cd ~/OneDrive/Desktop/medical-appointment
PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-dentist-dashboard-fix-v2.zip' -print -quit)"
if [ -z "$PATCH" ]; then echo "Patch ZIP not found in Downloads"; exit 1; fi
BACKUP="../medical-appointment-before-dentist-fix-v2-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/frontend/public/css"
cp frontend/public/doctor-dashboard.html "$BACKUP/frontend/public/"
cp frontend/public/css/figma-dentist.css "$BACKUP/frontend/public/css/"
unzip -o "$PATCH" -d .
node --check frontend/public/js/doctor-dashboard-figma.js
docker compose up -d --build frontend
```

Then open `http://127.0.0.1:8081/doctor-dashboard.html` and use Ctrl+F5.
