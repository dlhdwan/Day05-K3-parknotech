import os
import sys
import glob

# Add the root backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.ingestion.loaders import load_pdf, load_transcripts
from app.ingestion.splitters import split_text
from app.services.vector_store import vector_store

if __name__ == "__main__":
    slides_dirs = [
        "../data/vlearn-pack/slides",
        "../../data/vlearn-pack/slides",
        "/app/data/vlearn-pack/slides"
    ]
    
    slides_dir = None
    for d in slides_dirs:
        if os.path.exists(d):
            slides_dir = d
            break

    transcripts_path = "app/data/transcripts.json"

    print("Starting Ingestion Pipeline...")
    print("Setting up Qdrant collection...")
    vector_store.setup_collection()

    if slides_dir:
        pdf_files = sorted(glob.glob(os.path.join(slides_dir, "*.pdf")))
        print(f"Found {len(pdf_files)} PDF files in {slides_dir}: {[os.path.basename(f) for f in pdf_files]}")
        
        for pdf_path in pdf_files:
            source_name = os.path.basename(pdf_path)
            print(f"\n--- Processing {source_name} ---")
            text = load_pdf(pdf_path)
            chunks = split_text(text)
            print(f"Generated {len(chunks)} PDF chunks from {source_name}.")
            vector_store.upsert_chunks(chunks, source_name)
    else:
        print("WARNING: Slides directory not found!")

    if os.path.exists(transcripts_path):
        print(f"\nLoading transcripts from {transcripts_path}...")
        transcripts = load_transcripts(transcripts_path)
        print(f"Generated {len(transcripts)} transcripts.")
        vector_store.upsert_transcripts(transcripts)
    else:
        print(f"WARNING: Transcripts file not found at {transcripts_path}!")

    print("\nAll Ingestion completed successfully!")
