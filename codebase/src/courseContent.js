export const courseModules = [
  {
    id: 'day-1',
    title: 'Day 01',
    status: 'STUDYING',
    files: [
      {
        id: 'd1-slide-hackathon',
        title: 'd1-slide-hackathon.pdf',
        totalPages: 83,
      },
    ],
  },
  {
    id: 'day-2',
    title: 'Day 02',
    status: '',
    files: [
      {
        id: 'd2-slide-hackathon',
        title: 'd2-slide-hackathon.pdf',
        totalPages: 64,
      },
    ],
  },
  {
    id: 'day-3',
    title: 'Day 03',
    status: '',
    files: [
      {
        id: 'day03-tu-chatbot',
        title: 'day03-tu-chatbot-den-agentic-agent-react-v7.pdf',
        totalPages: 40,
      },
    ],
  },
  {
    id: 'day-4',
    title: 'Day 04',
    status: '',
    files: [
      {
        id: 'day04-prompt-engineering',
        title: 'day04-prompt-engineering-tool-calling.pdf',
        totalPages: 50,
      },
    ],
  },
];

export const defaultFile = courseModules[0].files[0];

export const knowledgeComponentsByFile = {
  'day04-prompt-engineering': [
    { kcId: 'KC_PROMPT_STRUCTURE_01', title: 'Cấu trúc Prompt Chuẩn', startPage: 10, endPage: 10 },
    { kcId: 'KC_ZERO_SHOT_01', title: 'Zero-shot Prompting', startPage: 12, endPage: 13 },
    { kcId: 'KC_FEW_SHOT_01', title: 'Few-shot Prompting', startPage: 14, endPage: 15 },
    { kcId: 'KC_COT_01', title: 'Chain-of-Thought Prompting', startPage: 16, endPage: 17 },
    { kcId: 'KC_TEMPERATURE_01', title: 'Model Temperature & Top-p', startPage: 19, endPage: 19 },
    { kcId: 'KC_RAG_01', title: 'Retrieval-Augmented Generation (RAG)', startPage: 20, endPage: 22 },
    { kcId: 'KC_RAG_01', title: 'Retrieval-Augmented Generation (RAG)', startPage: 45, endPage: 45 },
    { kcId: 'KC_EVALUATION_METRICS_01', title: 'Metrics Đánh giá', startPage: 50, endPage: 50 },
  ],
  'd2-slide-hackathon': [
    { kcId: 'KC_ATTENTION_01', title: 'Cơ chế Attention', startPage: 28, endPage: 28 },
    { kcId: 'KC_TRANSFORMER_ENCODER_01', title: 'Transformer Encoder', startPage: 32, endPage: 32 },
  ],
};

export function getKnowledgeComponentForPage(fileId, pageNumber) {
  const page = Number(pageNumber);
  if (!fileId || !Number.isFinite(page)) return null;

  const fileComponents = knowledgeComponentsByFile[fileId] || [];
  const match = fileComponents.find(
    (component) => page >= component.startPage && page <= component.endPage,
  );

  return match ? { ...match, fileId } : null;
}
