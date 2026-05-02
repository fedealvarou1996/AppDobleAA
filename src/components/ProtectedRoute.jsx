import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { loading, user, profile, isAdmin } = useAuth();

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

  if (requireAdmin && !profile) {
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

  return children;
}

export default ProtectedRoute;