-- Create storage bucket for curriculum artifacts if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('curriculum_artifacts', 'curriculum_artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for curriculum_artifacts storage
DROP POLICY IF EXISTS "Platform Admins can manage curriculum_artifacts" ON storage.objects;
CREATE POLICY "Platform Admins can manage curriculum_artifacts"
ON storage.objects FOR ALL
USING (bucket_id = 'curriculum_artifacts' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'curriculum_artifacts' AND auth.role() = 'authenticated');
