import React, { useState } from 'react';
import { changePassword, getUser } from '../api';

export default function ProfileSettings() {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const initials = String(user?.name || user?.email || 'VP')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('fr-FR'))
    .join('');

  async function submitPassword(event) {
    event.preventDefault();
    setNotice(''); setError('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice('Le mot de passe a été modifié.');
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de modifier le mot de passe.');
    } finally { setSaving(false); }
  }

  return (
    <section className="page profile-settings-page">
      <div className="profile-settings-heading">
        <span className="eyebrow">COMPTE ET PRÉFÉRENCES</span>
        <h1>Profil et paramètres</h1>
        <p className="subtitle">Consultez les informations de votre compte et son niveau d’accès.</p>
      </div>

      <section className="profile-card">
        <div className="profile-card-heading">
          <span className="profile-avatar" aria-hidden="true">{initials}</span>
          <div>
            <h2>{user?.name || 'Utilisateur VentePilot'}</h2>
            <p>{isAdmin ? 'Administrateur' : 'Compte utilisateur'}</p>
          </div>
          <span className="profile-status"><i /> Compte connecté</span>
        </div>
        <div className="profile-details">
          <div className="profile-detail"><span>Nom</span><strong>{user?.name || 'Non renseigné'}</strong></div>
          <div className="profile-detail"><span>Adresse e-mail</span><strong>{user?.email || 'Non renseignée'}</strong></div>
          <div className="profile-detail"><span>Type de compte</span><strong>{isAdmin ? 'Administrateur' : 'Utilisateur'}</strong></div>
        </div>
      </section>

      <section className="profile-security-card">
        <div className="profile-security-icon" aria-hidden="true">♧</div>
        <div>
          <h2>Accès et sécurité</h2>
          <p>
            {isAdmin
              ? 'Votre compte dispose des droits de gestion de la plateforme.'
              : 'Votre espace BI est privé. Vos fichiers et rapports restent associés à votre compte.'}
          </p>
          <small>Vous pouvez changer votre mot de passe ci-dessous. Pour un mot de passe oublié, demandez une réinitialisation à l’administrateur.</small>
        </div>
      </section>

      <section className="profile-card profile-password-card">
        <h2>Changer le mot de passe</h2>
        {error ? <div className="alert error" role="alert">{error}</div> : null}
        {notice ? <div className="alert success" role="status">{notice}</div> : null}
        <form onSubmit={submitPassword} className="admin-insight-form">
          <div className="form-field"><label htmlFor="current-password">Mot de passe actuel</label><input id="current-password" type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
          <div className="admin-row">
            <div className="form-field"><label htmlFor="new-password">Nouveau mot de passe</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}</button>
        </form>
      </section>
    </section>
  );
}
