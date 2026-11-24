#!/bin/bash
# Teste la concurrence : 10 reservations simultanees sur le meme creneau

GATEWAY="http://127.0.0.1:8080"
EMAIL="patient$RANDOM@test.com"
DOC_EMAIL="doc$RANDOM@hopital.tn"
PASSWORD="123456"

get_field() {
  echo "$1" | sed -E "s/.*\"$2\":\"?([^\",}]*)\"?.*/\1/"
}

echo "=== Setup: patient + doctor ==="
REG=$(curl -s -X POST $GATEWAY/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Patient Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"role\":\"patient\"}")
USER_ID=$(get_field "$REG" id)

LOGIN=$(curl -s -X POST $GATEWAY/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(get_field "$LOGIN" token)

DOC=$(curl -s -X POST $GATEWAY/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Dr Concurrence\",\"specialty\":\"Test\",\"email\":\"$DOC_EMAIL\",\"phone\":\"20000000\"}")
DOCTOR_ID=$(get_field "$DOC" id)

echo "USER_ID=$USER_ID"
echo "TOKEN=${TOKEN:0:20}..."
echo "DOCTOR_ID=$DOCTOR_ID"
echo

if [ -z "$DOCTOR_ID" ] || [ "$DOCTOR_ID" = "$DOC" ]; then
  echo "Echec setup, arret."
  exit 1
fi

SLOT="2026-12-15T09:00:00"

echo "=== Envoi de 10 reservations simultanees sur le creneau $SLOT ==="
for i in $(seq 1 10); do
  curl -s -o /tmp/resp_$i.json -w "Requete $i -> HTTP %{http_code}\n" \
    -X POST $GATEWAY/appointments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"patientId\":\"$USER_ID\",\"patientName\":\"Patient Test\",\"patientEmail\":\"$EMAIL\",\"doctorId\":\"$DOCTOR_ID\",\"appointmentDate\":\"$SLOT\",\"notes\":\"test $i\"}" &
done
wait

echo
echo "=== Resume ==="
SUCCESS=$(grep -l "201" /tmp/resp_*.json 2>/dev/null | wc -l)
echo "Verification via codes HTTP ci-dessus."
echo "Nombre de reponses avec 'Appointment created successfully' :"
grep -l "created successfully" /tmp/resp_*.json | wc -l
echo "Nombre de reponses avec 'no longer available' (409) :"
grep -l "no longer available" /tmp/resp_*.json | wc -l

rm -f /tmp/resp_*.json
