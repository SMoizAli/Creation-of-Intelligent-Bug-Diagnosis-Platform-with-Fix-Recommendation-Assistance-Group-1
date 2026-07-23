import React from 'react';

export default function StatusIndicators({ status, loading }) {
  if (loading) {
    return (
      <div className="status-grid">
        <div className="status-card checking">Checking services...</div>
      </div>
    );
  }

  return (
    <div className="status-grid">
      <div className={`status-card overall ${status.overall}`}>
        <h3>System Status</h3>
        <p className="status-value">{status.overall?.toUpperCase()}</p>
      </div>
      {status.services?.map((svc) => (
        <div key={svc.name} className={`status-card ${svc.status}`}>
          <h4>{svc.name}</h4>
          <p>{svc.status}</p>
          <small>{svc.message}</small>
        </div>
      ))}
      <div className="status-card">
        <h4>Indexed Bugs</h4>
        <p className="status-value">{status.chroma_documents ?? 0}</p>
      </div>
      <div className="status-card">
        <h4>Total Submissions</h4>
        <p className="status-value">{status.total_bugs ?? 0}</p>
      </div>
    </div>
  );
}
