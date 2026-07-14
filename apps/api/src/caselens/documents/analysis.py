"""Shared AI case-analysis schemas, prompts, and orchestration.

Single source of truth used by BOTH the inline pipeline
(caselens/documents/pipeline.py) and the Temporal worker
(caselens_worker/activities/indexing.py), so the two paths can never drift.

Two structured extractions run per document:
  1. Core intelligence  — veracity, allegations, contradictions, outcomes
  2. Deep analysis      — parties & roles, area of law, facts check,
                          issues + governing procedure, event timeline,
                          citations found + AI-suggested authorities

Legal reasoning targets Pakistani law (CPC 1908, CrPC 1898,
Qanun-e-Shahadat 1984, Constitution 1973) unless the document clearly
belongs to another jurisdiction, in which case the model is instructed
to follow the document's own jurisdiction.
"""

from typing import Any

import structlog

from caselens.ai_gateway.json_utils import parse_json_loose
from caselens.ai_gateway.providers import LLMProvider

logger = structlog.get_logger()

# Characters of document text fed to each call. Free-tier models in the
# analysis chain all have ≥128k context; these stay conservative.
INTEL_TEXT_LIMIT = 12000
DEEP_TEXT_LIMIT = 20000

# Version marker written into metadata so the UI knows deep fields exist.
ANALYSIS_VERSION = 2

# Fixed vocabulary for party roles (subcontinent civil/criminal procedure).
PARTY_ROLES = (
    "Petitioner, Applicant, Plaintiff, Appellant, Complainant, Objector, "
    "Decree Holder, Defendant, Respondent, Opponent, Accused, Judgment Debtor, "
    "Witness, Counsel, Judge, Other"
)

# ── Schemas (Gemini-style OpenAPI subset; serialized into the prompt for
#    OpenAI-compatible providers) ─────────────────────────────────────────

CASE_INTELLIGENCE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "suspect": {"type": "STRING"},
        "start_date": {"type": "STRING"},
        "end_date": {"type": "STRING"},
        "veracityScore": {"type": "INTEGER"},
        "overallReasoning": {"type": "STRING"},
        "allegations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "claim": {"type": "STRING"},
                    "source": {"type": "STRING"},
                    "status": {"type": "STRING"},
                    "desc": {"type": "STRING"},
                },
            },
        },
        "contradictions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {"text": {"type": "STRING"}, "severity": {"type": "STRING"}},
            },
        },
        "outcomes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "ruling": {"type": "STRING"},
                    "probability": {"type": "STRING"},
                    "statute": {"type": "STRING"},
                    "details": {"type": "STRING"},
                },
            },
        },
    },
    "required": ["suspect", "veracityScore", "overallReasoning"],
}

DEEP_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "parties": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "role": {"type": "STRING"},
                    "side": {"type": "STRING"},
                    "description": {"type": "STRING"},
                },
            },
        },
        "area_of_law": {
            "type": "OBJECT",
            "properties": {
                "primary": {"type": "STRING"},
                "sub_areas": {"type": "ARRAY", "items": {"type": "STRING"}},
                "governing_statutes": {"type": "ARRAY", "items": {"type": "STRING"}},
                "procedural_framework": {"type": "STRING"},
                "jurisdiction": {"type": "STRING"},
                "reasoning": {"type": "STRING"},
            },
        },
        "facts": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "fact": {"type": "STRING"},
                    "source": {"type": "STRING"},
                    "status": {"type": "STRING"},
                    "note": {"type": "STRING"},
                },
            },
        },
        "issues": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "issue": {"type": "STRING"},
                    "category": {"type": "STRING"},
                    "procedure": {"type": "STRING"},
                    "statutory_basis": {"type": "STRING"},
                    "stage": {"type": "STRING"},
                    "recommended_action": {"type": "STRING"},
                },
            },
        },
        "timeline": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "date": {"type": "STRING"},
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "actors": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "period_note": {"type": "STRING"},
                    "significance": {"type": "STRING"},
                },
            },
        },
        "citations_in_document": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "citation": {"type": "STRING"},
                    "court": {"type": "STRING"},
                    "principle": {"type": "STRING"},
                    "context": {"type": "STRING"},
                },
            },
        },
        "suggested_authorities": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "citation": {"type": "STRING"},
                    "court": {"type": "STRING"},
                    "principle": {"type": "STRING"},
                    "relevance": {"type": "STRING"},
                },
            },
        },
    },
    "required": ["parties", "area_of_law", "issues"],
}

FALLBACK_METADATA: dict[str, Any] = {
    "suspect": "Unknown Defendant",
    "start_date": "",
    "end_date": "N/A",
    "veracityScore": 75,
    "overallReasoning": "Analysis generated based on document title.",
    "allegations": [],
    "contradictions": [],
    "outcomes": [],
}

# ── Prompts ──────────────────────────────────────────────────────────────

LEGAL_SYSTEM_PROMPT = (
    "You are a senior legal analyst. Default jurisdiction is PAKISTAN: reason "
    "under the Code of Civil Procedure 1908, Code of Criminal Procedure 1898, "
    "Qanun-e-Shahadat Order 1984, the Constitution of Pakistan 1973, and other "
    "applicable Pakistani statutes, citing Pakistani reporters (PLD, SCMR, CLC, "
    "MLD, YLR) where relevant. If the document clearly belongs to another "
    "jurisdiction (foreign court names, foreign statutes), analyse it under "
    "that jurisdiction instead and say so. Be precise and never invent facts "
    "that are not supported by the document."
)


def build_summary_prompt(title: str, text: str) -> str:
    return (
        "You are a professional legal RAG assistant. Read the following legal "
        "document content and write a highly detailed, production-ready legal "
        "intelligence summary. Analyze the key facts, the legal issues, the "
        "parties, and the holding/conclusions. Be thorough and professional.\n\n"
        f"Document Title: {title}\n\nDocument Text:\n{text[:INTEL_TEXT_LIMIT]}"
    )


def build_intel_prompt(text: str) -> str:
    return (
        "You are an expert legal AI systems engineer analyzing a case document. "
        "Extract the key case details, allegations, contradictions, and predicted "
        "outcomes based on the document text. Return a JSON object with keys: "
        "suspect, start_date, end_date, veracityScore (0-100 integer), "
        "overallReasoning, allegations[], contradictions[], outcomes[].\n\n"
        f"Document Content Excerpts:\n{text[:INTEL_TEXT_LIMIT]}"
    )


def build_deep_prompt(title: str, text: str) -> str:
    return (
        "Perform a deep structured legal analysis of this case document and "
        "return ONLY a JSON object with these keys:\n\n"
        "1. parties[] — every party involved. For each: name (as written), role "
        f"(exactly one of: {PARTY_ROLES}), side ('claimant', 'respondent', or "
        "'neutral'), and a one-line description. Identify the correct legal role "
        "even when the document does not label it (e.g. the person seeking "
        "execution of a decree is the Decree Holder; the person against whom it "
        "is executed is the Judgment Debtor).\n"
        "2. area_of_law — primary (e.g. Civil, Criminal, Constitutional, Family, "
        "Revenue, Company, Labour), sub_areas[], governing_statutes[] (exact "
        "statute names with year), procedural_framework (the procedural code the "
        "matter travels under, e.g. 'Code of Civil Procedure 1908' or 'Code of "
        "Criminal Procedure 1898'), jurisdiction (court/forum), and a short "
        "reasoning for the classification.\n"
        "3. facts[] — the material facts. For each: fact, source (page or "
        "paragraph reference from the document), status ('supported', "
        "'disputed', or 'unverified' based on the document), and note.\n"
        "4. issues[] — every legal issue raised or apparent. For each: issue, "
        "category, procedure (the EXACT procedural route under which the issue "
        "is dealt — order/rule/section — even when the document itself does not "
        "mention it; derive it from the governing procedural law), "
        "statutory_basis, stage (where the issue currently stands), and "
        "recommended_action.\n"
        "5. timeline[] — EVERY dated or dateable event in chronological order. "
        "For each: date (ISO if possible, else as written), title, description "
        "(what exactly happened, who did it, in what role), actors[], "
        "period_note (what happened in the interval AFTER this event until the "
        "next event), and significance.\n"
        "6. citations_in_document[] — every case-law citation actually written "
        "in the document, with court, the principle it was cited for, and the "
        "context in which it appears.\n"
        "7. suggested_authorities[] — up to 6 REAL, well-known reported "
        "judgments relevant to the issues (prefer Pakistani reporters: PLD, "
        "SCMR, CLC, MLD). Only include judgments you are highly confident "
        "actually exist; these will be labelled as AI-suggested and must be "
        "independently verified.\n\n"
        f"Document Title: {title}\n\n"
        f"Document Content:\n{text[:DEEP_TEXT_LIMIT]}"
    )


# ── Orchestration ────────────────────────────────────────────────────────


async def run_case_analysis(
    llm: LLMProvider, title: str, text: str
) -> tuple[str, dict[str, Any]]:
    """Run the full 3-call analysis. Returns (summary, metadata_dict).

    Raises AllProvidersFailedError (from the provider chain) if no AI provider
    is available — callers mark the document ERROR. A parse failure on an
    individual call degrades gracefully: core-intel falls back to
    FALLBACK_METADATA, deep-analysis fields are simply omitted.
    """
    if not text.strip():
        summary_resp = await llm.generate(
            f"Please write a short legal summary for document titled: {title}"
        )
        return summary_resp.content, dict(FALLBACK_METADATA)

    # 1. Narrative summary
    summary_resp = await llm.generate(
        build_summary_prompt(title, text), system_prompt=LEGAL_SYSTEM_PROMPT
    )

    # 2. Core intelligence
    intel_resp = await llm.generate_structured(
        build_intel_prompt(text),
        schema=CASE_INTELLIGENCE_SCHEMA,
        system_prompt=LEGAL_SYSTEM_PROMPT,
    )
    metadata = parse_json_loose(intel_resp.content)
    if metadata is None:
        logger.error("analysis.intel_parse_failed", provider=intel_resp.provider)
        metadata = dict(FALLBACK_METADATA)

    # 3. Deep analysis (parties, area of law, facts, issues, timeline, citations)
    deep_resp = await llm.generate_structured(
        build_deep_prompt(title, text),
        schema=DEEP_ANALYSIS_SCHEMA,
        system_prompt=LEGAL_SYSTEM_PROMPT,
    )
    deep = parse_json_loose(deep_resp.content)
    if deep is None:
        logger.error("analysis.deep_parse_failed", provider=deep_resp.provider)
        deep = {}

    metadata.update(deep)
    metadata["analysis_version"] = ANALYSIS_VERSION
    return summary_resp.content, metadata
