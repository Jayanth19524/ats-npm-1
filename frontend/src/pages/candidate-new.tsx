import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListJobs,
  useCreateCandidate,
  getListCandidatesQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
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
import { ResumeUploader, type ResumeUploadResult } from "@/components/ResumeUploader";

const schema = z.object({
  jobId: z.coerce.number(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentTitle: z.string().optional(),
  resumeUrl: z
    .string()
    .refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/uploads/") || v.startsWith("/api/uploads/"), {
      message: "Must be a URL or uploaded file",
    })
    .optional(),
  resumeKey: z.string().optional(),
  resumeFilename: z.string().optional(),
  resumeMimeType: z.string().optional(),
  resumeSize: z.number().optional(),
  source: z.string().default("direct"),
});

type CandidateFormValues = z.infer<typeof schema>;

export function CandidateNewPage() {
  useEffect(() => {
    document.title = "Add candidate · Pulse";
  }, []);
  const jobs = useListJobs();
  const create = useCreateCandidate();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: "direct" },
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="gap-2 mb-4 -ml-3" onClick={() => navigate("/candidates")}>
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>
      <PageHeader title="Add a candidate" description="They'll start in the first stage of the selected job." />
      <Card className="p-8 max-w-2xl">
        <form
          onSubmit={form.handleSubmit((v) => {
            create.mutate(
              {
                data: {
                  jobId: Number(v.jobId),
                  name: v.name,
                  email: v.email,
                  phone: v.phone || undefined,
                  location: v.location || undefined,
                  currentTitle: v.currentTitle || undefined,
                  resumeUrl: v.resumeUrl || undefined,
                  resumeKey: v.resumeKey || undefined,
                  resumeFilename: v.resumeFilename || undefined,
                  resumeMimeType: v.resumeMimeType || undefined,
                  resumeSize: v.resumeSize,
                  source: v.source,
                },
              },
              {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListCandidatesQueryKey() });
                  toast.success("Candidate added");
                  navigate(`/candidates?jobId=${v.jobId}`);
                },
                onError: () => toast.error("Could not add candidate"),
              },
            );
          })}
          className="space-y-5"
        >
          <Field label="Job" error={form.formState.errors.jobId?.message}>
            <Select
              value={form.watch("jobId") ? String(form.watch("jobId")) : ""}
              onValueChange={(v) => form.setValue("jobId", Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.data?.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Phone">
              <Input {...form.register("phone")} />
            </Field>
            <Field label="Location">
              <Input {...form.register("location")} />
            </Field>
            <Field label="Current title">
              <Input {...form.register("currentTitle")} />
            </Field>
            <Field label="Source">
              <Select
                value={form.watch("source") ?? "direct"}
                onValueChange={(v) => form.setValue("source", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Resume">
            <ResumeUploader
              value={form.watch("resumeUrl") ?? ""}
              onChange={(url, upload) => {
                form.setValue("resumeUrl", url);
                applyResumeUpload(form.setValue, upload);
              }}
            />
          </Field>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add candidate"}
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}

function applyResumeUpload(
  setValue: UseFormSetValue<CandidateFormValues>,
  upload?: ResumeUploadResult | null,
) {
  setValue("resumeKey", upload?.key ?? undefined);
  setValue("resumeFilename", upload?.filename ?? undefined);
  setValue("resumeMimeType", upload?.mimeType ?? undefined);
  setValue("resumeSize", upload?.size ?? undefined);
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
