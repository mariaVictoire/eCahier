import { ClassDetail } from "./class-detail";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClassDetail classroomId={id} />;
}
