import { DemoConfig } from "../types";

export const ApexAcademyConfig: DemoConfig = {
  id: "apex-academy",
  seed: "EXAMGRID_DEMO_V1",
  institute: {
    name: "Apex Academy",
    tagline: "Engineering the Future",
    domain: "@apex.demo"
  },
  batches: [
    { name: "Zenith Batch", size: 0 },
    { name: "Pioneer Batch", size: 0 },
    { name: "Ignite Batch", size: 0 }
  ],
  personas: [
    { name: "Institute Admin", email: "admin@apex.demo", batch: "ADMIN", traits: [] },
    { name: "Physics Teacher", email: "physics@apex.demo", batch: "TEACHER", traits: [] },
    { name: "Chemistry Teacher", email: "chemistry@apex.demo", batch: "TEACHER", traits: [] },
    { name: "Mathematics Teacher", email: "maths@apex.demo", batch: "TEACHER", traits: [] },
    { name: "Aryan", email: "aryan@apex.demo", batch: "Zenith Batch", traits: ["Topper"] },
    { name: "Neha", email: "neha@apex.demo", batch: "Zenith Batch", traits: ["Above Average"] },
    { name: "Rohan", email: "rohan@apex.demo", batch: "Pioneer Batch", traits: ["Average"] },
    { name: "Priya", email: "priya@apex.demo", batch: "Pioneer Batch", traits: ["Below Average"] },
    { name: "Kabir", email: "kabir@apex.demo", batch: "Ignite Batch", traits: ["Lowest Scoring"] }
  ],
  exams: [
    { 
      title: "JEE Main Mock 1", 
      date: "2026-06-08T09:00:00Z", 
      anomalies: [] 
    },
    { 
      title: "JEE Main Mock 2", 
      date: "2026-06-18T09:00:00Z", 
      anomalies: [
        { type: "TRAP_QUESTION", subject: "Physics", questionIndex: 14, wrongOptionRate: 0.75, wrongOption: "C" },
      ] 
    },
    { 
      title: "JEE Main Mock 3", 
      date: "2026-06-29T09:00:00Z", 
      anomalies: [] 
    }
  ],
  aiPipeline: {
    distribution: {
      COMPLETED: 0.90,
      PENDING: 0.05,
      REGENERATED: 0.03,
      FAILED: 0.02
    }
  }
};
