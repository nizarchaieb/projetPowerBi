import React, { useState } from 'react';
import { sendMessage } from '../api';
import Toast from '../components/Toast';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ type: '', text: '' });
  const [sending, setSending] = useState(false);

  const update = (key, val) => setForm({ ...form, [key]: val });

  async function submit(e) {
    e.preventDefault();
    setStatus({ type: '', text: '' });
    setSending(true);
    try {
      await sendMessage(form);
      setStatus({ type: 'success', text: 'Message envoyé. Merci, je vous répondrai dès que possible.' });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus({ type: 'error', text: (err.response && err.response.data && err.response.data.error) || 'Échec de l’envoi. Réessayez plus tard.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <div className="form-box">
        <h1>Contact</h1>
        <p className="subtitle">Une question sur le projet VentePilot ? Envoyez un message — il sera lu depuis le panneau administrateur.</p>
        {status.text ? <Toast type={status.type}>{status.text}</Toast> : null}
        <form onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="name">Nom *</label>
            <input id="name" name="name" autoComplete="name" type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="email">Email *</label>
            <input id="email" name="email" autoComplete="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="subject">Sujet</label>
            <input id="subject" type="text" value={form.subject} onChange={(e) => update('subject', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="message">Message *</label>
            <textarea id="message" value={form.message} onChange={(e) => update('message', e.target.value)} required />
          </div>
          <button type="submit" className="btn" disabled={sending}>{sending ? 'Envoi…' : 'Envoyer'}</button>
        </form>
      </div>
    </div>
  );
}
