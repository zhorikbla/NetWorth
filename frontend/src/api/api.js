import { clearAuth, getToken } from '../utils/authStorage'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  const token = getToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type')
  const data = response.status === 204
    ? null
    : contentType?.includes('application/json')
      ? await response.json()
      : await response.text()

  if (response.status === 401) {
    clearAuth()

    if (window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
  }

  if (!response.ok) {
    const message = data && typeof data === 'object'
      ? data.error
      : null

    throw new Error(message || 'Не удалось выполнить запрос')
  }

  return data
}
