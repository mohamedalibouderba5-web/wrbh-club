import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferred = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    setCanInstall(false);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      return true;
    }
    return false;
  }

  return { canInstall, installed, install };
}

export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker.ready.then((reg) => {
      if (!cancelled) setRegistration(reg);
    });

    const onControllerChange = () => {
      // Nouvelle version active → rechargement
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!registration) return;
    const onUpdateFound = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    };
    registration.addEventListener("updatefound", onUpdateFound);
    if (registration.waiting) setUpdateReady(true);
    return () => registration.removeEventListener("updatefound", onUpdateFound);
  }, [registration]);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return false;
    setChecking(true);
    try {
      await registration.update();
      if (registration.waiting) {
        setUpdateReady(true);
        return true;
      }
      return false;
    } finally {
      setChecking(false);
    }
  }, [registration]);

  const applyUpdate = useCallback(() => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    // Fallback : hard reload
    window.location.reload();
  }, [registration]);

  // Vérifie à la reprise de focus (mise à jour en arrière-plan)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => checkForUpdate(), 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [checkForUpdate]);

  return { updateReady, checking, checkForUpdate, applyUpdate };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
