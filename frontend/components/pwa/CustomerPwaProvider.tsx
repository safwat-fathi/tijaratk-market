import { cache } from "react";
import { customerPushNotificationsService } from "@/services/api/push-notifications.service";
import CustomerPwaEngagement from "./CustomerPwaEngagement";
import KeyboardStateDetector from "./KeyboardStateDetector";

/**
 * Mounts the customer PWA shell on customer-facing routes only.
 *
 * This used to live in the root layout, which pulled ~900 lines of client code
 * into every admin and merchant page and — because the layout awaited the push
 * config — made every route in the application dynamically rendered.
 */

const getPushConfig = cache(async () => {
  const response = await customerPushNotificationsService.getConfig();
  return response.success && response.data ? response.data : { enabled: false };
});

export default async function CustomerPwaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getPushConfig();

  return (
    <>
      <KeyboardStateDetector />
      <CustomerPwaEngagement config={config}>{children}</CustomerPwaEngagement>
    </>
  );
}
