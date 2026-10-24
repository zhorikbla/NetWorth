import { useState } from 'react'
import {Link, useNavigate } from 'react-router-dom'

import './RegisterPage.css'
import AuthPromo from '../../components/AuthPromo/AuthPromo'
import { apiRequest } from '../../api/api'

function RegisterPage(){
    const navigate = useNavigate()
    const [form, setForm] = useState({
        nickname: '',
        email: '',
        password: '',
        passwordConfirm: '',
    })
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [passwordVisibility, setPasswordVisibility] = useState({
        password: false,
        passwordConfirm: false,
    })

    function togglePassword(fieldName){
        setPasswordVisibility((currentVisibility)=> ({
            ...currentVisibility,
            [fieldName]: !currentVisibility[fieldName],
        }))
    }
    function handleChange(event){
        const {name,value} = event.target
        setForm((currentForm)=>({
            ...currentForm,
            [name]: value,
        }))
    }
    async function handleSubmit(event){
        event.preventDefault()
        setError('')
        if(form.password!==form.passwordConfirm){
            setError('Пароли не совпадают')
            return
        }
        setIsLoading(true)
        try{
            await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    nickname: form.nickname,
                    email: form.email,
                    password: form.password,
                }),
            })
            navigate('/login',{
                state: {
                    message: 'Аккаунт создан. Теперь войдите в систему',
                },
            })
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
                        <h2>Создать аккаунт</h2>
                        <p>Зарегистрируйтесь в NetWorth</p>
                    </div>
                    <form className="register-form" onSubmit={handleSubmit}>
                        <label>
                            <span>Имя</span>
                            <input type="text" name="nickname" value={form.nickname} onChange={handleChange} placeholder="Как к вам обращаться" minLength="2" required />
                        </label>
                        <label>
                            <span>Email</span>
                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="nameW@eaxamplew.com" required />
                        </label>
                        <label>
                            <span>Пароль</span>
                            <div className="register-password-field">
                                <input type={passwordVisibility.password ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Введите пароль" minLength="8" required />
                                <button type="button" onClick={()=>togglePassword('password')}aria-label={
                                    passwordVisibility.password ? 'Скрыть пароль' : 'Показать пароль'
                                }>{passwordVisibility.password ? 'Скрыть' : 'Показать'}</button>
                            </div>
                        </label>
                        <label>
                            <span>Повторите пароль</span>

                            <div className="register-password-field">
                                <input
                                type={passwordVisibility.passwordConfirm ? 'text' : 'password'}
                                name="passwordConfirm"
                                value={form.passwordConfirm}
                                onChange={handleChange}
                                placeholder="Введите пароль ещё раз"
                                minLength="8"
                                required
                                />

                                <button
                                type="button"
                                onClick={() => togglePassword('passwordConfirm')}
                                aria-label={
                                    passwordVisibility.passwordConfirm
                                    ? 'Скрыть пароль'
                                    : 'Показать пароль'
                                }
                                >
                                {passwordVisibility.passwordConfirm ? 'Скрыть' : 'Показать'}
                                </button>
                            </div>
                        </label>

                        {error && (
                            <p className="register-error" role="alert">
                                {error}
                            </p>
                        )}
                            <button className="register-submit" type="submit" disabled={isLoading}>{isLoading ? 'Регистрация...' : 'Зарегистрироваться'}</button>

                    </form>
                    <p className="register-login-link">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
                </div>
            </section>

        </main>
    )
}
export default RegisterPage
