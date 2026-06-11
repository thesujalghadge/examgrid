const fs = require('fs');
const file = 'c:/AI/examgrid/src/components/exam/ExamCalculator.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const [position, setPosition] = useState({ x: 80, y: 100 });',
  'const [position, setPosition] = useState({ x: 300, y: 100 });\n  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);\n  const panelRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    setPosition({ x: Math.max(0, window.innerWidth - 600), y: 100 });\n  }, []);'
);

code = code.replace(
  '  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);\n  const panelRef = useRef<HTMLDivElement>(null);\n',
  ''
);

code = code.replace(
  'import { useCallback, useRef, useState } from "react";',
  'import { useCallback, useEffect, useRef, useState } from "react";'
);

code = code.replace(
  'className="fixed bottom-4 left-4 z-50 h-10 gap-2 border-[#1a3c6e] bg-white px-4 font-semibold text-[#1a3c6e] shadow-lg hover:bg-blue-50"',
  'className="fixed top-[76px] right-[320px] max-md:right-2 z-40 h-8 gap-2 border-gray-400 bg-white px-3 text-xs font-semibold text-[#1a3c6e] shadow hover:bg-gray-50"'
);

fs.writeFileSync(file, code);
