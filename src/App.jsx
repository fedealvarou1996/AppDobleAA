import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/useAuth';

const Login = lazy(() => import('./pages/Login'));
const PlayerRegister = lazy(() => import('./pages/PlayerRegister'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const PlayersList = lazy(() => import('./pages/PlayersList'));
const PlayerForm = lazy(() => import('./pages/PlayerForm'));
const PlayerEdit = lazy(() => import('./pages/PlayerEdit'));
const PlayerDetail = lazy(() => import('./pages/PlayerDetail'));
const MyPlayerProfile = lazy(() => import('./pages/MyPlayerProfile'));
const VerifyPlayerProfile = lazy(() => import('./pages/VerifyPlayerProfile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

function PageFallback() {
  return (
    <div className="page-center">
      <div className="loading-card">
        <strong>Cargando pantalla...</strong>
      </div>
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}

export default App;
