import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { colors, fmtMoney, statusColor, statusLabel } from "../../src/theme";

type Inst = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  label: string;
  label_ar?: string;
  amount: number;
  amount_paid: number;
  status: string;
  due_date?: string;
  reference?: string;
};

type FeeSettings = {
  monthly_subscription_dzd: number;
  annual_insurance_dzd: number;
  inscription_fee_dzd: number;
};

type Athlete = { id: number; full_name: string; category_code?: string; category_id?: number };
type Category = { id: number; code: string };
type Ledger = {
  id: number;
  entry_type: string;
  category: string;
  label: string;
  amount: number;
  entry_date: string;
  counterparty?: string;
  reference?: string;
};
type Dash = {
  cotisations_due: number;
  cotisations_paid: number;
  ledger_income: number;
  ledger_expense: number;
  coach_payroll_total: number;
  overdue_count: number;
};

const TYPES: { id: string; label: string }[] = [
  { id: "monthly", label: "Mensuel" },
  { id: "insurance", label: "Assurance" },
  { id: "inscription", label: "Inscription" },
  { id: "equipment", label: "Équipement" },
];

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function PaymentsScreen() {
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "direction" || role === "staff";
  const [tab, setTab] = useState<"fees" | "ledger">("fees");
  const [rows, setRows] = useState<Inst[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [dash, setDash] = useState<Dash | null>(null);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState("");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [pay, setPay] = useState({
    payment_type: "monthly",
    category_id: 0 as number,
    athlete_id: 0 as number,
    month: now.getMonth() + 1,
    amount: "800",
    equipment_label: "",
  });
  const [entry, setEntry] = useState({
    entry_type: "expense",
    category: "divers",
    label: "",
    amount: "",
    entry_date: today,
    counterparty: "",
  });

  const refresh = useCallback(() => {
    setLoading(true);
    setErr("");
    Promise.all([
      api<Inst[]>("/api/v1/installments?limit=200").catch(() => [] as Inst[]),
      api<FeeSettings>("/api/v1/finance/settings").catch(() => null),
    ])
      .then(([inst, s]) => {
        setRows(inst);
        if (s) {
          setSettings(s);
          setPay((p) => ({
            ...p,
            amount:
              p.payment_type === "monthly"
                ? String(s.monthly_subscription_dzd)
                : p.payment_type === "insurance"
                  ? String(s.annual_insurance_dzd)
                  : p.payment_type === "inscription"
                    ? String(s.inscription_fee_dzd)
                    : p.amount,
          }));
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));

    if (isStaff) {
      api<Category[]>("/api/v1/categories").then(setCats).catch(() => setCats([]));
      api<Athlete[]>("/api/v1/athletes?limit=300&sort=name&order=asc")
        .then(setAthletes)
        .catch(() => setAthletes([]));
      api<Ledger[]>("/api/v1/ledger?limit=80")
        .then(setLedger)
        .catch(() => setLedger([]));
      api<Dash>("/api/v1/dashboard")
        .then(setDash)
        .catch(() => setDash(null));
    }
  }, [isStaff]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    return athletes
      .filter((a) => (!pay.category_id || a.category_id === pay.category_id))
      .filter((a) => !q || a.full_name.toLowerCase().includes(q) || (a.category_code || "").toLowerCase().includes(q));
  }, [athletes, pay.category_id, athleteSearch]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "paid" && r.status !== "paid") return false;
      if (filter === "unpaid" && r.status === "paid") return false;
      if (!q) return true;
      return (
        (r.label || "").toLowerCase().includes(q) ||
        (r.athlete_name || "").toLowerCase().includes(q) ||
        (r.reference || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    const due = rows.filter((r) => r.status !== "paid");
    const left = due.reduce((s, r) => s + Math.max(0, Number(r.amount) - Number(r.amount_paid)), 0);
    return { unpaidCount: due.length, left };
  }, [rows]);

  function onType(type: string) {
    const amount =
      type === "monthly"
        ? String(settings?.monthly_subscription_dzd ?? 800)
        : type === "insurance"
          ? String(settings?.annual_insurance_dzd ?? 1500)
          : type === "inscription"
            ? String(settings?.inscription_fee_dzd ?? 4000)
            : pay.amount;
    setPay((p) => ({ ...p, payment_type: type, amount }));
  }

  async function onQuickPay() {
    if (!pay.athlete_id || saving) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const body: Record<string, unknown> = {
        payment_type: pay.payment_type,
        athlete_id: pay.athlete_id,
        amount: Number(pay.amount),
        method: "cash",
      };
      if (pay.payment_type === "monthly") {
        body.month = pay.month;
        body.year = now.getFullYear();
      }
      if (pay.payment_type === "equipment") {
        body.equipment_label = pay.equipment_label || "équipement";
      }
      const res = await api<{ label: string; amount: number; receipt_number: string }>("/api/v1/payments/quick", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(`✓ ${res.label} — ${fmtMoney(res.amount)}${res.receipt_number ? ` · ${res.receipt_number}` : ""}`);
      setPay((p) => ({ ...p, athlete_id: 0, equipment_label: "" }));
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function onLedgerSave() {
    if (!entry.label.trim() || !entry.amount || saving) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await api("/api/v1/ledger", {
        method: "POST",
        body: JSON.stringify({
          entry_type: entry.entry_type,
          category: entry.category,
          label: entry.label.trim(),
          amount: Number(entry.amount),
          entry_date: entry.entry_date || today,
          counterparty: entry.counterparty.trim() || null,
        }),
      });
      setMsg("Écriture caisse enregistrée");
      setEntry({
        entry_type: "expense",
        category: "divers",
        label: "",
        amount: "",
        entry_date: today,
        counterparty: "",
      });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={styles.h}>Finance</Text>
      {isStaff && (
        <View style={styles.chips}>
          <Pressable style={[styles.chip, tab === "fees" && styles.chipOn]} onPress={() => setTab("fees")}>
            <Text style={[styles.chipText, tab === "fees" && styles.chipTextOn]}>Cotisations</Text>
          </Pressable>
          <Pressable style={[styles.chip, tab === "ledger" && styles.chipOn]} onPress={() => setTab("ledger")}>
            <Text style={[styles.chipText, tab === "ledger" && styles.chipTextOn]}>Caisse</Text>
          </Pressable>
        </View>
      )}
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      {tab === "ledger" && isStaff ? (
        <>
          {dash && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryN}>{fmtMoney(dash.ledger_income)}</Text>
                <Text style={styles.summaryL}>Recettes</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryN}>{fmtMoney(dash.ledger_expense)}</Text>
                <Text style={styles.summaryL}>Dépenses</Text>
              </View>
            </View>
          )}
          {dash && (
            <View style={styles.card}>
              <Text style={styles.title}>Tableau de bord</Text>
              <Text style={styles.line}>Cotisations encaissées : {fmtMoney(dash.cotisations_paid)}</Text>
              <Text style={styles.line}>Reste cotisations : {fmtMoney(dash.cotisations_due)}</Text>
              <Text style={styles.line}>Paie coachs : {fmtMoney(dash.coach_payroll_total)}</Text>
              <Text style={styles.line}>Échéances en retard : {dash.overdue_count}</Text>
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.title}>Nouvelle écriture</Text>
            <View style={styles.chips}>
              {(
                [
                  ["income", "Recette"],
                  ["expense", "Dépense"],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  style={[styles.chip, entry.entry_type === id && styles.chipOn]}
                  onPress={() => setEntry((e) => ({ ...e, entry_type: id }))}
                >
                  <Text style={[styles.chipText, entry.entry_type === id && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chips}>
              {["divers", "equipment", "transport", "salaires", "location", "autre"].map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, entry.category === c && styles.chipOn]}
                  onPress={() => setEntry((e) => ({ ...e, category: c }))}
                >
                  <Text style={[styles.chipText, entry.category === c && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Libellé *"
              value={entry.label}
              onChangeText={(t) => setEntry((e) => ({ ...e, label: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Montant DZD *"
              keyboardType="numeric"
              value={entry.amount}
              onChangeText={(t) => setEntry((e) => ({ ...e, amount: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Date AAAA-MM-JJ"
              value={entry.entry_date}
              onChangeText={(t) => setEntry((e) => ({ ...e, entry_date: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Tiers / fournisseur"
              value={entry.counterparty}
              onChangeText={(t) => setEntry((e) => ({ ...e, counterparty: t }))}
            />
            <Pressable style={styles.btn} onPress={onLedgerSave} disabled={saving}>
              <Text style={styles.btnText}>{saving ? "…" : "Enregistrer"}</Text>
            </Pressable>
          </View>
          {ledger.map((l) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.title}>{l.label}</Text>
                <Text style={{ fontWeight: "800", color: l.entry_type === "income" ? colors.success : colors.danger }}>
                  {l.entry_type === "income" ? "+" : "−"}
                  {fmtMoney(l.amount)}
                </Text>
              </View>
              <Text style={styles.line}>
                {l.category} · {l.entry_date}
                {l.counterparty ? ` · ${l.counterparty}` : ""}
              </Text>
              {!!l.reference && <Text style={styles.ref}>Réf. {l.reference}</Text>}
            </View>
          ))}
          {!ledger.length && !loading && <Text style={styles.muted}>Aucune écriture</Text>}
        </>
      ) : (
        <>
      <Text style={styles.h2}>Cotisations / الاشتراكات</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryN}>{totals.unpaidCount}</Text>
          <Text style={styles.summaryL}>Échéances ouvertes</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryN}>{fmtMoney(totals.left)}</Text>
          <Text style={styles.summaryL}>Reste à payer</Text>
        </View>
      </View>

      {settings && (
        <View style={styles.card}>
          <Text style={styles.title}>Tarifs club</Text>
          <Text style={styles.line}>Mensuel : {fmtMoney(settings.monthly_subscription_dzd)}</Text>
          <Text style={styles.line}>Assurance : {fmtMoney(settings.annual_insurance_dzd)}</Text>
          <Text style={styles.line}>Inscription : {fmtMoney(settings.inscription_fee_dzd)}</Text>
        </View>
      )}

      {isStaff && (
        <View style={styles.card}>
          <Text style={styles.title}>Encaisser un paiement</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.chip, pay.payment_type === t.id && styles.chipOn]}
                onPress={() => onType(t.id)}
              >
                <Text style={[styles.chipText, pay.payment_type === t.id && styles.chipTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, pay.category_id === 0 && styles.chipOn]}
              onPress={() => setPay((p) => ({ ...p, category_id: 0, athlete_id: 0 }))}
            >
              <Text style={[styles.chipText, pay.category_id === 0 && styles.chipTextOn]}>Toutes</Text>
            </Pressable>
            {cats.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, pay.category_id === c.id && styles.chipOn]}
                onPress={() => setPay((p) => ({ ...p, category_id: c.id, athlete_id: 0 }))}
              >
                <Text style={[styles.chipText, pay.category_id === c.id && styles.chipTextOn]}>{c.code}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Rechercher un joueur</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom…"
            value={athleteSearch}
            onChangeText={setAthleteSearch}
          />
          <View style={styles.list}>
            {filteredAthletes.slice(0, 60).map((a) => (
              <Pressable
                key={a.id}
                style={[styles.row, pay.athlete_id === a.id && styles.rowOn]}
                onPress={() => setPay((p) => ({ ...p, athlete_id: a.id }))}
              >
                <Text style={styles.rowText}>
                  {a.full_name}
                  {a.category_code ? `  ·  ${a.category_code}` : ""}
                </Text>
              </Pressable>
            ))}
            {!filteredAthletes.length && <Text style={styles.muted}>Aucun joueur</Text>}
          </View>

          {pay.payment_type === "monthly" && (
            <>
              <Text style={styles.label}>Mois</Text>
              <View style={styles.chips}>
                {MONTHS.map((m, i) => (
                  <Pressable
                    key={m}
                    style={[styles.chip, pay.month === i + 1 && styles.chipOn]}
                    onPress={() => setPay((p) => ({ ...p, month: i + 1 }))}
                  >
                    <Text style={[styles.chipText, pay.month === i + 1 && styles.chipTextOn]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {pay.payment_type === "equipment" && (
            <>
              <Text style={styles.label}>Article</Text>
              <TextInput
                style={styles.input}
                value={pay.equipment_label}
                onChangeText={(t) => setPay((p) => ({ ...p, equipment_label: t }))}
                placeholder="Maillot, brassards…"
              />
            </>
          )}

          <Text style={styles.label}>Montant (DZD)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={pay.amount}
            onChangeText={(t) => setPay((p) => ({ ...p, amount: t }))}
          />

          <Pressable style={styles.btn} onPress={onQuickPay} disabled={saving || !pay.athlete_id}>
            <Text style={styles.btnText}>{saving ? "Enregistrement…" : "Enregistrer le paiement"}</Text>
          </Pressable>
        </View>
      )}

      {!isStaff && (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Consultation des échéances de vos enfants. Pour payer, contactez le secrétariat du club.
          </Text>
        </View>
      )}

      <Text style={styles.h2}>Échéances</Text>
      <TextInput
        style={styles.input}
        placeholder="Filtrer nom / libellé / référence…"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.chips}>
        {(
          [
            ["all", "Toutes"],
            ["unpaid", "À payer"],
            ["paid", "Payées"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.chip, filter === id && styles.chipOn]} onPress={() => setFilter(id)}>
            <Text style={[styles.chipText, filter === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {visibleRows.map((r) => {
        const left = Math.max(0, Number(r.amount) - Number(r.amount_paid));
        return (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.title}>{r.label}</Text>
              <Text style={[styles.badge, { color: statusColor(r.status) }]}>{statusLabel(r.status)}</Text>
            </View>
            {!!r.label_ar && <Text style={styles.ar}>{r.label_ar}</Text>}
            <Text style={styles.line}>{r.athlete_name || `Joueur #${r.athlete_id}`}</Text>
            {!!r.reference && <Text style={styles.ref}>Réf. {r.reference}</Text>}
            <View style={styles.amountRow}>
              <Text style={styles.amount}>{fmtMoney(r.amount_paid)} / {fmtMoney(r.amount)}</Text>
              {left > 0 && <Text style={styles.left}>Reste {fmtMoney(left)}</Text>}
            </View>
          </View>
        );
      })}
      {!visibleRows.length && !loading && <Text style={styles.muted}>Aucune échéance à afficher</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  h2: { fontSize: 16, fontWeight: "800", color: colors.blue, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15, flex: 1 },
  muted: { color: colors.muted, lineHeight: 20 },
  line: { color: "#334155", fontSize: 14, lineHeight: 20 },
  ar: { color: colors.muted, fontSize: 13 },
  ref: { color: colors.muted, fontSize: 12 },
  amount: { marginTop: 4, color: colors.blue, fontWeight: "800", fontSize: 15 },
  amountRow: { marginTop: 4, gap: 2 },
  left: { color: "#a16207", fontWeight: "700", fontSize: 13 },
  badge: { fontWeight: "800", fontSize: 12 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  summaryN: { fontWeight: "800", color: colors.blue, fontSize: 16, textAlign: "center" },
  summaryL: { color: colors.muted, fontSize: 12, marginTop: 4, textAlign: "center" },
  label: { marginTop: 12, fontWeight: "700", color: "#334155", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.softGray,
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "white" },
  list: { maxHeight: 220, marginTop: 8 },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.softGray,
    marginBottom: 6,
  },
  rowOn: { backgroundColor: colors.softBlue },
  rowText: { fontWeight: "600", color: "#0f172a", fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.softGray,
    marginTop: 6,
    fontSize: 15,
  },
  btn: {
    marginTop: 14,
    backgroundColor: colors.blue,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "800", fontSize: 15 },
  ok: { color: "#16a34a", fontWeight: "700", textAlign: "center" },
  err: { color: colors.danger, fontWeight: "700", textAlign: "center" },
});
