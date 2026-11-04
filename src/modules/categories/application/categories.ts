import { z } from "zod";

import type { Category } from "@/generated/prisma/client";
import type { UseCaseContext } from "@/shared/application/context";
import { Id } from "@/shared/application/schemas";
import { AppError } from "@/shared/domain/errors";
import type { Db, Tx } from "@/shared/infrastructure/db";

export const OTHER_CATEGORY = "Outros";

/** RF-070: categorias criadas no onboarding. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; color: string; icon: string }> = [
  { name: "Streaming", color: "red", icon: "tv" },
  { name: "Música", color: "green", icon: "music" },
  { name: "Software & Apps", color: "blue", icon: "app-window" },
  { name: "Nuvem & Armazenamento", color: "sky", icon: "cloud" },
  { name: "IA", color: "violet", icon: "sparkles" },
  { name: "Jogos", color: "purple", icon: "gamepad-2" },
  { name: "Educação", color: "amber", icon: "graduation-cap" },
  { name: "Saúde & Academia", color: "emerald", icon: "heart-pulse" },
  { name: "Notícias", color: "slate", icon: "newspaper" },
  { name: "Compras", color: "pink", icon: "shopping-bag" },
  { name: "Alimentação", color: "orange", icon: "utensils" },
  { name: "Transporte", color: "cyan", icon: "car" },
  { name: "Casa", color: "lime", icon: "house" },
  { name: OTHER_CATEGORY, color: "gray", icon: "circle-ellipsis" },
];

export async function seedDefaultCategories(tx: Tx, userId: string): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, isSystem: c.name === OTHER_CATEGORY })),
    skipDuplicates: true,
  });
}

const Name = z.string().trim().min(1, "Informe um nome").max(40);
const Color = z.string().trim().min(1).max(20);
const Icon = z.string().trim().min(1).max(40);

export const CreateCategorySchema = z.object({ name: Name, color: Color, icon: Icon });
export const UpdateCategorySchema = z.object({
  id: Id,
  name: Name.optional(),
  color: Color.optional(),
  icon: Icon.optional(),
});
export const DeleteCategorySchema = z.object({ id: Id });

export interface CategoryDTO {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
}

export const toCategoryDTO = (c: Category): CategoryDTO => ({
  id: c.id,
  name: c.name,
  color: c.color,
  icon: c.icon,
  isSystem: c.isSystem,
});

async function assertUniqueName(tx: Tx, userId: string, name: string, exceptId?: string) {
  const clash = await tx.category.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash)
    throw AppError.validation("Já existe uma categoria com esse nome.", { name: ["Nome já utilizado"] });
}

export async function createCategory(ctx: UseCaseContext, input: z.infer<typeof CreateCategorySchema>) {
  await assertUniqueName(ctx.tx, ctx.user.id, input.name);
  return toCategoryDTO(await ctx.tx.category.create({ data: { ...input, userId: ctx.user.id } }));
}

export async function updateCategory(ctx: UseCaseContext, input: z.infer<typeof UpdateCategorySchema>) {
  const current = await ctx.tx.category.findFirst({ where: { id: input.id, userId: ctx.user.id } });
  if (!current) throw AppError.notFound("Categoria");
  if (input.name && current.isSystem)
    throw new AppError("CATEGORY_IS_SYSTEM", "Esta categoria não pode ser renomeada.");
  if (input.name) await assertUniqueName(ctx.tx, ctx.user.id, input.name, current.id);
  const { id, ...data } = input;
  return toCategoryDTO(await ctx.tx.category.update({ where: { id }, data }));
}

/** RF-071: ao excluir, assinaturas, despesas e cobranças passam para "Outros". */
export async function deleteCategory(ctx: UseCaseContext, input: z.infer<typeof DeleteCategorySchema>) {
  const current = await ctx.tx.category.findFirst({ where: { id: input.id, userId: ctx.user.id } });
  if (!current) throw AppError.notFound("Categoria");
  if (current.isSystem) throw new AppError("CATEGORY_IS_SYSTEM", "Esta categoria não pode ser excluída.");
  await seedDefaultCategories(ctx.tx, ctx.user.id); // garante "Outros"
  const other = await ctx.tx.category.findFirstOrThrow({ where: { userId: ctx.user.id, isSystem: true } });
  const where = { userId: ctx.user.id, categoryId: current.id };
  const [s, e, c] = await Promise.all([
    ctx.tx.subscription.updateMany({ where, data: { categoryId: other.id } }),
    ctx.tx.expense.updateMany({ where, data: { categoryId: other.id } }),
    ctx.tx.charge.updateMany({ where, data: { categoryId: other.id } }),
  ]);
  await ctx.tx.category.delete({ where: { id: current.id } });
  return { reassigned: s.count + e.count + c.count };
}

export async function listCategories(db: Db, userId: string): Promise<CategoryDTO[]> {
  const rows = await db.category.findMany({
    where: { userId },
    orderBy: [{ isSystem: "asc" }, { name: "asc" }],
  });
  return rows.map(toCategoryDTO);
}

/** Garante que a categoria pertence ao usuário (NOT_FOUND caso contrário). */
export async function assertOwnCategory(
  db: Db,
  userId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const found = await db.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } });
  if (!found) throw AppError.notFound("Categoria");
}
