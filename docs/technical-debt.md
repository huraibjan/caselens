# CaseLens Technical Debt Registry

This registry tracks tasks deferred during Phase 1 development to be resolved in Phase 2+.

1. **Redis Token Blacklisting**: Currently JWT revocation is handled client-side by discarding tokens. Phase 2 must black-list tokens in Redis on user logout.
2. **OCR Integration**: Current workflow utilizes PyMuPDF extraction with fallback stubs. Real OCR using Tesseract or Google Document AI is deferred.
3. **External AI Provider Approval Logic**: Real providers (OpenAI/Anthropic/Gemini) are stubbed out with mock providers. Transitioning to real providers requires configuration checkpoints.
4. **Cross-Tenant Vector Index Partitioning**: Phase 1 vector storage does not partition indices by tenant organization. HNSW partition indexing should be structured in Phase 2.
5. **Real-time SSE Streaming**: The API ask endpoint returns direct JSON objects instead of Server-Sent Events (SSE).
