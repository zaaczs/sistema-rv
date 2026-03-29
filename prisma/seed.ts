import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1) Admin local (senha: 123456)
  const adminHash = await bcrypt.hash("123456", 10);
  await prisma.user.deleteMany({ where: { email: "admin@sistemarv.com" } });
  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: { passwordHash: adminHash },
    create: {
      name: "Administrador",
      email: "admin@gmail.com",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log("Admin criado:", admin.email);

  // 2) Usuário de uso do sistema (Reville Fitness)
  const revilleHash = await bcrypt.hash("@1Reville", 10);
  const reville = await prisma.user.upsert({
    where: { email: "revillefit@gmail.com" },
    update: { passwordHash: revilleHash, name: "Reville Fitness" },
    create: {
      name: "Reville Fitness",
      email: "revillefit@gmail.com",
      passwordHash: revilleHash,
      role: "ADMIN",
    },
  });
  console.log("Usuário Reville:", reville.email);

  // 3) Categorias básicas
  const categories = [
    { name: "Legging" },
    { name: "Top" },
    { name: "Short" },
    { name: "Macaquinho" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }
  console.log("Categorias criadas:", categories.map((c) => c.name).join(", "));

  // 4) Uma coleção exemplo
  const collection = await prisma.collection.upsert({
    where: { name: "Verão 2025" },
    update: {},
    create: {
      name: "Verão 2025",
      season: "Verão",
      active: true,
    },
  });
  console.log("Coleção criada:", collection.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
