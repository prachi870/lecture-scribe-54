-- Create lecture_posters table
CREATE TABLE IF NOT EXISTS lecture_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  concepts JSONB DEFAULT '[]'::jsonb,
  flow_steps JSONB DEFAULT '[]'::jsonb,
  diagram_type TEXT,
  image_url TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lecture_id)
);

-- Add RLS policies
ALTER TABLE lecture_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lecture posters"
  ON lecture_posters FOR SELECT
  USING (
    lecture_id IN (
      SELECT id FROM lectures WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own lecture posters"
  ON lecture_posters FOR INSERT
  WITH CHECK (
    lecture_id IN (
      SELECT id FROM lectures WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own lecture posters"
  ON lecture_posters FOR UPDATE
  USING (
    lecture_id IN (
      SELECT id FROM lectures WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own lecture posters"
  ON lecture_posters FOR DELETE
  USING (
    lecture_id IN (
      SELECT id FROM lectures WHERE user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lecture_posters_lecture_id ON lecture_posters(lecture_id);
