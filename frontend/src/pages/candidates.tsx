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
import {
  Plus,
  Star,
  Check,
  ChevronsUpDown,
  X,
  ArrowRight,
  Mail,
  Ban,
  Loader2,
  CheckSquare,
} from "lucide-react";
import {
  useListJobs,
  useListStages,
  useListCandidates,
  useMoveCandidate,
  useListTemplates,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { CandidateDrawer } from "./candidate-drawer";

type CandidateRow = ListCandidatesResponseItem & {
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

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
  const [showRejected, setShowRejected] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const visibleJobs = useMemo(() => {
    const all = jobs.data ?? [];
    if (showAllJobs) return all;
    const active = all.filter(
      (j) => j.status === "open" || j.status === "on_hold",
    );
    if (jobId && !active.some((j) => j.id === jobId)) {
      const sel = all.find((j) => j.id === jobId);
      if (sel) return [sel, ...active];
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

  // Reset selection whenever the visible job changes or bulk mode is toggled off
  useEffect(() => {
    setSelected(new Set());
  }, [jobId, showRejected]);

  useEffect(() => {
    if (!bulkMode) setSelected(new Set());
  }, [bulkMode]);

  const stages = useListStages(jobId ?? 0, {
    query: { enabled: !!jobId },
  });
  const candidatesQ = useListCandidates(
    { jobId: jobId ?? undefined, search: search || undefined },
    { query: { enabled: !!jobId } },
  );
  const templatesQ = useListTemplates();

  const allCandidates = (candidatesQ.data ?? []) as CandidateRow[];
  const activeCandidates = allCandidates.filter((c) => !c.rejectedAt);
  const rejectedCandidates = allCandidates.filter((c) => !!c.rejectedAt);

  const move = useMoveCandidate();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const refreshAll = () => {
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
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const cId = Number(e.active.id);
    const targetStageId = e.over ? Number(e.over.id) : null;
    if (!targetStageId) return;
    const cand = activeCandidates.find((c) => c.id === cId);
    if (!cand || cand.stageId === targetStageId) return;

    const previous = candidatesQ.data ?? [];
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
          refreshAll();
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

  const draggingCandidate = activeCandidates.find((c) => c.id === dragId);
  const selectedIds = Array.from(selected);

  // Track which "bucket" the current selection belongs to so we can keep
  // bulk actions scoped to a single stage (or to the rejected list).
  // null = nothing selected, "rejected" = rejected list, otherwise stageId.
  const selectionScope = useMemo<number | "rejected" | null>(() => {
    if (selected.size === 0) return null;
    const firstId = selected.values().next().value as number;
    const cand = allCandidates.find((c) => c.id === firstId);
    if (!cand) return null;
    return cand.rejectedAt ? "rejected" : cand.stageId;
  }, [selected, allCandidates]);

  const candidateScope = (c: CandidateRow): number | "rejected" =>
    c.rejectedAt ? "rejected" : c.stageId;

  const canSelectCandidate = (c: CandidateRow) =>
    selectionScope == null ||
    selected.has(c.id) ||
    selectionScope === candidateScope(c);

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  return (
    <PageContainer>
      <PageHeader
        title="Candidates"
        description="Drag cards between stages, or select multiple for bulk actions."
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

      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={bulkMode ? "default" : "outline"}
          onClick={() => setBulkMode((v) => !v)}
          className="gap-1.5"
        >
          <CheckSquare className="w-4 h-4" />
          {bulkMode ? "Done selecting" : "Select multiple"}
        </Button>
        {bulkMode && (
          <span className="text-xs text-muted-foreground">
            Tip: bulk move and reject only work within a single stage at a
            time.
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="show-rejected"
            checked={showRejected}
            onCheckedChange={setShowRejected}
          />
          <Label
            htmlFor="show-rejected"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Show rejected ({rejectedCandidates.length})
          </Label>
        </div>
      </div>

      {stages.isLoading || candidatesQ.isLoading ? (
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
                  cards={activeCandidates.filter(
                    (c) => c.stageId === stage.id,
                  )}
                  selected={selected}
                  bulkMode={bulkMode}
                  onToggle={toggleSelected}
                  onOpen={setOpenCandidateId}
                  canSelectCandidate={canSelectCandidate}
                />
              ))}
              {showRejected && (
                <RejectedColumn
                  cards={rejectedCandidates}
                  selected={selected}
                  bulkMode={bulkMode}
                  onToggle={toggleSelected}
                  onOpen={setOpenCandidateId}
                  canSelectCandidate={canSelectCandidate}
                />
              )}
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

      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        onMove={() => setMoveOpen(true)}
        onEmail={() => setEmailOpen(true)}
        onReject={() => {
          setRejectReason("");
          setConfirmReject(true);
        }}
      />

      <BulkMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        selectedCount={selected.size}
        stages={stages.data ?? []}
        templates={templatesQ.data ?? []}
        onSubmit={async ({ stageId, sendEmailTemplateId }) => {
          try {
            const res = await fetch("/api/candidates/bulk-move", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                candidateIds: selectedIds,
                stageId,
                sendEmailTemplateId: sendEmailTemplateId ?? null,
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              toast.error(body.error || "Bulk move failed");
              return;
            }
            const result = await res.json();
            toast.success(
              `Moved ${result.moved}${
                result.emailed ? ` · ${result.emailed} email${result.emailed === 1 ? "" : "s"} sent` : ""
              }`,
            );
            setMoveOpen(false);
            clearSelection();
            refreshAll();
          } catch {
            toast.error("Bulk move failed");
          }
        }}
      />

      <BulkEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        selectedCount={selected.size}
        templates={templatesQ.data ?? []}
        onSubmit={async (payload) => {
          try {
            const res = await fetch("/api/candidates/bulk-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                candidateIds: selectedIds,
                ...payload,
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              toast.error(body.error || "Bulk email failed");
              return;
            }
            const result = await res.json();
            toast.success(`Email sent to ${result.sent}`);
            setEmailOpen(false);
            clearSelection();
          } catch {
            toast.error("Bulk email failed");
          }
        }}
      />

      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reject {selected.size} candidate{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They'll be moved out of the active pipeline. You can reverse this
              from each candidate's profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Not enough experience for the role."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  const res = await fetch("/api/candidates/bulk-reject", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      candidateIds: selectedIds,
                      reason: rejectReason.trim() || undefined,
                    }),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    toast.error(body.error || "Reject failed");
                    return;
                  }
                  const result = await res.json();
                  toast.success(`Rejected ${result.rejected}`);
                  setConfirmReject(false);
                  clearSelection();
                  refreshAll();
                } catch {
                  toast.error("Reject failed");
                }
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

// Each kanban column is capped to the viewport so it scrolls internally
// instead of stretching the page when there are lots of candidates.
const COLUMN_BODY_CLASS =
  "flex-1 min-h-[200px] max-h-[calc(100vh-16rem)] overflow-y-auto rounded-lg p-2 space-y-2 transition-colors scrollbar-thin";

function KanbanColumn({
  stage,
  cards,
  selected,
  bulkMode,
  onToggle,
  onOpen,
  canSelectCandidate,
}: {
  stage: ListStagesResponseItem;
  cards: CandidateRow[];
  selected: Set<number>;
  bulkMode: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  canSelectCandidate: (c: CandidateRow) => boolean;
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
        className={cn(
          COLUMN_BODY_CLASS,
          isOver ? "bg-accent/60" : "bg-muted/40",
        )}
      >
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            Drop a candidate here
          </div>
        )}
        {cards.map((c) => (
          <DraggableCard
            key={c.id}
            candidate={c}
            selected={selected.has(c.id)}
            bulkMode={bulkMode}
            disableSelect={!canSelectCandidate(c)}
            onToggleSelect={() => onToggle(c.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function RejectedColumn({
  cards,
  selected,
  bulkMode,
  onToggle,
  onOpen,
  canSelectCandidate,
}: {
  cards: CandidateRow[];
  selected: Set<number>;
  bulkMode: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  canSelectCandidate: (c: CandidateRow) => boolean;
}) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <h3 className="text-sm font-medium">Rejected</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {cards.length}
          </span>
        </div>
      </div>
      <div
        className={cn(
          COLUMN_BODY_CLASS,
          "bg-destructive/5 border border-dashed border-destructive/20",
        )}
      >
        {cards.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            No rejected candidates
          </div>
        )}
        {cards.map((c) => (
          <div
            key={c.id}
            role="button"
            onClick={() => onOpen(c.id)}
            className="opacity-80"
          >
            <CandidateCard
              candidate={c}
              selected={selected.has(c.id)}
              rejected
              {...(bulkMode
                ? {
                    onToggleSelect: (v) => {
                      if (!canSelectCandidate(c) && v) return;
                      onToggle(c.id);
                    },
                    selectDisabled: !canSelectCandidate(c),
                  }
                : {})}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  candidate,
  selected,
  bulkMode,
  disableSelect,
  onToggleSelect,
  onOpen,
}: {
  candidate: CandidateRow;
  selected: boolean;
  bulkMode: boolean;
  disableSelect: boolean;
  onToggleSelect: () => void;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidate.id,
  });
  return (
    <div
      ref={setNodeRef}
      className={`relative ${isDragging ? "opacity-30" : ""}`}
    >
      <CandidateCard
        candidate={candidate}
        selected={selected}
        {...(bulkMode
          ? {
              onToggleSelect: (v: boolean) => {
                if (disableSelect && v) return;
                if (v !== selected) onToggleSelect();
              },
              selectDisabled: disableSelect,
            }
          : {})}
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={() => onOpen(candidate.id)}
      />
    </div>
  );
}

function CandidateCard({
  candidate,
  dragging,
  selected,
  rejected,
  onToggleSelect,
  selectDisabled,
  dragHandleProps,
  onClick,
}: {
  candidate: CandidateRow;
  dragging?: boolean;
  selected?: boolean;
  rejected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
  selectDisabled?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "p-3 transition-shadow",
        dragging ? "shadow-lg rotate-2" : "hover-elevate",
        selected && "ring-2 ring-primary",
        rejected && "border-dashed",
      )}
    >
      <div className="flex items-start gap-2">
        {onToggleSelect && (
          <div
            className="pt-0.5"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={
              selectDisabled
                ? "Bulk actions are limited to one stage at a time"
                : undefined
            }
          >
            <Checkbox
              checked={!!selected}
              disabled={!!selectDisabled && !selected}
              onCheckedChange={(v) => onToggleSelect(!!v)}
              aria-label="Select candidate"
            />
          </div>
        )}
        <div
          className={cn(
            "flex items-start gap-3 flex-1 min-w-0",
            !dragging && "cursor-grab active:cursor-grabbing",
          )}
          {...(dragHandleProps ?? {})}
          onClick={onClick}
        >
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
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {rejected ? "Rejected" : candidate.source}
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

function BulkActionBar({
  count,
  onClear,
  onMove,
  onEmail,
  onReject,
}: {
  count: number;
  onClear: () => void;
  onMove: () => void;
  onEmail: () => void;
  onReject: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 bg-foreground text-background rounded-full pl-4 pr-2 py-2 shadow-lg">
        <span className="text-sm font-medium tabular-nums">
          {count} selected
        </span>
        <div className="w-px h-5 bg-background/20 mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={onMove}
          className="text-background hover:text-background hover:bg-background/15 gap-1.5"
        >
          <ArrowRight className="w-4 h-4" /> Move
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEmail}
          className="text-background hover:text-background hover:bg-background/15 gap-1.5"
        >
          <Mail className="w-4 h-4" /> Email
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          className="text-background hover:text-background hover:bg-background/15 gap-1.5"
        >
          <Ban className="w-4 h-4" /> Reject
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClear}
          className="text-background hover:text-background hover:bg-background/15 rounded-full"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface TemplateRow {
  id: number;
  name: string;
}

function BulkMoveDialog({
  open,
  onOpenChange,
  selectedCount,
  stages,
  templates,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  stages: ListStagesResponseItem[];
  templates: TemplateRow[];
  onSubmit: (args: {
    stageId: number;
    sendEmailTemplateId: number | null;
  }) => Promise<void>;
}) {
  const [stageId, setStageId] = useState<number | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setStageId(null);
      setEmailEnabled(false);
      setTemplateId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {selectedCount} candidate{selectedCount === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Pick a destination stage. Optionally send an email at the same
            time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Move to stage</Label>
            <Select
              value={stageId != null ? String(stageId) : undefined}
              onValueChange={(v) => setStageId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <Switch
              id="bulk-move-email"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
            <Label htmlFor="bulk-move-email" className="cursor-pointer">
              Also send an email
            </Label>
          </div>
          {emailEnabled && (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={templateId != null ? String(templateId) : undefined}
                onValueChange={(v) => setTemplateId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No templates yet — create one in Settings.
                    </div>
                  )}
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              stageId == null ||
              (emailEnabled && templateId == null)
            }
            onClick={async () => {
              if (stageId == null) return;
              setBusy(true);
              try {
                await onSubmit({
                  stageId,
                  sendEmailTemplateId: emailEnabled ? templateId : null,
                });
              } finally {
                setBusy(false);
              }
            }}
            className="gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {emailEnabled ? "Move & email" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEmailDialog({
  open,
  onOpenChange,
  selectedCount,
  templates,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  templates: TemplateRow[];
  onSubmit: (
    payload:
      | { templateId: number }
      | { subject: string; body: string },
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("template");
      setTemplateId(null);
      setSubject("");
      setBody("");
    }
  }, [open]);

  const canSubmit =
    mode === "template"
      ? templateId != null
      : subject.trim().length > 0 && body.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Email {selectedCount} candidate{selectedCount === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Use a saved template or write a one-off message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "template" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("template")}
            >
              Template
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("custom")}
            >
              Custom
            </Button>
          </div>
          {mode === "template" ? (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={templateId != null ? String(templateId) : undefined}
                onValueChange={(v) => setTemplateId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No templates yet — create one in Settings.
                    </div>
                  )}
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{{candidate_name}}"}, {"{{job_title}}"},{" "}
                  {"{{stage_name}}"}, {"{{sender_name}}"}.
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !canSubmit}
            onClick={async () => {
              setBusy(true);
              try {
                if (mode === "template" && templateId != null) {
                  await onSubmit({ templateId });
                } else if (mode === "custom") {
                  await onSubmit({
                    subject: subject.trim(),
                    body: body.trim(),
                  });
                }
              } finally {
                setBusy(false);
              }
            }}
            className="gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
