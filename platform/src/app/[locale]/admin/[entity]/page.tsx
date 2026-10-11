import { notFound } from "next/navigation";
import { entities } from "@/lib/admin/registry";
import { requireAdmin, listAdmin, adminLookups } from "@/lib/admin/service";
import { AdminPanel } from "@/components/platform/admin-panel";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { entity } = await params;
  if (!entities[entity]) notFound();
  const q = (await searchParams).q || "";
  const [data, lookups] = await Promise.all([
    listAdmin(entity, new URLSearchParams({ q })),
    adminLookups(),
  ]);
  return (
    <AdminPanel
      key={entity + q}
      entity={entity}
      initial={data}
      lookups={lookups}
      initialQuery={q}
    />
  );
}
