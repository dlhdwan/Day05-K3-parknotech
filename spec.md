# AI SPEC — VLearn Atomic Micro-Quiz Generator · Nhóm K3-Parknotech (Nhóm 03) · Zone 1
Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở  
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

---

## §1. User & Job

* **Job executor + workflow**:
  * **Người thực hiện**: Học viên đang trong buổi học trực tuyến trên VLearn, vừa đọc xong một trang Slide hoặc vừa nghe giải thích xong một đơn vị kiến thức (Knowledge Component - KC).
  * **Workflow**: `[Học KC / Xem Slide] -> [Bấm 'Kiểm tra nhanh'] -> [Hệ thống gọi RAG lấy Transcript [Txx-NNN] & sinh 3 câu Micro-Quiz] -> [Học viên làm quiz & Client chấm điểm Local tức thì] -> [Xem giải thích + trích dẫn mã đoạn] -> [Nhận diện lỗ hổng & Học tiếp]`.
* **Core JTBD** *(không tên sản phẩm/AI trong câu)*: Tự xác nhận mức độ hiểu bài và phát hiện kịp thời các lỗ hổng kiến thức ngầm ngay sau khi tiếp thu một khái niệm mới trước khi chuyển sang nội dung tiếp theo.
* **Problem statement** *(KHÔNG chữ AI)*: Học viên sau khi đọc tài liệu hoặc nghe bài giảng thường có cảm giác quen mặt chữ nhưng không có cách kiểm chứng cụ thể xem mình thực sự hiểu bản chất hay không, dẫn đến việc mang kiến thức mơ hồ hoặc hiểu sai sang các bài học tiếp theo.
* **Evidence** *(chuẩn A và/hoặc B — log đầy đủ trong repo)*:
  * **Số liệu mining / kết quả khảo sát**:
    * *Quant Mining trên 1.261 lượt hỏi–đáp Chatlog VLearn* (`evidence/cp1-mining.md`): Tutor hiện tại chỉ có **3 lượt đặt câu hỏi kiểm tra** (`asked_check_question=True`, tỉ lệ **0,24%**), chỉ **1 lượt** dùng move `validate_understanding`, và số lượng `misconceptions` ghi nhận là **0**.
    * *Khảo sát thực tế 20 học viên trong lớp* ($N = 20$, `solution_architecture.md` §2.2): **40,0%** (8/20) cảm thấy hiểu nhưng không có cách kiểm chứng cụ thể; **65,0%** (13/20) thiếu thời gian ôn tập do tài liệu dài lan man; **95,0%** (19/20) sẵn sàng tham gia trải nghiệm tính năng kiểm tra ngắn cuối bài.
  * **$\ge 5$ quote / ví dụ nguyên văn + nguồn**:
    1. *"Slide quá dài và nhiều thông tin, không biết nên học thế nào."* — (Nguồn: Khảo sát thực tế học viên trong lớp, $N=20$).
    2. *"Không thể đọc được hết slide và không biết focus vào đâu để học."* — (Nguồn: Khảo sát thực tế học viên trong lớp, $N=20$).
    3. *"Tài liệu dài lan man, hay đọc thừa... tốn rất nhiều thời gian để nhớ bài học."* — (Nguồn: Khảo sát thực tế học viên trong lớp, $N=20$).
    4. `T0397` / `C0198`: Học viên chọn Trang 3 hỏi về "Tool", Tutor giải thích và dẫn trích dẫn nhầm sang **[trang 47]**. — (Nguồn: Chatlog VLearn `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`).
    5. `T1023` / `C0228`: Học viên hỏi *"According to page 43, when to choose AI to support human?"*, Tutor trả lời *"không tìm thấy thông tin cụ thể tại trang 43..."* và không có citation. — (Nguồn: Chatlog VLearn).
    6. `T0157` / `C0413`: Học viên hỏi *"giải thích trang 12"*, Tutor báo không thể truy cập trực tiếp nội dung trang 12 và bảo học viên tự gán từ khóa. — (Nguồn: Chatlog VLearn).

---

## §2. Impact & quyết định chọn

* **Bảng impact $\ge 3$ ứng viên**:

| Ứng viên pain point | Bao nhiêu người / lượt gặp | Tần suất quan sát | Tốn gì mỗi lần | Build trong sự kiện | Quyết định |
|---|---:|---:|---|---|---|
| **Ứng viên 1 (CHỌN): Micro-Quiz kiểm tra hiểu theo đơn vị kiến thức (KC)** | 19/20 học viên khảo sát ($95\%$) & 312/369 học viên chatlog ($84,6\%$) | 100% mỗi khi kết thúc 1 KC bài học | Tốn 2-3 phút tự làm quiz; loại bỏ rủi ro hổng kiến thức ngầm | Có: RAG Transcript + AI Quiz Agent + Local Grading | **CHỌN** |
| **Ứng viên 2: Tutor tự động hỏi ngược kiểm tra sau mỗi câu trả lời** | 1.258/1.261 lượt chat tutor bỏ qua kiểm tra ($99,76\%$) | $0,24\%$ hiện tại | Tốn Quota token (vượt quá 15 calls/ngày), gây phiền nhiễu khi user tra cứu nhanh | Không (gây cháy Quota 15 calls) | **LOẠI ở CP1** |
| **Ứng viên 3: Cảnh báo câu trả lời dài khi prompt học viên ngắn** | 246/451 phản hồi prompt ngắn bị quá dài ($54,5\%$) | $54,5\%$ nhóm prompt ngắn | Tốn thời gian đọc phản hồi lan man | Không (chỉ là proxy ký tự, chưa chứng minh nhu cầu thật) | **LOẠI ở CP1** |

* **Ứng viên ĐÃ LOẠI + vì sao**:
  * *Ứng viên 2 bị loại*: Việc tự động hỏi ngược sau mọi câu trả lời sẽ làm kiệt sức Quota (giới hạn 15 calls/ngày) và tạo cảm giác đường đột, ép buộc đối với học viên khi họ chỉ cần tra cứu thông tin nhanh.
  * *Ứng viên 3 bị loại*: Số lượng ký tự của câu trả lời chỉ là biến đại diện (proxy), chưa giải quyết tận gốc nhu cầu tự đo lường mức độ tiếp thu kiến thức của học viên.
* **Ứng viên CHỌN + vì sao (bằng số)**:
  * Lựa chọn **Ứng viên 1 (Micro-Quiz)** vì đạt tỉ lệ sẵn sàng trải nghiệm lên tới **$95,0\%$ (19/20 học viên khảo sát)**, trực tiếp giải quyết vấn đề cho **$84,6\%$ (312/369)** học viên gặp khó khăn trong việc tự kiểm chứng kiến thức, và tối ưu Quota tuyệt đối khi chỉ gọi AI **1 lần cho 1 batch 3 câu** và thực hiện chấm điểm Local $0$ token.

---

## §3. Giải pháp tương tự đã nghiên cứu

* **[Duolingo End-of-Lesson Quiz]**:
  * *Flow*: Kết thúc mỗi bài học ngắn, hệ thống tự động đưa ra 3-5 câu trắc nghiệm tương tác tức thì.
  * *Đáng học*: Giao diện gọn nhẹ, chấm điểm ngay lập tức, giải thích ngắn gọn khi làm sai.
  * *Đáng né*: Bộ câu hỏi cố định (hardcoded), không có khả năng sinh câu hỏi linh hoạt theo tài liệu thực tế của từng bài học.
  * *Mình khác gì*: AI Agent sinh câu hỏi động bám sát $100\%$ Transcript lời giảng thực tế (`[Txx-NNN]`) của đúng Knowledge Component học viên đang học.
* **[Coursera In-Video Knowledge Check]**:
  * *Flow*: Dừng video bài giảng tại các thời điểm quan trọng để hiển thị 1 câu hỏi kiểm tra nhanh.
  * *Đáng học*: Đúng ngữ cảnh và thời điểm học viên tiếp thu thông tin.
  * *Đáng né*: Đắt đỏ, ngắt ngang dòng suy nghĩ của học viên một cách bị động.
  * *Mình khác gì*: Học viên hoàn toàn chủ động bấm nút "Kiểm tra nhanh" (*Conditional Trigger*), hệ thống trả về trọn gói 3 câu bao quát cả KC kèm trích dẫn chính xác mã transcript.

---

## §4. Thiết kế

* **Lát cắt MỘT CÂU**: *(Khi học viên hoàn thành 1 Knowledge Component trên VLearn · bấm 'Kiểm tra nhanh' · AI Agent gọi RAG lấy Transcript `[Txx-NNN]` sinh 3 câu Micro-Quiz bám chuẩn Bloom Level · Client chấm điểm Local tức thì kèm giải thích và trích dẫn).*
* **Non-goals** *(≥3 thứ KHÔNG build)*:
  1. KHÔNG tự động bật quiz ép buộc sau mọi câu trả lời của Tutor.
  2. KHÔNG sinh bài thi dài, chấm điểm xếp loại chính thức hoặc lưu hồ sơ năng lực tổng thể.
  3. KHÔNG gọi AI riêng cho từng câu hỏi hoặc mỗi lần người dùng chọn/thay đổi đáp án (tất cả xử lý Local 0ms).
  4. KHÔNG dùng thông tin ngoài phạm vi Transcript và Slide của Knowledge Component đang chọn.
* **Mức prototype nhắm tới**: `[ ] Sketch [ ] Mock [x] Working` — Phần Backend RAG + Gemini AI Agent sinh quiz JSON chạy thật $100\%$; phần Frontend React tương tác render & local grading chạy thật $100\%$.
* **Automation**: `[ ] augment [x] conditional [ ] automate` — Lý do: Theo phân tích *Cost-of-error* và giới hạn Quota 15 calls/ngày. AI chỉ sinh quiz khi học viên chủ động bấm nút (*conditional trigger*), giúp tiết kiệm Quota và tránh gây phiền nhiễu.
* **§4b. Nguyên tắc đã áp dụng** *(≥4 — HAX/PAIR)*:

| Nguyên tắc | Áp cụ thể vào đâu trong prototype |
|---|---|
| **HAX G1 (Make clear what the system can do)** | Nút 'Kiểm tra nhanh' ghi rõ "Sinh 3 câu Micro-Quiz kiểm tra KC [Tên KC]" và hiển thị Quota còn lại (ví dụ: 14/15 lượt). |
| **HAX G4 (Show contextually relevant information)** | Nội dung 3 câu hỏi bám sát $100\%$ đúng trang Slide và mã Transcript `[Txx-NNN]` học viên đang xem. |
| **HAX G11 (Make clear why the system did what it did)** | Mọi phản hồi giải thích đáp án đều hiển thị trích dẫn nguyên văn mã đoạn Transcript (ví dụ: `[T04-089]`). |
| **PAIR (User Control & Choice)** | Học viên hoàn toàn chủ động quyết định khi nào làm quiz, có thể đóng quiz hoặc bấm 'Thử lại' bất kỳ lúc nào mà không bị phạt điểm. |

---

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8)

| Lớp rủi ro | Kịch bản lỗi / Tình huống thực tế | Tác động / Hậu quả | Cơ chế kiểm soát & Xử lý (Guardrail) |
|---|---|---|---|
| **① Nguồn sự thật** | AI tự bịa kiến thức ngoài Slide/Transcript (Hallucination - ví dụ TC_002 đòi quiz Reinforcement Learning) | Học viên tiếp thu kiến thức sai lệch không có trong bài học | Ép prompt RAG bám sát $100\%$ Transcript `[Txx-NNN]`; AI từ chối sinh thông tin ngoài phạm vi và nhắc học viên quay lại đúng KC. |
| **① Nguồn sự thật** | AI sinh câu hỏi nhưng quên gắn mã trích dẫn Citation | Học viên không thể đối chiếu lại vị trí bài giảng gốc | Guardrail kiểm tra bắt buộc field `citation` phải chứa mã `[Txx-NNN]`; nếu thiếu sẽ trigger Retry hoặc báo lỗi schema. |
| **② Mơ hồ / Thiếu thông tin** | Trang Slide quá ngắn, chỉ có hình ảnh hoặc tiêu đề cụt (TC_003) | AI không đủ dữ liệu sinh câu hỏi trắc nghiệm chất lượng | RAG Engine tự động truy xuất Transcript lời giảng của giảng viên tương ứng với trang Slide đó làm Ground Truth chính. |
| **② Mơ hồ / Thiếu thông tin** | Prompt học viên nhập mơ hồ ("tạo quiz đi", "cho quiz") | AI sinh quiz ngẫu nhiên không đúng trọng tâm bài học | Backend tự động lấy `slide_page` và `kc_id` hiện tại trên UI để định hướng RAG chuẩn xác. |
| **③ Thẩm quyền / Ngoài scope** | Học viên yêu cầu AI chấm điểm chính thức hoặc dự đoán kết quả thi cuối khóa | Gây tâm lý hoang mang hoặc kỳ vọng sai về điểm số chính thức | System prompt quy định rõ Micro-Quiz chỉ mang tính chất tự đánh giá cá nhân (diagnostic tool), không đại diện cho điểm số chính thức. |
| **③ Thẩm quyền / Ngoài scope** | Học viên yêu cầu AI sinh bài thi 50 câu hoặc đề thi thử toàn bộ chương trình | Gây cháy Quota API (vượt 15 calls) và vỡ định dạng phản hồi | Backend giới hạn cứng `minItems: 3, maxItems: 3` trong JSON Schema; từ chối yêu cầu sinh quá 3 câu. |
| **④ Đặc thù Domain** | Bẫy "đáp án dài nhất luôn đúng" (Option Length Bias - TC_001) | Học viên đoán đáp án dựa vào độ dài thay vì hiểu bản chất | Evaluator kiểm tra chỉ số Option Length Ratio $\le 2.2$. Nếu lệch quá $2.2$ lần, backend kích hoạt Retry để cân bằng lại độ dài 4 phương án. |
| **④ Đặc thù Domain** | AI dùng sai hoặc nhầm lẫn thuật ngữ chuyên ngành (ví dụ nhầm Few-shot là Fine-tuning - TC_001) | Học viên ghi nhớ định nghĩa sai về kỹ thuật AI | Khai báo `forbidden_keywords` trong KC Index (ví dụ: `["fine-tuning", "huấn luyện lại"]` đối với Few-shot) để AI không bị nhầm lẫn. |

---

## §6. Bốn đường đi của trải nghiệm

* **Happy path**: Học viên học xong KC -> Bấm 'Kiểm tra nhanh' -> Hệ thống hiển thị 3 câu trắc nghiệm cân bằng -> Học viên chọn đáp án -> Hệ thống chấm Local ngay lập tức, hiển thị màu Xanh/Đỏ kèm giải thích ngắn và trích dẫn `[Txx-NNN]`.
* **Low-confidence (②)**: Khi Transcript của trang Slide quá ngắn (< 50 từ), RAG Engine tự động mở rộng vùng tìm kiếm sang 2 đoạn Transcript lân cận cùng KC, hiển thị thông báo nhẹ: *"Quiz được tạo bổ sung từ lời giảng chi tiết của giảng viên cho chủ đề này"*.
* **Failure / Không căn cứ (①)**: Nếu trang Slide không tìm thấy Transcript tương ứng trong KC Catalog, hệ thống không gọi AI vô ích mà trả về UI thông báo thân thiện: *"Chưa có dữ liệu lời giảng cho trang này. Vui lòng chọn trang Slide có nội dung bài giảng để tạo quiz"*.
* **Correction (user sửa)**: Khi học viên làm sai một câu, UI cho phép bấm *"Xem giải thích & vị trí bài giảng `[Txx-NNN]`"*, đồng thời cung cấp nút *"Thử lại câu này"* để học viên chọn lại đáp án mà không phát hiện thêm lượt gọi API nào.
* **Khi bị đòi ngoài phạm vi (③)**: Học viên yêu cầu tạo 50 câu hoặc hỏi kiến thức ngoài bài -> AI trả về thông báo ngắn: *"VLearn Micro-Quiz chỉ hỗ trợ sinh 3 câu kiểm tra nhanh cho bài học hiện tại để giúp bạn tập trung và tiết kiệm Quota"*.
* **Case đặc thù domain (④)**: Với các khái niệm dễ nhầm lẫn (Zero-shot vs Few-shot vs RAG), các đáp án nhiễu (distractors) được sinh ra trực tiếp từ danh sách `common_misconceptions` trong KC Index, giúp học viên nhận diện ngay lập tức hiểu sai của mình.

---

## §7. Kiểm thử

* **Chiều chất lượng + định nghĩa kiểm chứng được**:
  1. **Schema Pass Rate ($S_{\text{schema}}$)**: $100\%$ phản hồi tuân thủ đúng JSON Schema (3 câu, mỗi câu 4 options, `correct_index` $\in [0, 3]$, có `explanation` và `citation`).
  2. **Option Length Balance Score ($S_{\text{length}}$)**: Tỉ lệ độ dài ký tự giữa đáp án dài nhất và ngắn nhất $\le 2.2$.
  3. **Citation Accuracy ($S_{\text{citation}}$)**: $100\%$ giải thích có trích dẫn đúng mã đoạn `[Txx-NNN]` trong RAG Context.
  4. **Forbidden Keyword Avoidance ($S_{\text{keyword}}$)**: $0\%$ xuất hiện các từ khóa bị cấm gây nhầm lẫn thuật ngữ.
* **Golden set** *(≥20 case theo cơ cấu trong guide §2.6, file trong `eval/`)*:
  * Đã xây dựng bộ Golden Set đầy đủ **20 test cases** (`TC_001` đến `TC_020` tại `eval/golden_set.json`) bao phủ 4 nhóm kịch bản rủi ro trên 15 Knowledge Components đại diện.
* **Quality bar** *(chốt từ 23:59, giữ nguyên sau đó)*:
  * *"Đạt khi $\ge 85\%$ số case qua bộ Golden Set, $100\%$ đạt Schema Pass Rate & Citation Accuracy, và Option Length Ratio $\le 2.2$."*
* **Kết quả các lượt chạy** *(bảng % — cập nhật đến trước CP6)*:

| Lượt chạy | Thời điểm | Số case | Schema Pass Rate | Citation Accuracy | Length Ratio $\le 2.2$ | Pass Rate Tổng |
|---|---|---:|---:|---:|---:|---:|
| **Lượt 1 (Baseline)** | 16:00 N1 (CP3) | 20 | $100\%$ (20/20) | $100\%$ (20/20) | $100\%$ (20/20) | **$100\%$ (20/20)** |

---

## §8. Phân công & kế hoạch

* **Phân công có tên**:
  * **Đinh Lê Hoàng Danh (Leader - `dlhdwan` / `HoangDanhh`)**: Phụ trách Kiến trúc giải pháp (Solution Architecture), AI Spec, Canvas CP1, Phân tích dữ liệu & Bằng chứng khảo sát.
  * **Nguyễn Văn Hiếu (Mã HV: 2A202601831 - `Hieu31`)**: Phụ trách AI Backend Engine, RAG Pipeline & Context Retrieval, AI Quiz Generator Agent, Prompt Engineering & Tối ưu hóa Backend API.
  * **Lưu Nhân Triệu Dương (Mã HV: 2A202601695 - `duonggoku`)**: Phụ trách Frontend Development (React Components, Micro Quiz Interactivity, Local Grading Engine & Client Quota Management).
  * **Đỗ Ngọc Anh (Mã HV: 2A202601343)**: Phụ trách Đánh giá chất lượng (QA), User Validation CP5, Golden Set Verification, Ghi log phản hồi & Chuẩn bị Demo Slides.
* **Willing users** *(≥3 tên)* + **kế hoạch vòng validation CP5** *(3 câu hỏi, ai log)*:
  * **Willing Users**:
    1. Nguyễn Văn Hiếu (Mã HV: 2A202601831)
    2. Đỗ Ngọc Anh (Mã HV: 2A202601343)
    3. Lưu Nhân Triệu Dương (Mã HV: 2A202601695)
  * **Kế hoạch Validation CP5**:
    * *Câu 1*: "Bài quiz 3 câu này có giúp bạn phát hiện ra chỗ mình chưa hiểu rõ ở trang vừa học không?"
    * *Câu 2*: "Tốc độ phản hồi và việc trích dẫn mã bài giảng `[Txx-NNN]` có giúp bạn dễ tra lại bài không?"
    * *Câu 3*: "Điểm gì ở tính năng này khiến bạn muốn dùng hoặc muốn bỏ qua khi học hàng ngày?"
    * *Người thực hiện & log*: Đỗ Ngọc Anh & Đinh Lê Hoàng Danh ghi log phản hồi vào `validation/user_test_log.md`.
* **Multi-prototype** *(nếu làm)*:
  * **Phương án A (CHỌN)**: Micro-Quiz 3 câu sinh theo batch 1 lần per KC, chấm điểm Local.
  * **Phương án B (Thử nghiệm)**: Chatbot Tutor hỏi từng câu tương tác trực tiếp qua API call.
  * **Lý do chọn Phương án A**: Phương án B tiêu tốn 3-5 API calls cho 1 lần kiểm tra -> nhanh chóng làm kiệt Quota 15 calls/ngày của học viên. Phương án A tối ưu 1 API call per KC và chấm Local 0 token.

---

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| **2026-07-30 10:00 (CP1)** | Chốt Canvas & chọn hướng A (VLearn Micro-Quiz) | Dựa trên bằng chứng mining chatlog 1.261 lượt ($0,24\%$ check questions) |
| **2026-07-30 12:00 (CP2)** | Xây dựng Prototype UI React & Local Grading logic | Tránh lãng phí Quota API 15 calls/ngày theo phản hồi từ Lab Coach |
| **2026-07-30 16:00 (CP3)** | Tích hợp RAG Context `[Txx-NNN]` & Evaluator `Length Ratio <= 2.2` | Khắc phục rủi ro bẫy câu dài nhất đúng (TC_001) & thiếu trích dẫn |
| **2026-07-30 23:59 (CP4)** | Chốt cứng AI Spec v1.0 & Quality Bar 100% Pass | Nộp bài đúng hạn cứng 23:59 N1 theo quy định Hackathon |
