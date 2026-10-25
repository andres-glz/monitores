import { CloudOff, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Button, IconButton } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { EmptyState, LoadingState } from '../../components/ui/EmptyState'
import { Field, TextInput } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Switch } from '../../components/ui/Switch'
import { useCatalogMutation } from '../../hooks/useCatalogMutation'
import { api, errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { User } from '../../lib/types'

/**
 * Administración de usuarios (requiere conexión: los usuarios no se guardan en el dispositivo).
 */
export function UsersPage() {
  const { user: currentUser, updateCachedUser } = useAuth()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await api.get<User[]>('/users'))
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (user: User) => {
    const accepted = await confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar a ${user.name}? Sus capturas se conservan.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!accepted) return
    await run(() => api.delete(`/users/${user.id}`), 'Usuario eliminado')
    await load()
  }

  const onSaved = (saved: User) => {
    if (saved.id === currentUser?.id) updateCachedUser(saved)
    void load()
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        backTo="/settings"
        subtitle="Todas las personas con acceso pueden capturar y configurar."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nuevo usuario
          </Button>
        }
      />

      {loadError ? (
        <EmptyState
          icon={CloudOff}
          title="No se pudo cargar la lista"
          description={loadError}
          action={<Button onClick={load}>Reintentar</Button>}
        />
      ) : users === null ? (
        <LoadingState />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{user.name}</span>
                  {user.id === currentUser?.id && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800 dark:bg-teal-500/10 dark:text-teal-300">Tú</span>}
                  {!user.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">Inactivo</span>}
                </div>
                <div className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">Último acceso: {formatDateTime(user.last_login_at)}</div>
              </div>
              <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(user)} />
              {user.id !== currentUser?.id && <IconButton icon={Trash2} label="Eliminar" onClick={() => remove(user)} />}
            </li>
          ))}
        </ul>
      )}

      <UserFormModal
        open={editing !== null}
        user={editing === 'new' ? null : editing}
        isSelf={editing !== 'new' && editing?.id === currentUser?.id}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </>
  )
}

function UserFormModal({
  open,
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  open: boolean
  user: User | null
  isSelf: boolean
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(true)
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '')
      setEmail(user?.email ?? '')
      setPassword('')
      setIsActive(user?.is_active ?? true)
      clearErrors()
    }
  }, [open, user, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const saved = await run(
      () =>
        user
          ? api.put<User>(`/users/${user.id}`, { name, email, password: password || null, is_active: isActive })
          : api.post<User>('/users', { name, email, password }),
      user ? 'Usuario actualizado' : 'Usuario creado',
    )
    if (saved) {
      onSaved(saved)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" htmlFor="user-name" required error={fieldErrors.name}>
          <TextInput id="user-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </Field>
        <Field label="Correo" htmlFor="user-email" required error={fieldErrors.email}>
          <TextInput
            id="user-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field
          label="Contraseña"
          htmlFor="user-password"
          required={!user}
          error={fieldErrors.password}
          hint={user ? 'Déjala vacía para no cambiarla. Mínimo 8 caracteres.' : 'Mínimo 8 caracteres.'}
        >
          <TextInput
            id="user-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={!user}
            minLength={8}
          />
        </Field>
        {user && !isSelf && (
          <Switch checked={isActive} onChange={setIsActive} label={isActive ? 'Usuario activo' : 'Usuario inactivo (no puede entrar)'} />
        )}
      </form>
    </Modal>
  )
}
