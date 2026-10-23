import { useEffect, useState } from 'react'

import { apiRequest } from '../../api/api'
import Modal from '../../components/Modal/Modal'
import './OperationsPage.css'

const EMPTY_FORM = {
  summ: '',
  kind: 'expense',
  data: '',
  comment: '',
  category_id: '',
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function getToday() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function OperationsPage() {
  const [operations, setOperations] = useState([])
  const [categories, setCategories] = useState([])
  const [kindFilter, setKindFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadData() {
    try {
      const [operationsData, categoriesData] = await Promise.all([
        apiRequest('/operations'),
        apiRequest('/categories'),
      ])
      setOperations(operationsData)
      setCategories(categoriesData)
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
      apiRequest('/operations'),
      apiRequest('/categories'),
    ]).then(([operationsData, categoriesData]) => {
      if (!isActive) return
      setOperations(operationsData)
      setCategories(categoriesData)
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

  const visibleOperations = kindFilter === 'all'
    ? operations
    : operations.filter((operation) => operation.kind === kindFilter)

  function getCategoryName(categoryId) {
    return categories.find(
      (category) => category.category_id === categoryId,
    )?.name || 'Без категории'
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, data: getToday() })
    setFormError('')
    setIsFormOpen(true)
  }

  function openEditForm(operation) {
    setEditingId(operation.operation_id)
    setForm({
      summ: String(operation.summ),
      kind: operation.kind,
      data: operation.data.slice(0, 10),
      comment: operation.comment || '',
      category_id: String(operation.category_id),
    })
    setFormError('')
    setIsFormOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setFormError('')

    try {
      await apiRequest(editingId ? `/operations/${editingId}` : '/operations', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          summ: Number(form.summ),
          kind: form.kind,
          data: form.data,
          comment: form.comment,
          category_id: Number(form.category_id),
        }),
      })
      setIsFormOpen(false)
      await loadData()
    } catch (requestError) {
      setFormError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(operation) {
    const confirmed = window.confirm(
      `Удалить операцию «${operation.comment || 'Без комментария'}»?`,
    )
    if (!confirmed) return

    try {
      await apiRequest(`/operations/${operation.operation_id}`, {
        method: 'DELETE',
      })
      setOperations((current) => current.filter(
        (item) => item.operation_id !== operation.operation_id,
      ))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (isLoading) {
    return <p className="operations-state">Загружаем операции...</p>
  }

  return (
    <section className="operations-page">
      <header className="operations-header">
        <div>
          <p className="operations-logo">NetWorth</p>
          <h1>Операции</h1>
          <p>История ваших доходов и расходов</p>
        </div>

        <div className="operations-header-actions">
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            aria-label="Фильтр по типу операции"
          >
            <option value="all">Все операции</option>
            <option value="expense">Расходы</option>
            <option value="income">Доходы</option>
          </select>
          <button type="button" onClick={openCreateForm}>
            + Добавить операцию
          </button>
        </div>
      </header>

      {error && <p className="form-message-error" role="alert">{error}</p>}

      <div className="operations-card">
        <div className="operations-table-head" aria-hidden="true">
          <span>Дата</span>
          <span>Операция</span>
          <span>Категория</span>
          <span>Сумма</span>
          <span />
        </div>

        {visibleOperations.length === 0 ? (
          <p className="operations-empty">Подходящих операций пока нет</p>
        ) : (
          <div className="operations-list">
            {visibleOperations.map((operation) => (
              <article key={operation.operation_id}>
                <time dateTime={operation.data}>
                  {new Date(operation.data).toLocaleDateString('ru-RU')}
                </time>
                <span>{operation.comment || 'Без комментария'}</span>
                <span className="operations-category">
                  {getCategoryName(operation.category_id)}
                </span>
                <strong className={`operations-sum is-${operation.kind}`}>
                  {operation.kind === 'expense' ? '−' : '+'}
                  {formatMoney(operation.summ)}
                </strong>
                <span className="operations-row-actions">
                  <button type="button" onClick={() => openEditForm(operation)}>
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(operation)}>
                    Удалить
                  </button>
                </span>
              </article>
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <Modal
          title={editingId ? 'Изменить операцию' : 'Новая операция'}
          onClose={() => setIsFormOpen(false)}
        >
          <form className="modal-form" onSubmit={handleSubmit}>
            <label>
              <span>Тип</span>
              <select name="kind" value={form.kind} onChange={handleFormChange}>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
            </label>
            <label>
              <span>Сумма</span>
              <input
                type="number"
                name="summ"
                value={form.summ}
                onChange={handleFormChange}
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              <span>Категория</span>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleFormChange}
                required
              >
                <option value="">Выберите категорию</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Дата</span>
              <input
                type="date"
                name="data"
                value={form.data}
                onChange={handleFormChange}
                required
              />
            </label>
            <label>
              <span>Комментарий</span>
              <textarea
                name="comment"
                value={form.comment}
                onChange={handleFormChange}
                placeholder="Например, продукты на неделю"
              />
            </label>

            {formError && <p className="form-message-error" role="alert">{formError}</p>}

            <div className="modal-actions">
              <button type="button" onClick={() => setIsFormOpen(false)}>
                Отмена
              </button>
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

export default OperationsPage
