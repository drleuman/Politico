const crypto = require('crypto');

// Implementation of JCS Canonicalization in TS/JS (from src/audit/worker.ts)
function jcsCanonicalize(object) {
  if (object === null || object === undefined) {
    return 'null';
  }
  if (typeof object === 'boolean' || typeof object === 'number') {
    return JSON.stringify(object);
  }
  if (typeof object === 'string') {
    return JSON.stringify(object);
  }
  if (Array.isArray(object)) {
    const items = object.map(item => jcsCanonicalize(item));
    return '[' + items.join(',') + ']';
  }
  if (typeof object === 'object') {
    const sortedKeys = Object.keys(object).sort();
    const keyValues = sortedKeys.map(key => {
      const val = jcsCanonicalize(object[key]);
      return JSON.stringify(key) + ':' + val;
    });
    return '{' + keyValues.join(',') + '}';
  }
  return JSON.stringify(object);
}

function computeEventHash(envelope) {
  const canonicalPayload = jcsCanonicalize(envelope.payload);
  const jcsEnvelope = jcsCanonicalize({
    eventId: envelope.eventId,
    organizationId: envelope.organizationId,
    sequenceNumber: envelope.sequenceNumber,
    eventType: envelope.eventType,
    actorId: envelope.actorId,
    timestampIso: envelope.timestampIso,
    previousEventHash: envelope.previousEventHash,
    payload: JSON.parse(canonicalPayload),
    schemaVersion: envelope.schemaVersion
  });
  return crypto.createHash('sha256').update(jcsEnvelope, 'utf8').digest('hex');
}

const envelope = {
  eventId: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  sequenceNumber: "1",
  eventType: "DOCUMENT_PUBLISHED",
  actorId: "33333333-3333-3333-3333-333333333333",
  timestampIso: "2026-09-15T20:00:00.000Z",
  previousEventHash: "0000000000000000000000000000000000000000000000000000000000000000",
  payload: { action: "publish", docId: "44444444-4444-4444-4444-444444444444" },
  schemaVersion: "1.0"
};

const hash = computeEventHash(envelope);
const jcsString = jcsCanonicalize({
  actorId: envelope.actorId,
  eventId: envelope.eventId,
  eventType: envelope.eventType,
  organizationId: envelope.organizationId,
  payload: envelope.payload,
  previousEventHash: envelope.previousEventHash,
  schemaVersion: envelope.schemaVersion,
  sequenceNumber: envelope.sequenceNumber,
  timestampIso: envelope.timestampIso
});

console.log("Canonical JCS String:", jcsString);
console.log("SHA-256 Hash:", hash);
