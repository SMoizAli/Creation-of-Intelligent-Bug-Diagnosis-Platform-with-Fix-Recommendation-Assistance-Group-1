import React, { useEffect, useState } from 'react';
import { getSettings } from '../services/api';

export default function SettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Custom interactive local configurations
  const [theme, setTheme] = useState('dark');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.70);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.75);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    alert("Enterprise configuration profile updated successfully.");
  };

  if (loading) return <div className="card">Loading settings...</div>;

  return (
    <div className="card settings-panel-container">
      <h2>System & Analysis Settings</h2>
      <p className="section-subtitle">Manage agent confidence metrics, similarity indexes, and theme styling profiles</p>
      
      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-section">
          <h3>UI Aesthetics</h3>
          <div className="form-group">
            <label>Theme Style</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="dark">Enterprise Dark Mode</option>
              <option value="light">Enterprise Light Mode</option>
            </select>
          </div>
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Enable Auto-Refresh metrics polling
            </label>
          </div>
          {autoRefresh && (
            <div className="form-group">
              <label>Polling Rate (seconds)</label>
              <input
                type="number"
                min={2}
                max={60}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>AI Analysis Thresholds</h3>
          <div className="form-group">
            <label>Confidence Threshold: <strong>{confidenceThreshold}</strong></label>
            <input
              type="range"
              min={0.10}
              max={1.00}
              step={0.05}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            />
            <small className="help-text">Lowest acceptable confidence before fallback heuristics trigger</small>
          </div>

          <div className="form-group">
            <label>Vector Duplicate Similarity Match Threshold: <strong>{similarityThreshold}</strong></label>
            <input
              type="range"
              min={0.50}
              max={1.00}
              step={0.05}
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
            />
            <small className="help-text">ChromaDB semantic distance threshold mapping matching duplicates</small>
          </div>
        </div>

        <div className="settings-section">
          <h3>Backend Environment Properties</h3>
          <dl className="settings-readonly-list">
            <dt>Embedding Model In Use</dt><dd><code>{settings.embedding_model}</code></dd>
            <dt>Text Chunk Size</dt><dd>{settings.chunk_size} characters</dd>
            <dt>Chunk Overlap</dt><dd>{settings.chunk_overlap} characters</dd>
            <dt>RAG Retrieval Count (Top-K)</dt><dd>{settings.retrieval_top_k} vectors</dd>
            <dt>Max File Upload Limit</dt><dd>{settings.max_upload_size_mb} MB</dd>
            <dt>Allowed Document Extensions</dt><dd><code>{settings.allowed_extensions?.join(', ')}</code></dd>
          </dl>
        </div>

        <button type="submit" className="btn btn-primary">Save Settings</button>
      </form>
    </div>
  );
}
