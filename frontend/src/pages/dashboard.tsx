import { useEffect } from "react";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListTasks,
  useGetMe,
  useUpdateTask,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Briefcase,
  Users,
  CheckSquare,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
} from "recharts";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatRelative } from "@/lib/format";

export function DashboardPage() {
  useEffect(() => {
    document.title = "Dashboard · Pulse";
  }, []);

  const summary = useGetDashboardSummary();
  const activity = useGetRecentActivity();
  const me = useGetMe();
  const myTasks = useListTasks(
    { assignedTo: me.data?.id, status: "todo" },
    { query: { enabled: !!me.data } },
  );
  const qc = useQueryClient();
  const updateTask = useUpdateTask();

  const kpis = [
    {
      label: "Open jobs",
      value: summary.data?.openJobs ?? "—",
      icon: Briefcase,
      tint: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300",
    },
    {
      label: "Total candidates",
      value: summary.data?.totalCandidates ?? "—",
      icon: Users,
      tint: "text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300",
    },
    {
      label: "New this week",
      value: summary.data?.candidatesThisWeek ?? "—",
      icon: Sparkles,
      tint: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300",
    },
    {
      label: "Open tasks",
      value: summary.data?.openTasks ?? "—",
      icon: CheckSquare,
      tint: "text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-300",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back${me.data ? `, ${me.data.name.split(" ")[0]}` : ""}`}
        description="Here's how your hiring pipeline is moving today."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{k.label}</div>
                  <div className="text-3xl font-semibold mt-2 tabular-nums">
                    {summary.isLoading ? <Skeleton className="h-9 w-16" /> : k.value}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${k.tint}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Pipeline by stage</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active candidates grouped by stage across all jobs
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              {summary.data
                ? `${summary.data.hiredThisMonth} hired this month`
                : "—"}
            </div>
          </div>
          <div className="h-64">
            {summary.isLoading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.data?.pipelineByStage ?? []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="stageName"
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
                  <ReTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold mb-1">Avg time to hire</h2>
          <p className="text-xs text-muted-foreground">From applied to hired</p>
          <div className="mt-6 flex items-baseline gap-2">
            <div className="text-5xl font-semibold tabular-nums">
              {summary.data?.avgTimeToHireDays ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground">days</div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Hired this month</span>
              <span className="font-medium tabular-nums">
                {summary.data?.hiredThisMonth ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">New candidates</span>
              <span className="font-medium tabular-nums">
                {summary.data?.candidatesThisWeek ?? "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">My open tasks</h2>
            {/* <Link href="/tasks">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link> */}
          </div>
          {myTasks.isLoading && <Skeleton className="h-32 w-full" />}
          {myTasks.data && myTasks.data.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              coming soon
            </div>
          )}
          <ul className="divide-y divide-border -mx-2">
            {myTasks.data?.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 px-2 py-3 hover-elevate rounded-md"
              >
                <Checkbox
                  checked={t.status === "done"}
                  onCheckedChange={(v) =>
                    updateTask.mutate(
                      {
                        id: t.id,
                        data: { status: v ? "done" : "todo" },
                      },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
                          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                        },
                      },
                    )
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {t.candidateName && (
                    <div className="text-xs text-muted-foreground truncate">
                      Re: {t.candidateName}
                    </div>
                  )}
                </div>
                {t.dueDate && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    Due {formatRelative(t.dueDate)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Recent activity</h2>
          {activity.isLoading && <Skeleton className="h-40 w-full" />}
          {activity.data && activity.data.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nothing happening yet.
            </div>
          )}
          <ul className="space-y-3">
            {activity.data?.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.message}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
