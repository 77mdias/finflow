-- O Better Auth guarda JSON em `value` (state do OAuth do Google, e-mail + nome do magic link),
-- que passa de 255 caracteres. Ampliar para TEXT não reescreve a tabela nem perde dados.
ALTER TABLE "verifications" ALTER COLUMN "value" SET DATA TYPE TEXT;
