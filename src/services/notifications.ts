import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true
  })
});

export async function requestNotificationAccess(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleDailyReminder(time: string): Promise<boolean> {
  const granted = await requestNotificationAccess();

  if (!granted) {
    return false;
  }

  const [hour, minute] = time.split(":").map(Number);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Tu ritual diario te espera",
      body: "Abri tu mensaje del dia y elegi una accion simple."
    },
    trigger: {
      hour: Number.isFinite(hour) ? hour : 9,
      minute: Number.isFinite(minute) ? minute : 0,
      repeats: true
    }
  });

  return true;
}
