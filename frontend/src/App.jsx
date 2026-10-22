import { Navigate, Route, Routes } from 'react-router-dom'

import RegisterPage from './pages/RegisterPage/RegisterPage'
import LoginPage from './pages/LoginPage/LoginPage'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
function TemporaryPage({title}){
  return(
    <main className="temporary-page">
      <h1>{title}</h1>
      <p>Разработка</p>
    </main>
  )
}

function App(){
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/register" element={<RegisterPage/>}/>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<TemporaryPage title="Мои финансы" />}/>
        <Route path="/operations" element={<TemporaryPage title="Операции" />}/>
        <Route path="/categories" element={<TemporaryPage title="Категории" />}/>
        <Route path="/limits" element={<TemporaryPage title="Лимиты" />}/>
        <Route path="/profile" element={<TemporaryPage title="Личный кабинет" />}/>
      </Route>
      
      <Route path="/" element={<Navigate to="/login" replace />}/>
      <Route path="*" element={<TemporaryPage title="Страница не найдена" />}/>

    </Routes>
  )
}

export default App
