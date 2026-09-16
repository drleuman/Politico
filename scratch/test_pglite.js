const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');

async function testSchema() {
  const db = new PGlite();
  const ddl = fs.readFileSync('db/migrations/0001_initial_schema.sql', 'utf8').replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- pgcrypto');
  await db.exec(ddl);
  console.log('SCHEMA LOADED SUCCESSFULLY IN PGLITE!');

  const bootstrap = fs.readFileSync('db/bootstrap_roles.sql', 'utf8');
  await db.exec(bootstrap);
  console.log('BOOTSTRAP ROLES LOADED SUCCESSFULLY IN PGLITE!');

  const jcsRes = await db.query(`SELECT jcs_canonicalize_jsonb('{"small": 1e-7, "big": 1e+21, "normal": 100, "dec": 0.0015, "key": "𐀀"}'::jsonb) AS jcs;`);
  console.log('JCS OUTPUT:', jcsRes.rows[0].jcs);

  // Seed test data
  const orgId = '11111111-1111-1111-1111-111111111111';
  const wsId = '22222222-2222-2222-2222-222222222222';
  const authBodyId = '33333333-3333-3333-3333-333333333333';
  const docId = '44444444-4444-4444-4444-444444444444';
  const verId = '55555555-5555-5555-5555-555555555555';
  const subId = '66666666-6666-6666-6666-666666666666';
  const authorId = '77777777-7777-7777-7777-777777777777';
  const voter1Id = '88888888-8888-8888-8888-888888888888';
  const voter2Id = '99999999-9999-9999-9999-999999999999';
  const voter3Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const voter4Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  await db.exec(`
    INSERT INTO organizations (id, name, slug) VALUES ('${orgId}', 'Org Test', 'org-test');
    INSERT INTO workspaces (id, organization_id, name, slug) VALUES ('${wsId}', '${orgId}', 'WS Test', 'ws-test');
    INSERT INTO authority_bodies (id, organization_id, name, slug) VALUES ('${authBodyId}', '${orgId}', 'Auth Body', 'auth-body');
    
    INSERT INTO users (id, email, full_name) VALUES ('${authorId}', 'author@test.org', 'Author');
    INSERT INTO users (id, email, full_name) VALUES ('${voter1Id}', 'voter1@test.org', 'Voter 1');
    INSERT INTO users (id, email, full_name) VALUES ('${voter2Id}', 'voter2@test.org', 'Voter 2');
    INSERT INTO users (id, email, full_name) VALUES ('${voter3Id}', 'voter3@test.org', 'Voter 3');
    INSERT INTO users (id, email, full_name) VALUES ('${voter4Id}', 'voter4@test.org', 'Voter 4');

    INSERT INTO organization_memberships (organization_id, user_id, is_active) VALUES
      ('${orgId}', '${authorId}', true), ('${orgId}', '${voter1Id}', true), ('${orgId}', '${voter2Id}', true), ('${orgId}', '${voter3Id}', true), ('${orgId}', '${voter4Id}', true);

    INSERT INTO authority_memberships (organization_id, authority_body_id, user_id, role, is_active) VALUES
      ('${orgId}', '${authBodyId}', '${voter1Id}', 'APPROVER', true),
      ('${orgId}', '${authBodyId}', '${voter2Id}', 'APPROVER', true),
      ('${orgId}', '${authBodyId}', '${voter3Id}', 'APPROVER', true),
      ('${orgId}', '${authBodyId}', '${voter4Id}', 'APPROVER', true);

    INSERT INTO user_sessions (id, user_id, session_token, last_mfa_verified_at) VALUES
      ('10101010-1010-1010-1010-101010101010', '${voter1Id}', 'token1', NOW()),
      ('20202020-2020-2020-2020-202020202020', '${voter2Id}', 'token2', NOW()),
      ('30303030-3030-3030-3030-303030303030', '${voter3Id}', 'token3', NOW()),
      ('40404040-4040-4040-4040-404040404040', '${voter4Id}', 'token4', NOW());

    INSERT INTO documents (id, organization_id, workspace_id, title, status, assigned_user_id)
    VALUES ('${docId}', '${orgId}', '${wsId}', 'Test Doc', 'FROZEN', '${authorId}');

    INSERT INTO document_versions (id, organization_id, workspace_id, document_id, version_number, content_hash)
    VALUES ('${verId}', '${orgId}', '${wsId}', '${docId}', 1, '1111111111111111111111111111111111111111111111111111111111111111');

    INSERT INTO submissions (id, organization_id, workspace_id, document_id, version_id, submitted_by, status)
    VALUES ('${subId}', '${orgId}', '${wsId}', '${docId}', '${verId}', '${authorId}', 'FROZEN');
  `);

  console.log('TEST DATA SEEDED SUCCESSFULLY!');

  // Cast vote 1
  await db.exec(`
    SELECT set_config('app.current_organization_id', '${orgId}', true);
    SELECT set_config('app.current_user_id', '${voter1Id}', true);
    SELECT cast_vote_transactional(
      '${orgId}'::uuid, '${wsId}'::uuid, '${authBodyId}'::uuid, '${docId}'::uuid, '${verId}'::uuid, '${subId}'::uuid, '${voter1Id}'::uuid, 'APPROVE'
    );
  `);
  console.log('CAST VOTE 1 SUCCESSFUL!');

  // Cast vote 2
  await db.exec(`
    SELECT set_config('app.current_organization_id', '${orgId}', true);
    SELECT set_config('app.current_user_id', '${voter2Id}', true);
    SELECT cast_vote_transactional(
      '${orgId}'::uuid, '${wsId}'::uuid, '${authBodyId}'::uuid, '${docId}'::uuid, '${verId}'::uuid, '${subId}'::uuid, '${voter2Id}'::uuid, 'APPROVE'
    );
  `);
  console.log('CAST VOTE 2 SUCCESSFUL!');

  // Cast vote 3
  await db.exec(`
    SELECT set_config('app.current_organization_id', '${orgId}', true);
    SELECT set_config('app.current_user_id', '${voter3Id}', true);
    SELECT cast_vote_transactional(
      '${orgId}'::uuid, '${wsId}'::uuid, '${authBodyId}'::uuid, '${docId}'::uuid, '${verId}'::uuid, '${subId}'::uuid, '${voter3Id}'::uuid, 'APPROVE'
    );
  `);
  console.log('CAST VOTE 3 SUCCESSFUL!');

  // Approve decision
  await db.exec(`
    SELECT set_config('app.current_organization_id', '${orgId}', true);
    SELECT set_config('app.current_user_id', '${voter1Id}', true);
    SELECT approve_decision_transactional(
      '${orgId}'::uuid, '${wsId}'::uuid, '${authBodyId}'::uuid, '${docId}'::uuid, '${verId}'::uuid, '${subId}'::uuid, '${voter1Id}'::uuid, 'Final Decision Title', 'Evidence summary'
    );
  `);
  console.log('DECISION APPROVED SUCCESSFULLY!');

  const docCheck = await db.query(`SELECT status FROM documents WHERE id = '${docId}';`);
  console.log('FINAL DOC STATUS:', docCheck.rows[0].status);

  // Rollback DDL down
  const downDdl = fs.readFileSync('db/migrations/0001_initial_schema_down.sql', 'utf8');
  await db.exec(downDdl);
  console.log('ROLLBACK SCHEMA DOWN SUCCESSFUL!');
}

testSchema().catch(err => console.error('TEST SCHEMA ERROR:', err));
