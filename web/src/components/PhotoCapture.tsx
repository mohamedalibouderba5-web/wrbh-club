import { useEffect, useRef, useState } from "react";
import { mediaUrl, uploadPhoto } from "../api/client";
import { isNetworkError } from "../offline/registrationQueue";
import { useI18n } from "../i18n";

type Props = {
  value?: string | null;
  /** Aperçu local (blob:) quand la photo n'est pas encore sur le serveur */
  previewUrl?: string | null;
  onUploaded: (path: string) => void;
  /** Photo gardée localement (hors ligne ou échec réseau) */
  onLocalFile?: (file: File, previewUrl: string) => void;
  athleteId?: number;
};

export function PhotoCapture({ value, previewUrl, onUploaded, onLocalFile, athleteId }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const shown = previewUrl || localPreview || (value ? mediaUrl(value) : undefined);

  async function handleFile(file?: File | null) {
    if (!file) return;
    setBusy(true);
    setErr("");
    const preview = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return preview;
    });

    const useLocal = () => {
      onLocalFile?.(file, preview);
    };

    if (!navigator.onLine) {
      useLocal();
      setBusy(false);
      return;
    }

    try {
      const res = await uploadPhoto(file, athleteId);
      onUploaded(res.path);
      setLocalPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (e) {
      if (onLocalFile && isNetworkError(e)) {
        useLocal();
      } else {
        setErr(e instanceof Error ? e.message : "Erreur upload");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-capture">
      <div className="photo-preview">
        {shown ? (
          <img src={shown} alt="player" />
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
      {!value && (previewUrl || localPreview) && (
        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Photo locale — envoi à la sync</div>
      )}
    </div>
  );
}
