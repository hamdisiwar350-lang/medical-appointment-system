# Dentist clinical diagnoses + treatment plans (V4)

This patch extends the V3 patient-file backend and shared dentist UI. It does not replace the repository or change the Node.js/Express, PostgreSQL, RabbitMQ, or Docker Compose stack.

## What this adds

- A structured diagnosis list per real clinic patient, optionally linked to an FDI permanent tooth.
- Diagnosis details and status (`active`, `monitoring`, `resolved`).
- A treatment-plan list per patient, optionally linked to a diagnosis, with title, description, planned date, priority, and status (`proposed`, `accepted`, `in_progress`, `completed`, `cancelled`).
- Status updates are retained on the same records. There is no delete action, so the history is not silently removed.
- All queries and writes are scoped to the configured clinic dentist and the real patient ID.
- Clinical routes remain behind API Gateway `verifyToken + requireRole('doctor')`; the appointment service independently checks the forwarded user role and `CLINIC_DOCTOR_ID`.
- Validation for UUIDs, permanent FDI numbers, text lengths, statuses, priorities, and calendar dates.
- Node built-in tests for doctor-only access, tooth-number validation, patient/doctor scoping, diagnosis linking, and plan status updates.

## Patient scope

The clinic patient directory is derived from distinct `patientId` values in this clinic's existing appointment records. This avoids creating medical files for unrelated test accounts or users who have never booked this clinic. Each such patient gets one lazy-created `PatientClinicalRecord` keyed by `(doctorId, patientId)`; diagnoses, plans, notes, and tooth findings use the same two identifiers.

## Install in Git Bash

Download `medical-appointment-diagnoses-treatment-plans-v4.zip` to Windows `Downloads`, then run this from the existing repository:

```bash
cd ~/OneDrive/Desktop/medical-appointment

PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-diagnoses-treatment-plans-v4.zip' -print -quit)"
if [ -z "$PATCH" ]; then
  echo "V4 ZIP not found in Downloads"
  exit 1
fi

# Back up the appointment database first.
DB_BACKUP="../appointment-db-before-clinical-v4-$(date +%Y%m%d-%H%M%S).sql"
docker compose exec -T appointment-db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DB_BACKUP" || exit 1
echo "Database backup: $DB_BACKUP"

# Back up only files this patch replaces.
BACKUP="../medical-appointment-before-clinical-v4-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/appointment-service" "$BACKUP/frontend"
cp -a appointment-service/src "$BACKUP/appointment-service/"
cp -a appointment-service/package.json "$BACKUP/appointment-service/"
cp -a frontend/public "$BACKUP/frontend/"

echo "Code backup: $BACKUP"

# Overlay the patch on the existing repository.
unzip -o "$PATCH" -d .

# Validate source and unit tests.
find appointment-service/src appointment-service/test frontend/public/js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
(cd appointment-service && npm test)
docker compose config --quiet

# Rebuild only the affected services.
docker compose up -d --build appointment-service frontend
docker compose ps

# HTTP smoke checks.
curl -4 -sS -o /dev/null -w "Patient file HTTP %{http_code}\n" http://127.0.0.1:8081/doctor-patient-file.html
curl -4 -sS -o /dev/null -w "API health HTTP %{http_code}\n" http://127.0.0.1:8080/health
curl -4 -sS -o /dev/null -w "Clinical API without login HTTP %{http_code} (expected 401)\n" http://127.0.0.1:8080/clinical/patients
```

Do not run `docker compose down -v`; that removes database volumes.

## Browser verification

1. Sign in as the clinic dentist and open `doctor-patients.html`.
2. Open a real patient file. Confirm existing medical history, notes, and saved FDI tooth findings still appear.
3. Add a diagnosis (optionally select tooth 24), save, refresh, and confirm it remains.
4. Add a treatment plan linked to that diagnosis, set a priority/date, save, refresh, and confirm it remains.
5. Change diagnosis and plan statuses; refresh and confirm the statuses remain.
6. Open another patient file and confirm the first patient's diagnosis/plan do not appear there.
7. Sign in as the assistant in a separate browser profile and confirm the assistant cannot open clinical pages or call `/clinical` (expected 403 for the assistant token).

## Database verification

After saving test data through the dentist interface, this read-only query shows the persisted rows:

```bash
MSYS_NO_PATHCONV=1 docker compose exec -T appointment-db sh -lc \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c 'SELECT \"doctorId\", \"patientId\", diagnosis, status, \"createdAt\" FROM \"ClinicalDiagnoses\" ORDER BY \"createdAt\" DESC LIMIT 20;' -c 'SELECT \"doctorId\", \"patientId\", title, status, priority, \"plannedDate\", \"createdAt\" FROM \"TreatmentPlans\" ORDER BY \"createdAt\" DESC LIMIT 20;'"
```

## Important limits

- Existing Sequelize startup uses `sequelize.sync({ alter: true })`. The two new models are loaded before that call so the new tables are created/updated using the project's existing schema-sync approach. Take the database backup above before rebuilding.
- This patch does not add document upload/storage, prescriptions, or patient-facing disclosure of medical data.
- This is a project implementation, not a claim of medical-regulatory certification or production-grade at-rest encryption. Use real clinical data only in an appropriately secured environment.
