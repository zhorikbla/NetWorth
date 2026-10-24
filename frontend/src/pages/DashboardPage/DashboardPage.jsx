import { useEffect, useState} from 'react'
import { Link } from 'react-router-dom'
import { 
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts'


import {apiRequest} from '../../api/api'

import './DashboardPage.css'

const INITIAL_DATA = {
    totalBalance: 0,
    summary:{
        income: 0,
        expense: 0,
        balance: 0,
    },
    byCategory: [],
    operations: [],
    categories: [],
}

const CHART_COLORS = [
    '#D9A441',
    '#6F8FBD',
    '#72A68C',
    '#DE7D70',
    '#9A7DD7',
    '#D5B66D',
]
function getMonthRange (monthValue){
    const [year, month] = monthValue.split('-').map(Number)

    const lastDay = new Date(
        Date.UTC(year, month, 0),
    ).getUTCDate()
    return {
        dateFrom: `${monthValue}-01`,
        dateTo:`${monthValue}-${String(lastDay).padStart(2, '0')}`,
    }
}

function formatMoney(value){
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
    }).format(Number(value))
}

function DashboardPage(){
    const [selectedMonth, setSelectedMonth] = useState(
        () => new Date().toISOString().slice(0,7),
    )

    const [dashboardData, setDashboardData] = useState(INITIAL_DATA)
    const [isLoading, setIsLoading]=useState(true)
    const [error, setError] = useState('')
    const [chartKind, setChartKind]  = useState('expense')

    useEffect(()=>{
        let requestCancelled = false
        async function loadDashboard(){
            setIsLoading(true)
            setError('')
            const { dateFrom, dateTo } = getMonthRange(selectedMonth)

            const query = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo,
            })
            try {
                const [totalSummary, summary, byCategory, operations, categories] =
                    await Promise.all([
                        apiRequest('/stats/summary'),
                        apiRequest(`/stats/summary?${query}`),
                        apiRequest(`/stats/by-category?${query}`),
                        apiRequest(`/operations?${query}`),
                        apiRequest('/categories'),
                    ])
                    if (!requestCancelled){
                        setDashboardData({
                            totalBalance: totalSummary.balance,
                            summary,
                            byCategory,
                            operations,
                            categories,
                        })
                    }
            } catch (requestError){
                if(!requestCancelled){
                    setError(requestError.message)
                }
            } finally{
                if (!requestCancelled){
                    setIsLoading(false)
                }
            }
        }

        loadDashboard()

        return () => {
            requestCancelled = true
        }
    }, [selectedMonth])

        function getCategoryName(categoryId){
            const category = dashboardData.categories.find(
                (item) => item.category_id === categoryId,
            )
            return category?.name || 'Без категории'
        }

        const chartData = dashboardData.byCategory
            .map((category)=> ({
                id: category.category_id,
                name: category.category_name || 'Без категории',
                value: Number(category[chartKind]),
            }))
            .filter((category)=>category.value>0)
        const chartTotal = chartData.reduce(
            (total, category)=>total+category.value,
            0,
        )

        if (isLoading){
            return (
                <section className="dashboard-state">
                    <p>Загружаем финансы...</p>
                </section>
            )
        }

        if (error) {
            return (
                <section className="dashboard-state dashboard-state-error">
                    <p>{error}</p>
                </section>
            )
        }

        return (
            <section className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-logo">NetWorth</p>
                        <h1>Мои финансы</h1>
                    </div>

                    <div className="dashboard-header-actions">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(event)=>setSelectedMonth(event.target.value)}
                            aria-label="Выбрать месяц"
                        />
                        <Link to="/operations">+ Добавить операцию</Link>
                    </div>
                </header>
                <div className="dashboard-summary">
                    <article>
                        <span>Общий баланс</span>
                        <strong>{formatMoney(dashboardData.totalBalance)}</strong>
                    </article>
                    <article>
                        <span>Доходы за месяц</span>
                        <strong>{formatMoney(dashboardData.summary.income)}</strong>
                    </article>
                    <article>
                        <span>Расходы за месяц</span>
                        <strong>{formatMoney(dashboardData.summary.expense)}</strong>
                    </article>
                </div>

                <section className="dashboard-section dashboard-chart-section">
                    <div className="dashboard-section-heading">
                        <h2>По категориям</h2>

                        <div className="dashboard-kind-switch">
                            <button
                                className={chartKind === 'expense' ? 'is-active' : ''}
                                type="button"
                                onClick={() => setChartKind('expense')}
                            >
                                Расходы
                            </button>

                            <button
                                className={chartKind === 'income' ? 'is-active' : ''}
                                type="button"
                                onClick={() => setChartKind('income')}
                            >
                                Доходы
                            </button>
                        </div>
                    </div>

                    {chartData.length === 0 ? (
                        <p>За этот месяц пока нет таких операций</p>
                    ) : (
                        <div className="dashboard-chart-content">
                            <div className="dashboard-chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius="58%"
                                            outerRadius="88%"
                                            paddingAngle={2}
                                            stroke="none"
                                        >
                                            {chartData.map((category, index) => (
                                                <Cell
                                                    key={category.id}
                                                    fill={
                                                        CHART_COLORS[
                                                            index % CHART_COLORS.length
                                                        ]
                                                    }
                                                />
                                            ))}
                                        </Pie>

                                        <Tooltip
                                            formatter={(value) => formatMoney(value)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="dashboard-chart-total">
                                    <span>Всего</span>
                                    <strong>{formatMoney(chartTotal)}</strong>
                                </div>
                            </div>

                            <div className="dashboard-chart-legend">
                                {chartData.map((category, index) => (
                                    <article key={category.id}>
                                        <span
                                            className="dashboard-chart-color"
                                            style={{
                                                backgroundColor:
                                                    CHART_COLORS[
                                                        index % CHART_COLORS.length
                                                    ],
                                            }}
                                        />

                                        <span>{category.name}</span>

                                        <strong>{formatMoney(category.value)}</strong>

                                        <small>
                                            {(
                                                (category.value / chartTotal) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </small>
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
                <section className="dashboard-section">
                    <h2>Последние операции</h2>
                    {dashboardData.operations.length===0 ? (
                        <p>Операций пока нет</p>
                    ):(
                        <div className="dashboard-operations-list">
                            {dashboardData.operations.slice(0,4).map((operation)=>(
                                <article key = {operation.operation_id}>
                                    <time dateTime={operation.data}>
                                        {new Date(operation.data).toLocaleDateString('ru-RU')}
                                    </time>

                                    <span>{operation.comment || 'Без комментария'}</span>
                                    <span>{getCategoryName(operation.category_id)}</span>

                                    <strong className={`dashboard-operation-sum is-${operation.kind}`}>
                                        {operation.kind === 'expense' ? '-' : '+'}
                                        {formatMoney(operation.summ)}
                                    </strong>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        )
}

export default DashboardPage
