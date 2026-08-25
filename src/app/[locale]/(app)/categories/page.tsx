import { setRequestLocale } from "next-intl/server";
import { CategoriesView } from "./_components/categories-view";
import { listCategories } from "./actions";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CategoriesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const categories = await listCategories();

  return <CategoriesView data={categories} />;
}
