# CaseIntelix RAG and Citation Design

## 1. Retrieval Strategy
CaseIntelix uses a hybrid search approach:
* **Full-Text Keyword Search**: Powered by PostgreSQL English language `tsvector` and `ts_rank` matching.
* **Semantic Vector Search**: Powered by `pgvector` performing cosine similarity calculations on chunk embeddings.
* **Reciprocal Rank Fusion (RRF)**: Merges text and vector results to compute a final relevance score.
* **TF-IDF Reranker**: Performs fine-grained scoring on text content similarity to select the best context chunks.

## 2. Page-Aware Chunking Constraints
* Chunks are strictly bound to pages. A chunk must not span across two pages.
* Target: 512 tokens max per chunk, with 64 tokens overlap.
* Each chunk keeps exact page metadata.

## 3. Grounding and Citation Verification
To eliminate hallucinations:
* The system retrieves the top $K$ chunks.
* The LLM prompt forces the model to base its response *only* on the provided context fragments.
* The API verifies that any text segment referred to by the model is actually present in the source chunks.
* If the search finds no relevant content matching the question, the LLM must explicitly state that the evidence is insufficient (abstention), rather than generating speculative answers.

## 4. Citation Output Schema
Citations are returned as structural elements:
```json
{
  "document_id": "uuid",
  "document_name": "ACME_Contract.pdf",
  "page_number": 12,
  "chunk_id": "uuid",
  "excerpt": "Liability of either party shall not exceed one million dollars ($1,000,000)...",
  "relevance_score": 0.88,
  "source_type": "direct_evidence"
}
```
In the UI, these citations are rendered as clickable badges that highlight the corresponding page and scroll target in the PDF reader view.
