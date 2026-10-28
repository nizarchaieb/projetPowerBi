import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api';
import PasswordInput from '../components/PasswordInput';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      setPending(true);
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Impossible d’envoyer la demande. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <span className="eyebrow">ESPACE CLIENT</span>
        <h1>Demandez votre accès à VentePilot.</h1>
        <p>Créez votre compte professionnel. Après validation, importez vos fichiers CSV et consultez vos dashboards, analyses et rapports personnels.</p>
        <div className="auth-promise"><span>✓</span> Vos données restent protégées jusqu’à validation.</div>
      </section>
      <section className="form-box auth-card">
        {pending ? (
          <div className="pending-state">
            <div className="pending-icon">✓</div>
            <span className="eyebrow">DEMANDE ENVOYÉE</span>
            <h2>Votre demande est en attente.</h2>
            <p>L’administrateur doit approuver votre compte avant votre première connexion. Vous pourrez vous connecter une fois l’accès activé.</p>
            <Link className="btn" to="/login">Retour à la connexion</Link>
          </div>
        ) : (
          <>
            <span className="eyebrow">NOUVEAU COMPTE</span>
            <h2>Demander un accès</h2>
            <p className="subtitle">Tous les champs sont requis. Mot de passe : 8 caractères minimum.</p>
            {error ? <div className="alert error" role="alert">{error}</div> : null}
            <form onSubmit={submit}>
              <div className="form-field">
                <label htmlFor="name">Nom complet</label>
                <input id="name" name="name" autoComplete="name" value={form.name} onChange={update} required maxLength={255} />
              </div>
              <div className="form-field">
                <label htmlFor="email">Adresse email professionnelle</label>
                <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required maxLength={255} />
              </div>
              <div className="form-field">
                <label htmlFor="password">Mot de passe</label>
                <PasswordInput id="password" label="Mot de passe" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} showStrength />
              </div>
              <button type="submit" className="btn auth-submit" disabled={loading}>{loading ? 'Envoi…' : 'Envoyer ma demande'}</button>
            </form>
            <p className="auth-switch">Vous avez déjà un compte ? <Link to="/login">Se connecter</Link></p>
          </>
        )}
      </section>
    </div>
  );
}
