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

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  
  const headers = { ...(options.headers || {}) };
  if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  } else if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.detail || `Request failed with status ${response.status}`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      console.warn(`[ASBA Network Warning] Failed to reach backend at ${url}.`, err);
      throw new Error(`Unable to reach backend server. If Render is waking up from sleep, please retry in a few seconds.`);
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

export async function submitBug({ content, title, file }) {
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