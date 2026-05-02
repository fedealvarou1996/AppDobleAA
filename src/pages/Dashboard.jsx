import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user, profile, isAdmin, signOut } = useAuth();

  async function handleLogout() {
    try {
      await signOut();
    } catch {
      alert('No se pudo cerrar sesión. Probá nuevamente.');
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h1>Asociación de Atletas</h1>
          <p className="muted">Sesión iniciada correctamente.</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <section className="dashboard-grid">
        <article className="info-card">
          <h2>Usuario</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Rol:</strong> {profile?.role ?? 'Sin rol cargado'}</p>
          <p><strong>Permisos admin:</strong> {isAdmin ? 'Sí' : 'No'}</p>
        </article>

        <article className="info-card">
          <h2>Próximo módulo</h2>
          <p>
            El siguiente paso es crear el ABM de jugadores: listado, alta, edición,
            búsqueda, filtros y subida de foto al bucket privado <strong>player-photos</strong>.
          </p>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
