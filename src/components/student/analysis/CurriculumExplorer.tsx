"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubjectHierarchy, ChapterHierarchy, TopicInsight } from "@/services/student-analytics-service";
import { ChevronDown, ChevronRight } from "lucide-react";

function NodeStats({ accuracy, totalAttempted, avgTimeSeconds }: { accuracy: number, totalAttempted: number, avgTimeSeconds: number }) {
  return (
    <div className="flex items-center space-x-6 text-sm text-[#5e5a52]">
      <div className="w-16 text-right">
        <span className={`font-bold ${accuracy >= 0.75 ? 'text-green-600' : accuracy <= 0.4 ? 'text-red-600' : 'text-yellow-600'}`}>
          {(accuracy * 100).toFixed(0)}%
        </span>
      </div>
      <div className="w-20 text-right">{totalAttempted} att.</div>
      <div className="w-16 text-right">{Math.round(avgTimeSeconds)}s</div>
    </div>
  );
}

function TopicRow({ topic }: { topic: TopicInsight }) {
  return (
    <div className="flex items-center justify-between py-2 pl-12 pr-4 border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        <span className="font-medium text-[#14213d] text-sm">{topic.nodeName}</span>
      </div>
      <NodeStats accuracy={topic.accuracy} totalAttempted={topic.totalAttempted} avgTimeSeconds={topic.avgTimeSeconds} />
    </div>
  );
}

function ChapterRow({ chapter }: { chapter: ChapterHierarchy }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-gray-100">
      <div 
        className="flex items-center justify-between py-3 pl-6 pr-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-semibold text-[#14213d]">{chapter.nodeName}</span>
        </div>
        <NodeStats accuracy={chapter.accuracy} totalAttempted={chapter.totalAttempted} avgTimeSeconds={chapter.avgTimeSeconds} />
      </div>
      {isOpen && (
        <div className="bg-white">
          {chapter.topics.length > 0 ? (
            chapter.topics.map(topic => <TopicRow key={topic.nodeId} topic={topic} />)
          ) : (
            <div className="py-2 pl-12 text-sm text-gray-400 italic">No topics attempted</div>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectRow({ subject }: { subject: SubjectHierarchy }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-[#d8d2c7] bg-white overflow-hidden mb-4">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-[#fbf9f4]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          {isOpen ? <ChevronDown className="w-5 h-5 text-[#14213d]" /> : <ChevronRight className="w-5 h-5 text-[#14213d]" />}
          <h3 className="font-bold text-lg text-[#14213d]">{subject.nodeName}</h3>
        </div>
        <NodeStats accuracy={subject.accuracy} totalAttempted={subject.totalAttempted} avgTimeSeconds={subject.avgTimeSeconds} />
      </div>
      {isOpen && (
        <div>
          {subject.chapters.length > 0 ? (
            subject.chapters.map(chapter => <ChapterRow key={chapter.nodeId} chapter={chapter} />)
          ) : (
            <div className="p-4 pl-6 text-sm text-gray-400 italic">No chapters attempted</div>
          )}
        </div>
      )}
    </Card>
  );
}

export function CurriculumExplorer({ curriculum }: { curriculum: SubjectHierarchy[] }) {
  if (curriculum.length === 0) {
    return (
      <Card className="border-[#d8d2c7] bg-white">
        <CardContent className="p-8 text-center text-[#5e5a52]">
          No curriculum data available. Complete an exam to see your breakdown.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-8">
      <h3 className="text-xl font-bold text-[#14213d] mb-4">Curriculum Explorer</h3>
      {curriculum.map(subject => (
        <SubjectRow key={subject.nodeId} subject={subject} />
      ))}
    </div>
  );
}
