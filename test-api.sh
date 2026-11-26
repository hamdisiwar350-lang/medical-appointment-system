#!/usr/bin/env bash
# Smoke test for the one-dentist clinic workflow.
# Requires a configured .env with CLINIC_DOCTOR_ID.
set -euo pipefail

GATEWAY="http://127.0.0.1:8080"
if [[ ! -f .env ]]; then echo "Missing .env"; exit 1; fi
set -a; source .env; set +a
if [[ -z "${CLINIC_DOCTOR_ID:-}" || "$CLINIC_DOCTOR_ID" == "PUT_EXISTING_DENTIST_UUID_HERE" ]]; then
  echo "Set CLINIC_DOCTOR_ID in .env to the existing dentist profile UUID."; exit 1
fi

EMAIL="patient-test-$RANDOM@example.test"
PASSWORD="TestPass123"
APPOINTMENT_DATE="$(date -d '+8 days' '+%Y-%m-%d')T10:00:00+01:00"

printf '\n=== Gateway health ===\n'
curl -fsS "$GATEWAY/health"; echo

printf '\n=== Register patient ===\n'
curl -fsS -X POST "$GATEWAY/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Patient Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"; echo

printf '\n=== Login patient ===\n'
LOGIN=$(curl -fsS -X POST "$GATEWAY/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(printf '%s' "$LOGIN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token||''))")
[[ -n "$TOKEN" ]] || { echo "Login did not return a token"; exit 1; }
echo "Patient login: OK"

printf '\n=== Single clinic dentist profile ===\n'
curl -fsS "$GATEWAY/doctors/clinic" -H "Authorization: Bearer $TOKEN"; echo

printf '\n=== Create appointment (doctorId is selected by server) ===\n'
curl -fsS -X POST "$GATEWAY/appointments" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"patientName\":\"Patient Test\",\"appointmentDate\":\"$APPOINTMENT_DATE\",\"notes\":\"Contrôle dentaire\"}"; echo

printf '\n=== Patient appointments ===\n'
curl -fsS "$GATEWAY/appointments" -H "Authorization: Bearer $TOKEN"; echo

printf '\nSmoke test finished. Check the response statuses and appointment ownership.\n'
