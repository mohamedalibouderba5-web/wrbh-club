import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { confirmDialog } from "../components/ConfirmDialog";
import { useI18n } from "../i18n";
import { toast } from "../components/Toast";

type UserRow = {
  id: number;
  full_name: string;
  full_name_ar?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  is_active: boolean;
  must_change_password?: boolean;
};

const ROLE_LABELS: Record<string, { fr: string; ar: string }> = {
  admin: { fr: "Administrateur", ar: "مدير النظام" },
  direction: { fr: "Direction / Gérant", ar: "إدارة / مسير" },
  staff: { fr: "Staff", ar: "طاقم" },
  coach: { fr: "Entraîneur", ar: "مدرب" },
  parent: { fr: "Parent", ar: "ولي" },
};

const emptyForm = {
  full_name: "",
  full_name_ar: "",
  email: "",
  phone: "",
  role: "coach",
  password: "",
};

export function UsersPage() {
  const { role: myRole } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const canManage = myRole === "admin" || myRole === "direction";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tempPassword, setTempPassword] = useState("");

  const roleOptions = useMemo(() => {
    const base = ["direction", "staff", "coach", "parent"] as const;
    return myRole === "admin" ? (["admin", ...base] as const) : base;
  }, [myRole]);

  async function load() {
    const rows = await api<UserRow[]>("/api/v1/auth/users");
    setUsers(rows);
  }

  useEffect(() => {
    if (canManage) void load().catch(() => toast(ar ? "تعذر تحميل المستخدمين" : "Impossible de charger les utilisateurs", "error"));
  }, [canManage, ar]);

  const filtered = useMemo(() => {
    if (filter === "all") return users;
    return users.filter((u) => u.role === filter);
  }, [users, filter]);

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
    setTempPassword("");
  }

  function startEdit(u: UserRow) {
    setEditId(u.id);
    setForm({
      full_name: u.full_name || "",
      full_name_ar: u.full_name_ar || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role,
      password: "",
    });
    setTempPassword("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || busy) return;
    if (!form.full_name.trim()) {
      toast(ar ? "الاسم مطلوب" : "Nom obligatoire", "error");
      return;
    }
    if (form.role === "parent" && !form.phone.trim() && !editId) {
      toast(ar ? "رقم الهاتف مطلوب للولي" : "Téléphone obligatoire pour un parent", "error");
      return;
    }
    if ((form.role === "coach" || form.role === "direction" || form.role === "staff") && !form.email.trim() && !form.phone.trim() && !editId) {
      toast(ar ? "البريد أو الهاتف مطلوب" : "Email ou téléphone obligatoire", "error");
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          full_name: form.full_name.trim(),
          full_name_ar: form.full_name_ar.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
        };
        if (form.password.trim()) body.password = form.password.trim();
        await api(`/api/v1/auth/users/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        toast(ar ? "تم التحديث" : "Utilisateur mis à jour", "success");
        resetForm();
      } else {
        const pwd = form.password.trim() || `Wr!${Math.floor(100000 + Math.random() * 900000)}`;
        await api("/api/v1/auth/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            full_name_ar: form.full_name_ar.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role: form.role,
            password: pwd,
            locale: "fr",
          }),
        });
        setTempPassword(pwd);
        setForm(emptyForm);
        setEditId(null);
        toast(ar ? "تم إنشاء الحساب" : "Compte créé", "success");
      }
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserRow) {
    if (!canManage || u.role === "admin") return;
    const next = !u.is_active;
    const ok = await confirmDialog({
      title: next ? (ar ? "تفعيل" : "Réactiver") : ar ? "تعطيل" : "Désactiver",
      message: `${u.full_name} — ${next ? (ar ? "تفعيل الحساب؟" : "Réactiver ce compte ?") : ar ? "تعطيل الحساب؟" : "Désactiver ce compte ?"}`,
      confirmLabel: next ? (ar ? "تفعيل" : "Réactiver") : ar ? "تعطيل" : "Désactiver",
      danger: !next,
    });
    if (!ok) return;
    try {
      await api(`/api/v1/auth/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: next }),
      });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur", "error");
    }
  }

  if (!canManage) {
    return (
      <div className="card">
        <p className="muted">{ar ? "الوصول محجوز للإدارة." : "Accès réservé à la direction."}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{ar ? "إدارة الحسابات" : "Gestion des comptes"}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {ar
            ? "أنشئ حسابات بأدوار مختلفة: مدير، مدرب، طاقم، ولي. يمكن للمدير أن يكون أيضاً مدرباً (اربطه بفريق من صفحة الفرق)."
            : "Créez des comptes par rôle : direction/gérant, entraîneur, staff, parent. Un gérant peut aussi être entraîneur — liez-le à une équipe dans Équipes / Coachs."}
        </p>

        <form onSubmit={onSubmit} className="stack" style={{ gap: "0.75rem" }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>{ar ? "الاسم (FR)" : "Nom"}</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{ar ? "الاسم (عربي)" : "Nom arabe"}</label>
              <input className="ar" value={form.full_name_ar} onChange={(e) => setForm({ ...form, full_name_ar: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Email</label>
              <input className="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{ar ? "الهاتف" : "Téléphone"}</label>
              <input className="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0555…" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{ar ? "الدور" : "Rôle"}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={!!editId && form.role === "admin" && myRole !== "admin"}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ar ? ROLE_LABELS[r]?.ar || r : ROLE_LABELS[r]?.fr || r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{editId ? (ar ? "كلمة مرور جديدة" : "Nouveau mot de passe") : ar ? "كلمة المرور" : "Mot de passe"}</label>
              <input
                className="ltr"
                type="text"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editId ? "—" : ar ? "تلقائي إن فارغ" : "Auto si vide"}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={busy}>
              {busy ? "…" : editId ? (ar ? "حفظ" : "Enregistrer") : ar ? "إنشاء حساب" : "Créer le compte"}
            </button>
            {editId && (
              <button type="button" className="secondary" onClick={resetForm}>
                {ar ? "إلغاء" : "Annuler"}
              </button>
            )}
          </div>
          {tempPassword && (
            <p style={{ color: "var(--ok)", margin: 0 }}>
              {ar ? "كلمة مرور مؤقتة:" : "Mot de passe temporaire :"}{" "}
              <strong className="ltr">{tempPassword}</strong>
            </p>
          )}
        </form>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
          <strong>{ar ? "الحسابات" : "Comptes"}</strong>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="all">{ar ? "الكل" : "Tous"}</option>
            {Object.keys(ROLE_LABELS).map((r) => (
              <option key={r} value={r}>
                {ar ? ROLE_LABELS[r].ar : ROLE_LABELS[r].fr}
              </option>
            ))}
          </select>
          <span className="muted">{filtered.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>{ar ? "الاسم" : "Nom"}</th>
              <th>{ar ? "الدور" : "Rôle"}</th>
              <th>Email / {ar ? "هاتف" : "Tél."}</th>
              <th>{ar ? "الحالة" : "Statut"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                <td>
                  {u.full_name}
                  {u.full_name_ar ? ` · ${u.full_name_ar}` : ""}
                </td>
                <td>{ar ? ROLE_LABELS[u.role]?.ar || u.role : ROLE_LABELS[u.role]?.fr || u.role}</td>
                <td className="ltr">{u.email || u.phone || "—"}</td>
                <td>
                  <span className="badge">{u.is_active ? (ar ? "نشط" : "actif") : ar ? "معطل" : "inactif"}</span>
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="secondary" onClick={() => startEdit(u)}>
                    {ar ? "تعديل" : "Modifier"}
                  </button>
                  {u.role !== "admin" && (
                    <button type="button" className="secondary" onClick={() => void toggleActive(u)}>
                      {u.is_active ? (ar ? "تعطيل" : "Désactiver") : ar ? "تفعيل" : "Réactiver"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="muted">
                  {ar ? "لا يوجد مستخدم" : "Aucun compte"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{ar ? "حدود الأدوار (ملخص)" : "Limites des rôles (résumé)"}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {ar
            ? "التفاصيل الكاملة في docs/MATRICE_ROLES_ACCES.md — يجب احترامها في التطبيق أيضاً."
            : "Détail exhaustif : docs/MATRICE_ROLES_ACCES.md — même couture obligatoire pour l’app Android."}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "الوظيفة" : "Fonction"}</th>
                <th>Admin</th>
                <th>{ar ? "إدارة" : "Direction"}</th>
                <th>Staff</th>
                <th>{ar ? "مدرب" : "Coach"}</th>
                <th>{ar ? "ولي" : "Parent"}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [ar ? "لوحة القيادة الكاملة" : "Dashboard club / graphes", "✓", "✓", "✓", "✓", "—"],
                  [ar ? "لوحة الأبناء" : "Accueil enfants", "—", "—", "—", "—", "✓"],
                  [ar ? "اللاعبون (إنشاء/تعديل)" : "Athlètes créer/modifier", "✓", "✓", "✓", "✓*", "—"],
                  [ar ? "أرشفة لاعب" : "Archiver athlète", "✓", "✓", "—", "—", "—"],
                  [ar ? "التسجيلات" : "Inscriptions", "✓", "✓", "✓", "—", "✓ (siennes)"],
                  [ar ? "إنشاء حصة / إشعار أولياء" : "Créer séance / notifier", "✓", "✓", "✓", "✓", "—"],
                  [ar ? "الموافقة على الحصة" : "Valider séance", "✓", "✓", "✓", "—", "—"],
                  [ar ? "بدء / إنهاء / حضور" : "Démarrer / fin / présence", "✓", "✓", "✓", "✓", "—"],
                  [ar ? "الرد على الدعوة" : "RSVP convocation", "—", "—", "—", "—", "✓"],
                  [ar ? "الفرق وربط المدرب" : "Équipes / assigner coach", "✓", "✓", "✓", "voir", "—"],
                  [ar ? "الحسابات" : "Comptes utilisateurs", "✓", "✓†", "—", "—", "—"],
                  [ar ? "المالية" : "Finance club", "✓", "✓", "✓", "—", "impayés enfants"],
                  [ar ? "العتاد" : "Matériel", "✓", "✓", "✓", "—", "—"],
                  [ar ? "السجل / سلة المهملات" : "Historique / corbeille", "✓", "✓", "✓", "—", "—"],
                  [ar ? "استعادة محذوف" : "Restaurer", "✓", "✓", "✓", "—", "—"],
                ] as const
              ).map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td>{row[4]}</td>
                  <td>{row[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
          {ar
            ? "* المدرب: لاعبو فرقه فقط. † الإدارة لا تنشئ حساب مدير النظام."
            : "* Coach : athlètes de ses équipes. † Direction ne crée pas de compte admin."}
        </p>
      </div>
    </div>
  );
}
