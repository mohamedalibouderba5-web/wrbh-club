export function DownloadPage() {
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <img src="/logo.png" alt="WRBH" width={72} height={72} style={{ borderRadius: "50%" }} />
        <div>
          <h2 style={{ margin: 0 }}>Télécharger l'application WRBH</h2>
          <div style={{ fontFamily: "Noto Sans Arabic, sans-serif", color: "var(--muted)" }}>
            تطبيق الوداد الرياضي لبلدية حمادي
          </div>
        </div>
      </div>
      <p>Parents : suivez vos enfants, le planning, les convocations et les cotisations.</p>
      <p>Coaches : présences, convocations et agenda du jour.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <a className="badge" href="#" style={{ padding: "0.8rem 1rem", background: "var(--blue)", color: "white" }}>
          Android APK (EAS Build)
        </a>
        <a className="badge" href="#" style={{ padding: "0.8rem 1rem", background: "var(--yellow)", color: "var(--blue-deep)" }}>
          iOS TestFlight
        </a>
      </div>
      <p style={{ marginTop: 16, color: "var(--muted)", fontSize: "0.9rem" }}>
        Builds : voir <code>mobile/README.md</code> — <code>eas build -p android</code> / <code>eas build -p ios</code>.
        Deep link prévu : <code>wrbh://</code>
      </p>
      <img src="/affiche.jpg" alt="Affiche inscriptions" style={{ width: "100%", borderRadius: 12, marginTop: 16 }} />
    </div>
  );
}
