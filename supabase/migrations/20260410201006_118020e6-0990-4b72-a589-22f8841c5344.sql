
CREATE OR REPLACE FUNCTION public.clean_city_input()
RETURNS TRIGGER AS $$
DECLARE
  words text[];
  result text;
  word text;
  i integer;
  lower_words text[] := ARRAY['de','do','da','dos','das','e'];
BEGIN
  IF NEW.city IS NOT NULL AND NEW.city != '' THEN
    words := string_to_array(TRIM(NEW.city), ' ');
    result := '';
    FOR i IN 1..array_length(words, 1) LOOP
      word := lower(words[i]);
      IF i = 1 OR NOT (word = ANY(lower_words)) THEN
        word := INITCAP(word);
      END IF;
      IF i > 1 THEN result := result || ' '; END IF;
      result := result || word;
    END LOOP;
    NEW.city := result;
  END IF;
  IF NEW.state IS NOT NULL AND NEW.state != '' THEN
    NEW.state := UPPER(TRIM(NEW.state));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
