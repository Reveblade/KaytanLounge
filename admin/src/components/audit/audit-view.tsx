"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qs } from "@/lib/api";
import type { AuditLogDto, Paginated } from "@/lib/contract/api";
import { dateTime } from "@/lib/format";
import { EmptyState, Pager, PageHeader, SearchBox, Skeleton } from "@/components/ui/primitives";

const PAGE_SIZE = 50;

const RESOURCES = ["", "tour", "booking", "route", "attraction", "business", "vehicle", "guide", "admin", "role", "settings"];

/** Who changed what, and when. Read-only by design: an audit trail you can edit is not one. */
export function AuditView() {
  const [q, setQ] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", q, resourceType, page],
    queryFn: () => api<Paginated<AuditLogDto>>(`admin/audit${qs({ q: q || undefined, resourceType: resourceType || undefined, page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change made in the panel."
        actions={
          <>
            <select className="field max-w-[180px]" value={resourceType} onChange={(e) => { setResourceType(e.target.value); setPage(1); }}>
              {RESOURCES.map((r) => (
                <option key={r || "all"} value={r}>
                  {r || "Everything"}
                </option>
              ))}
            </select>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search" />
          </>
        }
      />

      {isLoading && !data ? (
        <Skeleton rows={12} />
      ) : error || !data ? (
        <EmptyState title="Audit log unavailable" body="The API did not answer." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing recorded" body="No entry matches these filters." />
      ) : (
        <div className="panel overflow-x-auto p-1.5">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>On</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="tnum whitespace-nowrap text-ink-muted">{dateTime(entry.createdAt)}</td>
                  <td className="whitespace-nowrap">{entry.actorName ?? <span className="text-ink-faint">system</span>}</td>
                  <td className="mono text-xs">{entry.action}</td>
                  <td className="text-ink-muted">
                    {entry.resourceType}
                    {entry.resourceId ? <span className="mono ml-1 text-[0.7rem] text-ink-faint">{entry.resourceId.slice(-6)}</span> : null}
                  </td>
                  <td className="max-w-[380px] truncate text-ink-muted">{entry.summary ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /> : null}
    </>
  );
}
