import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'

const UIContext = createContext(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI deve ser usado dentro de <UIProvider>')
  return ctx
}

const TOAST_ICONS = {
  success: 'circleCheck',
  error: 'circleAlert',
  warning: 'triangleAlert',
  info: 'info',
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
    setToasts((current) => [...current, {
      id,
      message,
      type: options.type || 'info',
      onClick: typeof options.onClick === 'function' ? options.onClick : undefined,
    }])
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
      titleIcon: options.titleIcon || (options.danger ? 'triangleAlert' : 'circleHelp'),
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
      titleIcon: options.titleIcon || 'keyboard',
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
        {toasts.map((item) => {
          const activate = item.onClick
            ? () => {
                item.onClick()
                dismiss(item.id)
              }
            : undefined
          return (
            <div
              key={item.id}
              className={`app-toast app-toast-${item.type}${activate ? ' is-clickable' : ''}`}
              role={activate ? 'button' : item.type === 'error' ? 'alert' : 'status'}
              tabIndex={activate ? 0 : undefined}
              onClick={activate}
              onKeyDown={activate ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activate()
                }
              } : undefined}
            >
              <Icon name={TOAST_ICONS[item.type] || TOAST_ICONS.info} className="app-toast-icon" size={18} />
              <span className="app-toast-message">{item.message}</span>
              <button
                type="button"
                className="app-toast-close"
                onClick={(event) => {
                  event.stopPropagation()
                  dismiss(item.id)
                }}
                aria-label="Fechar aviso"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )
        })}
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => closeDialog(isPrompt ? null : false)}
        title={dialog?.title}
        titleIcon={dialog?.titleIcon}
        width="min(460px, 92vw)"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => closeDialog(isPrompt ? null : false)}>
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
        {dialog?.message && <p style={{ marginBottom: 8 }}>{dialog.message}</p>}
        {isPrompt && (
          <>
            {dialog.label && <label className="field-label" htmlFor="ui-prompt-input">{dialog.label}</label>}
            <div className="input-row">
              <input
                id="ui-prompt-input"
                ref={inputRef}
                className="input"
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
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => setShowPromptValue((v) => !v)} aria-label={showPromptValue ? 'Ocultar' : 'Mostrar'}>
                  <Icon name={showPromptValue ? 'eyeOff' : 'eye'} />
                </button>
              )}
            </div>
            {dialog.minLength ? <p className="muted small" style={{ marginTop: 8 }}>Mínimo de {dialog.minLength} caracteres.</p> : null}
          </>
        )}
      </Modal>
    </UIContext.Provider>
  )
}
