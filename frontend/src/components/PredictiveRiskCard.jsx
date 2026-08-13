import React, { useState, useEffect, useRef } from 'react';

/* ── Mock Risk Data ──────────────────────────────────────── */
const RISK_MODULES = [
  {
    id: 'processor',
    name: 'processor.py',
    type: 'Payment Core',
    riskScore: 87,
    failureProbability: 0.73,
    trend: 'rising',
    sparkline: [12, 18, 15, 22, 35, 42, 38, 55, 68, 73, 80, 87],
    factors: [
      { label: 'Historical crash rate', value: 'High', icon: '📉' },
      { label: 'Code churn (30d)', value: '+340 lines', icon: '📝' },
      { label: 'Unresolved bugs', value: '3 open', icon: '🐛' },
      { label: 'Memory pressure', value: '78%', icon: '💾' },
    ],
    prediction: 'Critical failure probability peaks in next 72h if null-guard patch not applied.',
    color: '#ef4444',
  },
  {
    id: 'memory',
    name: 'memory_manager.py',
    type: 'Resource Management',
    riskScore: 71,
    failureProbability: 0.58,
    trend: 'rising',
    sparkline: [8, 10, 14, 20, 28, 30, 38, 45, 52, 61, 67, 71],
    factors: [
      { label: 'Memory leak indicators', value: 'Detected', icon: '⚠️' },
      { label: 'Heap growth rate', value: '+2.3MB/hr', icon: '📈' },
      { label: 'GC pressure', value: 'Elevated', icon: '♻️' },
      { label: 'Peak RSS usage', value: '94% limit', icon: '🔴' },
    ],
    prediction: 'OOM crash likely within 48h under sustained load. Recommend immediate GC tuning.',
    color: '#f59e0b',
  },
  {
    id: 'gateway',
    name: 'gateway_router.py',
    type: 'API Gateway',
    riskScore: 54,
    failureProbability: 0.38,
    trend: 'stable',
    sparkline: [20, 22, 25, 30, 28, 32, 35, 40, 42, 48, 51, 54],
    factors: [
      { label: 'Timeout frequency', value: 'Moderate', icon: '⏱' },
      { label: 'Error rate (24h)', value: '1.2%', icon: '🔢' },
      { label: 'Dependency health', value: 'Degraded', icon: '🔗' },
      { label: 'Circuit breaker trips', value: '2 events', icon: '⚡' },
    ],
    prediction: 'Moderate risk. Monitor provider SLA compliance. Add circuit-breaker fallback.',
    color: '#f59e0b',
  },
  {
    id: 'auth',
    name: 'auth_service.py',
    type: 'Authentication',
    riskScore: 22,
    failureProbability: 0.12,
    trend: 'falling',
    sparkline: [45, 40, 38, 35, 32, 30, 28, 27, 25, 24, 23, 22],
    factors: [
      { label: 'Token validation rate', value: '99.8%', icon: '🔐' },
      { label: 'Failed logins (24h)', value: '142', icon: '👤' },
      { label: 'Session stability', value: 'Good', icon: '✅' },
      { label: 'Cert expiry', value: '180 days', icon: '📋' },
    ],
    prediction: 'Low risk. Recent auth hardening PR reduced exposure. Continue monitoring.',
    color: '#10b981',
  },
];

/* ── Sparkline SVG ───────────────────────────────────────── */
function Sparkline({ data, color }) {
  const w = 120, h = 36;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline-svg">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="3"
        fill={color}
      />
    </svg>
  );
}

/* ── Animated Risk Gauge ─────────────────────────────────── */
function RiskGauge({ score, color }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  // SVG arc gauge
  const r = 44;
  const cx = 54, cy = 54;
  const circumference = Math.PI * r; // half circle
  const progress = (animated / 100) * circumference;

  return (
    <svg width="108" height="60" viewBox="0 0 108 60" className="risk-gauge-svg">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="16" fontWeight="800">
        {animated}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">
        /100
      </text>
    </svg>
  );
}

/* ── Module Risk Card ────────────────────────────────────── */
function ModuleRiskCard({ module, isExpanded, onToggle }) {
  const riskLabel = module.riskScore >= 70 ? 'CRITICAL' : module.riskScore >= 50 ? 'HIGH' : module.riskScore >= 30 ? 'MEDIUM' : 'LOW';
  const trendIcon = module.trend === 'rising' ? '↑' : module.trend === 'falling' ? '↓' : '→';
  const trendClass = module.trend === 'rising' ? 'trend-up' : module.trend === 'falling' ? 'trend-down' : 'trend-stable';

  return (
    <div
      className={`risk-module-card ${isExpanded ? 'expanded' : ''}`}
      style={{ '--module-color': module.color, borderColor: isExpanded ? module.color + '60' : '' }}
    >
      <div className="rmc-header" onClick={onToggle}>
        {/* Gauge */}
        <RiskGauge score={module.riskScore} color={module.color} />

        {/* Module info */}
        <div className="rmc-info">
          <div className="rmc-name-row">
            <code className="rmc-filename">{module.name}</code>
            <span className="rmc-type-badge">{module.type}</span>
          </div>
          <div className="rmc-stats-row">
            <span className={`rmc-risk-label ${riskLabel.toLowerCase()}`}>{riskLabel} RISK</span>
            <span className={`rmc-trend ${trendClass}`}>{trendIcon} {module.trend}</span>
            <span className="rmc-fail-prob">
              <span className="rmc-fail-num">{(module.failureProbability * 100).toFixed(0)}%</span>
              <span className="rmc-fail-label"> failure prob.</span>
            </span>
          </div>

          {/* Inline sparkline */}
          <div className="rmc-sparkline-row">
            <span className="rmc-spark-label">30-day trend</span>
            <Sparkline data={module.sparkline} color={module.color} />
          </div>
        </div>

        {/* Expand toggle */}
        <button className="rmc-expand-btn" aria-label="expand">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="rmc-detail">
          {/* Risk factors grid */}
          <div className="rmc-factors-grid">
            {module.factors.map((f, i) => (
              <div key={i} className="rmc-factor-item">
                <span className="rmc-factor-icon">{f.icon}</span>
                <span className="rmc-factor-label">{f.label}</span>
                <span className="rmc-factor-value" style={{ color: module.color }}>{f.value}</span>
              </div>
            ))}
          </div>

          {/* Failure probability bar */}
          <div className="rmc-prob-section">
            <div className="rmc-prob-header">
              <span>Failure Probability Forecast</span>
              <strong style={{ color: module.color }}>{(module.failureProbability * 100).toFixed(0)}%</strong>
            </div>
            <div className="rmc-prob-track">
              <div
                className="rmc-prob-fill"
                style={{
                  width: `${module.failureProbability * 100}%`,
                  background: `linear-gradient(90deg, ${module.color}99, ${module.color})`,
                  boxShadow: `0 0 10px ${module.color}66`,
                }}
              />
              <div className="rmc-prob-threshold" style={{ left: '70%' }} title="Critical Threshold (70%)" />
            </div>
            <div className="rmc-prob-labels">
              <span>0%</span>
              <span style={{ color: module.color }}>⚠ Threshold: 70%</span>
              <span>100%</span>
            </div>
          </div>

          {/* AI Prediction */}
          <div className="rmc-prediction" style={{ borderColor: module.color + '44', background: module.color + '0d' }}>
            <span className="rmc-pred-icon">🔮</span>
            <p className="rmc-pred-text">{module.prediction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Forecast Timeline ───────────────────────────────────── */
function RiskTimeline() {
  const events = [
    { time: 'Now', event: 'processor.py — Critical risk detected', color: '#ef4444', icon: '🔴' },
    { time: '+12h', event: 'memory_manager.py — Heap growth approaching OOM threshold', color: '#f59e0b', icon: '🟡' },
    { time: '+48h', event: 'memory_manager.py — OOM crash probability exceeds 80%', color: '#ef4444', icon: '🔴' },
    { time: '+72h', event: 'processor.py — Cascading failure risk if unpatched', color: '#ef4444', icon: '🔴' },
    { time: '+7d', event: 'gateway_router.py — SLA breach risk from timeout accumulation', color: '#f59e0b', icon: '🟡' },
  ];

  return (
    <div className="risk-timeline">
      <h4 className="risk-tl-title">⏱ Predictive Failure Timeline</h4>
      <div className="risk-tl-items">
        {events.map((ev, idx) => (
          <div key={idx} className="risk-tl-item">
            <div className="risk-tl-time">{ev.time}</div>
            <div className="risk-tl-dot" style={{ background: ev.color, boxShadow: `0 0 8px ${ev.color}` }} />
            <div className="risk-tl-event">
              <span className="risk-tl-icon">{ev.icon}</span>
              <span>{ev.event}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* Main Component                                            */
/* ══════════════════════════════════════════════════════════ */
export default function PredictiveRiskCard() {
  const [expandedId, setExpandedId] = useState('processor');
  const [activeTab, setActiveTab] = useState('modules');

  const totalCritical = RISK_MODULES.filter(m => m.riskScore >= 70).length;
  const avgRisk = Math.round(RISK_MODULES.reduce((a, m) => a + m.riskScore, 0) / RISK_MODULES.length);

  return (
    <div className="predictive-risk-card card">
      {/* Header */}
      <div className="prc-header">
        <div className="prc-title-group">
          <div className="prc-crystal-icon">🔮</div>
          <div>
            <h2 className="prc-title">Crystal Ball — Predictive Failure Risk Forecasting</h2>
            <p className="prc-subtitle">Forward-looking AI risk analysis based on historical patterns, code churn & operational metrics</p>
          </div>
        </div>
        <div className="prc-summary-pills">
          <div className="prc-pill prc-pill-red">
            <strong>{totalCritical}</strong>
            <span>Critical Modules</span>
          </div>
          <div className="prc-pill prc-pill-amber">
            <strong>{avgRisk}</strong>
            <span>Avg Risk Score</span>
          </div>
          <div className="prc-pill prc-pill-blue">
            <strong>{RISK_MODULES.length}</strong>
            <span>Monitored Modules</span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="prc-tabs">
        <button
          className={`prc-tab ${activeTab === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          📊 Module Risk Profiles
        </button>
        <button
          className={`prc-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          ⏱ Failure Timeline
        </button>
      </div>

      {/* Module cards */}
      {activeTab === 'modules' && (
        <div className="prc-modules-list">
          {RISK_MODULES.map(module => (
            <ModuleRiskCard
              key={module.id}
              module={module}
              isExpanded={expandedId === module.id}
              onToggle={() => setExpandedId(expandedId === module.id ? null : module.id)}
            />
          ))}
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && <RiskTimeline />}

      {/* Footer note */}
      <p className="prc-footer-note">
        🤖 Powered by LSTM time-series forecasting + anomaly detection on 90-day rolling operational data
      </p>
    </div>
  );
}
