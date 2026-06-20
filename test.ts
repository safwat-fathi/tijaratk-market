import { PrismaClient } from './backend/generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { directory_profile: { area_id: null } }
  });
  console.log("Tenant without area:", tenant);
}
main().catch(console.error).finally(() => prisma.$disconnect());
