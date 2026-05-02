import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';
import PlayersList from './pages/PlayersList';
import PlayerForm from './pages/PlayerForm';
import PlayerEdit from './pages/PlayerEdit';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

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
          path="/players/:id/edit"
          element={
            <ProtectedRoute requireAdmin>
              <PlayerEdit />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;