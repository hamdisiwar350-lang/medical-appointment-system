#!/bin/bash
# Scenario complet : register -> login -> doctor -> appointment -> status -> notifications
# Usage : bash test-api.sh

GATEWAY="http://127.0.0.1:8080"
NOTIF="http://127.0.0.1:3004"
EMAIL="sami$RANDOM@test.com"
DOC_EMAIL="ahmed$RANDOM@hopital.tn"
PASSWORD="123456"

get_field() {
  echo "$1" | sed -E "s/.*\"$2\":\"?([^\",}]*)\"?.*/\1/"
}

echo "=== 0. Health ==="
curl -s $GATEWAY/health; echo; echo

echo "=== 1. Register ==="
REG=$(curl -s -X POST $GATEWAY/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Sami\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"role\":\"patient\"}")
echo "$REG"; echo
USER_ID=$(get_field "$REG" id)

echo "=== 2. Login ==="
LOGIN=$(curl -s -X POST $GATEWAY/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN"; echo
TOKEN=$(get_field "$LOGIN" token)
[ -z "$USER_ID" ] || [ "$USER_ID" = "$LOGIN" ] && USER_ID=$(get_field "$LOGIN" id)
echo "TOKEN = ${TOKEN:0:30}..."
echo "USER_ID = $USER_ID"; echo

if [ -z "$TOKEN" ] || [ "$TOKEN" = "$LOGIN" ]; then
  echo "Pas de token recu, arret du script."
  exit 1
fi

echo "=== 3. Create doctor ==="
DOC=$(curl -s -X POST $GATEWAY/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Dr Ahmed\",\"specialty\":\"Cardiologie\",\"email\":\"$DOC_EMAIL\",\"phone\":\"20123456\"}")
echo "$DOC"; echo
DOCTOR_ID=$(get_field "$DOC" id)
echo "DOCTOR_ID = $DOCTOR_ID"; echo

if [ -z "$DOCTOR_ID" ] || [ "$DOCTOR_ID" = "$DOC" ]; then
  echo "Pas de doctor cree, arret du script."
  exit 1
fi

echo "=== 4. List doctors ==="
curl -s $GATEWAY/doctors -H "Authorization: Bearer $TOKEN"; echo; echo

echo "=== 5. Create appointment ==="
APPT=$(curl -s -X POST $GATEWAY/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"patientId\":\"$USER_ID\",\"patientName\":\"Sami\",\"patientEmail\":\"$EMAIL\",\"doctorId\":\"$DOCTOR_ID\",\"appointmentDate\":\"2026-11-25T10:00:00\",\"notes\":\"Controle annuel\"}")
echo "$APPT"; echo
APPT_ID=$(get_field "$APPT" id)
echo "APPT_ID = $APPT_ID"; echo

echo "=== 6. List appointments ==="
curl -s $GATEWAY/appointments -H "Authorization: Bearer $TOKEN"; echo; echo

echo "=== 7. Update status ==="
curl -s -X PUT $GATEWAY/appointments/$APPT_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"confirmed"}'; echo; echo

echo "=== 8. Notifications (attente 3s pour RabbitMQ) ==="
sleep 3
curl -s "$GATEWAY/notifications" -H "Authorization: Bearer $TOKEN"; echo
