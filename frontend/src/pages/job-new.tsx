import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateJob,
  useCreateStage,
  getListJobsQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  department: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().min(1),
  status: z.enum(["draft", "open"]),
  description: z.string().optional(),
  minExperience: z
    .union([
      z.coerce.number().int().min(0, "Must be 0 or greater").max(60),
      z.literal("").transform(() => undefined),
    ])
    .optional(),
  requiredSkills: z.array(z.string()).optional(),
});
type FormValues = z.infer<typeof schema>;

const STAGE_PRESETS = [
  { name: "Applied", color: "#94a3b8" },
  { name: "Screening", color: "#0ea5e9" },
  { name: "Interview", color: "#6366f1" },
  { name: "Offer", color: "#f59e0b" },
  { name: "Hired", color: "#10b981" },
];

export function JobNewPage() {
  useEffect(() => {
    document.title = "New job · Pulse";
  }, []);
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const qc = useQueryClient();
  const createJob = useCreateJob();
  const createStage = useCreateStage();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      department: "",
      location: "",
      employmentType: "full_time",
      status: "open",
      description: "",
      minExperience: undefined,
      requiredSkills: [],
    },
  });
  const [skillInput, setSkillInput] = useState("");
  const requiredSkills = form.watch("requiredSkills") ?? [];

  function addSkill() {
    const value = skillInput.trim();
    if (!value) return;
    const current = form.getValues("requiredSkills") ?? [];
    if (current.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillInput("");
      return;
    }
    form.setValue("requiredSkills", [...current, value], { shouldDirty: true });
    setSkillInput("");
  }
  function removeSkill(skill: string) {
    const current = form.getValues("requiredSkills") ?? [];
    form.setValue(
      "requiredSkills",
      current.filter((s) => s !== skill),
      { shouldDirty: true },
    );
  }

  const steps = ["Basics", "Details", "Review"];

  const onSubmit = async (values: FormValues) => {
    try {
      const job = await createJob.mutateAsync({
        data: {
          title: values.title,
          department: values.department ?? "",
          location: values.location ?? "",
          employmentType: values.employmentType,
          status: values.status,
          description: values.description ?? "",
        },
      });
      toast.success("Job created");

      // Navigate immediately
      navigate(`/jobs/${job.id}`);

      // Create stages in background
      Promise.all(
        STAGE_PRESETS.map((preset) =>
          createStage.mutateAsync({
            jobId: job.id,
            data: {
              name: preset.name,
              color: preset.color,
              sendEmail: false,
              createTask: false,
            },
          })
        )
      );

      qc.invalidateQueries();
    } catch (e) {
      toast.error("Could not create the job. Please try again.");
    }
  };

  const next = async () => {
    const valid = await form.trigger(
      step === 0 ? ["title"] : ["employmentType"],
    );
    if (valid) setStep(step + 1);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create a new job"
        description="Set up the role and we'll add a default 5-stage hiring pipeline."
      />
      <div className="grid grid-cols-12 gap-8">
        <aside className="col-span-12 md:col-span-3">
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                  i === step
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-primary/20 text-primary border border-primary"
                        : "bg-muted",
                  )}
                >
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {s}
              </li>
            ))}
          </ol>
        </aside>

        <Card className="col-span-12 md:col-span-9 p-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 0 && (
              <>
                <Field label="Job title" error={form.formState.errors.title?.message}>
                  <Input
                    placeholder="e.g. Senior Product Designer"
                    {...form.register("title")}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Department">
                    <Input placeholder="Design" {...form.register("department")} />
                  </Field>
                  <Field label="Location">
                    <Input placeholder="Remote" {...form.register("location")} />
                  </Field>
                </div>
                <Field
                  label="Minimum years of experience"
                  error={form.formState.errors.minExperience?.message as string | undefined}
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={60}
                    placeholder="e.g. 3"
                    {...form.register("minExperience")}
                  />
                </Field>
                <Field label="Required skills">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a skill and press Enter (e.g. React, Figma)"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addSkill();
                          } else if (
                            e.key === "Backspace" &&
                            skillInput === "" &&
                            requiredSkills.length > 0
                          ) {
                            removeSkill(requiredSkills[requiredSkills.length - 1]);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addSkill}>
                        Add
                      </Button>
                    </div>
                    {requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {requiredSkills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                            {skill}
                            <button
                              type="button"
                              aria-label={`Remove ${skill}`}
                              onClick={() => removeSkill(skill)}
                              className="rounded hover:bg-muted-foreground/20 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Employment type">
                  <Select
                    value={form.watch("employmentType")}
                    onValueChange={(v) => form.setValue("employmentType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full time</SelectItem>
                      <SelectItem value="part_time">Part time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select
                    value={form.watch("status")}
                    onValueChange={(v) => form.setValue("status", v as "draft" | "open")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (only your team can see it)</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Description">
                  <RichTextEditor
                    value={form.watch("description") ?? ""}
                    onChange={(html) =>
                      form.setValue("description", html, { shouldDirty: true })
                    }
                    placeholder="What does this role do? Who's the ideal candidate?"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This is shown to candidates on the public job page before they apply.
                  </p>
                </Field>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Review</h3>
                <Card className="p-5 bg-muted/30">
                  <Row label="Title" value={form.watch("title")} />
                  <Row label="Department" value={form.watch("department") || "—"} />
                  <Row label="Location" value={form.watch("location") || "—"} />
                  <Row label="Type" value={form.watch("employmentType")} />
                  <Row label="Status" value={form.watch("status")} />
                  <Row
                    label="Min experience"
                    value={
                      typeof form.watch("minExperience") === "number"
                        ? `${form.watch("minExperience")}+ years`
                        : "—"
                    }
                  />
                  <Row
                    label="Skills"
                    value={
                      requiredSkills.length > 0 ? requiredSkills.join(", ") : "—"
                    }
                  />
                </Card>
                <p className="text-sm text-muted-foreground">
                  We'll add a default pipeline: Applied → Screening → Interview → Offer → Hired.
                  You can customize automations on the job page.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (step === 0 ? navigate("/jobs") : setStep(step - 1))}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {step === 0 ? "Cancel" : "Back"}
              </Button>
              {step < 2 ? (
                <Button type="button" onClick={next} className="gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={createJob.isPending}
                  onClick={form.handleSubmit(onSubmit)}
                >
                  {createJob.isPending ? "Creating…" : "Create job"}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}