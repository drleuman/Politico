import { evaluateAuthorizationContract, type ResolvedAuthorizationContext, type ResourceContext } from '../auth/authorization.js';

export interface CatalogDocument extends ResourceContext {
  title: string;
  createdAt: string;
}

/** Use the canonical server contract; an organization ADMIN role never substitutes for workspace membership. */
export function visibleDocuments(context: ResolvedAuthorizationContext, documents: CatalogDocument[]) {
  return documents.filter(document => evaluateAuthorizationContract(context, document, { action: 'READ' }).allowed)
    .map(document => ({
      id: document.resourceId,
      workspaceId: document.workspaceId,
      title: document.title,
      classification: document.classification,
      status: document.resourceState,
      createdAt: document.createdAt,
    }));
}
