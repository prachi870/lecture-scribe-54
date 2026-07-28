
-- Track original source URL for URL-ingested lectures
ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS source_url text;

-- Helper predicate reused in policies
CREATE OR REPLACE FUNCTION public.owns_lecture(_lecture_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures
    WHERE id = _lecture_id AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.owns_lecture(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_lecture(uuid) TO authenticated, service_role;

-- lecture_notes
CREATE TABLE public.lecture_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE UNIQUE,
  summary text,
  eli5 text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  glossary jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_notes TO authenticated;
GRANT ALL ON public.lecture_notes TO service_role;
ALTER TABLE public.lecture_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage notes for own lectures" ON public.lecture_notes
  FOR ALL TO authenticated
  USING (public.owns_lecture(lecture_id))
  WITH CHECK (public.owns_lecture(lecture_id));
CREATE TRIGGER lecture_notes_set_updated_at BEFORE UPDATE ON public.lecture_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- flashcards
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flashcards_lecture_idx ON public.flashcards(lecture_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage flashcards for own lectures" ON public.flashcards
  FOR ALL TO authenticated
  USING (public.owns_lecture(lecture_id))
  WITH CHECK (public.owns_lecture(lecture_id));
CREATE TRIGGER flashcards_set_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_lecture_idx ON public.chat_messages(lecture_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage chat for own lectures" ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.owns_lecture(lecture_id))
  WITH CHECK (public.owns_lecture(lecture_id));
