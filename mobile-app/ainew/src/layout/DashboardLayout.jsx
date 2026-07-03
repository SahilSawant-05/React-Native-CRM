import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CreditCard,
  KanbanSquare,
  LayoutDashboard,
  Library,
  ListTodo,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Tags,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Webhook,
  FormInput,
  Workflow,
  X,
} from "lucide-react";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";

const navSections = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/dashboard/setup", label: "Setup", icon: Settings },
      { to: "/dashboard/work-queue", label: "Work Queue", icon: ListTodo },
      { to: "/dashboard/ai-work-queue", label: "AI Work Queue", icon: Bot },
      { to: "/dashboard/chat", label: "Chat", icon: MessageSquare },
      { to: "/dashboard/mail", label: "Mail", icon: Mail },
      { to: "/dashboard/task", label: "Tasks", icon: ListTodo },
      { to: "/dashboard/event", label: "Calendar", icon: CalendarDays, adminOnly: true },
      { to: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
    ],
  },
  {
    label: "CRM",
    items: [
      { to: "/dashboard/contacts", label: "Contacts", icon: Users },
      { to: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
      { to: "/dashboard/domain-catalog", label: "Domain Catalog", icon: Library },
      { to: "/dashboard/media-library", label: "Media Library", icon: Upload },
      { to: "/dashboard/reports", label: "Reports", icon: BarChart3 },
      { to: "/dashboard/segments", label: "Segments", icon: Tags, adminOnly: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { to: "/dashboard/templates", label: "Templates", icon: Send, adminOnly: true },
      { to: "/dashboard/campaigns/create", label: "Campaign Builder", icon: Megaphone, adminOnly: true },
      { to: "/dashboard/whatsapp-flows", label: "WhatsApp Flows", icon: FormInput, adminOnly: true },
      { to: "/dashboard/facebook-leads", label: "Facebook Leads", icon: FormInput, adminOnly: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/dashboard/phase2-settings", label: "CRM Settings", icon: SlidersHorizontal, adminOnly: true },
      { to: "/dashboard/ai-settings", label: "AI Settings", icon: Bot, adminOnly: true },
      { to: "/dashboard/billing", label: "Billing", icon: CreditCard, adminOnly: true },
      { to: "/dashboard/users", label: "Users", icon: UserCog, adminOnly: true },
      { to: "/dashboard/automation-rules", label: "Automation Rules", icon: Workflow, adminOnly: true },
      { to: "/dashboard/lead-assignment-rules", label: "Lead Assignment", icon: UserCheck, adminOnly: true },
      { to: "/dashboard/duplicate-cleanup", label: "Import Cleanup", icon: ScanSearch, adminOnly: true },
      { to: "/dashboard/upload", label: "Upload Leads", icon: Upload, adminOnly: true },
      { to: "/dashboard/connect-whatsapp", label: "WhatsApp Setup", icon: Smartphone, adminOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/dashboard/audit", label: "Audit Logs", icon: ShieldCheck, adminOnly: true },
      { to: "/dashboard/webhook-events", label: "Webhook Events", icon: Webhook, adminOnly: true },
      { to: "/dashboard/platform-billing", label: "Platform Billing", icon: CreditCard, platformOnly: true },
      { to: "/dashboard/logout", label: "Logout", icon: LogOut },
    ],
  },
];

function sectionItems(section, isAdmin, isSuperAdmin) {
  return section.items.filter((item) => {
    if (item.platformOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdmin && !isSuperAdmin;
    return !isSuperAdmin || item.to === "/dashboard/logout";
  });
}

function SidebarContent({ collapsed, hideBrand, isAdmin, isSuperAdmin, role, user, unreadNotifications, onNavigate }) {
  return (
    <>
      {!hideBrand && (
        <div className={`mb-5 flex items-start justify-between gap-3 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed && (
            <div>
              <h3 className="text-lg font-extrabold tracking-tight">Vistaar Flow</h3>
              <p className="mt-1 text-xs text-teal-100">Phase 2 workspace</p>
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <div className="mb-5 rounded-lg bg-white/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">
                {user?.name || user?.email?.split("@")[0] || "User"}
              </div>
              {user?.email && <div className="mt-1 truncate text-xs text-teal-100">{user.email}</div>}
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide">
              {role ?? "-"}
            </span>
          </div>
        </div>
      )}

      <nav className={collapsed ? "space-y-4 pb-6" : "space-y-5 pb-6"}>
        {navSections.map((section) => {
          const items = sectionItems(section, isAdmin, isSuperAdmin);
          if (items.length === 0) return null;

          return (
            <section key={section.label}>
              {!collapsed && (
                <div className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-200">
                  {section.label}
                </div>
              )}
              <div className="space-y-1">
                {items.map(({ to, label, icon: Icon, end, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `relative flex min-h-10 items-center rounded-lg text-sm font-semibold transition ${
                        collapsed ? "justify-center px-2" : "justify-between gap-3 px-3 py-2.5"
                      } ${
                        isActive
                          ? "bg-teal-950 text-white shadow-sm ring-1 ring-white/20"
                          : "text-teal-50 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className={`absolute inset-y-2 rounded-full bg-amber-300 ${collapsed ? "left-1 w-1" : "left-0 w-1"}`} />
                        )}
                    <span className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
                      {Icon && <Icon size={18} className="shrink-0" />}
                      {!collapsed && <span className="truncate">{label}</span>}
                    </span>
                    {!collapsed && badge === "notifications" && unreadNotifications > 0 && (
                      <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isActive ? "bg-amber-300 text-teal-950" : "bg-white text-teal-800"
                      }`}>
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          );
        })}
      </nav>
    </>
  );
}

export default function DashboardLayout() {
  const { isAdmin, isSuperAdmin, role, user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/notifications")
      .then((response) => {
        if (!cancelled) setUnreadNotifications(response.data?.unreadCount || 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadNotifications(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto bg-teal-800 px-4 py-5 text-white transition-all duration-200 lg:flex ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        <button
          type="button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <SidebarContent
          collapsed={sidebarCollapsed}
          hideBrand={false}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          role={role}
          user={user}
          unreadNotifications={unreadNotifications}
        />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[86vw] flex-col overflow-y-auto bg-teal-800 px-4 py-5 text-white shadow-2xl transition-transform duration-200 lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">Vistaar Flow</h3>
            <p className="mt-1 text-xs text-teal-100">Phase 2 workspace</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <SidebarContent
          collapsed={false}
          hideBrand={true}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          role={role}
          user={user}
          unreadNotifications={unreadNotifications}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </aside>

      <main className={`min-w-0 max-w-full flex-1 overflow-x-hidden transition-all duration-200 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-gray-950">Vistaar Flow</div>
            <div className="truncate text-xs font-semibold text-gray-500">{role ?? "User"}</div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
