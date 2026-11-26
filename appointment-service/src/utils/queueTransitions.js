const DOCTOR_TRANSITIONS = Object.freeze({
  waiting: ['called', 'left'],
  called: ['in_consultation', 'left'],
  in_consultation: ['completed'],
  completed: [],
  left: []
});

function canUpdateQueueStatus(role, currentStatus, nextStatus) {
  if (role !== 'doctor') return false;
  return (DOCTOR_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

module.exports = { canUpdateQueueStatus, DOCTOR_TRANSITIONS };
