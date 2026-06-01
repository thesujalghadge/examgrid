CREATE TABLE IF NOT EXISTS question_solutions (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  solution_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
