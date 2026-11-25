import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { HUBS, findHub } from "@/domain/hubs";
import { AppHeader, ButtonLink, EmptyState } from "@/ui";

export function generateStaticParams() {
  return HUBS.map((h) => ({ slug: h.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: findHub(slug)?.title ?? "Không tìm thấy" };
}

export default async function HubComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = findHub(slug);
  if (!hub) notFound();

  return (
    <>
      <AppHeader back title={hub.title} />
      <EmptyState
        icon={Construction}
        title={`${hub.title} đang được xây dựng`}
        description={
          hub.currentHome
            ? `Module này hiện chạy riêng ở ${hub.currentHome} và sẽ được chuyển vào ứng dụng ở giai đoạn ${hub.phase}.`
            : `Module này sẽ có ở giai đoạn ${hub.phase} theo lộ trình SRS.`
        }
        action={
          <ButtonLink href="/home" variant="secondary" block>
            Về trang chủ
          </ButtonLink>
        }
      />
    </>
  );
}
