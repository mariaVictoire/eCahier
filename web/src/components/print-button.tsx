"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button className="mb-4 print:hidden" onClick={() => window.print()}>
      Imprimer
    </Button>
  );
}
