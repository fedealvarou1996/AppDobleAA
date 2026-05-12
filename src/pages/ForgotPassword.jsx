import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import appLogo from '../assets/logo.svg';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      console.error('Error solicitando recuperacion de contrasena:', error);
      setErrorMessage(error.message || 'No se pudo enviar el email de recuperacion.');
      setLoading(false);
      return;
    }

    setMessage('Te enviamos un email con instrucciones para recuperar tu contrasena.');
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-badge">
          <img src={appLogo} alt="Logo Asociacion de Atletas" />
        </div>
        <h1>Recuperar contrasena</h1>
        <p className="auth-subtitle">Ingresa tu email y te enviaremos un enlace de recuperacion.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        {errorMessage && <p className="auth-message auth-message-error">{errorMessage}</p>}
        {message && <p className="auth-message auth-message-success">{message}</p>}

        <p className="auth-switch">
          <Link to="/login">Volver al login</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;
