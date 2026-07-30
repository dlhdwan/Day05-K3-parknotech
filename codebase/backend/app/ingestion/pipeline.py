from app.ingestion.loaders import load_pdf, load_transcripts
from app.ingestion.splitters import split_text
from app.services.vector_store import vector_store

def run_ingestion(pdf_path: str, transcripts_path: str, source_name: str):
    print("Setting up Qdrant collection...")
    vector_store.setup_collection()

    print(f"Loading {pdf_path}...")
    text = load_pdf(pdf_path)
    
    print("Splitting text into chunks...")
    chunks = split_text(text)
    print(f"Generated {len(chunks)} PDF chunks.")
    
    print("Embedding and uploading PDF chunks to Qdrant...")
    vector_store.upsert_chunks(chunks, source_name)
    
    print(f"Loading transcripts from {transcripts_path}...")
    transcripts = load_transcripts(transcripts_path)
    print(f"Generated {len(transcripts)} transcripts.")
    
    print("Embedding and uploading transcripts to Qdrant...")
    vector_store.upsert_transcripts(transcripts)

    print("Ingestion completed successfully!")
