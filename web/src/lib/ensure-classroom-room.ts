import { prisma } from "@/lib/prisma";
import {
  roomCodeFromLevelAndLetter,
  sectionLetterFromClassroomName,
} from "@/lib/classrooms";

function makePublicId(code: string) {
  const slug = code
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `rm_${slug}_${Date.now().toString(36).slice(-4)}`;
}

function deriveRoomCode(name: string, level: string | null): string {
  const embedded = name.match(/\s([A-Za-z]\d+)$/);
  if (embedded) return embedded[1].toUpperCase();

  const letter =
    (level ? sectionLetterFromClassroomName(name, level) : null) ||
    name.match(/\s([A-Za-z])$/)?.[1]?.toUpperCase();
  if (level && letter) {
    try {
      return roomCodeFromLevelAndLetter(level, letter);
    } catch {
      /* fallback below */
    }
  }
  const slug = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return slug || `C${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
/** Garantit qu’une classe a une salle / QR dédié. */
export async function ensureClassroomHomeRoom(classroom: {
  id: string;
  schoolId: string;
  name: string;
  level: string | null;
  notes: string | null;
}) {
  const existing = await prisma.room.findFirst({
    where: { homeClassroomId: classroom.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  let code = deriveRoomCode(classroom.name, classroom.level);
  const clash = await prisma.room.findFirst({
    where: { schoolId: classroom.schoolId, code, deletedAt: null },
  });
  if (clash) {
    code = `${code}${Date.now().toString(36).slice(-2)}`.toUpperCase();
  }

  return prisma.room.create({
    data: {
      schoolId: classroom.schoolId,
      code,
      label: classroom.name,
      building: classroom.notes,
      homeClassroomId: classroom.id,
      publicId: makePublicId(code),
    },
  });
}
