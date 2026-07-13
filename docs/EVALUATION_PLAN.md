# CaseIntelix Evaluation Plan

## 1. RAG Evaluation Metrics
We assess RAG performance against the following indicators:
* **Retrieval Recall**: Did we pull the correct page containing the key evidence?
* **Answer Faithfulness**: Is the answer derived *only* from the retrieved context?
* **Citation Precision**: Do citation text snippets accurately match the source document text?
* **Abstention Rate**: Does the model correctly refuse queries that lack context?

## 2. Test Datasets
* **Golden QA Dataset**: A list of 50 pre-drafted legal questions paired with expected source pages and key details.
* **Negative Test Dataset**: Misleading or out-of-context queries intended to test the model's abstention capabilities.
* **Format Compliance Dataset**: Verification that JSON and Server-Sent Event (SSE) formats conform to specifications.

## 3. CI/CD Release Gates
* **Retrieval Recall**: Must be greater than 90% in regression test cases.
* **Zero Hallucination Tolerance**: Citation checking tests must pass with 100% precision.
* **Schema Validation**: 100% of responses must match schemas defined in `rag/schemas.py`.
