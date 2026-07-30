from app.services.vector_store import vector_store

def retrieve_context_tool(query: str) -> str:
    """
    Tool này sử dụng Qdrant Hybrid Search (Dense + Sparse) để tìm kiếm
    ngữ cảnh từ tài liệu VLearn liên quan đến câu hỏi.
    """
    results = vector_store.search_hybrid(query, limit=3)
    if not results:
        return "Không tìm thấy ngữ cảnh nào liên quan trong tài liệu."
    return "\n\n---\n\n".join(results)
