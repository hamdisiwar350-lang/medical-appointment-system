# Assistant Portal — Figma-matched V9

This patch updates only the Assistant frontend presentation and client-side interaction. It uses the existing V8 reception API already installed in the project.

## What changes

- Rebuilds the Assistant page using the original Figma visual structure: dark teal sidebar, clinic status pill, violet active navigation, compact profile footer, sticky topbar, search, language toggle, four stat cards, weekly calendar, queue preview, and pending-request cards.
- Uses the signed-in Assistant's real name and real appointment/queue data. No example patients, dates, or hard-coded appointment numbers are included.
- Makes the week calendar dynamic from actual appointments, with current week dates, week navigation, selected day, and clickable appointment events.
- Keeps Agenda filters and search, Confirm / Cancel, Check-in, Waiting Room, Patients (administrative-only list from appointments), Requests, and Walk-in form.
- Keeps the Assistant's allowed workflow only. There is no button to call the next patient or start/finish a consultation.
- Uses the V8 administrative endpoints only. No clinical API is called and no medical notes, diagnoses, treatment plans, prescriptions, or odontogram fields are requested or rendered.
- Adds French/Arabic labels and responsive mobile navigation.

## Prerequisite

The V8 API must already exist:
- `GET /appointments/waiting-room`
- `POST /appointments/:id/check-in`
- `POST /appointments/walk-ins`
- protected appointment status route for Confirm / Cancel

The installer checks the controller, routes, model, and Gateway guards. If any V8 backend piece is missing, it stops without changing files.

## Install (Git Bash)

Download `medical-appointment-assistant-figma-v9.zip` to Windows Downloads, then:

```bash
cd ~/OneDrive/Desktop/medical-appointment

PATCH="$(find "$HOME/Downloads" -maxdepth 1 -type f -iname 'medical-appointment-assistant-figma-v9.zip' -print -quit)"
if [ -z "$PATCH" ]; then
  echo "V9 ZIP not found in Downloads"
  exit 1
fi

unzip -o "$PATCH" -d .
python INSTALL_ASSISTANT_FIGMA_V9.py

node --check frontend/public/js/assistant-dashboard-figma.js
docker compose config --quiet

docker compose up -d --build frontend

docker compose ps

curl -4 -sS -o /dev/null -w "Assistant page HTTP %{http_code}\n" \
  http://127.0.0.1:8081/assistant-dashboard.html
curl -4 -sS -o /dev/null -w "Assistant JS HTTP %{http_code}\n" \
  http://127.0.0.1:8081/js/assistant-dashboard-figma.js?v=20261126-v9
curl -4 -sS -o /dev/null -w "Assistant CSS HTTP %{http_code}\n" \
  http://127.0.0.1:8081/css/assistant-figma.css?v=20261126-v9
```

No database restore or schema migration is performed by V9. The installer backs up the current Assistant page and style assets outside the repository.

## Browser test

1. Log in with the Assistant account and open `http://127.0.0.1:8081/assistant-dashboard.html`.
2. Hard-refresh with `Ctrl + Shift + R`.
3. Check that the page visually follows the Figma layout and the displayed appointment/queue values are loaded from the API.
4. Click Agenda, File d'attente, Patients, Patient sans RDV, and Demandes in the sidebar; each navigates to its matching section.
5. Try Confirm / Cancel on real pending appointments. Check-in is available only after confirmation.
6. Register a real walk-in only when appropriate; it creates an administrative appointment/queue entry, not a patient login.
7. Switch FR/AR, resize to mobile, and verify the sidebar menu.
8. Confirm the Assistant cannot access `/clinical` (expected 403) and cannot call `/appointments/:id/queue-status` (expected 403).

Do not run `docker compose down -v`. This patch does not change PostgreSQL data, the Dentist portal, or the Patient portal.
