const crypto = require('crypto');

function jcsCanonicalize(object) {
  if (object === null || object === undefined) return 'null';
  if (typeof object === 'boolean' || typeof object === 'number') return JSON.stringify(object);
  if (typeof object === 'string') return JSON.stringify(object);
  if (Array.isArray(object)) {
    return '[' + object.map(item => jcsCanonicalize(item)).join(',') + ']';
  }
  if (typeof object === 'object') {
    const sortedKeys = Object.keys(object).sort();
    return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + jcsCanonicalize(object[k])).join(',') + '}';
  }
  return JSON.stringify(object);
}

const payload = { z: 1, a: "á", nested: { y: true, x: null } };

const envelope = {
  eventId: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  sequenceNumber: "1",
  eventType: "DOCUMENT_PUBLISHED",
  actorId: "33333333-3333-3333-3333-333333333333",
  timestampIso: "2026-09-15T20:00:00.000Z",
  previousEventHash: "0000000000000000000000000000000000000000000000000000000000000000",
  payload: payload,
  schemaVersion: "1.0"
};

const canonicalPayload = jcsCanonicalize(payload);
console.log("JCS Payload:", canonicalPayload);

const jcsEnvelope = jcsCanonicalize({
  actorId: envelope.actorId,
  eventId: envelope.eventId,
  eventType: envelope.eventType,
  organizationId: envelope.organizationId,
  payload: payload,
  previousEventHash: envelope.previousEventHash,
  schemaVersion: envelope.schemaVersion,
  sequenceNumber: envelope.sequenceNumber,
  timestampIso: envelope.timestampIso
});

console.log("JCS Envelope:", jcsEnvelope);
const hash = crypto.createHash('sha256').update(jcsEnvelope, 'utf8').digest('hex');
console.log("Adversarial Test Vector Hash:", hash);
