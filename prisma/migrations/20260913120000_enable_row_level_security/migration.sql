-- Supabase serves the public schema through its Data API and grants the
-- anon/authenticated API roles access to tables there. The app never uses that
-- API: it connects as the tables' owner (locally) or as a BYPASSRLS role
-- (Supabase), and row-level security restricts neither. Enabling RLS with no
-- policies therefore closes every table to the API roles and leaves the app
-- unchanged. A migration that adds a table must enable RLS on it as well;
-- tests/rls.integration.cjs fails when one is missed.
ALTER TABLE "Answer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildSubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Test" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestReward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestSetItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Prisma's bookkeeping table lives in public too. The shadow database that
-- `prisma migrate dev` replays migrations into may not have it.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;
