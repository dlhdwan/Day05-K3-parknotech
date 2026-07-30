import { useState, useEffect, useRef } from 'react';
import {
  Menu, Search, Book, FileText, ChevronDown, ChevronRight,
  ZoomIn, ZoomOut, Download, MessageSquare, Send, BookOpen,
  Sparkles, Check, XCircle, RotateCcw, ThumbsUp, ThumbsDown,
  ArrowLeft
} from 'lucide-react';

// Quiz questions được lấy từ API /api/quiz/generate (không hardcode)

function QuizSlide({ onBack, questions }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isSubmittedForQuestion, setIsSubmittedForQuestion] = useState({});

  if (!questions || questions.length === 0) {
    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
          <button className="btn-outline" onClick={onBack}><ArrowLeft size={16}/> Quay lại tài liệu</button>
          <span className="quiz-slide-title"><Sparkles size={16}/> Đang tạo quiz từ AI...</span>
        </div>
        <div className="quiz-slide-body" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const hasAnsweredCurrent = answers[currentQuestion] !== undefined;
  const isCorrect = answers[currentQuestion] === question.correct_index;
  const isSubmitted = isSubmittedForQuestion[currentQuestion];

  const handleSelect = (index) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [currentQuestion]: index }));
  };

  const handleSubmit = () => {
    setIsSubmittedForQuestion(prev => ({ ...prev, [currentQuestion]: true }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  if (showResults) {
    const score = Object.keys(answers).reduce((acc, qIndex) => {
      return acc + (answers[qIndex] === questions[qIndex].correct_index ? 1 : 0);
    }, 0);
    const percent = Math.round((score / questions.length) * 100);

    return (
      <div className="quiz-slide-container">
        <div className="quiz-slide-header">
           <button className="btn-outline" onClick={onBack}><ArrowLeft size={16}/> Quay lại bài giảng</button>
           <span className="quiz-slide-title"><Sparkles size={16}/> Kết quả kiểm tra nhanh</span>
        </div>
        <div className="quiz-results-large">
          <div className="score-circle-large" style={{ '--score': `${percent * 3.6}deg` }}>
            <span>{score}/{questions.length}</span>
          </div>
          <h2>{score === questions.length ? 'Tuyệt vời!' : 'Hoàn thành!'}</h2>
          <p>Bạn đã nắm được nội dung chính của phần tài liệu này.</p>
          <div style={{display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24}}>
             <button className="btn-secondary" onClick={() => {
               setAnswers({});
               setIsSubmittedForQuestion({});
               setCurrentQuestion(0);
               setShowResults(false);
             }}>Làm lại</button>
             <button className="btn-primary" onClick={onBack}>Tiếp tục học</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-slide-container">
      <div className="quiz-slide-header">
         <button className="btn-outline" onClick={onBack}><ArrowLeft size={16}/> Quay lại tài liệu</button>
         <span className="quiz-slide-title"><Sparkles size={16}/> Kiểm tra nhanh ({currentQuestion + 1}/{questions.length})</span>
      </div>
      <div className="quiz-slide-body">
        <h2 className="quiz-slide-question">{question.prompt}</h2>
        <div className="quiz-slide-options">
          {question.options.map((opt, idx) => {
            let className = "quiz-slide-option";
            if (isSubmitted) {
               if (idx === question.correct_index) className += " correct";
               else if (idx === answers[currentQuestion]) className += " incorrect";
            } else if (answers[currentQuestion] === idx) {
               className += " selected";
            }
            
            return (
              <div key={idx} className={className} onClick={() => handleSelect(idx)}>
                <div className="quiz-slide-option-letter">{String.fromCharCode(65 + idx)}</div>
                <div className="quiz-slide-option-text">{opt}</div>
              </div>
            );
          })}
        </div>
        {isSubmitted && (
           <div className={`quiz-slide-explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
              <strong>{isCorrect ? 'Chính xác!' : 'Chưa chính xác.'}</strong> {question.explanation}
              {question.citation && <span style={{opacity:0.7, marginLeft:4}}>({question.citation})</span>}
           </div>
        )}
      </div>
      <div className="quiz-slide-footer">
        <button className="btn-secondary" disabled={currentQuestion === 0} onClick={() => { setCurrentQuestion(prev => prev - 1); }}>
          Câu trước
        </button>
        {!isSubmitted ? (
          <button className="btn-primary" disabled={!hasAnsweredCurrent} onClick={handleSubmit}>
            Kiểm tra đáp án
          </button>
        ) : (
          <button className="btn-primary" onClick={handleNext}>
            {currentQuestion === questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        )}
      </div>
    </div>
  );
}

export function App() {
  const [messages, setMessages] = useState([
    {
      role: 'tutor',
      text: 'Chào bạn! Tôi là VLearn Tutor. Bạn có thể bôi đen một đoạn tài liệu và đặt câu hỏi, hoặc yêu cầu tôi tạo bài kiểm tra nhanh (micro-quiz) để ôn tập nhé.',
      isQuizTrigger: false
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [centerView, setCenterView] = useState('pdf'); // 'pdf' | 'quiz'
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizMeta, setQuizMeta] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText })
      });
      const data = await res.json();
      
      setIsLoading(false);
      setMessages(prev => [...prev, {
        role: 'tutor',
        text: data.answer || "Không có phản hồi từ máy chủ.",
        isQuizTrigger: data.answer && data.answer.toLowerCase().includes("quiz")
      }]);
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [...prev, {
        role: 'tutor',
        text: "Lỗi kết nối tới Backend: " + error.message,
        isQuizTrigger: false
      }]);
    }
  };

  const generateQuiz = async (slidePage = 14) => {
    setQuizLoading(true);
    setQuizQuestions([]);
    setCenterView('quiz');
    try {
      const res = await fetch('http://localhost:8000/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide_page: slidePage })
      });
      const data = await res.json();
      if (data.quiz && data.quiz.questions) {
        setQuizQuestions(data.quiz.questions);
        setQuizMeta({ kc_id: data.quiz.kc_id, kc_title: data.quiz.kc_title });
      }
    } catch (err) {
      console.error('Quiz generation failed:', err);
      setMessages(prev => [...prev, {
        role: 'tutor',
        text: 'Lỗi khi tạo quiz: ' + err.message,
        isQuizTrigger: false
      }]);
      setCenterView('pdf');
    } finally {
      setQuizLoading(false);
    }
  };

  return (
    <div className="vlearn-app">
      {/* TOPBAR */}
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
        <div className="topbar-center">
           COMP2010 - Khóa 3 + 4 Phase 1
        </div>
        <div className="topbar-right">
          <button className="btn-outline">Mở Codelabs</button>
          <div className="user-dropdown">
             <div className="avatar-sm">HV</div>
             <ChevronDown size={14} />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="main-content">
        
        {/* LEFT SIDEBAR: Modules */}
        <aside className="left-sidebar">
          <div className="sidebar-header">
            <BookOpen size={18} /> Học liệu môn học
          </div>
          <div className="module-list">
            <div className="module-item">
              <div className="module-title">
                 <ChevronDown size={16} /> <span>Day 1</span> <span className="badge">STUDYING</span>
              </div>
              <div className="module-files">
                 <div className="file-item active">
                    <FileText size={16} /> day01_302.pdf
                 </div>
                 <div className="file-item">
                    <FileText size={16} /> material_mrx...pdf
                 </div>
              </div>
            </div>
            <div className="module-item">
              <div className="module-title">
                 <ChevronRight size={16} /> <span>Day 2</span>
              </div>
            </div>
            <div className="module-item">
              <div className="module-title">
                 <ChevronRight size={16} /> <span>Day 3</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER: PDF VIEWER OR QUIZ SLIDE */}
        <section className="pdf-viewer">
           {centerView === 'pdf' ? (
             <>
               <div className="pdf-toolbar">
                  <button className="tb-btn active">Đọc</button>
                  <button className="tb-btn">Bút</button>
                  <button className="tb-btn">Highlight</button>
                  <div className="divider"></div>
                  <span style={{fontSize: 13, color: '#64707b', fontWeight: 600}}>Trang 14 / 83</span>
                  <div className="divider"></div>
                  <button className="icon-btn"><ZoomOut size={16}/></button>
                  <span style={{fontSize: 13, fontWeight: 600}}>100%</span>
                  <button className="icon-btn"><ZoomIn size={16}/></button>
                  <div className="divider"></div>
                  <button className="icon-btn"><Download size={16}/></button>
               </div>
               
               <div className="pdf-content">
                  <div className="pdf-page green-theme">
                     <div className="page-number">day01_302.pdf</div>
                     <h2>Few-shot Prompting</h2>
                     <p>Cung cấp ví dụ (demonstrations) trong prompt để định hướng mô hình.</p>
                     <div className="instructor-info">Instructor: Mai Anh Nguyen (Blue)</div>
                  </div>
                  
                  <div style={{marginTop: 'auto', padding: 12, background: '#fff', borderRadius: 8, fontSize: 13, border: '1px dashed #a0aab2', color: '#64707b', cursor: 'pointer', textAlign: 'center'}} onClick={() => generateQuiz(14)}>
                     💡 Click vào đây để tạo Quiz AI cho đoạn này (slide 14)
                  </div>
               </div>
             </>
           ) : (
             <QuizSlide onBack={() => setCenterView('pdf')} questions={quizQuestions} />
           )}
        </section>

        {/* RIGHT SIDEBAR: TUTOR */}
        <aside className="tutor-sidebar">
           <div className="tutor-header">
              <div className="tutor-title">
                 <div style={{background: '#edf7f5', padding: 6, borderRadius: '50%'}}>
                   <Sparkles size={18} className="tutor-icon"/>
                 </div>
                 <div>
                    <h3>VLearn Tutor</h3>
                    <span>Trợ lý học theo ngữ cảnh</span>
                 </div>
              </div>
           </div>
           
           <div className="quota-bar">
              <span>Quota Tutor trong ngày</span>
              <span><strong>14/15</strong> câu <span className="byok">BYOK</span></span>
           </div>

           <div className="chat-history">
              {messages.map((msg, idx) => (
                 <div key={idx} className={`chat-message ${msg.role}`}>
                    {msg.role === 'tutor' && <div className="avatar tutor-avatar"><Sparkles size={14}/></div>}
                    <div style={{display: 'flex', flexDirection: 'column', maxWidth: '100%'}}>
                       <div className="msg-bubble">
                          <p>{msg.text}</p>
                          {msg.isQuizTrigger && (
                             <button className="btn-primary" style={{marginTop: 12, width: '100%', justifyContent: 'center'}} onClick={() => generateQuiz(14)}>
                               Bắt đầu làm Quiz <ChevronRight size={16}/>
                             </button>
                          )}
                       </div>
                    </div>
                    {msg.role === 'user' && <div className="avatar user-avatar">HV</div>}
                 </div>
              ))}
              {isLoading && (
                 <div className="chat-message tutor">
                    <div className="avatar tutor-avatar"><Sparkles size={14}/></div>
                    <div className="msg-bubble">
                       <div className="loading-dots">
                          <span></span><span></span><span></span>
                       </div>
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
           </div>

           <div className="chat-input-area">
              <form onSubmit={handleSend}>
                 <div className="chat-input-wrapper">
                    <input 
                       type="text" 
                       placeholder="Nhập câu hỏi hoặc bôi đen tài liệu..." 
                       value={input}
                       onChange={e => setInput(e.target.value)}
                    />
                    <button type="submit" disabled={!input.trim()}>
                       <Send size={18} />
                    </button>
                 </div>
              </form>
           </div>
        </aside>

      </main>
    </div>
  );
}
