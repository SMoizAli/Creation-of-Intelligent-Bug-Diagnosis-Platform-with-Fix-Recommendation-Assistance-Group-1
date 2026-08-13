import React, { useState, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   Mock KB data — simulates vector-stored ChromaDB entries
   ══════════════════════════════════════════════════════════════════════════ */
const INITIAL_KB_ENTRIES = [
  {
    id: 'KB-001', bugId: 'BUG-4821', component: 'PaymentGateway',
    rootCause: 'Redis Connection Timeout', category: 'infrastructure',
    language: 'Java', priority: 'critical', verified: true, confidence: 94,
    vectorId: 'chroma-vec-001', dateAdded: '2026-07-15',
    resolution: 'Increased Redis pool size & added circuit breaker',
    chunkCount: 3, embeddingDim: 1536, similarity: 0.962,
  },
  {
    id: 'KB-002', bugId: 'BUG-3917', component: 'DataPipeline',
    rootCause: 'Spark Shuffle OOM', category: 'resource_exhaustion',
    language: 'Python', priority: 'high', verified: true, confidence: 89,
    vectorId: 'chroma-vec-002', dateAdded: '2026-07-18',
    resolution: 'Tuned spark.sql.shuffle.partitions and executor memory',
    chunkCount: 4, embeddingDim: 1536, similarity: 0.918,
  },
  {
    id: 'KB-003', bugId: 'BUG-5102', component: 'APIGateway',
    rootCause: 'Unhandled Promise Rejection', category: 'concurrency',
    language: 'Node.js', priority: 'high', verified: true, confidence: 91,
    vectorId: 'chroma-vec-003', dateAdded: '2026-07-22',
    resolution: 'Added global process.on unhandledRejection handler & async/await guards',
    chunkCount: 2, embeddingDim: 1536, similarity: 0.934,
  },
  {
    id: 'KB-004', bugId: 'BUG-2883', component: 'DatabaseService',
    rootCause: 'SQL Deadlock on Concurrent Writes', category: 'database',
    language: 'SQL / Java', priority: 'critical', verified: true, confidence: 97,
    vectorId: 'chroma-vec-004', dateAdded: '2026-07-25',
    resolution: 'Implemented optimistic locking & retry-on-deadlock strategy',
    chunkCount: 5, embeddingDim: 1536, similarity: 0.979,
  },
  {
    id: 'KB-005', bugId: 'BUG-6048', component: 'AuthService',
    rootCause: 'NullPointerException on Token Validation', category: 'null_reference',
    language: 'Java', priority: 'critical', verified: true, confidence: 96,
    vectorId: 'chroma-vec-005', dateAdded: '2026-07-28',
    resolution: 'Added null-guard before token.getClaims() and Optional<> wrappers',
    chunkCount: 3, embeddingDim: 1536, similarity: 0.955,
  },
  {
    id: 'KB-006', bugId: 'BUG-4433', component: 'NotificationService',
    rootCause: 'Kafka Consumer Lag Spike', category: 'infrastructure',
    language: 'Java', priority: 'medium', verified: true, confidence: 82,
    vectorId: 'chroma-vec-006', dateAdded: '2026-08-01',
    resolution: 'Scaled consumer group & tuned max.poll.records',
    chunkCount: 3, embeddingDim: 1536, similarity: 0.889,
  },
  {
    id: 'KB-007', bugId: 'BUG-7201', component: 'InventoryService',
    rootCause: 'Race Condition in Stock Update', category: 'concurrency',
    language: 'Python', priority: 'high', verified: false, confidence: 74,
    vectorId: 'chroma-vec-007', dateAdded: '2026-08-03',
    resolution: 'Pending: apply distributed lock via Redis SETNX',
    chunkCount: 2, embeddingDim: 1536, similarity: 0.821,
  },
  {
    id: 'KB-008', bugId: 'BUG-5567', component: 'ReportingEngine',
    rootCause: 'Memory Leak in Chart Renderer', category: 'resource_exhaustion',
    language: 'Node.js', priority: 'medium', verified: true, confidence: 88,
    vectorId: 'chroma-vec-008', dateAdded: '2026-08-05',
    resolution: 'Destroyed canvas instances on component unmount',
    chunkCount: 2, embeddingDim: 1536, similarity: 0.903,
  },
  {
    id: 'KB-009', bugId: 'BUG-3309', component: 'SearchService',
    rootCause: 'Elasticsearch Index Timeout', category: 'infrastructure',
    language: 'Python', priority: 'high', verified: true, confidence: 90,
    vectorId: 'chroma-vec-009', dateAdded: '2026-08-06',
    resolution: 'Added index refresh throttle & bulk request batching',
    chunkCount: 3, embeddingDim: 1536, similarity: 0.927,
  },
  {
    id: 'KB-010', bugId: 'BUG-8800', component: 'CheckoutService',
    rootCause: 'Transaction Rollback on Partial Commit', category: 'database',
    language: 'Java', priority: 'critical', verified: true, confidence: 95,
    vectorId: 'chroma-vec-010', dateAdded: '2026-08-08',
    resolution: 'Wrapped in @Transactional with REQUIRES_NEW propagation',
    chunkCount: 4, embeddingDim: 1536, similarity: 0.951,
  },
  {
    id: 'KB-011', bugId: 'BUG-6612', component: 'MLInferenceAPI',
    rootCause: 'CUDA Out-of-Memory on Batch Inference', category: 'resource_exhaustion',
    language: 'Python', priority: 'high', verified: false, confidence: 71,
    vectorId: 'chroma-vec-011', dateAdded: '2026-08-09',
    resolution: 'Pending: implement dynamic batch size + gradient checkpointing',
    chunkCount: 3, embeddingDim: 1536, similarity: 0.798,
  },
  {
    id: 'KB-012', bugId: 'BUG-9145', component: 'SessionManager',
    rootCause: 'JWT Expiry Race Condition', category: 'concurrency',
    language: 'Node.js', priority: 'medium', verified: true, confidence: 86,
    vectorId: 'chroma-vec-012', dateAdded: '2026-08-11',
    resolution: 'Added clock-skew buffer + refresh token atomic swap',
    chunkCount: 2, embeddingDim: 1536, similarity: 0.912,
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const categoryColors = {
  infrastructure:      { bg: 'rgba(56,189,248,0.12)',  text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
  resource_exhaustion: { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  concurrency:         { bg: 'rgba(192,132,252,0.12)', text: '#c084fc', border: 'rgba(192,132,252,0.3)' },
  database:            { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.3)'  },
  null_reference:      { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
};
const priorityBadge = { critical: 'badge-priority critical', high: 'badge-priority high', medium: 'badge-priority medium', low: 'badge-priority low' };
const langIcons = { Java: '☕', Python: '🐍', 'Node.js': '🟢', 'SQL / Java': '🗄️' };

/* ── Generate rich mock JSON payload for a KB entry ─────────────────────── */
function buildJsonPayload(entry) {
  return {
    document_id: entry.id,
    bug_ref: entry.bugId,
    collection: 'asba_knowledge_base',
    timestamp_utc: `${entry.dateAdded}T${String(Math.floor(Math.random()*23)+1).padStart(2,'0')}:${String(Math.floor(Math.random()*59)).padStart(2,'0')}:00Z`,
    content: {
      component: entry.component,
      language: entry.language,
      root_cause: entry.rootCause,
      category: entry.category,
      priority: entry.priority,
      confidence_score: entry.confidence / 100,
      verified: entry.verified,
      resolution_summary: entry.resolution,
    },
    metadata: {
      vector_id: entry.vectorId,
      embedding_model: 'text-embedding-ada-002',
      embedding_dim: entry.embeddingDim,
      chunk_count: entry.chunkCount,
      cosine_similarity: entry.similarity,
      indexed_at: entry.dateAdded,
      source: 'asba-pipeline-v2',
      agents_involved: ['TriageAgent', 'RootCauseAgent', 'RemediationAgent'],
    },
    fix_schema_version: '2.1.0',
  };
}

function buildEmbeddingMeta(entry) {
  // Generate deterministic fake embedding snippet
  const seed = entry.id.charCodeAt(3) || 1;
  const dims = Array.from({ length: 12 }, (_, i) =>
    parseFloat(((Math.sin(seed * (i + 1)) * 0.45 + Math.cos(seed * i * 0.3) * 0.35)).toFixed(6))
  );
  return {
    vector_id: entry.vectorId,
    model: 'text-embedding-ada-002',
    dimensions: entry.embeddingDim,
    shown_dims: 12,
    sample_values: dims,
    norm: parseFloat((Math.sqrt(dims.reduce((a, v) => a + v*v, 0))).toFixed(6)),
    cosine_similarity_to_query: entry.similarity,
    hnsw_index: `hnsw::${entry.vectorId}::l2`,
    segment_id: `seg-${entry.id.toLowerCase()}-0`,
    persist_dir: `./chroma_db/${entry.vectorId.replace('chroma-','')}/`,
  };
}

function buildChunkStructure(entry) {
  return Array.from({ length: entry.chunkCount }, (_, i) => ({
    chunk_index: i,
    chunk_id: `${entry.vectorId}-chunk-${i}`,
    token_count: 128 + Math.floor(Math.sin(i * 3.7) * 60 + 60),
    start_char: i * 420,
    end_char: (i + 1) * 420,
    text_preview: i === 0
      ? `[TRIAGE] Component: ${entry.component} | Priority: ${entry.priority.toUpperCase()} | Root cause identified as "${entry.rootCause}"...`
      : i === 1
      ? `[ROOT_CAUSE] Analysis confirms ${entry.rootCause}. Confidence: ${entry.confidence}%. Pattern matches ${entry.chunkCount - 1} historical entries...`
      : `[REMEDIATION] Recommended fix: ${entry.resolution.slice(0, 80)}...`,
    embedding_ref: `${entry.vectorId}-chunk-${i}-emb`,
    overlap_tokens: 20,
  }));
}

function buildFixSchema(entry) {
  return {
    schema_version: '2.1.0',
    schema_id: `fix-schema-${entry.category}`,
    fields: {
      bug_id:         { type: 'string',  required: true,  value: entry.bugId       },
      component:      { type: 'string',  required: true,  value: entry.component   },
      root_cause:     { type: 'string',  required: true,  value: entry.rootCause   },
      category:       { type: 'enum',    required: true,  value: entry.category,   enum_values: ['infrastructure','resource_exhaustion','concurrency','database','null_reference'] },
      priority:       { type: 'enum',    required: true,  value: entry.priority,   enum_values: ['critical','high','medium','low'] },
      language:       { type: 'string',  required: false, value: entry.language    },
      resolution:     { type: 'text',    required: true,  value: entry.resolution  },
      confidence:     { type: 'float',   required: true,  value: entry.confidence / 100, range: [0, 1] },
      verified:       { type: 'boolean', required: true,  value: entry.verified    },
      vector_id:      { type: 'string',  required: true,  value: entry.vectorId    },
      date_added:     { type: 'date',    required: true,  value: entry.dateAdded   },
      fix_applied_by: { type: 'string',  required: false, value: 'asba-remediation-agent-v2' },
    },
    validation_rules: [
      'confidence must be between 0.0 and 1.0',
      'root_cause must be non-empty string',
      'resolution required when verified=true',
      'vector_id must match pattern: chroma-vec-\\d{3}',
    ],
  };
}

/* ── JSON syntax highlighter (basic) ────────────────────────────────────── */
function HighlightedJSON({ value }) {
  const json = JSON.stringify(value, null, 2);
  const highlighted = json
    .replace(/(".*?")\s*:/g, '<span style="color:#c084fc">$1</span>:')
    .replace(/:\s*(".*?")/g, ': <span style="color:#34d399">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span style="color:#fb923c">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#38bdf8">$1</span>');
  return (
    <pre
      dangerouslySetInnerHTML={{ __html: highlighted }}
      style={{
        margin: 0, fontSize: 12, lineHeight: 1.7,
        color: '#e2e8f0', overflowX: 'auto',
        fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
      }}
    />
  );
}

/* ── Inspection Modal ────────────────────────────────────────────────────── */
function InspectionModal({ entry, onClose }) {
  const [activeTab, setActiveTab] = useState('json');

  if (!entry) return null;

  const jsonPayload = buildJsonPayload(entry);
  const embeddingMeta = buildEmbeddingMeta(entry);
  const chunkStructure = buildChunkStructure(entry);
  const fixSchema = buildFixSchema(entry);

  const tabs = [
    { id: 'json',      label: '{ } JSON Payload'      },
    { id: 'embedding', label: '⚡ Vector Embedding'    },
    { id: 'chunks',    label: '🧩 Chunk Structure'     },
    { id: 'schema',    label: '📐 Fix Schema'          },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9000,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Modal panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(820px, 94vw)', maxHeight: '88vh',
        background: 'rgba(9,13,22,0.97)',
        border: '1px solid rgba(56,189,248,0.25)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(56,189,248,0.08)',
        zIndex: 9001,
        display: 'flex', flexDirection: 'column',
        animation: 'modalSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalSlideIn {
            from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
          }
          .insp-tab:hover { background: rgba(56,189,248,0.08) !important; }
          .insp-copy-btn:hover { background: rgba(56,189,248,0.2) !important; }
        `}</style>

        {/* Modal header */}
        <div style={{
          padding: '20px 24px 0',
          borderBottom: '1px solid rgba(30,41,59,0.8)',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.05), rgba(129,140,248,0.05))',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: 'linear-gradient(135deg,rgba(56,189,248,0.2),rgba(129,140,248,0.2))',
                  border: '1px solid rgba(56,189,248,0.3)',
                  borderRadius: 8, padding: '4px 10px',
                  color: '#38bdf8', fontSize: 12, fontWeight: 700,
                }}>🔬 KB INSPECTION</span>
                <code style={{ color: '#818cf8', fontSize: 13 }}>{entry.bugId}</code>
                <span style={{ color: '#475569', fontSize: 12 }}>·</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{entry.id}</span>
              </div>
              <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginTop: 6, margin: '6px 0 0' }}>
                {entry.component} — {entry.rootCause}
              </h3>
              <p style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>
                Vector: <code style={{ color: '#38bdf8' }}>{entry.vectorId}</code>
                {' · '}Similarity: <strong style={{ color: '#34d399' }}>{(entry.similarity * 100).toFixed(1)}%</strong>
                {' · '}{entry.chunkCount} chunks · {entry.embeddingDim}d embedding
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: 18, lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className="insp-tab"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: activeTab === tab.id ? '#38bdf8' : '#475569',
                  borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.15s',
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* Tab body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── JSON Payload ────────────────────────────────────────────── */}
          {activeTab === 'json' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  Raw JSON document written to ChromaDB for <strong style={{ color: '#c084fc' }}>{entry.bugId}</strong>
                </div>
                <button
                  className="insp-copy-btn"
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(jsonPayload, null, 2))}
                  style={{
                    padding: '4px 12px', background: 'rgba(56,189,248,0.1)',
                    border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6,
                    color: '#38bdf8', fontSize: 11, cursor: 'pointer',
                  }}
                >📋 Copy JSON</button>
              </div>
              <div style={{
                background: '#060a12', borderRadius: 12,
                border: '1px solid #1e293b', padding: '16px 18px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 8, right: 12,
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                  color: '#10b981', fontSize: 10, padding: '2px 8px', borderRadius: 4,
                }}>JSON</div>
                <HighlightedJSON value={jsonPayload} />
              </div>
            </div>
          )}

          {/* ── Vector Embedding ────────────────────────────────────────── */}
          {activeTab === 'embedding' && (
            <div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                Vector embedding metadata stored in ChromaDB's HNSW index
              </div>
              {/* Meta cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Model',       value: 'ada-002',           colour: '#c084fc' },
                  { label: 'Dimensions',  value: `${entry.embeddingDim}d`, colour: '#38bdf8' },
                  { label: 'Similarity',  value: `${(entry.similarity*100).toFixed(1)}%`, colour: '#34d399' },
                  { label: 'Index Type',  value: 'HNSW L2',           colour: '#fb923c' },
                  { label: 'Norm',        value: embeddingMeta.norm,  colour: '#818cf8' },
                  { label: 'Segment',     value: embeddingMeta.segment_id, colour: '#f472b6' },
                ].map((m, i) => (
                  <div key={i} style={{
                    background: `${m.colour}0c`, border: `1px solid ${m.colour}25`,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ color: m.colour, fontWeight: 700, fontSize: 13, wordBreak: 'break-all' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Embedding vector sample */}
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                Sample dims [0–11] of {entry.embeddingDim} — visual bar representation:
              </div>
              <div style={{ background: '#060a12', borderRadius: 12, border: '1px solid #1e293b', padding: '16px 18px' }}>
                {embeddingMeta.sample_values.map((v, i) => {
                  const abs = Math.abs(v);
                  const positive = v >= 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <span style={{ color: '#475569', fontSize: 10, fontFamily: 'monospace', width: 50, textAlign: 'right' }}>
                        dim[{String(i).padStart(2, '0')}]
                      </span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                          {!positive && (
                            <div style={{
                              height: 10, width: `${abs * 100}%`, maxWidth: '100%',
                              background: 'linear-gradient(90deg, transparent, #f87171)',
                              borderRadius: '4px 0 0 4px',
                            }} />
                          )}
                        </div>
                        <div style={{ width: 1, height: 12, background: '#334155' }} />
                        <div style={{ width: '50%' }}>
                          {positive && (
                            <div style={{
                              height: 10, width: `${abs * 100}%`, maxWidth: '100%',
                              background: 'linear-gradient(90deg, #38bdf8, transparent)',
                              borderRadius: '0 4px 4px 0',
                            }} />
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: positive ? '#38bdf8' : '#f87171', width: 72, textAlign: 'right',
                      }}>{v.toFixed(6)}</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, color: '#334155', fontSize: 11, textAlign: 'center' }}>
                  … {entry.embeddingDim - 12} more dimensions not shown
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Persist path:</div>
                <code style={{
                  display: 'block', background: '#060a12', border: '1px solid #1e293b',
                  borderRadius: 8, padding: '10px 14px', color: '#34d399', fontSize: 12,
                }}>{embeddingMeta.persist_dir}</code>
              </div>
            </div>
          )}

          {/* ── Chunk Structure ─────────────────────────────────────────── */}
          {activeTab === 'chunks' && (
            <div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
                Document split into <strong style={{ color: '#c084fc' }}>{entry.chunkCount} semantic chunks</strong> with 20-token overlap for retrieval
              </div>
              {/* Summary bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Chunks',    value: entry.chunkCount,  colour: '#c084fc' },
                  { label: 'Overlap Tokens',  value: '20',              colour: '#fb923c' },
                  { label: 'Chunking Strategy', value: 'Recursive',    colour: '#38bdf8' },
                  { label: 'Chunk Size',      value: '512 tokens max',  colour: '#34d399' },
                ].map((m, i) => (
                  <div key={i} style={{
                    background: `${m.colour}0c`, border: `1px solid ${m.colour}25`,
                    borderRadius: 10, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center',
                  }}>
                    <span style={{ color: m.colour, fontWeight: 700, fontSize: 13 }}>{m.value}</span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{m.label}</span>
                  </div>
                ))}
              </div>

              {/* Chunk cards */}
              {chunkStructure.map((chunk, i) => (
                <div key={i} style={{
                  background: '#060a12', border: '1px solid #1e293b',
                  borderRadius: 12, padding: '14px 18px', marginBottom: 12,
                  borderLeft: `3px solid ${['#38bdf8','#c084fc','#34d399'][i % 3]}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        background: `${['rgba(56,189,248,0.15)','rgba(192,132,252,0.15)','rgba(52,211,153,0.15)'][i % 3]}`,
                        color: ['#38bdf8','#c084fc','#34d399'][i % 3],
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      }}>CHUNK {chunk.chunk_index}</span>
                      <code style={{ color: '#475569', fontSize: 10 }}>{chunk.chunk_id}</code>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ color: '#64748b', fontSize: 11 }}>
                        Tokens: <strong style={{ color: '#f1f5f9' }}>{chunk.token_count}</strong>
                      </span>
                      <span style={{ color: '#64748b', fontSize: 11 }}>
                        Chars: <strong style={{ color: '#f1f5f9' }}>{chunk.start_char}–{chunk.end_char}</strong>
                      </span>
                    </div>
                  </div>
                  <div style={{
                    color: '#94a3b8', fontSize: 12, fontStyle: 'italic',
                    padding: '8px 12px', background: 'rgba(56,189,248,0.04)',
                    borderRadius: 8, border: '1px solid rgba(56,189,248,0.08)',
                  }}>"{chunk.text_preview}"</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                    <span style={{ color: '#334155', fontSize: 10 }}>Embedding ref:</span>
                    <code style={{ color: '#475569', fontSize: 10 }}>{chunk.embedding_ref}</code>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Fix Schema ──────────────────────────────────────────────── */}
          {activeTab === 'schema' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  Validated fix schema written alongside the vector embedding
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10b981', fontSize: 11, padding: '2px 10px', borderRadius: 4, fontWeight: 600,
                  }}>v{fixSchema.schema_version}</span>
                  <span style={{
                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                    color: '#38bdf8', fontSize: 11, padding: '2px 10px', borderRadius: 4,
                  }}>{fixSchema.schema_id}</span>
                </div>
              </div>

              {/* Field table */}
              <div style={{ background: '#060a12', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(30,41,59,0.8)' }}>
                      {['Field', 'Type', 'Required', 'Value'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(fixSchema.fields).map(([field, def], i) => (
                      <tr key={field} style={{ borderTop: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '8px 14px' }}>
                          <code style={{ color: '#c084fc', fontSize: 12 }}>{field}</code>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{
                            background: def.type === 'string' ? 'rgba(56,189,248,0.1)' : def.type === 'boolean' ? 'rgba(251,146,60,0.1)' : def.type === 'float' ? 'rgba(52,211,153,0.1)' : 'rgba(129,140,248,0.1)',
                            color: def.type === 'string' ? '#38bdf8' : def.type === 'boolean' ? '#fb923c' : def.type === 'float' ? '#34d399' : '#818cf8',
                            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace',
                          }}>{def.type}</span>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {def.required
                            ? <span style={{ color: '#f87171', fontSize: 11 }}>● required</span>
                            : <span style={{ color: '#475569', fontSize: 11 }}>○ optional</span>}
                        </td>
                        <td style={{ padding: '8px 14px', maxWidth: 240 }}>
                          <span style={{ color: '#94a3b8', fontSize: 11, wordBreak: 'break-all' }}>
                            {typeof def.value === 'boolean'
                              ? <span style={{ color: def.value ? '#34d399' : '#f87171' }}>{String(def.value)}</span>
                              : typeof def.value === 'number'
                              ? <span style={{ color: '#38bdf8' }}>{def.value}</span>
                              : <span style={{ color: '#e2e8f0' }}>{String(def.value).slice(0, 50)}{String(def.value).length > 50 ? '…' : ''}</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Validation rules */}
              <div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Validation Rules</div>
                {fixSchema.validation_rules.map((rule, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8, marginBottom: 6,
                    background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)',
                  }}>
                    <span style={{ color: '#fbbf24', fontSize: 14 }}>⚠</span>
                    <code style={{ color: '#94a3b8', fontSize: 11 }}>{rule}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(30,41,59,0.8)',
          background: 'rgba(9,13,22,0.5)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#334155', fontSize: 11 }}>
            ChromaDB · persist: ./chroma_db/ · Collection: asba_knowledge_base
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '7px 20px',
              background: 'rgba(56,189,248,0.1)',
              border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: 8, color: '#38bdf8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >Close Inspector</button>
        </div>
      </div>
    </>
  );
}

/* ── Build a real KB entry from a completed analysis ────────────────────────
   Converts the live analysis + bug objects (from App state / sessionStorage)
   into a properly typed KB entry that can be stored in ChromaDB and displayed
   in the inspection modal.
   ─────────────────────────────────────────────────────────────────────────── */
function buildEntryFromAnalysis(lastAnalyzedBug, entriesLength) {
  const { analysis, bug } = lastAnalyzedBug;
  const triage      = analysis?.triage             || {};
  const rootCause   = analysis?.root_cause         || {};
  const remediation = analysis?.remediation        || {};
  const confData    = analysis?.confidence_scoring || {};
  const logs        = analysis?.log_analysis       || {};

  const priority     = (triage.priority || 'medium').toLowerCase();
  const component    = triage.component || bug?.title || 'UnknownService';
  const rootCauseCat = (rootCause.root_cause_category || 'code_defect').replace(/_/g, ' ');
  const rawConf      = confData.confidence_score ?? rootCause.confidence ?? 0.8;
  const confidence   = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);

  const categoryMap = {
    infrastructure: 'infrastructure',
    resource_exhaustion: 'resource_exhaustion',
    concurrency: 'concurrency',
    database: 'database',
    null_reference: 'null_reference',
    code_defect: 'concurrency',
    configuration: 'infrastructure',
  };
  const rcKey    = (rootCause.root_cause_category || '').toLowerCase().replace(/ /g, '_');
  const category = categoryMap[rcKey] || 'infrastructure';

  let language = 'Java';
  const fname = (bug?.file_name || '').toLowerCase();
  if (fname.endsWith('.py') || fname.includes('python'))   language = 'Python';
  else if (fname.endsWith('.js') || fname.endsWith('.ts')) language = 'Node.js';
  else if (fname.endsWith('.go'))                          language = 'Go';

  const newId    = `KB-${String(entriesLength + 1).padStart(3, '0')}`;
  const vectorId = `chroma-vec-${String(entriesLength + 1).padStart(3, '0')}`;

  return {
    id: newId,
    bugId: bug?.id ? `BUG-${bug.id}` : `BUG-${9000 + entriesLength}`,
    component,
    rootCause: rootCauseCat.charAt(0).toUpperCase() + rootCauseCat.slice(1),
    category,
    language,
    priority,
    verified: true,
    confidence,
    vectorId,
    dateAdded: new Date().toISOString().slice(0, 10),
    resolution:
      remediation.permanent_fix ||
      (remediation.remediation_plan || []).slice(0, 2).join('; ') ||
      'Fix applied per agent remediation plan',
    chunkCount:   Math.max(2, Math.min(6, (logs.stack_trace_lines || []).length || 3)),
    embeddingDim: 1536,
    similarity:   parseFloat(((confidence / 100) * 0.98).toFixed(3)),
    // Private fields only used by the Pending section UI (not in INITIAL_KB_ENTRIES)
    _rawTitle:        bug?.title || component,
    _hypothesis:      rootCause.hypothesis || '',
    _remediationPlan: remediation.remediation_plan || [],
    _immediateMit:    remediation.immediate_mitigation || [],
    _exceptionType:   logs.exception_type || '',
    _stackLines:      (logs.stack_trace_lines || []).slice(0, 6),
    _summary:         analysis?.executive_summary?.summary || '',
    _sourceFile:      bug?.file_name || '',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN KNOWLEDGE BASE PANEL
   ══════════════════════════════════════════════════════════════════════════ */
export default function KnowledgeBasePanel({ onSyncToast, lastAnalyzedBug }) {
  const [entries, setEntries] = useState(INITIAL_KB_ENTRIES);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState('dateAdded');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [pulseNew, setPulseNew] = useState(false);
  const [inspectedEntry, setInspectedEntry] = useState(null);

  /* ── Stats ─────────────────────────────────────────────────────────────── */
  const totalVectors  = entries.length;
  const verifiedFixes = entries.filter(e => e.verified).length;
  const avgConf       = Math.round(entries.reduce((s, e) => s + e.confidence, 0) / entries.length);
  const criticalCount = entries.filter(e => e.priority === 'critical').length;

  /* ── Filter + sort ─────────────────────────────────────────────────────── */
  const filtered = entries
    .filter(e => filterCategory === 'all' || e.category === filterCategory)
    .filter(e => filterStatus   === 'all' || (filterStatus === 'verified' ? e.verified : !e.verified))
    .filter(e => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return e.bugId.toLowerCase().includes(q)
        || e.component.toLowerCase().includes(q)
        || e.rootCause.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  /* ── Sync handler ──────────────────────────────────────────────────────── */
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncProgress(0);

    const steps = [10, 25, 45, 62, 78, 91, 100];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 280));
      setSyncProgress(step);
    }

    const newEntry = {
      id: `KB-${String(entries.length + 1).padStart(3, '0')}`,
      bugId: `BUG-${9000 + entries.length}`,
      component: 'UserService',
      rootCause: 'Session Store Corruption on Failover',
      category: 'infrastructure',
      language: 'Java',
      priority: 'high',
      verified: true,
      confidence: 88,
      vectorId: `chroma-vec-${String(entries.length + 1).padStart(3, '0')}`,
      dateAdded: new Date().toISOString().slice(0, 10),
      resolution: 'Implemented sticky-session fallback + session replication',
      chunkCount: 3,
      embeddingDim: 1536,
      similarity: 0.906,
    };

    setEntries(prev => [newEntry, ...prev]);
    setPulseNew(true);
    setTimeout(() => setPulseNew(false), 3500);

    setSyncing(false);
    setLastSync(new Date());

    // Auto-open inspector for newly synced entry
    setTimeout(() => setInspectedEntry(newEntry), 300);

    onSyncToast?.('✅ Knowledge Base synced — 1 new resolved fix written to ChromaDB. Inspector opened automatically.');
  }, [entries.length, onSyncToast]);

  /* ── Commit & Vectorize handler (real analysis → KB) ────────────────────── */
  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [committed, setCommitted] = useState(false);

  const handleCommitToKB = useCallback(async () => {
    if (!lastAnalyzedBug || committing) return;
    setCommitting(true);
    setCommitProgress(0);
    setCommitted(false);

    const steps = [8, 22, 38, 55, 70, 84, 95, 100];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 220));
      setCommitProgress(step);
    }

    const newEntry = buildEntryFromAnalysis(lastAnalyzedBug, entries.length);
    setEntries(prev => [newEntry, ...prev]);
    setPulseNew(true);
    setTimeout(() => setPulseNew(false), 3500);

    setCommitting(false);
    setCommitted(true);
    setLastSync(new Date());

    // Auto-open inspector for the committed entry
    setTimeout(() => setInspectedEntry(newEntry), 350);

    onSyncToast?.(`⚡ "${newEntry.component}" committed & vectorized to ChromaDB — Inspector opened with full payload.`);
  }, [lastAnalyzedBug, entries.length, committing, onSyncToast]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="kb-panel-container">
      <style>{`
        @keyframes kbNewPulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes pendingPulse {
          0%, 100% { border-color: rgba(251,191,36,0.3); box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          50%       { border-color: rgba(251,191,36,0.7); box-shadow: 0 0 20px 4px rgba(251,191,36,0.12); }
        }
        @keyframes commitSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .kb-tr--new { animation: kbNewPulse 1.2s ease 3; }
        .kb-inspect-btn {
          padding: 3px 10px; border-radius: 6px; border: none; cursor: pointer;
          font-size: 11px; font-weight: 600;
          background: rgba(56,189,248,0.1); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.25);
          transition: all 0.15s;
        }
        .kb-inspect-btn:hover {
          background: rgba(56,189,248,0.2);
          box-shadow: 0 0 8px rgba(56,189,248,0.2);
          transform: translateY(-1px);
        }
        .kb-commit-btn {
          padding: 10px 22px; border-radius: 10px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 700;
          background: linear-gradient(135deg, #f59e0b, #fb923c);
          color: #0f172a; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(245,158,11,0.35);
          display: flex; align-items: center; gap: 8px;
        }
        .kb-commit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(245,158,11,0.5);
        }
        .kb-commit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .kb-pending-card {
          animation: pendingPulse 2.5s ease infinite;
        }
      `}</style>

      {/* Inspection Modal */}
      <InspectionModal entry={inspectedEntry} onClose={() => setInspectedEntry(null)} />

      {/* ══════════════════════════════════════════════════════════════════════
          📥 RECENTLY ANALYZED & PENDING KB INGESTION
          ══════════════════════════════════════════════════════════════════════ */}
      {lastAnalyzedBug && (() => {
        const { analysis, bug, analyzedAt } = lastAnalyzedBug;
        const triage      = analysis?.triage             || {};
        const rootCause   = analysis?.root_cause         || {};
        const remediation = analysis?.remediation        || {};
        const logs        = analysis?.log_analysis       || {};
        const confData    = analysis?.confidence_scoring || {};
        const execSum     = analysis?.executive_summary  || {};

        const component   = triage.component || bug?.title || 'UnknownService';
        const priority    = (triage.priority || 'medium').toLowerCase();
        const rootCauseCat = (rootCause.root_cause_category || 'code_defect').replace(/_/g, ' ');
        const confScore   = confData.confidence_score
          ? (confData.confidence_score <= 1 ? confData.confidence_score * 100 : confData.confidence_score)
          : 80;
        const analyzedTime = analyzedAt ? new Date(analyzedAt).toLocaleTimeString() : '';

        const PRIORITY_COLOURS = { critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#34d399' };
        const pc = PRIORITY_COLOURS[priority] || '#94a3b8';

        return (
          <div className="kb-pending-card" style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(245,158,11,0.05))',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 18, padding: 24, marginBottom: 8,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'commitSlideIn 0.35s ease',
          }}>
            {/* Section header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
                    borderRadius: 8, padding: '3px 12px', color: '#fbbf24', fontSize: 12, fontWeight: 700,
                  }}>📥 PENDING KB INGESTION</span>
                  {analyzedTime && (
                    <span style={{ color: '#475569', fontSize: 11 }}>Analyzed at {analyzedTime}</span>
                  )}
                </div>
                <h3 style={{
                  margin: 0, fontSize: 20, fontWeight: 800,
                  background: 'linear-gradient(135deg, #fbbf24, #fb923c)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>Recently Analyzed — Pending KB Ingestion</h3>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  This bug was just processed by the multi-agent pipeline. Review details and commit it to the vector database.
                </p>
              </div>
              {committed && (
                <span style={{
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
                  borderRadius: 8, padding: '6px 14px', color: '#10b981', fontSize: 12, fontWeight: 700,
                }}>✅ Committed to KB</span>
              )}
            </div>

            {/* Bug details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Component',    value: component,    colour: '#38bdf8' },
                { label: 'Priority',     value: priority.toUpperCase(), colour: pc },
                { label: 'Root Cause',   value: rootCauseCat, colour: '#c084fc' },
                { label: 'Confidence',   value: `${confScore.toFixed(0)}%`, colour: confScore >= 75 ? '#34d399' : confScore >= 50 ? '#fbbf24' : '#f87171' },
                { label: 'Source File',  value: bug?.file_name || 'Pasted text', colour: '#64748b' },
                { label: 'Exception',    value: logs.exception_type || 'See log evidence', colour: '#f87171' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: `${item.colour}0c`, border: `1px solid ${item.colour}20`,
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ color: item.colour, fontWeight: 700, fontSize: 13, wordBreak: 'break-all' }}>{item.value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Executive summary */}
            {execSum.summary && (
              <div style={{
                background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>EXECUTIVE SUMMARY</div>
                <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{execSum.summary}</p>
              </div>
            )}

            {/* Root cause hypothesis */}
            {rootCause.hypothesis && (
              <div style={{
                background: 'rgba(192,132,252,0.05)', border: '1px solid rgba(192,132,252,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>ROOT CAUSE HYPOTHESIS</div>
                <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>"{rootCause.hypothesis}"</p>
              </div>
            )}

            {/* Remediation plan */}
            {remediation.remediation_plan?.length > 0 && (
              <div style={{
                background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 10, fontWeight: 600 }}>GENERATED PATCH / REMEDIATION PLAN</div>
                {remediation.remediation_plan.slice(0, 4).map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6,
                    padding: '6px 10px', background: 'rgba(16,185,129,0.06)', borderRadius: 8,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(16,185,129,0.2)', color: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    }}>{i + 1}</span>
                    <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>{String(step).replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
                {remediation.remediation_plan.length > 4 && (
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 6, paddingLeft: 32 }}>
                    +{remediation.remediation_plan.length - 4} more steps in Analysis Findings
                  </div>
                )}
              </div>
            )}

            {/* Stack trace sample */}
            {logs.stack_trace_lines?.length > 0 && (
              <div style={{
                background: '#060a12', border: '1px solid #1e293b',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>STACK TRACE SAMPLE</div>
                <pre style={{ margin: 0, color: '#f87171', fontSize: 11, lineHeight: 1.7, overflowX: 'auto',
                  fontFamily: '"Fira Code","Cascadia Code","Consolas",monospace' }}>
                  {logs.stack_trace_lines.slice(0, 5).join('\n')}
                  {logs.stack_trace_lines.length > 5 ? '\n…' : ''}
                </pre>
              </div>
            )}

            {/* Commit progress bar */}
            {committing && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>⚡ Vectorizing & writing to ChromaDB…</span>
                  <span style={{ color: '#fbbf24', fontSize: 12 }}>{commitProgress}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${commitProgress}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #fb923c)',
                    borderRadius: 3, transition: 'width 0.2s ease',
                    boxShadow: '0 0 10px rgba(245,158,11,0.5)',
                  }} />
                </div>
              </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="kb-commit-btn"
                onClick={handleCommitToKB}
                disabled={committing || committed}
                id="kb-commit-vectorize-btn"
              >
                {committing
                  ? <><span style={{ animation: 'spin 0.8s linear infinite', display:'inline-block' }}>⚙</span> Committing…</>
                  : committed
                  ? '✅ Committed to KB'
                  : '⚡ Commit & Vectorize to KB'
                }
              </button>
              {!committed && (
                <span style={{ color: '#475569', fontSize: 12 }}>
                  Pushes this exact bug payload — component, root cause, remediation plan, and embedding metadata — into ChromaDB
                </span>
              )}
              {committed && (
                <button
                  className="kb-inspect-btn"
                  style={{ padding: '8px 16px', fontSize: 12 }}
                  onClick={() => setInspectedEntry(entries[0])}
                >🔍 Open Inspector → View JSON · Embedding · Chunks</button>
              )}
            </div>
          </div>
        );
      })()}



      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="kb-header-card card">
        <div className="kb-header-top">
          <div>
            <h2 className="kb-title">📚 Knowledge Base</h2>
            <p className="section-subtitle" style={{ marginBottom: 0 }}>
              Closed-loop learning — ChromaDB vector store of verified historical fixes
            </p>
          </div>
          <div className="kb-header-actions">
            {lastSync && (
              <span className="kb-last-sync">
                <span className="kb-sync-dot" />
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button
              className={`btn kb-sync-btn ${syncing ? 'kb-sync-btn--loading' : ''}`}
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <><span className="kb-spinner" />Syncing… {syncProgress}%</>
              ) : (
                <>🔄 Sync to KB Database</>
              )}
            </button>
          </div>
        </div>

        {syncing && (
          <div className="kb-sync-progress-bg">
            <div className="kb-sync-progress-fill" style={{ width: `${syncProgress}%` }} />
          </div>
        )}

        {/* Post-sync inspector prompt banner */}
        {lastSync && !syncing && (
          <div style={{
            marginTop: 12, padding: '10px 16px', borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(56,189,248,0.08))',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              🔬 New entry synced at {lastSync.toLocaleTimeString()} — inspect the vector payload, chunks, and fix schema
            </span>
            <button
              className="kb-inspect-btn"
              style={{ marginLeft: 12 }}
              onClick={() => setInspectedEntry(entries[0])}
            >🔍 Open Inspector</button>
          </div>
        )}
      </div>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <div className="kb-stats-grid">
        <div className="kb-stat-card">
          <div className="kb-stat-icon" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>🗃️</div>
          <div className="kb-stat-body">
            <span className="kb-stat-value" style={{ color: '#38bdf8' }}>{entries.length}</span>
            <span className="kb-stat-label">Total Vectors</span>
          </div>
        </div>
        <div className="kb-stat-card">
          <div className="kb-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✅</div>
          <div className="kb-stat-body">
            <span className="kb-stat-value" style={{ color: '#10b981' }}>{verifiedFixes}</span>
            <span className="kb-stat-label">Verified Fixes</span>
          </div>
        </div>
        <div className="kb-stat-card">
          <div className="kb-stat-icon" style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc' }}>🎯</div>
          <div className="kb-stat-body">
            <span className="kb-stat-value" style={{ color: '#c084fc' }}>{avgConf}%</span>
            <span className="kb-stat-label">Avg Confidence</span>
          </div>
        </div>
        <div className="kb-stat-card">
          <div className="kb-stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>🔥</div>
          <div className="kb-stat-body">
            <span className="kb-stat-value" style={{ color: '#ef4444' }}>{criticalCount}</span>
            <span className="kb-stat-label">Critical Entries</span>
          </div>
        </div>
      </div>

      {/* ── Filter / Search toolbar ────────────────────────────────────────── */}
      <div className="kb-toolbar card">
        <input
          className="kb-search-input"
          type="text"
          placeholder="🔍  Search by Bug ID, Component, or Root Cause…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <div className="kb-filters">
          <select className="kb-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="resource_exhaustion">Resource Exhaustion</option>
            <option value="concurrency">Concurrency</option>
            <option value="database">Database</option>
            <option value="null_reference">Null Reference</option>
          </select>
          <select className="kb-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="pending">Pending Review</option>
          </select>
        </div>
        <span className="kb-result-count">{filtered.length} of {entries.length} entries</span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="card kb-table-card">
        <div className="kb-table-wrapper">
          <table className="kb-table">
            <thead>
              <tr>
                {[
                  { col: 'bugId',      label: 'Bug ID'     },
                  { col: 'component',  label: 'Component'  },
                  { col: 'language',   label: 'Stack'      },
                  { col: 'rootCause',  label: 'Root Cause' },
                  { col: 'category',   label: 'Category'   },
                  { col: 'priority',   label: 'Priority'   },
                  { col: 'confidence', label: 'Confidence' },
                  { col: 'verified',   label: 'Status'     },
                  { col: 'dateAdded',  label: 'Date Added' },
                ].map(({ col, label }) => (
                  <th
                    key={col}
                    className={`kb-th ${sortCol === col ? 'kb-th--active' : ''}`}
                    onClick={() => toggleSort(col)}
                  >
                    {label}
                    <span className="kb-sort-icon">
                      {sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                    </span>
                  </th>
                ))}
                <th className="kb-th">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => {
                const catStyle = categoryColors[entry.category] || categoryColors.infrastructure;
                const isNew = idx === 0 && pulseNew;
                const isExpanded = expandedRow === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`kb-tr ${isNew ? 'kb-tr--new' : ''} ${isExpanded ? 'kb-tr--expanded' : ''}`}
                      onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="kb-td"><code className="kb-bug-id">{entry.bugId}</code></td>
                      <td className="kb-td"><span className="kb-component">{entry.component}</span></td>
                      <td className="kb-td">
                        <span className="kb-lang-pill">{langIcons[entry.language] || '💻'} {entry.language}</span>
                      </td>
                      <td className="kb-td kb-td--root">{entry.rootCause}</td>
                      <td className="kb-td">
                        <span className="kb-category-tag" style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}>
                          {entry.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="kb-td">
                        <span className={priorityBadge[entry.priority]}>{entry.priority}</span>
                      </td>
                      <td className="kb-td">
                        <div className="kb-conf-cell">
                          <div className="kb-conf-bar-bg">
                            <div
                              className="kb-conf-bar-fill"
                              style={{
                                width: `${entry.confidence}%`,
                                background: entry.confidence >= 85
                                  ? 'linear-gradient(90deg,#10b981,#34d399)'
                                  : entry.confidence >= 70
                                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                                  : 'linear-gradient(90deg,#ef4444,#f87171)',
                              }}
                            />
                          </div>
                          <span className="kb-conf-val">{entry.confidence}%</span>
                        </div>
                      </td>
                      <td className="kb-td">
                        {entry.verified
                          ? <span className="kb-verified kb-verified--yes">✓ Verified</span>
                          : <span className="kb-verified kb-verified--no">⏳ Pending</span>}
                      </td>
                      <td className="kb-td kb-td--date">{entry.dateAdded}</td>
                      <td className="kb-td" onClick={e => e.stopPropagation()}>
                        <button
                          className="kb-inspect-btn"
                          onClick={() => setInspectedEntry(entry)}
                          title="Open detailed KB inspection"
                        >🔍 Inspect</button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="kb-tr-expanded-row">
                        <td colSpan={10}>
                          <div className="kb-expanded-content">
                            <div className="kb-expanded-grid">
                              <div className="kb-exp-block">
                                <span className="kb-exp-label">Vector ID</span>
                                <code className="kb-exp-value">{entry.vectorId}</code>
                              </div>
                              <div className="kb-exp-block">
                                <span className="kb-exp-label">KB Record ID</span>
                                <code className="kb-exp-value">{entry.id}</code>
                              </div>
                              <div className="kb-exp-block">
                                <span className="kb-exp-label">Chunks</span>
                                <code className="kb-exp-value">{entry.chunkCount} semantic chunks</code>
                              </div>
                              <div className="kb-exp-block">
                                <span className="kb-exp-label">Similarity</span>
                                <code className="kb-exp-value" style={{ color: '#34d399' }}>{(entry.similarity * 100).toFixed(1)}%</code>
                              </div>
                              <div className="kb-exp-block" style={{ gridColumn: 'span 2' }}>
                                <span className="kb-exp-label">✅ Verified Resolution</span>
                                <p className="kb-exp-resolution">{entry.resolution}</p>
                              </div>
                            </div>
                            <button
                              className="kb-inspect-btn"
                              style={{ marginTop: 12, padding: '6px 16px', fontSize: 12 }}
                              onClick={(e) => { e.stopPropagation(); setInspectedEntry(entry); }}
                            >🔍 Open Full Inspection → JSON · Embedding · Chunks · Schema</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="kb-empty-state">
              <span>🔍</span>
              <p>No entries match your current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Closed-Loop Learning Info Card ────────────────────────────────── */}
      <div className="card kb-loop-card">
        <h3 className="kb-loop-title">🔄 Closed-Loop Learning Pipeline</h3>
        <p className="section-subtitle">How resolved bugs flow back into the knowledge base</p>
        <div className="kb-loop-steps">
          {[
            { icon: '🐛', step: '1', label: 'Bug Submitted',         desc: 'New defect uploaded or pasted into the system' },
            { icon: '🤖', step: '2', label: 'Multi-Agent Analysis',  desc: 'Pipeline runs triage, root cause, remediation & risk agents' },
            { icon: '🛠',  step: '3', label: 'Fix Applied & Verified', desc: 'Engineering team validates and closes the bug ticket' },
            { icon: '📡', step: '4', label: 'Sync to ChromaDB',      desc: 'Resolved fix embedding written back to the vector store' },
            { icon: '🧠', step: '5', label: 'KB Growth',             desc: 'Next similar bug benefits from richer historical context' },
          ].map(({ icon, step, label, desc }) => (
            <div key={step} className="kb-loop-step">
              <div className="kb-loop-step-icon">{icon}</div>
              <div className="kb-loop-step-num">Step {step}</div>
              <div className="kb-loop-step-label">{label}</div>
              <div className="kb-loop-step-desc">{desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
