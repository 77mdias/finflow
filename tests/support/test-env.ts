/** URL do banco de testes (recriado a cada execução da suíte de integração). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://finflow:finflow@localhost:5432/finflow_test";
