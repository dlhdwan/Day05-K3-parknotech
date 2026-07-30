import os
import re
import json
import glob

def parse_all_transcripts():
    base_dirs = [
        "../data/vlearn-pack/transcript",
        "../../data/vlearn-pack/transcript",
        "/app/data/vlearn-pack/transcript"
    ]
    
    transcript_dir = None
    for d in base_dirs:
        if os.path.exists(d):
            transcript_dir = d
            break
            
    if not transcript_dir:
        print("Error: Could not find transcript directory!")
        return

    md_files = sorted(glob.glob(os.path.join(transcript_dir, "transcript-*-clean.md")))
    print(f"Found {len(md_files)} clean transcript markdown files.")

    transcripts = []
    # Pattern to match **[Txx-NNN]** followed by text
    pattern = re.compile(r'\*\*\[(T\d{2}-\d{3})\]\*\*\s*(.+)')

    for md_path in md_files:
        with open(md_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                match = pattern.match(line)
                if match:
                    t_id = match.group(1)
                    text = match.group(2).strip()
                    transcripts.append({
                        "transcript_id": t_id,
                        "text": text
                    })

    out_path = "app/data/transcripts.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(transcripts, f, ensure_ascii=False, indent=2)

    print(f"Successfully extracted {len(transcripts)} transcript chunks into {out_path}!")

if __name__ == "__main__":
    parse_all_transcripts()
