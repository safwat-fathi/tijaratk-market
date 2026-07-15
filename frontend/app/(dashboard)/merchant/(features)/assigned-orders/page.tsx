import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AssignedOrdersPage() {
  redirect("/merchant/orders?tab=assigned");
}
