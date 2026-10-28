import React from 'react';

export default function Toast({ type = 'success', children }) {
  return <div className={`toast toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}
