import type { SubjectTaxonomy } from "@/lib/academic-taxonomy/types";

export const JEE_MAIN_TAXONOMY: SubjectTaxonomy[] = [
  {
    examType: "JEE_MAIN",
    subject: "Physics",
    chapters: [
      {
        name: "Physics and Measurement",
        topics: [
          {
            name: "Units and Dimensions",
            subtopics: ["Dimensional analysis", "Error analysis"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 90,
          },
        ],
      },
      {
        name: "Mechanics",
        topics: [
          {
            name: "Kinematics",
            subtopics: ["Motion in one dimension", "Projectile motion", "Relative motion"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Laws of Motion",
            subtopics: ["Friction", "Circular motion", "Connected bodies"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Work Energy and Power",
            subtopics: ["Work-energy theorem", "Conservative forces"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Gravitation",
            subtopics: ["Field and potential", "Orbital motion"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 140,
          },
        ],
      },
      {
        name: "Electrostatics",
        topics: [
          {
            name: "Coulomb Law",
            subtopics: ["Electric force", "Superposition"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 120,
          },
          {
            name: "Capacitance",
            subtopics: ["Parallel plate capacitor", "Energy stored"],
            expectedDifficulty: "hard",
            recommendedSolveTimeSeconds: 180,
          },
        ],
      },
      {
        name: "Modern Physics",
        topics: [
          {
            name: "Photoelectric Effect",
            subtopics: ["Einstein equation", "Stopping potential"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 120,
          },
          {
            name: "Atoms and Nuclei",
            subtopics: ["Bohr model", "Radioactivity"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 130,
          },
        ],
      },
    ],
  },
  {
    examType: "JEE_MAIN",
    subject: "Chemistry",
    chapters: [
      {
        name: "Physical Chemistry",
        topics: [
          {
            name: "Mole Concept",
            subtopics: ["Stoichiometry", "Concentration terms"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 120,
          },
          {
            name: "Chemical Thermodynamics",
            subtopics: ["Enthalpy", "Gibbs free energy"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Equilibrium",
            subtopics: ["Ionic equilibrium", "Chemical equilibrium"],
            expectedDifficulty: "hard",
            recommendedSolveTimeSeconds: 180,
          },
        ],
      },
      {
        name: "Organic Chemistry",
        topics: [
          {
            name: "GOC",
            subtopics: ["Inductive effect", "Resonance", "Hyperconjugation"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Hydrocarbons",
            subtopics: ["Alkanes", "Alkenes", "Aromatic compounds"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 140,
          },
        ],
      },
      {
        name: "Inorganic Chemistry",
        topics: [
          {
            name: "Periodic Table",
            subtopics: ["Periodic trends", "Effective nuclear charge"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 100,
          },
          {
            name: "Coordination Compounds",
            subtopics: ["Nomenclature", "Isomerism", "CFT"],
            expectedDifficulty: "hard",
            recommendedSolveTimeSeconds: 170,
          },
        ],
      },
    ],
  },
  {
    examType: "JEE_MAIN",
    subject: "Mathematics",
    chapters: [
      {
        name: "Algebra",
        topics: [
          {
            name: "Quadratic Equations",
            subtopics: ["Nature of roots", "Graph interpretation"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 120,
          },
          {
            name: "Complex Numbers",
            subtopics: ["Argand plane", "Roots of unity"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Matrices and Determinants",
            subtopics: ["Inverse", "Linear equations"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
        ],
      },
      {
        name: "Calculus",
        topics: [
          {
            name: "Limits",
            subtopics: ["Standard limits", "Continuity"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 150,
          },
          {
            name: "Derivatives",
            subtopics: ["Differentiability", "Applications of derivatives"],
            expectedDifficulty: "medium",
            recommendedSolveTimeSeconds: 160,
          },
          {
            name: "Integrals",
            subtopics: ["Definite integrals", "Area under curve"],
            expectedDifficulty: "hard",
            recommendedSolveTimeSeconds: 190,
          },
        ],
      },
      {
        name: "Coordinate Geometry",
        topics: [
          {
            name: "Straight Lines",
            subtopics: ["Pair of lines", "Distance formula"],
            expectedDifficulty: "easy",
            recommendedSolveTimeSeconds: 120,
          },
          {
            name: "Conic Sections",
            subtopics: ["Circle", "Parabola", "Ellipse", "Hyperbola"],
            expectedDifficulty: "hard",
            recommendedSolveTimeSeconds: 180,
          },
        ],
      },
    ],
  },
];
