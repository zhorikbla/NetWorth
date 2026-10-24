import { useEffect, useState } from 'react'

import { apiRequest } from '../../api/api'
import Modal from '../../components/Modal/Modal'
import './CategoriesPage.css'

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [limits, setLimits] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [categoryForm, setCategoryForm] = useState(null)
  const [limitForm, setLimitForm] = useState(null)

  async function loadData() {
    try {
      const [categoriesData, limitsData] = await Promise.all([
        apiRequest('/categories'),
        apiRequest('/limits'),
      ])
      setCategories(categoriesData)
      setLimits(limitsData)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    Promise.all([
      apiRequest('/categories'),
      apiRequest('/limits'),
    ]).then(([categoriesData, limitsData]) => {
      if (!isActive) return
      setCategories(categoriesData)
      setLimits(limitsData)
      setError('')
    }).catch((requestError) => {
      if (isActive) setError(requestError.message)
    }).finally(() => {
      if (isActive) setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [])

  function getMonthLimit(categoryId) {
    return limits.find((limit) => (
      limit.category_id === categoryId && limit.data.slice(0, 7) === selectedMonth
    ))
  }

  async function saveCategory(event) {
    event.preventDefault()
    setIsSaving(true)
    setFormError('')

    try {
      await apiRequest(
        categoryForm.category_id
          ? `/categories/${categoryForm.category_id}`
          : '/categories',
        {
          method: categoryForm.category_id ? 'PATCH' : 'POST',
          body: JSON.stringify({ name: categoryForm.name }),
        },
      )
      setCategoryForm(null)
      await loadData()
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteCategory(category) {
    const confirmed = window.confirm(`Удалить категорию «${category.name}»?`)
    if (!confirmed) return

    try {
      await apiRequest(`/categories/${category.category_id}`, { method: 'DELETE' })
      setCategories((current) => current.filter(
        (item) => item.category_id !== category.category_id,
      ))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function openLimitForm(category, limit) {
    setFormError('')
    setLimitForm({
      limit_id: limit?.limit_id || null,
      category_id: category.category_id,
      category_name: category.name,
      data: selectedMonth,
      limit_summ: limit ? String(limit.limit_summ) : '',
    })
  }

  async function saveLimit(event) {
    event.preventDefault()
    setIsSaving(true)
    setFormError('')

    try {
      await apiRequest(
        limitForm.limit_id ? `/limits/${limitForm.limit_id}` : '/limits',
        {
          method: limitForm.limit_id ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...(limitForm.limit_id ? {} : { category_id: limitForm.category_id }),
            data: `${limitForm.data}-01`,
            limit_summ: Number(limitForm.limit_summ),
          }),
        },
      )
      setLimitForm(null)
      await loadData()
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteLimit(limitId) {
    if (!window.confirm('Удалить лимит на этот месяц?')) return

    try {
      await apiRequest(`/limits/${limitId}`, { method: 'DELETE' })
      setLimitForm(null)
      await loadData()
    } catch (requestError) {
      setFormError(requestError.message)
    }
  }

  if (isLoading) {
    return <p className="categories-state">Загружаем категории...</p>
  }

  return (
    <section className="categories-page">
      <header className="categories-header">
        <div>
          <p className="categories-logo">NetWorth</p>
          <h1>Категории и лимиты</h1>
          <p>Планируйте расходы и следите за их превышением</p>
        </div>

        <div className="categories-header-actions">
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            aria-label="Выбрать месяц"
          />
          <button
            type="button"
            onClick={() => {
              setFormError('')
              setCategoryForm({ category_id: null, name: '' })
            }}
          >
            + Новая категория
          </button>
        </div>
      </header>

      {error && <p className="form-message-error" role="alert">{error}</p>}

      {categories.length === 0 ? (
        <div className="categories-empty">
          <h2>Категорий пока нет</h2>
          <p>Создайте первую категорию, затем добавляйте операции и лимиты.</p>
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map((category) => {
            const limit = getMonthLimit(category.category_id)
            const spent = Number(limit?.spent || 0)
            const limitSumm = Number(limit?.limit_summ || 0)
            const progress = limitSumm > 0
              ? Math.min((spent / limitSumm) * 100, 100)
              : 0

            return (
              <article className="category-card" key={category.category_id}>
                <header>
                  <h2>{category.name}</h2>
                  <span className="category-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setFormError('')
                        setCategoryForm(category)
                      }}
                    >
                      Изменить
                    </button>
                    <button type="button" onClick={() => deleteCategory(category)}>
                      Удалить
                    </button>
                  </span>
                </header>

                {limit ? (
                  <div className="category-limit">
                    <div>
                      <span>Расходы за месяц</span>
                      <strong>
                        {formatMoney(spent)} из {formatMoney(limitSumm)}
                      </strong>
                    </div>
                    <div className="category-progress" aria-label={`Использовано ${progress}%`}>
                      <span
                        className={spent > limitSumm ? 'is-over' : ''}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className={spent > limitSumm ? 'is-over' : ''}>
                      {spent > limitSumm
                        ? `Превышение: ${formatMoney(spent - limitSumm)}`
                        : `Осталось: ${formatMoney(limitSumm - spent)}`}
                    </p>
                    <button type="button" onClick={() => openLimitForm(category, limit)}>
                      Изменить лимит
                    </button>
                  </div>
                ) : (
                  <div className="category-no-limit">
                    <p>На выбранный месяц лимит не установлен.</p>
                    <button type="button" onClick={() => openLimitForm(category)}>
                      Установить лимит
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {categoryForm && (
        <Modal
          title={categoryForm.category_id ? 'Изменить категорию' : 'Новая категория'}
          onClose={() => setCategoryForm(null)}
        >
          <form className="modal-form" onSubmit={saveCategory}>
            <label>
              <span>Название</span>
              <input
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))}
                minLength="2"
                required
                autoFocus
              />
            </label>
            {formError && <p className="form-message-error" role="alert">{formError}</p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setCategoryForm(null)}>Отмена</button>
              <button className="is-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {limitForm && (
        <Modal title={`Лимит: ${limitForm.category_name}`} onClose={() => setLimitForm(null)}>
          <form className="modal-form" onSubmit={saveLimit}>
            <label>
              <span>Месяц</span>
              <input
                type="month"
                value={limitForm.data}
                onChange={(event) => setLimitForm((current) => ({
                  ...current,
                  data: event.target.value,
                }))}
                required
              />
            </label>
            <label>
              <span>Сумма лимита</span>
              <input
                type="number"
                value={limitForm.limit_summ}
                onChange={(event) => setLimitForm((current) => ({
                  ...current,
                  limit_summ: event.target.value,
                }))}
                min="0.01"
                step="0.01"
                required
              />
            </label>
            {formError && <p className="form-message-error" role="alert">{formError}</p>}
            <div className="modal-actions">
              {limitForm.limit_id && (
                <button type="button" onClick={() => deleteLimit(limitForm.limit_id)}>
                  Удалить
                </button>
              )}
              <button type="button" onClick={() => setLimitForm(null)}>Отмена</button>
              <button className="is-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default CategoriesPage
