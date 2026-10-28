import React, { useState } from 'react';

export default function PasswordInput({ id, label, value, onChange, autoComplete, required = true, minLength, maxLength, showStrength = false }) {
  const [visible, setVisible] = useState(false);
  const strength = [value.length >= 8, /[A-ZÀ-Þ]/.test(value) && /[a-zà-ÿ]/.test(value), /\d/.test(value), /[^\p{L}\d]/u.test(value)].filter(Boolean).length;
  const strengthLabel = ['À compléter', 'Faible', 'Moyen', 'Bon', 'Fort'][strength];
  return <>
    <div className="password-input-wrap"><input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} required={required} minLength={minLength} maxLength={maxLength} aria-describedby={showStrength ? `${id}-strength` : undefined} /><button type="button" className="password-visibility" onClick={() => setVisible(!visible)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{visible ? 'Masquer' : 'Afficher'}</button></div>
    {showStrength ? <div className="password-strength" id={`${id}-strength`} aria-live="polite"><span className="password-strength-meter" data-strength={strength}><i /></span><span>Robustesse : {strengthLabel}</span></div> : null}
  </>;
}
