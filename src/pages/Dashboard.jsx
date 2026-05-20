import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import appLogo from '../assets/logo.svg';

function Dashboard() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await signOut();
    } catch {
      alert('No se pudo cerrar sesion. Proba nuevamente.');
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <img className="dashboard-logo" src={appLogo} alt="Logo Asociacion de Atletas" />
          <p className="eyebrow">Panel administrativo</p>
          <h1>Asociacion de Atletas</h1>
          <p className="muted">Sesion iniciada correctamente.</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="info-card">
          <h2>Usuario</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Rol:</strong> {profile?.role ?? 'Sin rol cargado'}</p>
          <p><strong>Permisos admin:</strong> {isAdmin ? 'Si' : 'No'}</p>
        </article>

        <article className="info-card module-card">
          <h2>Modulo Jugadores</h2>
          <p>
            Administra el listado de atletas, altas, edicion, busqueda y filtros.
          </p>
          <div className="dashboard-actions button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/players')}
            >
              Gestionar jugadores
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/players/new')}
            >
              Nuevo jugador
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;

