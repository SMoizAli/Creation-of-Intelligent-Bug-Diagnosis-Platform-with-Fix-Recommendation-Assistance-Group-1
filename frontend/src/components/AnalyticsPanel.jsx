import React from 'react';

export default function AnalyticsPanel() {
  // Static mock stats for dashboard visual graphics
  const priorityData = [
    { label: 'Critical', value: 35, color: '#f87171' },
    { label: 'High', value: 45, color: '#fb923c' },
    { label: 'Medium', value: 65, color: '#fbbf24' },
    { label: 'Low', value: 20, color: '#34d399' },
  ];

  const categoryData = [
    { label: 'Auth', count: 12, color: '#38bdf8' },
    { label: 'DB Connection', count: 8, color: '#818cf8' },
    { label: 'API Schema', count: 15, color: '#c084fc' },
    { label: 'Memory Leak', count: 5, color: '#f472b6' },
    { label: 'SSL Certs', count: 9, color: '#fb7185' },
  ];

  const speedData = [
    { month: 'Jan', time: 1.2 },
    { month: 'Feb', time: 0.95 },
    { month: 'Mar', time: 1.1 },
    { month: 'Apr', time: 0.8 },
    { month: 'May', time: 0.72 },
    { month: 'Jun', time: 0.65 },
  ];

  const maxPriority = Math.max(...priorityData.map(d => d.value));
  const maxCategory = Math.max(...categoryData.map(d => d.count));

  return (
    <div className="analytics-container">
      {/* Priority Bar Chart */}
      <div className="card chart-card">
        <h3>Bug Priority Distribution</h3>
        <p className="chart-subtitle">Historical statistics of bug severities classified</p>
        <div className="bar-chart">
          {priorityData.map((d) => {
            const pct = (d.value / maxPriority) * 100;
            return (
              <div key={d.label} className="bar-row">
                <span className="bar-label">{d.label}</span>
                <div className="bar-wrapper">
                  <div
                    className="bar-fill"
                    style={{ width: `${pct}%`, background: d.color }}
                  />
                </div>
                <span className="bar-value">{d.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Distribution (Horizontal Cards/Bars) */}
      <div className="card chart-card">
        <h3>Component Analysis Count</h3>
        <p className="chart-subtitle">Breakdown of bugs diagnosed by internal module</p>
        <div className="category-chart">
          {categoryData.map((d) => {
            const pct = (d.count / maxCategory) * 100;
            return (
              <div key={d.label} className="cat-row">
                <div className="cat-header">
                  <span>{d.label}</span>
                  <strong>{d.count} bugs</strong>
                </div>
                <div className="cat-bar-bg">
                  <div
                    className="cat-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: d.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AVG Processing Speed Line Chart (Custom SVG Line) */}
      <div className="card chart-card full-width">
        <h3>Average AI Execution Time (seconds)</h3>
        <p className="chart-subtitle">Pipeline latency metrics over the last 6 months</p>
        
        <div className="line-chart-svg-container">
          <svg className="line-chart-svg" viewBox="0 0 500 150">
            {/* SVG Gradients */}
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="50" y1="20" x2="450" y2="20" stroke="#334155" strokeDasharray="4 4" />
            <line x1="50" y1="70" x2="450" y2="70" stroke="#334155" strokeDasharray="4 4" />
            <line x1="50" y1="120" x2="450" y2="120" stroke="#334155" />

            {/* Points & Line */}
            {/* Coordinates calculated roughly: x: 50 -> 450 (6 points, step 80), y: 120 (0s) -> 20 (1.5s) */}
            <path
              d="M 50 40 L 130 60 L 210 48 L 290 72 L 370 78 L 450 84"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* Area under line */}
            <path
              d="M 50 40 L 130 60 L 210 48 L 290 72 L 370 78 L 450 84 L 450 120 L 50 120 Z"
              fill="url(#chartGradient)"
            />

            {/* Point circles */}
            <circle cx="50" cy="40" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            <circle cx="130" cy="60" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            <circle cx="210" cy="48" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            <circle cx="290" cy="72" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            <circle cx="370" cy="78" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            <circle cx="450" cy="84" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />

            {/* Axis Labels */}
            <text x="50" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Jan</text>
            <text x="130" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Feb</text>
            <text x="210" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Mar</text>
            <text x="290" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Apr</text>
            <text x="370" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">May</text>
            <text x="450" y="140" fill="#94a3b8" fontSize="10" textAnchor="middle">Jun</text>

            <text x="40" y="24" fill="#94a3b8" fontSize="9" textAnchor="end">1.5s</text>
            <text x="40" y="74" fill="#94a3b8" fontSize="9" textAnchor="end">0.75s</text>
            <text x="40" y="124" fill="#94a3b8" fontSize="9" textAnchor="end">0.0s</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
