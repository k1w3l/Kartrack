import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'

const UIContext = createContext(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI deve ser usado dentro de <UIProvider>')
  return ctx
}

const TOAST_ICONS = {
  success: 'fa-solid fa-circle-check',
  error: 'fa-solid fa-circle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const [promptValue, setPromptValue] = useState('')
  const [showPromptValue, setShowPromptValue] = useState(false)
  const [busy, setBusy] = useState(false)
  const idRef = useRef(0)
  const inputRef = useRef(null)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback((message, options = {}) => {
    const id = (idRef.current += 1)
    const timeout = options.timeout ?? 4000
    setToasts((current) => [...current, { id, message, type: options.type || 'info' }])
    if (timeout) setTimeout(() => dismiss(id), timeout)
    return id
  }, [dismiss])

  const toast = useMemo(() => ({
    info: (message, options) => notify(message, { ...options, type: 'info' }),
    success: (message, options) => notify(message, { ...options, type: 'success' }),
    error: (message, options) => notify(message, { ...options, type: 'error' }),
    warning: (message, options) => notify(message, { ...options, type: 'warning' }),
  }), [notify])

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    setBusy(false)
    setDialog({
      kind: 'confirm',
      title: options.title || 'Confirmar',
      titleIcon: options.titleIcon || (options.danger ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-question'),
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      danger: Boolean(options.danger),
      resolve,
    })
  }), [])

  const prompt = useCallback((options = {}) => new Promise((resolve) => {
    setBusy(false)
    setPromptValue(options.defaultValue || '')
    setShowPromptValue(options.inputType !== 'password')
    setDialog({
      kind: 'prompt',
      title: options.title || 'Informe um valor',
      titleIcon: options.titleIcon || 'fa-solid fa-keyboard',
      message: options.message || '',
      label: options.label || '',
      placeholder: options.placeholder || '',
      inputType: options.inputType || 'text',
      minLength: options.minLength,
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      resolve,
    })
  }), [])

  const closeDialog = useCallback((result) => {
    dialog?.resolve?.(result)
    setDialog(null)
    setBusy(false)
  }, [dialog])

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      const timer = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [dialog])

  const value = useMemo(() => ({ toast, notify, confirm, prompt }), [toast, notify, confirm, prompt])

  const isPrompt = dialog?.kind === 'prompt'
  const promptTooShort = isPrompt && dialog.minLength ? promptValue.trim().length < dialog.minLength : false

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div key={item.id} className={`app-toast app-toast-${item.type}`} role={item.type === 'error' ? 'alert' : 'status'}>
            <i className={`${TOAST_ICONS[item.type] || TOAST_ICONS.info} app-toast-icon`} />
            <span className="app-toast-message">{item.message}</span>
            <button type="button" className="btn btn-sm app-toast-close" onClick={() => dismiss(item.id)} aria-label="Fechar aviso">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => closeDialog(isPrompt ? null : false)}
        title={dialog?.title}
        titleIcon={dialog?.titleIcon}
        width="min(460px, 92vw)"
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => closeDialog(isPrompt ? null : false)}>
              {dialog?.cancelLabel || 'Cancelar'}
            </button>
            <button
              type="button"
              className={`btn ${dialog?.danger ? 'btn-danger' : 'btn-primary'}`}
              disabled={busy || promptTooShort}
              onClick={() => closeDialog(isPrompt ? promptValue : true)}
            >
              {dialog?.confirmLabel || 'Confirmar'}
            </button>
          </>
        )}
      >
        {dialog?.message && <p className="mb-2">{dialog.message}</p>}
        {isPrompt && (
          <>
            {dialog.label && <label className="form-label" htmlFor="ui-prompt-input">{dialog.label}</label>}
            <div className="input-group">
              <input
                id="ui-prompt-input"
                ref={inputRef}
                className="form-control"
                type={showPromptValue ? 'text' : dialog.inputType}
                value={promptValue}
                placeholder={dialog.placeholder}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !promptTooShort) {
                    event.preventDefault()
                    closeDialog(promptValue)
                  }
                }}
              />
              {dialog.inputType === 'password' && (
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPromptValue((v) => !v)} aria-label={showPromptValue ? 'Ocultar' : 'Mostrar'}>
                  <i className={`fa-solid ${showPromptValue ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              )}
            </div>
            {dialog.minLength ? <small className="text-muted d-block mt-1">Mínimo de {dialog.minLength} caracteres.</small> : null}
          </>
        )}
      </Modal>
    </UIContext.Provider>
  )
}
