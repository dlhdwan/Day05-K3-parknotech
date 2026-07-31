# Personal Reflection – Đỗ Ngọc Anh

Trong dự án mình phụ trách phần AI Quality Assurance (QA), Golden Set Verification và User Validation.

Phần việc này có mục tiêu là đánh giá xem quiz được sinh ra có thực sự giúp người học xác định mình đã hiểu bài hay chưa.

Từ góc nhìn đó, mình xây dựng framework đánh giá chất lượng đầu ra của AI thay vì chỉ kiểm tra chức năng của hệ thống.

---

## My Contributions

### 1. Xây dựng Evaluation Framework

Mình bắt đầu từ Problem Statement của sản phẩm:

> Sau khi học xong một khái niệm, học viên thường không biết mình đã hiểu thật hay chỉ cảm thấy quen thuộc với nội dung.

Từ problem này, mình xác định các tiêu chí cần đánh giá đối với một AI-generated quiz.

Framework gồm 5 tiêu chí:

- Groundedness
- Correctness
- Citation Accuracy
- Question Quality
- JSON Schema

Điểm mình muốn nhấn mạnh là Question Quality.

Một quiz chỉ hỏi lại định nghĩa hoặc ghi nhớ không chứng minh được người học đã hiểu bài.

Ví dụ:

Tài liệu:

> Gradient Descent cập nhật trọng số.

Một câu hỏi như:

> Gradient Descent viết tắt là gì?

không giúp đánh giá mức độ hiểu.

Trong khi câu hỏi:

> Điều gì xảy ra nếu learning rate quá lớn?

buộc người học phải vận dụng kiến thức đã học.

Điều này giúp framework bám sát mục tiêu của sản phẩm thay vì chỉ đánh giá định dạng đầu ra.

---

### 2. Thiết kế Golden Set

Sau khi xác định các metric, mình tham gia xây dựng Golden Set để kiểm tra chất lượng AI.

Các test case tập trung vào những tình huống dễ xảy ra lỗi như:

- Hallucination
- Ngoài phạm vi bài học
- Citation sai
- Misconception
- Option Length Bias

Golden Set giúp nhóm đánh giá AI một cách nhất quán thay vì chỉ kiểm thử thủ công.

---

### 3. Validation

Mình tham gia kiểm tra xem output của AI có đáp ứng đúng các tiêu chí đã đặt ra hay không.

Đặc biệt mình tập trung vào:

- AI có bám đúng transcript.
- Explanation có citation chính xác.
- Quiz có thực sự kiểm tra sự hiểu thay vì kiểm tra ghi nhớ.

---

## AI Supported My Work

Trong quá trình thực hiện dự án, mình sử dụng ChatGPT như một công cụ hỗ trợ tư duy và rà soát thiết kế.

AI hỗ trợ mình ở các công việc như:

- Brainstorm evaluation metrics.
- Gợi ý các edge cases cho AI evaluation.
- Kiểm tra tính đầy đủ của QA workflow.

Tuy nhiên, mình không sử dụng AI để thay thế việc ra quyết định.

Mọi metric, test case và kết luận cuối cùng đều được mình xem xét lại dựa trên mục tiêu của sản phẩm và thảo luận cùng nhóm.

---

## A Failure Case

Một bài học lớn của mình là ban đầu mình tập trung quá nhiều vào các tiêu chí kỹ thuật như:

- JSON đúng
- Citation đúng
- Đáp án đúng

Mình nhận ra rằng một quiz có thể đạt tất cả các tiêu chí trên nhưng vẫn không giúp người học đánh giá được mức độ hiểu bài.

Ví dụ:

Nếu tài liệu nói về Gradient Descent nhưng AI chỉ hỏi:

> Gradient Descent viết tắt là gì?

thì quiz vẫn đúng nội dung nhưng gần như không tạo ra giá trị học tập.

Sau khi trao đổi với nhóm, mình bổ sung thêm tiêu chí **Question Quality** để đánh giá xem câu hỏi có thực sự yêu cầu người học vận dụng kiến thức hay không.

Đây là thay đổi quan trọng nhất trong phần QA của mình.

---

## Lessons Learned

Qua dự án này mình nhận ra rằng đánh giá AI không chỉ là kiểm tra đúng hay sai.

Điều quan trọng hơn là xác định đúng mục tiêu của sản phẩm trước khi xây dựng metric đánh giá.

Nếu metric không phản ánh đúng problem ban đầu thì AI có thể đạt điểm rất cao nhưng vẫn không giải quyết được nhu cầu của người dùng.

Mình cũng học được cách chuyển từ tư duy kiểm thử phần mềm truyền thống sang tư duy đánh giá chất lượng của hệ thống Generative AI, trong đó cần quan tâm đến grounding, hallucination, citation và giá trị thực sự của output đối với người dùng.

Đây là bài học mình sẽ tiếp tục áp dụng trong các dự án AI sau này.