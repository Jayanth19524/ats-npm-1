import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { CareersShell } from "@/components/layout/CareersShell";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { DashboardPage } from "@/pages/dashboard";
import { JobsPage } from "@/pages/jobs";
import { JobNewPage } from "@/pages/job-new";
import { JobDetailPage } from "@/pages/job-detail";
import { CandidatesPage } from "@/pages/candidates";
import { CandidateNewPage } from "@/pages/candidate-new";
import { TasksPage } from "@/pages/tasks";
import { ReferralsPage } from "@/pages/referrals";
import { ReportsPage } from "@/pages/reports";
import { SettingsPage } from "@/pages/settings";
import { LoginPage } from "@/pages/login";
import { AgencySignupPage } from "@/pages/agency-signup";
import { CareersListPage } from "@/pages/careers-list";
import { CareersJobPage } from "@/pages/careers-job";
import { CandidateLoginPage, CandidateSignupPage } from "@/pages/careers-auth";
import { CareersMePage } from "@/pages/careers-me";
import {
  CandidateForgotPasswordPage,
  CandidateResetPasswordPage,
  StaffForgotPasswordPage,
  StaffResetPasswordPage,
} from "@/pages/password-reset";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function StaffApp() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user.kind !== "staff") {
      navigate("/login");
    }
  }, [user.kind, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (user.kind !== "staff") {
    return null;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/jobs/new" component={JobNewPage} />
        <Route path="/jobs/:id" component={JobDetailPage} />
        <Route path="/candidates" component={CandidatesPage} />
        <Route path="/candidates/new" component={CandidateNewPage} />
        {/* <Route path="/tasks" component={TasksPage} /> */}
        {/* <Route path="/referrals" component={ReferralsPage} /> */}
        <Route path="/reports" component={ReportsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function withCareersShell(Component: React.ComponentType) {
  return function Wrapped() {
    return (
      <CareersShell>
        <Component />
      </CareersShell>
    );
  };
}

function Routes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={StaffForgotPasswordPage} />
      <Route path="/reset-password" component={StaffResetPasswordPage} />
      <Route path="/signup" component={AgencySignupPage} />
      <Route path="/careers" component={withCareersShell(CareersListPage)} />
      <Route path="/careers/login" component={withCareersShell(CandidateLoginPage)} />
      <Route path="/careers/signup" component={withCareersShell(CandidateSignupPage)} />
      <Route path="/careers/forgot-password" component={withCareersShell(CandidateForgotPasswordPage)} />
      <Route path="/careers/reset-password" component={withCareersShell(CandidateResetPasswordPage)} />
      <Route path="/careers/me" component={withCareersShell(CareersMePage)} />
      <Route path="/careers/jobs/:id" component={withCareersShell(CareersJobPage)} />
      <Route path="/careers/:slug/jobs/:id" component={withCareersShell(CareersJobPage)} />
      <Route path="/careers/:slug" component={withCareersShell(CareersListPage)} />
      <Route component={StaffApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routes />
          </WouterRouter>
          <SonnerToaster position="top-right" richColors />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
