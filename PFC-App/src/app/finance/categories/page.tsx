import { requireMember } from "@/platform/auth/session";
import { listCategories } from "@/modules/finance/server/queries";
import { AppHeader } from "@/ui";
import { CategoryManager } from "./CategoryManager";

export const metadata = { title: "Danh mục" };

/** FIN-08 Transaction Categories (mockup 24). */
export default async function CategoriesPage() {
  const me = await requireMember("/finance/categories");
  const categories = await listCategories(me.id);
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Danh mục" />
      <CategoryManager categories={categories} />
    </>
  );
}
