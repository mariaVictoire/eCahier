import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

const PERIODS = [
  { startsAt: "07:30", endsAt: "08:30" },
  { startsAt: "08:30", endsAt: "09:30" },
  { startsAt: "09:45", endsAt: "10:45" },
  { startsAt: "10:45", endsAt: "11:45" },
  { startsAt: "14:00", endsAt: "15:00" },
  { startsAt: "15:00", endsAt: "16:00" },
] as const;

const FIRST_NAMES = [
  "Jean", "Aline", "Kevin", "Grace", "Paul", "Sarah", "Marc", "Claire",
  "Nina", "Boris", "Inès", "Daniel", "Laura", "Yves", "Estelle", "Serge",
  "Flore", "Armand", "Léa", "Thierry", "Nadia", "Brice", "Chantal", "Eric",
  "Patricia", "Olivier", "Sandra", "Gilles", "Audrey", "Michel",
];

const LAST_NAMES = [
  "Mba", "Nzue", "Obame", "Mintsa", "Essono", "Bongo", "Ndong", "Ovono",
  "Allogho", "Ella", "Moussavou", "Ping", "Tchibinda", "Bouassa", "Nze",
  "Okome", "Biteghe", "Maganga", "Ntoutoume", "Ondo", "Abessolo", "Eyeghe",
  "Kombila", "Minko", "Ngoma", "Ossa", "Rembogo", "Sima", "Tonda", "Wora",
];

function pickName(i: number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[(i * 7) % LAST_NAMES.length],
  };
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.student.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.school.deleteMany();
  await prisma.schoolHoliday.deleteMany();

  const school = await prisma.school.create({
    data: {
      code: "EST-LBV-001",
      name: "Lycée Léon Mba",
      city: "Libreville",
    },
  });

  // Année courante élargie pour couvrir les tests (été 2026 inclus).
  const year = await prisma.schoolYear.create({
    data: {
      schoolId: school.id,
      label: "2025-2026",
      startsOn: new Date("2025-09-01"),
      endsOn: new Date("2026-08-31"),
      isCurrent: true,
    },
  });

  const adminPass = await bcrypt.hash("admin123", 10);
  const adminPin = await bcrypt.hash("123456", 10);

  await prisma.user.create({
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

  await prisma.user.create({
    data: {
      schoolId: null,
      role: "national_admin",
      email: "national@ecahier.ga",
      firstName: "Admin",
      lastName: "NATIONAL",
      passwordHash: await bcrypt.hash("national123", 10),
    },
  });

  type TeacherSeed = {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    pin: string;
  };

  const teacherDefs: TeacherSeed[] = [
    { email: "obame@lycee.ga", phone: "077012345", firstName: "Jean", lastName: "OBAME", pin: "123456" },
    { email: "nzue@lycee.ga", phone: "066098765", firstName: "Marie", lastName: "NZUE", pin: "654321" },
    { email: "essono@lycee.ga", phone: "077111222", firstName: "Paul", lastName: "ESSONO", pin: "111111" },
    { email: "mintsa@lycee.ga", phone: "066222333", firstName: "Sophie", lastName: "MINTSA", pin: "222222" },
    { email: "ndong@lycee.ga", phone: "077333444", firstName: "André", lastName: "NDONG", pin: "333333" },
  ];

  const teachers = [];
  for (const t of teacherDefs) {
    teachers.push(
      await prisma.user.create({
        data: {
          schoolId: school.id,
          role: "teacher",
          email: t.email,
          phone: t.phone,
          firstName: t.firstName,
          lastName: t.lastName,
          pinHash: await bcrypt.hash(t.pin, 10),
          pinCode: t.pin,
        },
      }),
    );
  }

  const [obame, nzue, essono, mintsa, ndong] = teachers;

  const subjectDefs = [
    { code: "MATH", name: "Mathématiques" },
    { code: "FR", name: "Français" },
    { code: "HG", name: "Histoire-Géographie" },
    { code: "ANG", name: "Anglais" },
    { code: "SVT", name: "SVT" },
    { code: "PC", name: "Physique-Chimie" },
    { code: "EPS", name: "EPS" },
    { code: "PHILO", name: "Philosophie" },
  ];

  const subjects: Record<string, { id: string }> = {};
  for (const s of subjectDefs) {
    subjects[s.code] = await prisma.subject.create({
      data: { schoolId: school.id, code: s.code, name: s.name },
    });
  }

  type ClassSeed = {
    name: string;
    level: string;
    roomCode: string;
    building: string;
    publicId: string;
    studentCount: number;
  };

  const classDefs: ClassSeed[] = [
    { name: "6ème A", level: "6ème", roomCode: "A1", building: "Bloc A", publicId: "rm_a1_demo", studentCount: 18 },
    { name: "5ème B", level: "5ème", roomCode: "A2", building: "Bloc A", publicId: "rm_a2_demo", studentCount: 16 },
    { name: "4ème A", level: "4ème", roomCode: "A3", building: "Bloc A", publicId: "rm_a3_demo", studentCount: 17 },
    { name: "3ème A", level: "3ème", roomCode: "A4", building: "Bloc B", publicId: "rm_a4_demo", studentCount: 20 },
    { name: "2nde B", level: "2nde", roomCode: "B5", building: "Bloc B", publicId: "rm_b5_demo", studentCount: 18 },
    { name: "1ère C", level: "1ère", roomCode: "B6", building: "Bloc C", publicId: "rm_b6_demo", studentCount: 15 },
    { name: "Terminale C", level: "Terminale", roomCode: "C7", building: "Bloc C", publicId: "rm_c7_demo", studentCount: 14 },
  ];

  const classrooms: { id: string; name: string; roomId: string }[] = [];
  let studentIndex = 0;

  for (const c of classDefs) {
    const classroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        schoolYearId: year.id,
        name: c.name,
        level: c.level,
      },
    });

    const room = await prisma.room.create({
      data: {
        schoolId: school.id,
        code: c.roomCode,
        label: c.name,
        building: c.building,
        publicId: c.publicId,
        homeClassroomId: classroom.id,
      },
    });

    for (let i = 0; i < c.studentCount; i++) {
      const { firstName, lastName } = pickName(studentIndex++);
      await prisma.student.create({
        data: {
          schoolId: school.id,
          classroomId: classroom.id,
          firstName,
          lastName,
          studentCode: `${c.roomCode}-${String(i + 1).padStart(2, "0")}`,
        },
      });
    }

    classrooms.push({ id: classroom.id, name: c.name, roomId: room.id });
  }

  const byName = Object.fromEntries(classrooms.map((c) => [c.name, c]));

  /** Emploi du temps : (classe, matière, prof, créneau index 0-5) par jour */
  type Lesson = {
    className: string;
    subjectCode: string;
    teacherId: string;
    period: number;
  };

  const scheduleByDay: Record<(typeof WEEKDAYS)[number], Lesson[]> = {
    mon: [
      { className: "6ème A", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "6ème A", subjectCode: "FR", teacherId: nzue.id, period: 1 },
      { className: "6ème A", subjectCode: "HG", teacherId: essono.id, period: 2 },
      { className: "5ème B", subjectCode: "FR", teacherId: nzue.id, period: 0 },
      { className: "5ème B", subjectCode: "MATH", teacherId: obame.id, period: 2 },
      { className: "5ème B", subjectCode: "SVT", teacherId: mintsa.id, period: 3 },
      { className: "4ème A", subjectCode: "ANG", teacherId: essono.id, period: 0 },
      { className: "4ème A", subjectCode: "PC", teacherId: mintsa.id, period: 1 },
      { className: "4ème A", subjectCode: "EPS", teacherId: ndong.id, period: 4 },
      { className: "3ème A", subjectCode: "MATH", teacherId: obame.id, period: 3 },
      { className: "3ème A", subjectCode: "FR", teacherId: nzue.id, period: 4 },
      { className: "3ème A", subjectCode: "HG", teacherId: essono.id, period: 5 },
      { className: "2nde B", subjectCode: "PC", teacherId: mintsa.id, period: 2 },
      { className: "2nde B", subjectCode: "MATH", teacherId: obame.id, period: 4 },
      { className: "2nde B", subjectCode: "ANG", teacherId: essono.id, period: 5 },
      { className: "1ère C", subjectCode: "PHILO", teacherId: nzue.id, period: 2 },
      { className: "1ère C", subjectCode: "MATH", teacherId: obame.id, period: 5 },
      { className: "Terminale C", subjectCode: "PC", teacherId: mintsa.id, period: 0 },
      { className: "Terminale C", subjectCode: "PHILO", teacherId: nzue.id, period: 3 },
      { className: "Terminale C", subjectCode: "EPS", teacherId: ndong.id, period: 5 },
    ],
    tue: [
      { className: "6ème A", subjectCode: "SVT", teacherId: mintsa.id, period: 0 },
      { className: "6ème A", subjectCode: "ANG", teacherId: essono.id, period: 1 },
      { className: "6ème A", subjectCode: "EPS", teacherId: ndong.id, period: 4 },
      { className: "5ème B", subjectCode: "HG", teacherId: essono.id, period: 1 },
      { className: "5ème B", subjectCode: "EPS", teacherId: ndong.id, period: 2 },
      { className: "5ème B", subjectCode: "FR", teacherId: nzue.id, period: 4 },
      { className: "4ème A", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "4ème A", subjectCode: "FR", teacherId: nzue.id, period: 2 },
      { className: "4ème A", subjectCode: "HG", teacherId: essono.id, period: 3 },
      { className: "3ème A", subjectCode: "PC", teacherId: mintsa.id, period: 0 },
      { className: "3ème A", subjectCode: "MATH", teacherId: obame.id, period: 1 },
      { className: "3ème A", subjectCode: "ANG", teacherId: essono.id, period: 4 },
      { className: "2nde B", subjectCode: "FR", teacherId: nzue.id, period: 0 },
      { className: "2nde B", subjectCode: "SVT", teacherId: mintsa.id, period: 1 },
      { className: "2nde B", subjectCode: "MATH", teacherId: obame.id, period: 3 },
      { className: "1ère C", subjectCode: "HG", teacherId: essono.id, period: 0 },
      { className: "1ère C", subjectCode: "PC", teacherId: mintsa.id, period: 3 },
      { className: "1ère C", subjectCode: "FR", teacherId: nzue.id, period: 5 },
      { className: "Terminale C", subjectCode: "MATH", teacherId: obame.id, period: 2 },
      { className: "Terminale C", subjectCode: "ANG", teacherId: essono.id, period: 4 },
    ],
    wed: [
      { className: "6ème A", subjectCode: "MATH", teacherId: obame.id, period: 1 },
      { className: "6ème A", subjectCode: "FR", teacherId: nzue.id, period: 2 },
      { className: "5ème B", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "5ème B", subjectCode: "ANG", teacherId: essono.id, period: 3 },
      { className: "4ème A", subjectCode: "SVT", teacherId: mintsa.id, period: 0 },
      { className: "4ème A", subjectCode: "ANG", teacherId: essono.id, period: 2 },
      { className: "3ème A", subjectCode: "FR", teacherId: nzue.id, period: 0 },
      { className: "3ème A", subjectCode: "SVT", teacherId: mintsa.id, period: 1 },
      { className: "3ème A", subjectCode: "EPS", teacherId: ndong.id, period: 3 },
      { className: "2nde B", subjectCode: "HG", teacherId: essono.id, period: 1 },
      { className: "2nde B", subjectCode: "PC", teacherId: mintsa.id, period: 4 },
      { className: "1ère C", subjectCode: "MATH", teacherId: obame.id, period: 2 },
      { className: "1ère C", subjectCode: "EPS", teacherId: ndong.id, period: 4 },
      { className: "Terminale C", subjectCode: "PHILO", teacherId: nzue.id, period: 1 },
      { className: "Terminale C", subjectCode: "SVT", teacherId: mintsa.id, period: 3 },
      { className: "Terminale C", subjectCode: "FR", teacherId: nzue.id, period: 5 },
    ],
    thu: [
      { className: "6ème A", subjectCode: "HG", teacherId: essono.id, period: 0 },
      { className: "6ème A", subjectCode: "PC", teacherId: mintsa.id, period: 3 },
      { className: "5ème B", subjectCode: "FR", teacherId: nzue.id, period: 1 },
      { className: "5ème B", subjectCode: "PC", teacherId: mintsa.id, period: 2 },
      { className: "5ème B", subjectCode: "MATH", teacherId: obame.id, period: 4 },
      { className: "4ème A", subjectCode: "MATH", teacherId: obame.id, period: 1 },
      { className: "4ème A", subjectCode: "FR", teacherId: nzue.id, period: 3 },
      { className: "4ème A", subjectCode: "EPS", teacherId: ndong.id, period: 5 },
      { className: "3ème A", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "3ème A", subjectCode: "HG", teacherId: essono.id, period: 2 },
      { className: "3ème A", subjectCode: "FR", teacherId: nzue.id, period: 4 },
      { className: "2nde B", subjectCode: "ANG", teacherId: essono.id, period: 0 },
      { className: "2nde B", subjectCode: "FR", teacherId: nzue.id, period: 2 },
      { className: "2nde B", subjectCode: "EPS", teacherId: ndong.id, period: 3 },
      { className: "1ère C", subjectCode: "ANG", teacherId: essono.id, period: 1 },
      { className: "1ère C", subjectCode: "PHILO", teacherId: nzue.id, period: 3 },
      { className: "1ère C", subjectCode: "PC", teacherId: mintsa.id, period: 5 },
      { className: "Terminale C", subjectCode: "MATH", teacherId: obame.id, period: 2 },
      { className: "Terminale C", subjectCode: "HG", teacherId: essono.id, period: 4 },
    ],
    fri: [
      { className: "6ème A", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "6ème A", subjectCode: "EPS", teacherId: ndong.id, period: 2 },
      { className: "6ème A", subjectCode: "FR", teacherId: nzue.id, period: 3 },
      { className: "5ème B", subjectCode: "SVT", teacherId: mintsa.id, period: 0 },
      { className: "5ème B", subjectCode: "ANG", teacherId: essono.id, period: 1 },
      { className: "5ème B", subjectCode: "EPS", teacherId: ndong.id, period: 5 },
      { className: "4ème A", subjectCode: "HG", teacherId: essono.id, period: 0 },
      { className: "4ème A", subjectCode: "MATH", teacherId: obame.id, period: 2 },
      { className: "4ème A", subjectCode: "FR", teacherId: nzue.id, period: 4 },
      { className: "3ème A", subjectCode: "ANG", teacherId: essono.id, period: 1 },
      { className: "3ème A", subjectCode: "PC", teacherId: mintsa.id, period: 3 },
      { className: "3ème A", subjectCode: "EPS", teacherId: ndong.id, period: 4 },
      { className: "2nde B", subjectCode: "MATH", teacherId: obame.id, period: 1 },
      { className: "2nde B", subjectCode: "SVT", teacherId: mintsa.id, period: 2 },
      { className: "2nde B", subjectCode: "FR", teacherId: nzue.id, period: 5 },
      { className: "1ère C", subjectCode: "FR", teacherId: nzue.id, period: 0 },
      { className: "1ère C", subjectCode: "MATH", teacherId: obame.id, period: 3 },
      { className: "1ère C", subjectCode: "SVT", teacherId: mintsa.id, period: 4 },
      { className: "Terminale C", subjectCode: "PC", teacherId: mintsa.id, period: 1 },
      { className: "Terminale C", subjectCode: "PHILO", teacherId: nzue.id, period: 2 },
      { className: "Terminale C", subjectCode: "EPS", teacherId: ndong.id, period: 3 },
    ],
    sat: [
      { className: "3ème A", subjectCode: "MATH", teacherId: obame.id, period: 0 },
      { className: "3ème A", subjectCode: "FR", teacherId: nzue.id, period: 1 },
      { className: "2nde B", subjectCode: "PC", teacherId: mintsa.id, period: 0 },
      { className: "2nde B", subjectCode: "HG", teacherId: essono.id, period: 1 },
      { className: "1ère C", subjectCode: "PHILO", teacherId: nzue.id, period: 0 },
      { className: "Terminale C", subjectCode: "MATH", teacherId: obame.id, period: 1 },
      { className: "Terminale C", subjectCode: "ANG", teacherId: essono.id, period: 2 },
      { className: "4ème A", subjectCode: "SVT", teacherId: mintsa.id, period: 2 },
    ],
  };

  let slotCount = 0;
  for (const weekday of WEEKDAYS) {
    for (const lesson of scheduleByDay[weekday]) {
      const cls = byName[lesson.className];
      const subject = subjects[lesson.subjectCode];
      const period = PERIODS[lesson.period];
      await prisma.timetableSlot.create({
        data: {
          schoolId: school.id,
          schoolYearId: year.id,
          roomId: cls.roomId,
          classroomId: cls.id,
          subjectId: subject.id,
          teacherId: lesson.teacherId,
          weekday,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          effectiveFrom: year.startsOn,
        },
      });
      slotCount++;
    }
  }

  await prisma.schoolHoliday.createMany({
    data: [
      {
        yearLabel: "2025-2026",
        kind: "holiday",
        name: "Vacances de Noël",
        startsOn: new Date("2025-12-20"),
        endsOn: new Date("2026-01-05"),
      },
      {
        yearLabel: "2025-2026",
        kind: "holiday",
        name: "Vacances de Pâques",
        startsOn: new Date("2026-04-04"),
        endsOn: new Date("2026-04-19"),
      },
    ],
  });

  const studentTotal = await prisma.student.count();

  console.log("Seed OK — données fictives prêtes pour tests");
  console.log(`École: ${school.name} (${school.code})`);
  console.log(`Année: ${year.label} · ${classDefs.length} classes · ${studentTotal} élèves · ${subjectDefs.length} matières · ${slotCount} créneaux`);
  console.log("");
  console.log("Comptes:");
  console.log("  National: national@ecahier.ga / national123");
  console.log("  Direction: admin@lycee.ga / admin123");
  console.log("  PIN OBAME 123456 · NZUE 654321 · ESSONO 111111 · MINTSA 222222 · NDONG 333333");
  console.log("");
  console.log("QR salles:");
  for (const c of classDefs) {
    console.log(`  ${c.name} (${c.roomCode}): /room/${c.publicId}`);
  }
  console.log("");
  console.log("Note: aucune séance ni présence créée — à remplir lors des tests.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
