import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadPhoto } from "../api/client";
import { colors } from "../theme";

type Props = {
  value?: string | null;
  onUploaded: (path: string) => void;
};

export function PhotoPicker({ value, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    setBusy(true);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission", "Autorisez l’accès caméra / photos pour continuer.");
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
            aspect: [1, 1],
          });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      setLocalUri(asset.uri);
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const mime = asset.mimeType || "image/jpeg";
      const uploaded = await uploadPhoto({ uri: asset.uri, name, type: mime });
      onUploaded(uploaded.path);
    } catch (e) {
      Alert.alert("Photo", e instanceof Error ? e.message : "Échec upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}>
        {localUri || value ? (
          <Image source={{ uri: localUri || value || undefined }} style={styles.img} />
        ) : (
          <Text style={styles.ph}>Photo</Text>
        )}
      </View>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void pick(true)} disabled={busy}>
          <Text style={styles.btnText}>Capturer</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void pick(false)} disabled={busy}>
          <Text style={styles.btnText}>Importer</Text>
        </Pressable>
      </View>
      {busy && <ActivityIndicator color={colors.blue} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  preview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#e8eef8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  ph: { color: colors.muted },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btn: {
    backgroundColor: "#edf2ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnText: { color: colors.blue, fontWeight: "700" },
});
