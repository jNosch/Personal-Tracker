-- Runs once, only when the postgres container initializes an empty data
-- volume. Creates the dedicated integration-test database alongside the dev
-- one — see docs/engineering/testing.md for why it's a separate DB (never
-- the dev DB) and truncate-between-tests instead of transaction rollback.
CREATE DATABASE lifting_tracker_test;
