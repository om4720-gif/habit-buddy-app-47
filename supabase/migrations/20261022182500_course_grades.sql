CREATE TABLE public.course_grade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  score numeric CHECK (score IS NULL OR score >= 0),
  max_score numeric NOT NULL DEFAULT 100 CHECK (max_score > 0),
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 100),
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_grade_score_within_max CHECK (score IS NULL OR score <= max_score),
  CONSTRAINT course_grade_items_course_title_unique UNIQUE (course_id, title)
);

CREATE UNIQUE INDEX course_grade_items_one_final_per_course
  ON public.course_grade_items (course_id)
  WHERE is_final;
CREATE INDEX course_grade_items_user_course_idx
  ON public.course_grade_items (user_id, course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_grade_items TO authenticated;
GRANT ALL ON public.course_grade_items TO service_role;
ALTER TABLE public.course_grade_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own course grades" ON public.course_grade_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_grade_items.course_id
        AND courses.user_id = auth.uid()
    )
  );

CREATE TABLE public.course_grade_settings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  credit_hours numeric NOT NULL DEFAULT 3 CHECK (credit_hours > 0 AND credit_hours <= 30),
  grade_cutoffs jsonb NOT NULL DEFAULT
    '{"A+":{"minimum":94,"gpaStart":0.99,"gpaEnd":0.7},"A":{"minimum":90,"gpaStart":1.29,"gpaEnd":1},"A-":{"minimum":86,"gpaStart":1.69,"gpaEnd":1.3},"B+":{"minimum":82,"gpaStart":1.99,"gpaEnd":1.7},"B":{"minimum":78,"gpaStart":2.29,"gpaEnd":2},"B-":{"minimum":74,"gpaStart":2.69,"gpaEnd":2.3},"C+":{"minimum":70,"gpaStart":2.99,"gpaEnd":2.7},"C":{"minimum":65,"gpaStart":3.29,"gpaEnd":3},"C-":{"minimum":60,"gpaStart":3.69,"gpaEnd":3.3},"D+":{"minimum":55,"gpaStart":3.99,"gpaEnd":3.7},"D":{"minimum":50,"gpaStart":4.99,"gpaEnd":4},"F":{"minimum":0,"gpaStart":5,"gpaEnd":5}}'::jsonb
    CHECK (jsonb_typeof(grade_cutoffs) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id)
);

CREATE OR REPLACE FUNCTION public.validate_course_grade_item_weight()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_weight numeric;
BEGIN
  PERFORM 1
    FROM public.courses
    WHERE id = NEW.course_id AND user_id = NEW.user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found for this user';
  END IF;

  SELECT COALESCE(sum(weight), 0)
    INTO existing_weight
    FROM public.course_grade_items
    WHERE course_id = NEW.course_id
      AND id IS DISTINCT FROM NEW.id;
  IF existing_weight + NEW.weight > 100 THEN
    RAISE EXCEPTION 'Course grade weights cannot add up to more than 100%%';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_course_grade_item_weight
  BEFORE INSERT OR UPDATE ON public.course_grade_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_course_grade_item_weight();
CREATE TRIGGER update_course_grade_items_updated_at
  BEFORE UPDATE ON public.course_grade_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_grade_settings TO authenticated;
GRANT ALL ON public.course_grade_settings TO service_role;
ALTER TABLE public.course_grade_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own course grade settings" ON public.course_grade_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = course_grade_settings.course_id
        AND courses.user_id = auth.uid()
    )
  );
CREATE TRIGGER update_course_grade_settings_updated_at
  BEFORE UPDATE ON public.course_grade_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.grade_inbox_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.grade_inbox_tokens TO authenticated;
GRANT ALL ON public.grade_inbox_tokens TO service_role;
ALTER TABLE public.grade_inbox_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own grade inbox token" ON public.grade_inbox_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.grade_inbox_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  check_count integer NOT NULL CHECK (check_count BETWEEN 1 AND 3)
);
ALTER TABLE public.grade_inbox_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.grade_inbox_usage TO service_role;

CREATE OR REPLACE FUNCTION public.consume_grade_inbox_check(p_user_id uuid)
RETURNS TABLE (allowed boolean, checks_used integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  current_start timestamptz;
BEGIN
  INSERT INTO public.grade_inbox_usage AS daily_usage (user_id, window_started_at, check_count)
  VALUES (p_user_id, now(), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = CASE
          WHEN daily_usage.window_started_at <= now() - interval '24 hours' THEN now()
          ELSE daily_usage.window_started_at
        END,
        check_count = CASE
          WHEN daily_usage.window_started_at <= now() - interval '24 hours' THEN 1
          ELSE daily_usage.check_count + 1
        END
    WHERE daily_usage.window_started_at <= now() - interval '24 hours'
       OR daily_usage.check_count < 3
  RETURNING grade_inbox_usage.check_count, grade_inbox_usage.window_started_at
    INTO current_count, current_start;

  IF FOUND THEN
    RETURN QUERY SELECT true, current_count, current_start + interval '24 hours';
    RETURN;
  END IF;

  SELECT daily_usage.check_count, daily_usage.window_started_at
    INTO current_count, current_start
    FROM public.grade_inbox_usage AS daily_usage
    WHERE daily_usage.user_id = p_user_id;
  RETURN QUERY SELECT false, current_count, current_start + interval '24 hours';
END;
$$;
REVOKE ALL ON FUNCTION public.consume_grade_inbox_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_grade_inbox_check(uuid) TO service_role;

CREATE TABLE public.grade_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  grade_item_id uuid REFERENCES public.course_grade_items(id) ON DELETE SET NULL,
  course_name text NOT NULL,
  course_code text,
  grade_title text NOT NULL,
  score numeric NOT NULL,
  max_score numeric NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX grade_notifications_unread_idx
  ON public.grade_notifications (user_id, received_at DESC)
  WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.grade_notifications TO authenticated;
GRANT ALL ON public.grade_notifications TO service_role;
ALTER TABLE public.grade_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own grade notifications" ON public.grade_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can dismiss own grade notifications" ON public.grade_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
