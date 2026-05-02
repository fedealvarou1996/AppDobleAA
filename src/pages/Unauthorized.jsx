import { Link } from 'react-router-dom';

function Unauthorized() {
  return (
    <main className="center-screen">
      <section className="status-card">
        <h1>Acceso no autorizado</h1>
        <p>Tu usuario inició sesión, pero no tiene permisos de administrador.</p>
        <Link className="link-button" to="/dashboard">Volver al panel</Link>
      </section>
    </main>
  );
}

export default Unauthorized;
