import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import RegisterPage from './pages/RegisterPage/RegisterPage'
import LoginPage from './pages/LoginPage/LoginPage'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import AdminRoute from './components/AdminRoute/AdminRoute'
import AppLayout from './layouts/AppLayout/AppLayout'

const DashboardPage = lazy(() => import('./pages/DashboardPage/DashboardPage'))
const OperationsPage = lazy(() => import('./pages/OperationsPage/OperationsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage/CategoriesPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage/AdminPage'))
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
    <Suspense fallback={<main className="temporary-page"><p>Загрузка...</p></main>}>
    <Routes>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/register" element={<RegisterPage/>}/>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />}/>
          <Route path="/operations" element={<OperationsPage />}/>
          <Route path="/categories" element={<CategoriesPage />}/>
          <Route path="/limits" element={<Navigate to="/categories" replace />}/>
          <Route path="/profile" element={<ProfilePage />}/>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />}/>
          </Route>
        </Route>
      </Route>
      
      <Route path="/" element={<Navigate to="/dashboard" replace />}/>
      <Route path="*" element={<TemporaryPage title="Страница не найдена" />}/>

    </Routes>
    </Suspense>
  )
}

export default App
