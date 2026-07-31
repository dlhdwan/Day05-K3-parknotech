import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  FileText,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

import { apiClient, getSlideUrl } from './api.js';
import { courseModules, defaultFile, getKnowledgeComponentForPage } from './courseContent.js';
import {
  buildSelectionAskPrompt,
  buildSelectionQuizPrompt,
  createSelectionToolbarState,
} from './selectionToolbar.js';
import {
  calculateQuizResult,
  describeQuizError,
  extractRequestedQuestionCount,
  shouldAppendCitation,
} from './quizUtils.js';
import { getQuotaState, recordQuizGeneration, todayKey } from './quota.js';

function getBrowserStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

const CHAT_STORAGE_KEY = 'vlearn-chat-history-v1';
const MAX_STORED_MESSAGES = 40;
const MAX_MEMORY_MESSAGES = 10;
const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'tutor',
  text: 'Chào bạn! Tôi là VLearn Tutor, trợ lý học tập AI của bạn. Bạn có thể hỏi tôi bất kỳ khái niệm nào trong bài học, hoặc yêu cầu tôi tạo bài tập ôn tập (micro-quiz) khi bạn đã sẵn sàng nhé!',
  isQuizTrigger: false,
};

function createMessage(role, text, extra = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    role,
    text,
    createdAt: new Date().toISOString(),
    isQuizTrigger: false,
    ...extra,
  };
}

function loadStoredMessages() {
  const storage = getBrowserStorage();
  if (!storage) return [WELCOME_MESSAGE];

  try {
    const messages = JSON.parse(storage.getItem(CHAT_STORAGE_KEY));
    return Array.isArray(messages) && messages.length ? messages : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function toChatHistory(messages) {
  return messages
    .filter((message) => message.id !== 'welcome' && !message.isQuizTrigger)
    .slice(-MAX_MEMORY_MESSAGES)
    .map((message) => ({
      role: message.role === 'tutor' ? 'assistant' : 'user',
      content: message.text,
    }));
}

function buildQuizConversationContext(messages) {
  return toChatHistory(messages)
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'Học viên' : 'VLearn Tutor'}: ${message.content}`)
    .join('\n');
}

function buildQuizLearningContext(messages, file, currentPage, knowledgeComponent) {
  const learningContext = [
    `Current file_id: ${file?.id || 'unknown'}`,
    `Current file_title: ${file?.title || 'unknown'}`,
    `Current slide_page: ${currentPage || 'unknown'}`,
  ];

  if (knowledgeComponent) {
    learningContext.push(`Current KC ID: ${knowledgeComponent.kcId}`);
    learningContext.push(`Current KC Title: ${knowledgeComponent.title}`);
  }

  const conversationContext = buildQuizConversationContext(messages);
  if (conversationContext) {
    learningContext.push(`Recent conversation:\n${conversationContext}`);
  }

  return learningContext.join('\n');
}

function CitationModal({ activeCitation, onClose }) {
  const [loading, setLoading] = useState(false);
  const [detailText, setDetailText] = useState('');

  useEffect(() => {
    if (!activeCitation) return;
    const cid = typeof activeCitation === 'string' ? activeCitation : activeCitation.id;
    const initialText = typeof activeCitation === 'object' ? activeCitation.text : '';

    if (initialText && initialText !== 'Nội dung thuộc bài giảng gốc') {
      setDetailText(initialText);
      setLoading(false);
      return;
    }

    const cleanId = cid.replace(/[\[\]]/g, '');
    setLoading(true);
    apiClient.getTranscript(cleanId)
      .then((res) => {
        if (res?.text) setDetailText(res.text);
        else setDetailText('Không tìm thấy dữ liệu đoạn trích này trong kho bài giảng.');
      })
      .catch(() => {
        setDetailText('Không thể lấy được dữ liệu trích dẫn.');
      })
      .finally(() => setLoading(false));
  }, [activeCitation]);

  if (!activeCitation) return null;
  const citationId = typeof activeCitation === 'string' ? activeCitation : activeCitation.id;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content citation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileText size={18} className="modal-icon" />
            <span>Trích dẫn nguyên văn bài giảng gốc: <strong>{citationId}</strong></span>
          </div>
          <button className="icon-btn" onClick={onClose} type="button" title="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Đang tải trích đoạn bài giảng...</div>
          ) : (
            <div className="citation-quote-box">
              <span className="quote-badge">{citationId}</span>
              <p className="quote-text">"{detailText}"</p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose} type="button">Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  );
}

function processChildrenForCitations(children, onOpenCitation) {
  if (!children) return children;
  if (typeof children === 'string') {
    const regex = /(\[T\d{2}-\d{3}\]|\[[\w\.-]+\.pdf\s*-\s*(?:Page\s*)?\d+\])/gi;
    const parts = children.split(regex);
    if (parts.length === 1) return children;
    return parts.map((part, idx) => {
      if (/^\[(T\d{2}-\d{3}|[\w\.-]+\.pdf\s*-\s*(?:Page\s*)?\d+)\]$/i.test(part)) {
        return (
          <button
            key={idx}
            className="citation-badge-link"
            onClick={() => onOpenCitation(part)}
            type="button"
            title={`Bấm để xem trích dẫn nguyên văn ${part}`}
          >
            🏷️ {part}
          </button>
        );
      }
      return part;
    });
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <span key={i}>{processChildrenForCitations(child, onOpenCitation)}</span>
    ));
  }
  return children;
}

function CourseSidebar({ selectedFileId, onSelectFile }) {
  return (
    <aside className="left-sidebar">
      <div className="sidebar-header">
        <FileText size={18} /> Học liệu môn học
      </div>
      <div className="module-list">
        {courseModules.map((module) => (
          <div className="module-item" key={module.id}>
            <div className="module-title">
              <ChevronDown size={16} />
              <span>{module.title}</span>
              {module.status && <span className="badge">{module.status}</span>}
            </div>
            {module.files.map((file) => (
              <div className="module-files" key={file.id}>
                <button
                  className={`file-item ${selectedFileId === file.id ? 'active' : ''}`}
                  onClick={() => onSelectFile(file)}
                  type="button"
                >
                  <FileText size={15} /> <strong>{file.title}</strong>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function DocumentViewer({
  file,
  currentPage,
  setCurrentPage,
  quota,
  onGenerateQuiz,
  isGenerating,
  onAskAI,
  currentKnowledgeComponent,
}) {
  const [selection, setSelection] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(900);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const pageRefs = useRef([]);
  const renderedPageWidth = Math.round(pageWidth * zoom);
  const zoomPercent = Math.round(zoom * 100);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  useEffect(() => {
    setNumPages(null);
    setZoom(1);
    pageRefs.current = [];
    containerRef.current?.scrollTo({ top: 0 });
  }, [file.id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updatePageWidth = () => {
      const horizontalPadding = window.innerWidth <= 900 ? 32 : 64;
      setPageWidth(Math.min(900, Math.max(280, container.clientWidth - horizontalPadding)));
    };

    updatePageWidth();
    const resizeObserver = new ResizeObserver(updatePageWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePage = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visiblePage) {
          setCurrentPage(Number(visiblePage.target.dataset.pageNumber));
        }
      },
      { root: container, threshold: [0.35, 0.55, 0.75] },
    );

    pageRefs.current.slice(0, numPages).forEach((page) => {
      if (page) observer.observe(page);
    });

    return () => observer.disconnect();
  }, [numPages, setCurrentPage]);

  const goToPage = (pageNumber) => {
    const nextPage = Math.min(Math.max(pageNumber, 1), numPages || 1);
    pageRefs.current[nextPage - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const zoomOut = () => setZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))));
  const zoomIn = () => setZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))));
  const resetZoom = () => setZoom(1);

  useEffect(() => {
    const handleSelection = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      const text = activeSelection.toString().trim();
      if (text.length === 0) {
        setSelection(null);
        return;
      }

      if (containerRef.current && containerRef.current.contains(activeSelection.anchorNode)) {
        const range = activeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelection(createSelectionToolbarState({
          text,
          rect,
          isInsideViewer: true,
        }));
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  return (
    <>
      <div className="pdf-toolbar" aria-label="Công cụ xem PDF">
        <div className="pdf-toolbar-main">
          <div className="pdf-toolbar-title" title={file.title}>
            <FileText size={16} />
            <span>{file.title}</span>
          </div>
          <span className="toolbar-text">Slide {currentPage}{numPages ? ` / ${numPages}` : ''}</span>
          <span className={`kc-chip ${currentKnowledgeComponent ? 'mapped' : ''}`}>
            {currentKnowledgeComponent?.title || 'Chưa map KC'}
          </span>
        </div>
        <div className="pdf-toolbar-actions">
          <button
            className="icon-btn"
            disabled={zoom <= 0.6}
            onClick={zoomOut}
            title="Thu nhỏ"
            type="button"
          >
            <ZoomOut size={17} />
          </button>
          <button className="tb-btn zoom-reset" onClick={resetZoom} type="button">
            {zoomPercent}%
          </button>
          <button
            className="icon-btn"
            disabled={zoom >= 1.8}
            onClick={zoomIn}
            title="Phóng to"
            type="button"
          >
            <ZoomIn size={17} />
          </button>
          <span className="divider" />
          <button
            className="btn-primary toolbar-quiz-btn"
            disabled={quota.exhausted || isGenerating}
            onClick={() => onGenerateQuiz()}
            type="button"
          >
            <Sparkles size={15} /> Tạo quiz
          </button>
        </div>
      </div>
      <div className="pdf-content" ref={containerRef}>
        <Document
          key={file.id}
          file={getSlideUrl(file.title)}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading"><div className="loading-dots"><span /><span /><span /></div><span>Đang tải slide...</span></div>}
          className="react-pdf-document"
        >
          {numPages && Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <div
                className="pdf-page slide-theme"
                data-page-number={pageNumber}
                key={pageNumber}
                ref={(element) => { pageRefs.current[index] = element; }}
              >
                <span className="slide-page-label">Slide {pageNumber}</span>
                <Page
                  pageNumber={pageNumber}
                  width={renderedPageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="react-pdf-page"
                />
              </div>
            );
          })}
        </Document>

        {numPages && (
          <div className="pdf-pager" aria-label="Điều hướng slide">
            <button type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)} aria-label="Slide trước">
              <ChevronLeft size={18} />
            </button>
            <span>{currentPage} / {numPages}</span>
            <button type="button" disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)} aria-label="Slide sau">
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {selection && (
          <div
            className="selection-popup selection-toolbar"
            style={{ top: `${selection.top}px`, left: `${selection.left}px` }}
            role="toolbar"
            aria-label="Công cụ thao tác với đoạn text đã chọn"
            onClickCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDownCapture={(event) => event.preventDefault()}
          >
            <button
              type="button"
              className="popup-btn primary"
              onClick={() => {
                onGenerateQuiz({
                  selectedText: selection.text,
                  userPrompt: buildSelectionQuizPrompt(selection.text),
                });
                window.getSelection().removeAllRanges();
                setSelection(null);
              }}
            >
              <Sparkles size={14} /> Tạo quiz
            </button>
            <button
              type="button"
              className="popup-btn outline"
              onClick={() => {
                onAskAI(selection.text);
                window.getSelection().removeAllRanges();
                setSelection(null);
              }}
            >
              <Bot size={14} /> Hỏi AI
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function QuizSlide({
  onBack,
  onRetry,
  quiz,
  loading,
  error,
  guardrailWarnings,
  onOpenCitation,
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState({});

  useEffect(() => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setSubmittedQuestions({});
  }, [quiz]);

  if (loading) {
    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
          <button className="btn-outline" onClick={onBack} type="button"><ArrowLeft size={16} /> Quay lại tài liệu</button>
          <span className="quiz-slide-title"><Sparkles size={16} /> Đang tạo quiz từ AI...</span>
        </div>
        <div className="state-panel">
          <div className="loading-dots"><span /><span /><span /></div>
          <p>Đang gọi RAG Agent và kiểm tra guardrail.</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorDetails = describeQuizError(error);

    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
          <button className="btn-outline" onClick={onBack} type="button"><ArrowLeft size={16} /> Quay lại tài liệu</button>
          <span className="quiz-slide-title"><Sparkles size={16} /> Không tạo được quiz</span>
        </div>
        <div className="state-panel error">
          <strong>{errorDetails.title}</strong>
          <p>{error}</p>
          <span className="state-hint">{errorDetails.action}</span>
          <div className="state-actions">
            <button className="btn-secondary" onClick={onBack} type="button">Quay lại</button>
            <button className="btn-primary" onClick={onRetry} type="button">Thử lại</button>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz?.questions?.length) {
    return (
      <div className="quiz-slide-container">
        <div className="state-panel">
          <p>Chưa có quiz cho bài học này.</p>
          <button className="btn-primary" onClick={onRetry} type="button">Tạo quiz</button>
        </div>
      </div>
    );
  }

  const questions = quiz.questions;
  const question = questions[currentQuestion];
  const hasAnsweredCurrent = answers[currentQuestion] !== undefined;
  const isCorrect = answers[currentQuestion] === question.correct_index;
  const isSubmitted = submittedQuestions[currentQuestion];

  const retryCurrentQuestion = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion];
      return next;
    });
    setSubmittedQuestions((prev) => {
      const next = { ...prev };
      delete next[currentQuestion];
      return next;
    });
  };

  const resetQuiz = () => {
    setAnswers({});
    setSubmittedQuestions({});
    setCurrentQuestion(0);
    setShowResults(false);
  };

  if (showResults) {
    const result = calculateQuizResult(questions, answers);

    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
          <button className="btn-outline" onClick={onBack} type="button"><ArrowLeft size={16} /> Quay lại bài giảng</button>
          <span className="quiz-slide-title"><Sparkles size={16} /> Kết quả kiểm tra nhanh</span>
        </div>
        <div className="quiz-results-large">
          <div className="score-circle-large" style={{ '--score': `${result.percent * 3.6}deg` }}>
            <span>{result.score}/{result.total}</span>
          </div>
          <h2>{result.score === result.total ? 'Nắm chắc kiến thức' : 'Đã hoàn thành'}</h2>
          <p>{quiz.kc_title}</p>
          <div className="result-actions">
            <button className="btn-secondary" onClick={resetQuiz} type="button">Làm lại</button>
            <button className="btn-primary" onClick={onBack} type="button">Tiếp tục học</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-slide-container">
      <div className="quiz-slide-header">
        <button className="btn-outline" onClick={onBack} type="button"><ArrowLeft size={16} /> Quay lại tài liệu</button>
        <span className="quiz-slide-title">
          <Sparkles size={16} /> {quiz.kc_title} ({currentQuestion + 1}/{questions.length})
        </span>
      </div>
      {guardrailWarnings.length > 0 && (
        <div className="guardrail-banner">
          <strong>
            {guardrailWarnings.some((warning) => /transcript|context|low/i.test(warning))
              ? 'Quiz được tạo với ngữ cảnh bổ sung'
              : 'Guardrail diagnostics'}
          </strong>
          <span>{guardrailWarnings.join('; ')}</span>
        </div>
      )}
      <div className="quiz-slide-body">
        <h2 className="quiz-slide-question">{question.prompt}</h2>
        <div className="quiz-slide-options">
          {question.options.map((option, index) => {
            let className = 'quiz-slide-option';
            if (isSubmitted) {
              if (index === question.correct_index) className += ' correct';
              else if (index === answers[currentQuestion]) className += ' incorrect';
            } else if (answers[currentQuestion] === index) {
              className += ' selected';
            }

            return (
              <button
                className={className}
                disabled={isSubmitted}
                key={`${question.id}-${option}`}
                onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion]: index }))}
                type="button"
              >
                <span className="quiz-slide-option-letter">{String.fromCharCode(65 + index)}</span>
                <span className="quiz-slide-option-text">{option}</span>
              </button>
            );
          })}
        </div>
        {isSubmitted && (
          <div className={`quiz-slide-explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div style={{ marginBottom: '8px' }}>
              <strong>{isCorrect ? 'Chính xác.' : 'Chưa chính xác.'}</strong> {question.explanation}
            </div>
            {question.citation && (
              <div className="citation-evidence-card">
                <div className="citation-header">
                  <FileText size={14} /> <span>Minh chứng bài giảng gốc:</span>
                </div>
                <div className="citation-text">
                  {(() => {
                    const match = String(question.citation).match(/(\[T\d{2}-\d{3}\]|\[[\w\.-]+\.pdf\s*-\s*(?:Page\s*)?\d+\])/i);
                    const tag = match ? match[1] : String(question.citation).trim();
                    return (
                      <button
                        className="citation-badge-link"
                        onClick={() => onOpenCitation?.(tag)}
                        type="button"
                        title={`Bấm để xem trích dẫn nguyên văn ${tag}`}
                      >
                        🏷️ Xem trích dẫn nguyên văn {tag}
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}
            {!isCorrect && (
              <button className="btn-secondary inline-action" onClick={retryCurrentQuestion} type="button">
                Thử lại câu này
              </button>
            )}
          </div>
        )}
      </div>
      <div className="quiz-slide-footer">
        <button
          className="btn-secondary"
          disabled={currentQuestion === 0}
          onClick={() => setCurrentQuestion((prev) => prev - 1)}
          type="button"
        >
          Câu trước
        </button>
        {!isSubmitted ? (
          <button
            className="btn-primary"
            disabled={!hasAnsweredCurrent}
            onClick={() => setSubmittedQuestions((prev) => ({ ...prev, [currentQuestion]: true }))}
            type="button"
          >
            Kiểm tra đáp án
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={() => {
              if (currentQuestion < questions.length - 1) setCurrentQuestion((prev) => prev + 1);
              else setShowResults(true);
            }}
            type="button"
          >
            {currentQuestion === questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        )}
      </div>
    </div>
  );
}

function QuotaMeter() {
  return (
    <div className="quota-bar">
      <span>Quota tạo quiz hôm nay</span>
      <span><strong>Không giới hạn (∞)</strong> <span className="byok">LOCAL</span></span>
    </div>
  );
}

function TutorSidebar({ messages, input, onInputChange, onSend, loading, canGenerateQuiz, onGenerateQuiz, onResetChat, onOpenCitation }) {
  return (
    <aside className="tutor-sidebar">
      <div className="tutor-header">
        <div className="tutor-title">
          <div className="tutor-icon-wrap">
            <Sparkles size={18} className="tutor-icon" />
          </div>
          <div>
            <h3>VLearn Tutor</h3>
            <span>Trợ lý học theo ngữ cảnh</span>
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={onResetChat}
          title="Xóa lịch sử & Đặt lại khung chat"
          type="button"
          style={{ marginLeft: 'auto' }}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="chat-history">
        {messages.map((message) => (
          <div className={`chat-message ${message.role}`} key={message.id}>
            {message.role === 'tutor' && <div className="avatar tutor-avatar"><Sparkles size={14} /></div>}
            <div className="message-stack">
              <div className="msg-bubble">
                <div className="msg-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p({ children }) {
                        return <p>{processChildrenForCitations(children, onOpenCitation)}</p>;
                      },
                      li({ children }) {
                        return <li>{processChildrenForCitations(children, onOpenCitation)}</li>;
                      }
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                </div>
                {message.isQuizTrigger && (
                  <button
                    className="btn-primary full-width"
                    disabled={!canGenerateQuiz}
                    onClick={() => onGenerateQuiz(message.quizPrompt || message.userPrompt)}
                    type="button"
                  >
                    Bắt đầu làm Quiz <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
            {message.role === 'user' && <div className="avatar user-avatar">HV</div>}
          </div>
        ))}
        {loading && (
          <div className="chat-message tutor">
            <div className="avatar tutor-avatar"><Sparkles size={14} /></div>
            <div className="msg-bubble">
              <div className="loading-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <form onSubmit={onSend}>
          <div className="chat-input-wrapper">
            <input
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Nhập câu hỏi hoặc yêu cầu tạo quiz..."
              type="text"
              value={input}
            />
            <button disabled={!input.trim()} type="submit" aria-label="Gửi câu hỏi">
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

export function App() {
  const [selectedFile, setSelectedFile] = useState(defaultFile);
  const [currentPage, setCurrentPage] = useState(1);
  const [centerView, setCenterView] = useState('pdf');
  const [quizPackage, setQuizPackage] = useState(null);
  const [guardrailWarnings, setGuardrailWarnings] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [lastQuizPrompt, setLastQuizPrompt] = useState({});
  const [quota, setQuota] = useState(() => {
    const storage = getBrowserStorage();
    return storage
      ? getQuotaState(storage, todayKey())
      : { date: todayKey(), used: 0, limit: 15, remaining: 15, exhausted: false };
  });
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const messagesEndRef = useRef(null);

  const canGenerateQuiz = useMemo(
    () => !quota.exhausted && !quizLoading,
    [quota.exhausted, quizLoading],
  );
  const currentKnowledgeComponent = useMemo(
    () => getKnowledgeComponentForPage(selectedFile.id, currentPage),
    [selectedFile.id, currentPage],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  useEffect(() => {
    const storage = getBrowserStorage();
    if (storage) storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  }, [messages]);

  const selectFile = (file) => {
    setSelectedFile(file);
    setCurrentPage(1);
    setCenterView('pdf');
    setQuizError('');
    setQuizPackage(null);
    setGuardrailWarnings([]);
  };

  const generateQuizForSelectedFile = async (request = {}) => {
    const quizRequest = typeof request === 'string' ? { userPrompt: request } : (request || {});
    const promptForRequest = quizRequest.userPrompt?.trim() || '';
    const selectedText = quizRequest.selectedText?.trim() || '';
    const effectiveUserPrompt = promptForRequest || (selectedText ? buildSelectionQuizPrompt(selectedText) : '');
    setLastQuizPrompt({ userPrompt: promptForRequest, selectedText });

    if (!canGenerateQuiz) {
      setQuizError('Quota tạo quiz hôm nay đã hết hoặc request đang chạy.');
      setCenterView('quiz');
      return;
    }

    setQuizLoading(true);
    setQuizError('');
    setQuizPackage(null);
    setGuardrailWarnings([]);
    setCenterView('quiz');

    try {
      const result = await apiClient.generateQuiz({
        fileId: selectedFile.id,
        slidePage: currentPage,
        kcId: currentKnowledgeComponent?.kcId,
        userPrompt: effectiveUserPrompt || undefined,
        selectedText: selectedText || undefined,
        numQuestions: extractRequestedQuestionCount(promptForRequest),
        conversationContext: buildQuizLearningContext(
          messages,
          selectedFile,
          currentPage,
          currentKnowledgeComponent,
        ),
      });
      setQuizPackage(result.quiz);
      setGuardrailWarnings(result.guardrailWarnings);

      const storage = getBrowserStorage();
      if (storage) setQuota(recordQuizGeneration(storage, todayKey()));
    } catch (error) {
      setQuizError(error.message);
      setMessages((prev) => [
        ...prev,
        createMessage('tutor', `Lỗi khi tạo quiz: ${error.message}`),
      ]);
    } finally {
      setQuizLoading(false);
    }
  };

  const sendChatMessage = async (rawText, { selectedText, forceChat = false } = {}) => {
    const userText = rawText?.trim() || '';
    if (!userText) return;

    const scopedSelectedText = selectedText?.trim() || '';
    const asksForQuiz = !forceChat && /quiz|kiểm tra|kiem tra|micro-quiz|câu hỏi|cau hoi|ôn tập/i.test(userText);
    const history = toChatHistory(messages);
    setInput('');
    setMessages((prev) => [...prev, createMessage('user', userText)]);

    if (asksForQuiz) {
      setMessages((prev) => [
        ...prev,
        createMessage('tutor', 'Tôi đã chuẩn bị yêu cầu quiz. Bấm nút bên dưới để bắt đầu.', {
          isQuizTrigger: true,
          quizPrompt: userText
        }),
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const data = await apiClient.postChat(userText, {
        history,
        fileId: selectedFile.id,
        slidePage: currentPage,
        selectedText: scopedSelectedText || undefined,
      });
      const answer = data.answer || 'Backend không trả về nội dung phản hồi.';
      setMessages((prev) => [
        ...prev,
        createMessage('tutor', answer, {
          isQuizTrigger: /quiz|kiểm tra|kiem tra|micro-quiz|câu hỏi|cau hoi|ôn tập/i.test(answer),
          quizPrompt: userText
        }),
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        createMessage('tutor', `Lỗi kết nối Backend: ${error.message}`),
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    await sendChatMessage(input);
  };

  const handleAskAIAboutSelection = async (selectedText) => {
    await sendChatMessage(buildSelectionAskPrompt(selectedText), {
      selectedText,
      forceChat: true,
    });
  };

  return (
    <div className="vlearn-app">
      <header className="topbar">
        <div className="topbar-left">
          <a href="#" className="brand">
            <span className="brand-icon">V</span> VLearn
          </a>
          <div className="topbar-tabs">
            <div className="tab">Trang chủ</div>
            <div className="tab active">Khóa học của tôi</div>
            <div className="tab">Sổ tay học tập</div>
          </div>
        </div>
        <div className="topbar-center">COMP2010 - Khóa 3 + 4 Phase 1</div>
        <div className="topbar-right">
          <button className="btn-outline" type="button">Mở Codelabs</button>
          <div className="user-dropdown">
            <div className="avatar-sm">HV</div>
            <ChevronDown size={14} />
          </div>
        </div>
      </header>

      <main className="main-content">
        <CourseSidebar
          onSelectFile={selectFile}
          selectedFileId={selectedFile?.id}
        />

        <section className="pdf-viewer">
          {centerView === 'pdf' ? (
            <DocumentViewer
              file={selectedFile}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              isGenerating={quizLoading}
              onGenerateQuiz={(request) => generateQuizForSelectedFile(request)}
              onAskAI={(text) => {
                handleAskAIAboutSelection(text);
              }}
              currentKnowledgeComponent={currentKnowledgeComponent}
              quota={quota}
            />
          ) : (
            <QuizSlide
              error={quizError}
              guardrailWarnings={guardrailWarnings}
              loading={quizLoading}
              onBack={() => setCenterView('pdf')}
              onOpenCitation={(tag) => setActiveCitation(tag)}
              onRetry={() => generateQuizForSelectedFile(lastQuizPrompt)}
              quiz={quizPackage}
            />
          )}
        </section>

        <div className="right-panel">
          <QuotaMeter quota={quota} />
          <TutorSidebar
            canGenerateQuiz={canGenerateQuiz}
            input={input}
            loading={chatLoading}
            messages={messages}
            onGenerateQuiz={(prompt) => generateQuizForSelectedFile(prompt)}
            onInputChange={setInput}
            onOpenCitation={(tag) => setActiveCitation(tag)}
            onResetChat={() => {
              setMessages([WELCOME_MESSAGE]);
              const storage = getBrowserStorage();
              if (storage) storage.removeItem(CHAT_STORAGE_KEY);
            }}
            onSend={handleSend}
          />
          <div ref={messagesEndRef} />
        </div>
      </main>

      <CitationModal
        activeCitation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
