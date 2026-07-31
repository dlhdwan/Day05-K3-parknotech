import numpy as np
from FlagEmbedding import BGEM3FlagModel, FlagReranker


class SparseEmbeddingWrapper:
    def __init__(self, indices: list[int], values: list[float]):
        self.indices = np.array(indices, dtype=np.int32)
        self.values = np.array(values, dtype=np.float32)


class EmbeddingService:
    def __init__(self):
        print("Initializing Embedding Models (BAAI/bge-m3 & bge-reranker-base via FlagEmbedding)...")
        try:
            self.model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)
            print("BGEM3FlagModel loaded successfully.")
        except Exception as e:
            print(f"Error initializing BGEM3FlagModel: {e}")
            raise e

        try:
            self.reranker = FlagReranker('BAAI/bge-reranker-base', use_fp16=False)
            print("FlagReranker loaded successfully.")
        except Exception as e:
            print(f"Warning: Could not initialize FlagReranker: {e}")
            self.reranker = None

    def embed_texts(self, texts: list[str]):
        """
        Returns a tuple of (dense_vecs, sparse_vecs)
        dense_vecs: list/numpy array of dense embeddings (N, 1024)
        sparse_vecs: list of SparseEmbeddingWrapper objects with .indices and .values
        """
        output = self.model.encode(texts, return_dense=True, return_sparse=True)
        
        if isinstance(output, dict):
            dense_vecs = output.get('dense_vecs', output.get('dense'))
            lexical_weights = output.get('lexical_weights', [])
        else:
            dense_vecs = output
            lexical_weights = [{}] * len(texts)

        sparse_vecs = []
        for lw in lexical_weights:
            indices = []
            values = []
            for k, v in lw.items():
                try:
                    indices.append(int(k))
                except (ValueError, TypeError):
                    indices.append(abs(hash(str(k))) % 1000000)
                values.append(float(v))
            sparse_vecs.append(SparseEmbeddingWrapper(indices, values))

        return dense_vecs, sparse_vecs

    def rerank(self, query: str, documents: list[dict], text_key: str = "text", top_k: int = 4) -> list[dict]:
        """
        Reranks a list of document dicts using FlagReranker (or returns top_k if unavailable).
        """
        if not documents:
            return []
        if len(documents) <= top_k:
            return documents[:top_k]

        if self.reranker:
            doc_texts = [d.get(text_key, "") for d in documents]
            pairs = [[query, doc_text] for doc_text in doc_texts]
            try:
                scores = self.reranker.compute_score(pairs)
                if isinstance(scores, (float, int)):
                    scores = [scores]
                scored_docs = list(zip(scores, documents))
                scored_docs.sort(key=lambda x: x[0], reverse=True)
                return [doc for score, doc in scored_docs[:top_k]]
            except Exception as e:
                print(f"Reranking error: {e}, falling back to top_k")
                return documents[:top_k]

        return documents[:top_k]


_embedding_service = None


def get_embedding_service():
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
