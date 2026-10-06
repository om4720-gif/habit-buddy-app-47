DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['habits','habit_completions','courses','lectures','deadlines'] LOOP
    EXECUTE format('UPDATE public.%I SET user_id = %L WHERE user_id IS NULL', t, '62d9b2f2-9b60-4578-843e-cb5c75f88f82');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Allow all habits" ON public.habits;
DROP POLICY IF EXISTS "Allow all habit_completions" ON public.habit_completions;
DROP POLICY IF EXISTS "Allow all courses" ON public.courses;
DROP POLICY IF EXISTS "Allow all lectures" ON public.lectures;
DROP POLICY IF EXISTS "Allow all deadlines" ON public.deadlines;

CREATE TABLE public.claude_feed_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.claude_feed_tokens TO authenticated;
GRANT ALL ON public.claude_feed_tokens TO service_role;
ALTER TABLE public.claude_feed_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own feed token" ON public.claude_feed_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);