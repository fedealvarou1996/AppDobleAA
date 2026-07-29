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
import {
  removePlayerPhotoSet,
  uploadPlayerPhoto,
  validatePlayerPhoto,
} from '../utils/playerPhotoUpload';

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
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [existingPhotoThumbUrl, setExistingPhotoThumbUrl] = useState('');
  const [teams, setTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [initialTeamIds, setInitialTeamIds] = useState([]);

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setErrorMessage('');

      const [
        { data, error },
        { data: teamsData, error: teamsError },
        { data: playerTeamsData, error: playerTeamsError },
      ] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('teams')
          .select('id, name, slug, is_active')
          .order('name', { ascending: true }),
        supabase.from('player_teams').select('team_id').eq('player_id', id),
      ]);

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

      if (teamsError) {
        console.error('Error cargando equipos:', teamsError);
        setErrorMessage('No se pudieron cargar los equipos.');
      } else {
        setTeams((teamsData || []).filter((team) => team.is_active !== false));
      }

      if (playerTeamsError) {
        console.error('Error cargando equipos del jugador:', playerTeamsError);
        setErrorMessage('No se pudieron cargar los equipos del jugador.');
      } else {
        const loadedTeamIds = (playerTeamsData || []).map((playerTeam) => playerTeam.team_id);
        setSelectedTeamIds(loadedTeamIds);
        setInitialTeamIds(loadedTeamIds);
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
      setPhotoPreviewUrl(data.photo_url || '');
      setExistingPhotoUrl(data.photo_url || '');
      setExistingPhotoThumbUrl(data.photo_thumb_url || '');

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

  function handleTeamToggle(teamId) {
    setSelectedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((currentTeamId) => currentTeamId !== teamId)
        : [...current, teamId]
    );
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoFile(null);
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

    let uploadedPhotoUrl = existingPhotoUrl || null;
    let uploadedPhotoThumbUrl = existingPhotoThumbUrl || null;
    if (photoFile) {
      try {
        const uploadResult = await uploadPlayerPhoto(photoFile, id);
        uploadedPhotoUrl = uploadResult.publicUrl;
        uploadedPhotoThumbUrl = uploadResult.thumbPublicUrl;
      } catch (photoError) {
        setErrorMessage(photoError.message || 'No se pudo subir la foto.');
        setSaving(false);
        return;
      }
    }

    const previousPhotoUrl = existingPhotoUrl || null;
    const previousPhotoThumbUrl = existingPhotoThumbUrl || null;
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
      photo_url: uploadedPhotoUrl,
      photo_thumb_url: uploadedPhotoThumbUrl,
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

    const initialTeamSet = new Set(initialTeamIds);
    const selectedTeamSet = new Set(selectedTeamIds);
    const teamsToAdd = selectedTeamIds.filter((teamId) => !initialTeamSet.has(teamId));
    const teamsToRemove = initialTeamIds.filter((teamId) => !selectedTeamSet.has(teamId));

    if (teamsToAdd.length > 0) {
      const rows = teamsToAdd.map((teamId) => ({
        player_id: id,
        team_id: teamId,
      }));
      const { error: addTeamsError } = await supabase.from('player_teams').upsert(rows, {
        onConflict: 'player_id,team_id',
        ignoreDuplicates: true,
      });

      if (addTeamsError) {
        console.error('Error agregando equipos:', addTeamsError);
        setErrorMessage('Se guardo el jugador, pero no se pudieron agregar los equipos.');
        setSaving(false);
        return;
      }
    }

    if (teamsToRemove.length > 0) {
      const { error: removeTeamsError } = await supabase
        .from('player_teams')
        .delete()
        .eq('player_id', id)
        .in('team_id', teamsToRemove);

      if (removeTeamsError) {
        console.error('Error quitando equipos:', removeTeamsError);
        setErrorMessage('Se guardo el jugador, pero no se pudieron quitar los equipos.');
        setSaving(false);
        return;
      }
    }

    if (photoFile && previousPhotoUrl && previousPhotoUrl !== uploadedPhotoUrl) {
      await removePlayerPhotoSet(previousPhotoUrl, previousPhotoThumbUrl);
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

          <div className="form-field teams-field">
            <label>Equipos</label>
            <div className="teams-checkbox-list">
              {teams.length === 0 ? (
                <span className="muted">No hay equipos disponibles.</span>
              ) : (
                teams.map((team) => (
                  <label key={team.id}>
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() => handleTeamToggle(team.id)}
                    />
                    {team.name}
                  </label>
                ))
              )}
            </div>
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

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlayerEdit;
