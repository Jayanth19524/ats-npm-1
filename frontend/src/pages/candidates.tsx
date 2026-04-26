import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Star, Check, ChevronsUpDown } from "lucide-react";
import {
  useListJobs,
  useListStages,
  useListCandidates,
  useMoveCandidate,
  type ListCandidatesResponseItem,
  type ListStagesResponseItem,
  getListCandidatesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetJobStatsQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { CandidateDrawer } from "./candidate-drawer";

export function CandidatesPage() {
  useEffect(() => {
    document.title = "Candidates · Pulse";
  }, []);
  const [location] = useLocation();
  const initialJobId = useMemo(() => {
    const sp = new URLSearchParams(location.split("?")[1] ?? "");
    const v = sp.get("jobId");
    return v ? Number(v) : null;
  }, [location]);

  const jobs = useListJobs();
  const [jobId, setJobId] = useState<number | null>(initialJobId);
  const [search, setSearch] = useState("");
  const [openCandidateId, setOpenCandidateId] = useState<number | null>(null);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  const visibleJobs = useMemo(() => {
    const all = jobs.data ?? [];
    if (showAllJobs) return all;
    const active = all.filter(
      (j) => j.status === "open" || j.status === "on_hold",
    );
    if (jobId && !active.some((j) => j.id === jobId)) {
      const selected = all.find((j) => j.id === jobId);
      if (selected) return [selected, ...active];
    }
    return active;
  }, [jobs.data, showAllJobs, jobId]);

  const selectedJob = useMemo(
    () => jobs.data?.find((j) => j.id === jobId) ?? null,
    [jobs.data, jobId],
  );

  useEffect(() => {
    if (jobId === null && visibleJobs.length > 0) {
      setJobId(visibleJobs[0].id);
    }
  }, [visibleJobs, jobId]);

  const stages = useListStages(jobId ?? 0, {
    query: { enabled: !!jobId },
  });
  const candidates = useListCandidates(
    { jobId: jobId ?? undefined, search: search || undefined },
    { query: { enabled: !!jobId } },
  );

  const move = useMoveCandidate();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const cId = Number(e.active.id);
    const targetStageId = e.over ? Number(e.over.id) : null;
    if (!targetStageId) return;
    const cand = candidates.data?.find((c) => c.id === cId);
    if (!cand || cand.stageId === targetStageId) return;

    const previous = candidates.data ?? [];
    qc.setQueryData(
      getListCandidatesQueryKey({
        jobId: jobId ?? undefined,
        search: search || undefined,
      }),
      previous.map((c) =>
        c.id === cId ? { ...c, stageId: targetStageId } : c,
      ),
    );

    move.mutate(
      { id: cId, data: { stageId: targetStageId } },
      {
        onSuccess: (data) => {
          if (data.automations.emailSent) toast.success("Welcome email queued");
          if (data.automations.taskCreated) toast.success("Task created");
          qc.invalidateQueries({
            queryKey: getListCandidatesQueryKey({
              jobId: jobId ?? undefined,
              search: search || undefined,
            }),
          });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          if (jobId)
            qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey(jobId) });
        },
        onError: () => {
          toast.error("Move failed");
          qc.setQueryData(
            getListCandidatesQueryKey({
              jobId: jobId ?? undefined,
              search: search || undefined,
            }),
            previous,
          );
        },
      },
    );
  };

  const draggingCandidate = candidates.data?.find((c) => c.id === dragId);

  return (
    <PageContainer>
      <PageHeader
        title="Candidates"
        description="Drag cards between stages to update the pipeline."
        actions={
          <>
            <Input
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Popover open={jobPickerOpen} onOpenChange={setJobPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={jobPickerOpen}
                  className="w-56 justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedJob ? selectedJob.title : "Select a job"}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search jobs…" />
                  <CommandList>
                    <CommandEmpty>No jobs found.</CommandEmpty>
                    <CommandGroup>
                      {visibleJobs.map((j) => (
                        <CommandItem
                          key={j.id}
                          value={`${j.title} ${j.department ?? ""}`}
                          onSelect={() => {
                            setJobId(j.id);
                            setJobPickerOpen(false);
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Check
                              className={cn(
                                "w-4 h-4 shrink-0",
                                jobId === j.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{j.title}</span>
                          </div>
                          {j.status !== "open" && (
                            <span className="text-xs text-muted-foreground capitalize shrink-0">
                              {j.status.replace("_", " ")}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                    <Label
                      htmlFor="show-all-jobs"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Show all jobs (incl. draft & closed)
                    </Label>
                    <Switch
                      id="show-all-jobs"
                      checked={showAllJobs}
                      onCheckedChange={setShowAllJobs}
                    />
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
            <Link href="/candidates/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add candidate
              </Button>
            </Link>
          </>
        }
      />

      {(stages.isLoading || candidates.isLoading) ? (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-96" />
    ))}
  </div>
) : (
  stages.data && (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragId(Number(e.active.id))}
      onDragCancel={() => setDragId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.data.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            cards={
              candidates.data?.filter((c) => c.stageId === stage.id) ?? []
            }
            onOpen={setOpenCandidateId}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingCandidate && (
          <CandidateCard candidate={draggingCandidate} dragging />
        )}
      </DragOverlay>
    </DndContext>
  )
)}
      <CandidateDrawer
        candidateId={openCandidateId}
        onClose={() => setOpenCandidateId(null)}
      />
    </PageContainer>
  );
}

function KanbanColumn({
  stage,
  cards,
  onOpen,
}: {
  stage: ListStagesResponseItem;
  cards: ListCandidatesResponseItem[];
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-medium">{stage.name}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {cards.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-lg p-2 space-y-2 transition-colors ${
          isOver ? "bg-accent/60" : "bg-muted/40"
        }`}
      >
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            Drop a candidate here
          </div>
        )}
        {cards.map((c) => (
          <DraggableCard key={c.id} candidate={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  candidate,
  onOpen,
}: {
  candidate: ListCandidatesResponseItem;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidate.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(candidate.id)}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <CandidateCard candidate={candidate} />
    </div>
  );
}

function CandidateCard({
  candidate,
  dragging,
}: {
  candidate: ListCandidatesResponseItem;
  dragging?: boolean;
}) {
  return (
    <Card
      className={`p-3 ${dragging ? "shadow-lg rotate-2" : "hover-elevate"}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {initials(candidate.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{candidate.name}</div>
          {candidate.currentTitle && (
            <div className="text-xs text-muted-foreground truncate">
              {candidate.currentTitle}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {candidate.source}
        </span>
        {candidate.score != null && (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < Math.round(candidate.score! / 20)
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground/30"
        }`}
      />
    ))}
  </div>
)}
      </div>
    </Card>
  );
}
