import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";

type Inst = {
  id: number;
  athlete_id: number;
  athlete_name?: string;
  label: string;
  label_ar?: string;
  amount: number;
  amount_paid: number;
  status: string;
};

type FeeSettings = {
  monthly_subscription_dzd: number;
  annual_insurance_dzd: number;
  inscription_fee_dzd: number;
};

type Athlete = { id: number; full_name: string; category_code?: string; category_id?: number };
type Category = { id: number; code: string };

const TYPES: { id: string; label: string }[] = [
  { id: "monthly", label: "Mensuel" },
  { id: "insurance", label: "Assurance" },
  { id: "inscription", label: "Inscription" },
  { id: "equipment", label: "Équipement" },
];

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export default function PaymentsScreen() {
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "direction" || role === "staff";
  const [rows, setRows] = useState<Inst[]>([]);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [pay, setPay] = useState({
    payment_type: "monthly",
    category_id: 0 as number,
    athlete_id: 0 as number,
    month: now.getMonth() + 1,
    amount: "800",
    equipment_label: "",
  });

  const refresh = useCallback(() => {
    api<Inst[]>("/api/v1/installments?limit=100")
      .then(setRows)
      .catch(() => setRows([]));
    api<FeeSettings>("/api/v1/finance/settings")
      .then((s) => {
        setSettings(s);
        setPay((p) => ({
          ...p,
          amount:
            p.payment_type === "monthly"
              ? String(s.monthly_subscription_dzd)
              : p.payment_type === "insurance"
                ? String(s.annual_insurance_dzd)
                : p.amount,
        }));
      })
      .catch(() => undefined);
    if (isStaff) {
      api<Category[]>("/api/v1/categories").then(setCats).catch(() => setCats([]));
      api<Athlete[]>("/api/v1/athletes?limit=200&sort=name&order=asc")
        .then(setAthletes)
        .catch(() => setAthletes([]));
    }
  }, [isStaff]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filteredAthletes = useMemo(
    () => (pay.category_id ? athletes.filter((a) => a.category_id === pay.category_id) : athletes),
    [athletes, pay.category_id],
  );

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
      setMsg(`✓ ${res.label} — ${Number(res.amount).toLocaleString()} DZD`);
      setPay((p) => ({ ...p, athlete_id: 0, equipment_label: "" }));
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.h}>Cotisations / الاشتراكات</Text>

      {settings && (
        <View style={styles.card}>
          <Text style={styles.title}>Constantes club</Text>
          <Text style={styles.muted}>Mensuel : {Number(settings.monthly_subscription_dzd).toLocaleString()} DZD</Text>
          <Text style={styles.muted}>Assurance : {Number(settings.annual_insurance_dzd).toLocaleString()} DZD</Text>
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

          <Text style={styles.label}>Joueur</Text>
          <View style={styles.list}>
            {filteredAthletes.slice(0, 40).map((a) => (
              <Pressable
                key={a.id}
                style={[styles.row, pay.athlete_id === a.id && styles.rowOn]}
                onPress={() => setPay((p) => ({ ...p, athlete_id: a.id }))}
              >
                <Text style={styles.rowText}>
                  {a.full_name}
                  {a.category_code ? ` (${a.category_code})` : ""}
                </Text>
              </Pressable>
            ))}
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

          <Text style={styles.label}>Montant DZD</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={pay.amount}
            onChangeText={(t) => setPay((p) => ({ ...p, amount: t }))}
          />

          <Pressable style={styles.btn} onPress={onQuickPay} disabled={saving || !pay.athlete_id}>
            <Text style={styles.btnText}>{saving ? "…" : "Enregistrer le paiement"}</Text>
          </Pressable>
          {!!msg && <Text style={styles.ok}>{msg}</Text>}
        </View>
      )}

      <Text style={styles.h2}>Échéances</Text>
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.title}>
            {r.label} {r.label_ar ? `· ${r.label_ar}` : ""}
          </Text>
          <Text style={styles.muted}>{r.athlete_name || `Joueur #${r.athlete_id}`}</Text>
          <Text style={styles.amount}>
            {Number(r.amount_paid).toLocaleString()} / {Number(r.amount).toLocaleString()} DZD
          </Text>
          <Text style={styles.badge}>{r.status}</Text>
        </View>
      ))}
      {!rows.length && <Text style={styles.muted}>Aucune échéance</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef2fb" },
  h: { fontSize: 18, fontWeight: "800", color: "#1E3A8A" },
  h2: { fontSize: 15, fontWeight: "800", color: "#1E3A8A", marginTop: 4 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 12, gap: 4 },
  title: { fontWeight: "700" },
  muted: { color: "#5b6478" },
  amount: { marginTop: 6, color: "#1E3A8A", fontWeight: "800" },
  badge: { marginTop: 4, color: "#5b6478", fontWeight: "700" },
  label: { marginTop: 10, fontWeight: "700", color: "#334155" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#d7deee",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  chipOn: { backgroundColor: "#1E3A8A", borderColor: "#1E3A8A" },
  chipText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  chipTextOn: { color: "white" },
  list: { maxHeight: 180, marginTop: 6 },
  row: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#f8fafc", marginBottom: 4 },
  rowOn: { backgroundColor: "#dbeafe" },
  rowText: { fontWeight: "600", color: "#0f172a" },
  input: {
    borderWidth: 1,
    borderColor: "#d7deee",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    marginTop: 4,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#1E3A8A",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "800" },
  ok: { marginTop: 8, color: "#16a34a", fontWeight: "700" },
});
