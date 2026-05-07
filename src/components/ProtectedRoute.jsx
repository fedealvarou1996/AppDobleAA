import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({
  children,
  requireAdmin = false,
  requirePlayer = false,
}) {
  const { loading, user, profileLoaded, isAdmin, isPlayer } = useAuth();

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando sesión...</strong>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if ((requireAdmin || requirePlayer) && !profileLoaded) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando perfil...</strong>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requirePlayer && !isPlayer) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default ProtectedRoute;
