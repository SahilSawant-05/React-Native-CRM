import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
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

export default function App() {
  const [message, setmessage] = useState("");

  return (
    <BrowserRouter>
      <messageContext.Provider value={{ message, setmessage }}>
        <SessionWatcher />
        <Routes>

          {/* ── PUBLIC ─────────────────────────────────────────── */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* ── AUTHENTICATED (all roles) ───────────────────────── */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/login" replace />} />

            {/* ✅ ALL ROLES */}
            <Route path="dashboard"                element={<Dashboard />} />
            <Route path="dashboard/setup"          element={<SetupStatus />} />
            <Route path="dashboard/work-queue"     element={<WorkQueue />} />
            <Route path="dashboard/contacts"       element={<Contacts />} />
            <Route path="dashboard/pipeline"       element={<Pipeline />} />
            <Route path="dashboard/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="dashboard/domain-catalog" element={<DomainCatalog />} />
            <Route path="dashboard/media-library" element={<MediaLibrary />} />
            <Route path="dashboard/reports"        element={<Reports />} />
            <Route path="dashboard/mail"           element={<Mail />} />
            <Route path="dashboard/mail/:id"       element={<MailDetail />} />
            <Route path="dashboard/notifications"  element={<Notifications />} />
            <Route path="dashboard/task"           element={<Task />} />
            <Route path="dashboard/chat"           element={<Chat />} />
            <Route path="dashboard/logout"         element={<Logout />} />

            {/* 🔒 ADMIN / OWNER ONLY */}
            <Route
              path="dashboard/upload"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <UploadCsv />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/connect-whatsapp"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WhatsAppConnect />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/campaigns/create"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <CreateCampaign />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/whatsapp-flows"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WhatsAppFlowBuilder />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/segments"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Segments />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/duplicate-cleanup"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <DuplicateCleanup />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/lead-assignment-rules"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <LeadAssignmentRules />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/users"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Users />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/templates"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Templates />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/phase2-settings"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <Phase2Settings />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/automation-rules"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <AutomationRules />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/audit"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <AuditLogs />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/webhook-events"
              element={
                <RequireRole allowed={ADMIN_ROLES}>
                  <WebhookEvents />
                </RequireRole>
              }
            />
            <Route
              path="dashboard/event"
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
