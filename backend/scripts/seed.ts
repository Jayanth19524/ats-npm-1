import {
  db,
  organizationsTable,
  profilesTable,
  applicantsTable,
  jobsTable,
  stagesTable,
  candidatesTable,
  candidateStagesTable,
  candidateNotesTable,
  tasksTable,
  referralsTable,
  emailTemplatesTable,
  activityTable,
} from "../src/db/index.js";
import bcrypt from "bcryptjs";

async function main() {
  await db.delete(activityTable);
  await db.delete(candidateNotesTable);
  await db.delete(candidateStagesTable);
  await db.delete(tasksTable);
  await db.delete(referralsTable);
  await db.delete(candidatesTable);
  await db.delete(stagesTable);
  await db.delete(jobsTable);
  await db.delete(emailTemplatesTable);
  await db.delete(applicantsTable);
  await db.delete(profilesTable);
  await db.delete(organizationsTable);

  const [org] = await db
    .insert(organizationsTable)
    .values({ slug: "pulse-demo", name: "Pulse Demo Agency" })
    .returning();

  const staffHash = await bcrypt.hash("password123", 10);
  const profiles = await db
    .insert(profilesTable)
    .values([
      { organizationId: org.id, email: "alex@pulse.dev", name: "Alex Rivera", role: "admin", passwordHash: staffHash },
      { organizationId: org.id, email: "sam@pulse.dev", name: "Sam Chen", role: "recruiter", passwordHash: staffHash },
      { organizationId: org.id, email: "morgan@pulse.dev", name: "Morgan Patel", role: "hiring_manager", passwordHash: staffHash },
      { organizationId: org.id, email: "jamie@pulse.dev", name: "Jamie Cole", role: "employee", passwordHash: staffHash },
    ])
    .returning();

  const applicantHash = await bcrypt.hash("password123", 10);
  await db.insert(applicantsTable).values([
    {
      email: "taylor@example.com",
      name: "Taylor Brooks",
      passwordHash: applicantHash,
      phone: "+1 555 0142",
      location: "Austin, TX",
    },
  ]);

  const templates = await db
    .insert(emailTemplatesTable)
    .values([
      {
        organizationId: org.id,
        name: "Application received",
        subject: "Thanks for applying to {{job_title}}",
        body: "Hi {{candidate_name}},\n\nThanks for applying to the {{job_title}} role. We're reviewing your application and will be in touch within a few days.\n\n— The Pulse Team",
      },
      {
        organizationId: org.id,
        name: "Interview invite",
        subject: "Let's schedule an interview",
        body: "Hi {{candidate_name}},\n\nWe enjoyed reviewing your background and would love to set up an interview. Please reply with a few times that work for you this week.\n\n— The Pulse Team",
      },
      {
        organizationId: org.id,
        name: "Offer extended",
        subject: "An offer from Pulse",
        body: "Hi {{candidate_name}},\n\nWe're thrilled to extend an offer for the {{job_title}} role. The full details are attached. Looking forward to your response!\n\n— The Pulse Team",
      },
    ])
    .returning();

  const jobs = await db
    .insert(jobsTable)
    .values([
      {
        organizationId: org.id,
        title: "Senior Product Designer",
        description:
          "Lead end-to-end product design for our flagship recruiting platform. Partner with eng and PM, run user research, and ship polished work.",
        status: "open",
        location: "San Francisco / Remote",
        employmentType: "full_time",
        department: "Design",
        createdBy: profiles[0].id,
      },
      {
        organizationId: org.id,
        title: "Backend Engineer",
        description:
          "Build distributed systems that process candidate data at scale. TypeScript, PostgreSQL, event-driven architecture.",
        status: "open",
        location: "Remote",
        employmentType: "full_time",
        department: "Engineering",
        createdBy: profiles[0].id,
      },
      {
        organizationId: org.id,
        title: "Talent Sourcer",
        description:
          "Find exceptional talent for our customers. Outbound sourcing, pipeline building, and relationship management.",
        status: "open",
        location: "New York",
        employmentType: "full_time",
        department: "Talent",
        createdBy: profiles[1].id,
      },
      {
        organizationId: org.id,
        title: "Marketing Lead",
        description: "Own positioning, content, and demand generation.",
        status: "draft",
        location: "Remote",
        employmentType: "full_time",
        department: "Marketing",
        createdBy: profiles[0].id,
      },
    ])
    .returning();

  const stagePresets = [
    { name: "Applied", color: "#94a3b8", sendEmail: true, createTask: false, templateId: templates[0].id, taskTitle: null as string | null },
    { name: "Screening", color: "#0ea5e9", sendEmail: false, createTask: true, templateId: null as number | null, taskTitle: "Recruiter screen" },
    { name: "Interview", color: "#6366f1", sendEmail: true, createTask: true, templateId: templates[1].id, taskTitle: "Schedule onsite" },
    { name: "Offer", color: "#f59e0b", sendEmail: true, createTask: false, templateId: templates[2].id, taskTitle: null as string | null },
    { name: "Hired", color: "#10b981", sendEmail: false, createTask: false, templateId: null as number | null, taskTitle: null as string | null },
  ];

  const stagesByJob = new Map<number, Awaited<ReturnType<typeof db.insert>>[number] extends never ? never : { id: number; name: string }[]>();
  for (const job of jobs) {
    const inserted = await db
      .insert(stagesTable)
      .values(
        stagePresets.map((s, i) => ({
          organizationId: org.id,
          jobId: job.id,
          name: s.name,
          position: i,
          color: s.color,
          sendEmail: s.sendEmail,
          createTask: s.createTask,
          templateId: s.templateId,
          taskTitle: s.taskTitle,
        })),
      )
      .returning();
    stagesByJob.set(job.id, inserted as unknown as { id: number; name: string }[]);
  }

  const candidatePool = [
    { name: "Priya Shah", email: "priya@example.com", title: "Product Designer at Linear", source: "referral", rating: 5, location: "Brooklyn, NY" },
    { name: "Daniel Wright", email: "daniel@example.com", title: "Senior Designer", source: "linkedin", rating: 4, location: "Austin, TX" },
    { name: "Ines Nakamura", email: "ines@example.com", title: "Design Lead", source: "direct", rating: 4, location: "Toronto, ON" },
    { name: "Marco Rivera", email: "marco@example.com", title: "Staff Engineer", source: "referral", rating: 5, location: "San Francisco, CA" },
    { name: "Yuki Tanaka", email: "yuki@example.com", title: "Backend Engineer", source: "linkedin", rating: 4, location: "Seattle, WA" },
    { name: "Theo Andrade", email: "theo@example.com", title: "Platform Engineer", source: "agency", rating: 3, location: "London, UK" },
    { name: "Lena Hoffmann", email: "lena@example.com", title: "Sourcer at Stripe", source: "linkedin", rating: 4, location: "Berlin, DE" },
    { name: "Noah Park", email: "noah@example.com", title: "Talent Partner", source: "direct", rating: 3, location: "Remote" },
    { name: "Aria Bennett", email: "aria@example.com", title: "Product Designer", source: "referral", rating: 5, location: "Los Angeles, CA" },
    { name: "Elena Vasquez", email: "elena@example.com", title: "UX Designer", source: "direct", rating: 4, location: "Mexico City, MX" },
    { name: "Jonas Becker", email: "jonas@example.com", title: "Full-stack Engineer", source: "agency", rating: 3, location: "Munich, DE" },
    { name: "Hannah Wells", email: "hannah@example.com", title: "Senior Sourcer", source: "linkedin", rating: 4, location: "Chicago, IL" },
  ];

  // Distribute candidates across the first 3 jobs and several stages
  const distribution: Array<{ jobIdx: number; stageIdx: number }> = [
    { jobIdx: 0, stageIdx: 0 },
    { jobIdx: 0, stageIdx: 0 },
    { jobIdx: 0, stageIdx: 1 },
    { jobIdx: 0, stageIdx: 2 },
    { jobIdx: 0, stageIdx: 4 },
    { jobIdx: 1, stageIdx: 0 },
    { jobIdx: 1, stageIdx: 1 },
    { jobIdx: 1, stageIdx: 2 },
    { jobIdx: 1, stageIdx: 3 },
    { jobIdx: 2, stageIdx: 0 },
    { jobIdx: 2, stageIdx: 1 },
    { jobIdx: 2, stageIdx: 4 },
  ];

  for (let i = 0; i < candidatePool.length; i++) {
    const c = candidatePool[i];
    const d = distribution[i];
    const job = jobs[d.jobIdx];
    const stage = stagesByJob.get(job.id)![d.stageIdx];
    const created = new Date(Date.now() - (i + 1) * 36 * 60 * 60 * 1000);
    const [inserted] = await db
      .insert(candidatesTable)
      .values({
        organizationId: org.id,
        jobId: job.id,
        stageId: stage.id,
        name: c.name,
        email: c.email,
        location: c.location,
        currentTitle: c.title,
        source: c.source,
        rating: c.rating,
        createdAt: created,
      })
      .returning();
    await db.insert(candidateStagesTable).values({
      candidateId: inserted.id,
      stageId: stage.id,
      movedAt: created,
      movedBy: profiles[1].id,
    });
    await db.insert(activityTable).values({
      organizationId: org.id,
      type: "candidate_created",
      message: `New candidate ${inserted.name} added to ${job.title}`,
      candidateId: inserted.id,
      jobId: job.id,
      createdAt: created,
    });
    if (d.stageIdx > 0) {
      // walk through earlier stages
      for (let k = 1; k <= d.stageIdx; k++) {
        const movedAt = new Date(created.getTime() + k * 24 * 60 * 60 * 1000);
        const s = stagesByJob.get(job.id)![k];
        await db.insert(candidateStagesTable).values({
          candidateId: inserted.id,
          stageId: s.id,
          movedAt,
          movedBy: profiles[1].id,
        });
        await db.insert(activityTable).values({
          organizationId: org.id,
          type: "candidate_moved",
          message: `${inserted.name} moved to ${s.name}`,
          candidateId: inserted.id,
          jobId: job.id,
          createdAt: movedAt,
        });
      }
    }
  }

  await db.insert(candidateNotesTable).values([
    {
      candidateId: 1,
      body: "Strong portfolio. Loves working on dense, data-driven UIs.",
      authorId: profiles[1].id,
    },
    {
      candidateId: 1,
      body: "Available to start in 4 weeks.",
      authorId: profiles[2].id,
    },
  ]);

  await db.insert(tasksTable).values([
    {
      organizationId: org.id,
      title: "Schedule onsite for Priya Shah",
      description: "Coordinate with the design team for a 4-hour panel.",
      assignedTo: profiles[1].id,
      candidateId: 1,
      status: "todo",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      organizationId: org.id,
      title: "Review backend engineer take-home",
      assignedTo: profiles[2].id,
      candidateId: 7,
      status: "in_progress",
    },
    {
      organizationId: org.id,
      title: "Draft sourcing message templates",
      assignedTo: profiles[1].id,
      status: "todo",
    },
    {
      organizationId: org.id,
      title: "Close loop with Marco on offer",
      assignedTo: profiles[0].id,
      candidateId: 9,
      status: "done",
    },
  ]);

  await db.insert(referralsTable).values([
    {
      organizationId: org.id,
      candidateName: "Iris Bloom",
      candidateEmail: "iris@example.com",
      jobId: jobs[0].id,
      referredBy: profiles[3].id,
      relationship: "Former colleague",
      notes: "Worked together at a previous startup. Excellent product instincts.",
      status: "reviewing",
    },
    {
      organizationId: org.id,
      candidateName: "Otis Frank",
      candidateEmail: "otis@example.com",
      jobId: jobs[1].id,
      referredBy: profiles[3].id,
      relationship: "College friend",
      status: "submitted",
    },
  ]);

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
