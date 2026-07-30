from fastembed import TextEmbedding, SparseTextEmbedding

class EmbeddingService:
    def __init__(self):
        print("Initializing FastEmbed Models (Lightweight)...")
        self.dense_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        self.sparse_model = SparseTextEmbedding(model_name="prithivida/Splade_PP_en_v1")

    def embed_texts(self, texts: list[str]):
        """
        Returns a tuple of (dense_vecs, sparse_vecs)
        """
        dense_vecs = list(self.dense_model.embed(texts))
        sparse_vecs = list(self.sparse_model.embed(texts))
        return dense_vecs, sparse_vecs

embedding_service = EmbeddingService()
