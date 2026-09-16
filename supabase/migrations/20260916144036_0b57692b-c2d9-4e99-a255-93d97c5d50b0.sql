ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lecture';
ALTER TABLE public.lectures ADD CONSTRAINT lectures_kind_check CHECK (kind IN ('lecture','tutorial'));