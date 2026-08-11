UPDATE public.scores
SET fajr_count = GREATEST(fajr_count - 1, 0),
    score = GREATEST(score - 5, 0)
WHERE date = CURRENT_DATE
  AND team_id = (SELECT id FROM public.teams WHERE is_active ORDER BY created_at LIMIT 1);