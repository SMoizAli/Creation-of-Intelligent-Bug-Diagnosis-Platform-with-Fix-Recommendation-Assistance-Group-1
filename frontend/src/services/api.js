const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function request(path, options = {}) {
  // If sending FormData, do not set Content-Type header so the browser handles multipart boundaries
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }
  return data;
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
    headers: { 'Content-Type': 'application/json' },
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