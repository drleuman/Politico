import type { FastifyInstance } from 'fastify';
import { dbPool } from '../db/client.js';
import { validateSession } from '../auth/session.js';
import { buildResolvedAuthorizationContext } from '../auth/roles.js';
import { visibleDocuments, type CatalogDocument } from './catalog.js';

/** First knowledge gate: private metadata only. No draft contents or public publication inference. */
export async function registerKnowledgeRoutes(server: FastifyInstance) {
  server.get('/api/v1/knowledge/catalog', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const token = request.cookies['__Host-sid'];
    if (!token) return reply.status(401).send({ error: 'UNAUTHENTICATED' });
    let client;
    try {
      client = await dbPool.connect();
      await client.query('BEGIN');
      const { session, user } = await validateSession(client, token);
      if (!session || !user) {
        await client.query('ROLLBACK');
        return reply.status(401).send({ error: 'UNAUTHENTICATED' });
      }
      const context = await buildResolvedAuthorizationContext(client, session.userId, session.organizationId, session.mfaVerifiedAt);
      const orgMember = context.organizationMemberships.some(m => m.organizationId === session.organizationId && m.isActive);
      if (!orgMember) {
        await client.query('ROLLBACK');
        return reply.status(403).send({ error: 'ORGANIZATION_MEMBERSHIP_REQUIRED' });
      }
      // Session validation sets transaction-local RLS; explicit organization predicates provide a second boundary.
      const ids = context.workspaceMemberships.filter(m => m.isActive && m.organizationId === session.organizationId).map(m => m.workspaceId);
      const spaces = await client.query(
        'SELECT id, name, slug FROM workspaces WHERE organization_id = $1 AND id = ANY($2::uuid[]) ORDER BY name, id',
        [session.organizationId, ids]
      );
      // A bounded first batch, not a total count. Public lifecycle handling belongs to the publication gate.
      const result = await client.query(
        `SELECT id, organization_id, workspace_id, title, classification, status, assigned_user_id,
                coauthor_user_ids, created_at
         FROM documents WHERE organization_id = $1 AND workspace_id = ANY($2::uuid[])
           AND classification <> 'PUBLICO'
         ORDER BY created_at DESC, id LIMIT 100`,
        [session.organizationId, ids]
      );
      const resources: CatalogDocument[] = result.rows.map(row => ({
        resourceId: row.id, organizationId: row.organization_id, workspaceId: row.workspace_id,
        title: row.title, classification: row.classification, resourceState: row.status,
        assignedUserId: row.assigned_user_id, coauthorUserIds: row.coauthor_user_ids,
        createdAt: new Date(row.created_at).toISOString(),
      }));
      const documents = visibleDocuments(context, resources);
      await client.query('COMMIT');
      return { organizationId: session.organizationId, workspaces: spaces.rows, documents, batchLimit: 100 };
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => {});
      request.log.error({ event: 'KNOWLEDGE_CATALOG_UNAVAILABLE' }, 'Knowledge catalog unavailable');
      return reply.status(503).send({ error: 'KNOWLEDGE_CATALOG_UNAVAILABLE' });
    } finally {
      client?.release();
    }
  });
}
