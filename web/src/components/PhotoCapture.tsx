import { useRef, useState } from "react";
import { mediaUrl, uploadPhoto } from "../api/client";
import { useI18n } from "../i18n";

type Props = {
  value?: string | null;
  onUploaded: (path: string) => void;
  athleteId?: number;
};

export function PhotoCapture({ value, onUploaded, athleteId }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file?: File | null) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const res = await uploadPhoto(file, athleteId);
      onUploaded(res.path);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-capture">
      <div className="photo-preview">
        {value ? (
          <img src={mediaUrl(value)} alt="player" />
        ) : (
          <div className="photo-placeholder">{t("photo")}</div>
        )}
      </div>
      <div className="photo-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => camRef.current?.click()}>
          {t("capture")}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {t("importPhoto")}
        </button>
      </div>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {err && <div className="error">{err}</div>}
      {busy && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Upload…</div>}
    </div>
  );
}
