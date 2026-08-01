import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Empêche un crash JS d’écran noir au démarrage / pendant l’usage. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WRBH ErrorBoundary", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.ar}>حدث خطأ — أعد المحاولة</Text>
        <Text style={styles.msg}>{this.state.error.message || "Erreur inattendue"}</Text>
        <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
          <Text style={styles.btnText}>Réessayer / إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.blue,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  title: { color: "white", fontSize: 22, fontWeight: "800", textAlign: "center" },
  ar: { color: colors.gold, textAlign: "center", fontSize: 16 },
  msg: { color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 8,
    backgroundColor: colors.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  btnText: { color: colors.navy, fontWeight: "800" },
});
