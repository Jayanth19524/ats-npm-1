import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const QUESTION_TYPES = [
  { value: "text_short", label: "Single-line text" },
  { value: "text_digit", label: "Number" },
  { value: "text_long", label: "Paragraph" },
  { value: "single_select", label: "Multiple choice (pick one)" },
  { value: "multi_select", label: "Multi-select (pick many)" },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

export interface QuestionDraft {
  id?: number;
  label: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

interface ServerQuestion {
  id: number;
  label: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  position: number;
}

export const MAX_QUESTIONS = 15;

export function validateQuestions(questions: QuestionDraft[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.label.trim()) {
      return `Question ${i + 1} needs a label`;
    }
    if (
      (q.type === "single_select" || q.type === "multi_select") &&
      q.options.filter((o) => o.trim()).length === 0
    ) {
      return `Question ${i + 1} needs at least one option`;
    }
  }
  return null;
}

export function serializeQuestions(questions: QuestionDraft[]) {
  return questions.map((q) => ({
    label: q.label.trim(),
    type: q.type,
    required: q.required,
    options:
      q.type === "single_select" || q.type === "multi_select"
        ? q.options.map((o) => o.trim()).filter(Boolean)
        : undefined,
  }));
}

export function QuestionsBuilder({
  questions,
  onChange,
  emptyHint,
}: {
  questions: QuestionDraft[];
  onChange: (next: QuestionDraft[]) => void;
  emptyHint?: string;
}) {
  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) {
      toast.error(`You can have at most ${MAX_QUESTIONS} questions`);
      return;
    }
    onChange([
      ...questions,
      { label: "", type: "text_short", options: [], required: false },
    ]);
  };

  const updateAt = (idx: number, patch: Partial<QuestionDraft>) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...questions];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div className="space-y-3">
        {questions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {emptyHint ??
              "No custom questions yet. Candidates will only be asked for the basics (name, email, phone, resume)."}
          </p>
        )}
        {questions.map((q, idx) => (
          <QuestionRow
            key={q.id ?? `new-${idx}`}
            index={idx}
            question={q}
            canMoveUp={idx > 0}
            canMoveDown={idx < questions.length - 1}
            onChange={(patch) => updateAt(idx, patch)}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, 1)}
            onRemove={() => removeAt(idx)}
          />
        ))}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={addQuestion}
          disabled={questions.length >= MAX_QUESTIONS}
          className="gap-1"
        >
          <Plus className="w-4 h-4" /> Add question
        </Button>
      </div>
    </>
  );
}

export function ApplicationFormEditor({ jobId }: { jobId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/jobs/${jobId}/questions`);
        if (!r.ok) throw new Error("load failed");
        const rows: ServerQuestion[] = await r.json();
        if (!alive) return;
        setQuestions(
          rows.map((q) => ({
            id: q.id,
            label: q.label,
            type: q.type,
            options: q.options ?? [],
            required: q.required,
          })),
        );
      } catch {
        if (alive) toast.error("Could not load application form");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [jobId]);

  const save = async () => {
    const error = validateQuestions(questions);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/jobs/${jobId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: serializeQuestions(questions) }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        toast.error(body.error || "Could not save form");
        return;
      }
      toast.success("Application form saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="font-semibold">Application form</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Up to {MAX_QUESTIONS} questions shown to candidates on the careers
            page. Resume upload is included automatically.
          </p>
        </div>
        <Badge variant="secondary">
          {questions.length}/{MAX_QUESTIONS}
        </Badge>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-6">
          Loading questions…
        </div>
      ) : (
        <>
          <QuestionsBuilder questions={questions} onChange={setQuestions} />

          <div className="flex items-center justify-end mt-4 pt-4 border-t border-border">
            <Button type="button" onClick={save} disabled={saving} className="gap-1">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save form
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function QuestionRow({
  index,
  question,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  question: QuestionDraft;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const isSelect =
    question.type === "single_select" || question.type === "multi_select";

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-muted-foreground tabular-nums mt-2 w-6">
          {index + 1}.
        </span>
        <div className="flex-1 grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="space-y-1.5">
            <Label htmlFor={`q-label-${index}`} className="sr-only">
              Question
            </Label>
            <Input
              id={`q-label-${index}`}
              value={question.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Question text"
            />
          </div>
          <Select
            value={question.type}
            onValueChange={(v) =>
              onChange({
                type: v as QuestionType,
                options:
                  v === "single_select" || v === "multi_select"
                    ? question.options.length
                      ? question.options
                      : [""]
                    : [],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move up"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move down"
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove question"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {isSelect && (
        <OptionsEditor
          options={question.options}
          onChange={(options) => onChange({ options })}
        />
      )}

      <div className="flex items-center gap-2 pt-1">
        <Switch
          id={`q-required-${index}`}
          checked={question.required}
          onCheckedChange={(v) => onChange({ required: v })}
        />
        <Label
          htmlFor={`q-required-${index}`}
          className="text-xs text-muted-foreground"
        >
          Required
        </Label>
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2 pl-8">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Option ${i + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            disabled={options.length <= 1}
            aria-label="Remove option"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, ""])}
        className="gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add option
      </Button>
    </div>
  );
}
