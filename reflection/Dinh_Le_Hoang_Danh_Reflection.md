# BÁO CÁO THU HOẠCH CÁ NHÂN (PERSONAL REFLECTION REPORT)

- **Họ và tên**: Đinh Lê Hoàng Danh
- **Dự án**: VLearn - Hệ thống RAG Quiz & AI Tutor cho Slide/Bài giảng
- **Nhóm**: K3-parknotech

---

## 1. Vai trò trong dự án (Role)

- **Vị trí**: Product Manager / Team Lead & AI Product Architect.
- **Trách nhiệm chính**:
  - Dẫn dắt định hướng sản phẩm, nghiên cứu nhu cầu người dùng (JTBD) và thực hiện đào xới bằng chứng (Data Mining trên 1.261 lượt chatlog VLearn & Khảo sát thực tế 20 học viên).
  - Soạn thảo tài liệu thiết kế kỹ thuật **AI Spec** (`spec.md`, `canvas.md`, `solution_architecture.md`), định hình **Lát cắt MỘT CÂU** (Atomic Micro-Quiz Generator) và quy hoạch các Ràng buộc / Non-goals cho hệ thống.
  - Phân rã taxonomy **4 lớp chỗ khó** (Nguồn sự thật, Mơ hồ, Ngoài phạm vi, Domain bias) và thiết lập cơ chế kiểm soát rủi ro (Guardrails).
  - Điều phối quy trình phát triển, làm cầu nối giữa mảng AI Backend (Hiếu), Frontend UX (Dương) và AI QA/Validation (Ngọc Anh) để đảm bảo nhóm hoàn thành đúng hạn các mốc Checkpoint (CP1 đến CP6).

---

## 2. Các công việc đã thực hiện (Tasks Completed)

### 2.1. Đào xới Bằng chứng & Định hình Bài toán (Evidence Mining & JTBD)
- **Khai thác dữ liệu Chatlog VLearn (`evidence/cp1-mining.md`)**:
  - Mining định lượng trên 1.261 lượt tương tác chatlog: Phát hiện Tutor hiện tại chỉ có 3 lượt đặt câu hỏi kiểm tra (`asked_check_question=True`, tỉ lệ 0.24%), 1 lượt dùng move `validate_understanding`, và 0 lượt ghi nhận `misconceptions`.
  - Kết luận bằng chứng: Tutor hiện tại hoàn toàn bỏ ngỏ vòng lặp *"giải thích → kiểm tra → phát hiện lỗ hổng kiến thức"*.
- **Khảo sát thực tế người dùng ($N = 20$)**:
  - Thực hiện khảo sát 20 học viên ngoài nhóm: 40.0% cảm thấy hiểu nhưng không có cách kiểm chứng cụ thể; 65.0% gặp khó khăn ôn tập do slide dài lan man; 95.0% sẵn sàng trải nghiệm tính năng kiểm tra nhanh.
  - Định hình **Problem Statement**: Học viên bị đánh lừa bởi cảm giác quen mặt chữ (*fluency illusion*) nhưng thiếu công cụ kiểm chứng sự hiểu thực tế trước khi sang nội dung mới.

### 2.2. Xây dựng AI Spec & Kiến trúc Sản phẩm (Product Architecture & Spec)
- **Thiết lập Lát cắt MỘT CÂU (One-Sentence Architectural Slice)**:
  > *"Học viên bôi đen hoặc chọn một phần kiến thức trên Slide → bấm 'Kiểm tra nhanh' → AI Agent gọi RAG lấy Transcript `[Txx-NNN]` → sinh 3 câu Micro-Quiz → Client chấm điểm Local tức thì (0ms latency)."*
- **Quy hoạch Ràng buộc & Tối ưu Quota Budget**:
  - Đề xuất mô hình **Conditional/Augment**: Chỉ sinh Quiz khi học viên chủ động yêu cầu; 1 AI call sinh theo batch 3 câu trắc nghiệm.
  - Quy định chấm điểm Local phía Client để bảo toàn hạn mức Quota (mặc định 15 lượt/ngày).
- **Phân rã Taxonomy 4 Lớp Chỗ Khó & Guardrails**:
  - Đưa ra cơ chế bắt buộc RAG trích dẫn `[Txx-NNN]` để chống Hallucination (Lớp ①).
  - Thiết lập chỉ số **Option Length Ratio ($\le 2.2$)** để ngăn chặn LLM sinh bẫy "đáp án dài nhất luôn đúng" (Lớp ④).

### 2.3. Điều phối Quy trình & Quản trị Mốc Checkpoint (Sprint & Team Coordination)
- **Đảm bảo tính nhất quán giữa các mảng chuyên môn**:
  - Kết nối tính năng **Selection-Scoped RAG** (Toolbar bôi đen của Dương) với backend logic xử lý Hard Scope & Dynamic KC Fallback (của Hiếu).
  - Phối hợp với QA (Ngọc Anh) để đưa tiêu chí **Question Quality** (câu hỏi vận dụng thay vì ghi nhớ) vào Evaluation Framework và Golden Set.
- **Quản trị các mốc Checkpoint**: Chịu trách nhiệm bảo vệ Canvas tại CP1, theo dõi tiến độ prototype tại CP2-CP3, chốt Spec tại CP4 (hạn cứng 23:59 N1), và chuẩn bị hồ sơ Validation/Dry Run cho CP5-CP6.

---

## 3. Vai trò của AI trong Quá trình Hỗ trợ (AI Co-Pilot Strategy)

Trong suốt quá trình dự án, tôi sử dụng AI (Antigravity AI Assistant / ChatGPT / Claude / Gemini) như một **Product Management Co-Pilot**:

- **Tổng hợp & Phân tích Data Mining / Khảo sát**: AI hỗ trợ xử lý file CSV chatlog, trích xuất các câu quote nguyên văn của học viên và tính toán chính xác các tỉ lệ phần trăm thống kê cho `spec.md`.
- **Rà soát & Chuẩn hóa AI Spec (`spec.md`)**: AI trợ giúp kiểm tra tính logic của Taxonomy 4 lớp chỗ khó, kiểm tra sự tương thích với các tiêu chí HAX/PAIR guidelines (phản hồi tức thì, hiển thị citation rõ ràng, Explicit Error UX).
- **Phân tích Đánh đổi Kỹ thuật (Trade-off Analysis)**: AI hỗ trợ tính toán bài toán chi phí token / Quota budget, từ đó đưa ra quyết định loại bỏ phương án "Tutor tự động hỏi ngược" để chọn phương án "Micro-Quiz theo yêu cầu".

> ⚠️ **Kỷ luật Vibe-Coding / Product Ownership**: Mặc dù AI hỗ trợ tổng hợp thông tin rất nhanh, tôi trực tiếp đưa ra mọi quyết định sản phẩm, làm chủ toàn bộ bài toán kinh doanh/người dùng và giải thích rõ ràng từng lát cắt kiến trúc tại các mốc bảo vệ.

---

## 4. Bài học Kinh nghiệm & Trường hợp Thất bại (Failure Cases & Lessons Learned)

### 📌 Case Fail thực tế của nhóm:

1. **Sự cố 1 (Bẫy Feature Creep & Nguy cơ Cháy Quota - CP1)**:
   * Ban đầu nhóm cân nhắc phương án *"Tutor tự động đặt câu hỏi kiểm tra sau mỗi câu trả lời"*. Qua phân tích Impact & Quota, tôi nhận ra phương án này sẽ làm cháy Quota 15 calls/ngày chỉ sau vài lượt chat và gây phiền nhiễu học viên.
2. **Sự cố 2 (Mâu thuẫn giữa RAG Scope & Intent người dùng - Turn 8)**:
   * Khi học viên bấm nút "Tạo quiz" ở slide Day 01 chưa ingest KC vào Qdrant DB, Frontend lại tự gửi một `user_prompt` mặc định. Backend hiểu nhầm đây là hỏi đáp conversational nên trả về Guardrail từ chối (Out-of-scope). Điều này làm đứt gãy luồng trải nghiệm Quiz.
3. **Sự cố 3 (Xung đột Git binary `.pyc` & Hardcoded API URL)**:
   * Việc thiếu file `.gitignore` chuẩn từ đầu khiến các file rác `.pyc` làm nghẽn quy trình gộp nhánh (merge branch) của Hiếu và Dương. Đồng thời, lỗi hardcode URL `localhost:8000` làm Frontend treo quay vô tận mà không hiển thị thông báo lỗi rõ ràng.

### 💡 Bài học rút ra (Lessons Learned):

1. **Kiên định với Lát cắt MỘT CÂU & Quản trị Cost-of-error**:
   * Phải luôn ưu tiên bài toán cốt lõi của người dùng thay vì thêm tính năng phức tạp. Quyết định loại bỏ "hỏi ngược tự động" để chọn "Micro-Quiz theo yêu cầu chấm local" là chìa khóa giúp sản phẩm khả thi trong hạn mức Quota.
2. **Thấu hiểu toàn diện liên mảng (Cross-functional Ownership)**:
   * Người làm Product không chỉ viết spec mà phải hiểu sâu sắc luồng chạy thực tế của code. Nhờ phát hiện mâu thuẫn ở Sự cố 2, nhóm đã kịp thời điều chỉnh: Backend bổ sung **Dynamic KC Fallback** (Hiếu) và Frontend loại bỏ synthetic prompt (Dương).
3. **Chất lượng AI phải gắn liền với Giá trị Giáo dục (Pedagogical Impact)**:
   * Quiz AI không chỉ cần "đúng JSON" hay "có Citation", mà quan trọng nhất phải giúp học viên nhận ra lỗ hổng hiểu bài. Việc phối hợp bổ sung tiêu chí **Question Quality** cùng QA (Ngọc Anh) giúp sản phẩm giữ đúng lời hứa ban đầu.

---

## 5. Tổng kết (Conclusion)

Dự án VLearn là bài học thực chiến vô cùng giá trị về **Tư duy Sản phẩm AI (AI Product Thinking)**. Sản phẩm tốt không nằm ở việc sử dụng mô hình AI phức tạp nhất hay viết nhiều dòng code nhất, mà nằm ở việc thấu hiểu đúng nỗi đau người dùng, xác định đúng Lát cắt MỘT CÂU khả thi, và điều phối đội ngũ thực thi kỷ luật từ khâu Backend, Frontend cho đến QA/Validation.
