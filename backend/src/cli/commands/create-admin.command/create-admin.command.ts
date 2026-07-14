import {
  Command,
  CommandRunner,
  InquirerService,
  Option,
} from 'nest-commander';
import { AdminRole } from '../../../../generated/prisma/client';
import {
  AdminProvisioningService,
} from '../../admin-provisioning/admin-provisioning.service';
import type {
  CreateAdminAnswers,
} from '../../questions/create-admin.questions/create-admin.questions';

type CreateAdminCommandOptions = {
  name: string;
  phone: string;
  role: AdminRole;
};

/** Creates a new administrator through an interactive, audited CLI flow. */
@Command({
  name: 'admin:create',
  description: 'Create a new platform or operations administrator',
})
export class CreateAdminCommand extends CommandRunner {
  constructor(
    private readonly inquirerService: InquirerService,
    private readonly adminProvisioningService: AdminProvisioningService,
  ) {
    super();
  }

  /** Prompts for credentials, provisions the administrator, and prints safe output. */
  async run(
    _passedParams: string[],
    options?: CreateAdminCommandOptions,
  ): Promise<void> {
    if (!options) {
      throw new Error('Required administrator options are missing.');
    }
    const answers = await this.inquirerService.ask<CreateAdminAnswers>(
      'create-admin',
      undefined,
    );
    const admin = await this.adminProvisioningService.createAdmin({
      name: options.name,
      phone: options.phone,
      role: options.role,
      password: answers.password,
      passwordConfirmation: answers.passwordConfirmation,
    });

    process.stdout.write(
      [
        'Administrator created successfully.',
        `ID: ${admin.id}`,
        `Name: ${admin.name}`,
        `Role: ${admin.role}`,
        `Phone: ${this.maskPhone(admin.phone)}`,
      ].join('\n') + '\n',
    );
  }

  /** Trims the required administrator display name option. */
  @Option({
    flags: '--name <name>',
    description: 'Administrator display name',
    required: true,
  })
  parseName(value: string): string {
    return value.trim();
  }

  /** Trims the required Egyptian administrator phone option. */
  @Option({
    flags: '--phone <phone>',
    description: 'Egyptian administrator phone number',
    required: true,
  })
  parsePhone(value: string): string {
    return value.trim();
  }

  /** Parses the required administrator role from the trusted enum choices. */
  @Option({
    flags: '--role <role>',
    description: 'Administrator role',
    required: true,
    choices: [AdminRole.platform_admin, AdminRole.operations_admin],
  })
  parseRole(value: string): AdminRole {
    return value as AdminRole;
  }

  /** Masks a normalized phone while retaining minimal operator confirmation. */
  private maskPhone(phone: string): string {
    const visiblePrefix = phone.slice(0, 3);
    const visibleSuffix = phone.slice(-2);
    return `${visiblePrefix}${'*'.repeat(Math.max(phone.length - 5, 0))}${visibleSuffix}`;
  }
}
