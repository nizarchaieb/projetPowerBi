import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, setToken } from '../../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      setToken(res.token);
      navigate('/admin');
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Échec de la connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="form-box">
        <h1>Connexion administrateur</h1>
        <p className="subtitle">Accès réservé à l’administrateur du site.</p>
        {error ? <div className="alert error">{error}</div> : null}
        <form onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
    </div>
  );
}
