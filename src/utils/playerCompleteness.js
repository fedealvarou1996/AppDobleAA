function hasValue(value) {
  return Boolean(String(value || '').trim());
}

export function getPlayerCompleteness(player, teamNames = [], options = {}) {
  const missingFields = [];
  const { requireTeam = true } = options;

  if (!hasValue(player?.photo_url) && !hasValue(player?.photo_thumb_url)) {
    missingFields.push('foto');
  }

  if (!hasValue(player?.dni)) {
    missingFields.push('DNI');
  }

  if (!hasValue(player?.birth_date)) {
    missingFields.push('fecha de nacimiento');
  }

  if (!hasValue(player?.category)) {
    missingFields.push('categoria');
  }

  if (!hasValue(player?.phone)) {
    missingFields.push('telefono');
  }

  if (!hasValue(player?.email)) {
    missingFields.push('email');
  }

  if (!hasValue(player?.address)) {
    missingFields.push('direccion');
  }

  if (requireTeam && !teamNames.length) {
    missingFields.push('equipo');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    label: missingFields.length === 0 ? 'Completo' : 'Incompleto',
  };
}
