# Assistant Workflow V8 — install on the existing repository

This patch extends the existing Assistant page and appointment service. It does not replace the project or change the current Dentist/Patient pages.

## What it adds

- Assistant agenda: existing Today / Upcoming / All filters and Confirm / Cancel actions remain.
- Check-in for a confirmed appointment. Arrival is persisted in a new `AppointmentCheckIns` PostgreSQL table.
- Waiting-room list with arrival time and administrative patient details only.
- Walk-in registration: creates an appointment and a waiting-room entry in one database transaction. If the same email already has an appointment at this clinic, its existing `patientId` is reused; otherwise a new patient identifier is generated. This does **not** create a patient login account.
- Dentist-only queue transitions: only the doctor can move a patient from waiting to called, then in consultation, then completed. The Assistant API cannot call the next patient or start/finish a consultation.
- The Assistant API responses contain only appointment/arrival fields. No clinical notes, clinical records, diagnoses, treatment plans, or odontogram data are returned.
- French/Arabic labels for the new Assistant workflow.

## Important prerequisites

- Run this from the existing `medical-appointment` repository root.
- The current appointment service is expected to use `sequelize.sync({ alter: true })` as in the installed V4 source, so Sequelize creates the new check-in table on startup.
- Do not run `docker compose down -v`.
- Keep the existing SQL backups. This patch does not restore or delete any data.

## Install (Git Bash)

Download `medical-appointment-assistant-workflow-v8.zip` to Windows `Downloads`, then run:

```bash
cd ~/OneDrive/Desktop/medical-appointment

PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-assistant-workflow-v8.zip' -print -quit)"
if [ -z "$PATCH" ]; then
  echo "Assistant V8 ZIP not found in Downloads"
  exit 1
fi

# Back up the current appointment DB before the schema adds the check-in table.
DB_BACKUP="../appointment-db-before-assistant-v8-$(date +%Y%m%d-%H%M%S).sql"
docker compose exec -T appointment-db sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$DB_BACKUP" || exit 1
echo "Database backup: $DB_BACKUP"

# Extract the installer and its payload into the repository root.
unzip -o "$PATCH" -d .

# Apply the source patch. The installer makes a timestamped code backup outside the repo.
python INSTALL_ASSISTANT_WORKFLOW_V8.py

# Static validation and focused unit tests.
node --check appointment-service/src/controllers/appointmentController.js
node --check appointment-service/src/routes/appointments.js
node --check appointment-service/src/models/AppointmentCheckIn.js
node --check appointment-service/src/utils/queueTransitions.js
node --check api-gateway/src/index.js
node --check frontend/public/js/assistant-dashboard.js
(cd appointment-service && npm test)
docker compose config --quiet

# Rebuild only services affected by this feature.
docker compose up -d --build appointment-service api-gateway frontend

docker compose ps
```

## Smoke tests

```bash
curl -4 -sS -o /dev/null -w "Assistant page HTTP %{http_code}\n" \
  http://127.0.0.1:8081/assistant-dashboard.html
curl -4 -sS -o /dev/null -w "Unauthenticated waiting-room API HTTP %{http_code} (expected 401)\n" \
  http://127.0.0.1:8080/appointments/waiting-room
curl -4 -sS -o /dev/null -w "Unauthenticated walk-in API HTTP %{http_code} (expected 401)\n" \
  http://127.0.0.1:8080/appointments/walk-ins
```

## Recreate the Assistant login after the database restore

The earlier Users backup contained only 5 patients and 1 doctor, so the previous Assistant login was not restored. Sign in as the Dentist, open the Dentist dashboard, open Chrome DevTools → Console, and run this using a new password chosen locally:

```js
apiRequest('/auth/assistants', 'POST', {
  name: 'Assistant Cabinet',
  email: 'hamdisalma123@gmail.com',
  password: 'CHOOSE_A_NEW_STRONG_PASSWORD'
}).then(console.log).catch(console.error);
```

The request uses the currently signed-in Dentist JWT. Do not send the password in chat. After the success response, log out and sign in using the new Assistant credentials.

## Browser verification

1. Open `http://127.0.0.1:8081/assistant-dashboard.html` as the Assistant.
2. Confirm the agenda and the four counters load.
3. Confirm a pending appointment; then press **Enregistrer l’arrivée** on that confirmed appointment.
4. Verify it appears in **Salle d’attente** with an arrival time. Refresh and confirm it remains.
5. Add a walk-in using a real patient name and email; verify a new appointment and waiting-room entry appear. The walk-in does not automatically create a patient login.
6. Switch FR/AR and verify the new labels change language.
7. As Assistant, verify the clinical API is forbidden (`403`) and queue-status changes are forbidden (`403`).
8. As Dentist, the queue-status API may advance a waiting patient to `called`; this patch does not yet add the Dentist's visual queue controls, which can be added as the next Dentist-side step.

## Data notes

- The new `AppointmentCheckIns` table is keyed by `appointmentId` and unique per appointment, so repeated check-in clicks do not create duplicate queue entries.
- A normal appointment can be checked in only after it is `confirmed`.
- A walk-in is created as `confirmed` and `waiting` in one transaction.
- The Assistant cannot mark an appointment `completed`; that remains Dentist-only through the existing appointment status rules.
