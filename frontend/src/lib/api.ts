const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response;
}

export async function apiGet<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
  const response = await apiRequest(endpoint, { method: 'GET', headers });
  return response.json();
}

export async function apiPost<T>(
  endpoint: string,
  data?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    headers,
  });
  return response.json();
}

export async function apiPatch<T>(
  endpoint: string,
  data?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
    headers,
  });
  return response.json();
}

export async function apiDelete<T>(
  endpoint: string,
  headers?: Record<string, string>
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'DELETE',
    headers,
  });
  return response.json();
}

