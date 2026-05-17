/** Student/candidate identity used in CBT sessions (DTO — not coupled to storage). */
export interface StudentRecord {
  name: string;
  rollNumber: string;
  applicationNumber: string;
  instituteId?: string;
  studentId?: string;
  batchId?: string;
  courseType?: string;
}
