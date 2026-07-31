export const selectionToolbarActions = [
  { id: 'ask-ai', label: 'Hỏi AI', uiOnly: false },
  { id: 'generate-quiz', label: 'Tạo quiz', uiOnly: false },
];

export function buildSelectionQuizPrompt(selectedText) {
  const text = selectedText?.trim() || '';
  return `Tạo micro-quiz dựa trên đúng đoạn được chọn dưới đây. Chỉ dùng đoạn được chọn và bằng chứng liên quan trong bài học hiện tại; không mở rộng sang chủ đề ngoài đoạn này.\n\nĐoạn được chọn:\n"""${text}"""`;
}

export function buildSelectionAskPrompt(selectedText) {
  const text = selectedText?.trim() || '';
  return `Giải thích đoạn được chọn dưới đây bằng ngôn ngữ dễ hiểu, dựa trên bài học hiện tại và các tài liệu đã nạp trong hệ thống.\n\nĐoạn được chọn:\n"""${text}"""`;
}

export function createSelectionToolbarState({ text, rect, isInsideViewer }) {
  const selectedText = text?.trim() || '';
  if (!selectedText || !isInsideViewer || !rect) return null;

  return {
    text: selectedText,
    top: rect.top - 45,
    left: rect.left + (rect.width / 2),
  };
}
