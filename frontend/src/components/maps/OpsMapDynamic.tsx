"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export const OpsMapDynamic = dynamic(() => import("./OpsMap").then((m) => m.OpsMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-panel border border-border bg-slate-50 text-sm text-muted">
      Loading map…
    </div>
  ),
});

export type OpsMapDynamicProps = ComponentProps<typeof OpsMapDynamic>;
