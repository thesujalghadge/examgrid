"use client";

import { ChevronDown, ChevronRight, Book, Bookmark, FileText, Hash } from "lucide-react";
import { useState } from "react";

interface Node {
  id: string;
  parent_id: string | null;
  node_type: string;
  canonical_code: string;
  name: string;
  order_index: number;
}

export function CurriculumTreeViewer({ nodes }: { nodes: Node[] }) {
  // Build a hierarchy from flat list of nodes
  const rootNodes = nodes.filter(n => !n.parent_id).sort((a, b) => a.order_index - b.order_index);
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId).sort((a, b) => a.order_index - b.order_index);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'SUBJECT': return <Book className="w-4 h-4 text-blue-600" />;
      case 'CHAPTER': return <Bookmark className="w-4 h-4 text-emerald-600" />;
      case 'TOPIC': return <FileText className="w-4 h-4 text-purple-600" />;
      default: return <Hash className="w-4 h-4 text-gray-500" />;
    }
  };

  const TreeNode = ({ node, level = 0 }: { node: Node, level?: number }) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const [expanded, setExpanded] = useState(level < 1); // Auto-expand SUBJECT level by default

    return (
      <div className="select-none">
        <div 
          className="flex items-center py-2 px-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="w-6 flex justify-center items-center mr-1">
            {hasChildren ? (
              expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : <span className="w-4 h-4" />}
          </div>
          
          <div className="flex items-center gap-2">
            {getNodeIcon(node.node_type)}
            <span className="font-medium text-sm">{node.name}</span>
            {node.canonical_code && (
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                {node.canonical_code}
              </span>
            )}
          </div>
        </div>
        
        {expanded && hasChildren && (
          <div className="border-l border-muted ml-[calc(1rem+11px)]">
            {children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-y-auto max-h-[600px] border rounded-lg bg-card text-card-foreground">
      <div className="p-2 space-y-1">
        {rootNodes.map(node => (
          <TreeNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
