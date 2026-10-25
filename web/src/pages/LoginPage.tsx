import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/layout/AppLayout'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Field, TextInput } from '../components/ui/Field'
import { errorMessage } from '../lib/api'

export function LoginPage() {
  const { user, sessionExpired, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user && !sessionExpired) return <Navigate to="/" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-gradient-to-b from-teal-50 to-slate-50 px-4 dark:from-teal-950/40 dark:to-slate-950">
      <div className="safe-top absolute top-0 right-0">
        <div className="p-3">
          <ThemeToggle />
        </div>
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Iniciar sesión</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {sessionExpired ? 'Tu sesión expiró; entra de nuevo para sincronizar.' : 'Ingresa con tu cuenta.'}
            </p>
          </div>
          <Field label="Correo" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
          <Button type="submit" size="lg" icon={LogIn} loading={submitting} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
