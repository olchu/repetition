import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const login = process.env.SEED_ADMIN_LOGIN;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!login || !password) {
  throw new Error("SEED_ADMIN_LOGIN and SEED_ADMIN_PASSWORD are required");
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { login },
  update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
  create: { login, passwordHash, role: "ADMIN", status: "ACTIVE" },
});

console.log(`Seeded administrator: ${login}`);
await prisma.$disconnect();
