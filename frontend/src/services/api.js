const PROD_BACKEND_URL = 'https://creation-of-intelligent-bug-diagnosis-gwei.onrender.com';

function resolveApiBase() {
  const envBase = (import.meta.env.VITE_API_BASE || '').trim();
  if (envBase) {
    let clean = envBase.replace(/\/+$/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      if (!clean.endsWith('/api/v1')) {
        if (clean.endsWith('/api')) {
          return `${clean}/v1`;
        }
        return `${clean}/api/v1`;
      }
      return clean;
    }
    if (!clean.startsWith('/')) clean = `/${clean}`;
    return clean;
  }
  // If no env variable is set:
  // In production (Vercel), point directly to Render backend API
  // In local dev, use relative /api/v1 which is proxied by Vite
  return import.meta.env.PROD ? `${PROD_BACKEND_URL}/api/v1` : '/api/v1';
}

export const API_BASE = resolveApiBase();

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}, retries = 2, backoff = 1000) {
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const hasBody = options.body !== undefined && options.body !== null;
  
  const headers = { ...(options.headers || {}) };

  // Only attach Content-Type when there is an actual JSON body to prevent unwanted CORS preflight & 400s
  if (hasBody && !isFormData) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  } else {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${endpoint}`;

  // Use timeout of 20s for general calls, 90s for analysis/upload
  const timeoutMs = options.timeout || (endpoint.includes('/analyze') || isFormData ? 90000 : 20000);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller ? controller.signal : undefined,
    });

    if (timeoutId) clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // If server returned 502/503/504 (cold start), retry
      if ([502, 503, 504].includes(response.status) && retries > 0) {
        await wait(backoff);
        return request(path, options, retries - 1, backoff * 2);
      }
      throw new Error(data.message || data.detail || `Request failed with status ${response.status}`);
    }
    return data;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);

    const isNetworkErr = err.name === 'TypeError' || err.name === 'AbortError' || err.message?.includes('fetch');
    if (isNetworkErr && retries > 0) {
      await wait(backoff);
      return request(path, options, retries - 1, backoff * 2);
    }

    if (isNetworkErr) {
      console.warn(`[ASBA Network] Connection to ${url} unavailable.`, err.message);
      throw new Error(`Unable to connect to backend server. If Render is waking from sleep, please try again in a few moments.`);
    }
    throw err;
  }
}

export async function getHealth() {
  return request('/health');
}

export async function getStatus() {
  return request('/status');
}

export async function submitBug({ content, title, file, file_name }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (content) {
    formData.append('content', content);
  }
  if (title) {
    formData.append('title', title);
  }
  if (file_name) {
    formData.append('file_name', file_name);
  }
  return request('/submit-bug', { method: 'POST', body: formData });
}

export async function analyzeBug(bugId) {
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({ bug_id: bugId, use_mmr: true }),
  });
}

export async function getHistory() {
  return request('/history');
}

export async function getSettings() {
  return request('/settings');
}

export async function getAnalysis(analysisId) {
  return request(`/analysis/${analysisId}`);
}

export async function getBug(bugId) {
  return request(`/bug/${bugId}`);
}

export async function getDefectPatterns() {
  return request('/analytics/defect-patterns');
}