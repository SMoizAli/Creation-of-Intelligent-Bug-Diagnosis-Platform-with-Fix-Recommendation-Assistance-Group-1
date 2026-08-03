import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

/* ── tiny helpers ─────────────────────────────────────────── */
const safe = (val, fallback = '—') =>
  val === null || val === undefined || val === '' || String(val).toLowerCase() === 'unknown'
    ? fallback
    : val;

const pct = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.min(100, Math.max(0, n <= 1 ? n * 100 : n));
};

const effortColor = (e = '') => {
  const m = e.toLowerCase();
  if (m === 'small') return 'var(--accent-green)';
  if (m === 'large') return 'var(--accent-red)';
  return 'var(--accent-amber)';
};

const similarityColor = (s = 0) => {
  if (s >= 0.8) return 'var(--accent-green)';
  if (s >= 0.5) return 'var(--accent-amber)';
  return 'var(--accent-red)';
};

const confidenceColor = (c = 0) => {
  const n = pct(c);
  if (n >= 75) return 'var(--accent-green)';
  if (n >= 50) return 'var(--accent-amber)';
  return 'var(--accent-red)';
};

/* ── Tab definitions ──────────────────────────────────────── */
const TABS = [
  { key: 'overview',    label: '🏠 Overview'    },
  { key: 'triage',      label: '⚡ Triage'       },
  { key: 'logs',        label: '📋 Log Evidence' },
  { key: 'root_cause',  label: '🔬 Root Cause'   },
  { key: 'duplicates',  label: '🔁 Duplicates'   },
  { key: 'remediation', label: '🛠 Remediation'  },
  { key: 'risk',        label: '⚠️ Risk'          },
];

/* ══════════════════════════════════════════════════════════ */
export default function ResultsPanel({ analysis, onDownload, onCopy }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis) {
    return (
      <div className="card results-panel empty">
        <p>No analysis results loaded yet. Submit and initiate analysis from the Upload view.</p>
      </div>
    );
  }

  /* destructure all agent outputs ──────────────────────── */
  const triage    = analysis.triage             || {};
  const logs      = analysis.log_analysis       || {};
  const rootCause = analysis.root_cause         || {};
  const duplicate = analysis.duplicate_detection || {};
  const remediation = analysis.remediation      || {};
  const risk      = analysis.risk_assessment    || {};
  const execSum   = analysis.executive_summary  || {};
  const confData  = analysis.confidence_scoring || {};

  const confidenceScore = confData.confidence_score ?? rootCause.confidence ?? 0;
  const confPct = pct(confidenceScore);

  /* action handlers ────────────────────────────────────── */
  const handleDownload = (format) => {
    const url = `${API_BASE}/analysis/${analysis.id}/download?format=${format}`;
    window.open(url, '_blank');
    onDownload?.();
  };

  const handleCopy = () => {
    const textReport = [
      `AI-Smart-Bug-Analyzer Analysis: ${analysis.summary}`,
      `Priority: ${triage.priority} | Component: ${triage.component}`,
      `Root Cause: ${rootCause.root_cause_category}`,
      `Hypothesis: ${rootCause.hypothesis}`,
      `Risk: ${risk.production_risk}`,
    ].join('\n');
    navigator.clipboard.writeText(textReport);
    onCopy?.();
  };

  /* ── render ─────────────────────────────────────────── */
  return (
    <div className="results-panel-container">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="results-header-card card">
        <div className="results-title-group">
          <h2>Analysis Findings Dashboard</h2>
          <span className="analysis-id-badge">ID: {analysis.id}</span>
        </div>
        <div className="results-quick-actions">
          <button className="btn btn-secondary" onClick={handleCopy}>Copy Findings</button>
          <div className="download-dropdown">
            <button className="btn btn-primary">Export Report ▾</button>
            <div className="download-dropdown-content">
              <button onClick={() => handleDownload('pdf')}>PDF Format</button>
              <button onClick={() => handleDownload('markdown')}>Markdown</button>
              <button onClick={() => handleDownload('text')}>Plain Text</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className="results-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Panels ─────────────────────────────────── */}
      <div className="tab-panels-container">

        {/* ════════════ OVERVIEW ════════════ */}
        {activeTab === 'overview' && (
          <div className="card overview-panel">
            {/* Bug Info banner */}
            <div className="overview-bug-banner">
              <div className="overview-bug-info">
                <h3>{safe(analysis.title || triage.component, 'Bug Analysis Report')}</h3>
                <span className="overview-file-chip">
                  📁 {safe(analysis.source_file || analysis.file_name, 'Uploaded File')}
                </span>
              </div>
              <span className={`badge-priority ${(triage.priority || 'medium').toLowerCase()}`}>
                {safe(triage.priority, 'MEDIUM')}
              </span>
            </div>

            {/* Metrics strip */}
            <div className="metrics-grid" style={{ marginTop: '1.5rem' }}>
              <div className="metric-box">
                <h4>Component</h4>
                <span className="badge-component">{safe(triage.component, 'Core System')}</span>
              </div>
              <div className="metric-box">
                <h4>Priority Class</h4>
                <span className={`badge-priority ${(triage.priority || 'medium').toLowerCase()}`}>
                  {safe(triage.priority, 'Medium')}
                </span>
              </div>
              <div className="metric-box">
                <h4>Root Cause</h4>
                <span className="badge-component">
                  {safe(rootCause.root_cause_category, 'code_defect').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="metric-box">
                <h4>Overall Confidence</h4>
                <span className="badge-confidence" style={{ color: confidenceColor(confidenceScore) }}>
                  {confPct.toFixed(0)}%
                </span>
              </div>
              <div className="metric-box">
                <h4>Production Risk</h4>
                <span className={`badge-risk ${(risk.production_risk || 'medium').toLowerCase()}`}>
                  {safe(risk.production_risk, 'Medium')}
                </span>
              </div>
              <div className="metric-box">
                <h4>Duplicate?</h4>
                <span className={duplicate.is_duplicate ? 'badge-dup-yes' : 'badge-dup-no'}>
                  {duplicate.is_duplicate ? '⚠️ Yes' : '✅ No'}
                </span>
              </div>
            </div>

            {/* Executive summary */}
            {execSum.summary && (
              <div className="card inner-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Executive Summary</h4>
                <p style={{ lineHeight: 1.7, opacity: 0.9 }}>{execSum.summary}</p>
              </div>
            )}

            {/* Key takeaways */}
            {execSum.key_takeaways?.length > 0 && (
              <div className="card inner-card" style={{ marginTop: '1rem', padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Key Diagnostic Takeaways</h4>
                <ul className="takeaway-list">
                  {execSum.key_takeaways.map((item, idx) => (
                    <li key={idx} className="takeaway-item">
                      <span className="takeaway-bullet">●</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick combined log + triage facts */}
            <div className="card inner-card" style={{ marginTop: '1rem', padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Combined Triage &amp; Log Analysis</h4>
              <table className="details-table">
                <tbody>
                  <tr>
                    <td><strong>Primary Exception</strong></td>
                    <td><code>{safe(logs.exception_type, 'No exception detected')}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Failure Point</strong></td>
                    <td><code>{safe(logs.failure_point, 'Not determined')}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Affected Code Path</strong></td>
                    <td><code>{safe(logs.affected_code_path, 'Not identified')}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Triage Reasoning</strong></td>
                    <td style={{ fontStyle: 'italic', opacity: 0.9 }}>{safe(triage.reasoning, 'Classification based on severity and component patterns.')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════ TRIAGE ════════════ */}
        {activeTab === 'triage' && (
          <div className="card triage-panel">
            <h3>⚡ Triage &amp; Classification</h3>
            <p className="section-subtitle">AI-driven severity classification and team routing</p>

            <div className="metrics-grid" style={{ marginTop: '1.5rem' }}>
              <div className="metric-box">
                <h4>Priority Class</h4>
                <span className={`badge-priority ${(triage.priority || 'medium').toLowerCase()}`}>
                  {safe(triage.priority, 'Medium')}
                </span>
              </div>
              <div className="metric-box">
                <h4>Severity Score</h4>
                <span className="badge-confidence">{safe(triage.severity_score, '—')} / 10</span>
              </div>
              <div className="metric-box">
                <h4>Component</h4>
                <span className="badge-component">{safe(triage.component, 'Core System')}</span>
              </div>
              <div className="metric-box">
                <h4>Assignee Team</h4>
                <span className="badge-component">{safe(triage.recommended_assignee_team, 'Engineering')}</span>
              </div>
            </div>

            <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Business Impact Statement</h4>
              <p style={{ lineHeight: 1.7 }}>{safe(triage.business_impact, 'Potential disruption to end-user workflows and service reliability.')}</p>
            </div>

            {triage.reasoning && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Triage Reasoning</h4>
                <p style={{ fontStyle: 'italic', opacity: 0.9, lineHeight: 1.7 }}>{triage.reasoning}</p>
              </div>
            )}

            {triage.tags?.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tags</h4>
                <div className="evidence-tags-row">
                  {triage.tags.map((tag, i) => (
                    <span key={i} className="evidence-tag tag-blue">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ LOGS ════════════ */}
        {activeTab === 'logs' && (
          <div className="card logs-panel">
            <h3>📋 Structured Log Evidence</h3>
            <p className="section-subtitle">Parsed error signals, stack traces, and failure indicators</p>

            <div className="logs-stats-row">
              <div className="log-stat-card">
                <strong>{safe(logs.error_count, 0)}</strong>
                <span>Error Signals</span>
              </div>
              <div className="log-stat-card">
                <strong>{logs.log_format ? logs.log_format.toUpperCase() : 'TEXT'}</strong>
                <span>Parsed Format</span>
              </div>
              <div className="log-stat-card">
                <strong>{logs.has_stack_trace ? '✓ Yes' : '✗ No'}</strong>
                <span>Stack Trace</span>
              </div>
              <div className="log-stat-card">
                <strong>{logs.http_status_codes?.length || 0}</strong>
                <span>HTTP Codes</span>
              </div>
            </div>

            <div className="card inner-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Log Diagnostics Summary</h4>
              <table className="details-table">
                <tbody>
                  <tr>
                    <td style={{ width: '35%' }}><strong>Primary Exception</strong></td>
                    <td><code>{safe(logs.exception_type, 'No exception detected')}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Failure Point</strong></td>
                    <td><code>{safe(logs.failure_point, 'Not determined')}</code></td>
                  </tr>
                  <tr>
                    <td><strong>Affected Code Path</strong></td>
                    <td><code>{safe(logs.affected_code_path, 'Not identified')}</code></td>
                  </tr>
                  {logs.http_status_codes?.length > 0 && (
                    <tr>
                      <td><strong>HTTP Status Codes</strong></td>
                      <td>{logs.http_status_codes.join(', ')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {logs.error_samples?.length > 0 && (
              <div className="log-section" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Critical Error Samples</h4>
                <ul className="error-list">
                  {logs.error_samples.map((s, idx) => (
                    <li key={idx} className="error-item">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {logs.has_stack_trace && logs.stack_trace_lines?.length > 0 && (
              <div className="log-section" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Diagnosed Stack Trace Lines</h4>
                <pre className="stack-trace-pre">
                  {logs.stack_trace_lines.join('\n')}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ════════════ ROOT CAUSE (NEW) ════════════ */}
        {activeTab === 'root_cause' && (
          <div className="card root-cause-panel">
            <h3>🔬 Root Cause Analysis</h3>
            <p className="section-subtitle">AI hypothesis, confidence scoring, and supporting evidence from the historical knowledge base</p>

            {/* Confidence Meter */}
            <div className="confidence-meter-card">
              <div className="confidence-meter-header">
                <span className="confidence-label">AI Confidence Score</span>
                <span className="confidence-value" style={{ color: confidenceColor(confidenceScore) }}>
                  {confPct.toFixed(1)}%
                </span>
              </div>
              <div className="confidence-meter-bg">
                <div
                  className="confidence-meter-fill"
                  style={{
                    width: `${confPct}%`,
                    background: confPct >= 75
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : confPct >= 50
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>
              <div className="confidence-meter-labels">
                <span>Low Confidence</span>
                <span>High Confidence</span>
              </div>
            </div>

            {/* Hypothesis Block */}
            <div className="root-cause-hypothesis-block">
              <div className="rch-label">
                <span className="rch-icon">💡</span>
                <span>Root Cause Category</span>
                <span className="evidence-tag tag-purple">
                  {safe(rootCause.root_cause_category, 'code_defect').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <p className="rch-text">
                {safe(rootCause.hypothesis, 'Likely code defect in the affected component module. Review recent commits and exception patterns.')}
              </p>
            </div>

            {/* Supporting Evidence */}
            {(rootCause.evidence?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>🧬</span>
                  Supporting Evidence from Knowledge Base
                </h4>
                <ul className="evidence-list">
                  {rootCause.evidence.map((ev, idx) => (
                    <li key={idx} className="evidence-list-item">
                      <span className="evidence-bullet">◆</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Diagnostic Steps */}
            {(rootCause.diagnostic_steps?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>📌</span>
                  Diagnostic Investigation Steps
                </h4>
                <ol className="diagnostic-steps-list">
                  {rootCause.diagnostic_steps.map((step, idx) => (
                    <li key={idx} className="diagnostic-step-item">
                      <span className="step-number">{idx + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Historical Resolutions */}
            {(rootCause.historical_resolutions?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>📚</span>
                  Historical Resolutions from KB
                </h4>
                <div className="evidence-tags-row">
                  {rootCause.historical_resolutions.map((res, idx) => (
                    <span key={idx} className="evidence-tag tag-green hist-res-tag">{res}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Likely Source Files */}
            {(rootCause.likely_source_files?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>📂</span>
                  Likely Affected Source Files
                </h4>
                <div className="evidence-tags-row">
                  {rootCause.likely_source_files.map((f, idx) => (
                    <code key={idx} className="evidence-tag tag-amber">{f}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Rationale */}
            {rootCause.rationale && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Analysis Rationale</h4>
                <p style={{ fontStyle: 'italic', opacity: 0.85, lineHeight: 1.7 }}>{rootCause.rationale}</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════ DUPLICATES (NEW) ════════════ */}
        {activeTab === 'duplicates' && (
          <div className="card duplicates-panel">
            <h3>🔁 Duplicate Detection Results</h3>
            <p className="section-subtitle">Top matching resolved issues ranked by vector similarity score</p>

            {/* Duplicate Banner */}
            <div className={`duplicate-verdict-banner ${duplicate.is_duplicate ? 'verdict-dup' : 'verdict-new'}`}>
              <div className="verdict-icon">{duplicate.is_duplicate ? '⚠️' : '✅'}</div>
              <div className="verdict-text">
                <strong>{duplicate.is_duplicate ? 'Duplicate Bug Detected' : 'No Exact Duplicate Found'}</strong>
                <p>
                  {duplicate.is_duplicate
                    ? `This bug matches existing issue #${safe(duplicate.duplicate_of, 'N/A')}. Recommendation: ${safe(duplicate.recommendation, 'Merge with existing ticket.')}`
                    : `This appears to be a new, unique issue. Recommendation: ${safe(duplicate.recommendation, 'Open a new bug ticket and investigate.')}`
                  }
                </p>
              </div>
            </div>

            {/* Similarity Matches */}
            {(duplicate.matches?.length > 0) ? (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                  Top {duplicate.matches.length} Similarity Matches
                </h4>
                {duplicate.matches.map((match, idx) => {
                  const sim = match.similarity ?? 0;
                  const simPct = pct(sim) || pct(sim * 100);
                  const actualPct = sim <= 1 ? sim * 100 : sim;
                  return (
                    <div key={idx} className="duplicate-match-card">
                      <div className="dup-match-header">
                        <div className="dup-match-id">
                          <span className="dup-rank">#{idx + 1}</span>
                          <strong>Bug ID: {safe(match.bug_id, `HIST-${idx + 1}`)}</strong>
                        </div>
                        <span
                          className="dup-sim-badge"
                          style={{ color: similarityColor(sim) }}
                        >
                          {actualPct.toFixed(1)}% Match
                        </span>
                      </div>

                      {/* Similarity Bar */}
                      <div className="sim-bar-bg">
                        <div
                          className="sim-bar-fill"
                          style={{
                            width: `${actualPct}%`,
                            background: sim >= 0.8
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : sim >= 0.5
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #ef4444, #f87171)',
                          }}
                        />
                      </div>

                      {match.rationale && (
                        <p className="dup-rationale">{match.rationale}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1.5rem', textAlign: 'center', opacity: 0.7 }}>
                <p>No similarity matches found above threshold in the knowledge base.</p>
              </div>
            )}

            {/* Historical Context from retrieved_context */}
            {(analysis.retrieved_context?.length > 0) && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                  📚 Historical Knowledge Base — Retrieved Issues
                </h4>
                {analysis.retrieved_context.map((ctx, idx) => {
                  const meta = ctx.metadata || {};
                  const sourceStr = (meta.source || 'seed').toLowerCase();
                  let sourceLabel = 'Enterprise KB';
                  if (sourceStr === 'mozilla') sourceLabel = 'Mozilla Repository';
                  else if (sourceStr === 'eclipse') sourceLabel = 'Eclipse Foundation';
                  else if (sourceStr === 'kaggle') sourceLabel = 'Kaggle / GitHub';
                  else if (sourceStr === 'software_heritage') sourceLabel = 'Software Heritage Archive';

                  const rawText = ctx.content || ctx.page_content || '';
                  const cleanText = rawText.replace(/\{[\s\S]*?\}|\[[\s\S]*?\]/g, '').trim() || rawText;

                  return (
                    <div key={idx} className="retrieved-issue-card">
                      <div className="ric-header">
                        <div>
                          <strong>Bug ID: {safe(meta.bug_id, `KB-${idx + 1}`)}</strong>
                          <span className="ric-source-badge">{sourceLabel}</span>
                        </div>
                        <span className={`badge-priority ${(meta.priority || 'medium').toLowerCase()}`}>
                          {safe(meta.priority, 'Medium')}
                        </span>
                      </div>
                      <p className="ric-meta">
                        <strong>Component:</strong> {safe(meta.component, 'General')} &nbsp;|&nbsp;
                        <strong>Date:</strong> {safe(meta.date, 'N/A')}
                      </p>
                      {meta.resolution && (
                        <div className="ric-resolution">
                          <strong>Historical Resolution:</strong> {meta.resolution}
                        </div>
                      )}
                      {cleanText && (
                        <pre className="ric-content">{cleanText.slice(0, 400)}{cleanText.length > 400 ? '…' : ''}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════ REMEDIATION (NEW) ════════════ */}
        {activeTab === 'remediation' && (
          <div className="card remediation-panel">
            <h3>🛠 Remediation Fix Recommendations</h3>
            <p className="section-subtitle">Actionable fix steps grounded in historical resolutions and engineering best practices</p>

            {/* Effort + Risk header strip */}
            <div className="remediation-meta-strip">
              <div className="rem-meta-item">
                <span className="rem-meta-label">Effort Estimate</span>
                <span
                  className="effort-badge"
                  style={{
                    background: effortColor(remediation.effort_estimate) + '22',
                    color: effortColor(remediation.effort_estimate),
                    border: `1px solid ${effortColor(remediation.effort_estimate)}`,
                  }}
                >
                  {safe(remediation.effort_estimate, 'Medium').toUpperCase()}
                </span>
              </div>
              <div className="rem-meta-item">
                <span className="rem-meta-label">Risk Level</span>
                <span className={`badge-risk ${(remediation.risk_level || 'medium').toLowerCase()}`}>
                  {safe(remediation.risk_level, 'Medium')}
                </span>
              </div>
              <div className="rem-meta-item">
                <span className="rem-meta-label">Validation</span>
                <span className="rem-meta-value">{safe(remediation.recommended_validation, 'Sandbox deployment verification')}</span>
              </div>
            </div>

            {/* Permanent Fix */}
            <div className="permanent-fix-block">
              <div className="pf-label">
                <span>🎯</span>
                <strong>Permanent Fix Strategy</strong>
              </div>
              <p className="pf-text">
                {safe(remediation.permanent_fix, 'Apply targeted patch addressing the root cause, run full regression suite, and deploy to staging for verification before production release.')}
              </p>
            </div>

            {/* Step-by-step Remediation Plan */}
            {(remediation.remediation_plan?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1.25rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>📋</span>
                  Step-by-Step Remediation Plan
                </h4>
                <ol className="remediation-steps-list">
                  {remediation.remediation_plan.map((step, idx) => {
                    // Strip leading number prefix if present (e.g. "1. Validate...")
                    const cleanStep = String(step).replace(/^\d+\.\s*/, '');
                    return (
                      <li key={idx} className="remediation-step-item">
                        <span className="rem-step-num">{idx + 1}</span>
                        <span className="rem-step-text">{cleanStep}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Immediate Mitigation */}
            {(remediation.immediate_mitigation?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>⚡</span>
                  Immediate Mitigation Actions
                </h4>
                <ul className="mitigation-list">
                  {remediation.immediate_mitigation.map((action, idx) => (
                    <li key={idx} className="mitigation-item">
                      <span className="mit-icon">→</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Regression Tests */}
            {(remediation.regression_tests?.length > 0) && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>🧪</span>
                  Regression Test Plan
                </h4>
                <ul className="regression-list">
                  {remediation.regression_tests.map((test, idx) => (
                    <li key={idx} className="regression-item">
                      <span className="reg-checkbox">☐</span>
                      <span>{test}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ════════════ RISK ════════════ */}
        {activeTab === 'risk' && (
          <div className="card risk-panel">
            <h3>⚠️ Security &amp; Technical Risk Index</h3>
            <p className="section-subtitle">Multi-dimensional risk assessment across production, business, and security dimensions</p>

            <div className="risk-grid-gauges" style={{ marginTop: '1.5rem' }}>
              <div className="risk-gauge-box">
                <strong style={{ fontSize: '2.5rem', color: risk.overall_risk_score >= 70 ? 'var(--accent-red)' : risk.overall_risk_score >= 40 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                  {safe(risk.overall_risk_score, 50)}
                </strong>
                <span>Overall Risk Score (1–100)</span>
              </div>
              <div className="risk-gauges">
                {[
                  { label: 'Production Risk', val: risk.production_risk },
                  { label: 'Business Risk',    val: risk.business_impact },
                  { label: 'Security Risk',    val: risk.security_risk },
                ].map(({ label, val }) => (
                  <div key={label} className="risk-dimension-row">
                    <span className="risk-dim-label">{label}</span>
                    <span className={`badge-risk ${(val || 'medium').toLowerCase()}`}>
                      {safe(val, 'Medium')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="risk-rationale card inner-card" style={{ marginTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Risk Summary Rationale</h4>
              <p style={{ lineHeight: 1.7, opacity: 0.9 }}>
                {safe(risk.rationale, 'Risk assessment completed based on triage priority, component criticality, and historical incident patterns.')}
              </p>
            </div>

            {risk.mitigation_notes && (
              <div className="card inner-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Mitigation Notes</h4>
                <p style={{ lineHeight: 1.7 }}>{risk.mitigation_notes}</p>
              </div>
            )}
          </div>
        )}

      </div>{/* end tab-panels-container */}
    </div>
  );
}
