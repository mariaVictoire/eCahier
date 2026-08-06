import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getWeekday, startOfDay } from "@/lib/slot";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "national_admin") {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  }

  const today = startOfDay(new Date());
  const weekday = getWeekday(new Date());

  const [schools, teachers, classrooms, rooms, sessionsToday, slotsToday, admin] =
    await Promise.all([
      prisma.school.findMany({
        orderBy: [{ city: "asc" }, { name: "asc" }],
        include: {
          users: {
            where: { role: "teacher", deletedAt: null, isActive: true },
            select: { id: true },
          },
          _count: {
            select: {
              classrooms: true,
              rooms: true,
            },
          },
        },
      }),
      prisma.user.count({
        where: { role: "teacher", deletedAt: null, isActive: true },
      }),
      prisma.classroom.count({ where: { deletedAt: null } }),
      prisma.room.count({ where: { deletedAt: null, isActive: true } }),
      prisma.lessonSession.findMany({
        where: { sessionDate: today, deletedAt: null },
        select: { schoolId: true, slotId: true },
      }),
      prisma.timetableSlot.findMany({
        where: { weekday, deletedAt: null },
        select: { id: true, schoolId: true },
      }),
      prisma.user.findUnique({ where: { id: session.sub } }),
    ]);

  const expectedBySchool = new Map<string, number>();
  for (const slot of slotsToday) {
    expectedBySchool.set(
      slot.schoolId,
      (expectedBySchool.get(slot.schoolId) || 0) + 1,
    );
  }

  const doneBySchool = new Map<string, number>();
  for (const s of sessionsToday) {
    doneBySchool.set(s.schoolId, (doneBySchool.get(s.schoolId) || 0) + 1);
  }

  const expectedToday = slotsToday.length;
  const sessionsDoneToday = sessionsToday.length;
  const fillRatePercent =
    expectedToday === 0
      ? 100
      : Math.round((sessionsDoneToday / expectedToday) * 1000) / 10;

  return NextResponse.json({
    adminName: admin ? `${admin.firstName} ${admin.lastName}` : "",
    metrics: {
      schools: schools.length,
      teachers,
      classrooms,
      roomsActive: rooms,
      sessionsDoneToday,
      expectedToday,
      fillRatePercent,
    },
    bySchool: schools.map((school) => {
      const expected = expectedBySchool.get(school.id) || 0;
      const done = doneBySchool.get(school.id) || 0;
      const fill =
        expected === 0 ? 100 : Math.round((done / expected) * 1000) / 10;
      return {
        id: school.id,
        code: school.code,
        name: school.name,
        city: school.city,
        teachers: school.users.length,
        classrooms: school._count.classrooms,
        rooms: school._count.rooms,
        sessionsDoneToday: done,
        expectedToday: expected,
        fillRatePercent: fill,
      };
    }),
  });
}
