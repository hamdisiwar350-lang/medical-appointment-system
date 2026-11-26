# Patient files + shared dentist sidebar (V3)

This is a focused patch for the existing Node.js/Express + PostgreSQL + Docker Compose application. It does not replace the repository or its stack.

## What it adds

- One clinical file per **distinct real patient ID** found in this clinic dentist's appointment history. No sample patients or fabricated clinical history are inserted.
- The file stores medical history, allergies, current medications, clinical notes, and permanent FDI tooth findings.
- Each tooth finding is saved against both the configured clinic dentist and the real patient ID.
- Patient file pages show the patient's real appointment history.
- Clinical endpoints are protected at the API Gateway for the dentist role only. The appointment service also verifies the user ID matches `CLINIC_DOCTOR_ID`.
- A shared, responsive dentist sidebar is used by the dashboard, consultations/appointments, patient directory, patient file, notifications, and settings views. It keeps the selected patient's context for the odontogram, treatment-plan, and document links.
- The patient notifications view retains the patient-specific sidebar; the assistant keeps a separate administrative view and has no clinical-record navigation or API access.
- The dashboard passes the selected FDI tooth into the patient file, and its “next patient” label does not describe a completed visit as upcoming.
- The appointment service JSON body limit is raised to 64 KB to accommodate the clinical profile and note limits.

## Not included yet

Structured diagnosis and treatment-plan persistence, document upload/storage, and patient-facing sharing of clinical data are not implemented by this patch. Those areas remain explicitly marked as not connected; no Save action pretends to store them.

## Install (Git Bash)

1. Download `medical-appointment-patient-files-sidebar-v3.zip` into your Windows Downloads folder.
2. Open Git Bash in the existing repository and run:

```bash
cd ~/OneDrive/Desktop/medical-appointment

PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-patient-files-sidebar-v3.zip' -print -quit)"
if [ -z "$PATCH" ]; then
  echo "Patch ZIP not found in Downloads"
  exit 1
fi

# Backup the existing appointment database before the service creates the new tables.
DB_BACKUP="../appointment-db-before-clinical-$(date +%Y%m%d-%H%M%S).sql"
docker compose exec -T appointment-db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DB_BACKUP" || exit 1
echo "Database backup: $DB_BACKUP"

# Backup the files this patch replaces.
BACKUP="../medical-appointment-before-patient-files-sidebar-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/api-gateway" "$BACKUP/appointment-service" "$BACKUP/frontend"
cp -a api-gateway/src/index.js "$BACKUP/api-gateway/index.js"
cp -a appointment-service/src "$BACKUP/appointment-service/src"
cp -a frontend/public "$BACKUP/frontend/public"
echo "File backup: $BACKUP"

# Apply the patch without replacing the repository.
unzip -o "$PATCH" -d .

# Check syntax and Compose configuration.
find appointment-service/src api-gateway/src frontend/public/js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
docker compose config --quiet

# Rebuild only the affected services.
docker compose up -d --build appointment-service api-gateway frontend

docker compose ps

# Basic HTTP checks (use IPv4 on this machine).
curl -4 -sS -o /dev/null -w "Doctor page HTTP %{http_code}\n" http://127.0.0.1:8081/doctor-dashboard.html
curl -4 -sS -o /dev/null -w "Patient directory HTTP %{http_code}\n" http://127.0.0.1:8081/doctor-patients.html
curl -4 -sS -o /dev/null -w "API health HTTP %{http_code}\n" http://127.0.0.1:8080/health
curl -4 -sS -o /dev/null -w "Unauthenticated clinical API HTTP %{http_code} (expected 401)\n" http://127.0.0.1:8080/clinical/patients
```

Do **not** run `docker compose down -v`; it would remove the database volumes.

## Browser verification

- Sign in with the dentist account and open `http://127.0.0.1:8081/doctor-patients.html`.
- The directory should show one card per distinct patient with an appointment at this clinic. Opening a card should use that patient's `patientId` in the URL.
- In a patient file, save the medical history, allergies, and medications; refresh and verify they remain.
- Add a clinical note; refresh and verify it remains.
- Select a tooth (for example FDI 24), set a status and optional note, save, refresh, and verify the tooth color/status remains.
- Move between Vue clinique, Consultations, Dossiers patients, Odontogramme, Plans de traitement, Documents, Notifications, and Paramètres. The dentist sidebar should remain the same and mark the current section.
- Sign in as the assistant in a separate browser profile and confirm the assistant cannot open the clinical pages or call `/clinical` (the Gateway must return 403 for the assistant token).

## Data and access notes

- A blank file is created lazily the first time the dentist directory or an individual file is loaded. It is unique per `(doctorId, patientId)` and is populated only with information the dentist enters.
- The source of the patient directory is the appointment service, scoped to `CLINIC_DOCTOR_ID`. Users with no appointment at this clinic are not added as clinic patients by this patch.
- Access is role-gated to the configured dentist. This patch does not add at-rest encryption or a document-storage service; deploy medical data only in an appropriately secured environment.
- This patch was checked for JavaScript syntax, HTML IDs/assets, the 32 permanent FDI tooth numbers, and static route protection. A live Docker/PostgreSQL runtime test must be performed in the user's repository after installation.
