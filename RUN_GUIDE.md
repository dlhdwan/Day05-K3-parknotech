# Hướng Dẫn Khởi Chạy Hệ Thống VLearn Tutor

Tài liệu này hướng dẫn cách khởi động toàn bộ hệ thống (Qdrant Database, FastAPI Backend, React Frontend) và nạp dữ liệu (Ingestion) để test tính năng Micro-Quiz sinh bởi AI.

---

## 1. Yêu cầu hệ thống
- **Docker & Docker Compose** (để chạy Qdrant Database)
- **Python 3.11+** (để chạy Backend FastAPI)
- **Node.js & npm** (để chạy Frontend React/Vite)
- **uv** (trình quản lý package Python)

---

## 2. Các bước khởi chạy

### Bước 1: Khởi động cơ sở dữ liệu Vector (Qdrant)
Hệ thống sử dụng Qdrant để lưu trữ vector cho Hybrid Search (RAG).
Mở terminal ở thư mục gốc của dự án (`K3-parknotech`):

```bash
docker compose up -d qdrant
```

### Bước 2: Cài đặt và chạy Backend (FastAPI + AI Agent)
Mở một terminal mới, chuyển vào thư mục `codebase/backend`:

```bash
cd codebase/backend

# 1. Tạo môi trường ảo và kích hoạt bằng uv (nhanh hơn pip)
uv venv --python 3.11
source .venv/bin/activate

# 2. Cài đặt các thư viện cần thiết
uv pip install -r requirements.txt

# 3. Cấu hình biến môi trường
cp .env.example .env
# Mở file .env và điền GEMINI_API_KEY của bạn vào

# 4. Chạy Server
python -m uvicorn app.main:app --reload
```
*Backend sẽ chạy tại: `http://localhost:8000`*

### Bước 3: Nạp dữ liệu vào Database (Ingestion)
Mở thêm một terminal mới ở `codebase/backend` (nhớ kích hoạt lại môi trường ảo):

```bash
cd codebase/backend
source .venv/bin/activate

# Chạy script nạp dữ liệu (PDF + Transcripts)
python run_ingest.py
```
*Script sẽ băm PDF thành chunk, nạp 11 transcripts và kết thúc bằng `Ingestion completed successfully!`*

### Bước 4: Cài đặt và chạy Frontend (React)
Mở một terminal mới, chuyển vào thư mục `codebase`:

```bash
cd codebase

# Cài đặt thư viện Node.js
npm install

# Khởi động giao diện
npm run dev
```
*Frontend sẽ mở tại: `http://localhost:5173`. Mở link này trên trình duyệt để sử dụng.*

---

## 3. Hướng dẫn Test tính năng Micro-Quiz

1. Truy cập vào giao diện Frontend.
2. Bấm vào nút gợi ý bên dưới màn hình đọc PDF: `💡 Click vào đây để tạo Quiz AI cho đoạn này (slide 14)`.
3. Hoặc gõ vào khung chat Tutor: *"Tạo quiz kiểm tra nhanh cho trang 14 về Few-shot prompting"*, sau đó bấm nút **Bắt đầu làm Quiz**.
4. Trả lời các câu hỏi và bấm **Kiểm tra đáp án** để xem AI giải thích chi tiết, kèm theo Trích dẫn (Citation) trực tiếp từ lời giảng (ví dụ `[T04-025]`).

---

👉 Mọi chi tiết về kiến trúc hệ thống và Guardrails (Option Length Ratio, R3) đều được ghi chép trong [docs/dev-diary.md](docs/dev-diary.md)
