import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import { colors, statusLabel } from "../../src/theme";

type Coach = { id: number; full_name: string; role?: string };
type TeamCoach = { user_id: number; full_name?: string; role_label?: string };
type TeamRow = {
  id: number;
  name: string;
  name_ar?: string;
  category_code?: string;
  discipline_id?: number | null;
  coaches?: TeamCoach[];
};
type Discipline = {
  id: number;
  code: string;
  name: string;
  sport?: string;
  categories_count?: number;
};
type SportOpt = { code: string; label: string };
type Category = {
  id: number;
  code: string;
  name: string;
  discipline_id?: number | null;
};

const FALLBACK_SPORTS: SportOpt[] = [
  { code: "football", label: "Football" },
  { code: "judo", label: "Judo" },
  { code: "karate", label: "Karaté" },
  { code: "swimming", label: "Natation" },
  { code: "athletics", label: "Athlétisme" },
];

export default function TeamsScreen() {
  const { role } = useAuth();
  const canAssign = role === "admin" || role === "direction" || role === "staff";
  const canManageSports = role === "admin" || role === "direction";
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sportCatalog, setSportCatalog] = useState<SportOpt[]>([]);
  const [filterDisc, setFilterDisc] = useState<number | null>(null);
  const [addSport, setAddSport] = useState("football");
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sportBusy, setSportBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    setErr("");
    const catUrl =
      filterDisc != null
        ? `/api/v1/categories?discipline_id=${filterDisc}`
        : "/api/v1/categories";
    Promise.all([
      api<TeamRow[]>("/api/v1/teams/coaches").catch(() =>
        api<TeamRow[]>("/api/v1/teams").catch(() => [] as TeamRow[]),
      ),
      canAssign
        ? api<Coach[]>("/api/v1/coaches").catch(() => [] as Coach[])
        : Promise.resolve([] as Coach[]),
      api<Discipline[]>("/api/v1/disciplines").catch(() => [] as Discipline[]),
      api<Category[]>(catUrl).catch(() => [] as Category[]),
      api<SportOpt[]>("/api/v1/club/sports").catch(() => [] as SportOpt[]),
    ])
      .then(([t, c, d, cats, sports]) => {
        setTeams(t);
        setCoaches(c);
        setDisciplines(d);
        setCategories(cats);
        setSportCatalog(Array.isArray(sports) && sports.length ? sports : FALLBACK_SPORTS);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [canAssign, filterDisc]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const visibleTeams = useMemo(() => {
    if (filterDisc == null) return teams;
    const catCodes = new Set(categories.map((c) => c.code));
    return teams.filter((t) => {
      if (t.discipline_id != null) return t.discipline_id === filterDisc;
      return !!(t.category_code && catCodes.has(t.category_code));
    });
  }, [teams, filterDisc, categories]);

  function openTeam(t: TeamRow) {
    setSelected(t.id);
    setPicked((t.coaches || []).map((c) => c.user_id));
    setMsg("");
  }

  function toggleCoach(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!selected || !canAssign || saving) return;
    setSaving(true);
    setErr("");
    try {
      await api(`/api/v1/teams/${selected}/coaches`, {
        method: "PUT",
        body: JSON.stringify({
          coaches: picked.map((user_id, i) => ({
            user_id,
            is_primary: i === 0,
            role_label: i === 0 ? "primary" : "coach",
          })),
        }),
      });
      setMsg("Coachs mis à jour");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function onAddSport() {
    if (!canManageSports || sportBusy || !addSport) return;
    setSportBusy(true);
    setErr("");
    try {
      const created = await api<Discipline>("/api/v1/disciplines", {
        method: "POST",
        body: JSON.stringify({ sport: addSport, seed_categories: true }),
      });
      setMsg(`Sport ajouté : ${created.name} (${created.categories_count ?? 0} cat.)`);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSportBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={styles.h}>Équipes / Coachs</Text>
      {loading && <ActivityIndicator color={colors.blue} />}
      {!!err && <Text style={styles.err}>{err}</Text>}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}

      {(canManageSports || disciplines.length > 0) && (
        <View style={styles.card}>
          <Text style={styles.title}>Sports du club (multisport)</Text>
          <Text style={styles.muted}>Football, judo, natation… filtrables ci-dessous.</Text>
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, filterDisc == null && styles.chipOn]}
              onPress={() => setFilterDisc(null)}
            >
              <Text style={[styles.chipT, filterDisc == null && styles.chipTOn]}>Tous</Text>
            </Pressable>
            {disciplines.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.chip, filterDisc === d.id && styles.chipOn]}
                onPress={() => setFilterDisc(d.id)}
              >
                <Text style={[styles.chipT, filterDisc === d.id && styles.chipTOn]}>
                  {d.name} · {d.categories_count ?? "?"} cat.
                </Text>
              </Pressable>
            ))}
            {!disciplines.length && <Text style={styles.muted}>Aucun sport configuré</Text>}
          </View>

          {canManageSports && (
            <View style={{ marginTop: 10, gap: 8 }}>
              <Text style={styles.line}>Ajouter un sport</Text>
              <View style={styles.chips}>
                {(sportCatalog.length ? sportCatalog : FALLBACK_SPORTS).map((s) => (
                  <Pressable
                    key={s.code}
                    style={[styles.chip, addSport === s.code && styles.chipOn]}
                    onPress={() => setAddSport(s.code)}
                  >
                    <Text style={[styles.chipT, addSport === s.code && styles.chipTOn]}>
                      {s.label || statusLabel(s.code) || s.code}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.btn} onPress={onAddSport} disabled={sportBusy}>
                <Text style={styles.btnText}>
                  {sportBusy ? "…" : "Ajouter + catégories d’âge"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {visibleTeams.map((t) => (
        <Pressable
          key={t.id}
          style={[styles.card, selected === t.id && styles.cardOn]}
          onPress={() => openTeam(t)}
        >
          <Text style={styles.title}>{t.name}</Text>
          {!!t.name_ar && <Text style={styles.ar}>{t.name_ar}</Text>}
          <Text style={styles.line}>{t.category_code || "—"}</Text>
          <Text style={styles.muted}>
            {(t.coaches || []).map((c) => c.full_name || `#${c.user_id}`).join(", ") || "Aucun coach"}
          </Text>
        </Pressable>
      ))}
      {!visibleTeams.length && !loading && <Text style={styles.muted}>Aucune équipe</Text>}

      {canAssign && selected != null && (
        <View style={styles.card}>
          <Text style={styles.title}>Affecter des coachs</Text>
          {coaches.map((c) => {
            const on = picked.includes(c.id);
            return (
              <Pressable key={c.id} style={[styles.row, on && styles.rowOn]} onPress={() => toggleCoach(c.id)}>
                <Text style={styles.rowText}>
                  {on ? "✓ " : ""}
                  {c.full_name}
                </Text>
              </Pressable>
            );
          })}
          {!coaches.length && <Text style={styles.muted}>Aucun coach dans le club</Text>}
          <Pressable style={styles.btn} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>{saving ? "…" : "Enregistrer"}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  h: { fontSize: 20, fontWeight: "800", color: colors.blue },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4 },
  cardOn: { borderWidth: 2, borderColor: colors.blue },
  title: { fontWeight: "800", color: colors.navy, fontSize: 15 },
  ar: { color: colors.muted, fontSize: 13 },
  line: { color: "#334155", fontSize: 14 },
  muted: { color: colors.muted, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: colors.softGray,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.blue },
  chipT: { color: colors.navy, fontWeight: "700", fontSize: 12 },
  chipTOn: { color: "white" },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.softGray,
    marginTop: 6,
  },
  rowOn: { backgroundColor: colors.softBlue },
  rowText: { fontWeight: "600", color: "#0f172a" },
  btn: { marginTop: 12, backgroundColor: colors.blue, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  ok: { color: "#16a34a", fontWeight: "700" },
  err: { color: colors.danger, fontWeight: "700" },
});
