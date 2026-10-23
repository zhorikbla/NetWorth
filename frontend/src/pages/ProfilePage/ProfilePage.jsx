import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiRequest } from '../../api/api'
import { useTheme } from '../../context/useTheme'
import { clearAuth, updateStoredUser } from '../../utils/authStorage'
import './ProfilePage.css'

function getInitials(nickname = '') {
  return nickname.trim().slice(0, 2).toUpperCase() || 'NW'
}

function ProfilePage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [form, setForm] = useState({ nickname: '', email: '', password: '' })
  const [role, setRole] = useState('user')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await apiRequest('/users/me')
        setForm({ nickname: user.nickname, email: user.email, password: '' })
        setRole(user.role)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setMessage('')

    try {
      const user = await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          nickname: form.nickname,
          email: form.email,
          ...(form.password ? { password: form.password } : {}),
        }),
      })
      updateStoredUser(user)
      setForm((current) => ({ ...current, password: '' }))
      setRole(user.role)
      setMessage('Изменения сохранены')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Удалить аккаунт вместе со всеми категориями, операциями и лимитами?',
    )
    if (!confirmed) return

    try {
      await apiRequest('/users/me', { method: 'DELETE' })
      clearAuth()
      navigate('/register', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (isLoading) {
    return <p className="profile-state">Загружаем профиль...</p>
  }

  return (
    <section className="profile-page">
      <header className="profile-heading">
        <p>NetWorth</p>
        <h1>Личный кабинет</h1>
        <span>Управляйте профилем и настройками</span>
      </header>

      <div className="profile-layout">
        <aside className="profile-card">
          <div className="profile-avatar">{getInitials(form.nickname)}</div>
          <strong>{form.nickname || 'Пользователь'}</strong>
          <span>{form.email}</span>
          <small>{role === 'admin' ? 'Администратор' : 'Пользователь'}</small>
        </aside>

        <div className="profile-content">
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="profile-section-title">
              <h2>Личные данные</h2>
              <p>Измените имя, email или пароль</p>
            </div>

            <label>
              <span>Имя</span>
              <input
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                minLength="2"
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>
            <label>
              <span>Новый пароль</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                minLength="8"
                placeholder="Оставьте пустым, чтобы не менять"
              />
            </label>

            {error && <p className="form-message-error" role="alert">{error}</p>}
            {message && <p className="form-message-success" role="status">{message}</p>}

            <button className="profile-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Сохраняем...' : 'Сохранить изменения'}
            </button>
          </form>

          <section className="profile-settings">
            <div>
              <h2>Оформление</h2>
              <p>Сейчас включена {theme === 'dark' ? 'тёмная' : 'светлая'} тема</p>
            </div>
            <button type="button" onClick={toggleTheme}>
              Включить {theme === 'dark' ? 'светлую' : 'тёмную'}
            </button>
          </section>

          <section className="profile-danger">
            <div>
              <h2>Удаление аккаунта</h2>
              <p>Данные будут удалены без возможности восстановления.</p>
            </div>
            <button type="button" onClick={handleDeleteAccount}>Удалить аккаунт</button>
          </section>
        </div>
      </div>
    </section>
  )
}

export default ProfilePage
