"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExamDefinition } from "@/types/exam";

export function ExamInstructions({
  exam,
  onProceed,
}: {
  exam: ExamDefinition;
  onProceed: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#c8d0dc] p-4 font-sans">
      <Card className="w-full max-w-4xl shadow-lg border-t-4 border-t-[#f37021]">
        <CardHeader className="bg-white border-b px-6 py-4">
          <CardTitle className="text-xl font-bold text-[#1a3c6e]">
            {exam.title} - Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white px-8 py-6">
          <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Please read the instructions carefully</h3>
            <p><strong>General Instructions:</strong></p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>The total duration of the examination is <strong>{exam.durationMinutes} minutes</strong>.</li>
              <li>The clock will be set at the server. The countdown timer in the top right corner of the screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
              <li>The Question Palette displayed on the right side of the screen will show the status of each question using one of the following symbols:
                <ul className="list-none pl-0 mt-2 space-y-2">
                  <li className="flex items-center gap-2"><div className="w-8 h-8 flex items-center justify-center border border-gray-300 bg-white shadow-sm font-semibold">1</div> You have not visited the question yet.</li>
                  <li className="flex items-center gap-2"><div className="w-8 h-8 flex items-center justify-center bg-[#f37021] text-white clip-not-answered font-semibold" style={{ clipPath: "polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)" }}>2</div> You have not answered the question.</li>
                  <li className="flex items-center gap-2"><div className="w-8 h-8 flex items-center justify-center bg-[#4caf50] text-white clip-answered font-semibold" style={{ clipPath: "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)" }}>3</div> You have answered the question.</li>
                  <li className="flex items-center gap-2"><div className="w-8 h-8 flex items-center justify-center bg-[#5c246f] text-white rounded-full font-semibold">4</div> You have NOT answered the question, but have marked the question for review.</li>
                  <li className="flex items-center gap-2"><div className="w-8 h-8 flex items-center justify-center bg-[#5c246f] text-white rounded-full font-semibold relative">5<span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#4caf50] rounded-full border border-white" /></div> The question(s) "Answered and Marked for Review" will be considered for evaluation.</li>
                </ul>
              </li>
              <li>You can click on the "&gt;" arrow which appears to the left of the question palette to collapse the question palette thereby maximizing the question window. To view the question palette again, you can click on "&lt;" which appears on the right side of the question window.</li>
              <li>You can click on your "Profile" image on the top right corner of your screen to change the language during the exam for entire question paper.</li>
            </ol>
            <p><strong>Navigating to a Question:</strong></p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>To answer a question, do the following:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using this option does NOT save your answer to the current question.</li>
                  <li>Click on <strong>Save & Next</strong> to save your answer for the current question and then go to the next question.</li>
                  <li>Click on <strong>Mark for Review & Next</strong> to save your answer for the current question, mark it for review, and then go to the next question.</li>
                </ul>
              </li>
            </ol>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-md border border-blue-100">
              <Checkbox 
                id="declaration" 
                checked={accepted} 
                onCheckedChange={(c) => setAccepted(c === true)} 
                className="mt-1"
              />
              <label htmlFor="declaration" className="text-sm text-gray-700 leading-relaxed cursor-pointer font-medium">
                I have read and understood the instructions. All computer hardware allotted to me are in proper working condition. I declare that I am not in possession of / not wearing / not carrying any prohibited gadget like mobile phone, bluetooth devices etc. /any prohibited material with me into the Examination Hall. I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action, which may include ban from future Tests / Examinations.
              </label>
            </div>
            <div className="mt-6 flex justify-center">
              <Button 
                onClick={onProceed} 
                disabled={!accepted}
                className="bg-[#1a3c6e] hover:bg-[#152d52] px-8 py-6 text-lg font-semibold w-full sm:w-auto"
              >
                PROCEED
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
