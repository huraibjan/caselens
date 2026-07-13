# CaseLens AI Risk Management Guidelines

## 1. Grounding Principles
CaseLens must strictly act as an information synthesis tool. It does not provide legal advice. All outputs must contain:
1. Clear disclaimers stating that the generated answer is an AI-generated hypothesis.
2. Verified page-level citations pointing directly to uploaded documents.

## 2. Mitigation of Hallucinations
* **Strict Context Window Isolation**: The LLM must not incorporate pre-trained external facts if they contradict context documents.
* **Citation Matching Constraint**: Any statement in the response must correspond to an actual retrieved document chunk.
* **Abstention Fallback**: When no relevant content matches the user query, the system must yield: *"I could not find sufficient evidence in the available documents to answer this question."*

## 3. Review Protocols
* **Human-in-the-Loop Validation**: All generated assistant responses default to `requires_human_review = True`.
* **Explicit Approval Action**: Lawyers can approve, reject, or revise generated text before utilizing it inside case briefs or briefs.
* **telemetry Logs**: Every model run records parameters including input/output checksums, token consumption, confidence level, and review status.
