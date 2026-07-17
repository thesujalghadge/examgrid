import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopicInsight } from "@/services/student-analytics-service";

export function StrengthWeaknessList({ 
  strengths, 
  weaknesses 
}: { 
  strengths: TopicInsight[]; 
  weaknesses: TopicInsight[]; 
}) {
  const renderList = (topics: TopicInsight[], emptyMessage: string) => {
    if (topics.length === 0) {
      return <div className="text-sm text-[#5e5a52] italic">{emptyMessage}</div>;
    }
    
    return (
      <div className="space-y-4">
        {topics.map(topic => (
          <div key={topic.nodeId} className="flex flex-col space-y-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-[#14213d]">{topic.nodeName}</div>
                <div className="text-xs text-[#5e5a52]">
                  {topic.subjectName} &rarr; {topic.chapterName}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[#14213d]">{(topic.accuracy * 100).toFixed(0)}%</div>
                <div className="text-xs text-[#5e5a52]">{topic.totalAttempted} attempts</div>
              </div>
            </div>
            <div className="w-full bg-[#e5e5e5] h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${topic.accuracy >= 0.75 ? 'bg-green-500' : topic.accuracy <= 0.4 ? 'bg-red-500' : 'bg-yellow-500'}`}
                style={{ width: `${topic.accuracy * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-[#d8d2c7] bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-[#14213d]">Top Strengths</CardTitle>
        </CardHeader>
        <CardContent>
          {renderList(strengths, "Not enough data. Attempt more questions to see your strengths.")}
        </CardContent>
      </Card>
      
      <Card className="border-[#d8d2c7] bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-[#14213d]">Weaknesses</CardTitle>
        </CardHeader>
        <CardContent>
          {renderList(weaknesses, "Not enough data. Attempt more questions to see your weaknesses.")}
        </CardContent>
      </Card>
    </div>
  );
}
