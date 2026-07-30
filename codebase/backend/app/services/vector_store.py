import uuid
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings
from app.services.embedding import embedding_service
from typing import List, Dict

class VectorStoreService:
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.collection_name = settings.COLLECTION_NAME

    def setup_collection(self):
        if self.client.collection_exists(self.collection_name):
            self.client.delete_collection(self.collection_name)
            
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config={
                "dense": models.VectorParams(size=384, distance=models.Distance.COSINE)
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams()
            }
        )

    def upsert_chunks(self, chunks: List[str], source_meta: str):
        if not chunks:
            return
            
        dense_vecs, sparse_vecs = embedding_service.embed_texts(chunks)
        
        points = []
        for chunk, dense_emb, sparse_emb in zip(chunks, dense_vecs, sparse_vecs):
            points.append({
                "id": str(uuid.uuid4()),
                "vector": {
                    "dense": dense_emb.tolist(),
                    "sparse": {
                        "indices": sparse_emb.indices.tolist(),
                        "values": sparse_emb.values.tolist()
                    }
                },
                "payload": {
                    "text": chunk,
                    "source": source_meta,
                    "type": "chunk"
                }
            })
            
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def upsert_transcripts(self, transcripts: List[dict]):
        if not transcripts:
            return
            
        texts = [t["text"] for t in transcripts]
        dense_vecs, sparse_vecs = embedding_service.embed_texts(texts)
        
        points = []
        for t, dense_emb, sparse_emb in zip(transcripts, dense_vecs, sparse_vecs):
            points.append({
                "id": str(uuid.uuid4()),
                "vector": {
                    "dense": dense_emb.tolist(),
                    "sparse": {
                        "indices": sparse_emb.indices.tolist(),
                        "values": sparse_emb.values.tolist()
                    }
                },
                "payload": {
                    "type": "transcript",
                    "transcript_id": t["transcript_id"],
                    "text": t["text"]
                }
            })
            
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def search_hybrid(self, query: str, limit: int = 3) -> List[str]:
        if not self.client.collection_exists(self.collection_name):
            return []

        dense_queries, sparse_queries = embedding_service.embed_texts([query])
        dense_query = dense_queries[0]
        sparse_query = sparse_queries[0]
        
        prefetch_dense = models.Prefetch(
            query=dense_query.tolist(),
            using="dense",
            limit=5
        )
        
        prefetch_sparse = models.Prefetch(
            query=models.SparseVector(
                indices=sparse_query.indices.tolist(),
                values=sparse_query.values.tolist()
            ),
            using="sparse",
            limit=5
        )
        
        results = self.client.query_points(
            collection_name=self.collection_name,
            prefetch=[prefetch_dense, prefetch_sparse],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=limit
        )
        
        return [point.payload["text"] for point in results.points]

    def get_transcripts_by_ids(self, transcript_ids: List[str]) -> List[str]:
        if not self.client.collection_exists(self.collection_name):
            return []
            
        results = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="transcript_id",
                        match=models.MatchAny(any=transcript_ids)
                    ),
                    models.FieldCondition(
                        key="type",
                        match=models.MatchValue(value="transcript")
                    )
                ]
            ),
            limit=100
        )
        
        points = results[0]
        text_map = {p.payload["transcript_id"]: p.payload["text"] for p in points if "transcript_id" in p.payload}
        
        ordered_texts = []
        for tid in transcript_ids:
            if tid in text_map:
                ordered_texts.append(f"[{tid}] {text_map[tid]}")
                
        return ordered_texts

vector_store = VectorStoreService()
