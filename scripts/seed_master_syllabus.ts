import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Starting full syllabus seed...");

  const generateId = () => crypto.randomUUID();

  const syllabi = [
    { name: "JEE Main & Advanced", examType: "JEE" },
    { name: "NEET UG", examType: "NEET" }
  ];

  for (const s of syllabi) {
    const syllabusId = generateId();
    
    await supabase.from("master_syllabi").delete().eq("exam_type", s.examType);
    
    await supabase.from("master_syllabi").insert({
      id: syllabusId,
      name: s.name,
      exam_type: s.examType,
      version: "1.0"
    });

    const flatNodes: any[] = [];
    
    let subjectOrder = 0;
    const addSubject = (name: string, chapters: any[]) => {
      const subjId = generateId();
      flatNodes.push({ id: subjId, syllabus_id: syllabusId, parent_id: null, node_type: 'SUBJECT', name, order_index: subjectOrder++ });
      
      let chapOrder = 0;
      for (const chap of chapters) {
        const chapId = generateId();
        flatNodes.push({ id: chapId, syllabus_id: syllabusId, parent_id: subjId, node_type: 'CHAPTER', name: chap.name, order_index: chapOrder++ });
        
        let topOrder = 0;
        for (const topic of (chap.topics || [])) {
          const topId = generateId();
          flatNodes.push({ id: topId, syllabus_id: syllabusId, parent_id: chapId, node_type: 'TOPIC', name: topic, order_index: topOrder++ });
        }
      }
    };

    // --- PHYSICS (Common to JEE and NEET) ---
    const physicsChapters = [
      { name: "Physical World and Measurement", topics: ["Physics, scope and excitement", "Units of measurement", "Dimensions of physical quantities", "Errors in measurement"] },
      { name: "Kinematics", topics: ["Motion in a straight line", "Uniform and non-uniform motion", "Relative velocity", "Motion in a plane", "Projectile motion", "Uniform circular motion"] },
      { name: "Laws of Motion", topics: ["Intuitive concept of force", "Newton's first law of motion", "Newton's second law", "Newton's third law", "Law of conservation of linear momentum", "Friction", "Dynamics of uniform circular motion"] },
      { name: "Work, Energy and Power", topics: ["Work done by a constant force", "Work-energy theorem", "Power", "Potential energy", "Conservation of mechanical energy", "Collisions"] },
      { name: "Rotational Motion", topics: ["Centre of mass of a two-particle system", "Moment of momentum", "Torque", "Moment of inertia", "Radius of gyration", "Rolling motion"] },
      { name: "Gravitation", topics: ["Kepler's laws", "Universal law of gravitation", "Acceleration due to gravity", "Gravitational potential energy", "Escape velocity", "Satellites"] },
      { name: "Properties of Solids and Liquids", topics: ["Elastic behaviour", "Stress-strain relationship", "Hooke's law", "Pressure in a fluid", "Pascal's law", "Viscosity", "Surface tension", "Heat, temperature, thermal expansion", "Specific heat capacity", "Latent heat", "Heat transfer"] },
      { name: "Thermodynamics", topics: ["Thermal equilibrium", "First law of thermodynamics", "Second law of thermodynamics", "Reversible and irreversible processes", "Carnot engine"] },
      { name: "Kinetic Theory of Gases", topics: ["Equation of state of a perfect gas", "Kinetic theory of gases", "Degrees of freedom", "Law of equipartition of energy", "Mean free path"] },
      { name: "Oscillations and Waves", topics: ["Periodic motion", "Simple harmonic motion (SHM)", "Forced and damped oscillations", "Resonance", "Wave motion", "Transverse and longitudinal waves", "Superposition of waves", "Standing waves", "Beats", "Doppler effect"] },
      { name: "Electrostatics", topics: ["Electric charges", "Coulomb's law", "Electric field", "Electric flux", "Gauss's law", "Electric potential", "Capacitance", "Dielectrics"] },
      { name: "Current Electricity", topics: ["Electric current", "Ohm's law", "Electrical resistance", "Resistivity", "Kirchhoff's laws", "Wheatstone bridge", "Potentiometer"] },
      { name: "Magnetic Effects of Current and Magnetism", topics: ["Biot-Savart law", "Ampere's law", "Moving charges in magnetic field", "Force between parallel currents", "Torque on current loop", "Moving coil galvanometer", "Earth's magnetic field", "Magnetic properties of materials"] },
      { name: "Electromagnetic Induction and Alternating Currents", topics: ["Electromagnetic induction", "Faraday's law", "Lenz's law", "Self and mutual inductance", "Alternating currents", "LCR circuit", "Power in AC circuits", "AC generator and transformer"] },
      { name: "Electromagnetic Waves", topics: ["Displacement current", "Electromagnetic waves and their characteristics", "Electromagnetic spectrum"] },
      { name: "Optics", topics: ["Reflection of light", "Refraction of light", "Total internal reflection", "Lenses", "Dispersion", "Optical instruments", "Wave optics", "Interference", "Diffraction", "Polarisation"] },
      { name: "Dual Nature of Matter and Radiation", topics: ["Photoelectric effect", "Einstein's photoelectric equation", "Matter waves", "De Broglie relation", "Davisson-Germer experiment"] },
      { name: "Atoms and Nuclei", topics: ["Alpha-particle scattering experiment", "Bohr model", "Energy levels", "Composition and size of nucleus", "Radioactivity", "Mass-energy relation", "Nuclear fission and fusion"] },
      { name: "Electronic Devices", topics: ["Semiconductors", "Semiconductor diode", "I-V characteristics", "Rectifier", "LED, photodiode, solar cell, Zener diode", "Logic gates"] },
      { name: "Communication Systems", topics: ["Elements of a communication system", "Bandwidth of signals", "Bandwidth of transmission medium", "Propagation of electromagnetic waves", "Amplitude modulation"] }
    ];

    // --- CHEMISTRY (Common to JEE and NEET) ---
    const chemistryChapters = [
      { name: "Some Basic Concepts of Chemistry", topics: ["Matter", "Dalton's atomic theory", "Atomic and molecular masses", "Mole concept", "Stoichiometry"] },
      { name: "Structure of Atom", topics: ["Thomson model", "Rutherford model", "Bohr model", "Quantum mechanical model", "Quantum numbers", "Electronic configuration"] },
      { name: "Classification of Elements and Periodicity in Properties", topics: ["Modern periodic law", "Periodic trends in properties", "Atomic radii", "Ionization enthalpy", "Electronegativity"] },
      { name: "Chemical Bonding and Molecular Structure", topics: ["Valence electrons", "Ionic bond", "Covalent bond", "VSEPR theory", "Valence bond theory", "Hybridization", "Molecular orbital theory", "Hydrogen bond"] },
      { name: "States of Matter", topics: ["Three states of matter", "Intermolecular interactions", "Gas laws", "Ideal gas equation", "Kinetic energy and molecular speeds", "Liquefaction of gases"] },
      { name: "Thermodynamics", topics: ["System and surroundings", "Work, heat, energy", "First law of thermodynamics", "Hess's law", "Entropy and spontaneity", "Second and third laws", "Gibbs energy"] },
      { name: "Equilibrium", topics: ["Equilibrium in physical and chemical processes", "Law of mass action", "Le Chatelier's principle", "Ionic equilibrium", "Acids, bases and salts", "Buffer solutions", "Solubility product"] },
      { name: "Redox Reactions", topics: ["Concept of oxidation and reduction", "Oxidation number", "Balancing redox reactions", "Standard electrode potential"] },
      { name: "Hydrogen", topics: ["Position in periodic table", "Isotopes", "Preparation and properties", "Hydrides", "Water and heavy water", "Hydrogen peroxide"] },
      { name: "s-Block Elements", topics: ["Group 1 and Group 2 elements", "General introduction", "Anomalous properties", "Preparation of some important compounds", "Biological importance"] },
      { name: "p-Block Elements", topics: ["Group 13 to Group 18 elements", "General introduction", "Trends in physical and chemical properties", "Important compounds", "Allotropes of carbon", "Oxoacids"] },
      { name: "d and f Block Elements", topics: ["Transition elements", "General characteristics", "Lanthanoids and Actinoids", "Preparation and properties of K2Cr2O7 and KMnO4"] },
      { name: "Coordination Compounds", topics: ["Ligands", "Coordination number", "IUPAC nomenclature", "Isomerism", "Bonding in coordination compounds", "Importance in biological systems"] },
      { name: "Organic Chemistry - Some Basic Principles and Techniques", topics: ["Tetravalence of carbon", "Classification of organic compounds", "Nomenclature", "Isomerism", "Fundamental concepts in organic reaction mechanism", "Purification and characterization"] },
      { name: "Hydrocarbons", topics: ["Alkanes", "Alkenes", "Alkynes", "Aromatic hydrocarbons", "Mechanism of electrophilic substitution"] },
      { name: "Environmental Chemistry", topics: ["Environmental pollution", "Atmospheric pollution", "Water pollution", "Soil pollution", "Green chemistry"] },
      { name: "Solid State", topics: ["Classification of solids", "Crystal lattice and unit cells", "Packing efficiency", "Imperfections in solids", "Electrical and magnetic properties"] },
      { name: "Solutions", topics: ["Types of solutions", "Expression of concentration", "Raoult's law", "Colligative properties", "Abnormal molecular mass"] },
      { name: "Electrochemistry", topics: ["Redox reactions", "Conductance in electrolytic solutions", "Kohlrausch's law", "Galvanic cells", "Nernst equation", "Fuel cells", "Corrosion"] },
      { name: "Chemical Kinetics", topics: ["Rate of reaction", "Factors affecting rate", "Order and molecularity", "Integrated rate equations", "Half life", "Arrhenius equation"] },
      { name: "Surface Chemistry", topics: ["Adsorption", "Catalysis", "Colloids", "Emulsions", "Nanomaterials"] },
      { name: "General Principles and Processes of Isolation of Elements", topics: ["Principles of metallurgy", "Concentration of ores", "Extraction of crude metal", "Refining", "Thermodynamic and electrochemical principles"] },
      { name: "Haloalkanes and Haloarenes", topics: ["Nomenclature", "C-X bond nature", "Preparation", "Physical and chemical properties", "Substitution reactions", "Environmental effects"] },
      { name: "Alcohols, Phenols and Ethers", topics: ["Nomenclature", "Preparation", "Physical and chemical properties", "Uses"] },
      { name: "Aldehydes, Ketones and Carboxylic Acids", topics: ["Nomenclature", "Carbonyl group", "Preparation", "Physical and chemical properties", "Nucleophilic addition", "Acidity of carboxylic acids"] },
      { name: "Amines", topics: ["Nomenclature", "Structure", "Preparation", "Physical and chemical properties", "Diazonium salts"] },
      { name: "Biomolecules", topics: ["Carbohydrates", "Proteins", "Vitamins", "Nucleic acids", "Enzymes", "Hormones"] },
      { name: "Polymers", topics: ["Classification", "Methods of polymerization", "Copolymerization", "Important polymers", "Biodegradable polymers"] },
      { name: "Chemistry in Everyday Life", topics: ["Chemicals in medicines", "Chemicals in food", "Cleansing agents"] }
    ];

    addSubject("Physics", physicsChapters);
    addSubject("Chemistry", chemistryChapters);

    if (s.examType === "JEE") {
      // --- MATHEMATICS (JEE Only) ---
      const mathChapters = [
        { name: "Sets, Relations and Functions", topics: ["Sets and their representation", "Union, intersection, difference", "Relations", "Functions", "Types of functions", "Composite functions", "Inverse functions"] },
        { name: "Complex Numbers and Quadratic Equations", topics: ["Complex numbers in the form a+ib", "Argand diagram", "Algebra of complex numbers", "Quadratic equations in real and complex number system", "Roots and coefficients"] },
        { name: "Matrices and Determinants", topics: ["Types of matrices", "Algebra of matrices", "Determinants of order 2 and 3", "Properties of determinants", "Adjoint and inverse", "System of linear equations"] },
        { name: "Permutations and Combinations", topics: ["Fundamental principle of counting", "Factorial", "Permutations (nPr)", "Combinations (nCr)", "Applications"] },
        { name: "Mathematical Induction", topics: ["Principle of mathematical induction", "Applications"] },
        { name: "Binomial Theorem", topics: ["Binomial theorem for positive integral index", "General and middle term", "Properties of binomial coefficients"] },
        { name: "Sequences and Series", topics: ["Arithmetic progression (A.P.)", "Geometric progression (G.P.)", "Harmonic progression (H.P.)", "Arithmetico-geometric series", "Sum of n terms of special series"] },
        { name: "Limit, Continuity and Differentiability", topics: ["Limits", "Continuity", "Derivatives", "Differentiation of functions", "Rolle's and Lagrange's mean value theorems", "Applications of derivatives"] },
        { name: "Integral Calculus", topics: ["Indefinite integrals", "Methods of integration", "Definite integrals", "Fundamental theorem of calculus", "Properties of definite integrals", "Area bounded by curves"] },
        { name: "Differential Equations", topics: ["Order and degree", "Formation of differential equations", "Solution of ordinary differential equations", "Linear differential equations"] },
        { name: "Coordinate Geometry", topics: ["Straight lines", "Circles", "Conic sections", "Parabola", "Ellipse", "Hyperbola"] },
        { name: "Three Dimensional Geometry", topics: ["Direction cosines and ratios", "Equation of a line in space", "Equation of a plane", "Skew lines", "Shortest distance between two lines"] },
        { name: "Vector Algebra", topics: ["Vectors and scalars", "Addition of vectors", "Components of a vector", "Scalar and vector products", "Scalar triple product"] },
        { name: "Statistics and Probability", topics: ["Measures of dispersion", "Mean deviation, variance, standard deviation", "Probability", "Conditional probability", "Bayes' theorem", "Random variables", "Binomial distribution"] },
        { name: "Trigonometry", topics: ["Trigonometric functions and identities", "Trigonometric equations", "Inverse trigonometric functions", "Heights and distances"] },
        { name: "Mathematical Reasoning", topics: ["Statements", "Logical operations", "Tautology, contradiction, contingency"] }
      ];
      addSubject("Mathematics", mathChapters);
    } else {
      // --- BIOLOGY (NEET Only) ---
      const biologyChapters = [
        { name: "Diversity in Living World", topics: ["What is living?", "Biodiversity", "Need for classification", "Five kingdom classification", "Plant kingdom", "Animal kingdom"] },
        { name: "Structural Organisation in Animals and Plants", topics: ["Morphology and anatomy of flowering plants", "Animal tissues", "Morphology, anatomy and functions of different systems (earthworm, cockroach, frog)"] },
        { name: "Cell Structure and Function", topics: ["Cell theory", "Prokaryotic and eukaryotic cells", "Cell organelles", "Biomolecules", "Cell cycle and cell division"] },
        { name: "Plant Physiology", topics: ["Transport in plants", "Mineral nutrition", "Photosynthesis", "Respiration", "Plant growth and development"] },
        { name: "Human Physiology", topics: ["Digestion and absorption", "Breathing and respiration", "Body fluids and circulation", "Excretory products and their elimination", "Locomotion and movement", "Neural control and coordination", "Chemical coordination and integration"] },
        { name: "Reproduction", topics: ["Reproduction in organisms", "Sexual reproduction in flowering plants", "Human reproduction", "Reproductive health"] },
        { name: "Genetics and Evolution", topics: ["Heredity and variation", "Molecular basis of inheritance", "Evolution"] },
        { name: "Biology and Human Welfare", topics: ["Health and disease", "Improvement in food production", "Microbes in human welfare"] },
        { name: "Biotechnology and Its Applications", topics: ["Principles and processes of biotechnology", "Application of biotechnology in health and agriculture"] },
        { name: "Ecology and environment", topics: ["Organisms and populations", "Ecosystems", "Biodiversity and its conservation", "Environmental issues"] }
      ];
      addSubject("Biology", biologyChapters);
    }

    console.log(`Inserting ${flatNodes.length} nodes for ${s.name}...`);
    // Insert in batches of 500 to avoid request size limits
    const chunkSize = 500;
    for (let i = 0; i < flatNodes.length; i += chunkSize) {
      const chunk = flatNodes.slice(i, i + chunkSize);
      const { error } = await supabase.from("master_syllabus_nodes").insert(chunk);
      if (error) {
        console.error("Error inserting nodes:", error.message);
        break;
      }
    }
  }

  console.log("Full syllabus seed complete.");
}

main().catch(console.error);
