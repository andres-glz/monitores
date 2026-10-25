import { Navigate, Outlet, createBrowserRouter } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { AppLayout, FocusLayout } from './components/layout/AppLayout'
import { HospitalPage } from './pages/HospitalPage'
import { HospitalsPage } from './pages/HospitalsPage'
import { LoginPage } from './pages/LoginPage'
import { MonitorFormPage } from './pages/MonitorFormPage'
import { SearchPage } from './pages/SearchPage'
import { ConsumablesPage } from './pages/settings/ConsumablesPage'
import { ModelsPage } from './pages/settings/ModelsPage'
import { ServicesPage } from './pages/settings/ServicesPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { UsersPage } from './pages/settings/UsersPage'

function RequireAuth() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HospitalsPage /> },
          { path: 'hospitals/:hospitalId', element: <HospitalPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/services', element: <ServicesPage /> },
          { path: 'settings/models', element: <ModelsPage /> },
          { path: 'settings/consumables', element: <ConsumablesPage /> },
          { path: 'settings/users', element: <UsersPage /> },
        ],
      },
      {
        // Captura y edición a pantalla completa
        element: <FocusLayout />,
        children: [
          { path: 'hospitals/:hospitalId/capture', element: <MonitorFormPage /> },
          { path: 'hospitals/:hospitalId/monitors/:monitorUuid', element: <MonitorFormPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
