import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.sub,
      role: session.role,
      schoolId: session.schoolId,
      firstName: session.firstName,
      lastName: session.lastName,
      scope: session.scope,
      sessionId: session.sessionId,
    },
  });
}
