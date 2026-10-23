import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useTheme } from '../../context/useTheme'
import { clearAuth, getStoredUser } from '../../utils/authStorage'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Мои финансы', icon: 'wallet' },
  { to: '/operations', label: 'Операции', icon: 'operations' },
  { to: '/categories', label: 'Категории', icon: 'categories' },
  { to: '/profile', label: 'Личный кабинет', icon: 'profile' },
]

const ADMIN_NAV_ITEM = {
  to: '/admin',
  label: 'Администрирование',
  icon: 'admin',
}

function NavigationIcon({ name }) {
  if (name === 'admin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.7-2.9 8.2-7 10-4.1-1.8-7-5.3-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )
  }

  if (name === 'categories') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  if (name === 'profile') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  }

  if (name === 'operations') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h13M16 3l4 4-4 4" />
        <path d="M17 17H4M8 13l-4 4 4 4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v12H5.5A2.5 2.5 0 0 1 3 16.5z" />
      <path d="M3 8h16M16 12h5" />
      <circle cx="16" cy="15.5" r="1" />
    </svg>
  )
}

function getInitials(nickname = '') {
  return nickname.trim().slice(0, 2).toUpperCase() || 'NW'
}

function AppLayout() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState(getStoredUser)
  const navigationItems = user?.role === 'admin'
    ? [...NAV_ITEMS, ADMIN_NAV_ITEM]
    : NAV_ITEMS

  useEffect(() => {
    function handleUserUpdate(event) {
      setUser(event.detail)
    }

    window.addEventListener('auth-user-updated', handleUserUpdate)
    return () => window.removeEventListener('auth-user-updated', handleUserUpdate)
  }, [])

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      <main className="app-layout-content">
        <Outlet />
      </main>

      <aside className="app-sidebar">
        <nav className="app-sidebar-nav" aria-label="Основная навигация">
          {navigationItems.map((item) => (
            <NavLink
              className={({ isActive }) => (
                `app-sidebar-link${isActive ? ' is-active' : ''}`
              )}
              key={item.to}
              to={item.to}
            >
              <span className="app-sidebar-icon">
                <NavigationIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <button className="app-theme-button" type="button" onClick={toggleTheme}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>

          <div className="app-user-card">
            <span className="app-user-avatar">
              {getInitials(user?.nickname)}
            </span>

            <span className="app-user-info">
              <strong>{user?.nickname || 'Пользователь'}</strong>
              <small>{user?.email || ''}</small>
            </span>

            <button
              className="app-logout-button"
              type="button"
              onClick={handleLogout}
              aria-label="Выйти из аккаунта"
              title="Выйти"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default AppLayout
