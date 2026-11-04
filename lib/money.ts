export function formatZMW(amount: number) {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
