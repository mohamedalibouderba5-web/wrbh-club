import { FormEvent, useMemo, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { FEEDBACK_TARGETS } from "../feedback/catalog";
import { toast } from "./Toast";

export function FeedbackWidget() {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("athletes");
  const [reportType, setReportType] = useState("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, typeof FEEDBACK_TARGETS>();
    for (const t of FEEDBACK_TARGETS) {
      const list = map.get(t.group) || [];
      list.push(t);
      map.set(t.group, list);
    }
    return [...map.entries()];
  }, []);

  const selected = FEEDBACK_TARGETS.find((t) => t.id === target);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      toast(lang === "ar" ? "اكتب رسالة أوضح" : "Message trop court", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/feedback/report", {
        method: "POST",
        body: JSON.stringify({
          target,
          target_label: lang === "ar" ? selected?.label_ar : selected?.label_fr,
          report_type: reportType,
          message: message.trim(),
          page_url: window.location.href,
          meta: { path: window.location.pathname },
        }),
      });
      toast(lang === "ar" ? "تم إرسال الملاحظة" : "Feedback envoyé — merci", "success");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="feedback-fab" onClick={() => setOpen(true)} aria-label="Feedback">
        {lang === "ar" ? "ملاحظات" : "Feedback"}
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="modal card feedback-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              {lang === "ar" ? "إبلاغ / اقتراح" : "Réclamation / suggestion"}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {lang === "ar"
                ? "اختر الوظيفة أو الزر المعني ثم صف المشكلة أو الفكرة."
                : "Choisissez l’écran / le bouton concerné, puis décrivez le bug ou l’idée."}
            </p>
            <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
              <label className="field">
                <span>{lang === "ar" ? "النوع" : "Type"}</span>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option value="bug">{lang === "ar" ? "خطأ / عطل" : "Erreur / bug"}</option>
                  <option value="idea">{lang === "ar" ? "اقتراح تحسين" : "Proposition d’amélioration"}</option>
                  <option value="other">{lang === "ar" ? "أخرى" : "Autre"}</option>
                </select>
              </label>
              <label className="field">
                <span>{lang === "ar" ? "الوظيفة / الزر" : "Fonctionnalité / bouton"}</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {groups.map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {lang === "ar" ? t.label_ar : t.label_fr}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{lang === "ar" ? "التفاصيل" : "Détails"}</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    lang === "ar"
                      ? "مثال: زر التسجيل لا يعمل / أضف خيارات في قائمة الأجندة…"
                      : "Ex. : le bouton Inscriptions ne marche pas / ajouter des points dans la liste Agenda…"
                  }
                />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => setOpen(false)}>
                  {lang === "ar" ? "إلغاء" : "Annuler"}
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? "…" : lang === "ar" ? "إرسال" : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
