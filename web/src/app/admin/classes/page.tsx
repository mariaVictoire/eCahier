import { ClassesManager } from "./classes-manager";
import { SubjectsManager } from "./subjects-manager";

export default function ClassesPage() {
  return (
    <div className="space-y-8">
      <ClassesManager />
      <SubjectsManager />
    </div>
  );
}
