import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', danger = false, onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    confirmRef.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  if (!open) return null;
  async function confirm() {
    setBusy(true);
    try { await onConfirm(); onCancel(); }
    finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="dialog-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onKeyDown={(event) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-message">{message}</p>
      <div className="dialog-actions"><Button variant="secondary" onClick={onCancel} disabled={busy}>Annuler</Button><Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{confirmLabel}</Button></div>
    </section>
  </div>;
}
