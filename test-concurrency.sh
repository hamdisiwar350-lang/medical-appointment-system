#!/usr/bin/env bash
# Sends 10 simultaneous bookings for the same clinic-local slot.
set -euo pipefail
GATEWAY="http://127.0.0.1:8080"
set -a; source .env; set +a
if [[ -z "${CLINIC_DOCTOR_ID:-}" || "$CLINIC_DOCTOR_ID" == "PUT_EXISTING_DENTIST_UUID_HERE" ]]; then
  echo "Set CLINIC_DOCTOR_ID in .env first."; exit 1
fi
EMAIL="patient-concurrency-$RANDOM@example.test"
PASSWORD="TestPass123"
SLOT_DATE="$(date -d '+12 days' '+%Y-%m-%d')"
SLOT="${SLOT_DATE}T09:30:00+01:00"

REG=$(curl -fsS -X POST "$GATEWAY/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Concurrency Patient\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
LOGIN=$(curl -fsS -X POST "$GATEWAY/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(printf '%s' "$LOGIN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token||''))")
[[ -n "$TOKEN" ]] || { echo "Login failed"; exit 1; }

for i in $(seq 1 10); do
  curl -sS -o "/tmp/clinic_booking_$i.json" -w "Request $i -> HTTP %{http_code}\n" \
    -X POST "$GATEWAY/appointments" -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"patientName\":\"Concurrency Patient\",\"appointmentDate\":\"$SLOT\",\"notes\":\"Concurrency test $i\"}" &
done
wait

printf '\nCreated appointments: '
grep -l 'Appointment created successfully' /tmp/clinic_booking_*.json | wc -l
printf 'Slot conflicts: '
grep -l 'no longer available' /tmp/clinic_booking_*.json | wc -l
rm -f /tmp/clinic_booking_*.json
