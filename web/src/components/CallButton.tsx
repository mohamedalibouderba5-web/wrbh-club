/** Lien d'appel direct (Android / iPhone via tel:). */
export function CallButton({ phone, className = "" }: { phone?: string | null; className?: string }) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return null;
  const href = digits.startsWith("+") || digits.startsWith("0") ? `tel:${digits}` : `tel:+213${digits.replace(/^0/, "")}`;
  return (
    <a className={`call-btn ${className}`} href={href} title={`Appeler ${phone}`} aria-label={`Appeler ${phone}`}>
      ☎
    </a>
  );
}

export function PhoneCell({ phone }: { phone?: string | null }) {
  if (!phone) return <span>—</span>;
  return (
    <span className="phone-cell">
      <span dir="ltr" className="ltr">
        {phone}
      </span>
      <CallButton phone={phone} className="inline" />
    </span>
  );
}
