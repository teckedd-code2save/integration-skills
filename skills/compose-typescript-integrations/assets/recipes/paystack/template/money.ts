const DECIMAL_AMOUNT = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

export function toPaystackSubunit(amount: string): number {
  const match = DECIMAL_AMOUNT.exec(amount.trim());
  if (!match) throw new Error("Amount must be a positive decimal with at most two places");
  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const subunit = whole * 100 + Number(fraction);
  if (!Number.isSafeInteger(subunit) || subunit <= 0) throw new Error("Amount is out of range");
  return subunit;
}

export function createPaymentReference(prefix = "pay") {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_.=-]/g, "-");
  return `${safePrefix}-${crypto.randomUUID()}`;
}
