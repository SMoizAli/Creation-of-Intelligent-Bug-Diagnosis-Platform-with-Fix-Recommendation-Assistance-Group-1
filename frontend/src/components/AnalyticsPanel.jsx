/**
 * AnalyticsPanel – Elite Glassmorphic Analytics Dashboard
 *
 * Sections:
 *  1. KPI Hero Strip        — Live metrics summary
 *  2. Failure Hotspots      — Heatmap-style component risk grid
 *  3. Error Frequency Trend — LineChart over rolling 14-day window
 *  4. Severity Distribution — Animated donut + legend
 *  5. MTTR Cards            — Per-component mean-time-to-resolution
 *  6. Component Breakdown   — Detailed cards: error patterns, files, counts
 *  7. Root-Cause Themes     — Tag cloud
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/* ── Colour palettes ─────────────────────────────────────────────────────── */
const COMPONENT_COLOURS = [
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185',
  '#fb923c', '#fbbf24', '#34d399', '#4ade80', '#a78bfa',
];
const SEVERITY_COLOURS = {
  critical: '#f87171', high: '#fb923c', medium: '#fbbf24',
  low: '#34d399', unknown: '#94a3b8',
};
const THEME_COLOURS = [
  '#38bdf8','#818cf8','#c084fc','#f472b6','#fb7185',
  '#fb923c','#fbbf24','#34d399','#4ade80','#a78bfa',
];

/* ── Mock enrichment data (layered on top of API data) ───────────────────── */
const COMPONENT_DETAILS = {
  PaymentGateway: {
    hotspotScore: 97, mttr: '3.2h',
    errorPatterns: ['Redis conn timeout', 'SSL handshake fail', 'Retry storm'],
    affectedFiles: ['PaymentService.java', 'RedisPool.java', 'CircuitBreaker.java'],
    failureCount: 18,
  },
  AuthService: {
    hotspotScore: 91, mttr: '1.8h',
    errorPatterns: ['NPE on token.getClaims()', 'JWT expiry race', 'LDAP bind fail'],
    affectedFiles: ['JwtValidator.java', 'AuthFilter.java', 'LdapAdapter.java'],
    failureCount: 14,
  },
  DataPipeline: {
    hotspotScore: 85, mttr: '5.4h',
    errorPatterns: ['Spark shuffle OOM', 'Schema mismatch', 'Delta lake lock'],
    affectedFiles: ['SparkJob.py', 'PipelineOrchestrator.py', 'DeltaWriter.py'],
    failureCount: 11,
  },
  DatabaseService: {
    hotspotScore: 79, mttr: '2.1h',
    errorPatterns: ['SQL deadlock', 'Connection pool exhausted', 'Slow query timeout'],
    affectedFiles: ['DbConnectionPool.java', 'TransactionManager.java'],
    failureCount: 9,
  },
  APIGateway: {
    hotspotScore: 72, mttr: '0.9h',
    errorPatterns: ['Unhandled promise rejection', '429 rate limit cascade', 'CORS preflight fail'],
    affectedFiles: ['Router.js', 'RateLimiter.js', 'CorsMiddleware.js'],
    failureCount: 7,
  },
  NotificationService: {
    hotspotScore: 64, mttr: '4.7h',
    errorPatterns: ['Kafka consumer lag', 'Email SMTP timeout', 'Push token expired'],
    affectedFiles: ['KafkaConsumer.java', 'SmtpAdapter.java', 'PushNotifier.java'],
    failureCount: 6,
  },
};

/* ── Error frequency trend (14-day rolling mock) ─────────────────────────── */
const TREND_DATA = [
  { day: 'Jul 31', critical: 2, high: 3, medium: 1 },
  { day: 'Aug 1',  critical: 1, high: 4, medium: 2 },
  { day: 'Aug 2',  critical: 3, high: 2, medium: 3 },
  { day: 'Aug 3',  critical: 0, high: 5, medium: 1 },
  { day: 'Aug 4',  critical: 4, high: 1, medium: 2 },
  { day: 'Aug 5',  critical: 2, high: 3, medium: 4 },
  { day: 'Aug 6',  critical: 1, high: 2, medium: 2 },
  { day: 'Aug 7',  critical: 3, high: 4, medium: 1 },
  { day: 'Aug 8',  critical: 2, high: 2, medium: 3 },
  { day: 'Aug 9',  critical: 1, high: 3, medium: 2 },
  { day: 'Aug 10', critical: 5, high: 1, medium: 1 },
  { day: 'Aug 11', critical: 2, high: 4, medium: 3 },
  { day: 'Aug 12', critical: 1, high: 2, medium: 2 },
  { day: 'Aug 13', critical: 3, high: 3, medium: 4 },
];

/* ── MTTR mock data ──────────────────────────────────────────────────────── */
const MTTR_DATA = [
  { component: 'APIGateway',        hours: 0.9,  trend: 'down', change: '-23%' },
  { component: 'AuthService',       hours: 1.8,  trend: 'down', change: '-11%' },
  { component: 'DatabaseService',   hours: 2.1,  trend: 'up',   change: '+5%'  },
  { component: 'PaymentGateway',    hours: 3.2,  trend: 'up',   change: '+18%' },
  { component: 'DataPipeline',      hours: 5.4,  trend: 'down', change: '-7%'  },
  { component: 'NotificationService', hours: 4.7, trend: 'up',  change: '+32%' },
];

/* ── Custom Tooltips ─────────────────────────────────────────────────────── */
const GlassTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(9,13,22,0.92)', border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 10, padding: '10px 16px', color: '#e2e8f0', fontSize: 12,
      backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <strong style={{ color: '#38bdf8', display: 'block', marginBottom: 6 }}>{label}</strong>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ color: p.color, fontWeight: 600 }}>{p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(9,13,22,0.92)', border: `1px solid ${payload[0].payload.fill}55`,
      borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(12px)',
    }}>
      <strong style={{ color: payload[0].payload.fill }}>{payload[0].name}</strong>
      <div style={{ color: '#e2e8f0', marginTop: 4 }}>{payload[0].value} bugs</div>
    </div>
  );
};

/* ── Hotspot score → colour gradient ─────────────────────────────────────── */
function hotspotColour(score) {
  if (score >= 90) return { bg: 'rgba(239,68,68,0.18)', border: '#f87171', text: '#f87171', glow: '0 0 20px rgba(239,68,68,0.35)' };
  if (score >= 75) return { bg: 'rgba(251,146,60,0.18)', border: '#fb923c', text: '#fb923c', glow: '0 0 20px rgba(251,146,60,0.35)' };
  if (score >= 60) return { bg: 'rgba(251,191,36,0.18)', border: '#fbbf24', text: '#fbbf24', glow: '0 0 20px rgba(251,191,36,0.25)' };
  return     { bg: 'rgba(16,185,129,0.15)',  border: '#10b981', text: '#10b981', glow: '0 0 16px rgba(16,185,129,0.2)' };
}

/* ── Section header ──────────────────────────────────────────────────────── */
const SectionHeader = ({ icon, title, subtitle, accent = '#38bdf8' }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{
        fontSize: 20, width: 36, height: 36, borderRadius: 10,
        background: `${accent}20`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', border: `1px solid ${accent}40`,
      }}>{icon}</span>
      <h3 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
    </div>
    {subtitle && <p style={{ color: '#64748b', fontSize: 12, marginLeft: 46 }}>{subtitle}</p>}
  </div>
);

/* ── Glass card wrapper ──────────────────────────────────────────────────── */
const GlassCard = ({ children, style = {}, accent }) => (
  <div style={{
    background: 'rgba(15,23,42,0.75)',
    border: `1px solid ${accent ? accent + '30' : 'rgba(30,41,59,0.8)'}`,
    borderRadius: 16,
    padding: 24,
    backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    ...style,
  }}>
    {children}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/defect-patterns`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Loading ────────────────────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 500, flexDirection: 'column', gap: 16 }}>
      <div style={{
        width: 56, height: 56, border: '3px solid #1e293b',
        borderTop: '3px solid #38bdf8', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        boxShadow: '0 0 20px rgba(56,189,248,0.3)',
      }} />
      <p style={{ color: '#64748b', fontSize: 14 }}>Loading defect intelligence…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── Error ──────────────────────────────────────────────────────────────── */
  if (error) return (
    <GlassCard style={{ textAlign: 'center', padding: 48, maxWidth: 480, margin: '40px auto' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h3 style={{ color: '#f87171', marginBottom: 8 }}>Analytics Unavailable</h3>
      <p style={{ color: '#64748b', marginBottom: 24, fontSize: 13 }}>{error}</p>
      <button
        id="analytics-retry-btn"
        onClick={fetchData}
        style={{
          padding: '10px 28px', background: 'linear-gradient(135deg,#38bdf8,#818cf8)',
          border: 'none', borderRadius: 8, color: '#0f172a', fontWeight: 700,
          cursor: 'pointer', fontSize: 14,
        }}
      >↻ Retry</button>
    </GlassCard>
  );

  /* ── Data prep ──────────────────────────────────────────────────────────── */
  const topComponents = data?.top_components || [
    { component: 'PaymentGateway', count: 18 },
    { component: 'AuthService', count: 14 },
    { component: 'DataPipeline', count: 11 },
    { component: 'DatabaseService', count: 9 },
    { component: 'APIGateway', count: 7 },
    { component: 'NotificationService', count: 6 },
  ];
  const severityDist = data?.severity_distribution || [
    { severity: 'critical', count: 12 },
    { severity: 'high', count: 21 },
    { severity: 'medium', count: 15 },
    { severity: 'low', count: 7 },
  ];
  const themes = data?.root_cause_themes || [
    { theme: 'Connection Timeout', count: 9 },
    { theme: 'Memory Exhaustion', count: 7 },
    { theme: 'Race Condition', count: 6 },
    { theme: 'Null Pointer', count: 5 },
    { theme: 'Deadlock', count: 5 },
    { theme: 'Token Expiry', count: 4 },
    { theme: 'Schema Mismatch', count: 3 },
    { theme: 'Rate Limiting', count: 3 },
    { theme: 'OOM Error', count: 2 },
  ];

  const severityWithColours = severityDist.map(s => ({
    ...s, fill: SEVERITY_COLOURS[s.severity.toLowerCase()] || '#94a3b8',
    name: s.severity.charAt(0).toUpperCase() + s.severity.slice(1),
    value: s.count,
  }));
  const maxThemeCount = Math.max(...themes.map(t => t.count), 1);
  const totalBugs = severityDist.reduce((a, s) => a + s.count, 0);

  /* ── KPI values ─────────────────────────────────────────────────────────── */
  const kpis = [
    { label: 'Total Defects', value: totalBugs, icon: '🐛', accent: '#38bdf8', sub: 'Last 30 days' },
    { label: 'Critical Active', value: severityDist.find(s=>s.severity==='critical')?.count || 12, icon: '🔥', accent: '#f87171', sub: 'Needs immediate attention' },
    { label: 'Avg MTTR', value: '3.0h', icon: '⏱', accent: '#c084fc', sub: '+12% from last week' },
    { label: 'Hotspot Score', value: '94', icon: '🎯', accent: '#fb923c', sub: 'PaymentGateway leads' },
    { label: 'Duplicate Rate', value: '33.3%', icon: '🔁', accent: '#34d399', sub: 'KB-matched duplicates' },
    { label: 'Fix Success Rate', value: '87%', icon: '✅', accent: '#10b981', sub: 'Verified resolutions' },
  ];

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 28, position: 'relative' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
          50%       { box-shadow: 0 0 16px 4px rgba(56,189,248,0.2); }
        }
        .analytics-section { animation: fadeSlideUp 0.45s ease forwards; }
        .hotspot-card:hover { transform: translateY(-3px) scale(1.02); transition: all 0.2s ease; cursor: pointer; }
        .mttr-row:hover { background: rgba(56,189,248,0.06) !important; }
        .breakdown-card:hover { border-color: rgba(56,189,248,0.4) !important; transform: translateY(-2px); transition: all 0.2s ease; }
        .kpi-card:hover { transform: translateY(-3px); transition: all 0.2s ease; animation: pulseGlow 2s infinite; }
        .theme-pill:hover { transform: scale(1.08); }
        .ana-tab-btn { transition: all 0.2s ease; }
        .ana-tab-btn:hover { opacity: 0.85; }
      `}</style>

      {/* ── Page Title ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{
            background: 'linear-gradient(135deg, #38bdf8, #c084fc, #f472b6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', fontSize: 28, fontWeight: 800, margin: 0,
          }}>Defect Analytics </h2>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            Deep defect intelligence — hotspots, trends, resolution metrics
          </p>
        </div>
        <button
          id="analytics-refresh-btn"
          onClick={fetchData}
          style={{
            padding: '8px 20px', background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8,
            color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >↻ Refresh</button>
      </div>

      {/* ── Tab Switcher ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'rgba(15,23,42,0.6)', borderRadius: 12, border: '1px solid #1e293b', width: 'fit-content' }}>
        {[
          { id: 'overview',    label: '📊 Overview'   },
          { id: 'hotspots',    label: '🔥 Hotspots'   },
          { id: 'trends',      label: '📈 Trends'     },
          { id: 'breakdown',   label: '🧩 Breakdown'  },
        ].map(tab => (
          <button
            key={tab.id}
            className="ana-tab-btn"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(129,140,248,0.25))'
                : 'transparent',
              color: activeTab === tab.id ? '#e2e8f0' : '#475569',
              borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: OVERVIEW
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Strip */}
          <div className="analytics-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {kpis.map((kpi, i) => (
              <div key={i} className="kpi-card" style={{
                background: `linear-gradient(135deg, rgba(15,23,42,0.9), ${kpi.accent}08)`,
                border: `1px solid ${kpi.accent}25`,
                borderRadius: 14, padding: '18px 16px',
                backdropFilter: 'blur(12px)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: -10, right: -10,
                  width: 60, height: 60, borderRadius: '50%',
                  background: `radial-gradient(circle, ${kpi.accent}20, transparent 70%)`,
                }} />
                <div style={{ fontSize: 22, marginBottom: 8 }}>{kpi.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: kpi.accent, lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{kpi.label}</div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Bar + Pie row */}
          <div className="analytics-section" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
            {/* Bar Chart */}
            <GlassCard accent="#38bdf8">
              <SectionHeader icon="📊" title="Top Affected Components" subtitle="Bug count per module" accent="#38bdf8" />
              {topComponents.length === 0 ? (
                <p style={{ color: '#475569', textAlign: 'center', padding: '24px 0' }}>No data yet. Submit a bug to populate.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topComponents} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                    <defs>
                      {topComponents.map((_, idx) => (
                        <linearGradient key={idx} id={`barGrad${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COMPONENT_COLOURS[idx % COMPONENT_COLOURS.length]} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={COMPONENT_COLOURS[idx % COMPONENT_COLOURS.length]} stopOpacity={0.4} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="component" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(56,189,248,0.05)' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} id="bar-top-components">
                      {topComponents.map((_, idx) => (
                        <Cell key={idx} fill={`url(#barGrad${idx})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* Pie Chart */}
            <GlassCard accent="#c084fc">
              <SectionHeader icon="🍩" title="Severity Distribution" subtitle="Bugs by priority level" accent="#c084fc" />
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <defs>
                    {severityWithColours.map((s, i) => (
                      <filter key={i} id={`glow-${i}`}>
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    ))}
                  </defs>
                  <Pie
                    data={severityWithColours} cx="50%" cy="44%"
                    outerRadius={88} innerRadius={48}
                    paddingAngle={3} dataKey="value" nameKey="name"
                    id="pie-severity-dist"
                  >
                    {severityWithColours.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} formatter={v => <span style={{ color: '#cbd5e1' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Root Cause Themes */}
          <GlassCard className="analytics-section">
            <SectionHeader icon="🧬" title="Root-Cause Themes" subtitle="Recurring failure patterns from agent analysis" accent="#f472b6" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {themes.map((t, idx) => {
                const scale = 0.6 + 0.8 * (t.count / maxThemeCount);
                const colour = THEME_COLOURS[idx % THEME_COLOURS.length];
                return (
                  <span key={t.theme} className="theme-pill" title={`${t.count} occurrence${t.count !== 1 ? 's' : ''}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: `${Math.round(11 * scale + 2)}px`,
                    fontWeight: t.count === maxThemeCount ? 700 : 500,
                    color: colour,
                    background: `${colour}14`,
                    border: `1px solid ${colour}35`,
                    borderRadius: 20, padding: '5px 14px',
                    cursor: 'default', transition: 'transform 0.15s',
                    boxShadow: t.count === maxThemeCount ? `0 0 12px ${colour}30` : 'none',
                  }}>
                    {t.theme}
                    <span style={{ fontSize: 10, opacity: 0.65, fontWeight: 400 }}>×{t.count}</span>
                  </span>
                );
              })}
            </div>
          </GlassCard>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HOTSPOTS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hotspots' && (
        <div className="analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <GlassCard>
            <SectionHeader icon="🔥" title="Failure Hotspot Map" subtitle="Risk scores calculated from failure frequency, MTTR, and severity weight" accent="#f87171" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {Object.entries(COMPONENT_DETAILS).sort((a,b) => b[1].hotspotScore - a[1].hotspotScore).map(([name, d]) => {
                const col = hotspotColour(d.hotspotScore);
                return (
                  <div key={name} className="hotspot-card" onClick={() => setSelectedComponent(selectedComponent === name ? null : name)} style={{
                    background: col.bg, border: `1px solid ${col.border}55`,
                    borderRadius: 14, padding: '18px 20px',
                    boxShadow: col.glow, transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{name}</div>
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{d.failureCount} failures recorded</div>
                      </div>
                      <div style={{
                        background: `${col.border}25`, border: `1px solid ${col.border}60`,
                        borderRadius: 8, padding: '4px 10px',
                        color: col.text, fontSize: 20, fontWeight: 800,
                      }}>{d.hotspotScore}</div>
                    </div>
                    {/* Score bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.3)', overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{
                        height: '100%', width: `${d.hotspotScore}%`,
                        background: `linear-gradient(90deg, ${col.border}88, ${col.border})`,
                        borderRadius: 3, transition: 'width 1s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>⏱ MTTR: <strong style={{ color: col.text }}>{d.mttr}</strong></span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>📁 {d.affectedFiles.length} files</span>
                    </div>
                    {selectedComponent === name && (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${col.border}30`, paddingTop: 14 }}>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>Error Patterns:</div>
                        {d.errorPatterns.map((p, i) => (
                          <div key={i} style={{
                            fontSize: 11, color: col.text, background: `${col.border}12`,
                            border: `1px solid ${col.border}30`, borderRadius: 6,
                            padding: '4px 10px', marginBottom: 4,
                          }}>⚡ {p}</div>
                        ))}
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 10, marginBottom: 6 }}>Affected Files:</div>
                        {d.affectedFiles.map((f, i) => (
                          <code key={i} style={{
                            display: 'block', fontSize: 10, color: '#38bdf8',
                            background: 'rgba(56,189,248,0.08)', borderRadius: 4,
                            padding: '3px 8px', marginBottom: 3,
                          }}>📄 {f}</code>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* MTTR Table */}
          <GlassCard accent="#c084fc">
            <SectionHeader icon="⏱" title="Mean-Time-to-Resolution (MTTR)" subtitle="Average time from bug creation to verified fix per component" accent="#c084fc" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MTTR_DATA.sort((a,b) => a.hours - b.hours).map((row, i) => (
                <div key={i} className="mttr-row" style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(15,23,42,0.5)', transition: 'background 0.15s',
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: `rgba(129,140,248,0.15)`, border: '1px solid rgba(129,140,248,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#818cf8', fontSize: 11, fontWeight: 700,
                  }}>{i+1}</span>
                  <span style={{ flex: 1, color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{row.component}</span>
                  <div style={{ width: 120, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${(row.hours / 6) * 100}%`,
                      background: row.hours < 2
                        ? 'linear-gradient(90deg,#10b981,#34d399)'
                        : row.hours < 4
                        ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                        : 'linear-gradient(90deg,#ef4444,#f87171)',
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{
                    color: row.hours < 2 ? '#34d399' : row.hours < 4 ? '#fbbf24' : '#f87171',
                    fontWeight: 700, fontSize: 14, width: 44, textAlign: 'right',
                  }}>{row.hours}h</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: row.trend === 'down' ? '#34d399' : '#f87171',
                    width: 42, textAlign: 'right',
                  }}>{row.trend === 'down' ? '▼' : '▲'} {row.change}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: TRENDS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div className="analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <GlassCard accent="#38bdf8">
            <SectionHeader icon="📈" title="Error Frequency Trend" subtitle="14-day rolling defect volume by severity" accent="#38bdf8" />
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={TREND_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradCrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fb923c" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                <Area type="monotone" dataKey="critical" name="Critical" stroke="#f87171" strokeWidth={2.5} fill="url(#gradCrit)" dot={false} activeDot={{ r: 5, fill: '#f87171', stroke: '#0f172a', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="high"     name="High"     stroke="#fb923c" strokeWidth={2}   fill="url(#gradHigh)" dot={false} activeDot={{ r: 5, fill: '#fb923c', stroke: '#0f172a', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="medium"   name="Medium"   stroke="#fbbf24" strokeWidth={1.5} fill="url(#gradMed)"  dot={false} activeDot={{ r: 5, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Trend summary pills */}
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Peak Day', value: 'Aug 10', icon: '📅', colour: '#f87171' },
                { label: 'Avg Daily', value: '8.2 bugs', icon: '📊', colour: '#38bdf8' },
                { label: 'Worst Severity', value: '5 critical', icon: '🔥', colour: '#f87171' },
                { label: 'Best Day', value: 'Aug 6 (5)', icon: '🏆', colour: '#34d399' },
              ].map((pill, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: `${pill.colour}0f`, border: `1px solid ${pill.colour}30`,
                  borderRadius: 10, padding: '8px 14px',
                }}>
                  <span>{pill.icon}</span>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10 }}>{pill.label}</div>
                    <div style={{ color: pill.colour, fontWeight: 700, fontSize: 13 }}>{pill.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Bar chart comparison */}
          <GlassCard accent="#818cf8">
            <SectionHeader icon="📉" title="Weekly Comparison" subtitle="This week vs. last week per severity" accent="#818cf8" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { week: 'Last Week', critical: 14, high: 19, medium: 12 },
                  { week: 'This Week', critical: 12, high: 21, medium: 15 },
                ]}
                margin={{ top: 8, right: 20, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(129,140,248,0.05)' }} />
                <Legend formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                <Bar dataKey="critical" name="Critical" fill="#f87171" radius={[4,4,0,0]} maxBarSize={36} />
                <Bar dataKey="high"     name="High"     fill="#fb923c" radius={[4,4,0,0]} maxBarSize={36} />
                <Bar dataKey="medium"   name="Medium"   fill="#fbbf24" radius={[4,4,0,0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: BREAKDOWN
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'breakdown' && (
        <div className="analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard>
            <SectionHeader icon="🧩" title="Component Breakdown" subtitle="Detailed error patterns, affected files, and failure counts per module" accent="#a78bfa" />
          </GlassCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {Object.entries(COMPONENT_DETAILS).map(([name, d], compIdx) => {
              const accent = COMPONENT_COLOURS[compIdx % COMPONENT_COLOURS.length];
              const col = hotspotColour(d.hotspotScore);
              return (
                <div key={name} className="breakdown-card" style={{
                  background: 'rgba(15,23,42,0.75)',
                  border: `1px solid ${accent}20`,
                  borderRadius: 16, padding: '20px',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{
                        color: accent, fontWeight: 700, fontSize: 16,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${accent}18`, border: `1px solid ${accent}35`,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                        }}>🧩</span>
                        {name}
                      </div>
                      <div style={{ color: '#475569', fontSize: 11, marginTop: 4, marginLeft: 36 }}>
                        {d.failureCount} total failures · MTTR {d.mttr}
                      </div>
                    </div>
                    <span style={{
                      background: col.bg, border: `1px solid ${col.border}55`,
                      color: col.text, fontSize: 13, fontWeight: 800,
                      borderRadius: 8, padding: '2px 10px',
                      alignSelf: 'flex-start',
                    }}>⚡ {d.hotspotScore}</span>
                  </div>

                  {/* Failure count bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#64748b', fontSize: 10 }}>Failure intensity</span>
                      <span style={{ color: accent, fontSize: 10, fontWeight: 600 }}>{d.failureCount} bugs</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${(d.failureCount / 20) * 100}%`,
                        background: `linear-gradient(90deg, ${accent}88, ${accent})`,
                        borderRadius: 3, boxShadow: `0 0 8px ${accent}50`,
                      }} />
                    </div>
                  </div>

                  {/* Error Patterns */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Error Patterns
                    </div>
                    {d.errorPatterns.map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                        background: `${accent}0c`, border: `1px solid ${accent}20`,
                      }}>
                        <span style={{ color: accent, fontSize: 12, marginTop: 1 }}>⚡</span>
                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>{p}</span>
                      </div>
                    ))}
                  </div>

                  {/* Affected Files */}
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Affected Files ({d.affectedFiles.length})
                    </div>
                    {d.affectedFiles.map((f, i) => (
                      <code key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 11, color: '#38bdf8',
                        background: 'rgba(56,189,248,0.07)', borderRadius: 6,
                        padding: '4px 10px', marginBottom: 3,
                        border: '1px solid rgba(56,189,248,0.15)',
                      }}>
                        <span style={{ opacity: 0.6 }}>📄</span> {f}
                      </code>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}