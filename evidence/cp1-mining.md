# Evidence CP1 — VLearn Tutor: câu trả lời không kiểm chứng được theo trang đang chọn

## Phạm vi và phương pháp đếm

- Nguồn: `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`.
- Đơn vị phân tích: một `turn_id` đủ một tin `student` và một tin `tutor`.
- Tổng mẫu: 1.261 lượt hỏi–đáp, 369 học viên ẩn danh, 585 hội thoại.
- “Lượt có trang đang chọn”: tin học viên bắt đầu bằng metadata `(Trang N, ...)`; có 1.252 lượt.
- “Không có trích dẫn kiểm chứng được về đúng trang đang chọn” gồm:
  1. `citations=[]`; hoặc
  2. `citations` có số trang nhưng không chứa `N` trong `(Trang N, ...)`.
- “Báo lỗi truy xuất”: phản hồi tutor chứa một trong các mẫu diễn đạt đã khai báo trong script như “không tìm thấy”, “không thể truy cập/truy xuất”, “không có dữ liệu”, “không hiển thị”, “chưa tìm thấy”.
- Chạy lại: `python3 evidence/mine_cp1.py`.

Giới hạn cần lưu ý: số trang trong metadata UI và số trang ở hệ thống retrieval có thể dùng hai cách đánh số khác nhau. Vì vậy chỉ số 64,9% được diễn giải thận trọng là **học viên không thể kiểm chứng câu trả lời về đúng trang họ đang nhìn**, không khẳng định cả 812 câu đều sai kiến thức.

## Kết quả ban đầu

| Signal | Kết quả |
|---|---:|
| Lượt có metadata trang | 1.252/1.261 |
| Không có citation nào | 573/1.252 (45,8%) |
| Có citation nhưng không chứa trang đang chọn | 239/1.252 (19,1%) |
| Không kiểm chứng được về đúng trang đang chọn | **812/1.252 (64,9%)** |
| Học viên gặp ít nhất một lượt như trên | **312/369 (84,6%)** |
| Phản hồi báo không tìm/truy cập được nội dung | 205/1.252 (16,4%) |

## Ví dụ nguyên văn rút gọn

Các trích đoạn dưới đây được giữ ngắn theo quy định bảo mật; mã turn/conversation cho phép kiểm lại trong data pack.

1. `T0397` / `C0198`: học viên chọn **Trang 3**, hỏi về “Tool”; tutor giải thích và dẫn **[trang 47]**.
2. `T1084` / `C0266`: học viên yêu cầu “Giải thích slide 4”; tutor mở đầu “Slide 4 **[trang 70]** giải thích...”
3. `T1211` / `C0327`: học viên chọn **Trang 75**, hỏi slide tổng quan deliverables; tutor dẫn **[trang 4, 62]**.
4. `T1023` / `C0228`: học viên hỏi “According to page 43, when to choose AI to support human?”; tutor trả lời “không tìm thấy thông tin cụ thể tại trang 43...” và không có citation.
5. `T1258` / `C0076`: học viên chọn **Trang 33**, yêu cầu “tóm tắt slide này”; tutor nói chưa tìm thấy trang 33 và trả về kết quả có số 33 ở trang 60/72, không có citation.
6. `T0157` / `C0413`: học viên hỏi “giải thích trang 12”; tutor nói không thể truy cập trực tiếp nội dung trang 12 và yêu cầu học viên tự cung cấp thêm từ khóa.

## So sánh impact của ba ứng viên

| Ứng viên pain | Bao nhiêu người/lượt gặp | Tần suất quan sát | Tốn gì mỗi lần | Build trong sự kiện | Quyết định |
|---|---:|---:|---|---|---|
| Giải thích không kiểm chứng được theo trang đang chọn | 312/369 người; 812/1.252 lượt có trang | 64,9% lượt có trang | Phải tự dò lại nguồn; có nguy cơ học sai và mất niềm tin | Có: retrieval + confidence gate + citation | **Chọn** |
| Tutor gần như không kiểm tra người học đã hiểu | 3/1.261 lượt có `asked_check_question=True` | Chỉ 0,24% lượt có check question | Lỗ hổng hiểu bài có thể không bị phát hiện | Có, nhưng chưa có signal trực tiếp rằng user muốn được kiểm tra | Loại ở CP1 |
| Câu hỏi ngắn nhận câu trả lời quá dài | 451 lượt có prompt ≤80 ký tự; 246/451 phản hồi >500 ký tự | 54,5% nhóm prompt ngắn | Tốn thời gian đọc trong buổi học | Có, nhưng ngưỡng ký tự mới là proxy, chưa chứng minh “quá dài” với user | Loại ở CP1 |

## Giả định nguy hiểm nhất cần kiểm tiếp

Học viên thực sự ưu tiên một câu giải thích ngắn, bám nguồn và kiểm chứng được hơn một câu trả lời rộng nhưng có vẻ hữu ích. Cần xác nhận bằng phỏng vấn “lần gần nhất” và user test; không hỏi dẫn dắt kiểu “bạn có thích citation không?”.

