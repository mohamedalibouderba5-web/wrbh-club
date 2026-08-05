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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) URL.revokeObjectURL(localPreview);
      stopCam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = previewUrl || localPreview || (value ? mediaUrl(value) : undefined);

  function stopCam() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCamOpen(false);
    setCamReady(false);
  }

  async function openCamera() {
    setErr("");
    const secure = typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost");
    if (!secure || !navigator.mediaDevices?.getUserMedia) {
      setErr(secure ? "Caméra non supportée — utilisez Importer" : "Caméra nécessite HTTPS — utilisez Importer");
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
      setCamReady(false);
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        const markReady = () => {
          if (video.videoWidth > 0) setCamReady(true);
        };
        video.onloadedmetadata = () => {
          void video.play().then(markReady).catch(() => markReady());
        };
        void video.play().then(markReady).catch(() => undefined);
      });
    } catch {
      setErr("Caméra indisponible — utilisez Importer");
      fileRef.current?.click();
    }
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video || !camReady) {
      setErr("Attendez que la caméra soit prête…");
      return;
    }
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w < 2 || h < 2) {
      setErr("Image caméra vide — réessayez ou Importer");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stopCam();
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErr("Capture échouée");
          return;
        }
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        void handleFile(file);
      },
      "image/jpeg",
      0.88,
    );
  }

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
      if (fileRef.current) fileRef.current.value = "";
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
        <button type="button" className="secondary" disabled={busy} onClick={() => void openCamera()}>
          {t("capture")}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (fileRef.current) fileRef.current.value = "";
            fileRef.current?.click();
          }}
        >
          {t("importPhoto")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          void handleFile(f);
          e.target.value = "";
        }}
      />
      {camOpen && (
        <div className="photo-cam-overlay" role="dialog" aria-modal="true" aria-label="Caméra">
          <div className="photo-cam-modal">
            <video ref={videoRef} playsInline muted autoPlay className="photo-cam-video" />
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              {camReady ? "Prêt — alignez le joueur puis capturez" : "Initialisation caméra…"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="accent" disabled={!camReady} onClick={snapPhoto}>
                Prendre la photo
              </button>
              <button type="button" className="secondary" onClick={stopCam}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {busy && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Upload…</div>}
      {!value && (previewUrl || localPreview) && (
        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Photo locale — envoi à la sync</div>
      )}
    </div>
  );
}
