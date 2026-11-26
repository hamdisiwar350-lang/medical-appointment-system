# V7 — Keep clinical modules inside the patient dossier

This patch changes only the Dentist frontend navigation.

## Expected navigation

The global Dentist sidebar contains only:
- Vue clinique
- Consultations
- Dossiers patients
- Notifications
- Paramètres

The following are removed from the global sidebar:
- Odontogramme
- Plans de traitement
- Documents

Those three remain available inside an opened patient dossier, in a dedicated dossier navigation row. Their links jump to the corresponding sections of that same patient's file:
- Odontogramme → `#odontogramSection`
- Plans de traitement → `#treatmentPlanSection`
- Documents → `#patientDocuments`

The patient directory opens patient files normally; it no longer contains the old sidebar section-intent behavior. The three dossier links support French and Arabic labels and indicate the selected section.

## Files included

- `frontend/public/js/doctor-app-shell.js`
- `frontend/public/js/doctor-patients.js`
- `frontend/public/doctor-patient-file.html`
- Dentist page HTML files with a cache-busting query for the shared sidebar script.

No backend, database, authentication, or patient data is changed.

## Install in Git Bash

Download `medical-appointment-dossier-only-modules-v7.zip` to `Downloads`, then run:

```bash
cd ~/OneDrive/Desktop/medical-appointment
PATCH="$HOME/Downloads/medical-appointment-dossier-only-modules-v7.zip"

if [ ! -f "$PATCH" ]; then
  echo "V7 ZIP not found in Downloads"
  exit 1
fi

BACKUP="../medical-appointment-before-dossier-nav-v7-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/frontend/public/js" "$BACKUP/frontend/public"
cp frontend/public/js/doctor-app-shell.js "$BACKUP/frontend/public/js/"
cp frontend/public/js/doctor-patients.js "$BACKUP/frontend/public/js/"
for f in doctor-dashboard.html doctor-appointments.html doctor-patients.html doctor-notifications.html doctor-settings.html doctor-patient-file.html; do
  cp "frontend/public/$f" "$BACKUP/frontend/public/"
done

unzip -o "$PATCH" -d .

node --check frontend/public/js/doctor-app-shell.js
node --check frontend/public/js/doctor-patients.js
docker compose config --quiet
docker compose up -d --build frontend
```

Do not run `docker compose down -v`. No database change is needed.

## Test

1. Open `http://127.0.0.1:8081/doctor-dashboard.html` and verify the sidebar has only the five global entries listed above.
2. Open `Dossiers patients`, then open any patient.
3. Inside that patient file, use the three dossier links: Odontogramme, Plans de traitement, Documents.
4. Confirm each link scrolls to the relevant section within the same patient's dossier.
5. Change language to Arabic and confirm the three dossier labels and global sidebar labels translate.
