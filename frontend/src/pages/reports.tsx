import { useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  useGetPipelineReport,
  useGetSourceReport,
  useGetTimeseriesReport,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export function ReportsPage() {
  useEffect(() => {
    document.title = "Reports · Pulse";
  }, []);
  const pipeline = useGetPipelineReport();
  const sources = useGetSourceReport();
  const series = useGetTimeseriesReport({ days: 30 });

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="A 30-day view of your hiring funnel and where talent comes from."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-1">Pipeline funnel</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Conversion through each stage across all jobs.
          </p>
          <div className="h-72">
            {pipeline.isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer>
                <BarChart
                  data={pipeline.data?.stages ?? []}
                  layout="vertical"
                  margin={{ left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="stageName" type="category" width={90} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <ReTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-1">Sources</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Where your candidates come from.
          </p>
          <div className="h-72">
            {sources.isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sources.data ?? []}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(sources.data ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-1">Activity over time</h2>
        <p className="text-xs text-muted-foreground mb-4">
          New candidates and hires per day, last 30 days.
        </p>
        <div className="h-80">
          {series.isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer>
              <AreaChart data={series.data ?? []}>
                <defs>
                  <linearGradient id="cands" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="hires" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => d.slice(5)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="candidates"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#cands)"
                  name="Candidates"
                />
                <Area
                  type="monotone"
                  dataKey="hires"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  fill="url(#hires)"
                  name="Hires"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
