# Fix Odontogramme / Plans / Documents navigation (V6)

This patch fixes the navigation flow that was incomplete in V5:

- From any dentist page without a selected patient, Odontogramme, Plans de traitement, and Documents open the patient directory with a preserved `section` intent.
- The directory shows an instruction for the selected destination and changes each patient card action to the requested destination.
- Selecting a patient opens that patient's real file and jumps to the matching anchor:
  - Odontogramme -> `#odontogramSection`
  - Plans de traitement -> `#treatmentPlanSection`
  - Documents -> `#patientDocuments`
- On the patient file, the shared sidebar uses the same anchors and the active item follows the current hash.
- No API, database, role, or patient data changes are included.

## Install

```bash
cd ~/OneDrive/Desktop/medical-appointment
PATCH="$HOME/Downloads/medical-appointment-navigation-fix-v6.zip"
BACKUP="../medical-appointment-before-navigation-v6-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/frontend/public/js" "$BACKUP/frontend/public"
cp frontend/public/js/doctor-app-shell.js "$BACKUP/frontend/public/js/"
cp frontend/public/js/doctor-patients.js "$BACKUP/frontend/public/js/"
cp frontend/public/doctor-patients.html "$BACKUP/frontend/public/"
for f in doctor-dashboard.html doctor-appointments.html doctor-notifications.html doctor-settings.html doctor-patient-file.html; do
  cp "frontend/public/$f" "$BACKUP/frontend/public/"
done
unzip -o "$PATCH" -d .
node --check frontend/public/js/doctor-app-shell.js
node --check frontend/public/js/doctor-patients.js
docker compose config --quiet
docker compose up -d --build frontend
```

Do not use `docker compose down -v`. This patch does not change PostgreSQL or backend services.

## Test

1. Open `http://127.0.0.1:8081/doctor-dashboard.html`.
2. Click Odontogramme. The patient list should open with the instruction to choose a patient for the odontogram.
3. Click the intended patient's action. The patient file should open at `#odontogramSection`.
4. Repeat with Plans de traitement and Documents.
5. On a patient file, click each of these sidebar items. They should jump to the corresponding section within the same patient's file.
