export type OrgRole = 'owner' | 'admin' | 'partner' | 'associate' | 'paralegal' | 'viewer';

export type MatterStatus = 'active' | 'archived' | 'closed';

export type DocumentStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'error';

export interface Citation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  excerpt: string;
  relevanceScore: number;
  sourceType: 'direct_evidence' | 'ai_extraction' | 'ai_inference';
}
