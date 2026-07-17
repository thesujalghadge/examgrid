export type DemoPersona = {
  name: string;
  email: string;
  batch: string;
  traits: string[];
};

export type AnomalyConfig = 
  | { type: "TRAP_QUESTION"; subject: string; questionIndex: number; wrongOptionRate: number; wrongOption: string }
  | { type: "LATE_ARRIVALS"; count: number; delayMinutes: number }
  | { type: "POWER_OUTAGE"; durationMinutes: number }
  | { type: "ABSENCE"; count: number };

export type ExamConfig = {
  title: string;
  date: string; // ISO-8601
  anomalies: AnomalyConfig[];
};

export type BatchConfig = {
  name: string;
  size: number;
};

export type DemoConfig = {
  id: string; // e.g., 'apex-academy'
  seed: string;
  institute: {
    name: string;
    tagline: string;
    domain: string; // e.g., '@apex.demo'
  };
  batches: BatchConfig[];
  personas: DemoPersona[];
  exams: ExamConfig[];
  aiPipeline: {
    distribution: {
      COMPLETED: number;
      PENDING: number;
      REGENERATED: number;
      FAILED: number;
    };
  };
};
