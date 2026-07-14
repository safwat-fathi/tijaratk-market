import type { AdminRole } from "./activity-log";

export type AdminAuditOutcome = "success" | "denied";

export type AdminAuditLog = {
  id: number;
  actor: {
    id: number | null;
    name: string;
    role: AdminRole | null;
  };
  tenant: { id: number; name: string } | null;
  management_session_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  action: string;
  title: string;
  outcome: AdminAuditOutcome;
  request_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminAuditLogsResponse = {
  items: AdminAuditLog[];
  next_cursor: number | null;
};

export type GetAdminAuditLogsParams = {
  admin_id?: number;
  role?: AdminRole;
  tenant_id?: number;
  action?: string;
  outcome?: AdminAuditOutcome;
  from?: string;
  to?: string;
  cursor?: number;
  limit?: number;
};
