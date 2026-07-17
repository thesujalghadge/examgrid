import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopicInsight } from "@/services/student-analytics-service";

export function SpeedAnalysis({
  speedAnalysis
}: {
  speedAnalysis: {
    mastered: TopicInsight[];
    inefficient: TopicInsight[];
    rushing: TopicInsight[];
    needsWork: TopicInsight[];
  }
}) {
  const renderTopicList = (topics: TopicInsight[], emptyText: string) => {
    if (topics.length === 0) return <div className="text-xs text-[#5e5a52] italic">{emptyText}</div>;
    return (
      <ul className="space-y-2">
        {topics.map(topic => (
          <li key={topic.nodeId} className="flex justify-between items-start text-sm">
            <div>
              <span className="font-medium text-[#14213d]">{topic.nodeName}</span>
              <div className="text-xs text-[#5e5a52]">{topic.subjectName} &rarr; {topic.chapterName}</div>
            </div>
            <div className="text-right">
              <span className="font-bold text-[#14213d]">{(topic.accuracy * 100).toFixed(0)}%</span>
              <div className="text-xs text-[#5e5a52]">{Math.round(topic.avgTimeSeconds)}s</div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card className="border-[#d8d2c7] bg-white">
      <CardHeader>
        <CardTitle className="text-lg text-[#14213d]">Speed vs Accuracy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          
          <div className="bg-green-50 p-4 rounded-md border border-green-100">
            <h4 className="font-semibold text-green-800 flex items-center mb-2">
              <span className="mr-2">🟢</span> Mastered
            </h4>
            <p className="text-xs text-green-700 mb-3">Fast & Accurate</p>
            {renderTopicList(speedAnalysis.mastered, "No topics in this quadrant yet.")}
          </div>

          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100">
            <h4 className="font-semibold text-yellow-800 flex items-center mb-2">
              <span className="mr-2">🟡</span> Inefficient
            </h4>
            <p className="text-xs text-yellow-700 mb-3">Slow & Accurate</p>
            {renderTopicList(speedAnalysis.inefficient, "No topics in this quadrant yet.")}
          </div>

          <div className="bg-orange-50 p-4 rounded-md border border-orange-100">
            <h4 className="font-semibold text-orange-800 flex items-center mb-2">
              <span className="mr-2">🟠</span> Rushing
            </h4>
            <p className="text-xs text-orange-700 mb-3">Fast & Inaccurate</p>
            {renderTopicList(speedAnalysis.rushing, "No topics in this quadrant yet.")}
          </div>

          <div className="bg-red-50 p-4 rounded-md border border-red-100">
            <h4 className="font-semibold text-red-800 flex items-center mb-2">
              <span className="mr-2">🔴</span> Needs Work
            </h4>
            <p className="text-xs text-red-700 mb-3">Slow & Inaccurate</p>
            {renderTopicList(speedAnalysis.needsWork, "No topics in this quadrant yet.")}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
