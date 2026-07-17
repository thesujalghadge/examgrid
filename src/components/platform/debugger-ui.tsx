"use client";

import { useState } from "react";
import { runDebuggerTrace, persistDebuggerTrace } from "@/services/debugger-service";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CheckCircle, Copy, Code, Save, PlayCircle, AlertTriangle } from "lucide-react";

export function DebuggerUI({ questions }: { questions: any[] }) {
  const [selectedQuestion, setSelectedQuestion] = useState(questions[0]?.id || "");
  const [trace, setTrace] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistSuccess, setPersistSuccess] = useState(false);

  // Collapsible state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "input": true,
    "embedding": false,
    "retrieval": true,
    "prompt": false,
    "raw_response": false,
    "parsed": true,
    "validation": true,
    "hierarchy": true,
    "persistence": true
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunTrace = async () => {
    if (!selectedQuestion) return;
    setIsPending(true);
    setError(null);
    setTrace(null);
    setPersistSuccess(false);

    try {
      const res = await runDebuggerTrace(selectedQuestion);
      if (res.success) {
        setTrace(res.trace);
      } else {
        setError(res.error || "Failed to trace");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  };

  const handlePersist = async () => {
    if (!trace?.persistence_preview) return;
    setIsPersisting(true);
    try {
      const res = await persistDebuggerTrace(selectedQuestion, trace.persistence_preview);
      if (res.success) {
        setPersistSuccess(true);
      } else {
        alert("Failed to persist");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsPersisting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple UX feedback could go here
  };

  return (
    <div className="space-y-6">
      {/* Input Header */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg flex items-center">
          <PlayCircle className="w-5 h-5 mr-2 text-primary" />
          Execution Configuration
        </h2>
        
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium">Select Question to Trace</label>
            <select 
              className="w-full border rounded-md p-2 bg-background"
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
            >
              {questions.map(q => (
                <option key={q.id} value={q.id}>{q.question_text.substring(0, 100)}...</option>
              ))}
            </select>
          </div>
          <Button 
            onClick={handleRunTrace} 
            disabled={isPending || !selectedQuestion}
            className="w-40"
          >
            {isPending ? "Executing..." : "Run Dry Trace"}
          </Button>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Trace Results */}
      {trace && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Execution Trace <span className="text-sm text-muted-foreground ml-2 font-normal">({trace.total_latency_ms}ms)</span></h3>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(trace, null, 2))}>
              <Code className="w-4 h-4 mr-2" /> Export JSON
            </Button>
          </div>

          <Section title="1. Retrieval Input (Semantic String)" id="input" open={openSections["input"]} onToggle={() => toggleSection("input")}>
            <pre className="text-xs p-3 bg-muted/50 rounded overflow-x-auto whitespace-pre-wrap">{trace.retrieval_input}</pre>
          </Section>

          <Section title={`2. Embedding (${trace.embedding.latency_ms}ms)`} id="embedding" open={openSections["embedding"]} onToggle={() => toggleSection("embedding")}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Provider:</span> {trace.embedding.provider}</div>
              <div><span className="text-muted-foreground">Model:</span> {trace.embedding.model}</div>
            </div>
          </Section>

          <Section title="3. Top-K Candidates" id="retrieval" open={openSections["retrieval"]} onToggle={() => toggleSection("retrieval")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 border">Rank</th>
                    <th className="px-3 py-2 border">Similarity</th>
                    <th className="px-3 py-2 border">Type</th>
                    <th className="px-3 py-2 border">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.candidates.map((c: any) => (
                    <tr key={c.node_id} className="hover:bg-muted/30">
                      <td className="px-3 py-1 border">{c.rank}</td>
                      <td className="px-3 py-1 border">{c.similarity_score.toFixed(4)}</td>
                      <td className="px-3 py-1 border">{c.node_type}</td>
                      <td className="px-3 py-1 border text-xs">{c.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section 
            title="4. LLM Prompt" 
            id="prompt" 
            open={openSections["prompt"]} 
            onToggle={() => toggleSection("prompt")}
            action={<Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(trace.prompt); }}><Copy className="w-3 h-3 mr-1"/> Copy</Button>}
          >
            <pre className="text-xs p-3 bg-muted/50 rounded overflow-x-auto whitespace-pre-wrap">{trace.prompt}</pre>
          </Section>

          <Section 
            title="5. Raw Provider Response" 
            id="raw_response" 
            open={openSections["raw_response"]} 
            onToggle={() => toggleSection("raw_response")}
            action={<Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(trace.raw_response); }}><Copy className="w-3 h-3 mr-1"/> Copy</Button>}
          >
            <pre className="text-xs p-3 bg-muted/50 rounded overflow-x-auto whitespace-pre-wrap">{trace.raw_response}</pre>
          </Section>

          <Section title="6. Parsed Output" id="parsed" open={openSections["parsed"]} onToggle={() => toggleSection("parsed")}>
            <pre className="text-xs p-3 bg-muted/50 rounded overflow-x-auto">{JSON.stringify(trace.parsed_response, null, 2)}</pre>
          </Section>

          <Section title="7. Hard Validation" id="validation" open={openSections["validation"]} onToggle={() => toggleSection("validation")}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" /> UUID Exists in Curriculum</div>
              <div className="flex items-center">
                {trace.validation.uuid_in_candidates ? <CheckCircle className="w-4 h-4 text-green-500 mr-2" /> : <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />}
                UUID restricted to Candidate List
              </div>
              <div className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" /> Leaf Node Verified</div>
            </div>
          </Section>

          <Section title="8. Derived Hierarchy" id="hierarchy" open={openSections["hierarchy"]} onToggle={() => toggleSection("hierarchy")}>
            <div className="flex items-center space-x-2 text-sm">
              {trace.derived_hierarchy.map((name: string, i: number) => (
                <div key={i} className="flex items-center">
                  <span className="font-medium px-2 py-1 bg-muted rounded">{name}</span>
                  {i < trace.derived_hierarchy.length - 1 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Section>

          <Section title="9. Persistence Preview" id="persistence" open={openSections["persistence"]} onToggle={() => toggleSection("persistence")}>
            <div className="flex items-start justify-between">
              <pre className="text-xs p-3 bg-muted/50 rounded overflow-x-auto flex-1">{JSON.stringify(trace.persistence_preview, null, 2)}</pre>
              <div className="ml-4 flex flex-col items-center">
                <Button onClick={handlePersist} disabled={isPersisting || persistSuccess} className={persistSuccess ? "bg-green-600 hover:bg-green-600" : ""}>
                  {persistSuccess ? <><CheckCircle className="w-4 h-4 mr-2" /> Persisted</> : <><Save className="w-4 h-4 mr-2" /> Persist Mapping</>}
                </Button>
                <span className="text-xs text-muted-foreground mt-2 text-center max-w-[150px]">
                  Write to production database manually
                </span>
              </div>
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}

function Section({ title, id, open, onToggle, children, action }: { title: string, id: string, open: boolean, onToggle: () => void, children: React.ReactNode, action?: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div 
        className="px-4 py-3 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center font-medium">
          {open ? <ChevronDown className="w-4 h-4 mr-2 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mr-2 text-muted-foreground" />}
          {title}
        </div>
        {action && open && <div onClick={e => e.stopPropagation()}>{action}</div>}
      </div>
      {open && (
        <div className="p-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
}
