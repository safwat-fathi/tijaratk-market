import { AsyncLocalStorage } from 'node:async_hooks';

type AdminAuditRequestStore = {
  tenantActivityRecorded: boolean;
  requestAuditRecorded: boolean;
};

/** Tracks whether the current request already emitted an atomic tenant audit. */
export class AdminAuditContext {
  private static readonly storage =
    new AsyncLocalStorage<AdminAuditRequestStore>();

  /** Starts one request-local audit context. */
  static run<T>(callback: () => T): T {
    return this.storage.run(
      { tenantActivityRecorded: false, requestAuditRecorded: false },
      callback,
    );
  }

  /** Marks that an admin-attributed tenant activity was persisted. */
  static markTenantActivityRecorded(): void {
    const store = this.storage.getStore();
    if (store) store.tenantActivityRecorded = true;
  }

  /** Reports whether the request already has an atomic tenant audit summary. */
  static hasTenantActivityRecord(): boolean {
    return this.storage.getStore()?.tenantActivityRecorded ?? false;
  }

  /** Marks that a request-level control-plane audit was persisted. */
  static markRequestAuditRecorded(): void {
    const store = this.storage.getStore();
    if (store) store.requestAuditRecorded = true;
  }

  /** Reports whether a request-level control-plane audit already exists. */
  static hasRequestAuditRecord(): boolean {
    return this.storage.getStore()?.requestAuditRecorded ?? false;
  }
}
