CREATE TABLE public.course_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_photos TO authenticated;
GRANT ALL ON public.course_photos TO service_role;
ALTER TABLE public.course_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own course photos" ON public.course_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own photo files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'course-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own photo files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own photo files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'course-photos' AND (storage.foldername(name))[1] = auth.uid()::text);