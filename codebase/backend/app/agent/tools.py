from app.services.local_content import search_local_transcripts
from app.services.vector_store import vector_store


def retrieve_context_tool(query: str, file_id: str | None = None) -> str:
    """
    Retrieve learning context from Qdrant first, then fall back to local
    transcripts when the vector collection has not been ingested yet.
    """
    ctx = vector_store.search_structured_context(query, slide_limit=2, transcript_limit=4)
    slides = ctx.get("slides", [])
    transcripts = ctx.get("transcripts", [])

    if not slides and not transcripts:
        legacy_res = vector_store.search_hybrid(query, limit=4)
        if not legacy_res:
            local_res = search_local_transcripts(query, file_id=file_id, limit=4)
            if local_res:
                return "[Local Transcript Context]:\n" + "\n\n".join(local_res)
            return "Khong tim thay ngu canh nao lien quan trong tai lieu."
        return "\n\n---\n\n".join(legacy_res)

    blocks = []
    if slides:
        slide_texts = []
        for slide in slides:
            source = slide.get("source", "Slide")
            page = slide.get("slide_page", "?")
            slide_texts.append(f"- [{source} - Page {page}]:\n{slide.get('text', '')}")
        blocks.append("[Slide Context]:\n" + "\n\n".join(slide_texts))

    if transcripts:
        transcript_texts = []
        for transcript in transcripts:
            transcript_id = transcript.get("transcript_id", "T-REF")
            transcript_texts.append(f"- [{transcript_id}]: {transcript.get('text', '')}")
        blocks.append("[Transcript Context]:\n" + "\n\n".join(transcript_texts))

    return "\n\n====================\n\n".join(blocks)
