import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Command Center', icon: '◫' },
  { id: 'upload', label: 'Bug Upload', icon: '↑' },
  { id: 'results', label: 'Analysis Findings', icon: '✓' },
  { id: 'history', label: 'History Logs', icon: '☰' },
  { id: 'analytics', label: 'Analytics Insights', icon: '📈' },
  { id: 'health', label: 'System Health', icon: '♥' },
  { id: 'settings', label: 'Settings Configuration', icon: '⚙' },
];

export default function Sidebar({ activeView, onNavigate, systemStatus }) {
  const statusColor = {
    ready: '#10b981',
    degraded: '#f59e0b',
    unavailable: '#ef4444',
    checking: '#94a3b8',
  }[systemStatus] || '#94a3b8';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>AI-Smart-Bug-Analyzer-And-Fix-Advisor Enterprise</h1>
        <p>AI Smart Bug Analyzer</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-status">
        <span
          className="status-dot"
          style={{ color: statusColor, backgroundColor: statusColor }}
        />
        Node Status: <strong style={{ color: statusColor }}>{systemStatus.toUpperCase()}</strong>
      </div>
    </aside>
  );
}
