from app.services.vector_store import vector_store

def retrieve_context_tool(query: str) -> str:
    """
    Tool này sử dụng Qdrant Hybrid Search (Dense + Sparse) để tìm kiếm
    ngữ cảnh phân loại từ Slide (tóm tắt) và Transcript (lời giảng chi tiết)
    theo tỷ lệ phù hợp (Top-2 Slide + Top-4 Transcripts).
    """
    ctx = vector_store.search_structured_context(query, slide_limit=2, transcript_limit=4)
    slides = ctx.get("slides", [])
    transcripts = ctx.get("transcripts", [])

    if not slides and not transcripts:
        legacy_res = vector_store.search_hybrid(query, limit=4)
        if not legacy_res:
            return "Không tìm thấy ngữ cảnh nào liên quan trong tài liệu."
        return "\n\n---\n\n".join(legacy_res)

    blocks = []
    if slides:
        slide_texts = []
        for s in slides:
            source = s.get("source", "Slide")
            page = s.get("slide_page", "?")
            slide_texts.append(f"• [{source} - Page {page}]:\n{s.get('text', '')}")
        blocks.append("[Slide Context (Tóm tắt ý chính & Cấu trúc)]:\n" + "\n\n".join(slide_texts))

    if transcripts:
        transcript_texts = []
        for t in transcripts:
            tid = t.get("transcript_id", "T-REF")
            transcript_texts.append(f"• [{tid}]: {t.get('text', '')}")
        blocks.append("[Transcript Context (Lời giảng & Giải thích chi tiết từ Giảng viên)]:\n" + "\n\n".join(transcript_texts))

    return "\n\n====================\n\n".join(blocks)
