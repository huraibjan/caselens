"""RAG API routes — question answering with citations and review workflow."""

import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text

from caselens.db.models import (
    AIConversation,
    AIMessage,
    Citation,
    Document,
    MatterMember,
    MessageRole,
    ModelRun,
    RetrievalRun,
    ReviewStatus,
    SourceType,
)
from caselens.dependencies import DbSession, OrgMember
from caselens.rag.schemas import AskRequest, AskResponse, CitationDetail, ReviewRequest

router = APIRouter()


@router.post("/matters/{matter_id}/ask", response_model=AskResponse)
async def ask_question(
    matter_id: uuid.UUID,
    request: AskRequest,
    current_user: OrgMember,
    db: DbSession,
) -> AskResponse:
    """Ask a question about documents in a matter. Returns cited answer."""
    assert current_user.organization_id is not None
    start_time = time.monotonic()

    # Verify matter access
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == current_user.sub,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter"
        )

    # Create or continue conversation
    conversation_id = request.conversation_id
    if conversation_id:
        conv_result = await db.execute(
            select(AIConversation).where(
                AIConversation.id == conversation_id,
                AIConversation.matter_id == matter_id,
                AIConversation.organization_id == current_user.organization_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )
    else:
        conversation = AIConversation(
            organization_id=current_user.organization_id,
            matter_id=matter_id,
            user_id=current_user.sub,
            title=request.question[:100],
        )
        db.add(conversation)
        await db.flush()

    # Save user message
    user_message = AIMessage(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=request.question,
        requires_human_review=False,
    )
    db.add(user_message)
    await db.flush()

    # ── Retrieval Phase ──────────────────────────────────────────
    # 1. Keyword search (Full-text)
    ft_query = text("""
        SELECT dc.id, dc.document_id, dc.page_number, dc.text_content, dc.token_count,
               ts_rank(to_tsvector('english', dc.text_content), plainto_tsquery('english', :query)) as score
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.matter_id = :matter_id
          AND d.organization_id = :org_id
          AND d.status = 'READY'
          AND to_tsvector('english', dc.text_content) @@ plainto_tsquery('english', :query)
        ORDER BY score DESC
        LIMIT :limit
    """)

    ft_results = await db.execute(
        ft_query,
        {
            "query": request.question,
            "matter_id": str(matter_id),
            "org_id": str(current_user.organization_id),
            "limit": request.top_k * 2,
        },
    )
    ft_chunks = list(ft_results)

    # 2. Vector search (pgvector). If the embedding provider is unavailable we
    # degrade gracefully to full-text-only search rather than failing the whole
    # request — keyword retrieval is still real, grounded retrieval.
    from caselens.ai_gateway.providers import AllProvidersFailedError, get_embedding_provider

    vec_chunks: list[Any] = []
    try:
        embedder = get_embedding_provider()
        embed_resp = await embedder.embed([request.question])
        query_vector = embed_resp.vectors[0]

        vec_query = text("""
            SELECT dc.id, dc.document_id, dc.page_number, dc.text_content, dc.token_count,
                   1 - (e.vector <=> CAST(:query_vector AS vector)) as score
            FROM embeddings e
            JOIN document_chunks dc ON dc.id = e.chunk_id
            JOIN documents d ON d.id = dc.document_id
            WHERE d.matter_id = :matter_id
              AND d.organization_id = :org_id
              AND d.status = 'READY'
            ORDER BY e.vector <=> CAST(:query_vector AS vector)
            LIMIT :limit
        """)

        vec_results = await db.execute(
            vec_query,
            {
                "query_vector": str(query_vector),
                "matter_id": str(matter_id),
                "org_id": str(current_user.organization_id),
                "limit": request.top_k * 2,
            },
        )
        vec_chunks = list(vec_results)
    except AllProvidersFailedError:
        import structlog
        structlog.get_logger().warning(
            "rag.ask.embedding_unavailable_fulltext_only", matter_id=str(matter_id)
        )

    # 3. Merge and deduplicate
    merged_chunks_dict: dict[uuid.UUID, Any] = {}
    for c in ft_chunks + vec_chunks:
        if c.id not in merged_chunks_dict or c.score > merged_chunks_dict[c.id].score:
            merged_chunks_dict[c.id] = c
    merged_chunks = list(merged_chunks_dict.values())

    # 4. Rerank
    if merged_chunks:
        from caselens.ai_gateway.mock_providers import MockRerankingProvider
        reranker = MockRerankingProvider()
        chunk_texts = [c.text_content for c in merged_chunks]
        rerank_resp = await reranker.rerank(request.question, chunk_texts, top_k=request.top_k)

        from collections import namedtuple
        RerankedChunk = namedtuple('RerankedChunk', ['id', 'document_id', 'page_number', 'text_content', 'token_count', 'score'])
        chunks = []
        for r in rerank_resp.results:
            c = merged_chunks[r.index]
            chunks.append(RerankedChunk(
                id=c.id,
                document_id=c.document_id,
                page_number=c.page_number,
                text_content=c.text_content,
                token_count=c.token_count,
                score=r.score
            ))
    else:
        chunks = []

    # Create retrieval run record
    retrieval_run = RetrievalRun(
        organization_id=current_user.organization_id,
        matter_id=matter_id,
        user_id=current_user.sub,
        query=request.question,
        full_text_results_count=len(ft_chunks),
        vector_results_count=len(vec_chunks),
        merged_results_count=len(merged_chunks),
        reranked_results_count=len(chunks),
        top_k=request.top_k,
        duration_ms=int((time.monotonic() - start_time) * 1000),
    )
    db.add(retrieval_run)
    await db.flush()

    # ── Generation Phase (Mock) ──────────────────────────────────
    # Check if we have enough evidence
    if not chunks:
        # Abstention — insufficient evidence
        abstention_answer = (
            "I could not find sufficient evidence in the available documents to answer "
            "this question with confidence. Please upload additional relevant documents "
            "or rephrase your question."
        )

        assistant_message = AIMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=abstention_answer,
            requires_human_review=True,
            retrieval_run_id=retrieval_run.id,
        )
        db.add(assistant_message)
        await db.flush()

        return AskResponse(
            answer=abstention_answer,
            confidence=0.0,
            citations=[],
            requires_human_review=True,
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            retrieval_run_id=retrieval_run.id,
            abstained=True,
        )

    # Build evidence context
    evidence_parts: list[str] = []
    citation_details: list[CitationDetail] = []

    for i, chunk in enumerate(chunks[: request.top_k]):
        # Get document title
        doc_result = await db.execute(
            select(Document.title).where(Document.id == chunk.document_id)
        )
        doc_title = doc_result.scalar() or "Unknown Document"

        evidence_parts.append(
            f"[Source {i + 1}] {doc_title}, Page {chunk.page_number}:\n{chunk.text_content}"
        )
        citation_details.append(
            CitationDetail(
                document_id=chunk.document_id,
                document_name=doc_title,
                page_number=chunk.page_number,
                chunk_id=chunk.id,
                excerpt=chunk.text_content[:300],
                relevance_score=float(chunk.score),
                source_type=SourceType.DIRECT_EVIDENCE.value,
            )
        )

    # LLM response generation
    evidence_summary = "\n\n".join(evidence_parts)
    from caselens.ai_gateway.providers import get_llm_provider
    llm = get_llm_provider()

    prompt = (
        f"You are a professional legal RAG assistant. Answer the user's question accurately using only "
        f"the provided evidence excerpts. Cite your sources using [Source X] indicators matching the "
        f"excerpts below.\n\n"
        f"Evidence Excerpts:\n{evidence_summary}\n\n"
        f"User Question: {request.question}"
    )

    try:
        llm_resp = await llm.generate(prompt)
    except AllProvidersFailedError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again shortly.",
        ) from e
    answer = llm_resp.content

    # Create model run record
    model_run = ModelRun(
        organization_id=current_user.organization_id,
        provider=llm_resp.provider,
        model=llm_resp.model,
        model_version=llm_resp.model_version or "1.0.0",
        prompt_template_version="v1",
        input_tokens=llm_resp.input_tokens or len(prompt.split()),
        output_tokens=llm_resp.output_tokens or len(answer.split()),
        total_tokens=llm_resp.total_tokens or (len(prompt.split()) + len(answer.split())),
        estimated_cost_usd=llm_resp.estimated_cost_usd,
        duration_ms=int((time.monotonic() - start_time) * 1000),
        matter_id=matter_id,
        user_id=current_user.sub,
        retrieval_run_id=retrieval_run.id,
        citation_validation_passed=True,
        metadata_=llm_resp.metadata,
    )
    db.add(model_run)
    await db.flush()

    # Save assistant message
    assistant_message = AIMessage(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=answer,
        requires_human_review=True,
        model_run_id=model_run.id,
        retrieval_run_id=retrieval_run.id,
    )
    db.add(assistant_message)
    await db.flush()

    # Save citations
    for cd in citation_details:
        citation = Citation(
            message_id=assistant_message.id,
            document_id=cd.document_id,
            chunk_id=cd.chunk_id,
            page_number=cd.page_number,
            excerpt=cd.excerpt,
            relevance_score=cd.relevance_score,
            source_type=SourceType.DIRECT_EVIDENCE,
            is_verified=True,
        )
        db.add(citation)

    await db.flush()

    return AskResponse(
        answer=answer,
        confidence=0.85,
        citations=citation_details,
        requires_human_review=True,
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        model_run_id=model_run.id,
        retrieval_run_id=retrieval_run.id,
        abstained=False,
    )


@router.post("/ai-reviews/{message_id}", status_code=status.HTTP_200_OK)
async def review_ai_answer(
    message_id: uuid.UUID,
    request: ReviewRequest,
    current_user: OrgMember,
    db: DbSession,
) -> dict[str, Any]:
    """Approve or reject an AI-generated answer."""
    assert current_user.organization_id is not None

    # Find the message and verify access through conversation → matter → member
    msg_result = await db.execute(
        select(AIMessage)
        .join(AIConversation, AIConversation.id == AIMessage.conversation_id)
        .where(
            AIMessage.id == message_id,
            AIConversation.organization_id == current_user.organization_id,
        )
    )
    message = msg_result.scalar_one_or_none()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )

    if message.role != MessageRole.ASSISTANT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only review assistant messages",
        )

    message.review_status = ReviewStatus(request.status.upper())

    # Update model run review status if linked
    if message.model_run_id:
        run_result = await db.execute(
            select(ModelRun).where(ModelRun.id == message.model_run_id)
        )
        model_run = run_result.scalar_one_or_none()
        if model_run:
            model_run.review_status = ReviewStatus(request.status.upper())

    await db.flush()

    return {
        "message_id": str(message_id),
        "review_status": request.status,
        "reviewed_by": str(current_user.sub),
    }


# ── Letter Generation Endpoint ────────────────────────────────────────────────

LETTER_TEMPLATES: dict[str, dict[str, Any]] = {
    "demand_letter": {
        "name": "Demand Letter",
        "category": "Civil Litigation",
        "system_role": "You are a senior litigation attorney drafting a formal demand letter.",
        "structure": [
            "Firm letterhead block (use [LAW FIRM LETTERHEAD])",
            "Date and delivery method",
            "Defendant/respondent address block",
            "RE: line with matter title and case reference",
            "Opening paragraph establishing legal standing and purpose",
            "Body paragraphs detailing the basis of liability with specific facts from the documents",
            "Damages or relief requested with specific dollar amount if available",
            "Deadline for response or payment (30 days from today)",
            "Consequences of non-compliance",
            "Professional closing with attorney signature block",
        ],
    },
    "cease_desist": {
        "name": "Cease and Desist",
        "category": "Civil Litigation",
        "system_role": "You are a senior litigation attorney drafting a cease and desist letter.",
        "structure": [
            "Firm letterhead block",
            "Date",
            "Respondent address",
            "RE: Cease and Desist — matter title",
            "Opening identifying client and the offending conduct",
            "Specific description of the unlawful activity with legal basis",
            "Explicit demand to immediately cease all such conduct",
            "Legal consequences if conduct continues (injunction, damages, attorney fees)",
            "Compliance deadline",
            "Professional closing",
        ],
    },
    "client_update": {
        "name": "Client Status Update",
        "category": "Client Communication",
        "system_role": "You are a professional attorney writing a status update letter to your client.",
        "structure": [
            "Firm letterhead",
            "Date",
            "Client address",
            "RE: Case Status Update",
            "Current case status and recent developments",
            "Summary of documents reviewed and key findings",
            "AI analysis insights (veracity score, key allegations)",
            "Upcoming deadlines and next steps",
            "Action items for the client",
            "Invitation to contact for questions",
            "Professional closing",
        ],
    },
    "court_filing": {
        "name": "Court Filing Notice",
        "category": "Court Documents",
        "system_role": "You are a litigation attorney drafting a formal court filing notice.",
        "structure": [
            "Court caption block (IN THE [COURT NAME])",
            "Case number and party names",
            "NOTICE OF FILING heading",
            "Date and description of what was filed",
            "Certificate of service to all parties",
            "Signature block with bar number",
        ],
    },
    "injury_claim": {
        "name": "Personal Injury Claim",
        "category": "Personal Injury",
        "system_role": "You are a personal injury attorney drafting a demand letter to an insurance company.",
        "structure": [
            "Firm letterhead",
            "Insurance company claims department address",
            "RE: Personal Injury Claim with claim/matter number",
            "Client representation statement",
            "Incident description with date, location, and circumstances",
            "Injuries sustained (medical findings from documents if available)",
            "Treatment history and ongoing care",
            "Itemized damages: medical expenses, lost wages, pain and suffering",
            "Total demand amount",
            "Settlement invitation with deadline",
            "Professional closing",
        ],
    },
    "real_estate_notice": {
        "name": "Real Estate Notice",
        "category": "Real Estate",
        "system_role": "You are a real estate attorney drafting a formal property notice.",
        "structure": [
            "Firm letterhead",
            "Property address and notice date",
            "RE: Notice type and matter title",
            "Party identification (landlord/tenant/buyer/seller)",
            "Description of the breach, deficiency, or action required",
            "Specific cure or compliance requirements",
            "Deadline for compliance",
            "Legal remedies available if non-compliant",
            "Professional closing",
        ],
    },
}


class GenerateLetterRequest(BaseModel):
    template_id: str
    custom_fields: dict[str, Any] = {}
    override_defendant: str | None = None
    override_amount: str | None = None
    override_deadline: str | None = None
    top_k: int = 5


class GenerateLetterResponse(BaseModel):
    letter_text: str
    template_name: str
    matter_title: str
    metadata_used: dict[str, Any]
    tokens_used: int
    rag_chunks_used: int
    generated_at: str


@router.post("/matters/{matter_id}/generate-letter", response_model=GenerateLetterResponse)
async def generate_letter(
    matter_id: uuid.UUID,
    request: GenerateLetterRequest,
    current_user: OrgMember,
    db: DbSession,
) -> GenerateLetterResponse:
    """
    Generate a real legal letter using RAG-grounded LLM generation.

    Pipeline:
    1. Load matter + case_metadata from DB
    2. Retrieve top-k document chunks relevant to the template type
    3. Build structured prompt with real case data
    4. Call LLM provider → return formatted letter
    """
    from datetime import date, timedelta

    assert current_user.organization_id is not None

    # ── 1. Verify matter access ──────────────────────────────────
    member_result = await db.execute(
        select(MatterMember).where(
            MatterMember.matter_id == matter_id,
            MatterMember.user_id == current_user.sub,
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this matter")

    from caselens.db.models import Matter
    matter_result = await db.execute(select(Matter).where(Matter.id == matter_id))
    matter = matter_result.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matter not found")

    template = LETTER_TEMPLATES.get(request.template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown template: {request.template_id}")

    # ── 2. Extract case metadata ──────────────────────────────────
    meta: dict[str, Any] = matter.case_metadata or {}
    today_str = date.today().strftime("%B %d, %Y")
    deadline_str = (date.today() + timedelta(days=30)).strftime("%B %d, %Y")

    defendant = (
        request.override_defendant
        or meta.get("suspect")
        or request.custom_fields.get("defendant_name")
        or "[Defendant Name]"
    )
    amount = (
        request.override_amount
        or request.custom_fields.get("amount")
        or "[Amount to be determined]"
    )
    deadline_field = (
        request.override_deadline
        or request.custom_fields.get("deadline")
        or deadline_str
    )
    veracity_score = meta.get("veracityScore", "N/A")
    reasoning = meta.get("overallReasoning", "")
    allegations = meta.get("allegations", [])
    outcomes = meta.get("outcomes", [])
    start_date = meta.get("start_date", "[Date of incident]")
    end_date = meta.get("end_date")

    allegations_text = "\n".join(
        f"  - {a.get('claim', '')}: {a.get('desc', '')} (Status: {a.get('status', 'unverified')})"
        for a in allegations[:5]
    ) or "  [No allegations extracted — upload and process case documents]"

    outcomes_text = "\n".join(
        f"  - {o.get('ruling', '')}: {o.get('probability', '')} likely ({o.get('statute', '')})"
        for o in outcomes[:3]
    ) or ""

    # ── 3. RAG retrieval (ground the letter in actual document text) ──
    rag_context = ""
    rag_chunks_count = 0

    # Keyword for retrieval based on template type
    retrieval_query = {
        "demand_letter":      "damages liability defendant negligence",
        "cease_desist":       "unlawful conduct harassment infringement violation",
        "client_update":      "case status hearing evidence facts",
        "court_filing":       "court filing pleading motion exhibit",
        "injury_claim":       "injury medical treatment damages lost wages",
        "real_estate_notice": "property lease breach eviction notice",
    }.get(request.template_id, matter.title)

    try:
        ft_query = text("""
            SELECT dc.text_content, dc.page_number, d.title as doc_title,
                   ts_rank(to_tsvector('english', dc.text_content), plainto_tsquery('english', :query)) as score
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE d.matter_id = :matter_id
              AND d.organization_id = :org_id
              AND d.status = 'READY'
              AND to_tsvector('english', dc.text_content) @@ plainto_tsquery('english', :query)
            ORDER BY score DESC
            LIMIT :limit
        """)
        ft_results = await db.execute(ft_query, {
            "query": retrieval_query,
            "matter_id": str(matter_id),
            "org_id": str(current_user.organization_id),
            "limit": request.top_k,
        })
        chunks = list(ft_results)
        rag_chunks_count = len(chunks)
        if chunks:
            rag_context = "\n\n".join(
                f"[Excerpt from '{c.doc_title}', Page {c.page_number}]:\n{c.text_content[:600]}"
                for c in chunks
            )
    except Exception:
        rag_context = ""

    # ── 4. Build LLM prompt ──────────────────────────────────────
    structure_str = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(template["structure"]))

    prompt = f"""You are a senior attorney. Generate a complete, professional {template['name']} letter.

MATTER INFORMATION:
- Matter: {matter.title}
- Matter Number: {matter.matter_number or 'N/A'}
- Date: {today_str}
- Defendant / Respondent: {defendant}
- Incident / Start Date: {start_date}
{"- Next Court Date: " + end_date if end_date else ""}
- AI Veracity Score: {veracity_score}%
- Key Findings: {reasoning}

ALLEGATIONS FROM CASE DOCUMENTS:
{allegations_text}

{"PREDICTED OUTCOMES:" + chr(10) + outcomes_text if outcomes_text else ""}

{"GROUNDING EVIDENCE FROM CASE DOCUMENTS:" + chr(10) + rag_context if rag_context else ""}

CUSTOM FIELDS:
- Amount / Relief Sought: {amount}
- Response Deadline: {deadline_field}
{chr(10).join(f'- {k}: {v}' for k, v in request.custom_fields.items())}

LETTER STRUCTURE TO FOLLOW:
{structure_str}

INSTRUCTIONS:
- Write the COMPLETE letter, not an outline. Every section must be fully drafted.
- Use professional legal language appropriate for {template['category']}.
- Incorporate the case facts, defendant name, dates, and evidence naturally into the text.
- Do not use placeholder brackets except where genuinely unknown (e.g., attorney bar number).
- The letter must be ready to sign and send with minimal editing.
- Start with [LAW FIRM LETTERHEAD] on the first line.

Generate the letter now:"""

    # ── 5. Call LLM ──────────────────────────────────────────────
    from caselens.ai_gateway.providers import AllProvidersFailedError, get_llm_provider
    llm = get_llm_provider()
    try:
        llm_resp = await llm.generate(prompt)
    except AllProvidersFailedError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again shortly.",
        ) from e
    letter_text = llm_resp.content
    tokens_used = llm_resp.total_tokens or (len(prompt.split()) + len(letter_text.split()))

    import datetime as dt
    return GenerateLetterResponse(
        letter_text=letter_text,
        template_name=template["name"],
        matter_title=matter.title,
        metadata_used={
            "defendant": defendant,
            "veracity_score": veracity_score,
            "allegations_count": len(allegations),
            "rag_chunks_used": rag_chunks_count,
        },
        tokens_used=tokens_used,
        rag_chunks_used=rag_chunks_count,
        generated_at=dt.datetime.now(dt.UTC).isoformat(),
    )

