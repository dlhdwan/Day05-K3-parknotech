export const courseModules = [
  {
    id: 'day-1',
    title: 'Day 1',
    status: 'STUDYING',
    files: [
      {
        id: 'day01_302',
        title: 'day01_302.pdf',
        totalPages: 83,
        lessons: [
          {
            id: 'zero-shot',
            title: 'Zero-shot Prompting',
            slidePage: 12,
            kcId: 'KC_ZERO_SHOT_01',
            summary: 'Yêu cầu trực tiếp cho mô hình AI mà không cung cấp ví dụ mẫu.',
            transcriptRefs: ['T04-068', 'T04-089'],
          },
          {
            id: 'few-shot',
            title: 'Few-shot Prompting',
            slidePage: 14,
            kcId: 'KC_FEW_SHOT_01',
            summary: 'Cung cấp ví dụ mẫu trong prompt để định hướng mô hình.',
            transcriptRefs: ['T04-089'],
          },
          {
            id: 'chain-of-thought',
            title: 'Chain-of-Thought Prompting',
            slidePage: 16,
            kcId: 'KC_COT_01',
            summary: 'Yêu cầu mô hình suy luận từng bước trước khi đưa ra đáp án.',
            transcriptRefs: ['T04-007', 'T06-051'],
          },
          {
            id: 'temperature',
            title: 'Model Temperature & Top-p',
            slidePage: 19,
            kcId: 'KC_TEMPERATURE_01',
            summary: 'Điều chỉnh mức ngẫu nhiên và ổn định của câu trả lời.',
            transcriptRefs: ['T04-071', 'T04-072', 'T06-136'],
          },
          {
            id: 'rag',
            title: 'Retrieval-Augmented Generation (RAG)',
            slidePage: 20,
            kcId: 'KC_RAG_01',
            summary: 'Kết hợp retrieval với generation để giảm hallucination.',
            transcriptRefs: ['T06-139'],
          },
        ],
      },
    ],
  },
  {
    id: 'day-2',
    title: 'Day 2',
    status: '',
    files: [
      {
        id: 'day02',
        title: 'd2-slide-hackathon.pdf',
        totalPages: 64,
        lessons: [
          {
            id: 'attention',
            title: 'Cơ chế Attention',
            slidePage: 28,
            kcId: 'KC_ATTENTION_01',
            summary: 'Cơ chế giúp mô hình tập trung vào phần quan trọng của chuỗi đầu vào.',
            transcriptRefs: ['T06-126', 'T06-130'],
          },
          {
            id: 'transformer-encoder',
            title: 'Transformer Encoder',
            slidePage: 32,
            kcId: 'KC_TRANSFORMER_ENCODER_01',
            summary: 'Khối encoder xử lý đầu vào và trích xuất đặc trưng ngữ cảnh.',
            transcriptRefs: ['T06-076', 'T06-081'],
          },
        ],
      },
    ],
  },
];

export const defaultLesson = courseModules[0].files[0].lessons[1];
