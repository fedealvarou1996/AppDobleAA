import { supabase } from '../lib/supabaseClient';
import { PLAYER_PHOTO_BUCKET } from './playerPhotoUpload';

function extractPath(storedValue) {
  if (!storedValue) return '';

  if (!storedValue.startsWith('http')) {
    return storedValue;
  }

  const publicMarker = `/storage/v1/object/public/${PLAYER_PHOTO_BUCKET}/`;
  const signMarker = `/storage/v1/object/sign/${PLAYER_PHOTO_BUCKET}/`;
  const authMarker = `/storage/v1/object/authenticated/${PLAYER_PHOTO_BUCKET}/`;

  const marker = [publicMarker, signMarker, authMarker].find((value) =>
    storedValue.includes(value)
  );

  if (!marker) return '';

  const encodedPath = storedValue.split(marker)[1]?.split('?')[0] || '';
  return decodeURIComponent(encodedPath);
}

export async function resolvePlayerPhotoUrl(storedValue) {
  if (!storedValue) return '';

  const path = extractPath(storedValue);
  if (!path) return storedValue;

  const { data, error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (error || !data?.signedUrl) {
    return storedValue;
  }

  return data.signedUrl;
}
