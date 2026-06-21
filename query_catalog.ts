import { PrismaClient } from './backend/generated/prisma/client';
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.catalogItem.groupBy({
    by: ['category'],
    _count: { category: true }
  });
  console.log(items);
}
main().catch(console.error).finally(() => prisma.$disconnect());
