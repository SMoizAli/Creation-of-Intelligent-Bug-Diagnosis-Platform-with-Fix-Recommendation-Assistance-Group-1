import React from 'react';

export default function ActivityPanel() {
  const feed = [
    { text: 'Bug report uploaded (auth_npe.log)', time: '10 mins ago', type: 'upload' },
    { text: 'Multi-agent analysis completed successfully', time: '12 mins ago', type: 'complete' },
    { text: 'ChromaDB knowledge base seeded automatically', time: '34 mins ago', type: 'db' },
    { text: 'Report exported to PDF format', time: '1 hour ago', type: 'export' },
    { text: 'System settings changed: chunk_size=512', time: '2 hours ago', type: 'settings' },
  ];

  return (
    <div className="card activity-panel">
      <h3>Recent Activity Feed</h3>
      <p className="section-subtitle">Real-time trace of system operational events</p>
      
      <div className="activity-timeline">
        {feed.map((item, idx) => (
          <div key={idx} className="activity-item">
            <div className="activity-marker" />
            <div className="activity-details">
              <p className="activity-text">{item.text}</p>
              <span className="activity-time">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
