export type ActivityEntityType =
  | "order"
  | "product"
  | "customer"
  | "tenant"
  | "user"
  | "subscription"
  | "day_closure"
  | "csv_import";

export type ActivitySource =
  | "dashboard"
  | "storefront"
  | "admin"
  | "system"
  | "whatsapp"
  | "csv_import";

export type ActivityActor = {
  type: "user" | "admin" | "system" | "customer";
  id: number | null;
  name: string;
  role?: string;
};

export type ActivityLog = {
  id: number;
  entity_type: ActivityEntityType;
  entity_id: number | null;
  action: string;
  title: string;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  source: ActivitySource;
  actor: ActivityActor;
  created_at: string;
};

export type ActivityLogsResponse = {
  items: ActivityLog[];
  next_cursor: number | null;
};

export type GetActivityLogsParams = {
  entity_type?: ActivityEntityType;
  entity_id?: number;
  action?: string;
  cursor?: number;
  limit?: number;
};

