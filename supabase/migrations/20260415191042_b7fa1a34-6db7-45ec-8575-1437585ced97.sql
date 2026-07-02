
INSERT INTO public.score_rules (action_key, label, points, description, max_per_day, cooldown_hours, active, category)
VALUES ('referral_completed', 'Indicação concluída', 50, 'Ganhe pontos ao indicar um colega que se cadastra na plataforma', 5, 0, true, 'engagement')
ON CONFLICT DO NOTHING;
