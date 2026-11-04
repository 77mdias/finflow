import { TEST_DATABASE_URL } from "./test-env";

Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  CRON_SECRET: "test-cron-secret-123456",
  UNSUBSCRIBE_SECRET: "test-unsubscribe-secret-123",
  EMAIL_TRANSPORT: "memory",
  RATE_LIMIT_DRIVER: "memory",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
});
