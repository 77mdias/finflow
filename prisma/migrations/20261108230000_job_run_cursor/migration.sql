-- Cursor por execução de job: a seguinte retoma depois do último usuário concluído (regra 5 da auditoria).
-- Coluna nova e nula: não reescreve a tabela.
ALTER TABLE "job_runs" ADD COLUMN "cursor" UUID;
