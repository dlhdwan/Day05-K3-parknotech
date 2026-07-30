import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Send,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiClient } from './api.js';
import { courseModules, defaultLesson } from './courseContent.js';
import { calculateQuizResult } from './quizUtils.js';
import { getQuotaState, recordQuizGeneration, todayKey } from './quota.js';

function getBrowserStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

function CourseSidebar({ selectedLessonId, onSelectLesson }) {
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
                <div className="file-label">
                  <FileText size={15} /> {file.title}
                </div>
                {file.lessons.map((lesson) => (
                  <button
                    className={`file-item ${selectedLessonId === lesson.id ? 'active' : ''}`}
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson, file)}
                    type="button"
                  >
                    <span>Trang {lesson.slidePage}</span>
                    <strong>{lesson.title}</strong>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function DocumentViewer({ lesson, file, quota, onGenerateQuiz, isGenerating }) {
  return (
    <>
      <div className="pdf-toolbar">
        <button className="tb-btn active" type="button">Đọc</button>
        <button className="tb-btn" type="button">Bút</button>
        <button className="tb-btn" type="button">Highlight</button>
        <div className="divider" />
        <span className="toolbar-text">Trang {lesson.slidePage} / {file.totalPages}</span>
        <div className="divider" />
        <button className="icon-btn" type="button" aria-label="Thu nhỏ"><ZoomOut size={16} /></button>
        <span className="toolbar-text">100%</span>
        <button className="icon-btn" type="button" aria-label="Phóng to"><ZoomIn size={16} /></button>
        <div className="divider" />
        <button className="icon-btn" type="button" aria-label="Tải xuống"><Download size={16} /></button>
      </div>

      <div className="pdf-content">
        <div className="pdf-page green-theme">
          <div className="page-number">{file.title}</div>
          <div className="kc-pill">{lesson.kcId}</div>
          <h2>{lesson.title}</h2>
          <p>{lesson.summary}</p>
          <div className="instructor-info">
            Transcript: {lesson.transcriptRefs.join(', ')}
          </div>
        </div>

        <button
          className="quiz-trigger-card"
          disabled={isGenerating || quota.exhausted}
          onClick={onGenerateQuiz}
          type="button"
        >
          <Sparkles size={18} />
          <span>
            {quota.exhausted
              ? 'Đã hết quota tạo quiz hôm nay'
              : `Tạo Micro-Quiz AI cho ${lesson.title}`}
          </span>
          <ChevronRight size={18} />
        </button>
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
  }, [quiz?.kc_id]);

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
          <p>{quiz.kc_title} · {quiz.kc_id}</p>
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
            {question.citation && <span className="citation">{question.citation}</span>}
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
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === 'tutor' && <div className="avatar tutor-avatar"><Sparkles size={14} /></div>}
            <div className="message-stack">
              <div className="msg-bubble">
                <p>{message.text}</p>
                {message.isQuizTrigger && (
                  <button
                    className="btn-primary full-width"
                    disabled={!canGenerateQuiz}
                    onClick={onGenerateQuiz}
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
  const [selectedLesson, setSelectedLesson] = useState(defaultLesson);
  const [selectedFile, setSelectedFile] = useState(initialFile);
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
  const [messages, setMessages] = useState([
    {
      role: 'tutor',
      text: 'Chào bạn! Tôi là VLearn Tutor. Hãy chọn một Knowledge Component rồi bấm Kiểm tra nhanh để tạo micro-quiz 3 câu.',
      isQuizTrigger: true,
    },
  ]);
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

  const selectLesson = (lesson, file) => {
    setSelectedLesson(lesson);
    setSelectedFile(file);
    setCenterView('pdf');
    setQuizError('');
    setQuizPackage(null);
    setGuardrailWarnings([]);
  };

  const generateQuizForSelectedLesson = async (userPrompt) => {
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
        slidePage: selectedLesson.slidePage,
        kcId: selectedLesson.kcId,
        userPrompt,
      });
      setQuizPackage(result.quiz);
      setGuardrailWarnings(result.guardrailWarnings);

      const storage = getBrowserStorage();
      if (storage) setQuota(recordQuizGeneration(storage, todayKey()));
    } catch (error) {
      setQuizError(error.message);
      setMessages((prev) => [
        ...prev,
        { role: 'tutor', text: `Lỗi khi tạo quiz: ${error.message}`, isQuizTrigger: false },
      ]);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const asksForQuiz = /quiz|kiểm tra|kiem tra|micro-quiz/i.test(userText);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText, isQuizTrigger: false }]);

    if (asksForQuiz) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          text: `Tôi sẽ tạo quiz cho ${selectedLesson.title} ở trang ${selectedLesson.slidePage}.`,
          isQuizTrigger: true,
        },
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const data = await apiClient.postChat(userText);
      const answer = data.answer || 'Backend không trả về nội dung phản hồi.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          text: answer,
          isQuizTrigger: /quiz|kiểm tra|kiem tra|micro-quiz/i.test(answer),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'tutor', text: `Lỗi kết nối Backend: ${error.message}`, isQuizTrigger: false },
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
          onSelectLesson={selectLesson}
          selectedLessonId={selectedLesson.id}
        />

        <section className="pdf-viewer">
          {centerView === 'pdf' ? (
            <DocumentViewer
              file={selectedFile}
              isGenerating={quizLoading}
              lesson={selectedLesson}
              onGenerateQuiz={() => generateQuizForSelectedLesson()}
              quota={quota}
            />
          ) : (
            <QuizSlide
              error={quizError}
              guardrailWarnings={guardrailWarnings}
              loading={quizLoading}
              onBack={() => setCenterView('pdf')}
              onRetry={() => generateQuizForSelectedLesson()}
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
            onGenerateQuiz={() => generateQuizForSelectedLesson()}
            onInputChange={setInput}
            onSend={handleSend}
          />
          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
}
