const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const storedUser = localStorage.getItem(USER_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch {
    clearAuth()
    return null
  }
}

export function updateStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent('auth-user-updated', { detail: user }))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
