import React, { useEffect, useState } from 'react';
import { getHistory } from '../services/api';

export default function HistoryPanel({ onSelectAnalysis }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getHistory()
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Loading history...</div>;
  if (error) return <div className="card alert-error">{error}</div>;

  const filteredItems = items.filter((item) =>
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bug_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.component?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="card history-panel-container">
      <div className="history-header">
        <h2>Analysis History Logs</h2>
        <input
          type="text"
          placeholder="Search by bug ID, title, or component..."
          className="search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <p className="no-history-text">No matching history entries found.</p>
      ) : (
        <div className="table-responsive">
          <table className="history-table">
            <thead>
              <tr>
                <th>Bug ID</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Component</th>
                <th>Status</th>
                <th>Analysis Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="history-row-clickable"
                  onClick={() => onSelectAnalysis(item.analysis_id)}
                  title="Click to view detailed analysis results"
                >
                  <td><code>{item.bug_id}</code></td>
                  <td>{item.title}</td>
                  <td>
                    <span className={`badge-priority-label ${item.priority}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td><code>{item.component}</code></td>
                  <td>
                    <span className={`status-badge-inline ${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
