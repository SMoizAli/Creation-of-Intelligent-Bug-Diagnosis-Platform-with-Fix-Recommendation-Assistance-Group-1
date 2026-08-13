import React, { useState, useCallback, useRef } from 'react';

/* ══════════════════════════════════════════════════════════════
   5 Pre-configured Milestone 4 Bug Scenarios
   ══════════════════════════════════════════════════════════════ */
const SCENARIOS = [
  {
    id: 1,
    label: 'Java Concurrency / Redis Timeout',
    tag: 'Java · Distributed Systems',
    component: 'PaymentGateway',
    icon: '☕',
    langColor: '#f87171',
    errorType: 'RedisConnectionException + ThreadDeadlock',
    formatType: 'Java Stack Trace + JSON Metrics',
    bugPreview: `[CRITICAL] 2026-07-15T14:32:11Z PaymentGateway-Service
java.lang.Thread.State: BLOCKED (on object monitor)
  at com.payments.gateway.RedisPool.acquire(RedisPool.java:142)
  - waiting to lock <0x00000007b3f44f28> (a com.payments.gateway.ConnectionPool)
  at com.payments.gateway.PaymentProcessor.processTransaction(PaymentProcessor.java:98)
io.lettuce.core.RedisCommandTimeoutException: Command timed out after 5000 millisecond(s)
  at io.lettuce.core.LettuceFutures.awaitOrCancel(LettuceFutures.java:114)
redis.pool.active=50, redis.pool.max=50, redis.waiters=128
transaction_failures_last_5min: 847`,
    triage: { priority: 'CRITICAL', component: 'PaymentGateway', team: 'Payments Engineering', severity: 9.4 },
    rootCause: { category: 'Resource Exhaustion / Deadlock', confidence: 94, hypothesis: 'Redis connection pool fully saturated (50/50). Thread contention causes cascading BLOCKED state across payment processors, resulting in request backpressure.' },
    duplicate: { isDuplicate: true, matchRate: 91.2, matchedBugId: 'KB-001', similarity: 0.912 },
    kbMapping: { vectorId: 'chroma-vec-001', component: 'PaymentGateway', verified: true },
    remediation: { effort: 'Medium', steps: ['Increase Redis connection pool to 150 max', 'Add circuit breaker (Resilience4j) with 5s timeout', 'Implement retry-with-backoff for failed transactions', 'Add pool utilization alerting at 80% threshold'] },
  },
  {
    id: 2,
    label: 'Python OutOfMemory / Spark Shuffle',
    tag: 'Python · Big Data',
    component: 'DataPipeline',
    icon: '🐍',
    langColor: '#34d399',
    errorType: 'OutOfMemoryError + SparkShuffleException',
    formatType: 'Python Traceback + Spark Event Log',
    bugPreview: `ERROR 2026-07-18 09:12:43,211 SparkContext: Error initializing SparkContext
org.apache.spark.shuffle.FetchFailedException: Failed to connect to /10.0.1.34:7337
  at org.apache.spark.storage.ShuffleBlockFetcherIterator.throwFetchFailedException
Caused by: java.io.IOException: Connection refused to /10.0.1.34:7337

Python Traceback:
  File "pipeline/etl_processor.py", line 341, in run_aggregation
    result_df = spark.sql(aggregation_query).collect()
pyspark.errors.PySparkException: Job aborted due to stage failure:
OutOfMemoryError: GC overhead limit exceeded
Executor memory: 8g, peak usage: 9.2g`,
    triage: { priority: 'HIGH', component: 'DataPipeline', team: 'Data Engineering', severity: 8.1 },
    rootCause: { category: 'Resource Exhaustion', confidence: 89, hypothesis: 'Spark executor memory configuration (8g) insufficient for large shuffle operations. GC pressure causes OOM, triggering shuffle fetch failure cascade.' },
    duplicate: { isDuplicate: true, matchRate: 87.6, matchedBugId: 'KB-002', similarity: 0.876 },
    kbMapping: { vectorId: 'chroma-vec-002', component: 'DataPipeline', verified: true },
    remediation: { effort: 'Medium', steps: ['Set spark.executor.memory=12g, memoryOverhead=4g', 'Tune spark.sql.shuffle.partitions from 200 → 800', 'Enable adaptive query execution (AQE)', 'Add off-heap memory buffer for shuffle spills'] },
  },
  {
    id: 3,
    label: 'Node.js Unhandled Promise Rejection',
    tag: 'Node.js · Async',
    component: 'APIGateway',
    icon: '🟢',
    langColor: '#4ade80',
    errorType: 'UnhandledPromiseRejectionWarning + ProcessCrash',
    formatType: 'Node.js Exception Log + PM2 Crash Report',
    bugPreview: `[2026-07-22 17:45:33 +0000] [ERROR] APIGateway crash detected
(node:14823) UnhandledPromiseRejectionWarning: Error: ETIMEDOUT
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1148:16)
(node:14823) UnhandledPromiseRejectionWarning: Unhandled promise rejection.
This error originated either by throwing inside of an async function
without a catch block, or by rejecting a promise which was not handled

PM2 Log: App [api-gateway] crashed — Restarting (attempt 7/10)
Process restarts in last hour: 7
Avg response time before crash: 2847ms (normal: 180ms)
Active connections at crash: 3,421`,
    triage: { priority: 'HIGH', component: 'APIGateway', team: 'Platform Engineering', severity: 8.3 },
    rootCause: { category: 'Concurrency / Error Handling', confidence: 91, hypothesis: 'Missing async error boundary in gateway request handler. ETIMEDOUT from downstream service propagates as unhandled rejection, crashing the Node.js process.' },
    duplicate: { isDuplicate: true, matchRate: 89.4, matchedBugId: 'KB-003', similarity: 0.894 },
    kbMapping: { vectorId: 'chroma-vec-003', component: 'APIGateway', verified: true },
    remediation: { effort: 'Small', steps: ['Add process.on("unhandledRejection") global handler', 'Wrap all async route handlers with try/catch or asyncHandler()', 'Set downstream timeout to 3s with explicit error throw', 'Configure PM2 max-restart threshold with alert webhook'] },
  },
  {
    id: 4,
    label: 'SQL Deadlock / Transaction Failure',
    tag: 'SQL · Java · Database',
    component: 'DatabaseService',
    icon: '🗄️',
    langColor: '#f59e0b',
    errorType: 'SQLDeadlockException + TransactionRollback',
    formatType: 'SQL Server Error Log + Java Exception',
    bugPreview: `[2026-07-25 11:23:47] MSSQL Deadlock Graph detected:
  Process 78: UPDATE orders SET status='PROCESSING' WHERE order_id=44821 WAIT
  Process 91: UPDATE inventory SET quantity=quantity-1 WHERE sku='ITEM-882' WAIT
  Process 78 chosen as deadlock victim.

com.microsoft.sqlserver.jdbc.SQLServerException: Transaction (Process ID 78)
was deadlocked on lock resources with another process.
  at com.db.OrderService.updateOrderStatus(OrderService.java:234)
  at com.db.CheckoutOrchestrator.processCheckout(CheckoutOrchestrator.java:156)
Spring @Transactional rollback triggered: OrderStatusUpdateException
Affected orders: 127 in last 10 minutes`,
    triage: { priority: 'CRITICAL', component: 'DatabaseService', team: 'Backend Engineering', severity: 9.2 },
    rootCause: { category: 'Database / Concurrency', confidence: 97, hypothesis: 'Circular lock dependency between orders and inventory tables during concurrent checkout. Resource acquisition ordering inconsistency causes classic deadlock pattern.' },
    duplicate: { isDuplicate: true, matchRate: 95.8, matchedBugId: 'KB-004', similarity: 0.958 },
    kbMapping: { vectorId: 'chroma-vec-004', component: 'DatabaseService', verified: true },
    remediation: { effort: 'Large', steps: ['Enforce consistent table lock ordering (always orders → inventory)', 'Implement optimistic locking with @Version annotation', 'Add DEADLOCK_PRIORITY LOW on less-critical transactions', 'Retry-on-deadlock decorator (max 3 attempts, exp. backoff)', 'Index ORDER BY columns to reduce lock scan range'] },
  },
  {
    id: 5,
    label: 'NullPointerException — Auth Service',
    tag: 'Java · Security',
    component: 'AuthService',
    icon: '🔐',
    langColor: '#c084fc',
    errorType: 'NullPointerException + TokenValidationFailure',
    formatType: 'Java Stack Trace + Spring Security Log',
    bugPreview: `[2026-07-28 08:15:03] [ERROR] AuthService - Token validation failed
java.lang.NullPointerException: Cannot invoke method getClaims() on null object
  at com.auth.service.JwtTokenValidator.validateToken(JwtTokenValidator.java:87)
  at com.auth.filter.JwtAuthenticationFilter.doFilterInternal(JwtAuthenticationFilter.java:52)
  at org.springframework.web.filter.OncePerRequestFilter.doFilter(OncePerRequestFilter.java:119)

Spring Security: 401 Unauthorized — Token validation chain terminated
Affected endpoints: /api/v1/user/*, /api/v1/orders/*, /api/v1/payments/*
Login failure rate: 34% (baseline: 0.2%)
Impacted active sessions: ~8,400`,
    triage: { priority: 'CRITICAL', component: 'AuthService', team: 'Security Engineering', severity: 9.7 },
    rootCause: { category: 'Null Reference / Security', confidence: 96, hypothesis: 'Jjwt parser returns null Claims object when token is malformed or expired, without throwing. Downstream code assumes non-null Claims, causing NPE during token introspection.' },
    duplicate: { isDuplicate: true, matchRate: 93.5, matchedBugId: 'KB-005', similarity: 0.935 },
    kbMapping: { vectorId: 'chroma-vec-005', component: 'AuthService', verified: true },
    remediation: { effort: 'Small', steps: ['Add null-guard: if (claims == null) throw new InvalidTokenException()', 'Wrap parser in try-catch for JwtException subtypes', 'Use Optional<Claims> return type for validateToken()', 'Add integration test for malformed/expired/null token cases'] },
  },
];

/* ── Pipeline stage labels ─────────────────────────────────── */
const PIPELINE_STAGES = [
  { label: 'Format Detection & Parsing',    icon: '📄' },
  { label: 'Data Normalization',             icon: '🔧' },
  { label: 'Embedding Generation',           icon: '🧬' },
  { label: 'Vector Index Lookup (ChromaDB)', icon: '🔍' },
  { label: 'Triage Agent Classification',   icon: '⚡' },
  { label: 'Log Parser Scanning',            icon: '📋' },
  { label: 'Duplicate Detection Query',      icon: '🔁' },
  { label: 'Root Cause Diagnostics',         icon: '🔬' },
  { label: 'KB Similarity Mapping',          icon: '📚' },
  { label: 'Remediation Advisory',           icon: '🛠' },
  { label: 'Risk Assessment Profiling',      icon: '⚠️' },
  { label: 'Report Compilation',             icon: '📊' },
];

const STAGE_DURATION = 320; // ms per stage

/* ── Small helpers ─────────────────────────────────────────── */
const pct = v => Math.min(100, Math.max(0, v <= 1 ? v * 100 : v));

export default function Milestone4DemoPanel() {
  const [activeScenario, setActiveScenario] = useState(null);
  const [pipelineStage, setPipelineStage]   = useState(-1);
  const [running, setRunning]               = useState(false);
  const [showResults, setShowResults]       = useState(false);
  const [viewLog, setViewLog]               = useState(false);
  const intervalRef = useRef(null);

  /* ── Load + run simulation ─────────────────────────────── */
  const loadScenario = useCallback((scenario) => {
    // Clear any previous run
    clearInterval(intervalRef.current);
    setActiveScenario(scenario);
    setPipelineStage(-1);
    setShowResults(false);
    setViewLog(false);
    setRunning(true);

    let stage = 0;
    intervalRef.current = setInterval(() => {
      setPipelineStage(stage);
      stage++;
      if (stage >= PIPELINE_STAGES.length) {
        clearInterval(intervalRef.current);
        setRunning(false);
        setShowResults(true);
      }
    }, STAGE_DURATION);
  }, []);

  const resetDemo = () => {
    clearInterval(intervalRef.current);
    setActiveScenario(null);
    setPipelineStage(-1);
    setShowResults(false);
    setRunning(false);
    setViewLog(false);
  };

  const progressPct = pipelineStage < 0
    ? 0
    : Math.round(((pipelineStage + 1) / PIPELINE_STAGES.length) * 100);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="m4-container">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="card m4-header-card">
        <div className="m4-header-inner">
          <div>
            <h2 className="m4-title">End-to-End Demo Testing</h2>
            <p className="section-subtitle" style={{ marginBottom: 0 }}>
              Test 5 Distinct Bug Submissions — validates multi-format parsing, duplicate detection, and KB mapping across diverse language stacks
            </p>
          </div>
          {activeScenario && (
            <button className="btn btn-secondary" onClick={resetDemo}>↺ Reset</button>
          )}
        </div>
      </div>

      {/* ── Scenario selector grid ───────────────────────────── */}
      <div className="m4-scenario-grid">
        {SCENARIOS.map(sc => (
          <div
            key={sc.id}
            className={`m4-scenario-card ${activeScenario?.id === sc.id ? 'm4-scenario-card--active' : ''}`}
            onClick={() => !running && loadScenario(sc)}
          >
            <div className="m4-sc-header">
              <span className="m4-sc-num">#{sc.id}</span>
              <span className="m4-sc-icon" style={{ background: sc.langColor + '22', color: sc.langColor }}>
                {sc.icon}
              </span>
            </div>
            <h4 className="m4-sc-label">{sc.label}</h4>
            <span className="m4-sc-tag">{sc.tag}</span>
            <div className="m4-sc-meta">
              <span className="m4-sc-comp">{sc.component}</span>
              <span className="m4-sc-dup-rate" style={{ color: '#10b981' }}>
                ~{(sc.duplicate.matchRate).toFixed(1)}% Match
              </span>
            </div>
            <button
              className={`btn m4-load-btn ${activeScenario?.id === sc.id && running ? 'm4-load-btn--running' : ''}`}
              disabled={running}
              onClick={e => { e.stopPropagation(); loadScenario(sc); }}
              style={{ borderColor: sc.langColor + '55', color: running ? undefined : sc.langColor }}
            >
              {activeScenario?.id === sc.id && running ? '⏳ Running…' : '▶ Load Scenario'}
            </button>
          </div>
        ))}
      </div>

      {/* ── Pipeline Execution Panel (visible once a scenario is selected) ── */}
      {activeScenario && (
        <div className="card m4-pipeline-card">
          <div className="m4-pipeline-header">
            <div>
              <h3>
                <span style={{ color: activeScenario.langColor }}>{activeScenario.icon}</span>
                {' '}{activeScenario.label}
              </h3>
              <p className="section-subtitle" style={{ marginBottom: 0 }}>
                {activeScenario.formatType} — {activeScenario.component}
              </p>
            </div>
            <button
              className="m4-log-toggle"
              onClick={() => setViewLog(v => !v)}
            >
              {viewLog ? '🔼 Hide Log Preview' : '📄 View Raw Log'}
            </button>
          </div>

          {/* Raw log preview */}
          {viewLog && (
            <pre className="m4-log-pre">{activeScenario.bugPreview}</pre>
          )}

          {/* Progress bar */}
          <div className="m4-progress-bar-wrap">
            <div className="m4-progress-bg">
              <div
                className="m4-progress-fill"
                style={{
                  width: `${showResults ? 100 : progressPct}%`,
                  background: `linear-gradient(90deg, ${activeScenario.langColor}, #818cf8)`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span className="m4-progress-label">
              {showResults ? '100% — Complete' : running ? `${progressPct}% — Processing…` : 'Ready'}
            </span>
          </div>

          {/* Stage list */}
          <div className="m4-stages-grid">
            {PIPELINE_STAGES.map((stage, idx) => {
              let stateClass = 'pending';
              if (showResults || pipelineStage > idx) stateClass = 'done';
              else if (pipelineStage === idx) stateClass = 'running';
              return (
                <div key={idx} className={`m4-stage-item m4-stage-item--${stateClass}`}>
                  <span className="m4-stage-icon-wrap">
                    {stateClass === 'done' ? '✓' : stateClass === 'running' ? '⟳' : stage.icon}
                  </span>
                  <span className="m4-stage-label">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results Panel (shown after pipeline completes) ─── */}
      {showResults && activeScenario && (
        <div className="m4-results-container">

          {/* Result header */}
          <div className="m4-results-header">
            <h3>📊 Analysis Results</h3>
            <span className="m4-complete-badge">✓ Pipeline Complete</span>
          </div>

          <div className="m4-results-grid">

            {/* Triage */}
            <div className="card m4-result-card">
              <h4 className="m4-result-card-title">⚡ Triage Classification</h4>
              <div className="m4-result-rows">
                <div className="m4-result-row">
                  <span className="m4-row-label">Priority</span>
                  <span className={`badge-priority ${activeScenario.triage.priority.toLowerCase()}`}>
                    {activeScenario.triage.priority}
                  </span>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Severity Score</span>
                  <span className="m4-row-val m4-row-val--em">{activeScenario.triage.severity} / 10</span>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Component</span>
                  <span className="badge-component">{activeScenario.triage.component}</span>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Assignee Team</span>
                  <span className="m4-row-val">{activeScenario.triage.team}</span>
                </div>
              </div>
            </div>

            {/* Root Cause */}
            <div className="card m4-result-card">
              <h4 className="m4-result-card-title">🔬 Root Cause Analysis</h4>
              <div className="m4-conf-bar-wrap">
                <div className="m4-conf-bar-label-row">
                  <span>AI Confidence</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    {activeScenario.rootCause.confidence}%
                  </span>
                </div>
                <div className="m4-conf-bg">
                  <div
                    className="m4-conf-fill"
                    style={{ width: `${activeScenario.rootCause.confidence}%` }}
                  />
                </div>
              </div>
              <div className="m4-root-category">
                <span className="evidence-tag tag-purple">
                  {activeScenario.rootCause.category}
                </span>
              </div>
              <p className="m4-hypothesis">{activeScenario.rootCause.hypothesis}</p>
            </div>

            {/* Duplicate Detection */}
            <div className="card m4-result-card">
              <h4 className="m4-result-card-title">🔁 Duplicate Detection</h4>
              <div className={`m4-dup-verdict ${activeScenario.duplicate.isDuplicate ? 'm4-dup-verdict--yes' : 'm4-dup-verdict--no'}`}>
                {activeScenario.duplicate.isDuplicate ? '⚠️ Duplicate Detected' : '✅ Unique Issue'}
              </div>
              <div className="m4-result-rows" style={{ marginTop: '1rem' }}>
                <div className="m4-result-row">
                  <span className="m4-row-label">Match Rate</span>
                  <span className="m4-row-val m4-row-val--em" style={{ color: '#10b981' }}>
                    {activeScenario.duplicate.matchRate.toFixed(1)}%
                  </span>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Matched Bug</span>
                  <code className="kb-bug-id">{activeScenario.duplicate.matchedBugId}</code>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Vector Similarity</span>
                  <span className="m4-row-val">{(activeScenario.duplicate.similarity * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Sim bar */}
              <div className="sim-bar-bg" style={{ marginTop: '0.75rem' }}>
                <div
                  className="sim-bar-fill"
                  style={{
                    width: `${activeScenario.duplicate.similarity * 100}%`,
                    background: 'linear-gradient(90deg, #10b981, #34d399)',
                  }}
                />
              </div>
            </div>

            {/* KB Mapping */}
            <div className="card m4-result-card">
              <h4 className="m4-result-card-title">📚 Knowledge Base Mapping</h4>
              <div className="m4-kb-map-indicator">
                <span className="m4-kb-map-dot" />
                <span>Mapped to ChromaDB Vector Store</span>
              </div>
              <div className="m4-result-rows" style={{ marginTop: '1rem' }}>
                <div className="m4-result-row">
                  <span className="m4-row-label">Vector ID</span>
                  <code className="kb-bug-id" style={{ fontSize: '0.75rem' }}>
                    {activeScenario.kbMapping.vectorId}
                  </code>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Component</span>
                  <span className="badge-component">{activeScenario.kbMapping.component}</span>
                </div>
                <div className="m4-result-row">
                  <span className="m4-row-label">Verified</span>
                  <span className="kb-verified kb-verified--yes">✓ Verified</span>
                </div>
              </div>
            </div>

          </div>

          {/* Remediation Steps */}
          <div className="card m4-remediation-card">
            <h4 className="m4-result-card-title">
              🛠 Remediation Plan
              <span
                className="effort-badge"
                style={{ marginLeft: '0.75rem', fontSize: '0.75rem',
                  background: activeScenario.remediation.effort === 'Small' ? 'rgba(16,185,129,0.15)' : activeScenario.remediation.effort === 'Large' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  color:      activeScenario.remediation.effort === 'Small' ? '#10b981' : activeScenario.remediation.effort === 'Large' ? '#ef4444' : '#f59e0b',
                  border:     `1px solid ${activeScenario.remediation.effort === 'Small' ? '#10b981' : activeScenario.remediation.effort === 'Large' ? '#ef4444' : '#f59e0b'}55`,
                }}
              >
                {activeScenario.remediation.effort} Effort
              </span>
            </h4>
            <ol className="remediation-steps-list" style={{ marginTop: '1rem' }}>
              {activeScenario.remediation.steps.map((step, i) => (
                <li key={i} className="remediation-step-item">
                  <span className="rem-step-num">{i + 1}</span>
                  <span className="rem-step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Summary strip */}
          <div className="m4-summary-strip card">
            <div className="m4-strip-cell">
              <span className="m4-strip-icon">🎯</span>
              <div>
                <div className="m4-strip-val">5 / 5</div>
                <div className="m4-strip-label">Formats Validated</div>
              </div>
            </div>
            <div className="m4-strip-cell">
              <span className="m4-strip-icon">🔁</span>
              <div>
                <div className="m4-strip-val" style={{ color: '#10b981' }}>
                  {activeScenario.duplicate.matchRate.toFixed(1)}%
                </div>
                <div className="m4-strip-label">Duplicate Match Rate</div>
              </div>
            </div>
            <div className="m4-strip-cell">
              <span className="m4-strip-icon">🧠</span>
              <div>
                <div className="m4-strip-val" style={{ color: '#c084fc' }}>
                  {activeScenario.rootCause.confidence}%
                </div>
                <div className="m4-strip-label">AI Confidence</div>
              </div>
            </div>
            <div className="m4-strip-cell">
              <span className="m4-strip-icon">📚</span>
              <div>
                <div className="m4-strip-val" style={{ color: '#38bdf8' }}>Mapped</div>
                <div className="m4-strip-label">KB Vector Status</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
