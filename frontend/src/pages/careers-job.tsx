import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { MapPin, Briefcase, ArrowLeft, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ResumeUploader, type ResumeUploadResult } from "@/components/ResumeUploader";

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

  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [job, setJob] = useState<PublicJob | null | "missing">(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeUpload, setResumeUpload] = useState<ResumeUploadResult | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
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

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await fetch(applyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTitle,
          resumeUrl,
          resumeKey: resumeUpload?.key,
          resumeFilename: resumeUpload?.filename,
          resumeMimeType: resumeUpload?.mimeType,
          resumeSize: resumeUpload?.size,
          coverLetter,
        }),
      });
      if (res.status === 409) {
        toast.error("You have already applied to this role");
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
    return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-muted-foreground">Loading...</div>;
  }
  if (job === "missing") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          This role is no longer open. <Link href={careersHref} className="text-primary hover:underline">Back to all roles</Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <Link href={careersHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to all roles
      </Link>
      {job.organizationName && (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 bg-muted/60 px-3 py-1 rounded-full">
          <Building2 className="w-3.5 h-3.5" /> {job.organizationName}
        </div>
      )}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{job.title}</h1>
      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
        {job.department && <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{job.department}</span>}
        {job.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
        {job.employmentType && <Badge variant="secondary">{job.employmentType}</Badge>}
        {typeof job.minExperience === "number" && job.minExperience > 0 && (
          <Badge variant="secondary">
            {job.minExperience}+ {job.minExperience === 1 ? "year" : "years"} experience
          </Badge>
        )}
      </div>
      {job.requiredSkills && job.requiredSkills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.requiredSkills.map((skill) => (
            <Badge key={skill} variant="outline">{skill}</Badge>
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
                  We'll be in touch. Track status anytime in <Link href="/careers/me" className="text-primary hover:underline">My applications</Link>.
                </p>
              </div>
            ) : user.kind !== "candidate" ? (
              <div className="text-center py-4">
                <h3 className="font-semibold">Ready to apply?</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Sign in or create a candidate account to submit your application.</p>
                <div className="flex justify-center gap-2">
                  <Button onClick={() => navigate(`/careers/signup?next=${encodeURIComponent(window.location.pathname)}`)}>Create account</Button>
                  <Button variant="outline" onClick={() => navigate(`/careers/login?next=${encodeURIComponent(window.location.pathname)}`)}>Sign in</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={apply} className="space-y-4">
                <h3 className="font-semibold">Apply as {user.name}</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Current title (optional)</Label>
                  <Input id="title" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} placeholder="Senior Software Engineer" />
                </div>
                <div className="space-y-1.5">
                  <Label>Resume</Label>
                  <ResumeUploader
                    value={resumeUrl}
                    onChange={(url, upload) => {
                      setResumeUrl(url);
                      setResumeUpload(upload ?? null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cover">Cover note (optional)</Label>
                  <Textarea id="cover" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={5} placeholder="A few sentences about why this role is exciting to you." />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
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
