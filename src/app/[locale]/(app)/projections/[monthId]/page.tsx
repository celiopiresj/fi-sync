import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getProjectionDetail } from "../actions";
import { ProjectionDetailView } from "../_components/projection-detail-view";

type ProjectionDetailPageProps = {
  params: Promise<{ monthId: string }>;
};

export default async function ProjectionDetailPage({
  params,
}: ProjectionDetailPageProps) {
  const { monthId } = await params;
  const detail = await getProjectionDetail(monthId);

  // Same inline "not found" shape as invoices/[id]/page.tsx — a monthId
  // outside the computed horizon (MAX_MONTHS_AHEAD) or malformed.
  if (!detail) {
    const t = await getTranslations("scrn-projections");
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-semibold">{t("detail.notFound.title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("detail.notFound.description")}
        </p>
        <Button asChild size="sm">
          <Link href="/projections">{t("detail.notFound.button")}</Link>
        </Button>
      </div>
    );
  }

  return <ProjectionDetailView detail={detail} />;
}
