import { describe, it, expect, vi } from "vitest";
import { verifyMapping } from "../verification-queue-service";

// Mock Supabase client
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ data: { id: "new-mapping" }, error: null });
const mockSelect = vi.fn().mockResolvedValue({
  data: {
    question_id: "q1",
    subject_id: "s1",
    chapter_id: "c1",
    topic_id: "t1",
    subtopic_id: "st1",
    confidence: 0.85,
    structured_evidence: {}
  },
  error: null
});
const mockNodeSelect = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    data: { id: "st1", parent_id: "t1", node_type: "SUBTOPIC" },
    error: null
  });
});

vi.mock("@/lib/institute/get-institute-api-key", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: table === "curriculum_nodes" ? mockNodeSelect : mockSelect
        }))
      })),
      update: vi.fn(() => ({
        eq: mockUpdate
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: mockInsert }))
      }))
    })
  })
}));

describe("Verification Queue Service", () => {
  it("teacher verification creates new mapping and archives old", async () => {
    const result = await verifyMapping({
      existingMappingId: "old-mapping",
      teacherId: "teacher1"
    });

    expect(mockUpdate).toHaveBeenCalledWith("old-mapping");
    expect(mockInsert).toHaveBeenCalled();
    // It should insert with VERIFIED status
  });
});
