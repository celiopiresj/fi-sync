"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { categorySchema, type CategoryFormValues } from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Fetch all categories for the user (including system-seeded ones where userId is null)
export async function listCategories() {
  const userId = await requireUserId();

  return prisma.category.findMany({
    where: {
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { name: "asc" },
  });
}

async function validateCategory(data: CategoryFormValues) {
  return categorySchema.safeParse(data);
}

export async function createCategory(data: CategoryFormValues) {
  const userId = await requireUserId();
  const result = await validateCategory(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  await prisma.category.create({
    data: {
      userId,
      name: value.name,
      type: value.type,
      colorStyle: value.colorStyle || null,
      icon: value.icon || null,
    },
  });

  revalidatePath("/categories");
  return { error: null };
}

export async function updateCategory(id: string, data: CategoryFormValues) {
  const userId = await requireUserId();
  const result = await validateCategory(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  // We can only edit categories that belong to the user (userId is not null)
  const existing = await prisma.category.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found or not owned by user" };
  }

  await prisma.category.update({
    where: { id },
    data: {
      name: value.name,
      type: value.type,
      colorStyle: value.colorStyle || null,
      icon: value.icon || null,
    },
  });

  revalidatePath("/categories");
  return { error: null };
}

export async function deleteCategory(id: string) {
  const userId = await requireUserId();

  // We can only delete categories that belong to the user
  await prisma.category.deleteMany({ where: { id, userId } });

  revalidatePath("/categories");
  return { error: null };
}
