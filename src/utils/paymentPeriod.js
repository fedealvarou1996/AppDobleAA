export function isCurrentMonthlyPeriod(dateValue, now = new Date()) {
  if (!dateValue) return false;

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue));
  const paymentDate = dateOnlyMatch
    ? new Date(`${dateValue}T00:00:00`)
    : new Date(dateValue);

  if (Number.isNaN(paymentDate.getTime())) return false;

  return (
    paymentDate.getFullYear() === now.getFullYear() &&
    paymentDate.getMonth() === now.getMonth()
  );
}

export function getEffectivePaymentStatus(player, now = new Date()) {
  const hasCurrentPayment = isCurrentMonthlyPeriod(player?.last_payment_date, now);
  return Boolean(player?.payment_status) && hasCurrentPayment;
}
