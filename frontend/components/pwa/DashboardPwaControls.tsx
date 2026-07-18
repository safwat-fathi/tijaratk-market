"use client";

import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import { PushNotificationsControl } from "@/components/pwa/PushNotificationsControl";
import type {
  PushNotificationsConfig,
  PushScope,
} from "@/types/services/push-notifications";

type DashboardPwaControlsProps = {
  scope: PushScope;
  appName: string;
  config: PushNotificationsConfig;
  installId?: string;
};

/** Displays one shared install/notification toolbar for a dashboard shell. */
export const DashboardPwaControls = ({
  scope,
  appName,
  config,
  installId,
}: DashboardPwaControlsProps) => (
  <div className="fixed end-4 top-3 z-50 flex items-center gap-2 lg:end-8 lg:top-4">
    <PushNotificationsControl scope={scope} config={config} />
    <InstallPwaAction
      id={installId}
      appName={appName}
      className="border-brand-border bg-white text-brand-primary shadow-sm hover:bg-brand-soft focus-visible:ring-brand-accent/20"
      iconClassName="h-5 w-5"
    />
  </div>
);
