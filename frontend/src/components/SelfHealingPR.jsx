import React, { useState, useRef, useEffect } from 'react';

/* ── Mock Patch Diff ─────────────────────────────────────── */
const MOCK_PATCH = {
  branch: 'hotfix/processor-null-guard-8f3a2b',
  pr_title: 'fix(processor): add null guard in _handle_gateway() to prevent AttributeError',
  pr_url: 'https://github.com/org/repo/pull/4821',
  commit_sha: '8f3a2b1c',
  diff: `--- a/backend/processor.py
+++ b/backend/processor.py
@@ -244,10 +244,17 @@ class PaymentProcessor:
 
     def _handle_gateway(self, payload: dict) -> dict:
-        """Process payment through gateway."""
-        gateway = self._resolve_gateway(payload)
-        return gateway.process(payload)
+        """Process payment through gateway with null safety guard."""
+        gateway = self._resolve_gateway(payload)
+
+        # [HOTFIX 8f3a2b] — Guard against NoneType gateway resolution
+        # Root cause: _resolve_gateway() can return None when provider
+        # config is missing or provider key is not in GATEWAY_MAP.
+        if gateway is None:
+            logger.error(
+                "Gateway resolution returned None for provider: %s",
+                payload.get("provider", "unknown")
+            )
+            raise GatewayResolutionError(
+                f"No gateway registered for provider '{payload.get('provider')}'. "
+                "Check GATEWAY_MAP configuration."
+            )
+
+        return gateway.process(payload)
 
 @@ -261,6 +268,12 @@ class PaymentProcessor:
  
     def _resolve_gateway(self, payload: dict):
         provider = payload.get('provider')
-        return GATEWAY_MAP.get(provider)
+        gateway = GATEWAY_MAP.get(provider)
+        if gateway is None:
+            logger.warning("Provider '%s' not found in GATEWAY_MAP", provider)
+        return gateway`,
};

/* ── Syntax highlighted diff renderer ────────────────────── */
function DiffRenderer({ diff }) {
  return (
    <div className="diff-viewer">
      {diff.split('\n').map((line, idx) => {
        let cls = 'diff-line';
        if (line.startsWith('+++') || line.startsWith('---')) cls += ' diff-file';
        else if (line.startsWith('+')) cls += ' diff-add';
        else if (line.startsWith('-')) cls += ' diff-remove';
        else if (line.startsWith('@@')) cls += ' diff-hunk';
        else if (line.startsWith('#')) cls += ' diff-comment';

        return (
          <div key={idx} className={cls}>
            <span className="diff-gutter">
              {line.startsWith('+') && !line.startsWith('+++') ? '+' :
               line.startsWith('-') && !line.startsWith('---') ? '-' : ' '}
            </span>
            <code className="diff-code">{line}</code>
          </div>
        );
      })}
    </div>
  );
}

/* ── Animated type-writer for PR creation ─────────────────── */
function TypewriterText({ text, speed = 28 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const t = setInterval(() => {
      if (i < text.length) {
        setDisplayed(prev => prev + text[i]);
        i++;
      } else {
        clearInterval(t);
      }
    }, speed);
    return () => clearInterval(t);
  }, [text]);
  return <span>{displayed}</span>;
}

/* ── Generation Steps Component ──────────────────────────── */
function PRGenerationSteps({ currentStep }) {
  const steps = [
    { label: 'Analyzing remediation plan & patch requirements', done: currentStep > 0 },
    { label: 'Generating code patch diff with LLM', done: currentStep > 1 },
    { label: 'Creating feature branch: hotfix/processor-null-guard-8f3a2b', done: currentStep > 2 },
    { label: 'Committing patch to branch (SHA: 8f3a2b1c)', done: currentStep > 3 },
    { label: 'Opening Pull Request with full context', done: currentStep > 4 },
  ];

  return (
    <div className="pr-gen-steps">
      {steps.map((step, idx) => (
        <div key={idx} className={`pr-gen-step ${step.done ? 'done' : idx === currentStep ? 'active' : 'pending'}`}>
          <span className="pr-step-icon">
            {step.done ? '✓' : idx === currentStep ? <span className="mini-spin">◌</span> : '○'}
          </span>
          <span className="pr-step-text">{step.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/* Main Component                                            */
/* ══════════════════════════════════════════════════════════ */
export default function SelfHealingPRGenerator({ analysis }) {
  const [prState, setPrState] = useState('idle'); // idle | generating | preview | success
  const [genStep, setGenStep] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const handleGenerateHotfix = async () => {
    setPrState('generating');
    setGenStep(0);
    setShowModal(true);

    // Simulate generation steps
    const steps = [0, 1, 2, 3, 4];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 900));
      setGenStep(step + 1);
    }
    await new Promise(r => setTimeout(r, 500));
    setPrState('preview');
  };

  const handleOpenPR = () => {
    setPrState('success');
  };

  const handleClose = () => {
    setShowModal(false);
    setTimeout(() => {
      if (prState !== 'success') setPrState('idle');
    }, 300);
  };

  return (
    <>
      {/* Action Card */}
      <div className="self-heal-card">
        <div className="shc-left">
          <div className="shc-icon-wrap">
            <span className="shc-icon">🔧</span>
          </div>
          <div>
            <h4 className="shc-title">AI Self-Healing Hotfix Generator</h4>
            <p className="shc-desc">
              Automatically generate a production-grade patch diff, create a GitHub branch,
              and open a documented Pull Request — powered by your remediation analysis.
            </p>
            <div className="shc-tags">
              <span className="shc-tag">GPT-4o Patch Generation</span>
              <span className="shc-tag">GitHub API</span>
              <span className="shc-tag">Auto PR</span>
            </div>
          </div>
        </div>
        <button
          className="btn-generate-hotfix"
          onClick={handleGenerateHotfix}
          disabled={prState === 'generating'}
          id="generate-hotfix-btn"
        >
          {prState === 'generating' ? (
            <><span className="btn-spin">◌</span> Generating…</>
          ) : prState === 'success' ? (
            <><span>✓</span> PR Opened</>
          ) : (
            <><span>⚡</span> Generate Hotfix & Open GitHub PR</>
          )}
        </button>
      </div>

      {/* Success bar after PR created */}
      {prState === 'success' && (
        <div className="pr-success-bar">
          <span className="pr-success-icon">✓</span>
          <div>
            <strong>Pull Request Successfully Opened!</strong>
            <p>
              Branch: <code>{MOCK_PATCH.branch}</code> •&nbsp;
              <a href={MOCK_PATCH.pr_url} target="_blank" rel="noopener noreferrer" className="pr-link">
                View PR #{MOCK_PATCH.pr_url.split('/').pop()} on GitHub ↗
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {showModal && (
        <div className="pr-modal-overlay" onClick={handleClose}>
          <div className="pr-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <div className="pr-modal-title-group">
                <span className="pr-modal-emoji">🚀</span>
                <div>
                  <h3>Hotfix PR Generator</h3>
                  <p className="pr-modal-subtitle">AI-powered patch generation & GitHub integration</p>
                </div>
              </div>
              <button className="pr-modal-close" onClick={handleClose}>✕</button>
            </div>

            {/* Generation phase */}
            {prState === 'generating' && (
              <div className="pr-modal-body">
                <div className="pr-generating-header">
                  <div className="pr-gen-spinner" />
                  <span>Generating Hotfix Patch…</span>
                </div>
                <PRGenerationSteps currentStep={genStep} />
              </div>
            )}

            {/* Preview phase */}
            {prState === 'preview' && (
              <div className="pr-modal-body">
                {/* PR Metadata */}
                <div className="pr-meta-card">
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">📌 PR Title</span>
                    <span className="pr-meta-val pr-title-text">
                      <TypewriterText text={MOCK_PATCH.pr_title} speed={22} />
                    </span>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">🌿 Branch</span>
                    <code className="pr-branch-code">{MOCK_PATCH.branch}</code>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">📦 Commit SHA</span>
                    <code className="pr-commit-code">{MOCK_PATCH.commit_sha}</code>
                  </div>
                </div>

                {/* Diff Viewer */}
                <div className="pr-diff-section">
                  <div className="pr-diff-header">
                    <span>📄 Auto-Generated Patch Diff</span>
                    <div className="pr-diff-stats">
                      <span className="diff-stat-add">+28 additions</span>
                      <span className="diff-stat-remove">-3 deletions</span>
                    </div>
                  </div>
                  <DiffRenderer diff={MOCK_PATCH.diff} />
                </div>

                {/* Actions */}
                <div className="pr-modal-actions">
                  <button className="btn-secondary" onClick={handleClose}>Cancel</button>
                  <button className="btn-open-pr" onClick={handleOpenPR} id="open-pr-btn">
                    <span>🐙</span> Approve & Open Pull Request
                  </button>
                </div>
              </div>
            )}

            {/* Success phase inside modal */}
            {prState === 'success' && (
              <div className="pr-modal-body pr-success-body">
                <div className="pr-success-animation">
                  <div className="pr-success-circle">✓</div>
                </div>
                <h3 className="pr-success-title">Pull Request Created!</h3>
                <p className="pr-success-msg">Your hotfix branch has been pushed and a PR opened for review.</p>
                <div className="pr-success-details">
                  <div className="pr-sd-row">
                    <span>Branch</span>
                    <code>{MOCK_PATCH.branch}</code>
                  </div>
                  <div className="pr-sd-row">
                    <span>Pull Request</span>
                    <a href={MOCK_PATCH.pr_url} target="_blank" rel="noopener noreferrer" className="pr-link">
                      github.com/org/repo/pull/4821 ↗
                    </a>
                  </div>
                  <div className="pr-sd-row">
                    <span>Commit</span>
                    <code>{MOCK_PATCH.commit_sha}</code>
                  </div>
                  <div className="pr-sd-row">
                    <span>Status</span>
                    <span className="pr-open-badge">● OPEN</span>
                  </div>
                </div>
                <button className="btn-generate-hotfix" onClick={handleClose} style={{ marginTop: '1.5rem' }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
