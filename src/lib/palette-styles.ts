import type { QuestionPaletteStatus } from "@/types/exam";

export const PALETTE_LEGEND: {
  status?: QuestionPaletteStatus;
  label: string;
  className: string;
}[] = [
  {
    status: "not-visited",
    label: "Not Visited",
    className: "bg-white border-2 border-gray-400 text-gray-800",
  },
  {
    status: "not-answered",
    label: "Not Answered",
    className: "bg-red-600 border-2 border-red-700 text-white",
  },
  {
    status: "answered",
    label: "Answered",
    className: "bg-green-600 border-2 border-green-700 text-white",
  },
  {
    status: "marked-for-review",
    label: "Marked for Review",
    className: "bg-violet-600 border-2 border-violet-700 text-white",
  },
  {
    status: "answered-and-marked",
    label: "Answered & Marked for Review",
    className:
      "bg-violet-600 border-2 border-green-500 text-white ring-2 ring-green-400 ring-inset",
  },
  {
    label: "NAT question (orange dot indicator)",
    className: "bg-white border-2 border-gray-400 text-gray-800 relative after:absolute after:-right-0.5 after:-top-0.5 after:h-2 after:w-2 after:rounded-full after:bg-orange-400",
  },
] as const;

export function getPaletteButtonClass(status: QuestionPaletteStatus): string {
  const item = PALETTE_LEGEND.find((l) => l.status === status);
  return item?.className ?? PALETTE_LEGEND[0].className;
}
