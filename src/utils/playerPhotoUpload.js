import { supabase } from '../lib/supabaseClient';

export const PLAYER_PHOTO_BUCKET = 'player-photos';

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 1280;
const WEBP_QUALITY = 0.78;
const THUMB_MAX_DIMENSION = 320;
const THUMB_WEBP_QUALITY = 0.7;

function sanitizeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');
}

function extractPathFromPublicUrl(publicUrl) {
  if (!publicUrl) return '';
  if (!publicUrl.startsWith('http')) return publicUrl;

  const markers = [
    `/storage/v1/object/public/${PLAYER_PHOTO_BUCKET}/`,
    `/storage/v1/object/sign/${PLAYER_PHOTO_BUCKET}/`,
    `/storage/v1/object/authenticated/${PLAYER_PHOTO_BUCKET}/`,
  ];

  const marker = markers.find((value) => publicUrl.includes(value));
  if (!marker) return '';

  const encodedPath = publicUrl.split(marker)[1]?.split('?')[0] || '';
  return decodeURIComponent(encodedPath);
}

export function validatePlayerPhoto(file) {
  if (!file) return '';
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return 'Formato invalido. Usa JPG, PNG o WEBP.';
  }
  if (file.size > MAX_INPUT_PHOTO_SIZE_BYTES) {
    return 'La foto original supera el limite de 10MB.';
  }
  return '';
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo procesar la foto.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la foto.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

async function compressImageToWebp(file, maxDimension = MAX_DIMENSION, startQuality = WEBP_QUALITY) {
  const image = await readImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo preparar la compresion de imagen.');
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = startQuality;
  let outputBlob = await canvasToBlob(canvas, 'image/webp', quality);

  while (outputBlob.size > MAX_PHOTO_SIZE_BYTES && quality > 0.5) {
    quality -= 0.08;
    outputBlob = await canvasToBlob(canvas, 'image/webp', quality);
  }

  if (outputBlob.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('No se pudo reducir la foto por debajo de 2MB.');
  }

  const outputName = `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.webp`;
  return new File([outputBlob], outputName, { type: 'image/webp' });
}

export async function uploadPlayerPhoto(file, ownerId = 'anon') {
  const optimizedFile = await compressImageToWebp(file);
  const thumbFile = await compressImageToWebp(file, THUMB_MAX_DIMENSION, THUMB_WEBP_QUALITY);
  const safeFileName = sanitizeFileName(optimizedFile.name || 'photo.webp');
  const basePath = `${ownerId}/${Date.now()}-${safeFileName}`;
  const filePath = basePath;
  const thumbPath = basePath.replace(/\.webp$/i, '-thumb.webp');

  const { error: uploadError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(filePath, optimizedFile, { upsert: false, cacheControl: '31536000' });

  if (uploadError) {
    throw new Error(uploadError.message || 'No se pudo subir la foto.');
  }

  const { error: thumbError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(thumbPath, thumbFile, { upsert: false, cacheControl: '31536000' });

  if (thumbError) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([filePath]);
    throw new Error(thumbError.message || 'No se pudo subir la miniatura de foto.');
  }

  const { data } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(filePath);
  const { data: thumbData } = supabase.storage.from(PLAYER_PHOTO_BUCKET).getPublicUrl(thumbPath);
  return {
    path: filePath,
    thumbPath,
    publicUrl: data.publicUrl,
    thumbPublicUrl: thumbData.publicUrl,
  };
}

export async function removePlayerPhotoByUrl(publicUrl) {
  const path = extractPathFromPublicUrl(publicUrl);
  if (!path) return;

  await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([path]);
}

export async function removePlayerPhotoSet(photoUrl, thumbUrl) {
  const photoPath = extractPathFromPublicUrl(photoUrl);
  const thumbPath = extractPathFromPublicUrl(thumbUrl);
  const paths = [photoPath, thumbPath].filter(Boolean);
  if (!paths.length) return;

  await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove(paths);
}
