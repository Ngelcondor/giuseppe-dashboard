-- One-off data migration to reown placeholder user data to the real admin user.
--
-- Context: before the auth hardening of 2026-05-24, several routers used
-- hardcoded placeholder user_ids:
--   * habits_api.py:   00000000-0000-0000-0000-000000000001
--   * sleep.py:        686859db-326c-4a2a-847e-99042c35eafc
-- After the refactor, all endpoints filter by the authenticated user_id from
-- the JWT. Existing rows owned by the placeholder UUIDs become invisible
-- unless we reown them to the real admin user.
--
-- USAGE (run as the postgres user inside the gd-postgres container):
--   docker compose -f docker/docker-compose.prod.yml exec -T postgres \
--     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     -f /docker-entrypoint-initdb.d/2026-05-24-reown-user-data.sql
-- (or copy the file into the container first).
--
-- The script is idempotent: rerunning is a no-op once data is already migrated.
--
-- ⚠️  Stop the backend BEFORE running this:
--   docker compose -f docker/docker-compose.prod.yml stop backend
-- and restart it AFTER + after pulling the new code:
--   docker compose -f docker/docker-compose.prod.yml up -d backend

BEGIN;

-- Resolve the real admin user_id. Adjust the WHERE clause if your admin
-- username/email differs from the defaults.
DO $$
DECLARE
    admin_uuid uuid;
BEGIN
    SELECT id INTO admin_uuid
    FROM users
    WHERE username = 'giuseppe'
       OR email    = 'giuseppe.dianasr@hotmail.it'
    ORDER BY created_at ASC
    LIMIT 1;

    IF admin_uuid IS NULL THEN
        RAISE EXCEPTION 'No admin user found. Aborting migration.';
    END IF;

    RAISE NOTICE 'Reowning data to admin user_id %', admin_uuid;

    -- Habits & their logs
    UPDATE habits
       SET user_id = admin_uuid
     WHERE user_id = '00000000-0000-0000-0000-000000000001';

    UPDATE habit_logs
       SET user_id = admin_uuid
     WHERE user_id = '00000000-0000-0000-0000-000000000001';

    -- Sleep sessions (skip if 686859db is already the admin)
    UPDATE sleep_sessions
       SET user_id = admin_uuid
     WHERE user_id = '686859db-326c-4a2a-847e-99042c35eafc'
       AND admin_uuid <> '686859db-326c-4a2a-847e-99042c35eafc';

    -- Delete the placeholder system user (FK targets above are now reowned)
    DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001';

    RAISE NOTICE 'Migration complete.';
END $$;

COMMIT;
