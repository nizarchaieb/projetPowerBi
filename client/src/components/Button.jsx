import React, { forwardRef } from 'react';

const VARIANTS = { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost', danger: 'button-danger' };

const Button = forwardRef(function Button({ variant = 'primary', loading = false, disabled = false, className = '', type = 'button', children, ...props }, ref) {
  return <button ref={ref} type={type} className={`button ${VARIANTS[variant] || VARIANTS.primary} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? <span className="button-spinner" aria-hidden="true" /> : null}{children}</button>;
});

export default Button;
