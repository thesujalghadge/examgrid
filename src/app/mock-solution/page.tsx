import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MockSolutionPage() {
  const solution = {
    subject: "Physics",
    chapter: "Kinematics",
    concepts: ["Projectile Motion", "Time of Flight"],
    approach: "Use the standard time of flight formula for a projectile: T = (2u * sin(θ)) / g.",
    steps: [
      "Identify the given initial values: initial velocity u = 20 m/s, angle θ = 30°.",
      "Substitute the values into the formula: T = (2 * 20 * sin(30°)) / 10.",
      "Calculate the sine of 30 degrees: sin(30°) = 0.5.",
      "Compute the result: T = (40 * 0.5) / 10 = 20 / 10 = 2 seconds."
    ],
    final_answer: "2",
    takeaway: "Always double check the angle and unit of gravity when computing time of flight."
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[#14213d] mb-4">Mock Solution Proof</h1>
        
        <Card className="border border-[#ece6da] shadow-sm">
          <CardContent className="pt-6 space-y-6">
            
            {/* Question Stand-in */}
            <div className="mb-6 border-b border-gray-100 pb-6">
              <span className="font-bold text-[#14213d] mr-2">Q1.</span>
              <p className="inline font-medium text-[#14213d]">A projectile is fired with an initial velocity of 20 m/s at an angle of 30° to the horizontal. Calculate the time of flight (g = 10 m/s²).</p>
              
              <div className="mt-4 flex gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-[#5e5a52] uppercase font-bold tracking-wider">Your Answer</span>
                  <span className="text-base font-semibold text-red-600">3</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-[#5e5a52] uppercase font-bold tracking-wider">Correct Answer</span>
                  <span className="text-base font-semibold text-[#14213d]">2</span>
                </div>
                <Badge className="ml-auto bg-red-100 text-red-800 border-red-200">✗ Incorrect</Badge>
              </div>
            </div>

            {/* Solution Block */}
            <div className="bg-[#fdfcf9] rounded-xl p-6 border border-[#e5e0d3] shadow-sm">
              
              {/* Header: Subject, Chapter, Concepts */}
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-100">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{solution.subject}</Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{solution.chapter}</Badge>
                {solution.concepts.map(c => (
                  <Badge key={c} variant="outline" className="bg-white text-slate-700 border-slate-200">{c}</Badge>
                ))}
              </div>

              <div className="space-y-6">
                
                {/* Approach */}
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                  <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                    💡 Approach
                  </h4>
                  <p className="text-base font-medium text-indigo-950 leading-relaxed">
                    {solution.approach}
                  </p>
                </div>

                {/* Steps */}
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    📝 Step-by-Step Solution
                  </h4>
                  <ul className="space-y-4">
                    {solution.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-4 text-base text-slate-800 leading-relaxed items-start">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="pt-1">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Final Answer */}
                <div className="bg-green-50 p-5 rounded-lg border border-green-200 flex flex-col sm:flex-row sm:items-center gap-4">
                  <h4 className="text-xs font-bold text-green-800 uppercase tracking-wider flex-shrink-0">
                    🎯 Final Answer
                  </h4>
                  <div className="text-xl font-bold text-green-900 bg-white px-6 py-2 rounded-md border border-green-200 shadow-sm w-full sm:w-auto text-center">
                    {solution.final_answer}
                  </div>
                </div>

                {/* Key Takeaway */}
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 mt-6 border-l-4 border-l-amber-400">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                    🔑 Key Takeaway
                  </h4>
                  <p className="text-sm font-medium text-amber-950">
                    {solution.takeaway}
                  </p>
                </div>

              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
