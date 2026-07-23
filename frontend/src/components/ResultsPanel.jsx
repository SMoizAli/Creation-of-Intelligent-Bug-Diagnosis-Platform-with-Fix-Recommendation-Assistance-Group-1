import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export default function ResultsPanel({ analysis, onDownload, onCopy }) {
  const [activeTab, setActiveTab] = useState('summary');

  if (!analysis) {
    return (
      <div className="card results-panel empty">
        <p>No analysis results loaded yet. Submit and initiate analysis from the Upload view.</p>
      </div>
    );
  }

  const triage = analysis.triage || {};
  const logs = analysis.log_analysis || {};
  const risk = analysis.risk_assessment || {};
  const execSum = analysis.executive_summary || {};

  const handleDownload = (format) => {
    const url = `${API_BASE}/analysis/${analysis.id}/download?format=${format}`;
    window.open(url, '_blank');
    onDownload?.();
  };

  const handleCopy = () => {
    const textReport = [
      `AI-Smart-Bug-Analyzer-And-Fix-Advisor Analysis Summary: ${analysis.summary}`,
      `Priority: ${triage.priority} | Component: ${triage.component}`,
      `Risk: ${risk.production_risk || 'Medium'}`,
    ].join('\n');
    navigator.clipboard.writeText(textReport);
    onCopy?.();
  };

  return (
    <div className="results-panel-container">
      {/* Header and Quick Actions */}
      <div className="results-header-card card">
        <div className="results-title-group">
          <h2>Analysis Findings Dashboard</h2>
          <span className="analysis-id-badge">ID: {analysis.id}</span>
        </div>
        <div className="results-quick-actions">
          <button className="btn btn-secondary" onClick={handleCopy}>Copy Findings</button>
          <div className="download-dropdown">
            <button className="btn btn-primary">Export Report</button>
            <div className="download-dropdown-content">
              <button onClick={() => handleDownload('pdf')}>PDF Format</button>
              <button onClick={() => handleDownload('markdown')}>Markdown</button>
              <button onClick={() => handleDownload('text')}>Plain Text</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="results-tabs">
        {['summary', 'triage', 'logs', 'risk', 'similar'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'similar' ? 'SIMILAR BUG' : tab.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="tab-panels-container">
        {activeTab === 'summary' && (
          <div className="card summary-panel-grid">
            <div className="exec-header-block">
              <h3>Executive Summary</h3>
              <p className="exec-paragraph">{execSum.summary || "No summary compile completed."}</p>
            </div>
            
            <div className="metrics-grid">
              <div className="metric-box">
                <h4>Component Target</h4>
                <span className="badge-component">{triage.component || 'Unknown'}</span>
              </div>
              <div className="metric-box">
                <h4>Priority Class</h4>
                <span className={`badge-priority ${triage.priority}`}>{triage.priority || 'Unknown'}</span>
              </div>
              <div className="metric-box">
                <h4>Risk Index</h4>
                <span className={`badge-risk ${risk.production_risk}`}>{risk.production_risk || 'Medium'}</span>
              </div>
              <div className="metric-box">
                <h4>Confidence Score</h4>
                <span className="badge-confidence">{analysis.confidence_scoring?.confidence_score ? (analysis.confidence_scoring.confidence_score * 100).toFixed(0) + '%' : 'N/A'}</span>
              </div>
            </div>

            <div className="takeaways-list card inner-card">
              <h4>Key Diagnostic Takeaways</h4>
              <ul>
                {execSum.key_takeaways?.map((item, idx) => (
                  <li key={idx}>● {item}</li>
                )) || <li>No takeaways calculated.</li>}
              </ul>
            </div>

            <div className="combined-output-block card inner-card" style={{ marginTop: '15px', padding: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Combined Triage & Log Analysis</h4>
              <p style={{ margin: '5px 0' }}><strong>Primary Exception:</strong> <code>{logs.exception_type || 'UnknownException'}</code></p>
              <p style={{ margin: '5px 0' }}><strong>Failure Point:</strong> <code>{logs.failure_point || 'unknown'}</code></p>
              <p style={{ margin: '5px 0' }}><strong>Affected Code Path:</strong> <code>{logs.affected_code_path || 'unknown'}</code></p>
              <p style={{ margin: '5px 0', fontStyle: 'italic', opacity: 0.9 }}><strong>Triage Reasoning:</strong> {triage.reasoning || 'N/A'}</p>
            </div>
          </div>
        )}

        {activeTab === 'triage' && (
          <div className="card triage-panel">
            <h3>Triage & Classification</h3>
            <table className="details-table">
              <tbody>
                <tr>
                  <td><strong>Priority Class</strong></td>
                  <td><span className={`badge-priority ${triage.priority}`}>{triage.priority}</span></td>
                </tr>
                <tr>
                  <td><strong>Severity Level</strong></td>
                  <td>{triage.severity_score} / 10</td>
                </tr>
                <tr>
                  <td><strong>Affected Component</strong></td>
                  <td><code>{triage.component}</code></td>
                </tr>
                <tr>
                  <td><strong>Recommended Assignee</strong></td>
                  <td>{triage.recommended_assignee_team}</td>
                </tr>
                <tr>
                  <td><strong>Business Impact Statement</strong></td>
                  <td>{triage.business_impact}</td>
                </tr>
                {triage.reasoning && (
                  <tr>
                    <td><strong>Triage Reasoning</strong></td>
                    <td style={{ fontStyle: 'italic', opacity: 0.9 }}>{triage.reasoning}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card logs-panel">
            <h3>Structured Log Evidence</h3>
            <div className="logs-stats-row">
              <div className="log-stat-card">
                <strong>{logs.error_count || 0}</strong>
                <span>Error Signals</span>
              </div>
              <div className="log-stat-card">
                <strong>{logs.log_format?.toUpperCase()}</strong>
                <span>Parsed Format</span>
              </div>
            </div>

            {/* Log Diagnostic Details */}
            <div className="log-section card inner-card" style={{ marginTop: '20px', marginBottom: '20px', padding: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Log Diagnostics Summary</h4>
              <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '30%', padding: '6px 0' }}><strong>Primary Exception</strong></td>
                    <td style={{ padding: '6px 0' }}><code>{logs.exception_type || 'UnknownException'}</code></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0' }}><strong>Failure Point</strong></td>
                    <td style={{ padding: '6px 0' }}><code>{logs.failure_point || 'unknown'}</code></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0' }}><strong>Affected Code Path</strong></td>
                    <td style={{ padding: '6px 0' }}><code>{logs.affected_code_path || 'unknown'}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="log-section">
              <h4>Critical Error Samples</h4>
              <ul className="error-list">
                {logs.error_samples?.map((s, idx) => (
                  <li key={idx} className="error-item">{s}</li>
                )) || <li>No error patterns detected.</li>}
              </ul>
            </div>

            {logs.has_stack_trace && (
              <div className="log-section">
                <h4>Diagnosed Stack Trace Lines</h4>
                <pre className="stack-trace-pre">
                  {logs.stack_trace_lines?.join('\n') || "No trace elements mapped."}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="card risk-panel">
            <h3>Security & Technical Risk Index</h3>
            
            <div className="risk-grid-gauges">
              <div className="risk-gauge-box">
                <strong>{risk.overall_risk_score || 50}</strong>
                <span>Overall Risk Score (1-100)</span>
              </div>
              <div className="risk-gauges">
                <p>Production Risk: <strong className={`badge-risk ${risk.production_risk}`}>{risk.production_risk}</strong></p>
                <p>Business Risk: <strong className={`badge-risk ${risk.business_impact}`}>{risk.business_impact}</strong></p>
                <p>Security Risk: <strong className={`badge-risk ${risk.security_risk}`}>{risk.security_risk}</strong></p>
              </div>
            </div>

            <div className="risk-rationale card inner-card">
              <h4>Risk Summary Rationale</h4>
              <p>{risk.rationale || "Calculations complete."}</p>
            </div>
          </div>
        )}

        {activeTab === 'similar' && (
          <div className="card similar-panel">
            <h3>Similar Historical Bugs</h3>
            {analysis.retrieved_context && analysis.retrieved_context.length > 0 ? (
              <ul className="retrieved-list" style={{ listStyleType: 'none', padding: 0 }}>
                {analysis.retrieved_context.map((ctx, idx) => {
                  const sourceStr = (ctx.metadata?.source || 'seed').toLowerCase();
                  let sourceBadgeClass = 'badge-seed';
                  let sourceLabel = 'Enterprise KB';
                  if (sourceStr === 'mozilla') { sourceBadgeClass = 'badge-mozilla'; sourceLabel = 'Mozilla Repository'; }
                  else if (sourceStr === 'eclipse') { sourceBadgeClass = 'badge-eclipse'; sourceLabel = 'Eclipse Foundation'; }
                  else if (sourceStr === 'kaggle') { sourceBadgeClass = 'badge-kaggle'; sourceLabel = 'Kaggle / GitHub'; }
                  else if (sourceStr === 'software_heritage') { sourceBadgeClass = 'badge-software-heritage'; sourceLabel = 'Software Heritage Archive'; }
                  
                  const rawText = ctx.content || ctx.page_content || JSON.stringify(ctx);
                  const cleanText = rawText.replace(/\{[\s\S]*?\}|\[[\s\S]*?\]/g, '').trim() || rawText;

                  return (
                    <li key={idx} className="card inner-card" style={{ marginBottom: '15px', padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong>Bug ID: {ctx.metadata?.bug_id || 'Unknown'}</strong>
                        <div>
                          <span className="badge-source" style={{ marginRight: '8px', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85em', background: 'var(--bg-card)', border: '1px solid currentColor' }}>{sourceLabel}</span>
                          <span className={`badge-priority ${ctx.metadata?.priority || 'unknown'}`}>{ctx.metadata?.priority || 'Unknown'}</span>
                        </div>
                      </div>
                      <p style={{ margin: '0 0 10px 0', opacity: 0.8 }}><strong>Component:</strong> {ctx.metadata?.component || 'Unknown'} | <strong>Date:</strong> {ctx.metadata?.date || 'Unknown'}</p>
                      {ctx.metadata?.resolution && (
                        <p style={{ margin: '0 0 10px 0', opacity: 0.9 }}><strong>Historical Resolution / Fix:</strong> {ctx.metadata.resolution}</p>
                      )}
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-input)', padding: '10px', borderRadius: '4px' }}>
                        {cleanText}
                      </pre>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No similar historical bugs found in the knowledge base.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
