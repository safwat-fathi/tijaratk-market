import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { parsePhoneNumber } from 'libphonenumber-js';
import {
  AdminAuditEntityType,
  AdminAuditOutcome,
  AdminRole,
} from '../../../generated/prisma/client';
import { AdminAuditService } from '../../admin-audit/admin-audit.service';
import { normalizePhoneNumber } from '../../common/utils/phone.utils';
import { PrismaService } from '../../prisma/prisma.service';

const BCRYPT_COST = 10;
const ADMIN_NAME_MIN_LENGTH = 2;
const ADMIN_NAME_MAX_LENGTH = 160;
const ADMIN_PASSWORD_MIN_LENGTH = 12;
const BCRYPT_PASSWORD_MAX_BYTES = 72;

export type CreateAdminInput = {
  name: string;
  phone: string;
  role: AdminRole;
  password: string;
  passwordConfirmation: string;
};

export type ProvisionedAdmin = {
  id: number;
  name: string;
  phone: string;
  role: AdminRole;
};

/** Represents a safe, user-facing failure from administrator provisioning. */
export class AdminProvisioningError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = AdminProvisioningError.name;
  }
}

/** Returns a safe validation message when an administrator password is invalid. */
export function validateAdminPassword(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `Password must contain at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_PASSWORD_MAX_BYTES) {
    return `Password must not exceed ${BCRYPT_PASSWORD_MAX_BYTES} UTF-8 bytes.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain a number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain a symbol.';
  }
  return null;
}

/** Creates administrator accounts with an atomic control-plane audit event. */
@Injectable()
export class AdminProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  /** Validates and creates a new active administrator from a trusted CLI call. */
  async createAdmin(input: CreateAdminInput): Promise<ProvisionedAdmin> {
    const name = this.normalizeName(input.name);
    const phone = this.normalizeEgyptianPhone(input.phone);
    const role = this.validateRole(input.role);
    this.validatePassword(input.password, input.passwordConfirmation);

    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new AdminProvisioningError(
        'An administrator with this phone number already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const requestId = `cli-${randomUUID()}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const admin = await tx.adminUser.create({
          data: {
            name,
            phone,
            password: passwordHash,
            role,
            is_active: true,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
          },
        });

        await this.adminAuditService.record(
          {
            actor: null,
            entityType: AdminAuditEntityType.admin,
            entityId: admin.id,
            action: 'admin.account.created_cli',
            title: 'تم إنشاء حساب مسؤول من سطر الأوامر',
            outcome: AdminAuditOutcome.success,
            requestId,
            metadata: {
              source: 'cli',
              created_admin_role: role,
            },
          },
          tx,
        );

        return admin;
      });
    } catch (error) {
      if (error instanceof AdminProvisioningError) throw error;
      if (this.isUniqueConstraintError(error)) {
        throw new AdminProvisioningError(
          'An administrator with this phone number already exists.',
        );
      }
      throw new AdminProvisioningError(
        'Administrator creation failed. No changes were saved.',
        { cause: error },
      );
    }
  }

  /** Trims and bounds an administrator display name for audit snapshots. */
  private normalizeName(value: string): string {
    const name = typeof value === 'string' ? value.trim() : '';
    const length = Array.from(name).length;
    if (length < ADMIN_NAME_MIN_LENGTH || length > ADMIN_NAME_MAX_LENGTH) {
      throw new AdminProvisioningError(
        `Admin name must contain between ${ADMIN_NAME_MIN_LENGTH} and ${ADMIN_NAME_MAX_LENGTH} characters.`,
      );
    }
    return name;
  }

  /** Normalizes and verifies an Egyptian administrator phone number. */
  private normalizeEgyptianPhone(value: string): string {
    try {
      const phone = normalizePhoneNumber(value.trim(), 'EG');
      if (parsePhoneNumber(phone).country !== 'EG') {
        throw new Error('Non-Egyptian phone number');
      }
      return phone;
    } catch {
      throw new AdminProvisioningError(
        'Admin phone must be a valid Egyptian phone number.',
      );
    }
  }

  /** Restricts administrator creation to the supported trusted role enum. */
  private validateRole(value: AdminRole): AdminRole {
    if (!Object.values(AdminRole).includes(value)) {
      throw new AdminProvisioningError(
        'Admin role must be platform_admin or operations_admin.',
      );
    }
    return value;
  }

  /** Enforces confirmation and the strong administrator password policy. */
  private validatePassword(password: string, confirmation: string): void {
    if (password !== confirmation) {
      throw new AdminProvisioningError('Password confirmation does not match.');
    }
    const validationMessage = validateAdminPassword(password);
    if (validationMessage) {
      throw new AdminProvisioningError(validationMessage);
    }
  }

  /** Detects Prisma's unique-constraint failure without exposing query details. */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
