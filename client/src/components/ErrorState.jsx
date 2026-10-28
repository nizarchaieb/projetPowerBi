import React from 'react';
import Icon from './Icon';

export default function ErrorState({ title = 'Une erreur est survenue', message, onRetry, retryLabel = 'Réessayer' }) {
  return <section className="error-state" role="alert"><span className="empty-state-mark"><Icon name="history" /></span><h2>{title}</h2><p>{message}</p>{onRetry ? <button className="btn secondary" type="button" onClick={onRetry}>{retryLabel}</button> : null}</section>;
}
