import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListTeam,
  type ListTasksResponseItem,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
] as const;

export function TasksPage() {
  useEffect(() => {
    document.title = "Tasks · Pulse";
  }, []);
  const tasks = useListTasks();
  const team = useListTeam();
  const [open, setOpen] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        description="What needs your attention to keep candidates moving."
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" /> New task
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COLUMNS.map((col) => {
          const items = tasks.data?.filter((t) => t.status === col.key) ?? [];
          return (
            <div key={col.key}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <Card className="p-6 text-center text-xs text-muted-foreground">
                    Nothing here.
                  </Card>
                )}
                {items.map((t) => (
                  <TaskItem key={t.id} task={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <NewTaskDialog open={open} onOpenChange={setOpen} team={team.data ?? []} />
    </PageContainer>
  );
}

function TaskItem({ task }: { task: ListTasksResponseItem }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  return (
    <Card className="p-4 group">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.status === "done"}
          onCheckedChange={(v) =>
            update.mutate(
              { id: task.id, data: { status: v ? "done" : "todo" } },
              { onSuccess: refresh },
            )
          }
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium ${
              task.status === "done" ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.candidateName && (
              <Badge variant="outline" className="text-[10px]">
                {task.candidateName}
              </Badge>
            )}
            {task.assigneeName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assigneeName}
              </span>
            )}
            {task.dueDate && (
              <span className="text-xs text-muted-foreground">
                Due {formatRelative(task.dueDate)}
              </span>
            )}
          </div>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() =>
            del.mutate(
              { id: task.id },
              {
                onSuccess: () => {
                  toast.success("Task deleted");
                  refresh();
                },
              },
            )
          }
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

function NewTaskDialog({
  open,
  onOpenChange,
  team,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team: NonNullable<ReturnType<typeof useListTeam>["data"]>;
}) {
  const form = useForm({
    defaultValues: { title: "", description: "", assignedTo: "" },
  });
  const create = useCreateTask();
  const qc = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => {
            create.mutate(
              {
                data: {
                  title: v.title,
                  description: v.description || undefined,
                  assignedTo: v.assignedTo ? Number(v.assignedTo) : undefined,
                },
              },
              {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                  toast.success("Task added");
                  onOpenChange(false);
                  form.reset();
                },
              },
            );
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input required {...form.register("title")} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} {...form.register("description")} />
          </div>
          <div className="space-y-1.5">
            <Label>Assignee</Label>
            <Select
              value={form.watch("assignedTo")}
              onValueChange={(v) => form.setValue("assignedTo", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a teammate" />
              </SelectTrigger>
              <SelectContent>
                {team.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
