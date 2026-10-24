import { Navigate, Outlet } from 'react-router-dom'

import { getStoredUser } from '../../utils/authStorage'

function AdminRoute() {
  const user = getStoredUser()

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export default AdminRoute
