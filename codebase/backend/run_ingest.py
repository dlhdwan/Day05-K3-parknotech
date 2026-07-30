import os
import sys

# Add the root backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.ingestion.pipeline import run_ingestion

if __name__ == "__main__":
    pdf_path = "../data/vlearn-pack/slides/d2-slide-hackathon.pdf"
    transcripts_path = "app/data/transcripts.json"
    
    if not os.path.exists(pdf_path):
        pdf_path = "/app/data/vlearn-pack/slides/d2-slide-hackathon.pdf"
    if not os.path.exists(pdf_path):
        pdf_path = "../../data/vlearn-pack/slides/d2-slide-hackathon.pdf"
        
    print("Starting Ingestion...")
    run_ingestion(pdf_path, transcripts_path, "d2-slide-hackathon.pdf")
