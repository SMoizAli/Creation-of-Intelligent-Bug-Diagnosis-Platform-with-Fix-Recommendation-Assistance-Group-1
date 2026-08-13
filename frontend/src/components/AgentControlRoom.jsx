import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── Mock agent pipeline data ─────────────────────────────── */
const PIPELINE_AGENTS = [
  {
    id: 'triage',
    name: 'Triage Agent',
    role: 'Severity Classification',
    icon: '⚡',
    color: '#38bdf8',
    description: 'Classifies bug severity, assigns priority, and routes to appropriate team',
    mockLogs: [
      '[INFO] Parsing incoming bug report payload...',
      '[INFO] Tokenizing error description with BERT encoder...',
      '[PROC] Running zero-shot severity classifier...',
      '[RESULT] Priority: CRITICAL | Severity Score: 9.2/10',
      '[RESULT] Component: payment-processor | Team: Platform Infra',
      '[INFO] Triage metadata attached to context vector.',
      '[✓] Triage complete. Passing to Log Parser Agent →',
    ],
  },
  {
    id: 'logparser',
    name: 'Log Parser Agent',
    role: 'Structured Log Extraction',
    icon: '📋',
    color: '#a78bfa',
    description: 'Extracts error signals, stack traces, and HTTP codes from unstructured logs',
    mockLogs: [
      '[INFO] Receiving raw log payload (14.2 KB)...',
      '[PROC] Applying regex pattern extraction: stack_trace_v3...',
      '[FOUND] Exception: AttributeError — NoneType has no attr "process"',
      '[FOUND] Failure point: processor.py:L247 → _handle_gateway()',
      '[FOUND] HTTP 500 triggered at /api/v2/payments/charge',
      '[PROC] Vectorizing log fingerprint for RAG lookup...',
      '[✓] Extraction complete. 3 error signals captured. Passing to RAG Matcher →',
    ],
  },
  {
    id: 'ragmatcher',
    name: 'Vector RAG Matcher',
    role: 'Historical Context Retrieval',
    icon: '🧠',
    color: '#34d399',
    description: 'Performs semantic similarity search against 50K+ historical bug embeddings',
    mockLogs: [
      '[INFO] Generating query embedding via text-embedding-ada-002...',
      '[INFO] Searching ChromaDB index: 52,841 vectors...',
      '[FOUND] Match #1: BUG-4821 | similarity=0.924 | "AttributeError in payment module"',
      '[FOUND] Match #2: BUG-3119 | similarity=0.871 | "NoneType processor crash"',
      '[FOUND] Match #3: BUG-5502 | similarity=0.839 | "Gateway timeout 500 sequence"',
      '[PROC] Building historical context window (top 3 matches)...',
      '[✓] RAG retrieval complete. Context window ready. Passing to Remediation Agent →',
    ],
  },
  {
    id: 'remediation',
    name: 'Remediation Agent',
    role: 'Fix Strategy Generation',
    icon: '🛠',
    color: '#fb923c',
    description: 'Synthesizes repair plan using LLM reasoning + historical resolution patterns',
    mockLogs: [
      '[INFO] Loading GPT-4o remediation chain with retrieved context...',
      '[PROC] Analyzing root cause category: null_reference_error...',
      '[PROC] Cross-referencing resolutions from BUG-4821, BUG-3119...',
      '[GEN] Drafting permanent fix: add null-guard in _handle_gateway() L247...',
      '[GEN] Immediate mitigation: deploy null-check hotfix to processor.py...',
      '[GEN] Regression test suite: 7 test cases scaffolded...',
      '[GEN] Generating PR patch diff for hotfix-processor-null-guard-8f3a...',
      '[✓] Remediation strategy complete. Report finalized.',
    ],
  },
];

/* ── Single Agent Node ────────────────────────────────────── */
function AgentNode({ agent, status, onToggleLogs, isLogsOpen, progress }) {
  const isActive = status === 'running';
  const isDone = status === 'done';
  const isPending = status === 'pending';

  return (
    <div
      className={`agent-node ${status}`}
      style={{ '--agent-color': agent.color }}
      onClick={() => isDone || isActive ? onToggleLogs(agent.id) : null}
    >
      {/* Pulse ring for active node */}
      {isActive && <div className="agent-pulse-ring" />}

      <div className="agent-node-header">
        <div className="agent-icon-wrap" style={{ background: `${agent.color}22`, border: `1.5px solid ${agent.color}55` }}>
          <span className="agent-icon">{agent.icon}</span>
        </div>
        <div className="agent-node-info">
          <span className="agent-node-name">{agent.name}</span>
          <span className="agent-node-role">{agent.role}</span>
        </div>
        <div className="agent-node-status-badge">
          {isActive && <span className="status-badge running">● RUNNING</span>}
          {isDone && <span className="status-badge done">✓ DONE</span>}
          {isPending && <span className="status-badge pending">○ WAITING</span>}
        </div>
      </div>

      {/* Progress bar while running */}
      {isActive && (
        <div className="agent-progress-track">
          <div className="agent-progress-fill" style={{ width: `${progress}%`, background: agent.color }} />
        </div>
      )}

      {/* Description */}
      <p className="agent-node-desc">{agent.description}</p>

      {/* Expandable Logs */}
      {(isDone || isActive) && isLogsOpen && (
        <div className="agent-log-drawer">
          <div className="agent-log-header">
            <span>📄 Agent Runtime Logs</span>
            <span className="log-live-badge">{isActive ? '● LIVE' : '○ COMPLETED'}</span>
          </div>
          <div className="agent-log-body">
            <AgentLogStream agent={agent} isActive={isActive} />
          </div>
        </div>
      )}

      {(isDone || isActive) && (
        <button
          className="agent-log-toggle-btn"
          onClick={(e) => { e.stopPropagation(); onToggleLogs(agent.id); }}
          style={{ color: agent.color }}
        >
          {isLogsOpen ? '▲ Hide Logs' : '▼ Expand Logs'}
        </button>
      )}
    </div>
  );
}

/* ── Streaming Log Component ──────────────────────────────── */
function AgentLogStream({ agent, isActive }) {
  const [visibleLogs, setVisibleLogs] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    setVisibleLogs([]);
    let i = 0;
    const interval = setInterval(() => {
      if (i < agent.mockLogs.length) {
        setVisibleLogs(prev => [...prev, agent.mockLogs[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, isActive ? 320 : 60);
    return () => clearInterval(interval);
  }, [agent.id, isActive]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  return (
    <div className="log-stream" ref={logRef}>
      {visibleLogs.map((line, idx) => (
        <div
          key={idx}
          className={`log-line ${line.includes('[✓]') ? 'log-success' : line.includes('[RESULT]') || line.includes('[FOUND]') ? 'log-found' : line.includes('[GEN]') ? 'log-gen' : ''}`}
          style={{ animationDelay: `${idx * 0.03}s` }}
        >
          <span className="log-timestamp">{`${String(Math.floor(Math.random() * 23)).padStart(2,'0')}:${String(Math.floor(Math.random()*59)).padStart(2,'0')}:${String(Math.floor(Math.random()*59)).padStart(2,'0')}`}</span>
          <span className="log-text">{line}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Connector Arrow ──────────────────────────────────────── */
function PipelineConnector({ fromColor, toColor, active, done }) {
  return (
    <div className={`pipeline-connector ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
      <div
        className="connector-line"
        style={done || active ? { background: `linear-gradient(90deg, ${fromColor}, ${toColor})` } : {}}
      />
      <div className={`connector-arrow ${done || active ? 'lit' : ''}`} style={done || active ? { borderLeftColor: toColor } : {}}>
        <div className={`data-packet ${active ? 'flowing' : done ? 'arrived' : ''}`} style={{ background: fromColor }} />
      </div>
    </div>
  );
}

/* ── Execution Metrics Strip ──────────────────────────────── */
function ExecutionMetrics({ activeIndex, startTime }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const t = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(t);
  }, [startTime]);

  const formatMs = (ms) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  return (
    <div className="exec-metrics-strip">
      <div className="exec-metric">
        <span className="exec-metric-label">Pipeline Stage</span>
        <span className="exec-metric-value" style={{ color: '#38bdf8' }}>
          {activeIndex >= 0 ? `${activeIndex + 1} / ${PIPELINE_AGENTS.length}` : '0 / 4'}
        </span>
      </div>
      <div className="exec-metric">
        <span className="exec-metric-label">Elapsed Time</span>
        <span className="exec-metric-value" style={{ color: '#34d399' }}>
          {startTime ? formatMs(elapsed) : '—'}
        </span>
      </div>
      <div className="exec-metric">
        <span className="exec-metric-label">Active Agent</span>
        <span className="exec-metric-value" style={{ color: '#a78bfa' }}>
          {activeIndex >= 0 && activeIndex < PIPELINE_AGENTS.length
            ? PIPELINE_AGENTS[activeIndex].name
            : activeIndex >= PIPELINE_AGENTS.length ? 'Complete' : 'Idle'}
        </span>
      </div>
      <div className="exec-metric">
        <span className="exec-metric-label">Vector Ops</span>
        <span className="exec-metric-value" style={{ color: '#fb923c' }}>
          {activeIndex >= 2 ? '52,841' : activeIndex >= 0 ? '—' : '—'}
        </span>
      </div>
      <div className="exec-metric">
        <span className="exec-metric-label">Tokens Used</span>
        <span className="exec-metric-value" style={{ color: '#f472b6' }}>
          {activeIndex >= PIPELINE_AGENTS.length ? '~14,920' : activeIndex >= 0 ? `~${(activeIndex + 1) * 3500}` : '—'}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* Main Component                                            */
/* ══════════════════════════════════════════════════════════ */
export default function AgentControlRoom() {
  const [runState, setRunState] = useState('idle'); // idle | running | complete
  const [activeIndex, setActiveIndex] = useState(-1);
  const [nodeProgress, setNodeProgress] = useState(0);
  const [openLogs, setOpenLogs] = useState({});
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);
  const progressRef = useRef(null);

  // Derive status for each agent node
  const getStatus = useCallback((idx) => {
    if (activeIndex < 0) return 'pending';
    if (idx < activeIndex) return 'done';
    if (idx === activeIndex) return 'running';
    return 'pending';
  }, [activeIndex]);

  const handleToggleLogs = useCallback((agentId) => {
    setOpenLogs(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  }, []);

  const handleRunPipeline = () => {
    if (runState === 'running') return;
    setRunState('running');
    setActiveIndex(0);
    setStartTime(Date.now());
    setOpenLogs({ triage: true }); // Auto-open first agent logs
    setNodeProgress(0);

    let currentIdx = 0;

    // Progress fill per node
    progressRef.current = setInterval(() => {
      setNodeProgress(p => {
        if (p >= 100) return 0;
        return p + 4;
      });
    }, 120);

    // Advance pipeline
    intervalRef.current = setInterval(() => {
      currentIdx++;
      if (currentIdx < PIPELINE_AGENTS.length) {
        setActiveIndex(currentIdx);
        setNodeProgress(0);
        // Auto-open log for newly activated agent
        setOpenLogs(prev => ({ ...prev, [PIPELINE_AGENTS[currentIdx].id]: true }));
      } else {
        clearInterval(intervalRef.current);
        clearInterval(progressRef.current);
        setActiveIndex(PIPELINE_AGENTS.length); // signals complete
        setRunState('complete');
      }
    }, 3200);
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    clearInterval(progressRef.current);
    setRunState('idle');
    setActiveIndex(-1);
    setNodeProgress(0);
    setOpenLogs({});
    setStartTime(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(progressRef.current);
    };
  }, []);

  return (
    <div className="agent-control-room card">
      {/* Header */}
      <div className="acr-header">
        <div className="acr-title-group">
          <div className="acr-title-icon">🤖</div>
          <div>
            <h2 className="acr-title">Live Multi-Agent Execution Control Room</h2>
            <p className="acr-subtitle">Real-time autonomous pipeline orchestration — watch agents collaborate to diagnose and remediate defects</p>
          </div>
        </div>
        <div className="acr-controls">
          {runState === 'idle' && (
            <button className="btn-launch" onClick={handleRunPipeline} id="launch-pipeline-btn">
              <span className="btn-launch-icon">▶</span>
              Launch Pipeline
            </button>
          )}
          {runState === 'running' && (
            <div className="acr-running-indicator">
              <div className="acr-spinner" />
              <span>Pipeline Running…</span>
            </div>
          )}
          {runState === 'complete' && (
            <div className="acr-complete-actions">
              <span className="acr-complete-badge">✓ Pipeline Complete</span>
              <button className="btn-reset" onClick={handleReset}>↺ Reset</button>
            </div>
          )}
        </div>
      </div>

      {/* Execution Metrics */}
      <ExecutionMetrics
        activeIndex={activeIndex}
        startTime={startTime}
      />

      {/* Pipeline Flow */}
      <div className="pipeline-flow-container">
        {PIPELINE_AGENTS.map((agent, idx) => (
          <React.Fragment key={agent.id}>
            <AgentNode
              agent={agent}
              status={getStatus(idx)}
              onToggleLogs={handleToggleLogs}
              isLogsOpen={!!openLogs[agent.id]}
              progress={activeIndex === idx ? nodeProgress : 0}
            />
            {idx < PIPELINE_AGENTS.length - 1 && (
              <PipelineConnector
                fromColor={agent.color}
                toColor={PIPELINE_AGENTS[idx + 1].color}
                active={activeIndex === idx}
                done={activeIndex > idx}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Final success banner */}
      {runState === 'complete' && (
        <div className="pipeline-complete-banner">
          <div className="pcb-icon">🎯</div>
          <div className="pcb-text">
            <strong>All 4 Agents Completed Successfully</strong>
            <p>Triage → Log Parsing → RAG Matching → Remediation — Full defect analysis pipeline executed in {startTime ? `${((Date.now() - startTime)/1000).toFixed(1)}s` : '—'}</p>
          </div>
          <div className="pcb-stats">
            <span>52,841 vectors searched</span>
            <span>3 historical matches</span>
            <span>7 regression tests generated</span>
          </div>
        </div>
      )}
    </div>
  );
}
