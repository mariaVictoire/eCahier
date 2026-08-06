import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: {
      code: "EST-LBV-001",
      name: "Lycée Léon Mba",
      city: "Libreville",
    },
  });

  const year = await prisma.schoolYear.create({
    data: {
      schoolId: school.id,
      label: "2025-2026",
      startsOn: new Date("2025-09-01"),
      endsOn: new Date("2026-07-15"),
      isCurrent: true,
    },
  });

  const adminPin = await bcrypt.hash("123456", 10);
  const adminPass = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "school_admin",
      email: "admin@lycee.ga",
      firstName: "Claire",
      lastName: "MOUSSAVOU",
      passwordHash: adminPass,
      pinHash: adminPin,
    },
  });

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

  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "teacher",
      email: "obame@lycee.ga",
      phone: "077012345",
      firstName: "Jean",
      lastName: "OBAME",
      pinHash: await bcrypt.hash("123456", 10),
      pinCode: "123456",
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "teacher",
      email: "nzue@lycee.ga",
      phone: "066098765",
      firstName: "Marie",
      lastName: "NZUE",
      pinHash: await bcrypt.hash("654321", 10),
      pinCode: "654321",
    },
  });

  const c3a = await prisma.classroom.create({
    data: {
      schoolId: school.id,
      schoolYearId: year.id,
      name: "3ème A",
      level: "3ème",
    },
  });

  const c2b = await prisma.classroom.create({
    data: {
      schoolId: school.id,
      schoolYearId: year.id,
      name: "2nde B",
      level: "2nde",
    },
  });

  const roomB12 = await prisma.room.create({
    data: {
      schoolId: school.id,
      code: "B12",
      label: "Salle B12",
      building: "Bloc B",
      publicId: "rm_b12_demo",
      homeClassroomId: c3a.id,
    },
  });

  const roomA03 = await prisma.room.create({
    data: {
      schoolId: school.id,
      code: "A03",
      label: "Salle A03",
      building: "Bloc A",
      publicId: "rm_a03_demo",
      homeClassroomId: c2b.id,
    },
  });

  const maths = await prisma.subject.create({
    data: { schoolId: school.id, code: "MATH", name: "Mathématiques" },
  });
  const fr = await prisma.subject.create({
    data: { schoolId: school.id, code: "FR", name: "Français" },
  });

  const periods = [
    { startsAt: "07:30", endsAt: "08:30" },
    { startsAt: "08:30", endsAt: "09:30" },
    { startsAt: "09:45", endsAt: "10:45" },
    { startsAt: "10:45", endsAt: "11:45" },
    { startsAt: "14:00", endsAt: "15:00" },
    { startsAt: "15:00", endsAt: "16:00" },
  ];

  for (const weekday of WEEKDAYS) {
    // B12: Obame Maths 3A on first 3 periods, Nzue Français afternoon
    for (let i = 0; i < 3; i++) {
      await prisma.timetableSlot.create({
        data: {
          schoolId: school.id,
          schoolYearId: year.id,
          roomId: roomB12.id,
          classroomId: c3a.id,
          subjectId: maths.id,
          teacherId: teacher.id,
          weekday,
          startsAt: periods[i].startsAt,
          endsAt: periods[i].endsAt,
          effectiveFrom: year.startsOn,
        },
      });
    }
    for (let i = 4; i < 6; i++) {
      await prisma.timetableSlot.create({
        data: {
          schoolId: school.id,
          schoolYearId: year.id,
          roomId: roomB12.id,
          classroomId: c2b.id,
          subjectId: fr.id,
          teacherId: teacher2.id,
          weekday,
          startsAt: periods[i].startsAt,
          endsAt: periods[i].endsAt,
          effectiveFrom: year.startsOn,
        },
      });
    }

    await prisma.timetableSlot.create({
      data: {
        schoolId: school.id,
        schoolYearId: year.id,
        roomId: roomA03.id,
        classroomId: c2b.id,
        subjectId: fr.id,
        teacherId: teacher2.id,
        weekday,
        startsAt: "08:30",
        endsAt: "09:30",
        effectiveFrom: year.startsOn,
      },
    });
  }

  console.log("Seed OK");
  console.log("National: national@ecahier.ga / national123");
  console.log("Admin école: admin@lycee.ga / admin123");
  console.log("Enseignant PIN: OBAME 123456 · NZUE 654321");
  console.log("QR salle B12: /room/rm_b12_demo");
  console.log("Admin id:", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
