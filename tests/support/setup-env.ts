import { randomBytes } from "node:crypto";

import { TEST_DATABASE_URL } from "./test-env";

// Segredos gerados por execução: nenhum valor fixo de credencial no repositório.
const ephemeral = () => randomBytes(24).toString("hex");

Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: ephemeral(),
  CRON_SECRET: ephemeral(),
  UNSUBSCRIBE_SECRET: ephemeral(),
  EMAIL_TRANSPORT: "memory",
  RATE_LIMIT_DRIVER: "memory",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
});
