/**
 * Remet la base à zéro : aucune école / salle / EDT.
 * Conserve uniquement l’admin national pour tout recréer depuis l’UI.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.room.deleteMany();
  await prisma.schoolHoliday.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.school.deleteMany();

  const nationalPass = await bcrypt.hash("national123", 10);
  await prisma.user.create({
    data: {
      schoolId: null,
      role: "national_admin",
      email: "national@ecahier.ga",
      firstName: "Admin",
      lastName: "NATIONAL",
      passwordHash: nationalPass,
    },
  });

  console.log("Base vidée.");
  console.log("Compte national: national@ecahier.ga / national123");
  console.log("Crée les écoles depuis /national/ecoles");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
