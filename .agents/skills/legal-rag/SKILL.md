---
name: legal-rag
description: Retrieval-Augmented Generation pipeline with citation verification, evidence grounding, and legal safety rules.
---

# Legal RAG Skill

## Retrieval Pipeline
1. Permission verification (user → matter → documents)
2. Query understanding and expansion
3. Hybrid search: full-text (ts_vector) + vector (pgvector cosine)
4. Result merging and deduplication
5. Reranking (TF-IDF mock, production: cross-encoder)
6. Top-K selection with parent context (surrounding pages)
7. Evidence context construction with source metadata

## Answer Generation
1. Construct prompt with evidence context and safety rules
2. Generate structured answer via AI gateway
3. Citation verification: every claim maps to source chunk
4. Strip unsupported claims
5. Apply abstention rules (insufficient evidence → explicit refusal)
6. Return structured response with confidence and citations

## Citation Format
```json
{
  "document_id": "uuid",
  "document_name": "contract.pdf",
  "page_number": 14,
  "chunk_id": "uuid",
  "excerpt": "relevant passage...",
  "relevance_score": 0.92,
  "source_type": "DIRECT_EVIDENCE"
}
```

## Legal Safety Rules
- Never present AI output as legal advice
- All answers marked as requiring human review
- Unsupported claims are stripped, not hallucinated
- When evidence is insufficient, the system abstains
