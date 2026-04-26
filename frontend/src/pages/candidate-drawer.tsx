import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMoveCandidate, useListStages, useGetMe } from "@/api-client";
import {
  useGetCandidate,
  useGetJob,
  useListCandidateNotes,
  useCreateCandidateNote,
  useListTemplates,
  useUpdateCandidate,
  getGetCandidateQueryKey,
  getListCandidateNotesQueryKey,
} from "@/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { initials, formatRelative, SOURCE_LABELS } from "@/lib/format";
import { Mail, Phone, MapPin, Briefcase, Star, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { SelectValue } from "@radix-ui/react-select";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function CandidateDrawer({
  candidateId,
  onClose,
}: {
  candidateId: number | null;
  onClose: () => void;
}) {
  const open = candidateId !== null;
  const candidate = useGetCandidate(candidateId ?? 0, {
    query: { enabled: open },
  });
  const notes = useListCandidateNotes(candidateId ?? 0, {
    query: { enabled: open },
  });
  const createNote = useCreateCandidateNote();
  const updateCandidate = useUpdateCandidate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const move = useMoveCandidate();

  function setRating(value: number | null) {
    if (!candidate.data) return;
    const id = candidate.data.id;
    updateCandidate.mutate(
      { id, data: { rating: value } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCandidateQueryKey(id) });
          qc.invalidateQueries({ queryKey: ["/api/candidates"] });
          qc.invalidateQueries();
        },
        onError: () => toast.error("Couldn't update rating"),
      },
    );
  }
const stages = useListStages(candidate.data?.jobId ?? 0, {
  query: { enabled: !!candidate.data?.jobId },
});
const [showResume, setShowResume] = useState(false);
function moveCandidate(stageId: number) {
  if (!candidate.data) return;

  // 🚨 CRITICAL FIX
  if (stageId === candidate.data.stageId) {
    return; // do nothing
  }

  move.mutate(
    {
      id: candidate.data.id,
      data: { stageId },
    },
    {
      onSuccess: () => {
        qc.invalidateQueries();
      },
      onError: () => {
        toast.error("Move failed");
      },
    }
  );
}

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Candidate</SheetTitle>
        </SheetHeader>
        {candidate.isLoading && <Skeleton className="h-64 w-full mt-4" />}
        {candidate.data && (
          <div className="mt-6 space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                  {initials(candidate.data.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{candidate.data.name}</h3>
                {candidate.data.currentTitle && (
                  <p className="text-sm text-muted-foreground">
                    {candidate.data.currentTitle}
                  </p>
                )}
                <div
                  className="flex items-center gap-0.5 mt-1.5"
                  onMouseLeave={() => setHoverRating(null)}
                  role="radiogroup"
                  aria-label="Candidate rating"
                >
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const current = hoverRating ?? candidate.data!.rating ?? 0;
                    const filled = value <= current;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        onMouseEnter={() => setHoverRating(value)}
                        onClick={() =>
                          setRating(
                            candidate.data!.rating === value ? null : value,
                          )
                        }
                        disabled={updateCandidate.isPending}
                        className="p-0.5 rounded hover:scale-110 transition-transform focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            filled
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/40"
                          }`}
                        />
                      </button>
                    );
                  })}
                  {candidate.data.rating != null && (
                    <button
                      type="button"
                      onClick={() => setRating(null)}
                      disabled={updateCandidate.isPending}
                      className="ml-2 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <DetailRow
                icon={Mail}
                label={candidate.data.email}
                href={`mailto:${candidate.data.email}`}
              />
              {candidate.data.phone && (
                <DetailRow icon={Phone} label={candidate.data.phone} />
              )}
              {candidate.data.location && (
                <DetailRow icon={MapPin} label={candidate.data.location} />
              )}
              <DetailRow
                icon={Briefcase}
                label={`Source: ${SOURCE_LABELS[candidate.data.source] ?? candidate.data.source}`}
              />
              {candidate.data.resumeUrl && (
  <Button
    variant="outline"
    size="sm"
    className="gap-2"
    onClick={() => setShowResume((v) => !v)}
  >
    <FileText className="w-4 h-4" />
    {showResume ? "Hide resume" : "Preview resume"}
  </Button>
)}
{showResume && candidate.data.resumeUrl && (
  <div className="border rounded-md overflow-hidden h-[500px]">
    <iframe
      src={candidate.data.resumeUrl}
      className="w-full h-full"
      title="Resume Preview"
    />
  </div>
)}
            </div>

           <div className="flex gap-2 items-center">
  <Button size="sm" className="gap-2" onClick={() => setEmailOpen(true)}>
    <Send className="w-3.5 h-3.5" /> Send email
  </Button>

  {/* ✅ MOVE DROPDOWN */}
  <Select
  value={String(candidate.data.stageId)}
  onValueChange={(v) => moveCandidate(Number(v))}
>
  <SelectTrigger className="w-[160px] h-8 text-xs">
    <SelectValue placeholder="Move to stage" />
  </SelectTrigger>

  <SelectContent>
    {stages.data?.map((stage) => (
      <SelectItem key={stage.id} value={String(stage.id)}>
        <div className="flex items-center gap-2">
          {/* stage color dot like kanban */}
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          {stage.name}
          {stage.id === candidate.data.stageId}
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
</div>


            <div>
              <h4 className="font-medium text-sm mb-3">Notes</h4>
              <div className="space-y-3 mb-4">
                {notes.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No notes yet.</p>
                )}
                {notes.data?.map((n) => (
                  <div
                    key={n.id}
                    className="text-sm bg-muted/50 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {n.authorName}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap">
                      {n.body}
                    </p>
                  </div>
                ))}
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a note…"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  disabled={!body.trim() || createNote.isPending}
                  onClick={() =>
                    createNote.mutate(
                      { id: candidate.data!.id, data: { body } },
                      {
                        onSuccess: () => {
                          setBody("");
                          qc.invalidateQueries({
                            queryKey: getListCandidateNotesQueryKey(candidate.data!.id),
                          });
                        },
                      },
                    )
                  }
                >
                  Add note
                </Button>
              </div>
            </div>
          </div>
        )}
        {candidate.data && (
          <SendEmailDialog
            open={emailOpen}
            onOpenChange={setEmailOpen}
            candidateId={candidate.data.id}
            candidateName={candidate.data.name}
            candidateEmail={candidate.data.email}
            jobId={candidate.data.jobId}
            onSent={() =>
              qc.invalidateQueries({
                queryKey: getListCandidateNotesQueryKey(candidate.data!.id),
              })
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SendEmailDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobId: number;
  onSent: () => void;
}) {
  const templates = useListTemplates({ query: { enabled: open } });
  const me = useGetMe({ query: { enabled: open } });
  const job = useGetJob(jobId, { query: { enabled: open && !!jobId } });
  const jobTitle = job.data?.title ?? "";
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setTemplateId("");
      setSubject("");
      setBody("");
    }
  }, [open]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const tpl = templates.data?.find((t) => String(t.id) === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }

  function fillVars(text: string): string {
    const senderName = me.data?.name ?? "";
    return text
      .replace(/\{\{\s*candidate_name\s*\}\}/g, candidateName)
      .replace(/\{\{\s*job_title\s*\}\}/g, jobTitle)
      .replace(/\{\{\s*sender_name\s*\}\}/g, senderName);
  }

  function openInMailApp() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    const finalSubject = fillVars(subject);
    const finalBody = fillVars(body);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(candidateEmail)}&su=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalBody)}`;
    window.open(gmailUrl, "_blank");
    onOpenChange(false);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: templateId ? Number(templateId) : undefined,
          subject,
          body,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not send email");
        return;
      }
      if (data.delivered) {
        toast.success(`Email sent to ${candidateEmail}`);
      } else if (!data.emailConfigured) {
        toast.warning(
          "Email saved as a note. Configure SMTP_* secrets to actually send mail.",
        );
      } else {
        toast.error(`Delivery failed: ${data.reason || "unknown error"}`);
      }
      onSent();
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Email {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input value={candidateEmail} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>Template (optional)</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">— No template —</option>
              {templates.data?.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
            />
            <p className="text-xs text-muted-foreground">
              Variables {`{{candidate_name}}`}, {`{{job_title}}`}, {`{{sender_name}}`} are filled in automatically.
            </p>
          </div>
          {(subject.trim() || body.trim()) && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </div>
              <div className="text-sm">
                <div className="font-medium text-foreground">
                  {fillVars(subject) || (
                    <span className="text-muted-foreground italic">
                      (no subject)
                    </span>
                  )}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-foreground/80">
                  {fillVars(body) || (
                    <span className="text-muted-foreground italic">
                      (no message)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={send} disabled={sending} className="gap-2">
              <Send className="w-4 h-4" />
              {sending ? "Sending…" : "Send via server"}
            </Button>
            <Button onClick={openInMailApp} disabled={sending} className="gap-2">
              <Mail className="w-4 h-4" />
              Open in Gmail
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-foreground/80">
      <Icon className="w-4 h-4 text-muted-foreground" />
      {href ? (
        <a href={href} className="hover:underline">
          {label}
        </a>
      ) : (
        label
      )}
    </div>
  );
}