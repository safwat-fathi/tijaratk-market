import { Prisma } from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_COST = 10;

async function hashPasswordField(data: any) {
  if (data?.password) {
    if (typeof data.password === 'string') {
      data.password = await bcrypt.hash(data.password, BCRYPT_COST);
    } else if (typeof data.password === 'object' && data.password.set) {
      data.password.set = await bcrypt.hash(data.password.set, BCRYPT_COST);
    }
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
