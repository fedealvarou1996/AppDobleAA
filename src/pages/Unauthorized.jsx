import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function Unauthorized() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  async function handleBackToLogin() {
    try {
      await signOut();
    } catch (error) {
      console.error('No se pudo cerrar sesion desde unauthorized:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <main className="center-screen">
      <section className="status-card">
        <h1>Acceso no autorizado</h1>
        <p>Tu usuario inicio sesion, pero no tiene permisos de administrador.</p>
        <button type="button" className="link-button" onClick={handleBackToLogin}>
          Volver al login
        </button>
      </section>
    </main>
  );
}

export default Unauthorized;

