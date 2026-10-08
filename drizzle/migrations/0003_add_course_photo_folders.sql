ALTER TABLE public.course_photos ADD COLUMN folder_name text;
COMMENT ON COLUMN public.course_photos.tutorial_no IS 'DEPRECATED: replaced by folder_name';

CREATE TABLE public.course_photo_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_photo_folders TO authenticated;
GRANT ALL ON public.course_photo_folders TO service_role;

ALTER TABLE public.course_photo_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own photo folders" ON public.course_photo_folders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);