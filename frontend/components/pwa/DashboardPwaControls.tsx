"use client";

import InstallPwaAction from "@/components/pwa/InstallPwaAction";

type DashboardPwaInstallActionProps = {
  appName: string;
  installId?: string;
};

/** Keeps the dashboard install action inside the shared sidebar on every viewport. */
export const DashboardPwaInstallAction = ({
  appName,
  installId,
}: DashboardPwaInstallActionProps) => (
  <InstallPwaAction
    id={installId}
    appName={appName}
    buttonText="تثبيت التطبيق"
    className="w-full justify-start border-brand-border bg-brand-soft/60 text-brand-primary hover:bg-brand-soft focus-visible:ring-brand-accent/20"
    iconClassName="h-5 w-5"
  />
);
