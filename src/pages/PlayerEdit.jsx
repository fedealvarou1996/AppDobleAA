import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function PlayerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando jugador:', error);
        setErrorMessage('No se pudo cargar el jugador.');
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage('No se encontró el jugador.');
        setLoading(false);
        return;
      }

      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        dni: data.dni || '',
        birth_date: data.birth_date || '',
        category: data.category || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        payment_status: Boolean(data.payment_status),
        last_payment_date: data.last_payment_date || '',
        notes: data.notes || '',
      });

      setLoading(false);
    }

    loadPlayer();
  }, [id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setErrorMessage('');

    const payload = {
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
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('players')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando jugador:', error);
      setErrorMessage('No se pudo actualizar el jugador.');
      setSaving(false);
      return;
    }

    navigate('/players');
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando jugador...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Editar jugador</h1>
          <p>Modificá los datos del atleta.</p>
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
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlayerEdit;