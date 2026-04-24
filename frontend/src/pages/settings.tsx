import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Plug, ExternalLink, Copy } from "lucide-react";
import {
  useListTeam,
  useListTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type ListTemplatesResponseItem,
  getListTemplatesQueryKey,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { initials, ROLE_LABELS } from "@/lib/format";

export function SettingsPage() {
  useEffect(() => {
    document.title = "Settings · Pulse";
  }, []);

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Manage your workspace, team and email templates." />
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="templates">Email templates</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace" className="mt-6">
          <WorkspaceSection />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamSection />
        </TabsContent>
        <TabsContent value="templates" className="mt-6">
          <TemplatesSection />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsSection />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function WorkspaceSection() {
  const [org, setOrg] = useState<{
    id: number;
    slug: string;
    name: string;
    description: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/organization");
      if (r.ok) {
        const o = await r.json();
        setOrg(o);
        setName(o.name);
        setDescription(o.description ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error || "Could not save");
        return;
      }
      setOrg(body);
      toast.success("Workspace saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="p-6">Loading…</Card>;
  if (!org) return <Card className="p-6">Workspace not found.</Card>;

  const careersUrl = `${window.location.origin}/careers/${org.slug}`;
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Workspace</h2>
        <div className="space-y-1.5">
          <Label>Company name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            This appears on your public careers page.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>About your company</Label>
          <Textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell candidates what your company does, your mission, and what it's like to work with you."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Public careers page</h2>
        <p className="text-sm text-muted-foreground">
          Share this link to let candidates browse and apply to your open roles.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={careersUrl} className="font-mono text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void navigator.clipboard.writeText(careersUrl);
              toast.success("Link copied");
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={careersUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" /> Visit
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TeamSection() {
  const team = useListTeam();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    tempPassword: string | null;
    emailDelivered: boolean;
    emailConfigured: boolean;
  } | null>(null);
  const form = useForm({
    defaultValues: { name: "", email: "", role: "recruiter", password: "" },
  });

  async function submit(values: {
    name: string;
    email: string;
    role: string;
    password: string;
  }) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Could not add member");
        return;
      }
      qc.invalidateQueries({ queryKey: ["/team"] });
      // Refresh list via the generated key as well
      void team.refetch();
      setCreated({
        email: body.email,
        tempPassword: body.tempPassword,
        emailDelivered: body.emailDelivered,
        emailConfigured: body.emailConfigured,
      });
      form.reset();
      toast.success(
        body.emailDelivered
          ? "Member added and invite emailed"
          : "Member added — share their temporary password",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Members</h2>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setCreated(null);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add member
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {team.data?.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </div>
              <Badge variant="outline">{ROLE_LABELS[p.role] ?? p.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          {created ? (
            <div className="space-y-4">
              <p className="text-sm">
                Invited <span className="font-medium">{created.email}</span>.
              </p>
              {created.emailDelivered ? (
                <p className="text-sm text-muted-foreground">
                  An email with sign-in instructions has been sent.
                </p>
              ) : (
                <div className="text-sm bg-muted/60 rounded-md p-3 space-y-2">
                  <p className="font-medium">
                    {created.emailConfigured
                      ? "Email delivery failed — share these credentials manually:"
                      : "Email is not configured — share these credentials manually:"}
                  </p>
                  <div className="font-mono text-xs">
                    Email: {created.email}
                    <br />
                    Temporary password: {created.tempPassword}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={form.handleSubmit(submit)}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input required {...form.register("name", { required: true, minLength: 2 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  {...form.register("email", { required: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...form.register("role", { required: true })}
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="hiring_manager">Hiring manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password (optional)</Label>
                <Input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  {...form.register("password")}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters. They can change it after signing in.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding…" : "Add member"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplatesSection() {
  const templates = useListTemplates();
  const [editing, setEditing] = useState<ListTemplatesResponseItem | null>(null);
  const [open, setOpen] = useState(false);
  const del = useDeleteTemplate();
  const qc = useQueryClient();

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Email templates</h2>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> New template
          </Button>
        </div>
        {templates.data?.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No templates yet.
          </p>
        )}
        <ul className="divide-y divide-border">
          {templates.data?.map((t) => (
            <li key={t.id} className="flex items-start gap-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.subject}</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {t.body}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(t);
                  setOpen(true);
                }}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  del.mutate(
                    { id: t.id },
                    {
                      onSuccess: () => {
                        qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
                        toast.success("Template deleted");
                      },
                    },
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <TemplateDialog open={open} onOpenChange={setOpen} editing={editing} />
    </>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ListTemplatesResponseItem | null;
}) {
  const form = useForm({
    values: editing
      ? { name: editing.name, subject: editing.subject, body: editing.body }
      : { name: "", subject: "", body: "" },
  });
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const qc = useQueryClient();

  const submit = form.handleSubmit((v) => {
    const onDone = () => {
      qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      toast.success("Template saved");
      onOpenChange(false);
    };
    if (editing) {
      update.mutate({ id: editing.id, data: v }, { onSuccess: onDone });
    } else {
      create.mutate({ data: v }, { onSuccess: onDone });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input required {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input required {...form.register("subject")} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea rows={8} required {...form.register("body")} />
            <p className="text-xs text-muted-foreground">
              You can use {`{{candidate_name}}`} and {`{{job_title}}`} in your message.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsSection() {
  const items = [
    { name: "Slack", desc: "Get pipeline updates in your team channels." },
    { name: "Google Calendar", desc: "Automatically schedule interviews." },
    { name: "Greenhouse import", desc: "Import existing candidates and jobs." },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((i) => (
        <Card key={i.name} className="p-6">
          <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center text-accent-foreground mb-3">
            <Plug className="w-5 h-5" />
          </div>
          <h3 className="font-semibold mb-1">{i.name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{i.desc}</p>
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        </Card>
      ))}
    </div>
  );
}
