import { requireMember } from "@/platform/auth/session";
import { pushConfigured, subscriptionCount, vapidPublicKey } from "@/platform/notifications/push";
import { getPrefs } from "@/platform/notifications/service";
import { AppHeader, Section } from "@/ui";
import { PrefsTable } from "./PrefsTable";
import { PushSetup } from "./PushSetup";

export const metadata = { title: "Cài đặt thông báo" };
export const dynamic = "force-dynamic";

/** NOT-03/04/05 Notification / Email / Push Preferences (mockup 271). */
export default async function NotificationSettingsPage() {
  const me = await requireMember("/more/notifications");
  const [prefs, subs] = await Promise.all([getPrefs(me.id), subscriptionCount(me.id)]);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Thông báo" />
      <Section title="Thông báo đẩy trên thiết bị này">
        <PushSetup configured={pushConfigured()} publicKey={vapidPublicKey()} devices={subs} />
      </Section>
      <Section title="Nhận gì, qua kênh nào">
        <PrefsTable initial={prefs} />
      </Section>
    </>
  );
}
