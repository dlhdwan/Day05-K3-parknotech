import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Send,
  Sparkles,
  FileText,
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

import { apiClient } from './api.js';
import { courseModules, defaultFile } from './courseContent.js';
import {
  calculateQuizResult,
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

function DocumentViewer({ file, currentPage, setCurrentPage, quota, onGenerateQuiz, isGenerating, onAskAI }) {
  const [selection, setSelection] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(900);
  const containerRef = useRef(null);
  const pageRefs = useRef([]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  useEffect(() => {
    setNumPages(null);
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

        setSelection({
          text,
          top: rect.top - 45,
          left: rect.left + (rect.width / 2)
        });
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  return (
    <>
      <div className="pdf-content" ref={containerRef}>
        <Document
          key={file.id}
          file={`/slides/${file.title}`}
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
                  width={pageWidth}
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
            className="selection-popup"
            style={{ top: `${selection.top}px`, left: `${selection.left}px` }}
          >
            <button
              type="button"
              className="popup-btn primary"
              onClick={() => {
                onGenerateQuiz(`Tạo câu hỏi về: "${selection.text}"`);
                window.getSelection().removeAllRanges();
                setSelection(null);
              }}
            >
              <Sparkles size={14} /> Tạo câu hỏi
            </button>
            <button
              type="button"
              className="popup-btn outline"
              onClick={() => {
                onAskAI(`Giải thích cho tôi đoạn này: "${selection.text}"`);
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
    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
          <button className="btn-outline" onClick={onBack} type="button"><ArrowLeft size={16} /> Quay lại tài liệu</button>
          <span className="quiz-slide-title"><Sparkles size={16} /> Không tạo được quiz</span>
        </div>
        <div className="state-panel error">
          <strong>{error}</strong>
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
          Guardrail: {guardrailWarnings.join('; ')}
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
            <strong>{isCorrect ? 'Chính xác.' : 'Chưa chính xác.'}</strong> {question.explanation}
            {shouldAppendCitation(question.explanation, question.citation) && (
              <span className="citation">{question.citation}</span>
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

function QuotaMeter({ quota }) {
  return (
    <div className="quota-bar">
      <span>Quota tạo quiz hôm nay</span>
      <span><strong>{quota.remaining}/{quota.limit}</strong> lượt <span className="byok">LOCAL</span></span>
    </div>
  );
}

function TutorSidebar({ messages, input, onInputChange, onSend, loading, canGenerateQuiz, onGenerateQuiz }) {
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
      </div>

      <div className="chat-history">
        {messages.map((message) => (
          <div className={`chat-message ${message.role}`} key={message.id}>
            {message.role === 'tutor' && <div className="avatar tutor-avatar"><Sparkles size={14} /></div>}
            <div className="message-stack">
              <div className="msg-bubble">
                <div className="msg-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                </div>
                {message.isQuizTrigger && (
                  <button
                    className="btn-primary full-width"
                    disabled={!canGenerateQuiz}
                    onClick={() => onGenerateQuiz(message.quizPrompt)}
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
  const initialFile = courseModules[0].files[0];
  const [selectedFile, setSelectedFile] = useState(initialFile);
  const [currentPage, setCurrentPage] = useState(1);
  const [centerView, setCenterView] = useState('pdf');
  const [quizPackage, setQuizPackage] = useState(null);
  const [guardrailWarnings, setGuardrailWarnings] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quota, setQuota] = useState(() => {
    const storage = getBrowserStorage();
    return storage
      ? getQuotaState(storage, todayKey())
      : { date: todayKey(), used: 0, limit: 15, remaining: 15, exhausted: false };
  });
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const canGenerateQuiz = useMemo(
    () => !quota.exhausted && !quizLoading,
    [quota.exhausted, quizLoading],
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

  const generateQuizForSelectedFile = async (userPrompt) => {
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
        slidePage: currentPage,
        fileId: selectedFile?.title || selectedFile?.id,
        userPrompt,
        numQuestions: extractRequestedQuestionCount(userPrompt),
        conversationContext: buildQuizConversationContext(messages),
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

  const handleSend = async (event) => {
    event.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const asksForQuiz = /quiz|kiểm tra|kiem tra|micro-quiz|câu hỏi|cau hoi|ôn tập/i.test(userText);
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
              onGenerateQuiz={(text) => generateQuizForSelectedFile(text)}
              onAskAI={(text) => {
                setInput(text);
              }}
              quota={quota}
            />
          ) : (
            <QuizSlide
              error={quizError}
              guardrailWarnings={guardrailWarnings}
              loading={quizLoading}
              onBack={() => setCenterView('pdf')}
              onRetry={() => generateQuizForSelectedFile()}
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
            onSend={handleSend}
          />
          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
}
