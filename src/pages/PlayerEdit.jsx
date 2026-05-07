import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  isFutureDate,
  isValidEmail,
  isValidUuid,
  normalizeText,
  PLAYER_CATEGORIES,
} from '../utils/playerValidations';

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
    user_id: '',
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
        setErrorMessage('No se encontro el jugador.');
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
        user_id: data.user_id || '',
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

  async function validateForm() {
    const firstName = normalizeText(formData.first_name);
    const lastName = normalizeText(formData.last_name);
    const dni = normalizeText(formData.dni);
    const email = normalizeText(formData.email);
    const category = normalizeText(formData.category);
    const userId = normalizeText(formData.user_id);

    if (!firstName) {
      setErrorMessage('El nombre es obligatorio.');
      return false;
    }

    if (!lastName) {
      setErrorMessage('El apellido es obligatorio.');
      return false;
    }

    if (!dni) {
      setErrorMessage('El DNI es obligatorio.');
      return false;
    }

    if (!category) {
      setErrorMessage('La categoria es obligatoria.');
      return false;
    }

    if (email && !isValidEmail(email)) {
      setErrorMessage('El email no tiene un formato valido.');
      return false;
    }

    if (userId && !isValidUuid(userId)) {
      setErrorMessage('El ID de usuario vinculado no tiene un formato valido.');
      return false;
    }

    if (formData.birth_date && isFutureDate(formData.birth_date)) {
      setErrorMessage('La fecha de nacimiento no puede ser futura.');
      return false;
    }

    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('dni', dni)
      .neq('id', id)
      .limit(1);

    if (error) {
      console.error('Error validando DNI:', error);
      setErrorMessage('No se pudo validar el DNI. Intenta nuevamente.');
      return false;
    }

    if (data && data.length > 0) {
      setErrorMessage('Ya existe otro jugador con ese DNI.');
      return false;
    }

    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSaving(true);
    setErrorMessage('');

    const isValid = await validateForm();

    if (!isValid) {
      setSaving(false);
      return;
    }

    const payload = {
      first_name: normalizeText(formData.first_name),
      last_name: normalizeText(formData.last_name),
      dni: normalizeText(formData.dni),
      birth_date: formData.birth_date || null,
      category: normalizeText(formData.category),
      phone: normalizeText(formData.phone) || null,
      email: normalizeText(formData.email) || null,
      address: normalizeText(formData.address) || null,
      user_id: normalizeText(formData.user_id) || null,
      payment_status: formData.payment_status,
      last_payment_date: formData.last_payment_date || null,
      notes: normalizeText(formData.notes) || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('players').update(payload).eq('id', id);

    if (error) {
      console.error('Error actualizando jugador:', error);

      if (error.code === '23505') {
        setErrorMessage('Ya existe un jugador con ese DNI.');
      } else {
        setErrorMessage('No se pudo actualizar el jugador.');
      }

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
          <p>Modifica los datos del atleta.</p>
        </div>

        <button className="secondary-button" onClick={() => navigate('/players')}>
          Volver
        </button>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Nombre</label>
            <input name="first_name" value={formData.first_name} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>Apellido</label>
            <input name="last_name" value={formData.last_name} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>DNI</label>
            <input name="dni" value={formData.dni} onChange={handleChange} />
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
            <label>Categoria</label>
            <select name="category" value={formData.category} onChange={handleChange}>
              <option value="">Seleccionar categoria</option>
              {PLAYER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Telefono</label>
            <input name="phone" value={formData.phone} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>Email</label>
            <input type="text" name="email" value={formData.email} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>Direccion</label>
            <input name="address" value={formData.address} onChange={handleChange} />
          </div>

          <div className="form-field">
            <label>ID usuario vinculado</label>
            <input
              type="text"
              name="user_id"
              placeholder="UUID del usuario player"
              value={formData.user_id}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Ultimo pago</label>
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
              Cuota al dia
            </label>
          </div>
        </div>

        <div className="form-field">
          <label>Notas</label>
          <textarea name="notes" rows="4" value={formData.notes} onChange={handleChange} />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/players')}
          >
            Cancelar
          </button>

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlayerEdit;
