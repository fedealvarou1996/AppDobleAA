import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PlayerRegister from './pages/PlayerRegister';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';
import PlayersList from './pages/PlayersList';
import PlayerForm from './pages/PlayerForm';
import PlayerEdit from './pages/PlayerEdit';
import PlayerDetail from './pages/PlayerDetail';
import MyPlayerProfile from './pages/MyPlayerProfile';
import VerifyPlayerProfile from './pages/VerifyPlayerProfile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function HomeRedirect() {
  const { loading, profileLoaded, user, isAdmin, isPlayer } = useAuth();

  if (loading || (user && !profileLoaded)) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando sesion...</strong>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isPlayer) {
    return <Navigate to="/my-profile" replace />;
  }

  return <Navigate to="/unauthorized" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register" element={<PlayerRegister />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/verify/:id" element={<VerifyPlayerProfile />} />

      <Route
        path="/my-profile"
        element={
          <ProtectedRoute requirePlayer>
            <MyPlayerProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireAdmin>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/players/new"
        element={
          <ProtectedRoute requireAdmin>
            <PlayerForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/players"
        element={
          <ProtectedRoute requireAdmin>
            <PlayersList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/players/:id"
        element={
          <ProtectedRoute requireAdmin>
            <PlayerDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/players/:id/edit"
        element={
          <ProtectedRoute requireAdmin>
            <PlayerEdit />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
