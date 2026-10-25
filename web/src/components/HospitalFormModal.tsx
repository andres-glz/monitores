import { useEffect, useState, type FormEvent } from 'react'
import { useCatalogMutation } from '../hooks/useCatalogMutation'
import { api } from '../lib/api'
import { emptyToNull } from '../lib/format'
import type { Hospital } from '../lib/types'
import { Button } from './ui/Button'
import { Field, TextArea, TextInput } from './ui/Field'
import { Modal } from './ui/Modal'

interface HospitalFormModalProps {
  open: boolean
  hospital?: Hospital | null
  onClose: () => void
  onSaved?: (hospital: Hospital) => void
}

export function HospitalFormModal({ open, hospital, onClose, onSaved }: HospitalFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (open) {
      setName(hospital?.name ?? '')
      setDescription(hospital?.description ?? '')
      clearErrors()
    }
  }, [open, hospital, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = { name, description: emptyToNull(description) }
    const saved = await run(
      () => (hospital ? api.put<Hospital>(`/hospitals/${hospital.id}`, body) : api.post<Hospital>('/hospitals', body)),
      hospital ? 'Hospital actualizado' : 'Hospital registrado',
    )
    if (saved) {
      onSaved?.(saved)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hospital ? 'Editar hospital' : 'Nuevo hospital'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="hospital-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="hospital-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" htmlFor="hospital-name" required error={fieldErrors.name}>
          <TextInput
            id="hospital-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hospital General de Zona No. 1"
            required
            autoFocus
          />
        </Field>
        <Field label="Descripción" htmlFor="hospital-description" error={fieldErrors.description}>
          <TextArea
            id="hospital-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dirección, contacto, notas…"
          />
        </Field>
      </form>
    </Modal>
  )
}
