DROP POLICY IF EXISTS "settings public access" ON public.contest_settings;
DROP POLICY IF EXISTS "scores public access" ON public.scores;
DROP POLICY IF EXISTS "teams public access" ON public.teams;

CREATE POLICY "contest_settings public read" ON public.contest_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "scores public read" ON public.scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teams public read" ON public.teams FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.contest_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.scores FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.teams FROM anon, authenticated;

GRANT SELECT ON public.contest_settings TO anon, authenticated;
GRANT SELECT ON public.scores TO anon, authenticated;
GRANT SELECT ON public.teams TO anon, authenticated;

GRANT ALL ON public.contest_settings TO service_role;
GRANT ALL ON public.scores TO service_role;
GRANT ALL ON public.teams TO service_role;