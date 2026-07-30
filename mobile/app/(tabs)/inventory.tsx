import { useCallback, useState } from "react";
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
import { colors, fmtMoney } from "../../src/theme";

type Item = {
  id: number;
  name: string;
  sku?: string;
  quantity: number;
  alert_threshold: number;
  location?: string;
  notes?: string;
};

type Assignment = {
  id: number;
  item_id: number;
  item_name?: string;
  athlete_id?: number;
  athlete_name?: string;
  quantity: number;
  status?: string;
  assigned_on?: string;
};

type Athlete = { id: number; full_name: string };

export default function InventoryScreen() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "direction" || role === "staff";
  const [tab, setTab] = useState<"stock" | "assign" | "buy">("stock");
  const [items, setItems] = useState<Item[]>([]);
  const [assigns, setAssigns] = useState<Assignment[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "0", location: "", alert_threshold: "2" });
  const [loan, setLoan] = useState({ item_id: 0, athlete_id: 0, quantity: "1" });
  const [buy, setBuy] = useState({ name: "", quantity: "1", unit_cost: "0", athlete_id: 0, notes: "" });

  const refresh = useCallback(() => {
    if (!canEdit) {
      setLoading(false);
      setErr("Accès réservé au staff");
      return;
    }
    setLoading(true);
    setErr("");
    Promise.all([
      api<Item[]>("/api/v1/inventory/items").catch(() => [] as Item[]),
      api<Assignment[]>("/api/v1/inventory/assignments?limit=100").catch(() => [] as Assignment[]),
      api<Athlete[]>("/api/v1/athletes?limit=300&sort=name&order=asc").catch(() => [] as Athlete[]),
    ])
      .then(([it, asg, ath]) => {
        setItems(it);
        setAssigns(asg);
        setAthletes(ath);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [canEdit]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function createItem() {
    if (!newItem.name.trim() || saving) return;
    setSaving(true);
    setErr("");
    try {
      await api("/api/v1/inventory/items", {
        method: "POST",
        body: JSON.stringify({
          name: newItem.name.trim(),
          quantity: Number(newItem.quantity) || 0,
          alert_threshold: Number(newItem.alert_threshold) || 2,
          location: newItem.location.trim() || null,
        }),
      });
      setMsg("Article ajouté");
      setNewItem({ name: "", quantity: "0", location: "", alert_threshold: "2" });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function assign() {
    if (!loan.item_id || saving) return;
    setSaving(true);
    setErr("");
    try {
      const q = new URLSearchParams({
        item_id: String(loan.item_id),
        quantity: String(Number(loan.quantity) || 1),
      });
      if (loan.athlete_id) q.set("athlete_id", String(loan.athlete_id));
      await api(`/api/v1/inventory/assign?${q.toString()}`, { method: "POST", body: "{}" });
      setMsg("Prêt enregistré");
      setLoan({ item_id: 0, athlete_id: 0, quantity: "1" });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function purchase() {
    if (!buy.name.trim() || saving) return;
    setSaving(true);
    setErr("");
    try {
      await api("/api/v1/inventory/purchase", {
        method: "POST",
        body: JSON.stringify({
          name: buy.name.trim(),
          quantity: Number(buy.quantity) || 1,
          unit_cost: Number(buy.unit_cost) || 0,
          athlete_id: buy.athlete_id || null,
          notes: buy.notes.trim() || null,
        }),
      });
      setMsg("Achat enregistré (stock + caisse)");
      setBuy({ name: "", quantity: "1", unit_cost: "0", athlete_id: 0, notes: "" });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <View style={[styles.page, { padding: 16 }]}>
        <Text style={styles.h}>Matériel</Text>
        <Text style={styles.muted}>Réservé à l’administration / staff.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Matériel / Inventaire</Text>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      <View style={styles.chips}>
        {(
          [
            ["stock", "Stock"],
            ["assign", "Prêts"],
            ["buy", "Achat"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.chip, tab === id && styles.chipOn]} onPress={() => setTab(id)}>
            <Text style={[styles.chipText, tab === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "stock" && (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>Nouvel article</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom"
              value={newItem.name}
              onChangeText={(t) => setNewItem((f) => ({ ...f, name: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Quantité"
              keyboardType="numeric"
              value={newItem.quantity}
              onChangeText={(t) => setNewItem((f) => ({ ...f, quantity: t }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Lieu de stockage"
              value={newItem.location}
              onChangeText={(t) => setNewItem((f) => ({ ...f, location: t }))}
            />
            <Pressable style={styles.btn} onPress={createItem} disabled={saving}>
              <Text style={styles.btnText}>Ajouter au stock</Text>
            </Pressable>
          </View>
          {items.map((it) => {
            const low = it.quantity <= (it.alert_threshold ?? 2);
            return (
              <View key={it.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.title}>{it.name}</Text>
                  <Text style={[styles.qty, low && { color: colors.danger }]}>{it.quantity}</Text>
                </View>
                <Text style={styles.line}>
                  {[it.location, it.sku, low ? "⚠ stock bas" : null].filter(Boolean).join(" · ") || "—"}
                </Text>
              </View>
            );
          })}
          {!items.length && !loading && <Text style={styles.muted}>Stock vide</Text>}
        </>
      )}

      {tab === "assign" && (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>Prêter un article</Text>
            <Text style={styles.label}>Article</Text>
            <View style={styles.chips}>
              {items.map((it) => (
                <Pressable
                  key={it.id}
                  style={[styles.chip, loan.item_id === it.id && styles.chipOn]}
                  onPress={() => setLoan((f) => ({ ...f, item_id: it.id }))}
                >
                  <Text style={[styles.chipText, loan.item_id === it.id && styles.chipTextOn]}>
                    {it.name} ({it.quantity})
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Joueur (optionnel)</Text>
            <View style={styles.list}>
              {athletes.slice(0, 40).map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.row, loan.athlete_id === a.id && styles.rowOn]}
                  onPress={() => setLoan((f) => ({ ...f, athlete_id: a.id }))}
                >
                  <Text style={styles.rowText}>{a.full_name}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={loan.quantity}
              onChangeText={(t) => setLoan((f) => ({ ...f, quantity: t }))}
              placeholder="Quantité"
            />
            <Pressable style={styles.btn} onPress={assign} disabled={saving || !loan.item_id}>
              <Text style={styles.btnText}>Enregistrer le prêt</Text>
            </Pressable>
          </View>
          {assigns.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.title}>{a.item_name || `Article #${a.item_id}`}</Text>
              <Text style={styles.line}>
                {a.athlete_name || "Club"} · x{a.quantity} · {a.status || "out"}
              </Text>
              {!!a.assigned_on && <Text style={styles.muted}>{a.assigned_on}</Text>}
            </View>
          ))}
        </>
      )}

      {tab === "buy" && (
        <View style={styles.card}>
          <Text style={styles.title}>Achat équipement</Text>
          <Text style={styles.muted}>Crée le stock et une sortie de caisse.</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom article"
            value={buy.name}
            onChangeText={(t) => setBuy((f) => ({ ...f, name: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Quantité"
            keyboardType="numeric"
            value={buy.quantity}
            onChangeText={(t) => setBuy((f) => ({ ...f, quantity: t }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Coût unitaire DZD"
            keyboardType="numeric"
            value={buy.unit_cost}
            onChangeText={(t) => setBuy((f) => ({ ...f, unit_cost: t }))}
          />
          <Text style={styles.label}>Attribuer à un joueur (optionnel)</Text>
          <View style={styles.list}>
            <Pressable
              style={[styles.row, buy.athlete_id === 0 && styles.rowOn]}
              onPress={() => setBuy((f) => ({ ...f, athlete_id: 0 }))}
            >
              <Text style={styles.rowText}>Stock club uniquement</Text>
            </Pressable>
            {athletes.slice(0, 40).map((a) => (
              <Pressable
                key={a.id}
                style={[styles.row, buy.athlete_id === a.id && styles.rowOn]}
                onPress={() => setBuy((f) => ({ ...f, athlete_id: a.id }))}
              >
                <Text style={styles.rowText}>{a.full_name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.line}>
            Total : {fmtMoney((Number(buy.quantity) || 0) * (Number(buy.unit_cost) || 0))}
          </Text>
          <Pressable style={styles.btn} onPress={purchase} disabled={saving}>
            <Text style={styles.btnText}>{saving ? "…" : "Enregistrer l’achat"}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15, flex: 1 },
  qty: { fontWeight: "800", color: colors.blue, fontSize: 18 },
  muted: { color: colors.muted, lineHeight: 20 },
  line: { color: "#334155", fontSize: 14 },
  label: { marginTop: 8, fontWeight: "700", color: "#334155", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  list: { maxHeight: 180, marginTop: 8 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.softGray,
    marginBottom: 6,
  },
  rowOn: { backgroundColor: colors.softBlue },
  rowText: { fontWeight: "600", color: "#0f172a" },
  btn: { marginTop: 10, backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  ok: { color: "#16a34a", fontWeight: "700" },
  err: { color: colors.danger, fontWeight: "700" },
});
