# Dentist dashboard: next patient only (V5)

This patch changes the dentist overview to show **only the next future appointment**. It does not automatically open or load any patient dossier. The doctor can open any patient's file from **Dossiers patients** (the directory cards link to each real patient's file).

## What changes

- Removes the embedded patient file preview, odontogram, clinical note, diagnosis/plan preview, documents panel, and full appointment table from the dashboard.
- Removes the fallback that displayed the last completed/registered patient when no upcoming appointment existed.
- The dashboard calls only `GET /appointments`; it no longer calls `/clinical/patients` or `/clinical/patients/:id`.
- Keeps summary counters and a single next-patient card.
- The next-patient card has links to Consultations and Dossiers patients, not a direct patient-file link.
- From the patient directory, the dentist can search and open any patient belonging to this clinic. The sidebar's Odontogramme, Plans de traitement, and Documents items send the dentist to the patient directory when no patient is selected; once a patient file is open, they jump to that patient's section.
- The shared sidebar cache version is bumped on all six dentist views.

## Install

Download `medical-appointment-dashboard-next-patient-v5.zip` to Windows Downloads, then run from the existing repository:

```bash
cd ~/OneDrive/Desktop/medical-appointment

PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-dashboard-next-patient-v5.zip' -print -quit)"
if [ -z "$PATCH" ]; then echo "V5 ZIP not found in Downloads"; exit 1; fi

BACKUP="../medical-appointment-before-dashboard-v5-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/frontend/public/js" "$BACKUP/frontend/public/css"
for page in doctor-dashboard.html doctor-appointments.html doctor-patients.html \
  doctor-notifications.html doctor-settings.html doctor-patient-file.html; do
  cp "frontend/public/$page" "$BACKUP/frontend/public/"
done
cp frontend/public/js/doctor-app-shell.js "$BACKUP/frontend/public/js/"
cp frontend/public/js/doctor-patients.js "$BACKUP/frontend/public/js/"

unzip -o "$PATCH" -d .

node --check frontend/public/js/doctor-dashboard-overview.js
node --check frontend/public/js/doctor-app-shell.js
node --check frontend/public/js/doctor-patients.js
docker compose config --quiet

docker compose up -d --build frontend

curl -4 -sS -o /dev/null -w "Dashboard HTTP %{http_code}\n" http://127.0.0.1:8081/doctor-dashboard.html
curl -4 -sS -o /dev/null -w "Patients HTTP %{http_code}\n" http://127.0.0.1:8081/doctor-patients.html
```

Do **not** run `docker compose down -v`. This patch does not touch any database, volume, API service, or patient data.

## Verify in the browser

1. Sign in as the dentist and open `doctor-dashboard.html`.
2. Confirm only one patient appears: the nearest future appointment with `pending` or `confirmed` status. Past/completed appointments should not appear as a patient card or table on the dashboard.
3. Click **Choisir un dossier patient** or the **Dossiers patients** sidebar item.
4. Open different patients from the directory and confirm each opens its own `doctor-patient-file.html?patientId=...` page.
5. On a patient file, Odontogramme / Plans de traitement / Documents sidebar links should stay on that same patient's file and jump to the corresponding section.
