import { Navigate, Route, Routes } from 'react-router-dom'

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
      <Route path="/login" element={<TemporaryPage title="Вход" />}/>
      <Route path="/register" element={<TemporaryPage title="Регистрация" />}/>
      <Route path="/dashboard" element={<TemporaryPage title="Мои финансы" />}/>
      <Route path="/operations" element={<TemporaryPage title="Операции" />}/>
      <Route path="/categories" element={<TemporaryPage title="Категории" />}/>
      <Route path="/limits" element={<TemporaryPage title="Лимиты" />}/>
      <Route path="/profile" element={<TemporaryPage title="Личный кабинет" />}/>
      
      <Route path="/" element={<Navigate to="/login" replace />}/>
      <Route path="*" element={<TemporaryPage title="Страница не найдена" />}/>

    </Routes>
  )
}

export default App