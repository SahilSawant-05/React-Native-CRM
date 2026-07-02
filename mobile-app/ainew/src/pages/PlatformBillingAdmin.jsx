import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, CreditCard, Edit3, FileText, Gift, Loader2, RefreshCw, Search, ShieldAlert, Users } from "lucide-react";
import api from "../api/axios";

const formatCredits = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const formatCurrency = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(paise || 0) / 100);
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";
const messageFrom = (error, fallback) => error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
const emptyPromoForm = {
  id: null,
  code: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "",
  appliesTo: "ANY",
  planKey: "",
  packageKey: "",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  active: true,
};
const emptyBillingSettings = {
  sellerLegalName: "",
  sellerGstin: "",
  sellerAddress: "",
  supportEmail: "",
  invoicePrefix: "TOH",
  gstPercent: 18,
  razorpayMode: "TEST",
  invoiceFooter: "",
};

export default function PlatformBillingAdmin() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);
  const [platformPayments, setPlatformPayments] = useState([]);
  const [paymentMeta, setPaymentMeta] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [paymentFilters, setPaymentFilters] = useState({ status: "ALL", query: "", tenantId: "" });
  const [billingSettings, setBillingSettings] = useState(emptyBillingSettings);
  const [promoForm, setPromoForm] = useState(emptyPromoForm);
  const [statusForm, setStatusForm] = useState({ status: "ACTIVE", reason: "" });
  const [creditForm, setCreditForm] = useState({ direction: "ADD", credits: "", reason: "" });
  const [extendForm, setExtendForm] = useState({ days: "", reason: "" });
  const [planForm, setPlanForm] = useState({ planKey: "GROWTH", periodMonths: 1, creditIncludedCredits: true, reason: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantResponse, promoResponse, settingsResponse] = await Promise.all([
        api.get("/api/platform/billing/tenants"),
        api.get("/api/platform/billing/promos"),
        api.get("/api/platform/billing/settings"),
      ]);
      const response = tenantResponse;
      const rows = Array.isArray(response.data) ? response.data : [];
      setTenants(rows);
      setPromoCodes(Array.isArray(promoResponse.data) ? promoResponse.data : []);
      setBillingSettings({ ...emptyBillingSettings, ...(settingsResponse.data || {}) });
      if (!selectedTenantId && rows[0]) setSelectedTenantId(String(rows[0].tenantId));
    } catch (loadError) {
      setError(messageFrom(loadError, "Failed to load platform billing tenants."));
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformPayments = async (page = 0) => {
    try {
      const params = { page, size: 25 };
      if (paymentFilters.status !== "ALL") params.status = paymentFilters.status;
      if (paymentFilters.query.trim()) params.query = paymentFilters.query.trim();
      if (paymentFilters.tenantId) params.tenantId = paymentFilters.tenantId;
      const response = await api.get("/api/platform/billing/payments", { params });
      setPlatformPayments(Array.isArray(response.data?.items) ? response.data.items : []);
      setPaymentMeta({
        page: response.data?.page || 0,
        totalPages: response.data?.totalPages || 0,
        totalElements: response.data?.totalElements || 0,
      });
    } catch (paymentError) {
      setPlatformPayments([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadPlatformPayments(0);
  }, [paymentFilters.status, paymentFilters.tenantId]);

  const filteredTenants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const statusMatch = statusFilter === "ALL" || String(tenant.tenantStatus || "").toUpperCase() === statusFilter;
      if (!statusMatch) return false;
      if (!q) return true;
      return [tenant.businessName, tenant.email, tenant.tenantStatus, tenant.planKey, tenant.subscriptionStatus, tenant.tenantId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    });
  }, [tenants, query, statusFilter]);

  const selectedTenant = tenants.find((tenant) => String(tenant.tenantId) === String(selectedTenantId));

  const refreshTenant = async (tenantId = selectedTenantId) => {
    if (!tenantId) return;
    const response = await api.get(`/api/platform/billing/tenants/${tenantId}`);
    setTenants((current) => current.map((tenant) => String(tenant.tenantId) === String(tenantId) ? response.data : tenant));
  };

  const loadAuditLogs = async (tenantId = selectedTenantId) => {
    if (!tenantId) {
      setAuditLogs([]);
      return;
    }
    setAuditLoading(true);
    try {
      const response = await api.get(`/api/platform/billing/tenants/${tenantId}/audit`);
      setAuditLogs(Array.isArray(response.data) ? response.data : []);
    } catch (auditError) {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      setStatusForm({ status: selectedTenant.tenantStatus || "ACTIVE", reason: "" });
      loadAuditLogs(selectedTenant.tenantId);
    }
  }, [selectedTenantId]);

  const runAction = async (key, action, reset) => {
    if (!selectedTenantId) return;
    setSaving(key);
    setError("");
    setSuccess("");
    try {
      const response = await action();
      setTenants((current) => current.map((tenant) => String(tenant.tenantId) === String(selectedTenantId) ? response.data : tenant));
      setSuccess("Platform tenant update saved.");
      reset?.();
      await loadAuditLogs();
    } catch (actionError) {
      setError(messageFrom(actionError, "Platform tenant update failed."));
    } finally {
      setSaving("");
    }
  };

  const savePromo = async () => {
    setSaving("promo");
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...promoForm,
        discountValue: Number(promoForm.discountValue || 0),
        maxRedemptions: promoForm.maxRedemptions ? Number(promoForm.maxRedemptions) : null,
        startsAt: promoForm.startsAt ? new Date(promoForm.startsAt).toISOString() : null,
        endsAt: promoForm.endsAt ? new Date(promoForm.endsAt).toISOString() : null,
      };
      const response = promoForm.id
        ? await api.post(`/api/platform/billing/promos/${promoForm.id}`, payload)
        : await api.post("/api/platform/billing/promos", payload);
      setPromoCodes((current) => {
        const exists = current.some((item) => item.id === response.data.id);
        return exists
          ? current.map((item) => item.id === response.data.id ? response.data : item)
          : [response.data, ...current];
      });
      setPromoForm(emptyPromoForm);
      setSuccess("Promo code saved.");
    } catch (promoError) {
      setError(messageFrom(promoError, "Promo code save failed."));
    } finally {
      setSaving("");
    }
  };

  const togglePromo = async (promo) => {
    setSaving(`promo-${promo.id}`);
    setError("");
    setSuccess("");
    try {
      const response = await api.post(`/api/platform/billing/promos/${promo.id}/status`, { ...promo, active: !promo.active });
      setPromoCodes((current) => current.map((item) => item.id === promo.id ? response.data : item));
      setSuccess(`Promo code ${response.data.active ? "activated" : "disabled"}.`);
    } catch (promoError) {
      setError(messageFrom(promoError, "Promo status update failed."));
    } finally {
      setSaving("");
    }
  };

  const saveBillingSettings = async () => {
    setSaving("settings");
    setError("");
    setSuccess("");
    try {
      const response = await api.post("/api/platform/billing/settings", {
        ...billingSettings,
        gstPercent: Number(billingSettings.gstPercent || 0),
      });
      setBillingSettings({ ...emptyBillingSettings, ...(response.data || {}) });
      setSuccess("Billing settings saved. Future invoices will use the updated settings.");
    } catch (settingsError) {
      setError(messageFrom(settingsError, "Billing settings save failed."));
    } finally {
      setSaving("");
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center gap-2 bg-slate-50 p-6 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading platform billing...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Platform Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Super admin controls for tenants, credits, plans, subscription extensions, and audit history.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tenants" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-400" />
          </div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {["ALL", "ACTIVE", "PENDING", "SUSPENDED"].map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-lg border px-2 py-2 text-[11px] font-extrabold ${statusFilter === status ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                {status}
              </button>
            ))}
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {filteredTenants.map((tenant) => (
              <button
                key={tenant.tenantId}
                type="button"
                onClick={() => setSelectedTenantId(String(tenant.tenantId))}
                className={`w-full rounded-lg border p-3 text-left ${String(selectedTenantId) === String(tenant.tenantId) ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <div className="font-extrabold text-slate-950">{tenant.businessName || `Tenant #${tenant.tenantId}`}</div>
                <div className="mt-1 text-xs text-slate-500">{tenant.email}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-white px-2 py-1 text-teal-700">{tenant.planKey}</span>
                  <span className={`rounded-full bg-white px-2 py-1 ${tenant.tenantStatus === "SUSPENDED" ? "text-red-700" : "text-slate-600"}`}>{tenant.tenantStatus}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-slate-600">{tenant.subscriptionStatus}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-slate-600">{formatCredits(tenant.balanceCredits)} credits</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {selectedTenant ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-950">{selectedTenant.businessName}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedTenant.email} · Tenant #{selectedTenant.tenantId}</p>
                  </div>
                  <button type="button" onClick={() => refreshTenant()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Refresh Tenant</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <Metric label="Tenant" value={selectedTenant.tenantStatus} tone={selectedTenant.tenantStatus === "SUSPENDED" ? "danger" : "normal"} />
                  <Metric label="Plan" value={selectedTenant.planKey} />
                  <Metric label="Status" value={selectedTenant.subscriptionStatus} />
                  <Metric label="Expires" value={formatDate(selectedTenant.currentPeriodEnd)} />
                  <Metric label="Credits" value={formatCredits(selectedTenant.balanceCredits)} />
                  <Metric label="Users" value={selectedTenant.userCount ?? 0} />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-4">
                <ControlCard title="Tenant Access" icon={ShieldAlert}>
                  <Select label="Status" value={statusForm.status} onChange={(value) => setStatusForm((f) => ({ ...f, status: value }))} options={["ACTIVE", "PENDING", "SUSPENDED"]} />
                  <Textarea label="Reason" value={statusForm.reason} onChange={(value) => setStatusForm((f) => ({ ...f, reason: value }))} />
                  <ActionButton saving={saving === "status"} onClick={() => runAction("status", () => api.post(`/api/platform/billing/tenants/${selectedTenantId}/status`, statusForm), () => setStatusForm((f) => ({ ...f, reason: "" })))}>Update Status</ActionButton>
                </ControlCard>

                <ControlCard title="Adjust Credits" icon={CreditCard}>
                  <Select label="Direction" value={creditForm.direction} onChange={(value) => setCreditForm((f) => ({ ...f, direction: value }))} options={["ADD", "REMOVE"]} />
                  <Input label="Credits" type="number" value={creditForm.credits} onChange={(value) => setCreditForm((f) => ({ ...f, credits: value }))} />
                  <Textarea label="Reason" value={creditForm.reason} onChange={(value) => setCreditForm((f) => ({ ...f, reason: value }))} />
                  <ActionButton saving={saving === "credits"} onClick={() => runAction("credits", () => api.post(`/api/platform/billing/tenants/${selectedTenantId}/credits`, creditForm), () => setCreditForm({ direction: "ADD", credits: "", reason: "" }))}>Save Adjustment</ActionButton>
                </ControlCard>

                <ControlCard title="Extend Subscription" icon={RefreshCw}>
                  <Input label="Days" type="number" value={extendForm.days} onChange={(value) => setExtendForm((f) => ({ ...f, days: value }))} />
                  <Textarea label="Reason" value={extendForm.reason} onChange={(value) => setExtendForm((f) => ({ ...f, reason: value }))} />
                  <ActionButton saving={saving === "extend"} onClick={() => runAction("extend", () => api.post(`/api/platform/billing/tenants/${selectedTenantId}/extend`, extendForm), () => setExtendForm({ days: "", reason: "" }))}>Extend</ActionButton>
                </ControlCard>

                <ControlCard title="Change Plan" icon={CreditCard}>
                  <Select label="Plan" value={planForm.planKey} onChange={(value) => setPlanForm((f) => ({ ...f, planKey: value }))} options={["STARTER", "GROWTH", "PRO", "AGENCY"]} />
                  <Select label="Period" value={String(planForm.periodMonths)} onChange={(value) => setPlanForm((f) => ({ ...f, periodMonths: Number(value) }))} options={["1", "12"]} labels={{ "1": "Monthly - 1 month", "12": "Yearly - 12 months" }} />
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={planForm.creditIncludedCredits} onChange={(e) => setPlanForm((f) => ({ ...f, creditIncludedCredits: e.target.checked }))} />
                    Credit included plan credits
                  </label>
                  <Textarea label="Reason" value={planForm.reason} onChange={(value) => setPlanForm((f) => ({ ...f, reason: value }))} />
                  <ActionButton saving={saving === "plan"} onClick={() => runAction("plan", () => api.post(`/api/platform/billing/tenants/${selectedTenantId}/plan`, planForm), () => setPlanForm({ planKey: "GROWTH", periodMonths: 1, creditIncludedCredits: true, reason: "" }))}>Change Plan</ActionButton>
                </ControlCard>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Activity size={18} className="text-teal-700" />
                      <h3 className="font-extrabold text-slate-950">Recent Audit History</h3>
                    </div>
                    <button type="button" onClick={() => loadAuditLogs()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Refresh</button>
                  </div>
                  {auditLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading audit events...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No audit events recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {auditLogs.map((item) => (
                        <div key={item.id} className="py-3">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-bold text-slate-900">{item.summary || item.actionType}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.actionType} · {item.actorUserEmail || `User #${item.actorUserId || "-"}`}</p>
                            </div>
                            <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                          </div>
                          {item.details && <p className="mt-2 text-sm text-slate-600">{item.details}</p>}
                          {(item.oldValue || item.newValue) && <p className="mt-2 text-xs font-semibold text-slate-500">Changed: {item.oldValue || "-"} → {item.newValue || "-"}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-teal-700" />
                    <h3 className="font-extrabold text-slate-950">Tenant Snapshot</h3>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <SnapshotRow label="Tenant ID" value={selectedTenant.tenantId} />
                    <SnapshotRow label="Business" value={selectedTenant.businessName} />
                    <SnapshotRow label="Email" value={selectedTenant.email} />
                    <SnapshotRow label="Plan" value={selectedTenant.planKey} />
                    <SnapshotRow label="Subscription" value={selectedTenant.subscriptionStatus} />
                    <SnapshotRow label="Users" value={selectedTenant.userCount ?? 0} />
                    <SnapshotRow label="Raw points" value={selectedTenant.balancePoints ?? 0} />
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">Select a tenant to manage billing.</div>
          )}
        </section>
      </div>
      <PromoManager
        promoCodes={promoCodes}
        promoForm={promoForm}
        setPromoForm={setPromoForm}
        saving={saving}
        onSave={savePromo}
        onToggle={togglePromo}
      />
      <BillingSettingsPanel
        settings={billingSettings}
        setSettings={setBillingSettings}
        saving={saving === "settings"}
        onSave={saveBillingSettings}
      />
      <PlatformPayments
        payments={platformPayments}
        meta={paymentMeta}
        filters={paymentFilters}
        setFilters={setPaymentFilters}
        onSearch={() => loadPlatformPayments(0)}
        onPage={loadPlatformPayments}
      />
    </div>
  );
}

function BillingSettingsPanel({ settings, setSettings, saving, onSave }) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><FileText size={20} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Billing Settings</h2>
            <p className="mt-1 text-sm text-slate-500">Controls seller details, invoice prefix, GST percent, and Razorpay mode for future invoices.</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${settings.razorpayMode === "LIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          Razorpay {settings.razorpayMode || "TEST"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Seller Legal Name" value={settings.sellerLegalName || ""} onChange={(value) => setSettings((s) => ({ ...s, sellerLegalName: value }))} />
        <Input label="Seller GSTIN" value={settings.sellerGstin || ""} onChange={(value) => setSettings((s) => ({ ...s, sellerGstin: value.toUpperCase() }))} />
        <Input label="Support Email" value={settings.supportEmail || ""} onChange={(value) => setSettings((s) => ({ ...s, supportEmail: value }))} />
        <Input label="Invoice Prefix" value={settings.invoicePrefix || ""} onChange={(value) => setSettings((s) => ({ ...s, invoicePrefix: value.toUpperCase() }))} />
        <Input label="GST Percent" type="number" value={settings.gstPercent ?? 18} onChange={(value) => setSettings((s) => ({ ...s, gstPercent: value }))} />
        <Select label="Razorpay Mode" value={settings.razorpayMode || "TEST"} onChange={(value) => setSettings((s) => ({ ...s, razorpayMode: value }))} options={["TEST", "LIVE"]} />
        <label className="block text-sm font-semibold text-slate-700 md:col-span-3">Seller Address
          <textarea value={settings.sellerAddress || ""} onChange={(event) => setSettings((s) => ({ ...s, sellerAddress: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
        </label>
        <label className="block text-sm font-semibold text-slate-700 md:col-span-3">Invoice Footer
          <textarea value={settings.invoiceFooter || ""} onChange={(event) => setSettings((s) => ({ ...s, invoiceFooter: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
        </label>
      </div>
      <button type="button" onClick={onSave} disabled={saving} className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800 disabled:opacity-60">
        {saving && <Loader2 size={16} className="animate-spin" />}
        Save Billing Settings
      </button>
    </section>
  );
}

function PlatformPayments({ payments, meta, filters, setFilters, onSearch, onPage }) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><FileText size={20} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Platform Payments</h2>
            <p className="mt-1 text-sm text-slate-500">Search tenant payments, invoices, Razorpay IDs, and failed checkout records.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[130px_120px_1fr_auto]">
          <select value={filters.status} onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-400">
            {["ALL", "PAID", "CREATED", "FAILED"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input value={filters.tenantId} onChange={(event) => setFilters((f) => ({ ...f, tenantId: event.target.value }))} placeholder="Tenant ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          <input value={filters.query} onChange={(event) => setFilters((f) => ({ ...f, query: event.target.value }))} placeholder="Search invoice/payment/order" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          <button type="button" onClick={onSearch} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800">Search</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Tenant", "Invoice", "Type", "Amount", "Discount", "Status", "Razorpay", "Error"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No payments found.</td></tr>}
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">{formatDateTime(payment.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="font-extrabold text-slate-950">{payment.tenantName || `Tenant #${payment.tenantId}`}</div>
                  <div className="mt-1 text-xs text-slate-500">{payment.tenantEmail}</div>
                </td>
                <td className="px-4 py-3 font-bold text-slate-700">{payment.invoiceNumber || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{payment.orderType}<div className="text-xs text-slate-400">{payment.packageKey}</div></td>
                <td className="px-4 py-3 font-extrabold text-slate-900">
                  {formatCurrency(payment.amountPaise)}
                  <div className="mt-1 text-xs font-semibold text-slate-400">GST {payment.gstPercent || 18}%: {formatCurrency(payment.taxAmountPaise || 0)}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{payment.discountAmountPaise ? `${formatCurrency(payment.discountAmountPaise)} (${payment.promoCode || "-"})` : "-"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${payment.status === "PAID" ? "bg-emerald-50 text-emerald-700" : payment.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{payment.status}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{payment.razorpayPaymentId || payment.razorpayOrderId || "-"}</td>
                <td className="max-w-[260px] px-4 py-3 text-xs text-red-600">{payment.errorMessage || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-500">{meta.totalElements || 0} payment records</p>
        <div className="flex gap-2">
          <button type="button" disabled={meta.page <= 0} onClick={() => onPage(Math.max(0, meta.page - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 disabled:opacity-50">Previous</button>
          <button type="button" disabled={meta.totalPages === 0 || meta.page >= meta.totalPages - 1} onClick={() => onPage(meta.page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 disabled:opacity-50">Next</button>
        </div>
      </div>
    </section>
  );
}

function PromoManager({ promoCodes, promoForm, setPromoForm, saving, onSave, onToggle }) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><Gift size={20} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Promo Code Manager</h2>
            <p className="mt-1 text-sm text-slate-500">Create launch offers, yearly discounts, or package-specific coupons for tenant checkout.</p>
          </div>
        </div>
        {promoForm.id && (
          <button type="button" onClick={() => setPromoForm(emptyPromoForm)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50">
            Start New Promo
          </button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Code" value={promoForm.code} onChange={(value) => setPromoForm((f) => ({ ...f, code: value.toUpperCase() }))} />
            <Select label="Discount Type" value={promoForm.discountType} onChange={(value) => setPromoForm((f) => ({ ...f, discountType: value }))} options={["PERCENT", "FIXED"]} labels={{ PERCENT: "Percent", FIXED: "Fixed INR paise" }} />
            <Input label={promoForm.discountType === "FIXED" ? "Discount Paise" : "Discount %"} type="number" value={promoForm.discountValue} onChange={(value) => setPromoForm((f) => ({ ...f, discountValue: value }))} />
            <Select label="Applies To" value={promoForm.appliesTo} onChange={(value) => setPromoForm((f) => ({ ...f, appliesTo: value }))} options={["ANY", "PLAN_SUBSCRIPTION", "CREDIT_TOPUP"]} labels={{ ANY: "Any checkout", PLAN_SUBSCRIPTION: "Plans only", CREDIT_TOPUP: "Credits only" }} />
            <Input label="Plan Key" value={promoForm.planKey} onChange={(value) => setPromoForm((f) => ({ ...f, planKey: value.toUpperCase() }))} />
            <Input label="Package Key" value={promoForm.packageKey} onChange={(value) => setPromoForm((f) => ({ ...f, packageKey: value.toUpperCase() }))} />
            <Input label="Max Redemptions" type="number" value={promoForm.maxRedemptions} onChange={(value) => setPromoForm((f) => ({ ...f, maxRedemptions: value }))} />
            <label className="block text-sm font-semibold text-slate-700">Status
              <select value={promoForm.active ? "ACTIVE" : "DISABLED"} onChange={(e) => setPromoForm((f) => ({ ...f, active: e.target.value === "ACTIVE" }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400">
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <Input label="Starts At" type="datetime-local" value={promoForm.startsAt} onChange={(value) => setPromoForm((f) => ({ ...f, startsAt: value }))} />
            <Input label="Ends At" type="datetime-local" value={promoForm.endsAt} onChange={(value) => setPromoForm((f) => ({ ...f, endsAt: value }))} />
          </div>
          <Textarea label="Description" value={promoForm.description} onChange={(value) => setPromoForm((f) => ({ ...f, description: value }))} />
          <button type="button" onClick={onSave} disabled={saving === "promo"} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800 disabled:opacity-60">
            {saving === "promo" && <Loader2 size={16} className="animate-spin" />}
            {promoForm.id ? "Update Promo" : "Create Promo"}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                {["Code", "Discount", "Applies", "Target", "Redemptions", "Valid", "Status", "Actions"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {promoCodes.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No promo codes yet.</td></tr>}
              {promoCodes.map((promo) => (
                <tr key={promo.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-extrabold text-slate-950">{promo.code}</div>
                    {promo.description && <div className="mt-1 text-xs text-slate-500">{promo.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">{promo.discountType === "FIXED" ? `₹${Number(promo.discountValue || 0) / 100}` : `${promo.discountValue}%`}</td>
                  <td className="px-4 py-3 text-slate-600">{promo.appliesTo}</td>
                  <td className="px-4 py-3 text-slate-600">{promo.planKey || promo.packageKey || "Any"}</td>
                  <td className="px-4 py-3 text-slate-600">{promo.redeemedCount || 0} / {promo.maxRedemptions || "∞"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(promo.startsAt)} - {formatDate(promo.endsAt)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${promo.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{promo.active ? "ACTIVE" : "DISABLED"}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setPromoForm(toPromoForm(promo))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-slate-700 hover:bg-slate-50"><Edit3 size={13} /> Edit</button>
                      <button type="button" onClick={() => onToggle(promo)} disabled={saving === `promo-${promo.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-teal-700 hover:bg-teal-50 disabled:opacity-60">{promo.active ? "Disable" : "Activate"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function toPromoForm(promo) {
  return {
    id: promo.id,
    code: promo.code || "",
    description: promo.description || "",
    discountType: promo.discountType || "PERCENT",
    discountValue: promo.discountValue || "",
    appliesTo: promo.appliesTo || "ANY",
    planKey: promo.planKey || "",
    packageKey: promo.packageKey || "",
    maxRedemptions: promo.maxRedemptions || "",
    startsAt: toDateTimeInput(promo.startsAt),
    endsAt: toDateTimeInput(promo.endsAt),
    active: promo.active !== false,
  };
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Metric({ label, value }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 font-extrabold text-slate-950">{value || "-"}</div></div>;
}

function ControlCard({ title, icon: Icon, children }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Icon size={18} className="text-teal-700" /><h3 className="font-extrabold text-slate-950">{title}</h3></div><div className="space-y-3">{children}</div></div>;
}

function Input({ label, value, onChange, type = "text" }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" /></label>;
}

function Select({ label, value, onChange, options, labels = {} }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400">{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}

function Textarea({ label, value, onChange }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" /></label>;
}

function ActionButton({ saving, onClick, children }) {
  return <button type="button" onClick={onClick} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800 disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{children}</button>;
}

function SnapshotRow({ label, value }) {
  return <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-extrabold text-slate-900">{value || "-"}</span></div>;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";
}
