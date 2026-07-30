from app.ingestion.loaders import load_pdf_slides, load_transcripts
from app.services.vector_store import vector_store

def run_ingestion(pdf_path: str, transcripts_path: str, source_name: str, batch_size: int = 32):
    print("Setting up Qdrant collection...")
    vector_store.setup_collection()

    print(f"Loading slides from {pdf_path}...")
    slides = load_pdf_slides(pdf_path)
    print(f"Generated {len(slides)} PDF slide pages.")
    
    print("Embedding and uploading PDF slides to Qdrant...")
    vector_store.upsert_slides(slides, batch_size=batch_size)
    
    print(f"Loading transcripts from {transcripts_path}...")
    transcripts = load_transcripts(transcripts_path)
    print(f"Generated {len(transcripts)} transcripts.")
    
    print("Embedding and uploading transcripts to Qdrant...")
    vector_store.upsert_transcripts(transcripts, batch_size=batch_size)

    print("Ingestion completed successfully!")
