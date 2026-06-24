import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('onetapz_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// No auth interceptor: used for public, unauthenticated reads (e.g. the public
// profile) so the request carries no Authorization header and Vercel's edge
// can cache the response.
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export function publicProfileUrl(username: string) {
  return `${window.location.origin}/${username}`;
}

// True when the current session is a real API account (not the offline
// localStorage fallback or the legacy demo token). Used to decide whether a
// page should read from the API or from local storage.
export function hasApiSession() {
  const token = localStorage.getItem('onetapz_token');
  return Boolean(token) && token !== 'demo-token' && !token!.startsWith('local:');
}
