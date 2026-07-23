import React from 'react';

export default function RecommendationPanel() {
  const recommendations = [
    {
      id: 'REC-01',
      title: 'Authentication module failures recurring',
      desc: 'Most duplicate bugs originate from Authentication token expirations. Recommend updating JWT expiry checks.',
      type: 'critical',
      timestamp: '2 hours ago'
    },
    {
      id: 'REC-02',
      title: 'API integration failures trending upward',
      desc: 'HTTP 503 Gateway connection timeouts increased by 15% under pool load. Recommend reviewing connection pool settings.',
      type: 'warning',
      timestamp: '1 day ago'
    },
    {
      id: 'REC-03',
      title: 'React memory leaks diagnosed',
      desc: 'Multiple client UI state failures mapped to dashboard card unmounts. Recommend checking cleanup handlers.',
      type: 'info',
      timestamp: '3 days ago'
    }
  ];

  return (
    <div className="card recommendation-panel">
      <h3>AI Diagnostic Insights</h3>
      <p className="section-subtitle">Aggregated trends and proactive recommendations</p>
      
      <div className="rec-list">
        {recommendations.map((rec) => (
          <div key={rec.id} className={`rec-item ${rec.type}`}>
            <div className="rec-header">
              <span className={`rec-badge ${rec.type}`}>{rec.type.toUpperCase()}</span>
              <span className="rec-time">{rec.timestamp}</span>
            </div>
            <h4>{rec.title}</h4>
            <p>{rec.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
