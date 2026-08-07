import { supabase } from '../lib/supabaseClient';

export const PAYMENT_RECEIPTS_BUCKET = 'payment-receipts';

const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function sanitizeFileName(fileName) {
  return (fileName || 'comprobante')
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');
}

export function validatePaymentReceipt(file) {
  if (!file) return 'Subi un comprobante para informar el pago.';

  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    return 'Formato invalido. Usa JPG, PNG, WEBP o PDF.';
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return 'El comprobante supera el limite de 10MB.';
  }

  return '';
}

export async function uploadPaymentReceipt(file, playerId) {
  const safeFileName = sanitizeFileName(file.name);
  const filePath = `${playerId}/${Date.now()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .upload(filePath, file, { upsert: false, cacheControl: '31536000' });

  if (error) {
    throw new Error(error.message || 'No se pudo subir el comprobante.');
  }

  return {
    path: filePath,
    fileName: file.name || safeFileName,
  };
}

export async function removePaymentReceipt(receiptPath) {
  if (!receiptPath) return;

  await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).remove([receiptPath]);
}

export async function openPaymentReceipt(receiptPath) {
  if (!receiptPath) return;

  const { data, error } = await supabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUrl(receiptPath, 60);

  if (error) {
    throw new Error(error.message || 'No se pudo abrir el comprobante.');
  }

  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
