import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useListReferrals,
  useCreateReferral,
  useListJobs,
  getListReferralsQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_COLORS, formatRelative } from "@/lib/format";

export function ReferralsPage() {
  useEffect(() => {
    document.title = "Referrals · Pulse";
  }, []);
  const jobs = useListJobs({ status: "open" });
  const referrals = useListReferrals();
  const create = useCreateReferral();
  const qc = useQueryClient();
  const form = useForm({
    defaultValues: {
      candidateName: "",
      candidateEmail: "",
      jobId: "",
      relationship: "",
      notes: "",
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Referrals"
        description="Refer someone you'd love to work with — we'll handle the rest."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="p-6 lg:col-span-2 h-fit">
          <h2 className="font-semibold mb-4">Refer a candidate</h2>
          <form
            onSubmit={form.handleSubmit((v) => {
              if (!v.jobId) {
                toast.error("Pick a job");
                return;
              }
              create.mutate(
                {
                  data: {
                    candidateName: v.candidateName,
                    candidateEmail: v.candidateEmail,
                    jobId: Number(v.jobId),
                    relationship: v.relationship || undefined,
                    notes: v.notes || undefined,
                  },
                },
                {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListReferralsQueryKey() });
                    toast.success("Referral submitted");
                    form.reset();
                  },
                },
              );
            })}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Their name</Label>
              <Input required {...form.register("candidateName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Their email</Label>
              <Input type="email" required {...form.register("candidateEmail")} />
            </div>
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select
                value={form.watch("jobId")}
                onValueChange={(v) => form.setValue("jobId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.data?.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>How do you know them?</Label>
              <Input
                placeholder="Former colleague, friend, etc."
                {...form.register("relationship")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                placeholder="Why would they be great here?"
                {...form.register("notes")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit referral"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <h2 className="font-semibold mb-4">All referrals</h2>
          {referrals.isLoading && <Skeleton className="h-40 w-full" />}
          {referrals.data && referrals.data.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No referrals yet.
            </p>
          )}
          {referrals.data && referrals.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.candidateName}</div>
                      <div className="text-xs text-muted-foreground">{r.candidateEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.jobTitle}</TableCell>
                    <TableCell className="text-sm">{r.referrerName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${STATUS_COLORS[r.status] ?? ""} border-0 capitalize text-xs`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatRelative(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
