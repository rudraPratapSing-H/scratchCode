-- Enable trigram similarity support for fuzzy title search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speed up case-insensitive exact title lookups
CREATE INDEX IF NOT EXISTS "idx_problem_title_lower" ON "Problem" (lower("title"));

-- Speed up fuzzy similarity and typo search on title
CREATE INDEX IF NOT EXISTS "idx_problem_title_trgm" ON "Problem" USING gin (lower("title") gin_trgm_ops);
