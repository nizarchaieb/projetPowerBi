import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, setSession } from '../api';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      setSession(result);
      navigate(result.user.role === 'admin' ? '/admin' : '/workspace', { replace: true });
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Échec de la connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <span className="eyebrow">VOTRE ESPACE PROFESSIONNEL</span>
        <h1>Bienvenue dans votre espace de pilotage.</h1>
        <p>Connectez-vous pour importer vos fichiers CSV et retrouver vos rapports privés. Les dashboards de démonstration sont accessibles sans compte.</p>
        <div className="auth-promise"><span>✓</span> Connexion sécurisée · Accès personnalisé selon votre profil</div>
      </section>
      <section className="form-box auth-card">
        <span className="eyebrow">ESPACE SÉCURISÉ</span>
        <h2>Connexion</h2>
        <p className="subtitle">Utilisez les identifiants associés à votre compte.</p>
        {error ? <div className="alert error" role="alert">{error}</div> : null}
        <form onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="email">Adresse email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="password">Mot de passe</label>
            <PasswordInput id="password" label="Mot de passe" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button type="submit" className="btn auth-submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="auth-switch">Pas encore de compte ? <Link to="/register">Demander un accès</Link></p>
      </section>
    </div>
  );
}
