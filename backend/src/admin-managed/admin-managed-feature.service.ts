import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManagedFeature } from './admin-managed.types';

const FEATURE_ENV: Record<ManagedFeature, string> = {
  product_write: 'ADMIN_PRODUCT_WRITE_ENABLED',
  order_write: 'ADMIN_ORDER_WRITE_ENABLED',
  bulk_write: 'ADMIN_BULK_PRODUCT_UPDATE_ENABLED',
};

/** Resolves managed-store rollout flags, all of which default to disabled. */
@Injectable()
export class AdminManagedFeatureService {
  constructor(private readonly configService: ConfigService) {}

  isStoreManagementEnabled(): boolean {
    return this.isEnabled('ADMIN_MANAGED_STORES_ENABLED');
  }

  assertStoreManagementEnabled(): void {
    if (!this.isStoreManagementEnabled()) {
      throw new ForbiddenException({
        code: 'ADMIN_MANAGED_STORES_DISABLED',
        message: 'Managed-store access is disabled',
      });
    }
  }

  assertFeatureEnabled(feature?: ManagedFeature): void {
    this.assertStoreManagementEnabled();
    if (feature && !this.isEnabled(FEATURE_ENV[feature])) {
      throw new ForbiddenException({
        code: 'ADMIN_MANAGED_FEATURE_DISABLED',
        feature,
        message: 'This managed-store capability is disabled',
      });
    }
  }

  private isEnabled(key: string): boolean {
    return this.configService.get<string>(key)?.trim().toLowerCase() === 'true';
  }
}
