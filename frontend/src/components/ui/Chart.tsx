"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

// Format: { [k in string]: { label?: React.ReactNode; icon?: React.ComponentType; color?: string; theme?: Record<string, string> } }
export type ChartConfig = Record<
  string,
  {
    label?: ReactNode;
    icon?: ComponentType;
    color?: string;
    theme?: Record<string, string>;
  }
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

export function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

export const ChartContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    config: ChartConfig;
    children: ComponentProps<typeof ResponsiveContainer>["children"];
  }
>(function ChartContainer({ id, className, children, config, ...props }, ref) {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/20 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, itemConfig]) => itemConfig.theme || itemConfig.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .map(([key, itemConfig]) => {
            const color = itemConfig.color;
            return color ? `[data-chart=${id}] { --color-${key}: ${color}; }` : "";
          })
          .join("\n"),
      }}
    />
  );
};

export const ChartTooltip = Tooltip;

export const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    active?: boolean;
    payload?: Array<{
      name?: string;
      value?: number | string;
      dataKey?: string;
      payload?: Record<string, unknown>;
      color?: string;
    }>;
    label?: string;
    hideLabel?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
  }
>(function ChartTooltipContent(
  {
    active,
    payload,
    className,
    indicator = "dot",
    hideLabel = false,
    label,
    nameKey,
  },
  ref,
) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-panel border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md",
        className,
      )}
    >
      {!hideLabel && label ? (
        <div className="font-semibold text-slate-800">{label}</div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.dataKey || item.name || "value"}`;
          const itemConfig = config[key] || config[item.name as string];
          const indicatorColor = item.color || itemConfig?.color || "#1e3a8a";

          return (
            <div
              key={index}
              className="flex w-full items-center justify-between gap-2 text-slate-700"
            >
              <div className="flex items-center gap-1.5">
                {indicator === "dot" ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: indicatorColor }}
                  />
                ) : (
                  <span
                    className="h-1 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: indicatorColor }}
                  />
                )}
                <span className="text-muted capitalize">
                  {itemConfig?.label || item.name || key}
                </span>
              </div>
              <span className="font-mono font-medium tabular-nums text-slate-900">
                {item.value?.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
