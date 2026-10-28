import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function EmptyState({ title, description, action, to, children }) {
  return <section className="empty-state"><span className="empty-state-mark"><Icon name="dashboard" /></span><h2>{title}</h2><p>{description}</p>{children}{action && to ? <Link className="btn" to={to}>{action}</Link> : null}</section>;
}
