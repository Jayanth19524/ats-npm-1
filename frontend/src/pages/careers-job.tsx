import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { MapPin, Briefcase, ArrowLeft, Building2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ResumeUploader,
  type ResumeUploadResult,
} from "@/components/ResumeUploader";
import { formatEmploymentType } from "@/lib/utils";

interface PublicJob {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  requiredSkills?: string[] | null;
  minExperience?: number | null;
  organizationName?: string | null;
  organizationSlug?: string | null;
}

type QuestionType =
  | "text_short"
  | "text_long"
  | "text_digit"
  | "single_select"
  | "multi_select";

interface PublicQuestion {
  id: number;
  label: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  position: number;
}

interface CaptchaChallenge {
  token: string;
  question: string;
}

export function CareersJobPage() {
  const [, slugRoute] = useRoute("/careers/:slug/jobs/:id");
  const [, legacy] = useRoute("/careers/jobs/:id");
  const slug = slugRoute?.slug;
  const id = slugRoute?.id ?? legacy?.id;
  const careersHref = slug ? `/careers/${slug}` : "/careers";
  const applyUrl = slug
    ? `/api/public/agencies/${slug}/jobs/${id}/apply`
    : `/api/public/jobs/${id}/apply`;
  const fetchUrl = slug
    ? `/api/public/agencies/${slug}/jobs/${id}`
    : `/api/public/jobs/${id}`;
  const questionsUrl = slug
    ? `/api/public/agencies/${slug}/jobs/${id}/questions`
    : null;

  const [job, setJob] = useState<PublicJob | null | "missing">(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeUpload, setResumeUpload] = useState<ResumeUploadResult | null>(
    null,
  );
  const [coverLetter, setCoverLetter] = useState("");
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const res = await fetch(fetchUrl);
      if (res.status === 404) setJob("missing");
      else if (res.ok) setJob(await res.json());
      else setJob("missing");
    })();
  }, [id, fetchUrl]);

  useEffect(() => {
    if (!questionsUrl) return;
    void (async () => {
      const res = await fetch(questionsUrl);
      if (res.ok) {
        const rows: PublicQuestion[] = await res.json();
        setQuestions(rows);
      }
    })();
  }, [questionsUrl]);

  const refreshCaptcha = async () => {
    setCaptchaAnswer("");
    const res = await fetch("/api/public/captcha");
    if (res.ok) setCaptcha(await res.json());
  };

  useEffect(() => {
    void refreshCaptcha();
  }, []);

  const setAnswerSingle = (qid: number, value: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: value }));

  const toggleAnswerMulti = (qid: number, value: string) =>
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? (prev[qid] as string[]) : [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...prev, [qid]: next };
    });

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    if (!resumeUrl) {
      toast.error("Please upload a resume or paste a link");
      return;
    }
    if (!captcha || !captchaAnswer.trim()) {
      toast.error("Please solve the verification challenge");
      return;
    }
    // Validate required questions
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        toast.error(`Please answer: ${q.label}`);
        return;
      }
      if (q.type === "text_digit" && typeof v === "string" && v.trim()) {
        if (!/^-?\d+(\.\d+)?$/.test(v.trim())) {
          toast.error(`"${q.label}" must be a number`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(applyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          currentTitle: currentTitle.trim() || undefined,
          resumeUrl,
          resumeKey: resumeUpload?.key,
          resumeFilename: resumeUpload?.filename,
          resumeMimeType: resumeUpload?.mimeType,
          resumeSize: resumeUpload?.size,
          coverLetter: coverLetter.trim() || undefined,
          captchaToken: captcha.token,
          captchaAnswer: captchaAnswer.trim(),
          answers: questions.map((q) => ({
            questionId: q.id,
            value: answers[q.id] ?? (q.type === "multi_select" ? [] : ""),
          })),
        }),
      });
      if (res.status === 409) {
        toast.error("You have already applied to this role");
        return;
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "captcha_invalid" || body.error === "captcha_expired") {
          toast.error("Verification failed. Please try again.");
          await refreshCaptcha();
          return;
        }
        toast.error(body.error || "Could not submit application");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Could not submit application");
        return;
      }
      toast.success("Application submitted");
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (job === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (job === "missing") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            This role is no longer open.{" "}
            <Link
              href={careersHref}
              className="text-primary hover:underline"
            >
              Back to all roles
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <Link
        href={careersHref}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to all roles
      </Link>
      {job.organizationName && (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 bg-muted/60 px-3 py-1 rounded-full">
          <Building2 className="w-3.5 h-3.5" /> {job.organizationName}
        </div>
      )}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
        {job.title}
      </h1>
      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
        {job.department && (
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            {job.department}
          </span>
        )}
        {job.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {job.location}
          </span>
        )}
        {job.employmentType && (
          <Badge variant="secondary">
            {formatEmploymentType(job.employmentType)}
          </Badge>
        )}
        {typeof job.minExperience === "number" && job.minExperience > 0 && (
          <Badge variant="secondary">
            {job.minExperience}+{" "}
            {job.minExperience === 1 ? "year" : "years"} experience
          </Badge>
        )}
      </div>
      {job.requiredSkills && job.requiredSkills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.requiredSkills.map((skill) => (
            <Badge key={skill} variant="outline">
              {skill}
            </Badge>
          ))}
        </div>
      )}
      {job.description && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none mt-6 text-foreground/90"
          dangerouslySetInnerHTML={{ __html: job.description }}
        />
      )}
      <div className="mt-8">
        <Card>
          <CardContent className="py-6">
            {done ? (
              <div className="text-center py-4">
                <h3 className="font-semibold">Thanks for applying</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your application has been received. The hiring team will be
                  in touch by email.
                </p>
              </div>
            ) : (
              <form onSubmit={apply} className="space-y-5">
                <h3 className="font-semibold">Apply for this role</h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Current title (optional)</Label>
                    <Input
                      id="title"
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      placeholder="Senior Software Engineer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Resume <span className="text-destructive">*</span>
                  </Label>
                  <ResumeUploader
                    value={resumeUrl}
                    onChange={(url, upload) => {
                      setResumeUrl(url);
                      setResumeUpload(upload ?? null);
                    }}
                  />
                </div>

                {questions.length > 0 && (
                  <div className="space-y-4 border-t border-border pt-4">
                    {questions.map((q) => (
                      <QuestionField
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        onSingle={(v) => setAnswerSingle(q.id, v)}
                        onToggleMulti={(v) => toggleAnswerMulti(q.id, v)}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="cover">Cover note (optional)</Label>
                  <Textarea
                    id="cover"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={4}
                    placeholder="A few sentences about why this role is exciting to you."
                  />
                </div>

                <div className="space-y-1.5 border-t border-border pt-4">
                  <Label htmlFor="captcha">
                    Verification <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2 rounded-md bg-muted text-sm font-mono">
                      {captcha ? captcha.question : "…"}
                    </div>
                    <Input
                      id="captcha"
                      inputMode="numeric"
                      className="w-28"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Answer"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={refreshCaptcha}
                      aria-label="New question"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Confirms you're a human, not a bot.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? "Submitting..." : "Submit application"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onSingle,
  onToggleMulti,
}: {
  question: PublicQuestion;
  value: string | string[] | undefined;
  onSingle: (v: string) => void;
  onToggleMulti: (v: string) => void;
}) {
  const labelEl = (
    <Label>
      {question.label}
      {question.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  if (question.type === "text_long") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSingle(e.target.value)}
          rows={4}
        />
      </div>
    );
  }
  if (question.type === "text_digit") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Input
          inputMode="numeric"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSingle(e.target.value)}
        />
      </div>
    );
  }
  if (question.type === "text_short") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onSingle(e.target.value)}
        />
      </div>
    );
  }
  if (question.type === "single_select") {
    return (
      <div className="space-y-2">
        {labelEl}
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onSingle(v)}
        >
          {(question.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem id={`q-${question.id}-${opt}`} value={opt} />
              <Label
                htmlFor={`q-${question.id}-${opt}`}
                className="font-normal cursor-pointer"
              >
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }
  // multi_select
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-2">
      {labelEl}
      <div className="space-y-2">
        {(question.options ?? []).map((opt) => {
          const checked = arr.includes(opt);
          return (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`q-${question.id}-${opt}`}
                checked={checked}
                onCheckedChange={() => onToggleMulti(opt)}
              />
              <Label
                htmlFor={`q-${question.id}-${opt}`}
                className="font-normal cursor-pointer"
              >
                {opt}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
