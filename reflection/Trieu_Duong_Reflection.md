# BÁO CÁO THU HOẠCH CÁ NHÂN (PERSONAL REFLECTION REPORT)

- **Họ và tên**: Triệu Dương
- **Dự án**: VLearn - Hệ thống RAG Quiz & AI Tutor cho Slide/Bài giảng
- **Nhóm**: K3-parknotech

---

## 1. Vai trò trong dự án (Role)
- **Vị trí**: Fullstack Developer & Frontend Lead.
- **Trách nhiệm chính**: 
  - Phụ trách toàn bộ trải nghiệm người dùng (UX/UI) và luồng Micro-Quiz tương tác phía Client (React/Vite).
  - Thiết kế và triển khai luồng **Selection-Scoped RAG** (bôi đen đoạn văn trên PDF Slide để hỏi AI hoặc tạo Quiz đúng trọng tâm).
  - Xây dựng hệ thống quản lý Quota Local, chuẩn hóa API Client, và triển khai các bộ Unit Test cho cả Frontend và Backend.
  - Quản trị cấu trúc Repo, xử lý Git Hygiene (loại bỏ `.pyc`, cấu hình `.gitignore`), viết Dev Diary và thực hiện Merging code liên nhánh.

---

## 2. Các công việc đã thực hiện (Tasks Completed)

### 2.1. Phát triển Frontend & Luồng Micro-Quiz hoàn chỉnh
- **Xây dựng giao diện React & Component hóa**:
  - Refactor lại cấu trúc `App.jsx`, chia tách các module logic thuần như `api.js`, `quota.js`, `quizUtils.js`, `courseContent.js` để dễ mở rộng và kiểm thử.
  - Tích hợp trình xem slide PDF (`react-pdf`) hỗ trợ chuyển trang, thu phóng (zoom in/out/reset) và chế độ xem chi tiết từng slide.
  - Thiết kế UI hiển thị kết quả Quiz, chấm điểm tức thì phía Client (0ms latency, 0 API call khi grading), hiển thị trích dẫn bài giảng `[Txx-NNN]` và cảnh báo Guardrail.
- **Quản lý Quota & State Local**:
  - Triển khai `quota.js` ghi nhớ hạn mức sinh quiz theo ngày trong `localStorage` (mặc định 15 lượt/ngày), tự động khoá/thông báo khi vượt quota.
  - Xây dựng component `CitationModal` cho phép học viên click vào mã trích dẫn để mở cửa sổ đọc nguyên văn đoạn transcript hoặc nội dung slide tương ứng.

### 2.2. Tính năng Selection-Scoped RAG (Popup Toolbar trên PDF)
- **Phát triển Toolbar bôi đen văn bản (`selectionToolbar.js`)**:
  - Bắt sự kiện chọn văn bản trên tài liệu PDF và hiển thị popup toolbar nhỏ gọn gồm 2 hành động: **"Hỏi AI"** và **"Tạo quiz"**.
  - Kết nối dữ liệu văn bản được bôi đen (`selected_text`) vào payload gửi lên API `/api/quiz/generate` và `/api/chat`.
- **Phối hợp Backend điều chỉnh RAG Prompt & Workflow**:
  - Cùng Backend cập nhật Schema (`schemas.py`) và luồng xử lý `workflow.py` để ưu tiên `selected_text` làm phạm vi truy xuất cứng (Hard Scope), loại bỏ bẫy từ chối trả lời ngoài lề (Out-of-scope Rejection) khi học viên đã chủ động chọn đoạn kiến thức.

### 2.3. Kiểm thử (Testing) & Quản trị Repository (Git Hygiene)
- **Xây dựng hệ thống Unit Test**:
  - Viết các bộ test tự động sử dụng `node --test` cho `api.test.js`, `quota.test.js`, `quizUtils.test.js`, `selectionToolbar.test.js`, và `dockerCompose.test.js`.
  - Viết Backend Unit Test (`test_selection_scope_workflow.py`, `test_api_selection_scope.py`, `test_quiz_workflow_fallback.py`) kiểm chứng luồng RAG fallback.
- **Dọn dẹp & Quản trị Codebase**:
  - Làm sạch Git index, xoá hoàn toàn các file rác sinh ra từ Python (`__pycache__`, `*.pyc`), viết lại `.gitignore` tiêu chuẩn cho dự án.
  - Ghi chép nhật ký phát triển `docs/dev-diary.md`, theo dõi Build Turn Log chi tiết từng đợt thử nghiệm.

---

## 3. Vai trò của AI trong quá trình hỗ trợ (AI Assistance)

Trong quá trình phát triển, tôi sử dụng AI (như Antigravity AI Coding Assistant / Claude / Gemini) theo nguyên tắc **Pair Programming & Co-pilot**, hoàn toàn làm chủ thiết kế và kiểm soát mã nguồn:

- **Tốc độ hóa việc boilerplate code & Unit Test**: AI hỗ trợ sinh nhanh các file test template cho `node --test` và CSS animation cho Popup Toolbar, giúp tiết kiệm đáng kể thời gian viết code lặp lại.
- **Phân tích lỗi Runtime & CSS Layout**: AI giúp phát hiện nguyên nhân gây tràn khung (overflow) trên mobile và lỗi lệch import package `react-pdf` khi chạy trong môi trường Docker container.
- **Rà soát Git Conflict & Refactoring**: AI hỗ trợ quét các file bị xung đột khi gộp nhánh, đề xuất phương án giữ lại những đoạn code mới nhất và đầy đủ tính năng nhất.

*Lưu ý (Vibe-Coding Rule)*: Mặc dù AI giúp sinh code nhanh, nhưng tôi trực tiếp nắm rõ và giải thích từng dòng logic từ việc quản lý state React, tính toán vị trí Popup Toolbar, cho đến cơ chế `selected_text` trong RAG workflow.

---

## 4. Trường hợp thất bại & Bài học kinh nghiệm (A Failure Case & Lessons Learned)

### 📌 Case Fail thực tế:
* **Sự cố 1 (Lỗi đứt gãy trải nghiệm Quiz do chọn sai Scope & Hardcode Backend URL)**:
  Ở phiên bản Prototype đầu tiên, Frontend gom toàn bộ logic trong `App.jsx`, nút "Tạo quiz" bị hardcode truy xuất slide 14 và dùng URL `http://localhost:8000`. Khi deploy lên Docker hoặc đổi cổng, Frontend bị lỗi CORS/Network Error mà không hiển thị thông báo gì cụ thể cho người dùng ngoại trừ màn hình loading quay vô tận (`questions.length === 0`).
* **Sự cố 2 (Xung đột dữ liệu `__pycache__` khi Merge Git)**:
  Do thiếu file `.gitignore` chuẩn cho Python từ ban đầu, các file `.pyc` được sinh ra tự động trong quá trình chạy test backend đã bị commit lên repo. Khi gộp nhánh (merge branch) từ đồng đội, Git báo hàng chục conflict giả trên các file binary `.pyc`, gây tắc nghẽn quy trình CI/CD và làm bẩn lịch sử commit.

### 💡 Bài học rút ra (Lessons Learned):
1. **Phân tách Trạng thái Lỗi rõ ràng (Explicit Error UX)**: Không bao giờ dùng một trạng thái ngầm định (như `questions.length === 0`) cho cả việc "chưa tải" lẫn "tải bị lỗi". Cần phân biệt rõ ràng giữa Loading State, HTTP Error (500/404), Quota Exceeded và API Provider Fail để hiển thị thông báo phù hợp cho học viên.
2. **Giữ gìn Git Hygiene ngay từ Turn 1**: Một dự án AI/Fullstack kết hợp Python backend và Node.js frontend bắt buộc phải được thiết lập `.gitignore` chuẩn xác ngay từ đầu. Việc theo dõi nhầm các file cache làm phức tạp hoá công đoạn Git Merge và dễ gây mất code khi xử lý conflict.
3. **Độ trễ bằng 0 cho trải nghiệm kiểm chứng (Zero-Latency Grading)**: Việc chuyển toàn bộ logic chấm điểm và giải thích Quiz về xử lý Client-side giúp học viên phản hồi ngay lập tức, không tốn thêm API call hay làm tăng chi phí quota.

---

## 5. Tổng kết (Conclusion)

Dự án VLearn không chỉ là một ứng dụng RAG đơn thuần, mà là một sản phẩm hướng tới trải nghiệm học tập thực sự cho học viên. Qua dự án này, tôi đã nâng cao tư duy thiết kế hệ thống fullstack bám sát vấn đề thực tế của người dùng, biết cách kết hợp RAG backend với trải nghiệm Frontend linh hoạt (Selection-Scoped RAG) và áp dụng kỷ luật kiểm thử chặt chẽ để đảm bảo chất lượng sản phẩm.
