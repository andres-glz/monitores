import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthContext'
import { ReloadPrompt } from './components/layout/ReloadPrompt'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import './index.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors closeButton duration={2500} />
        <ReloadPrompt />
      </ConfirmProvider>
    </AuthProvider>
  </StrictMode>,
)
