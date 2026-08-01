import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { API_BASE, APP_VERSION, APP_VERSION_CODE } from "../config";
import { colors } from "../theme";

export type AppUpdateInfo = {
  platform: string;
  latest_version: string;
  latest_version_code: number;
  apk_url: string;
  force_update: boolean;
  release_notes?: string;
  release_notes_ar?: string;
  min_supported_version_code?: number;
};

function isNewer(remote: AppUpdateInfo): boolean {
  if (remote.latest_version_code > APP_VERSION_CODE) return true;
  if (!APP_VERSION_CODE && remote.latest_version && remote.latest_version !== APP_VERSION) {
    return remote.latest_version.localeCompare(APP_VERSION, undefined, { numeric: true }) > 0;
  }
  return false;
}

async function fetchUpdateInfo(): Promise<AppUpdateInfo | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`${API_BASE}/api/v1/mobile/app-update`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as AppUpdateInfo;
  } catch {
    return null;
  }
}

async function installApk(apkUrl: string) {
  if (Platform.OS !== "android") {
    await Linking.openURL(apkUrl);
    return;
  }
  const base = FileSystem.cacheDirectory;
  if (!base) {
    await Linking.openURL(apkUrl);
    return;
  }
  const dest = `${base}wrbh-update.apk`;
  const dl = await FileSystem.downloadAsync(apkUrl, dest);
  const contentUri = await FileSystem.getContentUriAsync(dl.uri);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: 1,
    type: "application/vnd.android.package-archive",
  });
}

/**
 * À chaque entrée / reprise de l’app : interroge le serveur.
 * Si une APK plus récente existe → modal « Mettre à jour ».
 */
export function UpdateGate() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    const remote = await fetchUpdateInfo();
    if (!remote?.apk_url) return;
    if (isNewer(remote)) {
      setInfo(remote);
      setVisible(true);
      setError("");
    } else {
      setVisible(false);
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  async function onUpdate() {
    if (!info?.apk_url) return;
    setBusy(true);
    setError("");
    try {
      await installApk(info.apk_url);
    } catch (e) {
      // Repli : ouvrir le lien dans le navigateur / téléchargements
      try {
        await Linking.openURL(info.apk_url);
      } catch {
        setError(e instanceof Error ? e.message : "Échec du téléchargement");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!visible || !info) return null;

  const force = !!info.force_update;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !force && setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>MISE À JOUR</Text>
          <Text style={styles.title}>Nouvelle version disponible</Text>
          <Text style={styles.ar}>يتوفر تحديث جديد للتطبيق</Text>
          <Text style={styles.version}>
            {APP_VERSION} (code {APP_VERSION_CODE || "—"}) → {info.latest_version} (code {info.latest_version_code})
          </Text>
          {!!info.release_notes && <Text style={styles.notes}>{info.release_notes}</Text>}
          {!!info.release_notes_ar && <Text style={styles.notesAr}>{info.release_notes_ar}</Text>}
          {!!error && <Text style={styles.err}>{error}</Text>}

          <Pressable style={[styles.btn, busy && { opacity: 0.7 }]} onPress={onUpdate} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <Text style={styles.btnText}>Mettre à jour maintenant / تحديث الآن</Text>
            )}
          </Pressable>

          {!force && (
            <Pressable style={styles.later} onPress={() => setVisible(false)} disabled={busy}>
              <Text style={styles.laterText}>Plus tard / لاحقاً</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>
            Android proposera d’installer l’APK. Autorisez l’installation si demandé.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,31,77,0.72)",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    color: colors.navy,
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.navy },
  ar: { color: colors.blue, fontSize: 15, fontWeight: "700" },
  version: { color: colors.muted, fontWeight: "700" },
  notes: { color: colors.navy, lineHeight: 20 },
  notesAr: { color: colors.muted, lineHeight: 20, textAlign: "right" },
  err: { color: colors.danger, fontWeight: "700" },
  btn: {
    marginTop: 6,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.navy, fontWeight: "900", textAlign: "center" },
  later: { alignItems: "center", paddingVertical: 8 },
  laterText: { color: colors.muted, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
