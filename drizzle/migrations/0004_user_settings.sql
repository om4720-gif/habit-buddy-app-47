CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  agent_name text NOT NULL DEFAULT 'Mero',
  habit_page_name text NOT NULL DEFAULT 'Main habit',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
INSERT INTO public.user_settings (user_id, agent_name, habit_page_name)
SELECT id, 'Mero', 'German' FROM auth.users WHERE id = '62d9b2f2-9b60-4578-843e-cb5c75f88f82';