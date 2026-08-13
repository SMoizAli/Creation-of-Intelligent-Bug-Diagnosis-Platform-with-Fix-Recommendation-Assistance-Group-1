/**
 * useUnifiedBugIngestion.js
 * ─────────────────────────────────────────────────────────────
 * Single entry point for ALL bug input modalities:
 *   • File upload  (PDF / .log / .txt)
 *   • Text paste
 *   • Chat prompt  (RAG drawer typed query)
 *   • Voice transcription (Web Speech API mic)
 *
 * Every path calls the same: submitBug → analyzeBug pipeline.
 * Callers receive live stage callbacks and the final analysis
 * object to update their own state.
 * ─────────────────────────────────────────────────────────────
 */

import { useCallback, useRef } from 'react';
import { submitBug, analyzeBug } from '../services/api';

// Pipeline stage labels (matches the timeline in App.jsx)
const PIPELINE_STAGES = [
  'Extracting content…',
  'Normalising data…',
  'Generating embeddings…',
  'Retrieving historical context…',
  'Triage Agent processing…',
  'Log Parser Agent scanning…',
  'Duplicate Detection matching…',
  'Root Cause Agent calculating…',
  'Remediation Agent advising…',
  'Risk Assessment grading…',
  'Confidence scoring…',
  'Executive Summary compiling…',
  'Finalising report…',
];

/**
 * Derive a human-readable title from raw input text or file name.
 * Looks for common error signatures like "Error:", "Exception:" etc.
 */
function extractTitle(content = '', fileName = '') {
  if (fileName) return fileName;
  const errorMatch = content.match(/((?:\w+Error|\w+Exception)[^\n]*)/);
  if (errorMatch) return errorMatch[1].slice(0, 120);
  const firstLine = content.split('\n').find(l => l.trim().length > 10);
  return (firstLine || 'Bug Query').slice(0, 120);
}

/**
 * @param {object} callbacks
 * @param {function} callbacks.onStageChange   (stageIndex, stageLabel) → void
 * @param {function} callbacks.onComplete      (analysis)               → void
 * @param {function} callbacks.onError         (errorMessage)           → void
 * @param {function} callbacks.onSubmitSuccess (bug)                    → void
 */
export function useUnifiedBugIngestion({
  onStageChange,
  onComplete,
  onError,
  onSubmitSuccess,
} = {}) {
  const intervalRef = useRef(null);

  /** Tick through the stage labels visually while the real API runs */
  const _startStageTicker = useCallback(() => {
    let idx = 0;
    onStageChange?.(0, PIPELINE_STAGES[0]);
    intervalRef.current = setInterval(() => {
      if (idx < PIPELINE_STAGES.length - 1) {
        idx++;
        onStageChange?.(idx, PIPELINE_STAGES[idx]);
      } else {
        clearInterval(intervalRef.current);
      }
    }, 420);
  }, [onStageChange]);

  const _stopStageTicker = useCallback(() => {
    clearInterval(intervalRef.current);
  }, []);

  /**
   * PRIMARY METHOD — call this from any input source.
   *
   * @param {object} inputData
   * @param {string}   [inputData.content]   — raw text / transcript
   * @param {File}     [inputData.file]       — File object (upload)
   * @param {string}   [inputData.title]      — optional override title
   * @param {string}   [inputData.source]     — 'file' | 'text' | 'chat' | 'voice'
   */
  const handleUnifiedBugSubmission = useCallback(async (inputData = {}) => {
    const { content = '', file = null, source = 'text' } = inputData;

    // Validate — at least one of content or file is required
    if (!content.trim() && !file) {
      onError?.('No content provided. Please paste text, upload a file, or use the microphone.');
      return;
    }

    const title = inputData.title || extractTitle(content, file?.name);

    try {
      // ── Step 1: Submit bug for parsing ─────────────────────
      const submitResult = await submitBug({ content: content || undefined, file: file || undefined, title });
      const bug = submitResult?.bug;

      if (!bug?.id) {
        throw new Error('Server did not return a valid bug ID. Check backend connectivity.');
      }

      onSubmitSuccess?.(bug, source);

      // ── Step 2: Start visual stage ticker ─────────────────
      _startStageTicker();

      // ── Step 3: Run multi-agent analysis ──────────────────
      const analyzeResult = await analyzeBug(bug.id);
      _stopStageTicker();

      const analysis = analyzeResult?.analysis;
      if (!analysis) {
        throw new Error('Analysis pipeline returned empty results.');
      }

      // Tag the analysis with the source modality for UI differentiation
      analysis._source = source;
      analysis._inputPreview = content.slice(0, 300) || file?.name || '';

      onComplete?.(analysis, PIPELINE_STAGES.length, bug);
      return { bug, analysis };

    } catch (err) {
      _stopStageTicker();
      const msg = err.message || 'Unified ingestion pipeline failed.';
      onError?.(msg);
      throw err; // let callers handle as needed
    }
  }, [_startStageTicker, _stopStageTicker, onSubmitSuccess, onComplete, onError]);

  return { handleUnifiedBugSubmission, PIPELINE_STAGES };
}
