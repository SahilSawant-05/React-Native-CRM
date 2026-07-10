import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import Contacts from "./pages/Contacts";
import UploadCsv from "./pages/UploadCsv";
import WhatsAppConnect from "./pages/WhatsAppConnect";
import MetaCallback from "./pages/MetaCallback";
import Templates from "./pages/Templates";
import Chat from "./pages/Chat";
import Logout from "./pages/Logout";
import Dashboard from "./pages/Dashboard";
import AuditLogs from "./pages/AuditLogs";
import WebhookEvents from "./pages/WebhookEvents";
import Segments from "./pages/Segments";
import Users from "./pages/Users";
import RequireAuth from "./auth/RequireAuth";
import RequireRole from "./auth/RequireRole";   // ← NEW
import SessionWatcher from "./auth/SessionWatcher";
import DashboardLayout from "./layout/DashboardLayout";
import CreateCampaign from "./pages/CreateCampaign";
import Event from "./pages/Events";
import { messageContext } from "./store/messageContext";
import { useState } from "react";
import Task from "./pages/Task";
import Pipeline from "./pages/Pipeline";
import Phase2Settings from "./pages/Phase2Settings";
import DomainCatalog from "./pages/DomainCatalog";
import Mail from "./pages/Mail";
import MailDetail from "./pages/MailDetail";
import OpportunityDetail from "./pages/OpportunityDetail";
import AutomationRules from "./pages/AutomationRules";
import Notifications from "./pages/Notifications";
import DuplicateCleanup from "./pages/DuplicateCleanup";
import LeadAssignmentRules from "./pages/LeadAssignmentRules";
import Reports from "./pages/Reports";
import SetupStatus from "./pages/SetupStatus";
import WorkQueue from "./pages/WorkQueue";
import MediaLibrary from "./pages/MediaLibrary";
import WhatsAppFlowBuilder from "./pages/WhatsAppFlowBuilder";
import FacebookLeads from "./pages/FacebookLeads";
import Billing from "./pages/Billing";
import PlatformBillingAdmin from "./pages/PlatformBillingAdmin";
import AiSettings from "./pages/AiSettings";
import AiWorkQueue from "./pages/AiWorkQueue";
import Telephony from "./pages/Telephony";

/*
 * ROLE REFERENCE
 * ─────────────────────────────────────────────────────────────────
 * OWNER / ADMIN  →  full access to everything below
 * AGENT          →  dashboard, contacts (own), tasks (own),
 *                   pipeline (own), chat (own)
 *                   ✗ cannot access campaigns, templates,
 *                     whatsapp connect, upload, user management
 * ─────────────────────────────────────────────────────────────────
 */

const ADMIN_ROLES = ["OWNER", "ADMIN"];
const PLATFORM_ROLES = ["SUPER_ADMIN"];

export default function App() {
  const [message, setmessage] = useState("");

  return (
    <BrowserRouter>
      <messageContext.Provider value={{ message, setmessage }}>
        <SessionWatcher />
        <Routes>

          {/* ── PUBLIC ─────────────────────────────────────────── */}
          <Route path="/" element={<Home />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── AUTHENTICATED (all roles) ───────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />

            {/* ✅ ALL ROLES */}
            <Route path="setup"          element={<SetupStatus />} />
            <Route path="work-queue"     element={<WorkQueue />} />
            <Route path="ai-work-queue"  element={<AiWorkQueue />} />
            <Route path="contacts"       element={<Contacts />} />
            <Route path="pipeline"       element={<Pipeline />} />
            <Route path="opportunities/:id" element={<OpportunityDetail />} />
            <Route path="domain-catalog" element={<DomainCatalog />} />
            <Route path="media-library" element={<MediaLibrary />} />
            <Route path="reports"        element={<Reports />} />
            <Route path="mail"           element={<Mail />} />
            <Route path="mail/:id"       element={<MailDetail />} />
            <Route path="notifications"  element={<Notifications />} />
            <Route path="task"           element={<Task />} />
            <Route path="telephony"      element={<Telephony />} />
            <Route path="chat"           element={<Chat />} />
            <Route path="logout"         element={<Logout />} />

            {/* 🔒 ADMIN / OWNER ONLY */}
            <Route
              path="upload"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <UploadCsv />
                </RequireRole>
              }
            />
            <Route
              path="connect-whatsapp"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WhatsAppConnect />
                </RequireRole>
              }
            />
            <Route
              path="campaigns"
              element={<Navigate to="/dashboard/campaigns/create" replace />}
            />
            <Route
              path="campaigns/create"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <CreateCampaign />
                </RequireRole>
              }
            />
            <Route
              path="whatsapp-flows"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WhatsAppFlowBuilder />
                </RequireRole>
              }
            />
            <Route
              path="facebook-leads"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <FacebookLeads />
                </RequireRole>
              }
            />
            <Route
              path="segments"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Segments />
                </RequireRole>
              }
            />
            <Route
              path="duplicate-cleanup"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <DuplicateCleanup />
                </RequireRole>
              }
            />
            <Route
              path="lead-assignment-rules"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <LeadAssignmentRules />
                </RequireRole>
              }
            />
            <Route
              path="billing"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Billing />
                </RequireRole>
              }
            />
            <Route
              path="users"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Users />
                </RequireRole>
              }
            />
            <Route
              path="templates"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Templates />
                </RequireRole>
              }
            />
            <Route
              path="phase2-settings"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Phase2Settings />
                </RequireRole>
              }
            />
            <Route
              path="ai-settings"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <AiSettings />
                </RequireRole>
              }
            />
            <Route
              path="automation-rules"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <AutomationRules />
                </RequireRole>
              }
            />
            <Route
              path="audit"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <AuditLogs />
                </RequireRole>
              }
            />
            <Route
              path="webhook-events"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WebhookEvents />
                </RequireRole>
              }
            />
            <Route
              path="platform-billing"
              element={
                <RequireRole allowed={PLATFORM_ROLES}>
                  <PlatformBillingAdmin />
                </RequireRole>
              }
            />
            <Route
              path="event"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Event />
                </RequireRole>
              }
            />
          </Route>

          {/* ── CATCH ALL ──────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </messageContext.Provider>
    </BrowserRouter>
  );
}
