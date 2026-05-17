"use client";

import { useCallback, useRef, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { evaluateCalculatorExpression } from "@/lib/calculator-engine";
import { cn } from "@/lib/utils";

const BTN =
  "h-8 min-w-0 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 active:bg-slate-200";

export function ExamCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [memory, setMemory] = useState(0);
  const [position, setPosition] = useState({ x: 80, y: 100 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const append = useCallback((token: string) => {
    setDisplay((d) => {
      if (d === "Error") return token === "." ? "0." : token;
      if (d === "0" && /^[\d(]/.test(token)) return token;
      if (d === "0" && token === ".") return "0.";
      if (d === "0") return token;
      return d + token;
    });
  }, []);

  const clearAll = () => setDisplay("0");
  const clearEntry = () => setDisplay("0");

  const calculate = () => {
    setDisplay(evaluateCalculatorExpression(display));
  };

  const unary = (fn: (x: number) => number) => {
    const n = Number(display);
    if (Number.isNaN(n)) {
      setDisplay("Error");
      return;
    }
    const r = fn(n);
    setDisplay(Number.isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : "Error");
  };

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPosition({
      x: Math.max(0, dragRef.current.origX + (e.clientX - dragRef.current.startX)),
      y: Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY)),
    });
  };

  const onHeaderPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="fixed bottom-4 left-4 z-50 h-10 gap-2 border-[#1a3c6e] bg-white px-4 font-semibold text-[#1a3c6e] shadow-lg hover:bg-blue-50"
        onClick={() => setOpen((o) => !o)}
      >
        <Calculator className="h-4 w-4" />
        {open ? "Close Calculator" : "Calculator"}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 w-[280px] select-none rounded border-2 border-[#1a3c6e] bg-[#f0f0f0] shadow-2xl"
          style={{ left: position.x, top: position.y }}
        >
          <div
            className="flex cursor-move items-center justify-between bg-[#1a3c6e] px-2 py-1.5 text-white"
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
          >
            <span className="text-xs font-bold">Scientific Calculator</span>
            <button
              type="button"
              className="px-2 text-lg leading-none hover:bg-white/20"
              onClick={() => setOpen(false)}
              aria-label="Close calculator"
            >
              ×
            </button>
          </div>

          <div className="border-b border-gray-400 bg-white px-2 py-2 text-right font-mono text-xl font-bold text-[#1a3c6e]">
            {display}
          </div>

          <div className="grid grid-cols-5 gap-1 p-2">
            <CalcBtn label="MC" onClick={() => setMemory(0)} />
            <CalcBtn label="MR" onClick={() => setDisplay(String(memory))} />
            <CalcBtn label="M+" onClick={() => setMemory((m) => m + Number(display))} />
            <CalcBtn label="M−" onClick={() => setMemory((m) => m - Number(display))} />
            <CalcBtn label="CE" onClick={clearEntry} />

            <CalcBtn label="sin" onClick={() => append("sin(")} className="col-span-1" />
            <CalcBtn label="cos" onClick={() => append("cos(")} />
            <CalcBtn label="tan" onClick={() => append("tan(")} />
            <CalcBtn label="log" onClick={() => append("log(")} />
            <CalcBtn label="ln" onClick={() => append("ln(")} />

            <CalcBtn label="√" onClick={() => append("sqrt(")} />
            <CalcBtn label="x²" onClick={() => unary((x) => x * x)} />
            <CalcBtn label="1/x" onClick={() => unary((x) => 1 / x)} />
            <CalcBtn label="%" onClick={() => append("%")} />
            <CalcBtn label="C" onClick={clearAll} />

            <CalcBtn label="7" onClick={() => append("7")} />
            <CalcBtn label="8" onClick={() => append("8")} />
            <CalcBtn label="9" onClick={() => append("9")} />
            <CalcBtn label="÷" onClick={() => append("/")} />
            <CalcBtn label="(" onClick={() => append("(")} />

            <CalcBtn label="4" onClick={() => append("4")} />
            <CalcBtn label="5" onClick={() => append("5")} />
            <CalcBtn label="6" onClick={() => append("6")} />
            <CalcBtn label="×" onClick={() => append("*")} />
            <CalcBtn label=")" onClick={() => append(")")} />

            <CalcBtn label="1" onClick={() => append("1")} />
            <CalcBtn label="2" onClick={() => append("2")} />
            <CalcBtn label="3" onClick={() => append("3")} />
            <CalcBtn label="−" onClick={() => append("-")} />
            <CalcBtn label="π" onClick={() => append("π")} />

            <CalcBtn label="0" onClick={() => append("0")} className="col-span-2" />
            <CalcBtn label="." onClick={() => append(".")} />
            <CalcBtn label="+" onClick={() => append("+")} />
            <CalcBtn label="=" onClick={calculate} className="bg-[#1a3c6e] text-white hover:bg-[#152d52]" />
          </div>
        </div>
      )}
    </>
  );
}

function CalcBtn({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={cn(BTN, className)} onClick={onClick}>
      {label}
    </button>
  );
}
