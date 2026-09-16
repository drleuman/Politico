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

const jcsStr = jcsCanonicalize({
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

const hash = crypto.createHash('sha256').update(jcsStr, 'utf8').digest('hex');

console.log("JCS String:", jcsStr);
console.log("Golden SHA-256 Hash:", hash);

// Simulate PostgreSQL text formatting with regexp_replace
const pgSimulatedText = '{"action": "publish", "docId": "44444444-4444-4444-4444-444444444444"}';
const pgCleanedPayload = pgSimulatedText.replace(/:\s+/g, ':').replace(/,\s+/g, ',');

const pgCanonicalStr = '{"actorId":"' + envelope.actorId + 
  '","eventId":"' + envelope.eventId + 
  '","eventType":"' + envelope.eventType + 
  '","organizationId":"' + envelope.organizationId + 
  '","payload":' + pgCleanedPayload + 
  ',"previousEventHash":"' + envelope.previousEventHash + 
  '","schemaVersion":"' + envelope.schemaVersion + 
  '","sequenceNumber":"' + envelope.sequenceNumber + 
  '","timestampIso":"' + envelope.timestampIso + '"}';

const pgHash = crypto.createHash('sha256').update(pgCanonicalStr, 'utf8').digest('hex');

console.log("PG Canonical String:", pgCanonicalStr);
console.log("PG Computed Hash:", pgHash);
console.log("Equal:", hash === pgHash);
