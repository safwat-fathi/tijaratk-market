import { Prisma } from '../../generated/prisma/client';
import { hashPassword } from '../common/utils/password.util';

type PasswordWriteData = Record<string, unknown> & {
  password?: string | { set?: string };
};

/** Hashes password fields without hashing an existing bcrypt value again. */
async function hashPasswordField(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object') return;

  const passwordData = data as PasswordWriteData;
  if (typeof passwordData.password === 'string') {
    passwordData.password = await hashPassword(passwordData.password);
    return;
  }

  if (
    passwordData.password &&
    typeof passwordData.password === 'object' &&
    typeof passwordData.password.set === 'string'
  ) {
    passwordData.password.set = await hashPassword(passwordData.password.set);
  }
}

export const passwordExtension = Prisma.defineExtension({
  name: 'passwordExtension',
  query: {
    adminUser: {
      async create({ args, query }) {
        await hashPasswordField(args.data);
        return query(args);
      },
      async update({ args, query }) {
        await hashPasswordField(args.data);
        return query(args);
      },
      async upsert({ args, query }) {
        await hashPasswordField(args.create);
        await hashPasswordField(args.update);
        return query(args);
      },
    },
    user: {
      async create({ args, query }) {
        await hashPasswordField(args.data);
        return query(args);
      },
      async update({ args, query }) {
        await hashPasswordField(args.data);
        return query(args);
      },
      async upsert({ args, query }) {
        await hashPasswordField(args.create);
        await hashPasswordField(args.update);
        return query(args);
      },
    },
  },
});
