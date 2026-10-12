import { notFound } from "next/navigation";
import { entities } from "@/lib/admin/registry";
import { requireAdmin, listAdmin, adminLookups } from "@/lib/admin/service";
import { AdminPanel } from "@/components/platform/admin-panel";
import {parentFields, type AdminRow} from '@/lib/admin/forms';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { entity } = await params;
  if (!entities[entity]) notFound();
  const paramsQuery = await searchParams;
  const q = paramsQuery.q || '';
  const parent = paramsQuery[parentFields[entity]] || '';
  const query = new URLSearchParams({q});
  const language = paramsQuery.language === 'ar' || paramsQuery.language === 'en' ? paramsQuery.language : '';
  if (language) query.set('language', language);
  if (parent) query.set(parentFields[entity], parent);
  if (paramsQuery.edit) query.set('edit', paramsQuery.edit);
  const [data, lookups] = await Promise.all([
    listAdmin(entity, query),
    adminLookups(),
  ]);
  const rows = data.rows as AdminRow[];
  if (paramsQuery.edit && !rows.length) notFound();
  const initialRecord = paramsQuery.edit ? rows[0]
    : ['courses', 'categories', 'instructors', 'tags', 'faqs'].includes(entity)
      ? {key: `${entity}-${crypto.randomUUID().slice(0, 12)}`} : {};
  return (
    <AdminPanel
      key={entity + q + parent + language + (paramsQuery.edit || '') + (paramsQuery.create || '')}
      entity={entity}
      initial={data}
      lookups={lookups}
      initialQuery={q}
      initialLanguage={language}
      initialParent={parent}
      openEditor={Boolean(paramsQuery.edit || paramsQuery.create === '1')}
      initialRecord={initialRecord}
    />
  );
}
