CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  total_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, date)
);

CREATE TABLE public.contest_settings (
  id integer PRIMARY KEY DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT contest_settings_single_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contest_settings TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.scores TO service_role;
GRANT ALL ON public.contest_settings TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams public access" ON public.teams FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "scores public access" ON public.scores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settings public access" ON public.contest_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.recalc_team_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t uuid;
BEGIN
  t := COALESCE(NEW.team_id, OLD.team_id);
  UPDATE public.teams
    SET total_score = COALESCE((SELECT SUM(score) FROM public.scores WHERE team_id = t), 0)
  WHERE id = t;
  RETURN NULL;
END;
$$;

CREATE TRIGGER scores_recalc_total
AFTER INSERT OR UPDATE OR DELETE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.recalc_team_total();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER scores_touch_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.teams (name) VALUES ('A Takımı'), ('B Takımı'), ('C Takımı'), ('D Takımı'), ('E Takımı');
INSERT INTO public.contest_settings (id, start_date) VALUES (1, CURRENT_DATE);

ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.scores REPLICA IDENTITY FULL;