const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://tijaratk:tijaratk@localhost:5432/tijaratk"
    }
  }
});
async function main() {
  const areas = await prisma.directoryArea.findMany({
    where: { 
      name: { contains: 'أكتوبر' } 
    }
  });
  const dist = await prisma.directoryArea.findMany({
    where: { 
      name: { contains: 'الحي' } 
    }
  });
  console.log(areas);
  console.log(dist.slice(0, 5));
}
main().catch(console.error).finally(() => prisma.$disconnect());
