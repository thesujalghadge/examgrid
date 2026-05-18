import type { QuestionFormat } from "@/intelligence/types/pipeline";

/**
 * Exam-agnostic profile registry.
 * Services resolve behavior from profile metadata — never hardcode exam-specific branches.
 */
export interface ExamProfile {
  id: string;
  label: string;
  /** Taxonomy key used by metadata engine (maps to academic-taxonomy when available). */
  taxonomyKey?: string;
  subjects: string[];
  supportedFormats: QuestionFormat[];
  defaultMarks: number;
  defaultNegativeMarks: number;
}

export const EXAM_PROFILES: ExamProfile[] = [
  {
    id: "JEE_MAIN",
    label: "JEE Main",
    taxonomyKey: "JEE_MAIN",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    supportedFormats: ["mcq_single", "numerical"],
    defaultMarks: 4,
    defaultNegativeMarks: 1,
  },
  {
    id: "JEE_ADVANCED",
    label: "JEE Advanced",
    taxonomyKey: "JEE_ADVANCED",
    subjects: ["Physics", "Chemistry", "Mathematics"],
    supportedFormats: ["mcq_single", "numerical", "multi_correct"],
    defaultMarks: 4,
    defaultNegativeMarks: 1,
  },
  {
    id: "NEET",
    label: "NEET",
    taxonomyKey: "NEET",
    subjects: ["Physics", "Chemistry", "Biology"],
    supportedFormats: ["mcq_single", "assertion_reason"],
    defaultMarks: 4,
    defaultNegativeMarks: 1,
  },
  {
    id: "MHT_CET",
    label: "MHT CET",
    taxonomyKey: "MHT_CET",
    subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
    supportedFormats: ["mcq_single", "numerical"],
    defaultMarks: 1,
    defaultNegativeMarks: 0,
  },
  {
    id: "GATE",
    label: "GATE",
    subjects: ["Engineering Mathematics", "General Aptitude", "Technical"],
    supportedFormats: ["mcq_single", "numerical", "multi_correct"],
    defaultMarks: 1,
    defaultNegativeMarks: 0.33,
  },
  {
    id: "UPSC",
    label: "UPSC",
    subjects: ["General Studies", "CSAT", "Optional"],
    supportedFormats: ["mcq_single", "unknown"],
    defaultMarks: 2,
    defaultNegativeMarks: 0.66,
  },
];

const profileMap = new Map(EXAM_PROFILES.map((p) => [p.id, p]));

export function getExamProfile(id: string): ExamProfile | undefined {
  return profileMap.get(id);
}

export function requireExamProfile(id: string): ExamProfile {
  const profile = getExamProfile(id);
  if (!profile) {
    throw new Error(`Unknown exam profile: ${id}`);
  }
  return profile;
}

export function listExamProfiles(): ExamProfile[] {
  return [...EXAM_PROFILES];
}
