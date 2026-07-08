import { BillingDocument, PaymentItem, formatBillingMoney } from "@/lib/billing";

export function receivedForCase(payments: PaymentItem[], caseCode: string) {
  return payments.filter((payment) => payment.case_code === caseCode && payment.status === "received").reduce((sum, payment) => sum + payment.amount, 0);
}

export function documentBlockers(document: BillingDocument & { contact_ready?: boolean; payment_required?: boolean; locked?: boolean }, payments: PaymentItem[]) {
  const blockers: string[] = [];
  const received = receivedForCase(payments, document.case_code);
  if (document.contact_ready === false) blockers.push("Falta contacto fiscal validado");
  if (document.payment_required && received < document.amount) blockers.push(`Pago insuficiente: ${formatBillingMoney(received, document.currency)} de ${formatBillingMoney(document.amount, document.currency)}`);
  if (document.locked) blockers.push("Documento bloqueado");
  return blockers;
}

export function canMarkReady(document: BillingDocument & { contact_ready?: boolean; payment_required?: boolean; locked?: boolean }, payments: PaymentItem[]) {
  return documentBlockers(document, payments).length === 0 && document.status !== "synced";
}

export function billingCaseSummary(payments: PaymentItem[], caseCode: string) {
  const received = receivedForCase(payments, caseCode);
  const pending = payments.filter((payment) => payment.case_code === caseCode && payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  return { received, pending };
}
