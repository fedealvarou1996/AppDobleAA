import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/useAuth';
import {
  isFutureDate,
  isValidEmail,
  isValidUuid,
  normalizeText,
  PLAYER_CATEGORIES,
} from '../utils/playerValidations';
import { uploadPlayerPhoto, validatePlayerPhoto } from '../utils/playerPhotoUpload';

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
    user_id: '',
    payment_status: false,
    last_payment_date: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      return;
    }

    const photoValidationMessage = validatePlayerPhoto(file);
    if (photoValidationMessage) {
      setErrorMessage(photoValidationMessage);
      event.target.value = '';
      return;
    }

    setErrorMessage('');
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
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
      .limit(1);

    if (error) {
      console.error('Error validando DNI:', error);
      setErrorMessage('No se pudo validar el DNI. Intenta nuevamente.');
      return false;
    }

    if (data && data.length > 0) {
      setErrorMessage('Ya existe un jugador con ese DNI.');
      return false;
    }

    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage('');

    const isValid = await validateForm();

    if (!isValid) {
      setLoading(false);
      return;
    }

    let uploadedPhotoUrl = null;
    let payloadPhotoThumbUrl = null;
    if (photoFile) {
      try {
        const uploadResult = await uploadPlayerPhoto(photoFile, user.id);
        uploadedPhotoUrl = uploadResult.publicUrl;
        payloadPhotoThumbUrl = uploadResult.thumbPublicUrl;
      } catch (photoError) {
        setErrorMessage(photoError.message || 'No se pudo subir la foto.');
        setLoading(false);
        return;
      }
    }

    const payload = {
      profile_id: user.id,
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
      photo_url: uploadedPhotoUrl,
      photo_thumb_url: payloadPhotoThumbUrl || null,
    };

    const { error } = await supabase.from('players').insert(payload);

    if (error) {
      console.error('Error creando jugador:', error);

      if (error.code === '23505') {
        setErrorMessage('Ya existe un jugador con ese DNI.');
      } else {
        setErrorMessage('No se pudo crear el jugador. Revisa los datos o permisos.');
      }

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
          <p>Carga los datos principales del atleta.</p>
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
          <label>Foto del jugador</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
          {photoPreviewUrl && (
            <img className="player-photo-preview" src={photoPreviewUrl} alt="Vista previa del jugador" />
          )}
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

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar jugador'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlayerForm;

