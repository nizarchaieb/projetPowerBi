import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../api';

export default function ProtectedRoute({ children, role }) {
  if (!getToken() || !getUser()) return <Navigate to="/login" replace />;
  if (role && getUser().role !== role) {
    return <Navigate to={getUser().role === 'admin' ? '/admin' : '/bi'} replace />;
  }
  return children;
}
