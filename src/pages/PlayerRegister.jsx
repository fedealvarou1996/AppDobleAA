import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  isFutureDate,
  isValidEmail,
  normalizeText,
  PLAYER_CATEGORIES,
} from '../utils/playerValidations';
import appLogo from '../assets/logo.svg';

function PlayerRegister() {
  const navigate = useNavigate();
  const {
    loading: authLoading,
    isAuthenticated,
    profileLoaded,
    isAdmin,
    isPlayer,
  } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    birth_date: '',
    category: '',
    phone: '',
    email: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function validateForm() {
    const firstName = normalizeText(formData.first_name);
    const lastName = normalizeText(formData.last_name);
    const dni = normalizeText(formData.dni);
    const email = normalizeText(formData.email);
    const category = normalizeText(formData.category);

    if (!firstName) return 'El nombre es obligatorio.';
    if (!lastName) return 'El apellido es obligatorio.';
    if (!dni) return 'El DNI es obligatorio.';
    if (!email) return 'El email es obligatorio.';
    if (!isValidEmail(email)) return 'El email no tiene un formato valido.';
    if (!category) return 'La categoria es obligatoria.';
    if (formData.birth_date && isFutureDate(formData.birth_date)) {
      return 'La fecha de nacimiento no puede ser futura.';
    }
    if (!formData.password || formData.password.length < 6) {
      return 'La contrasena debe tener al menos 6 caracteres.';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Las contrasenas no coinciden.';
    }

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    const validationMessage = validateForm();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      setLoading(false);
      return;
    }

    const email = normalizeText(formData.email);
    const dni = normalizeText(formData.dni);
    const password = formData.password;

    const { data: existingPlayer, error: existingPlayerError } = await supabase
      .from('players')
      .select('id')
      .eq('dni', dni)
      .limit(1);

    if (existingPlayerError) {
      console.error('Error validando DNI existente:', existingPlayerError);
      setErrorMessage('No se pudo validar el DNI. Intenta nuevamente.');
      setLoading(false);
      return;
    }

    if (existingPlayer && existingPlayer.length > 0) {
      setErrorMessage('Ya existe un jugador con ese DNI.');
      setLoading(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'player',
          first_name: normalizeText(formData.first_name),
          last_name: normalizeText(formData.last_name),
          dni,
          birth_date: formData.birth_date || null,
          category: normalizeText(formData.category),
          phone: normalizeText(formData.phone) || null,
          address: normalizeText(formData.address) || null,
        },
      },
    });

    if (signUpError) {
      console.error('Error registrando usuario player:', signUpError);
      setErrorMessage(signUpError.message || 'No se pudo crear la cuenta.');
      setLoading(false);
      return;
    }

    const newUser = signUpData.user;

    if (!newUser?.id) {
      setErrorMessage('No se pudo obtener el usuario creado.');
      setLoading(false);
      return;
    }

    if (signUpData.session) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: newUser.id,
          role: 'player',
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        console.error('Error creando profile del jugador:', profileError);
        setErrorMessage(
          'La cuenta se creo, pero no se pudo preparar el perfil. Contacta al administrador.'
        );
        setLoading(false);
        return;
      }

      const { error: playerError } = await supabase.from('players').insert({
        profile_id: newUser.id,
        user_id: newUser.id,
        first_name: normalizeText(formData.first_name),
        last_name: normalizeText(formData.last_name),
        dni,
        birth_date: formData.birth_date || null,
        category: normalizeText(formData.category),
        phone: normalizeText(formData.phone) || null,
        email,
        address: normalizeText(formData.address) || null,
        payment_status: false,
        last_payment_date: null,
        notes: null,
      });

      if (playerError) {
        console.error('Error creando ficha del jugador:', playerError);
        setErrorMessage(
          'La cuenta se creo, pero no se pudo generar la ficha tecnica. Contacta al administrador.'
        );
        setLoading(false);
        return;
      }

      navigate('/my-profile', { replace: true });
      return;
    }

    setMessage(
      'Registro completado. Revisa tu email por favor. En caso que no lo encuentres, revisa Spam o Contacta al administrador para asistencia.'
    );
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-wide">
        <div className="brand-badge">
          <img src={appLogo} alt="Logo Asociacion de Atletas" />
        </div>
        <h1>Registro de jugador</h1>
        <p className="auth-subtitle">Crea tu cuenta y tu ficha tecnica personal.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-grid auth-form-grid">
            <div className="form-field">
              <label htmlFor="first_name">Nombre</label>
              <input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="last_name">Apellido</label>
              <input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="dni">DNI</label>
              <input id="dni" name="dni" value={formData.dni} onChange={handleChange} required />
            </div>

            <div className="form-field">
              <label htmlFor="birth_date">Fecha de nacimiento</label>
              <input
                id="birth_date"
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="category">Categoria</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar categoria</option>
                {PLAYER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="phone">Telefono</label>
              <input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="address">Direccion</label>
              <input id="address" name="address" value={formData.address} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label htmlFor="password">Contrasena</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirmar contrasena</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        {errorMessage && <p className="auth-message auth-message-error">{errorMessage}</p>}
        {message && <p className="auth-message auth-message-success">{message}</p>}

        <p className="auth-switch">
          Ya tenes cuenta? <Link to="/login">Ingresar</Link>
        </p>
      </section>
    </main>
  );
}

export default PlayerRegister;
