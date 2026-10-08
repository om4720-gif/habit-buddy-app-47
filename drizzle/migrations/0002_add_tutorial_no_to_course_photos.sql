ALTER TABLE public.course_photos ADD COLUMN tutorial_no integer;
COMMENT ON COLUMN public.course_photos.tutorial_no IS 'Tutorial folder number (1-5) this photo belongs to; null = unsorted';