const test = require('node:test');
const assert = require('node:assert/strict');
const { canUpdateQueueStatus } = require('../src/utils/queueTransitions');

test('assistant cannot call the next patient', () => {
  assert.equal(canUpdateQueueStatus('assistant', 'waiting', 'called'), false);
});

test('assistant cannot start a consultation', () => {
  assert.equal(canUpdateQueueStatus('assistant', 'called', 'in_consultation'), false);
});

test('doctor can call a waiting patient', () => {
  assert.equal(canUpdateQueueStatus('doctor', 'waiting', 'called'), true);
});

test('doctor can start after calling', () => {
  assert.equal(canUpdateQueueStatus('doctor', 'called', 'in_consultation'), true);
});

test('doctor can complete an active consultation', () => {
  assert.equal(canUpdateQueueStatus('doctor', 'in_consultation', 'completed'), true);
});

test('invalid queue transitions are rejected', () => {
  assert.equal(canUpdateQueueStatus('doctor', 'waiting', 'completed'), false);
  assert.equal(canUpdateQueueStatus('assistant', 'waiting', 'left'), false);
});
