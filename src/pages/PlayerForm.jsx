import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

function PlayerForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    birth_date: '',
    category: '',
    phone: '',
    email: '',
    address: '',
    payment_status: false,
    last_payment_date: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage('');

    const payload = {
      profile_id: user.id,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      dni: formData.dni.trim(),
      birth_date: formData.birth_date || null,
      category: formData.category.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      payment_status: formData.payment_status,
      last_payment_date: formData.last_payment_date || null,
      notes: formData.notes.trim() || null,
    };

    const { error } = await supabase
      .from('players')
      .insert(payload);

    if (error) {
      console.error('Error creando jugador:', error);
      setErrorMessage('No se pudo crear el jugador. Revisá los datos o permisos.');
      setLoading(false);
      return;
    }

    navigate('/players');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Nuevo jugador</h1>
          <p>Cargá los datos principales del atleta.</p>
        </div>

        <button className="secondary-button" onClick={() => navigate('/players')}>
          Volver
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre</label>
            <input
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label>Apellido</label>
            <input
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label>DNI</label>
            <input
              name="dni"
              value={formData.dni}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Categoría</label>
            <input
              name="category"
              placeholder="Ej: Sub 18, Primera, Máster"
              value={formData.category}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Teléfono</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Dirección</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Último pago</label>
            <input
              type="date"
              name="last_payment_date"
              value={formData.last_payment_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-field checkbox-field">
            <label>
              <input
                type="checkbox"
                name="payment_status"
                checked={formData.payment_status}
                onChange={handleChange}
              />
              Cuota al día
            </label>
          </div>
        </div>

        <div className="form-field">
          <label>Notas</label>
          <textarea
            name="notes"
            rows="4"
            value={formData.notes}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/players')}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar jugador'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlayerForm;