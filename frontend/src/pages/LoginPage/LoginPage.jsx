import {useState} from 'react'
import {Link, useLocation, useNavigate} from 'react-router-dom'

import AuthPromo from '../../components/AuthPromo/AuthPromo'
import { saveAuth } from '../../utils/authStorage'
import '../RegisterPage/RegisterPage.css'

function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const [form, setForm] = useState({
        email: '',
        password: '',
    })
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const successMessage = location.state?.message
    function handleChange(event) {
        const {name, value} = event.target

        setForm((currentForm)=>({
            ...currentForm,
            [name]: value,
        }))
    }
    async function handleSubmit(event){
        event.preventDefault()
        setError('')
        setIsLoading(true)
        try{
            const response = await fetch('/api/auth/login',{
                method: 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                }),
            })
            const data = await response.json()

            if(!response.ok){
                throw new Error(data.error || "Не удалось выполнить вход")
            }
            saveAuth(data.token, data.user)

            const destination = location.state?.from || '/dashboard'
            navigate(destination, {replace: true})
        } catch(requestError){
            setError(requestError.message)
        } finally {
            setIsLoading(false)
        }
    }
    return (
        <main className="register-page">
            <section className="register-card">
                <AuthPromo />
                <div className="register-form-section">
                    <div className="register-form-heading">
                        <h2>Войти в аккаунт</h2>
                        <p>Продолжите работу с NetWorth</p>
                    </div>
                    {successMessage && (
                        <p className="register-success" role="status">{successMessage}</p>
                    )}
                    <form className="register-form" onSubmit={handleSubmit}>
                        <label>
                            <span>Email</span>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="nameW@examplew.com"
                                required
                            />
                        </label>
                        <label>
                            <span>Пароль</span>
                            <div className="register-password-field">
                                <input
                                    type={isPasswordVisible ? 'text' : 'password'}
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Введите пароль"
                                    required
                                />
                                <button type="button" onClick={()=> setIsPasswordVisible((current)=>!current)} aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}>{isPasswordVisible ? 'Скрыть' : 'Показать'}</button>
                            </div>
                        </label>
                        {error && (
                            <p className="register-error" role="alert">{error}</p>
                        )}
                        <button className="register-submit" type="submit" disabled={isLoading}>
                            {isLoading ? 'Выполняется вход...' : 'Войти'}
                        </button>
                    </form>
                    <p className="register-login-link">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
                </div>
            </section>
        </main>
    )
}
export default LoginPage
