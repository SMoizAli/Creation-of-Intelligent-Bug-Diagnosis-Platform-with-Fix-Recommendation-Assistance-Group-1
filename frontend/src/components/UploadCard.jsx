import React, { useRef, useState } from 'react';
import { extractTextFromFile } from '../utils/clientParser';

const ALLOWED = ['.txt', '.log', '.json', '.xml', '.pdf', '.docx', '.csv', '.md'];
const MAX_MB = 10;

export default function UploadCard({ onUploadComplete, disabled, uiState }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const validateFile = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return `Unsupported file type "${ext}". Allowed: ${ALLOWED.join(', ')}`;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return `File exceeds ${MAX_MB} MB limit.`;
    }
    return null;
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const processFile = async (f) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    
    // Client-side extraction prevents low-memory server OOM crashes
    setLoading(true);
    try {
      const extractedText = await extractTextFromFile(f);
      const cleanTitle = f.name.replace(/\.[^/.]+$/, '');
      await onUploadComplete({
        content: extractedText,
        title: cleanTitle,
        file_name: f.name,
      });
    } catch (err) {
      setError(err.message || "Failed to process file.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await onUploadComplete({
        content: content.trim(),
        title: `Bug Report - ${new Date().toLocaleTimeString()}`,
        file_name: 'Manual Text Submission'
      });
    } catch (err) {
      setError(err.message || "Failed to submit text.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  return (
    <div className="card upload-card-container">
      <h2>Smart Bug Upload Center</h2>
      <p className="section-subtitle">
        Upload log traces or paste bug descriptions. Supports TXT, LOG, JSON, XML, PDF, DOCX, CSV, MD up to {MAX_MB}MB.
      </p>

      {/* Drag & Drop Upload Zone */}
      <div
        className={`drag-drop-zone ${isDragOver ? 'drag-over' : ''} ${loading ? 'parsing' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED.join(',')}
          onChange={handleFileChange}
          hidden
        />
        <div className="upload-icon">↑</div>
        {loading ? (
          <p className="upload-text">Extracting readable content from document...</p>
        ) : file ? (
          <p className="upload-text selected">File selected: <strong>{file.name}</strong></p>
        ) : (
          <p className="upload-text">
            Drag & drop your bug file here, or <span className="browse-link">browse files</span>
          </p>
        )}
      </div>

      {/* Paste text area */}
      <div className="paste-area-container">
        <label htmlFor="bug-content">Or paste report content manually</label>
        <textarea
          id="bug-content"
          rows={7}
          placeholder="Paste raw log outputs, stack traces, or ticket descriptions..."
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(null); }}
          disabled={disabled || loading}
        />
        <button
          className="btn btn-secondary text-submit-btn"
          onClick={handleTextSubmit}
          disabled={!content.trim() || disabled || loading}
        >
          Submit Raw Text
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
    </div>
  );
}
