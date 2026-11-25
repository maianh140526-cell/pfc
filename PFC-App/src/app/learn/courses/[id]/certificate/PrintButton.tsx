"use client";

import { Download } from "lucide-react";
import { Button } from "@/ui";

/** Uses the browser's print → "Save as PDF" (works on phones too); no server PDF needed. */
export function PrintButton() {
  return (
    <Button block onClick={() => window.print()}>
      <Download size={18} /> Lưu / in chứng chỉ (PDF)
    </Button>
  );
}
