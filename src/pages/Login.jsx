import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

function Login() {
  const {
    loading: authLoading,
    isAuthenticated,
    profileLoaded,
    isAdmin,
    isPlayer,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!authLoading && isAuthenticated) {
    if (!profileLoaded) {
      return (
        <div className="page-center">
          <div className="loading-card">
            <strong>Cargando perfil...</strong>
          </div>
        </div>
      );
    }

    if (isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }

    if (isPlayer) {
      return <Navigate to="/my-profile" replace />;
    }

    return <Navigate to="/unauthorized" replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error('Error de login:', error);
      setMessage('Email o contrasena incorrectos. Revisa los datos e intenta de nuevo.');
      setLoading(false);
      return;
    }

    setMessage('Inicio de sesion correcto. Redirigiendo...');
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-badge">AA</div>
        <h1>Asociacion de Atletas</h1>
        <p className="auth-subtitle">Ingreso al sistema</p>

        <form onSubmit={handleLogin} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            type="password"
            placeholder="Tu contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}
      </section>
    </main>
  );
}

export default Login;
