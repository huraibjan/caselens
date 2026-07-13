---
name: rag-evaluation
description: RAG quality metrics, evaluation datasets, and release gates for legal document question answering.
---

# RAG Evaluation Skill

## Metrics
- **Retrieval Recall@K**: Proportion of relevant chunks in top-K results
- **Retrieval Precision@K**: Proportion of top-K results that are relevant
- **Citation Accuracy**: Percentage of citations that correctly reference source content
- **Answer Faithfulness**: Proportion of answer claims supported by retrieved evidence
- **Abstention Rate**: Frequency of appropriate "insufficient evidence" responses
- **Hallucination Rate**: Proportion of unsupported claims (target: 0%)

## Evaluation Datasets
- Golden QA pairs with known source documents and pages
- Edge cases: ambiguous queries, cross-document questions, no-answer queries
- Adversarial inputs: prompt injection attempts, misleading questions

## Release Gates
- Citation accuracy ≥ 95%
- Hallucination rate = 0% (with mock providers)
- Abstention triggers correctly on insufficient evidence
- All golden QA pairs produce correct citations
