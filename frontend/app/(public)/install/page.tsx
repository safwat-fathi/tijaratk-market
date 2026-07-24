import { Metadata } from "next";
import InstallGuide from "./_components/InstallGuide";

export const metadata: Metadata = {
  title: "تثبيت التطبيق - تجارتك",
  description: "دليل تثبيت تطبيق تجارتك على جهازك بخطوات بسيطة.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
