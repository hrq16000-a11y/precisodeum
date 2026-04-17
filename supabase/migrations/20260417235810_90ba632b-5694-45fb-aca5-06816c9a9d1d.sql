UPDATE public.account_types SET price = 0, tier_key = 'free';
UPDATE public.account_types SET name = 'Cliente Free' WHERE name = 'Trial';
UPDATE public.account_types SET name = 'Profissional Free' WHERE name = 'Basic';
UPDATE public.account_types SET name = 'Profissional Plus' WHERE name = 'Premium';
UPDATE public.account_types SET name = 'Profissional Premium' WHERE name = 'Enterprise';
UPDATE public.account_types SET name = 'Agência / RH' WHERE name = 'Agencia de RH';