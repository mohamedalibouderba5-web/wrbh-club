import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Register Expo push token with the club API (best-effort, never throws to UI). */
export async function registerPushToken(): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
      Constants.easConfig?.projectId;
    const tokenRes = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    if (!token) return;

    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
    await api(`/api/v1/push-tokens?token=${encodeURIComponent(token)}&platform=${platform}`, {
      method: "POST",
    });
  } catch {
    // Push is optional until FCM credentials are configured on the device/build.
  }
}
