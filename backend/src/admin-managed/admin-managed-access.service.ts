import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Request } from 'express';
import {
  AdminAuditEntityType,
  AdminAuditOutcome,
  AdminManagementSessionEndReason,
  AdminRole,
  Prisma,
} from '../../generated/prisma/client';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { AdminAuditService } from 'src/admin-audit/admin-audit.service';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AdminManagedPermission,
  normalizeAdminManagedPermissions,
} from './constants/admin-managed-permissions';
import {
  StartAdminManagementSessionDto,
  UpsertAdminTenantAccessDto,
} from './dto/admin-managed-access.dto';
import {
  AdminActorContext,
  ManagedAdminRequest,
  ManagedFeature,
} from './admin-managed.types';
import { AdminManagedFeatureService } from './admin-managed-feature.service';

type RequestMetadata = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

type AdminHttpRequest = Request & { requestId?: string };

/** Owns managed-store assignments, revocable sessions, and actor resolution. */
@Injectable()
export class AdminManagedAccessService {
  private readonly logger = new Logger(AdminManagedAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly adminAuditService: AdminAuditService,
    private readonly configService: ConfigService,
    private readonly featureService: AdminManagedFeatureService,
  ) {}

  /** Lists non-sensitive administrator records for access assignment. */
  listAdministrators() {
    return this.prisma.adminUser.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        is_active: true,
        created_at: true,
      },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  /** Activates or disables an administrator and terminates sessions on disable. */
  async updateAdministratorActiveStatus(
    targetAdminId: number,
    isActive: boolean,
    actingAdminId: number,
    metadata: RequestMetadata,
  ) {
    if (!isActive && targetAdminId === actingAdminId) {
      throw new ForbiddenException({
        code: 'ADMIN_SELF_DISABLE_FORBIDDEN',
        message: 'A platform administrator cannot disable their own account',
      });
    }

    return this.adminAuditService.runWithSuccessAudit(
      {
        actor: { id: actingAdminId },
        entityType: AdminAuditEntityType.admin,
        entityId: targetAdminId,
        action: isActive ? 'admin.account.enabled' : 'admin.account.disabled',
        title: isActive
          ? 'تم تفعيل حساب المسؤول'
          : 'تم تعطيل حساب المسؤول',
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
        metadata: {
          target_admin_id: targetAdminId,
          is_active: isActive,
        },
      },
      async (tx) => {
        await this.suppressAutomaticTenantAudit(tx);
        const target = await tx.adminUser.findUnique({
          where: { id: targetAdminId },
          select: { id: true },
        });
        if (!target) throw new NotFoundException('Administrator not found');

        if (!isActive) {
          const activeSessions = await tx.adminManagementSession.findMany({
            where: { admin_user_id: targetAdminId, ended_at: null },
            select: { id: true, tenant_id: true },
          });
          await tx.adminManagementSession.updateMany({
            where: { admin_user_id: targetAdminId, ended_at: null },
            data: {
              ended_at: new Date(),
              end_reason: AdminManagementSessionEndReason.admin_disabled,
            },
          });
          for (const session of activeSessions) {
            await this.setTenantContext(tx, session.tenant_id);
            await this.logSessionEnded(
              tx,
              session.tenant_id,
              targetAdminId,
              session.id,
              AdminManagementSessionEndReason.admin_disabled,
              metadata,
            );
          }
        }

        return tx.adminUser.update({
          where: { id: targetAdminId },
          data: { is_active: isActive },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            is_active: true,
          },
        });
      },
    );
  }

  /** Lists active tenant assignments visible to the authenticated administrator. */
  async listAssignedTenants(adminUserId: number) {
    const now = new Date();
    const accesses = await this.prisma.adminTenantAccess.findMany({
      where: {
        admin_user_id: adminUserId,
        is_active: true,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            status: true,
            operated_zone_storefront: {
              select: {
                id: true,
                name: true,
                slug: true,
                is_active: true,
                area: {
                  select: { id: true, name_ar: true, name_en: true, slug: true },
                },
              },
            },
          },
        },
      },
      orderBy: { tenant: { name: 'asc' } },
    });

    return accesses
      .filter((access) => access.tenant.operated_zone_storefront === null)
      .map((access) => ({
        ...access.tenant,
        access: this.mapAccess(access),
      }));
  }

  /** Returns one merchant context when the current admin may inspect it. */
  async getMerchantContext(
    adminUserId: number,
    adminRole: AdminRole,
    tenantId: number,
  ) {
    await this.assertManagedTenantAvailable(tenantId);

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deleted_at: null },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        category: true,
        status: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const access = await this.prisma.adminTenantAccess.findUnique({
      where: {
        admin_user_id_tenant_id: {
          admin_user_id: adminUserId,
          tenant_id: tenantId,
        },
      },
    });

    if (adminRole !== AdminRole.platform_admin && !this.isAccessUsable(access)) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenant,
      current_admin_access: access ? this.mapAccess(access) : null,
      managed_stores_enabled: this.featureService.isStoreManagementEnabled(),
    };
  }

  /** Lists every assignment for a tenant for platform access administration. */
  async listTenantAccesses(tenantId: number) {
    await this.ensureTenantExists(tenantId);
    const accesses = await this.prisma.adminTenantAccess.findMany({
      where: { tenant_id: tenantId },
      include: {
        admin_user: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            is_active: true,
          },
        },
        granted_by_admin: { select: { id: true, name: true } },
      },
      orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
    });

    return accesses.map((access) => ({
      ...this.mapAccess(access),
      admin_user: access.admin_user,
      granted_by_admin: access.granted_by_admin,
    }));
  }

  /** Creates or reactivates one tenant assignment and audits the grant. */
  async upsertTenantAccess(
    tenantId: number,
    adminUserId: number,
    grantedByAdminId: number,
    dto: UpsertAdminTenantAccessDto,
    metadata: RequestMetadata,
  ) {
    await this.ensureTenantExists(tenantId);
    const targetAdmin = await this.prisma.adminUser.findFirst({
      where: { id: adminUserId, is_active: true },
      select: { id: true },
    });
    if (!targetAdmin) throw new NotFoundException('Administrator not found');

    const permissions = normalizeAdminManagedPermissions(dto.permissions);
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new ForbiddenException({
        code: 'ADMIN_ACCESS_EXPIRY_INVALID',
        message: 'Access expiry must be in the future',
      });
    }

    return this.adminAuditService.runWithSuccessAudit(
      {
        actor: { id: grantedByAdminId },
        tenantId,
        entityType: AdminAuditEntityType.tenant,
        entityId: tenantId,
        action: 'admin.tenant_access.granted',
        title: 'تم منح صلاحية إدارة المتجر',
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
        metadata: { target_admin_id: adminUserId },
      },
      async (tx) => {
        await this.suppressAutomaticTenantAudit(tx);
        const previous = await tx.adminTenantAccess.findUnique({
          where: {
            admin_user_id_tenant_id: {
              admin_user_id: adminUserId,
              tenant_id: tenantId,
            },
          },
        });
        const now = new Date();
        const access = await tx.adminTenantAccess.upsert({
          where: {
            admin_user_id_tenant_id: {
              admin_user_id: adminUserId,
              tenant_id: tenantId,
            },
          },
          create: {
            admin_user_id: adminUserId,
            tenant_id: tenantId,
            permissions: permissions as Prisma.InputJsonValue,
            granted_by_admin_id: grantedByAdminId,
            granted_at: now,
            expires_at: expiresAt,
          },
          update: {
            permissions: permissions as Prisma.InputJsonValue,
            is_active: true,
            granted_by_admin_id: grantedByAdminId,
            granted_at: now,
            expires_at: expiresAt,
            revoked_at: null,
          },
        });

        await this.setTenantContext(tx, tenantId);
        await this.activityLogService.create(
          {
            tenantId,
            actorAdminId: grantedByAdminId,
            entityType: ActivityEntityTypes.Tenant,
            entityId: tenantId,
            action: ActivityActions.AdminTenantAccessGranted,
            title: 'تم منح صلاحية إدارة المتجر',
            description: `تم منح مسؤول تجارتك رقم ${adminUserId} صلاحية إدارة المتجر`,
            oldValues: previous
              ? {
                  permissions: normalizeAdminManagedPermissions(
                    previous.permissions,
                  ),
                  expires_at: previous.expires_at?.toISOString() ?? null,
                  is_active: previous.is_active,
                }
              : null,
            newValues: {
              permissions,
              expires_at: expiresAt?.toISOString() ?? null,
              is_active: true,
            },
            metadata: { target_admin_id: adminUserId, access_id: access.id },
            source: ActivitySources.Admin,
            requestId: metadata.requestId,
            ipAddress: metadata.ipAddress,
          },
          tx,
        );

        return this.mapAccess(access);
      },
    );
  }

  /** Revokes an assignment, terminates its sessions, and audits both changes. */
  async revokeTenantAccess(
    tenantId: number,
    adminUserId: number,
    revokedByAdminId: number,
    metadata: RequestMetadata,
  ) {
    return this.adminAuditService.runWithSuccessAudit(
      {
        actor: { id: revokedByAdminId },
        tenantId,
        entityType: AdminAuditEntityType.tenant,
        entityId: tenantId,
        action: 'admin.tenant_access.revoked',
        title: 'تم إلغاء صلاحية إدارة المتجر',
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
        metadata: { target_admin_id: adminUserId },
      },
      async (tx) => {
        await this.suppressAutomaticTenantAudit(tx);
        const access = await tx.adminTenantAccess.findUnique({
          where: {
            admin_user_id_tenant_id: {
              admin_user_id: adminUserId,
              tenant_id: tenantId,
            },
          },
        });
        if (!access) throw new NotFoundException('Tenant access not found');

        const activeSessions = await tx.adminManagementSession.findMany({
          where: { access_id: access.id, ended_at: null },
          select: { id: true },
        });
        const now = new Date();
        await tx.adminTenantAccess.update({
          where: { id: access.id },
          data: { is_active: false, revoked_at: now },
        });
        await tx.adminManagementSession.updateMany({
          where: { access_id: access.id, ended_at: null },
          data: {
            ended_at: now,
            end_reason: AdminManagementSessionEndReason.access_revoked,
          },
        });

        await this.setTenantContext(tx, tenantId);
        for (const session of activeSessions) {
          await this.logSessionEnded(
            tx,
            tenantId,
            adminUserId,
            session.id,
            AdminManagementSessionEndReason.access_revoked,
            metadata,
          );
        }
        await this.activityLogService.create(
          {
            tenantId,
            actorAdminId: revokedByAdminId,
            entityType: ActivityEntityTypes.Tenant,
            entityId: tenantId,
            action: ActivityActions.AdminTenantAccessRevoked,
            title: 'تم إلغاء صلاحية إدارة المتجر',
            description: `تم إلغاء صلاحية مسؤول تجارتك رقم ${adminUserId}`,
            oldValues: {
              permissions: normalizeAdminManagedPermissions(
                access.permissions,
              ),
              is_active: access.is_active,
            },
            newValues: { is_active: false, revoked_at: now.toISOString() },
            metadata: { target_admin_id: adminUserId, access_id: access.id },
            source: ActivitySources.Admin,
            requestId: metadata.requestId,
            ipAddress: metadata.ipAddress,
          },
          tx,
        );

        return { success: true };
      },
    );
  }

  /** Starts one opaque-token session after validating the tenant assignment. */
  async startSession(
    adminUserId: number,
    dto: StartAdminManagementSessionDto,
    metadata: RequestMetadata,
  ) {
    this.featureService.assertStoreManagementEnabled();
    await this.assertManagedTenantAvailable(dto.tenant_id);

    const access = await this.prisma.adminTenantAccess.findUnique({
      where: {
        admin_user_id_tenant_id: {
          admin_user_id: adminUserId,
          tenant_id: dto.tenant_id,
        },
      },
      include: {
        admin_user: { select: { is_active: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            operated_zone_storefront: { select: { id: true, slug: true } },
          },
        },
      },
    });
    if (!access || !this.isAccessUsable(access) || !access.admin_user.is_active) {
      throw new ForbiddenException({
        code: 'ADMIN_TENANT_ACCESS_REQUIRED',
        message: 'Active tenant access is required',
      });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.getMaximumLifetimeHours() * 60 * 60 * 1000,
    );

    const session = await this.prisma.$transaction(async (tx) => {
      await this.suppressAutomaticTenantAudit(tx);
      const previousSessions = await tx.adminManagementSession.findMany({
        where: { admin_user_id: adminUserId, ended_at: null },
        select: { id: true, tenant_id: true },
      });
      await tx.adminManagementSession.updateMany({
        where: { admin_user_id: adminUserId, ended_at: null },
        data: {
          ended_at: now,
          end_reason: AdminManagementSessionEndReason.store_switch,
        },
      });
      for (const previous of previousSessions) {
        await this.setTenantContext(tx, previous.tenant_id);
        await this.logSessionEnded(
          tx,
          previous.tenant_id,
          adminUserId,
          previous.id,
          AdminManagementSessionEndReason.store_switch,
          metadata,
        );
      }

      const created = await tx.adminManagementSession.create({
        data: {
          session_token_hash: tokenHash,
          admin_user_id: adminUserId,
          tenant_id: dto.tenant_id,
          access_id: access.id,
          reason: dto.reason.trim(),
          expires_at: expiresAt,
          ip_address: metadata.ipAddress,
          user_agent: metadata.userAgent?.slice(0, 512),
        },
      });
      await this.setTenantContext(tx, dto.tenant_id);
      await this.activityLogService.create(
        {
          tenantId: dto.tenant_id,
          actorAdminId: adminUserId,
          managementSessionId: created.id,
          entityType: ActivityEntityTypes.Tenant,
          entityId: dto.tenant_id,
          action: ActivityActions.ManagementSessionStarted,
          title: 'بدأت جلسة إدارة المتجر',
          description: dto.reason.trim(),
          metadata: { access_id: access.id },
          source: ActivitySources.Admin,
          requestId: metadata.requestId,
          ipAddress: metadata.ipAddress,
        },
        tx,
      );
      await this.adminAuditService.record(
        {
          actor: { id: adminUserId },
          tenantId: dto.tenant_id,
          managementSessionId: created.id,
          entityType: AdminAuditEntityType.management_session,
          entityId: created.id,
          action: 'management_session.started',
          title: 'تم بدء جلسة إدارة المتجر',
          outcome: AdminAuditOutcome.success,
          requestId: metadata.requestId,
          ipAddress: metadata.ipAddress,
          metadata: { access_id: access.id },
        },
        tx,
      );
      return created;
    });

    return {
      session_token: rawToken,
      session: this.mapSession(session, access.tenant, access.permissions),
    };
  }

  /** Returns the current session when its cookie belongs to the current admin. */
  async getCurrentSession(
    adminUserId: number,
    rawToken?: string,
    metadata: RequestMetadata = {},
  ) {
    if (!rawToken) return null;
    const session = await this.prisma.adminManagementSession.findFirst({
      where: {
        session_token_hash: this.hashToken(rawToken),
        admin_user_id: adminUserId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            operated_zone_storefront: { select: { id: true, slug: true } },
          },
        },
        access: true,
      },
    });
    if (!session || session.ended_at) return null;
    if (session.tenant.operated_zone_storefront) {
      return null;
    }

    const now = new Date();
    const idleDeadline = new Date(
      session.last_active_at.getTime() +
        this.getInactivityMinutes() * 60 * 1000,
    );
    const expiryReason = session.expires_at <= now
      ? AdminManagementSessionEndReason.absolute_timeout
      : idleDeadline <= now
        ? AdminManagementSessionEndReason.idle_timeout
        : !this.isAccessUsable(session.access)
          ? AdminManagementSessionEndReason.access_revoked
          : null;
    if (expiryReason) {
      await this.endCurrentSession(
        adminUserId,
        rawToken,
        expiryReason,
        metadata,
      );
      return null;
    }

    return this.mapSession(
      session,
      session.tenant,
      session.access.permissions,
    );
  }

  /** Ends the current session when it belongs to the authenticated administrator. */
  async endCurrentSession(
    adminUserId: number,
    rawToken: string | undefined,
    reason: AdminManagementSessionEndReason,
    metadata: RequestMetadata,
  ) {
    if (!rawToken) return { success: true };
    const session = await this.prisma.adminManagementSession.findFirst({
      where: {
        session_token_hash: this.hashToken(rawToken),
        admin_user_id: adminUserId,
        ended_at: null,
      },
    });
    if (!session) return { success: true };

    await this.prisma.$transaction(async (tx) => {
      await this.suppressAutomaticTenantAudit(tx);
      await tx.adminManagementSession.update({
        where: { id: session.id },
        data: { ended_at: new Date(), end_reason: reason },
      });
      await this.setTenantContext(tx, session.tenant_id);
      await this.logSessionEnded(
        tx,
        session.tenant_id,
        adminUserId,
        session.id,
        reason,
        metadata,
      );
      await this.adminAuditService.record(
        {
          actor: { id: adminUserId },
          tenantId: session.tenant_id,
          managementSessionId: session.id,
          entityType: AdminAuditEntityType.management_session,
          entityId: session.id,
          action: 'management_session.ended',
          title: 'تم إنهاء جلسة إدارة المتجر',
          outcome: AdminAuditOutcome.success,
          requestId: metadata.requestId,
          ipAddress: metadata.ipAddress,
          metadata: { end_reason: reason },
        },
        tx,
      );
    });
    return { success: true };
  }

  /** Resolves and refreshes one managed actor for an incoming route. */
  async resolveActor(
    request: ManagedAdminRequest,
    tenantId: number,
    requiredPermissions: AdminManagedPermission[],
    feature?: ManagedFeature,
  ): Promise<AdminActorContext> {
    this.featureService.assertFeatureEnabled(feature);
    await this.assertManagedTenantAvailable(tenantId);

    const adminUserId = request.user?.userId;
    const rawToken = this.extractSessionToken(request);
    if (!adminUserId || !rawToken) {
      throw new ForbiddenException({
        code: 'MANAGEMENT_SESSION_REQUIRED',
        message: 'An active management session is required',
      });
    }

    const session = await this.prisma.adminManagementSession.findUnique({
      where: { session_token_hash: this.hashToken(rawToken) },
      include: {
        admin_user: { select: { id: true, is_active: true } },
        access: true,
      },
    });
    if (!session || session.admin_user_id !== adminUserId) {
      await this.logDenied(request, tenantId, 'MANAGEMENT_SESSION_INVALID');
      throw new ForbiddenException({
        code: 'MANAGEMENT_SESSION_INVALID',
        message: 'The management session is invalid',
      });
    }
    if (session.tenant_id !== tenantId) {
      await this.logDenied(request, tenantId, 'MANAGEMENT_TENANT_MISMATCH');
      throw new NotFoundException('Managed tenant resource not found');
    }

    const now = new Date();
    const idleDeadline = new Date(
      session.last_active_at.getTime() +
        this.getInactivityMinutes() * 60 * 1000,
    );
    let endReason: AdminManagementSessionEndReason | null = null;
    if (session.ended_at)
      endReason =
        session.end_reason ?? AdminManagementSessionEndReason.user_exit;
    else if (!session.admin_user.is_active)
      endReason = AdminManagementSessionEndReason.admin_disabled;
    else if (session.expires_at <= now)
      endReason = AdminManagementSessionEndReason.absolute_timeout;
    else if (idleDeadline <= now)
      endReason = AdminManagementSessionEndReason.idle_timeout;
    else if (!this.isAccessUsable(session.access))
      endReason = AdminManagementSessionEndReason.access_revoked;

    if (endReason) {
      if (!session.ended_at) {
        await this.endCurrentSession(adminUserId, rawToken, endReason, {
          requestId: request.requestId,
          ipAddress: this.getRequestIp(request),
          userAgent: request.headers['user-agent'],
        });
      }
      throw new ForbiddenException({
        code: 'MANAGEMENT_SESSION_EXPIRED',
        message: 'The management session has ended',
      });
    }

    const permissions = normalizeAdminManagedPermissions(
      session.access.permissions,
    );
    const permissionSet = new Set(permissions);
    const missing = requiredPermissions.filter(
      (permission) => !permissionSet.has(permission),
    );
    if (missing.length > 0) {
      await this.logDenied(
        request,
        tenantId,
        'MANAGEMENT_PERMISSION_DENIED',
        missing,
      );
      throw new ForbiddenException({
        code: 'MANAGEMENT_PERMISSION_DENIED',
        missing_permissions: missing,
        message: 'The management session lacks a required permission',
      });
    }

    await this.prisma.adminManagementSession.update({
      where: { id: session.id },
      data: { last_active_at: now },
    });

    return {
      actorType: 'admin_user',
      actorId: adminUserId,
      adminId: adminUserId,
      adminName: request.user!.name,
      adminRole: request.user!.role,
      tenantId,
      managementSessionId: session.id,
      permissions,
      source: ActivitySources.Admin,
      requestId: request.requestId,
      ipAddress: this.getRequestIp(request),
    };
  }

  /** Lists recent sessions for one tenant without exposing token hashes. */
  async listTenantSessions(tenantId: number, limit = 20) {
    await this.ensureTenantExists(tenantId);
    const safeLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 20;
    return this.prisma.adminManagementSession.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        reason: true,
        started_at: true,
        last_active_at: true,
        expires_at: true,
        ended_at: true,
        end_reason: true,
        ip_address: true,
        admin_user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { started_at: 'desc' },
      take: safeLimit,
    });
  }

  getRequestMetadata(request: AdminHttpRequest): RequestMetadata {
    return {
      requestId: request.requestId,
      ipAddress: this.getRequestIp(request),
      userAgent: request.headers['user-agent'],
    };
  }

  extractSessionToken(request: AdminHttpRequest): string | undefined {
    const value = request.cookies?.admin_management_session as unknown;
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private getRequestIp(request: AdminHttpRequest): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : request.ip;
    return ipAddress?.slice(0, 64);
  }

  private getInactivityMinutes(): number {
    const value = Number(
      this.configService.get<string>(
        'ADMIN_MANAGEMENT_SESSION_IDLE_MINUTES',
      ) ?? 45,
    );
    return Number.isFinite(value) && value > 0 ? value : 45;
  }

  private getMaximumLifetimeHours(): number {
    const value = Number(
      this.configService.get<string>(
        'ADMIN_MANAGEMENT_SESSION_MAX_HOURS',
      ) ?? 8,
    );
    return Number.isFinite(value) && value > 0 ? value : 8;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private isAccessUsable(
    access:
      | {
          is_active: boolean;
          revoked_at: Date | null;
          expires_at: Date | null;
        }
      | null
      | undefined,
  ): boolean {
    return Boolean(
      access?.is_active &&
        !access.revoked_at &&
        (!access.expires_at || access.expires_at > new Date()),
    );
  }

  private mapAccess(access: {
    id: number;
    admin_user_id: number;
    tenant_id: number;
    permissions: unknown;
    is_active: boolean;
    granted_by_admin_id: number | null;
    granted_at: Date;
    expires_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      ...access,
      permissions: normalizeAdminManagedPermissions(access.permissions),
    };
  }

  private mapSession(
    session: {
      id: number;
      admin_user_id: number;
      tenant_id: number;
      reason: string;
      started_at: Date;
      last_active_at: Date;
      expires_at: Date;
      ended_at: Date | null;
      end_reason: AdminManagementSessionEndReason | null;
    },
    tenant: {
      id: number;
      name: string;
      slug: string;
      status: unknown;
      operated_zone_storefront?: { id: number; slug: string } | null;
    },
    permissions: unknown,
  ) {
    return {
      id: session.id,
      admin_user_id: session.admin_user_id,
      tenant_id: session.tenant_id,
      reason: session.reason,
      started_at: session.started_at,
      last_active_at: session.last_active_at,
      expires_at: session.expires_at,
      ended_at: session.ended_at,
      end_reason: session.end_reason,
      tenant,
      permissions: normalizeAdminManagedPermissions(permissions),
    };
  }

  /** Rejects retired zone operator tenants from generic managed-store access. */
  private async assertManagedTenantAvailable(tenantId: number): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        deleted_at: null,
        operated_zone_storefront: { is: null },
      },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }

  private async ensureTenantExists(tenantId: number): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }

  private async setTenantContext(
    tx: Prisma.TransactionClient,
    tenantId: number,
  ): Promise<void> {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
  }

  /** Prevents tenant activity triggers from duplicating an explicit audit summary. */
  private async suppressAutomaticTenantAudit(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`SELECT set_config('app.admin_activity_audit_recorded', 'true', true)`;
  }

  private async logSessionEnded(
    tx: Prisma.TransactionClient,
    tenantId: number,
    adminUserId: number,
    sessionId: number,
    reason: AdminManagementSessionEndReason,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.activityLogService.create(
      {
        tenantId,
        actorAdminId: adminUserId,
        managementSessionId: sessionId,
        entityType: ActivityEntityTypes.Tenant,
        entityId: tenantId,
        action: ActivityActions.ManagementSessionEnded,
        title: 'انتهت جلسة إدارة المتجر',
        description: `سبب انتهاء الجلسة: ${reason}`,
        metadata: { end_reason: reason },
        source: ActivitySources.Admin,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
      },
      tx,
    );
  }

  /** Emits structured context for managed-access denials. */
  private async logDenied(
    request: ManagedAdminRequest,
    tenantId: number,
    code: string,
    missingPermissions?: string[],
  ): Promise<void> {
    this.logger.warn(
      JSON.stringify({
        event: 'admin_managed_access_denied',
        code,
        requestId: request.requestId,
        adminUserId: request.user?.userId,
        tenantId,
        missingPermissions,
      }),
    );
  }
}
