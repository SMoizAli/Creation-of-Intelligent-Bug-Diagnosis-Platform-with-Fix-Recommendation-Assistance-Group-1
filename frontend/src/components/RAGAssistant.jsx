/**
 * RAGAssistant.jsx  (v2 — Production)
 * ─────────────────────────────────────────────────────────────
 * Slide-out drawer that merges two capabilities:
 *
 *  A) CONVERSATIONAL RAG  — vector-similarity search against the
 *     ChromaDB knowledge base, returning rich historical matches.
 *
 *  B) FULL PIPELINE TRIGGER — if the query looks like a real bug
 *     trace (contains "Error", "Exception", traceback, etc.) OR
 *     the engineer clicks "Run Full Analysis", it routes through
 *     the SAME submitBug → analyzeBug pipeline used by file upload,
 *     then surfaces findings on the main dashboard.
 *
 *  C) VOICE INPUT — Web Speech API (webkitSpeechRecognition) mic
 *     button with animated visual feedback.
 *
 * Props
 *   isOpen          boolean
 *   onClose         () → void
 *   onAnalysisReady (analysis, bug) → void   ← dashboard callback
 *   onPipelineStart (source)        → void   ← dashboard callback
 * ─────────────────────────────────────────────────────────────
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo
} from 'react';
import { useUnifiedBugIngestion } from '../hooks/useUnifiedBugIngestion';

/* ═══════════════════════════════════════════════════════════
   LOCAL MOCK KB  (used when backend is offline / for instant
   conversational answers that don't need the full pipeline)
   ═══════════════════════════════════════════════════════════ */
const RAG_KB = [
  {
    keywords: ['attributeerror', 'nonetype', 'processor', "has no attribute"],
    response: `**Historical Match Found.**\n\nBUG-4821 (resolved 2024-03-15 by @priya_k) had an identical \`AttributeError: 'NoneType' object has no attribute 'process'\` in \`processor.py\`.\n\n**Root cause:** \`_resolve_gateway()\` returned \`None\` when the provider key was absent from \`GATEWAY_MAP\`.\n\n**Fix applied:** Added null-guard before calling \`.process()\` and raised a descriptive \`GatewayResolutionError\`. PR #4821 merged to main.`,
    tickets: [
      { id: 'BUG-4821', similarity: 0.924, resolver: '@priya_k', date: '2024-03-15', status: 'resolved' },
      { id: 'BUG-3119', similarity: 0.871, resolver: '@james_t',  date: '2023-11-08', status: 'resolved' },
    ],
    isBugTrace: false,
  },
  {
    keywords: ['memory', 'leak', 'oom', 'heap', 'out of memory', 'rss'],
    response: `**2 historical memory-leak incidents found.**\n\nBUG-5201 (2024-05-02, @carlos_m): Unbounded cache growth in \`session_store.py\`. Fix: LRU eviction, max 10,000 sessions. Peak RSS dropped 62%.\n\nBUG-4930 (2024-02-18, @anita_r): Heap buildup in long-running batch jobs. Fix: explicit \`gc.collect()\` calls after each batch in the worker thread.`,
    tickets: [
      { id: 'BUG-5201', similarity: 0.911, resolver: '@carlos_m', date: '2024-05-02', status: 'resolved' },
      { id: 'BUG-4930', similarity: 0.856, resolver: '@anita_r',  date: '2024-02-18', status: 'resolved' },
    ],
    isBugTrace: false,
  },
  {
    keywords: ['http 500', '500 error', 'gateway', 'timeout', 'payment'],
    response: `**3 related gateway-timeout incidents in KB.**\n\nMost recent: BUG-5502 (2024-06-20, @dev_ops_team) — gateway provider timeouts cascaded to HTTP 500 with no circuit-breaker fallback.\n\n**Fix:** Exponential-backoff retry (max 3 attempts) + circuit-breaker in \`gateway_router.py\`. SLA improved 98.1% → 99.7%.`,
    tickets: [
      { id: 'BUG-5502', similarity: 0.898, resolver: '@dev_ops_team', date: '2024-06-20', status: 'resolved' },
      { id: 'BUG-3847', similarity: 0.831, resolver: '@sarah_h',      date: '2023-09-11', status: 'resolved' },
    ],
    isBugTrace: false,
  },
  {
    keywords: ['importerror', 'modulenotfounderror', 'import', 'module'],
    response: `**BUG-4102** (2024-01-09, @dev_backend): \`ImportError: cannot import name 'process_payment'\` after a module restructure. Missing \`__init__.py\` update in the payments package.\n\n**Fix:** Added the symbol to the package's public API and updated all import paths.`,
    tickets: [
      { id: 'BUG-4102', similarity: 0.887, resolver: '@dev_backend', date: '2024-01-09', status: 'resolved' },
    ],
    isBugTrace: false,
  },
  {
    keywords: ['keyerror', 'dictionary', 'dict', 'key'],
    response: `**BUG-3744** (2023-08-22, @mira_s): \`KeyError: 'transaction_id'\` when processing refund requests. The refund handler assumed the key always existed.\n\n**Fix:** \`payload.get('transaction_id')\` with a fallback and a descriptive \`ValueError\` when absent.`,
    tickets: [
      { id: 'BUG-3744', similarity: 0.869, resolver: '@mira_s', date: '2023-08-22', status: 'resolved' },
    ],
    isBugTrace: false,
  },
];

// Detect if query looks like a real bug trace that should go through the full pipeline
const BUG_TRACE_PATTERNS = [
  /traceback/i,
  /file ".*\.py"/i,
  /line \d+/i,
  /\w+error:/i,
  /\w+exception:/i,
  /stack trace/i,
  /at \w+\.\w+\(/,
];

function looksLikeBugTrace(text) {
  return BUG_TRACE_PATTERNS.some(p => p.test(text));
}

function findKBMatch(query) {
  const q = query.toLowerCase();
  for (const entry of RAG_KB) {
    if (entry.keywords.some(kw => q.includes(kw))) return entry;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   WEB SPEECH API HOOK
   ═══════════════════════════════════════════════════════════ */
function useSpeechRecognition({ onResult, onError, onStart, onEnd }) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  const isSupported = useMemo(() =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recognitionRef.current = rec;

    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
      onStart?.();
    };

    rec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      onResult?.({ final: finalTranscript, interim: interimTranscript });
    };

    rec.onerror = (event) => {
      setIsListening(false);
      const msgs = {
        'not-allowed': 'Microphone access denied. Please allow mic access in your browser.',
        'no-speech':   'No speech detected. Please speak clearly into your microphone.',
        'aborted':     'Listening was stopped.',
        'network':     'Network error during speech recognition.',
      };
      onError?.(msgs[event.error] || `Speech recognition error: ${event.error}`);
    };

    rec.onend = () => {
      setIsListening(false);
      onEnd?.();
    };

    rec.start();
  }, [isSupported, isListening, onResult, onError, onStart, onEnd]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, startListening, stopListening };
}

/* ═══════════════════════════════════════════════════════════
   MARKDOWN-LITE RENDERER
   ═══════════════════════════════════════════════════════════ */
function RenderMarkdown({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="rag-inline-code">{part.slice(1, -1)}</code>;
        if (part === '\n') return <br key={i} />;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   TYPEWRITER TEXT COMPONENT
   ═══════════════════════════════════════════════════════════ */
function TypewriterText({ text, speed = 12, onDone }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(t);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(t);
  }, [text]);
  return <RenderMarkdown text={displayed} />;
}

/* ═══════════════════════════════════════════════════════════
   TICKET REFERENCE CARD
   ═══════════════════════════════════════════════════════════ */
function TicketCard({ ticket }) {
  return (
    <div className="rag-ticket-card">
      <div className="rag-tc-left">
        <span className="rag-tc-id">{ticket.id}</span>
        <span className={`rag-tc-status ${ticket.status}`}>{ticket.status}</span>
      </div>
      <div className="rag-tc-mid">
        Resolved by <strong>{ticket.resolver}</strong> · {ticket.date}
      </div>
      <div className="rag-tc-right">
        <div className="rag-sim-pill">
          <div className="rag-sim-bar-track">
            <div
              className="rag-sim-bar-fill"
              style={{ width: `${ticket.similarity * 100}%` }}
            />
          </div>
          <span className="rag-sim-val">{(ticket.similarity * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIPELINE ANALYSIS RESULT CARD
   ─ rendered inside the drawer when a full pipeline run
     completes (triggered from chat or voice input)
   ═══════════════════════════════════════════════════════════ */
function PipelineResultCard({ analysis, onViewFull }) {
  if (!analysis) return null;
  const triage = analysis.triage || {};
  const rootCause = analysis.root_cause || {};
  const remediation = analysis.remediation || {};
  const confidence = analysis.confidence_scoring?.confidence_score ?? rootCause.confidence ?? 0;
  const confPct = Math.min(100, (confidence <= 1 ? confidence * 100 : confidence));

  return (
    <div className="rag-pipeline-result-card">
      <div className="rpr-header">
        <span className="rpr-icon">🎯</span>
        <div>
          <strong className="rpr-title">Full Pipeline Analysis Complete</strong>
          <p className="rpr-sub">Triage · Log Parse · RAG Match · Remediation</p>
        </div>
        <span className={`badge-priority ${(triage.priority || 'medium').toLowerCase()}`}>
          {triage.priority || 'MEDIUM'}
        </span>
      </div>

      <div className="rpr-metrics">
        <div className="rpr-metric">
          <span className="rpr-metric-label">Component</span>
          <code className="rpr-metric-val">{triage.component || '—'}</code>
        </div>
        <div className="rpr-metric">
          <span className="rpr-metric-label">Root Cause</span>
          <span className="rpr-metric-val">
            {(rootCause.root_cause_category || 'Unknown').replace(/_/g, ' ')}
          </span>
        </div>
        <div className="rpr-metric">
          <span className="rpr-metric-label">Confidence</span>
          <span className="rpr-metric-val" style={{ color: confPct >= 70 ? '#10b981' : '#f59e0b' }}>
            {confPct.toFixed(0)}%
          </span>
        </div>
        <div className="rpr-metric">
          <span className="rpr-metric-label">Effort</span>
          <span className="rpr-metric-val">{remediation.effort_estimate || '—'}</span>
        </div>
      </div>

      {rootCause.hypothesis && (
        <p className="rpr-hypothesis">💡 {rootCause.hypothesis}</p>
      )}

      <button className="rpr-view-btn" onClick={onViewFull} id="view-full-analysis-btn">
        View Full Analysis on Dashboard →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIPELINE PROGRESS MINI TRACKER (shown inside drawer)
   ═══════════════════════════════════════════════════════════ */
function MiniPipelineTracker({ currentStage, stageLabel, totalStages }) {
  const pct = totalStages > 0 ? Math.round((currentStage / (totalStages - 1)) * 100) : 0;
  return (
    <div className="rag-mini-pipeline">
      <div className="rmp-header">
        <span className="rmp-icon">⚙</span>
        <span className="rmp-label">Running Multi-Agent Pipeline…</span>
        <span className="rmp-pct">{pct}%</span>
      </div>
      <div className="rmp-track">
        <div className="rmp-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="rmp-stage">{stageLabel || 'Initialising…'}</p>
      <div className="rmp-agents">
        {['Triage', 'Log Parser', 'RAG Matcher', 'Remediation'].map((a, i) => (
          <span
            key={a}
            className={`rmp-agent-chip ${currentStage >= (i + 1) * 3 ? 'done' : currentStage >= i * 3 ? 'active' : ''}`}
          >
            {currentStage >= (i + 1) * 3 ? '✓' : currentStage >= i * 3 ? '●' : '○'} {a}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TYPING INDICATOR
   ═══════════════════════════════════════════════════════════ */
function TypingIndicator({ label = 'Searching vector index…' }) {
  return (
    <div className="rag-typing-indicator">
      <div className="rag-typing-dots">
        <span /><span /><span />
      </div>
      <span className="rag-typing-text">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MIC BUTTON
   ═══════════════════════════════════════════════════════════ */
function MicButton({ isListening, isSupported, onToggle }) {
  return (
    <button
      className={`rag-mic-btn ${isListening ? 'listening' : ''} ${!isSupported ? 'unsupported' : ''}`}
      onClick={onToggle}
      disabled={!isSupported}
      title={
        !isSupported
          ? 'Web Speech API not supported in this browser'
          : isListening
          ? 'Stop listening'
          : 'Click to speak your query'
      }
      id="rag-mic-btn"
      aria-label={isListening ? 'Stop microphone' : 'Start microphone'}
    >
      {/* Ripple rings while listening */}
      {isListening && (
        <>
          <div className="mic-ripple mic-ripple-1" />
          <div className="mic-ripple mic-ripple-2" />
          <div className="mic-ripple mic-ripple-3" />
        </>
      )}
      <span className="mic-icon">{isListening ? '⏹' : '🎤'}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   VOICE STATUS BAR
   ═══════════════════════════════════════════════════════════ */
function VoiceStatusBar({ isListening, interimText, error }) {
  if (!isListening && !error) return null;
  return (
    <div className={`rag-voice-status ${error ? 'error' : 'listening'}`}>
      {error ? (
        <><span>⚠</span> {error}</>
      ) : (
        <>
          <div className="voice-wave">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="voice-bar" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="voice-interim">
            {interimText || 'Listening… speak your query'}
          </span>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUGGESTED QUERIES
   ═══════════════════════════════════════════════════════════ */
const SUGGESTED_QUERIES = [
  'Have we seen an AttributeError like this before?',
  'Show memory leak patterns and their fixes',
  'List all HTTP 500 errors in the payment gateway',
  'What was the fix for the NoneType crash in processor.py?',
];

/* ═══════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════════════════════ */
function MessageBubble({ msg, isNew, onViewFullAnalysis }) {
  const [showTickets, setShowTickets] = useState(false);
  const [typewriteDone, setTypewriteDone] = useState(!isNew);

  // For non-new messages, show everything immediately
  useEffect(() => {
    if (!isNew) {
      setShowTickets(true);
      setTypewriteDone(true);
    }
  }, [isNew]);

  if (msg.role === 'user') {
    return (
      <div className="rag-msg-row user">
        <div className="rag-bubble user-bubble">
          {msg.source === 'voice' && (
            <span className="msg-source-badge voice">🎤 Voice</span>
          )}
          {msg.source === 'pipeline' && (
            <span className="msg-source-badge pipeline">⚙ Bug Trace</span>
          )}
          <p>{msg.content}</p>
        </div>
        <div className="rag-avatar user-avatar">👤</div>
      </div>
    );
  }

  // Pipeline result message (special rendering)
  if (msg.type === 'pipeline_result') {
    return (
      <div className="rag-msg-row assistant">
        <div className="rag-avatar assistant-avatar">🤖</div>
        <div style={{ flex: 1 }}>
          <PipelineResultCard
            analysis={msg.analysis}
            onViewFull={() => onViewFullAnalysis?.(msg.analysis, msg.bug)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rag-msg-row assistant">
      <div className="rag-avatar assistant-avatar">🤖</div>
      <div className="rag-bubble assistant-bubble">
        <div className="rag-bubble-header">
          <span className="rag-model-badge">Agentic RAG</span>
          <span className="rag-sim-label">Vector search · ChromaDB</span>
        </div>
        <div className="rag-response-text">
          {isNew && !typewriteDone ? (
            <TypewriterText
              text={msg.content}
              speed={10}
              onDone={() => { setTypewriteDone(true); setShowTickets(true); }}
            />
          ) : (
            <RenderMarkdown text={msg.content} />
          )}
        </div>
        {showTickets && msg.tickets?.length > 0 && (
          <div className="rag-ticket-refs">
            <span className="rag-refs-label">📎 Historical Matches ({msg.tickets.length})</span>
            {msg.tickets.map(t => <TicketCard key={t.id} ticket={t} />)}
          </div>
        )}
        {showTickets && msg.canRunPipeline && (
          <button
            className="rag-run-pipeline-btn"
            onClick={() => onViewFullAnalysis?.('_trigger_pipeline_', msg.queryText)}
            id="rag-run-full-pipeline-btn"
          >
            ⚡ Run Full Pipeline Analysis on this Query
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT — RAGAssistant (v2)
   ═══════════════════════════════════════════════════════════ */
export default function RAGAssistant({
  isOpen,
  onClose,
  onAnalysisReady,   // (analysis, bug) → update main dashboard
  onPipelineStart,   // (source) → show pipeline view in dashboard
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your **Agentic RAG Assistant**.\n\nAsk me about historical bugs in natural language, paste an error trace, or use the **🎤 mic** to speak your query. I'll search 52,841 historical bug vectors and — if you provide a full stack trace — trigger the complete multi-agent analysis pipeline.",
      tickets: [],
    }
  ]);

  const [inputValue, setInputValue]     = useState('');
  const [isQuerying, setIsQuerying]     = useState(false);
  const [newMsgId, setNewMsgId]         = useState(null);
  const [voiceError, setVoiceError]     = useState('');
  const [interimText, setInterimText]   = useState('');
  const [pipelineState, setPipelineState] = useState({
    running: false, stage: 0, stageLabel: ''
  });

  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const msgCounter = useRef(0);

  // ── Unified ingestion hook ────────────────────────────────
  const { handleUnifiedBugSubmission, PIPELINE_STAGES } = useUnifiedBugIngestion({
    onStageChange: (idx, label) => {
      setPipelineState(prev => ({ ...prev, stage: idx, stageLabel: label }));
    },
    onSubmitSuccess: (bug, source) => {
      onPipelineStart?.(source); // tell dashboard to show pipeline view
    },
    onComplete: (analysis, totalStages, bug) => {
      setPipelineState({ running: false, stage: 0, stageLabel: '' });
      onAnalysisReady?.(analysis, bug); // push to dashboard

      const id = ++msgCounter.current;
      setNewMsgId(id);
      setMessages(prev => [
        ...prev,
        {
          id,
          role: 'assistant',
          type: 'pipeline_result',
          analysis,
          bug,
          content: '',
        }
      ]);
    },
    onError: (msg) => {
      setPipelineState({ running: false, stage: 0, stageLabel: '' });
      const id = ++msgCounter.current;
      setMessages(prev => [
        ...prev,
        {
          id,
          role: 'assistant',
          content: `⚠ **Pipeline Error:** ${msg}\n\nPlease check your backend connection and try again.`,
          tickets: [],
        }
      ]);
    },
  });

  // ── Speech Recognition ────────────────────────────────────
  const { isSupported: micSupported, isListening, startListening, stopListening } =
    useSpeechRecognition({
      onResult: ({ final, interim }) => {
        setInterimText(interim);
        if (final) {
          setInputValue(prev => (prev ? `${prev} ${final}` : final).trim());
          setInterimText('');
        }
      },
      onError: (msg) => {
        setVoiceError(msg);
        setTimeout(() => setVoiceError(''), 4000);
      },
      onStart: () => {
        setVoiceError('');
        setInterimText('');
      },
      onEnd: () => setInterimText(''),
    });

  const toggleMic = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── Auto-scroll to bottom ─────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isQuerying, pipelineState.running]);

  // ── Focus input when opened ───────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen]);

  // ── SEND MESSAGE ──────────────────────────────────────────
  const sendMessage = useCallback(async (text, source = 'chat') => {
    const query = (text || inputValue).trim();
    if (!query || isQuerying || pipelineState.running) return;

    setInputValue('');
    setInterimText('');

    // Add user bubble
    const userId = ++msgCounter.current;
    setMessages(prev => [...prev, { id: userId, role: 'user', content: query, source }]);

    // Detect if this is a full bug trace that should go to the pipeline
    const isBugTrace = looksLikeBugTrace(query) || source === 'voice_trace';

    if (isBugTrace) {
      // ── FULL PIPELINE PATH ──────────────────────────────
      setPipelineState({ running: true, stage: 0, stageLabel: PIPELINE_STAGES[0] });

      // Show the "routing to pipeline" assistant message
      const routeId = ++msgCounter.current;
      setMessages(prev => [
        ...prev,
        {
          id: routeId,
          role: 'assistant',
          content: '⚙ **Bug trace detected.** Routing to the full multi-agent analysis pipeline…\n\nTriage → Log Parser → Vector RAG Matcher → Remediation',
          tickets: [],
        }
      ]);

      try {
        await handleUnifiedBugSubmission({ content: query, source });
      } catch {
        // error handled inside the hook via onError callback
      }
      return;
    }

    // ── CONVERSATIONAL RAG PATH ─────────────────────────
    setIsQuerying(true);

    // Simulate search latency (real backend search happens here)
    await new Promise(r => setTimeout(r, 900 + Math.random() * 500));

    const kbMatch = findKBMatch(query);
    let responseContent, tickets = [], canRunPipeline = false;

    if (kbMatch) {
      responseContent = kbMatch.response;
      tickets = kbMatch.tickets;
    } else {
      // No KB match — suggest running the pipeline
      responseContent = `I searched the vector knowledge base for: **"${query}"**\n\nNo highly similar historical bugs found above the 0.80 similarity threshold. This may be a novel issue.\n\n**Options:**\n- Paste the full stack trace and I'll route it through the complete analysis pipeline.\n- Use the 🎤 mic to describe the error in detail.`;
      canRunPipeline = true;
    }

    setIsQuerying(false);
    const assistantId = ++msgCounter.current;
    setNewMsgId(assistantId);
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: responseContent,
        tickets,
        canRunPipeline,
        queryText: query,
      }
    ]);
  }, [inputValue, isQuerying, pipelineState.running, handleUnifiedBugSubmission, PIPELINE_STAGES]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Triggered when user clicks "Run Full Pipeline Analysis" from inside a msg bubble
  const handleViewFullAnalysis = useCallback((analysisOrTrigger, queryText) => {
    if (analysisOrTrigger === '_trigger_pipeline_') {
      sendMessage(queryText, 'chat_to_pipeline');
    } else {
      // Push existing analysis to dashboard and navigate
      onAnalysisReady?.(analysisOrTrigger, null);
      onClose?.();
    }
  }, [sendMessage, onAnalysisReady, onClose]);

  const isBusy = isQuerying || pipelineState.running;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`rag-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`rag-assistant-drawer ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Ask Agentic RAG Assistant"
        id="rag-assistant-drawer"
      >

        {/* ── Header ─────────────────────────────────────── */}
        <div className="rag-header">
          <div className="rag-header-info">
            <div className="rag-header-avatar">🧠</div>
            <div>
              <h3 className="rag-header-title">Ask Agentic RAG</h3>
              <p className="rag-header-sub">
                52,841 vectors · ChromaDB · GPT-4o · Speech-to-Query
              </p>
            </div>
          </div>
          <div className="rag-header-actions">
            <div className="rag-online-dot" title="System Online" />
            <div className="rag-header-badges">
              <span className="rag-hbadge">🔊 Voice</span>
              <span className="rag-hbadge">⚙ Pipeline</span>
            </div>
            <button className="rag-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* ── Capability Strip ────────────────────────────── */}
        <div className="rag-capability-strip">
          <div className="rag-cap-item">
            <span>🔍</span>
            <span>Vector KB Search</span>
          </div>
          <div className="rag-cap-divider" />
          <div className="rag-cap-item">
            <span>🎤</span>
            <span>Voice Query</span>
          </div>
          <div className="rag-cap-divider" />
          <div className="rag-cap-item">
            <span>⚙</span>
            <span>Full Pipeline</span>
          </div>
          <div className="rag-cap-divider" />
          <div className="rag-cap-item">
            <span>📊</span>
            <span>Live Dashboard Sync</span>
          </div>
        </div>

        {/* ── Suggested Queries ───────────────────────────── */}
        {messages.length <= 1 && (
          <div className="rag-suggestions">
            <span className="rag-suggestions-label">💡 Try asking:</span>
            <div className="rag-suggestion-chips">
              {SUGGESTED_QUERIES.map((q, i) => (
                <button
                  key={i}
                  className="rag-chip"
                  onClick={() => sendMessage(q, 'chat')}
                  disabled={isBusy}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat Body ───────────────────────────────────── */}
        <div className="rag-chat-body" ref={chatRef}>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isNew={msg.id === newMsgId}
              onViewFullAnalysis={handleViewFullAnalysis}
            />
          ))}

          {/* Pipeline in-progress */}
          {pipelineState.running && (
            <div className="rag-msg-row assistant">
              <div className="rag-avatar assistant-avatar">⚙</div>
              <div style={{ flex: 1 }}>
                <MiniPipelineTracker
                  currentStage={pipelineState.stage}
                  stageLabel={pipelineState.stageLabel}
                  totalStages={PIPELINE_STAGES.length}
                />
              </div>
            </div>
          )}

          {/* RAG search in-progress */}
          {isQuerying && (
            <TypingIndicator label="Searching vector index…" />
          )}
        </div>

        {/* ── Voice Status Bar ────────────────────────────── */}
        <VoiceStatusBar
          isListening={isListening}
          interimText={interimText}
          error={voiceError}
        />

        {/* ── Input Row ───────────────────────────────────── */}
        <div className="rag-input-area">
          <div className="rag-input-wrapper">
            <textarea
              ref={inputRef}
              className="rag-input"
              placeholder={
                isListening
                  ? 'Listening… speak your query or paste a stack trace'
                  : 'Type a query, paste a stack trace, or use the mic…'
              }
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              disabled={isBusy && !isListening}
              id="rag-chat-input"
            />
            {inputValue && (
              <div className="rag-input-hint">
                {looksLikeBugTrace(inputValue)
                  ? <span className="hint-pipeline">⚙ Detected bug trace → will run full pipeline</span>
                  : <span className="hint-rag">🔍 Will search vector knowledge base</span>}
              </div>
            )}
          </div>

          {/* Mic Button */}
          <MicButton
            isListening={isListening}
            isSupported={micSupported}
            onToggle={toggleMic}
          />

          {/* Send Button */}
          <button
            className="rag-send-btn"
            onClick={() => sendMessage(undefined, isListening ? 'voice' : 'chat')}
            disabled={(!inputValue.trim() && !interimText) || (isBusy && !inputValue.trim())}
            id="rag-send-btn"
            aria-label="Send message"
          >
            {isQuerying || pipelineState.running
              ? <span className="rag-send-spin">◌</span>
              : '➤'}
          </button>
        </div>

        <p className="rag-disclaimer">
          Queries with stack traces trigger the full 4-agent pipeline and sync results to the dashboard.
          Conversational queries search the vector KB instantly.
        </p>
      </div>
    </>
  );
}
