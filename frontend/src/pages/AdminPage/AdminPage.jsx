import { useEffect, useMemo, useState } from 'react'

import { apiRequest } from '../../api/api'
import { getStoredUser } from '../../utils/authStorage'
import './AdminPage.css'

function AdminPage() {
  const currentUser = getStoredUser()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadUsers() {
    setIsLoading(true)
    setError('')

    try {
      setUsers(await apiRequest('/admin/users'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    apiRequest('/admin/users')
      .then((usersData) => {
        if (isActive) setUsers(usersData)
      })
      .catch((requestError) => {
        if (isActive) setError(requestError.message)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return users

    return users.filter((user) => (
      user.nickname.toLowerCase().includes(normalizedQuery)
      || user.email.toLowerCase().includes(normalizedQuery)
      || String(user.user_id).includes(normalizedQuery)
    ))
  }, [query, users])

  const adminCount = users.filter((user) => user.role === 'admin').length

  async function changeRole(user) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin'
    const action = nextRole === 'admin'
      ? 'назначить администратором'
      : 'сделать обычным пользователем'

    if (!window.confirm(`${action}: ${user.email}?`)) return

    setBusyUserId(user.user_id)
    setError('')
    setMessage('')

    try {
      const updatedUser = await apiRequest(`/admin/users/${user.user_id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role_name: nextRole }),
      })

      setUsers((current) => current.map((item) => (
        item.user_id === updatedUser.user_id ? updatedUser : item
      )))
      setMessage(`Роль пользователя ${updatedUser.email} изменена`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyUserId(null)
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Удалить ${user.email} и все связанные данные?`)) return

    setBusyUserId(user.user_id)
    setError('')
    setMessage('')

    try {
      await apiRequest(`/admin/users/${user.user_id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((item) => item.user_id !== user.user_id))
      setMessage(`Пользователь ${user.email} удалён`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-heading">
        <div>
          <p>NetWorth</p>
          <h1>Администрирование</h1>
          <span>Пользователи и роли системы</span>
        </div>

        <button type="button" onClick={loadUsers} disabled={isLoading}>
          {isLoading ? 'Обновляем...' : 'Обновить список'}
        </button>
      </header>

      <div className="admin-summary">
        <article>
          <span>Всего пользователей</span>
          <strong>{users.length}</strong>
        </article>
        <article>
          <span>Администраторов</span>
          <strong>{adminCount}</strong>
        </article>
        <article>
          <span>Обычных пользователей</span>
          <strong>{users.length - adminCount}</strong>
        </article>
      </div>

      <section className="admin-users">
        <div className="admin-toolbar">
          <div>
            <h2>Пользователи</h2>
            <p>Изменяйте роли или удаляйте чужие аккаунты</p>
          </div>

          <label>
            <span className="admin-visually-hidden">Поиск пользователя</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, email или ID"
            />
          </label>
        </div>

        {error && <p className="admin-message is-error" role="alert">{error}</p>}
        {message && <p className="admin-message is-success" role="status">{message}</p>}

        {isLoading ? (
          <p className="admin-state">Загружаем пользователей...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="admin-state">Пользователи не найдены</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Пользователь</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th><span className="admin-visually-hidden">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.user_id === currentUser?.user_id
                  const isBusy = busyUserId === user.user_id

                  return (
                    <tr key={user.user_id}>
                      <td data-label="ID">#{user.user_id}</td>
                      <td data-label="Пользователь">
                        <div className="admin-user-name">
                          <span>{user.nickname.slice(0, 2).toUpperCase()}</span>
                          <strong>{user.nickname}</strong>
                          {isCurrentUser && <small>Вы</small>}
                        </div>
                      </td>
                      <td data-label="Email">{user.email}</td>
                      <td data-label="Роль">
                        <span className={`admin-role is-${user.role}`}>
                          {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          onClick={() => changeRole(user)}
                          disabled={isCurrentUser || isBusy}
                        >
                          {user.role === 'admin' ? 'Снять admin' : 'Назначить admin'}
                        </button>
                        <button
                          className="is-danger"
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={isCurrentUser || isBusy}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

export default AdminPage
