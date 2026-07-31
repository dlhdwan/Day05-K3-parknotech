# BÁO CÁO THU HOẠCH CÁ NHÂN (REFLECTION REPORT)

- **Họ và tên**: Nguyễn Văn Hiếu
- **Dự án**: VLearn - Hệ thống RAG Quiz & AI Tutor cho Slide/Bài giảng
- **Nhóm**: K3-parknotech

---

## 1. Vai trò trong dự án (Role)
- **Vị trí**: AI Backend Engineer / RAG Pipeline Lead (Mã HV: 2A202601831).
- **Trách nhiệm chính**: Chịu trách nhiệm thiết kế AI Backend Engine, xây dựng RAG Pipeline & Context Retrieval (Qdrant), thiết lập AI Quiz Generator Agent, Prompt Engineering và Tối ưu hóa Backend API. Ngoài ra, tôi phụ trách hợp nhất mã nguồn (Branch Merging) từ các thành viên Frontend để đảm bảo tính ổn định của toàn hệ thống.

---

## 2. Các công việc đã thực hiện (Tasks Completed)
- **Thiết kế AI Backend & RAG Pipeline**:
  - Triển khai toàn bộ endpoint API Backend (`/api/chat`, `/api/quiz/generate`) bằng FastAPI, kết hợp cơ sở dữ liệu vector Qdrant.
  - Tích hợp logic tìm kiếm ngữ nghĩa (Semantic Search) và cơ chế Fallback linh hoạt: khi không đủ thông tin KC (Knowledge Component), Backend tự động lấy Transcript lời giảng làm Ground Truth.
- **Prompt Engineering & Xử lý Phạm vi (Scope)**:
  - Thiết kế System Prompt bắt buộc LLM tuân thủ JSON Schema (`minItems: 3`, `maxItems: 3`) và cấu trúc giải thích kèm trích dẫn nguyên văn `[Txx-NNN]`.
  - Xử lý logic chọn phạm vi kiến thức (`Selected Text Scope`) - cho phép học viên bôi đen trên Slide để sinh Quiz / Hỏi AI đúng trọng tâm mà không sinh lan man ra ngoài.
- **Merge Code, Sửa lỗi LLM Provider & Triển khai Git**:
  - Trực tiếp xử lý hợp nhất nhánh công việc (`agent/hzcay`) vào nhánh chính (`main`), giải quyết xung đột mã nguồn phức tạp (Git Merge Conflicts) giữa Frontend và Backend.
  - Sửa lỗi đứt gãy Provider khi Gemini ngưng hỗ trợ model cũ (`gemini-2.5-flash-lite`), chuyển đổi cấu hình mượt mà sang `gemini-1.5-flash` / `gemini-3.1-flash-lite` và đảm bảo toàn bộ Unit Test (26/26 tests) của dự án chạy thành công.

---

## 3. Vai trò của AI trong quá trình hỗ trợ (AI Assistance)
Trong dự án này, tôi đã sử dụng AI (như Antigravity AI Coding Assistant / Gemini) làm người bạn đồng hành (Pair Programmer):
- **Phân tích & Giải quyết xung đột mã nguồn (Git Merge Conflict)**: AI hỗ trợ quét và đề xuất cách hợp nhất mã nguồn giữa tính năng Modal trích dẫn cá nhân và quy trình Quiz từ nhánh `main` một cách an toàn.
- **Tự động bắt lỗi Cú pháp & Tối ưu Build**: AI hỗ trợ phát hiện các lỗi cú pháp ẩn trong JSX (như thiếu ngoặc đóng block điều kiện) mà lướt bằng mắt thường khó thấy khi chạy `npm run build`.
- **Tối ưu Prompt & Guardrails**: AI trợ giúp tinh chỉnh các câu Prompt hệ thống, cấu hình lại Model Gemini (`gemini-3.1-flash-lite`) và thiết lập cơ chế lọc từ khóa cấm (Forbidden Keywords) cho Backend.

---

## 4. Bài học kinh nghiệm từ trường hợp thất bại (Case Fail & Lessons Learned)

### 📌 Case Fail thực tế của nhóm:
* **Sự cố 1 (Lỗi Qdrant rỗng & Frontend gửi sai Prompt - Turn 8)**: Khi kiểm thử thực tế, file slide Day 01 chưa được nạp (ingest) dữ liệu Knowledge Component vào cơ sở dữ liệu vector Qdrant. Tuy nhiên, Frontend lại tự động gửi kèm một `user_prompt` giả (synthetic prompt) khi người dùng bấm "Tạo quiz". Hậu quả là Backend hiểu nhầm đây là yêu cầu hỏi đáp ngoài lề (conversational) thay vì sinh quiz cho slide, dẫn đến việc LLM kích hoạt Guardrail từ chối trả lời (Out-of-scope JSON).
* **Sự cố 2 (Lỗi đứt gãy Provider do API Key & Model - Turn 3)**: Hệ thống bị sập hoàn toàn chức năng sinh Quiz do sử dụng Key Gemini bị lỗi (`API_KEY_INVALID`) và cấu hình model cũ không ổn định. Lỗi này ban đầu bị ẩn (silent fail) khiến Frontend không render được giao diện lỗi rõ ràng.

### 💡 Bài học rút ra (Lessons Learned):
1. **Thiết kế cơ chế Fallback nhiều tầng (Resilience)**: Từ sự cố 1, nhóm rút ra bài học không được phụ thuộc 100% vào cơ sở dữ liệu Vector. Đã khắc phục bằng cách: Khi không tìm thấy KC trong Qdrant, Backend sẽ tự động đọc text trực tiếp từ file PDF của trang slide đó để tạo thành một KC "ảo" (Dynamic KC) phục vụ RAG tại chỗ.
2. **Loại bỏ dữ liệu giả (Synthetic Data) từ Frontend**: Đảm bảo Frontend gửi đúng ý định thực tế của người dùng. Bỏ hẳn việc gửi `user_prompt` mặc định, để Backend quyết định luồng (Conversational vs Quiz) chính xác hơn.
3. **Cơ chế xử lý lỗi LLM chuẩn hóa (Structured Error Handling)**: Từ sự cố 2, nhóm học được cách trả về cấu trúc lỗi chi tiết từ Backend (Diagnostics) để Frontend bắt và hiển thị thông báo lỗi Provider thân thiện cho người dùng, thay vì để màn hình trắng hoặc crash ứng dụng. (Chốt cấu hình sử dụng `gemini-3.1-flash-lite` hoặc fallback sang OpenAI).
