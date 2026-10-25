import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './auth/AuthContext'
import { AppToaster } from './components/layout/AppToaster'
import { ReloadPrompt } from './components/layout/ReloadPrompt'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import './index.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <AppToaster />
        <ReloadPrompt />
      </ConfirmProvider>
    </AuthProvider>
  </StrictMode>,
)
