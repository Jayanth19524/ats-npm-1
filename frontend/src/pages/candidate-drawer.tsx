import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMoveCandidate, useListStages } from "@/api-client";
import {
  useGetCandidate,
  useListCandidateNotes,
  useCreateCandidateNote,
  useListTemplates,
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
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const move = useMoveCandidate();
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
                {candidate.data.rating != null && (
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < candidate.data!.rating!
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <DetailRow icon={Mail} label={candidate.data.email} />
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
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  onSent: () => void;
}) {
  const templates = useListTemplates({ query: { enabled: open } });
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending} className="gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-foreground/80">
      <Icon className="w-4 h-4 text-muted-foreground" />
      {label}
    </div>
  );
}
