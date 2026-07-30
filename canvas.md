# CP1 · Chốt Canvas — Kiểm tra hiểu nhanh sau một phần học

1. **Hướng:** A — VLearn · tính năng mới bổ sung cho tutor: micro-quiz theo yêu cầu sau khi học viên học xong một đoạn/chủ đề.
2. **Job executor:** Học viên đang trong buổi học, vừa đọc hoặc vừa được giải thích một khái niệm và muốn kiểm tra mình đã hiểu đúng trước khi học tiếp.
3. **Pain một câu — giả thuyết cần xác nhận:** Sau khi đọc lời giải hoặc tài liệu, học viên không có cách nhanh để biết mình đã nắm được ý chính hay chỉ thấy nội dung quen thuộc, nên có thể mang lỗ hổng kiến thức sang phần học tiếp theo.
4. **Bằng chứng ban đầu và giới hạn:** Trong 1.261 lượt hỏi–đáp, tutor chỉ có 3 lượt đặt câu hỏi kiểm tra hiểu (`asked_check_question=True`, 0,24%), chỉ 1 lượt dùng move `validate_understanding`, còn `misconceptions` không được ghi nhận ở lượt nào; các số này chứng minh tutor hiện tại gần như không đóng vòng “giải thích → kiểm tra → phát hiện lỗ hổng”, **nhưng chưa chứng minh học viên muốn quiz hoặc quiz là giải pháp tốt nhất**.
5. **Lát cắt MỘT CÂU:** Một học viên vừa học xong một phần tài liệu · chọn kiểm tra nhanh · AI quyết định ba câu hỏi nào có thể phân biệt hiểu ý chính với chỉ nhớ mặt chữ · tạo một micro-quiz có đáp án, giải thích và nguồn để học viên nhận ra lỗ hổng trước khi học tiếp.
6. **Automation + quota + willing users dự kiến:** **Conditional/Augment** — một AI call sinh theo batch 3 câu trắc nghiệm kèm đáp án, giải thích và citation; hệ thống chấm local, chỉ gọi thêm khi học viên chủ động yêu cầu giải thích chỗ sai, phù hợp giới hạn 15 lượt và giảm cost-of-error. Willing users dự kiến: **[Tên HV 1]**, **[Tên HV 2]**, **[Tên HV 3]** — cần hỏi về hành vi lần gần nhất và xin đồng ý thử trước khi show CP1.

## Điều Canvas này đang khẳng định và chưa khẳng định

### Đã có bằng chứng

- Tutor hiện tại gần như không kiểm tra học viên đã hiểu sau khi giải thích.
- Flow hiện tại gần như không phát hiện hoặc ghi nhận misconception.
- Cần tránh thiết kế hỏi ngược sau mọi câu trả lời vì quota chỉ có 15 lượt.

### Chưa có bằng chứng — phải validate

- Học viên có thường xuyên không chắc mình đã hiểu hay không.
- Học viên có thực sự làm một quiz 3 câu khi đang học hay không.
- Quiz có hiệu quả hơn tự diễn đạt, flashcard hoặc một câu hỏi kiểm tra duy nhất hay không.
- Ba câu là độ dài phù hợp và một AI call/quiz có được tính vào quota như giả định hay không.

## Product hypothesis

Nếu cho học viên vừa học xong một phần tài liệu chủ động mở một micro-quiz 3 câu được sinh theo batch và chấm local, họ sẽ phát hiện được phần chưa hiểu trước khi học tiếp mà không tiêu hao nhiều quota, vì một lần kiểm tra ngắn tạo tín hiệu cụ thể hơn cảm giác “mình đọc thấy quen”.

## Kế hoạch tìm evidence cho solution

Không mở đầu bằng câu “Bạn có cần tính năng quiz không?”. Hỏi ít nhất 20 học viên ngoài nhóm về hành vi thật:

1. “Lần gần nhất bạn đọc xong một khái niệm nhưng không chắc đã hiểu, bạn đã làm gì?”
2. “Bạn kiểm tra mình hiểu bằng cách nào, mất bao lâu, và lần đó có bỏ qua không?”
3. Sau khi nghe câu trả lời hành vi: “Nếu có kiểm tra nhanh 3 câu ngay tại phần đang học, điều gì khiến bạn dùng hoặc bỏ qua?”

Điều kiện tiếp tục solution hypothesis: ít nhất 10/20 người xác nhận từng gặp tình huống không chắc đã hiểu và có nhu cầu kiểm tra trước khi học tiếp; lưu nguyên văn toàn bộ câu hỏi, từng câu trả lời và danh tính theo yêu cầu evidence đường A.

## Non-goals của prototype

- Không tự động bật quiz sau mọi câu trả lời của tutor.
- Không sinh đề thi dài, chấm điểm chính thức hoặc dự đoán năng lực tổng thể.
- Không dùng câu hỏi ngoài phần tài liệu học viên vừa chọn.
- Không gọi AI riêng cho từng câu trắc nghiệm hoặc mỗi lần chọn đáp án.
- Không kết luận “đã hiểu” từ một điểm số duy nhất; chỉ chỉ ra câu đúng/sai và phần tài liệu cần xem lại.
