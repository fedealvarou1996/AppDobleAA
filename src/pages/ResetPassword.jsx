import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import appLogo from '../assets/aa-logo.svg';

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function ensureRecoverySession() {
      setErrorMessage('');

      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error creando sesion de recuperacion:', error);
          setErrorMessage('El enlace de recuperacion es invalido o vencio.');
          setReady(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        setErrorMessage('El enlace de recuperacion es invalido o vencio.');
        setReady(false);
        return;
      }

      setReady(true);
    }

    ensureRecoverySession();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setMessage('');

    if (!password || password.length < 6) {
      setErrorMessage('La contrasena debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contrasenas no coinciden.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Error actualizando contrasena:', error);
      setErrorMessage(error.message || 'No se pudo actualizar la contrasena.');
      setLoading(false);
      return;
    }

    setMessage('Contrasena actualizada correctamente. Redirigiendo al login...');
    setLoading(false);

    await supabase.auth.signOut();
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 1200);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-badge">
          <img src={appLogo} alt="Logo Asociacion de Atletas" />
        </div>
        <h1>Nueva contrasena</h1>
        <p className="auth-subtitle">Define una nueva contrasena para tu cuenta.</p>

        {!ready ? (
          <>
            {errorMessage ? (
              <p className="auth-message auth-message-error">{errorMessage}</p>
            ) : (
              <p className="auth-message">Validando enlace de recuperacion...</p>
            )}
            <p className="auth-switch">
              <Link to="/forgot-password">Solicitar nuevo enlace</Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="auth-form">
              <label htmlFor="password">Nueva contrasena</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />

              <label htmlFor="confirmPassword">Confirmar contrasena</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Actualizar contrasena'}
              </button>
            </form>

            {errorMessage && <p className="auth-message auth-message-error">{errorMessage}</p>}
            {message && <p className="auth-message auth-message-success">{message}</p>}
          </>
        )}
      </section>
    </main>
  );
}

export default ResetPassword;
