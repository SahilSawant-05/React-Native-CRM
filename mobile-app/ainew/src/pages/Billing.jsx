import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, FileText, Gift, HardDrive, History, IndianRupee, Loader2, RefreshCw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import api from "../api/axios";

const formatCredits = (value) => {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const formatCurrency = (paise) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((Number(paise || 0) / 100));

const formatStorage = (bytes) => {
  const value = Number(bytes || 0);
  const gb = value / 1024 / 1024 / 1024;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  const mb = value / 1024 / 1024;
  return `${Math.max(0, Math.round(mb))} MB`;
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return value;
  }
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const planFeatureEnabled = (plan, key) => {
  if (!plan?.featuresJson) return false;
  try {
    const features = typeof plan.featuresJson === "string" ? JSON.parse(plan.featuresJson) : plan.featuresJson;
    return Boolean(features?.[key]);
  } catch {
    return false;
  }
};

const planRankValue = (plan) => Number(plan?.monthlyPricePaise || 0);

const planActionMeta = ({ plan, currentPlan, subscription, billingCycle }) => {
  const current = plan?.planKey === currentPlan?.planKey;
  const trial = subscription?.status === "TRIAL";
  const cycleLabel = billingCycle === "YEARLY" ? "Yearly" : "Monthly";
  if (trial) {
    return {
      label: current ? "Current Trial Plan" : "Use During Trial",
      helper: current
        ? "This is the plan currently enabled for your trial."
        : "Switch trial features without payment. Credits are not added again.",
      disabled: current,
      variant: current ? "current" : "trial",
    };
  }
  if (current) {
    return {
      label: `Renew ${cycleLabel}`,
      helper: "Renews the same plan and credits the included plan credits after payment.",
      disabled: false,
      variant: "current",
    };
  }
  const lowerPlan = planRankValue(plan) < planRankValue(currentPlan);
  if (lowerPlan) {
    return {
      label: `Downgrade ${cycleLabel}`,
      helper: "Use this when renewing on a smaller plan. Make sure your users, contacts, pipelines, and storage fit this plan.",
      disabled: false,
      variant: "downgrade",
    };
  }
  return {
    label: `Upgrade ${cycleLabel}`,
    helper: "Move to a higher plan and receive the included plan credits after payment.",
    disabled: false,
    variant: "upgrade",
  };
};

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });

export default function Billing() {
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);
  const [aiUsage, setAiUsage] = useState(null);
  const [aiUsagePage, setAiUsagePage] = useState(0);
  const [aiUsagePageSize, setAiUsagePageSize] = useState(10);
  const [aiUsageDateFrom, setAiUsageDateFrom] = useState("");
  const [aiUsageDateTo, setAiUsageDateTo] = useState("");
  const [packages, setPackages] = useState([]);
  const [storagePackages, setStoragePackages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [billingProfile, setBillingProfile] = useState(null);
  const [billingProfileForm, setBillingProfileForm] = useState({
    billingCompanyName: "",
    billingGstin: "",
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingPincode: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingKey, setPurchasingKey] = useState("");
  const [billingCycle, setBillingCycle] = useState("MONTHLY");
  const [storageBillingCycle, setStorageBillingCycle] = useState("MONTHLY");
  const [promoCode, setPromoCode] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [billingProfileError, setBillingProfileError] = useState("");
  const [billingProfileSuccess, setBillingProfileSuccess] = useState("");

  const pricingRules = useMemo(() => summary?.pricingRules || [], [summary]);
  const plans = useMemo(() => summary?.plans || [], [summary]);
  const usage = summary?.usage || {};
  const subscription = summary?.subscription || {};
  const paidPayments = useMemo(() => payments.filter((payment) => payment.status === "PAID"), [payments]);
  const ledgerTotalPages = Math.max(1, Math.ceil(ledger.length / ledgerPageSize));
  const safeLedgerPage = Math.min(ledgerPage, ledgerTotalPages - 1);
  const ledgerPageRows = useMemo(
    () => ledger.slice(safeLedgerPage * ledgerPageSize, safeLedgerPage * ledgerPageSize + ledgerPageSize),
    [ledger, safeLedgerPage, ledgerPageSize]
  );
  const filteredAiActions = useMemo(() => {
    const actions = Array.isArray(aiUsage?.recentActions) ? aiUsage.recentActions : [];
    const from = aiUsageDateFrom ? new Date(`${aiUsageDateFrom}T00:00:00`) : null;
    const to = aiUsageDateTo ? new Date(`${aiUsageDateTo}T23:59:59`) : null;
    return actions.filter((entry) => {
      if (!entry?.createdAt) return !from && !to;
      const createdAt = new Date(entry.createdAt);
      if (Number.isNaN(createdAt.getTime())) return !from && !to;
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      return true;
    });
  }, [aiUsage?.recentActions, aiUsageDateFrom, aiUsageDateTo]);
  const aiUsageTotalPages = Math.max(1, Math.ceil(filteredAiActions.length / aiUsagePageSize));
  const safeAiUsagePage = Math.min(aiUsagePage, aiUsageTotalPages - 1);
  const aiUsagePageRows = useMemo(
    () => filteredAiActions.slice(safeAiUsagePage * aiUsagePageSize, safeAiUsagePage * aiUsagePageSize + aiUsagePageSize),
    [filteredAiActions, safeAiUsagePage, aiUsagePageSize]
  );
  const warnings = useMemo(() => usageWarnings(summary, usage, subscription), [summary, usage, subscription]);
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.planKey === summary?.planKey) || null,
    [plans, summary?.planKey]
  );
  const currentPlanHasAi = planFeatureEnabled(currentPlan, "ai");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setRefreshing(quiet);
    setError("");
    setBillingProfileError("");
    try {
      const [summaryResponse, ledgerResponse, aiUsageResponse, packageResponse, paymentsResponse, billingProfileResponse] = await Promise.all([
        api.get("/api/billing/summary"),
        api.get("/api/billing/ledger"),
        api.get("/api/billing/ai-usage"),
        api.get("/api/billing/topup-packages"),
        api.get("/api/billing/payments"),
        api.get("/api/tenant/billing-profile"),
      ]);
      const storagePackageResponse = await api.get("/api/billing/storage-packages");
      setSummary(summaryResponse.data);
      setLedger(Array.isArray(ledgerResponse.data) ? ledgerResponse.data : []);
      setLedgerPage(0);
      setAiUsage(aiUsageResponse.data || null);
      setAiUsagePage(0);
      setPackages(Array.isArray(packageResponse.data) ? packageResponse.data : []);
      setStoragePackages(Array.isArray(storagePackageResponse.data) ? storagePackageResponse.data : []);
      setPayments(Array.isArray(paymentsResponse.data) ? paymentsResponse.data : []);
      setBillingProfile(billingProfileResponse.data);
      setBillingProfileForm({
        billingCompanyName: billingProfileResponse.data?.billingCompanyName || "",
        billingGstin: billingProfileResponse.data?.billingGstin || "",
        billingAddress: billingProfileResponse.data?.billingAddress || "",
        billingCity: billingProfileResponse.data?.billingCity || "",
        billingState: billingProfileResponse.data?.billingState || "",
        billingPincode: billingProfileResponse.data?.billingPincode || "",
      });
    } catch (loadError) {
      setError(errorMessage(loadError, "Could not load billing details."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setAiUsagePage(0);
  }, [aiUsageDateFrom, aiUsageDateTo, aiUsagePageSize]);

  const saveBillingProfile = async () => {
    setBillingProfileError("");
    setBillingProfileSuccess("");
    try {
      const response = await api.post("/api/tenant/billing-profile", billingProfileForm);
      setBillingProfile(response.data);
      setBillingProfileSuccess("Billing profile saved for future invoices.");
    } catch (profileError) {
      setBillingProfileError(errorMessage(profileError, "Could not save billing profile."));
    }
  };

  const buyCredits = async (topupPackage) => {
    setError("");
    setSuccess("");
    setPurchasingKey(topupPackage.packageKey);
    try {
      await loadRazorpayScript();
      const orderResponse = await api.post("/api/billing/razorpay/credits/order", {
        packageKey: topupPackage.packageKey,
        promoCode: normalizedPromoCode(promoCode),
      });
      const order = orderResponse.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Vistaar Flow",
        description: `${formatCredits(order.credits)} credits`,
        order_id: order.razorpayOrderId,
        theme: { color: "#0f766e" },
        handler: async (response) => {
          try {
            await api.post("/api/billing/razorpay/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccess(`${formatCredits(order.credits)} credits added to your wallet.`);
            await load({ quiet: true });
          } catch (verifyError) {
            setError(errorMessage(verifyError, "Payment completed, but verification failed. Please contact support with your payment id."));
          }
        },
        modal: {
          ondismiss: () => setPurchasingKey(""),
        },
      });
      checkout.on("payment.failed", (response) => {
        setError(response?.error?.description || "Payment failed. Please try again.");
      });
      checkout.open();
    } catch (purchaseError) {
      setError(errorMessage(purchaseError, "Could not start Razorpay checkout."));
    } finally {
      setPurchasingKey("");
    }
  };

  const buyPlan = async (plan) => {
    setError("");
    setSuccess("");
    const purchaseKey = `PLAN_${plan.planKey}_${billingCycle}`;
    setPurchasingKey(purchaseKey);
    try {
      await loadRazorpayScript();
      const orderResponse = await api.post("/api/billing/razorpay/plans/order", {
        planKey: plan.planKey,
        billingCycle,
        promoCode: normalizedPromoCode(promoCode),
      });
      const order = orderResponse.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Vistaar Flow",
        description: `${plan.name} ${billingCycle.toLowerCase()} plan`,
        order_id: order.razorpayOrderId,
        theme: { color: "#0f766e" },
        handler: async (response) => {
          try {
            await api.post("/api/billing/razorpay/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccess(`${plan.name} ${billingCycle.toLowerCase()} plan activated. ${formatCredits(order.credits)} credits added.`);
            await load({ quiet: true });
          } catch (verifyError) {
            setError(errorMessage(verifyError, "Payment completed, but plan activation failed. Please contact support with your payment id."));
          }
        },
        modal: {
          ondismiss: () => setPurchasingKey(""),
        },
      });
      checkout.on("payment.failed", (response) => {
        setError(response?.error?.description || "Payment failed. Please try again.");
      });
      checkout.open();
    } catch (purchaseError) {
      setError(errorMessage(purchaseError, "Could not start Razorpay checkout."));
    } finally {
      setPurchasingKey("");
    }
  };

  const changeTrialPlan = async (plan) => {
    if (plan.planKey === summary?.planKey) return;
    setError("");
    setSuccess("");
    const purchaseKey = `TRIAL_${plan.planKey}`;
    setPurchasingKey(purchaseKey);
    try {
      const response = await api.post("/api/billing/trial/change-plan", { planKey: plan.planKey });
      setSummary(response.data);
      setSuccess(`${plan.name} enabled for your trial. Trial credits were not reset or added again.`);
      await load({ quiet: true });
    } catch (changeError) {
      setError(errorMessage(changeError, "Could not change trial plan."));
    } finally {
      setPurchasingKey("");
    }
  };

  const buyStorage = async (storagePackage) => {
    setError("");
    setSuccess("");
    const purchaseKey = `STORAGE_${storagePackage.packageKey}_${storageBillingCycle}`;
    setPurchasingKey(purchaseKey);
    try {
      await loadRazorpayScript();
      const orderResponse = await api.post("/api/billing/razorpay/storage/order", {
        packageKey: storagePackage.packageKey,
        billingCycle: storageBillingCycle,
        promoCode: normalizedPromoCode(promoCode),
      });
      const order = orderResponse.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Vistaar Flow",
        description: `${formatStorage(order.storageBytes)} storage add-on (${storageBillingCycle.toLowerCase()})`,
        order_id: order.razorpayOrderId,
        theme: { color: "#0f766e" },
        handler: async (response) => {
          try {
            await api.post("/api/billing/razorpay/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccess(`${formatStorage(order.storageBytes)} extra storage activated for ${order.periodMonths || (storageBillingCycle === "YEARLY" ? 12 : 1)} month${(order.periodMonths || 1) === 1 ? "" : "s"}.`);
            await load({ quiet: true });
          } catch (verifyError) {
            setError(errorMessage(verifyError, "Payment completed, but storage activation failed. Please contact support with your payment id."));
          }
        },
        modal: {
          ondismiss: () => setPurchasingKey(""),
        },
      });
      checkout.on("payment.failed", (response) => {
        setError(response?.error?.description || "Payment failed. Please try again.");
      });
      checkout.open();
    } catch (purchaseError) {
      setError(errorMessage(purchaseError, "Could not start Razorpay checkout."));
    } finally {
      setPurchasingKey("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center gap-2 bg-slate-50 p-6 text-slate-500">
        <Loader2 className="animate-spin" size={18} /> Loading billing...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Buy flexible credits, view usage, and track payments for this tenant.</p>
        </div>
        <button
          type="button"
          onClick={() => load({ quiet: true })}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}
      <SubscriptionBanner subscription={subscription} />
      <UsageWarnings warnings={warnings} />

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard icon={WalletCards} label="Available Credits" value={formatCredits(summary?.balanceCredits)} helper={`${summary?.balancePoints || 0} points`} />
        <MetricCard icon={CreditCard} label="Current Plan" value={summary?.planKey || "STARTER"} helper={`${summary?.subscriptionStatus || "TRIAL"} until ${formatDate(subscription.currentPeriodEnd || summary?.currentPeriodEnd)}`} />
        <MetricCard icon={History} label="Payment Records" value={payments.length} helper="Latest 100 shown" />
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <Gift size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-950">Promo / Coupon</h2>
              <p className="mt-1 text-sm text-slate-500">Enter a valid launch or offer code before buying credits, upgrading, or renewing a plan.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-[420px]">
            <input
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              placeholder="Example: LAUNCH20"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold uppercase outline-none focus:border-teal-400"
            />
            <button
              type="button"
              onClick={() => setPromoCode("")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
        {promoCode.trim() && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Coupon <span className="font-extrabold">{promoCode.trim()}</span> will be validated during checkout. If it is not valid for the selected plan/package, checkout will show the reason.
          </div>
        )}
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <HardDrive size={18} className="text-teal-700" />
          <h2 className="text-base font-extrabold text-slate-950">Plan Usage</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <UsageMeter label="Seats" used={usage.seatsUsed} limit={usage.seatsLimit} helper="Owner and agents count as seats." />
          <UsageMeter label="Contacts" used={usage.contactsUsed} limit={usage.contactsLimit} helper="Manual, imported, website, and WhatsApp leads." />
          <UsageMeter label="Pipelines" used={usage.pipelinesUsed} limit={usage.pipelinesLimit} helper="Separate sales journeys for your CRM." />
          <UsageMeter label="Storage" used={usage.storageUsedBytes} limit={usage.storageLimitBytes} helper="Media Library, email images, documents, and WhatsApp media." formatter={formatStorage} />
          <UsageMeter label="Tracked Call Minutes" used={usage.callMinutesUsedThisMonth} limit={usage.callMinutesLimit} helper="Answered third-party telephony calls tracked for reporting." />
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-teal-700" />
              <h2 className="text-base font-extrabold text-slate-950">Buy Extra Storage</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Add media storage without changing your CRM plan. Storage add-ons stay active for 12 months.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            <ShieldCheck size={14} /> Applies after payment verification
          </div>
        </div>
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {["MONTHLY", "YEARLY"].map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setStorageBillingCycle(cycle)}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${
                storageBillingCycle === cycle ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {cycle === "YEARLY" ? "Yearly - save 20%" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {storagePackages.map((storagePackage) => {
            const yearly = storageBillingCycle === "YEARLY";
            const price = yearly ? storagePackage.yearlyPricePaise : storagePackage.monthlyPricePaise;
            const purchaseKey = `STORAGE_${storagePackage.packageKey}_${storageBillingCycle}`;
            return (
              <article key={storagePackage.packageKey} className="flex min-h-[210px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-extrabold text-slate-950">{storagePackage.name}</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(price)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-teal-700">
                  <span>{formatStorage(storagePackage.storageBytes)} for {yearly ? "12 months" : "1 month"}</span>
                  {yearly && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">Save {storagePackage.yearlyDiscountPercent || 20}%</span>}
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-500">{storagePackage.description}</p>
                <button
                  type="button"
                  onClick={() => buyStorage(storagePackage)}
                  disabled={Boolean(purchasingKey)}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {purchasingKey === purchaseKey ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  Buy Storage
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <IndianRupee size={18} className="text-teal-700" />
              <h2 className="text-base font-extrabold text-slate-950">Buy Credits</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Customer still pays Meta directly for WhatsApp charges. These CRM credits cover CRM automation, campaigns, flow sending, and platform usage.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            <ShieldCheck size={14} /> Razorpay secure checkout
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((topupPackage) => (
            <article key={topupPackage.packageKey} className="flex min-h-[210px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-extrabold text-slate-950">{topupPackage.name}</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(topupPackage.amountPaise)}</div>
              <div className="mt-1 text-xs font-bold text-teal-700">{formatCredits(topupPackage.credits)} credits</div>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-500">{topupPackage.description}</p>
              <button
                type="button"
                onClick={() => buyCredits(topupPackage)}
                disabled={Boolean(purchasingKey)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {purchasingKey === topupPackage.packageKey ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Buy Now
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee size={18} className="text-teal-700" />
            <h2 className="text-base font-extrabold text-slate-950">Plans</h2>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {["MONTHLY", "YEARLY"].map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${
                  billingCycle === cycle ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {cycle === "YEARLY" ? "Yearly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const current = plan.planKey === summary?.planKey;
            const actionMeta = planActionMeta({ plan, currentPlan, subscription, billingCycle });
            const purchaseKey = subscription?.status === "TRIAL" ? `TRIAL_${plan.planKey}` : `PLAN_${plan.planKey}_${billingCycle}`;
            const yearly = billingCycle === "YEARLY";
            const price = yearly ? plan.yearlyPricePaise : plan.monthlyPricePaise;
            const credits = yearly ? plan.yearlyCredits : plan.monthlyCredits;
            const aiIncluded = planFeatureEnabled(plan, "ai");
            return (
            <article key={plan.planKey} className={`rounded-lg border p-4 ${plan.planKey === summary?.planKey ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-extrabold text-slate-950">{plan.name}</div>
                {current && <span className="rounded-full bg-white px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-teal-700">Current</span>}
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(price)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>{yearly ? "per year" : "per month"}</span>
                {yearly && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">Save {plan.yearlyDiscountPercent || 0}%</span>}
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>{formatCredits(credits)} credits included</p>
                <p>{plan.maxUsers} seats</p>
                <p>{plan.maxContacts?.toLocaleString()} contacts</p>
                <p>{plan.maxPipelines} pipelines</p>
                <p>{formatStorage(plan.storageLimitBytes)} media storage</p>
                <p>{plan.monthlyCallMinutes ? `${plan.monthlyCallMinutes.toLocaleString()} bundled call minutes / month` : "Unlimited third-party call tracking"}</p>
              </div>
              <div className={`mt-4 rounded-lg border px-3 py-2 text-xs font-bold leading-5 ${
                aiIncluded
                  ? "border-teal-200 bg-white text-teal-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                <div className="flex items-start gap-2">
                  <Sparkles size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {aiIncluded
                      ? "AI Summary and AI Reply are included. Successful AI actions use 0.25 credits."
                      : "AI Summary and AI Reply start from the Growth plan. Upgrade when your team is ready for AI-assisted follow-ups."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => subscription?.status === "TRIAL" ? changeTrialPlan(plan) : buyPlan(plan)}
                disabled={Boolean(purchasingKey) || actionMeta.disabled}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold ${
                  actionMeta.variant === "current"
                    ? "border border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
                    : actionMeta.variant === "downgrade"
                      ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                } disabled:opacity-60`}
              >
                {purchasingKey === purchaseKey ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {actionMeta.label}
              </button>
              <p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-slate-500">{actionMeta.helper}</p>
            </article>
          )})}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-teal-700" />
              <h2 className="text-base font-extrabold text-slate-950">Invoice Billing Profile</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">These details appear on receipts and future GST invoices.</p>
          </div>
          {billingProfile?.billingGstin && <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-700">GSTIN saved</span>}
        </div>
        {(billingProfileError || billingProfileSuccess) && (
          <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-semibold ${
            billingProfileError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {billingProfileError ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
            <span>{billingProfileError || billingProfileSuccess}</span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <ProfileInput label="Company Name" value={billingProfileForm.billingCompanyName} onChange={(value) => setBillingProfileForm((f) => ({ ...f, billingCompanyName: value }))} />
          <ProfileInput label="GSTIN" value={billingProfileForm.billingGstin} onChange={(value) => setBillingProfileForm((f) => ({ ...f, billingGstin: value.toUpperCase() }))} />
          <ProfileInput label="Pincode" value={billingProfileForm.billingPincode} onChange={(value) => setBillingProfileForm((f) => ({ ...f, billingPincode: value }))} />
          <ProfileInput label="City" value={billingProfileForm.billingCity} onChange={(value) => setBillingProfileForm((f) => ({ ...f, billingCity: value }))} />
          <ProfileInput label="State" value={billingProfileForm.billingState} onChange={(value) => setBillingProfileForm((f) => ({ ...f, billingState: value }))} />
          <label className="block text-sm font-semibold text-slate-700 md:col-span-3">Billing Address
            <textarea value={billingProfileForm.billingAddress} onChange={(event) => setBillingProfileForm((f) => ({ ...f, billingAddress: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          </label>
        </div>
        <button type="button" onClick={saveBillingProfile} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800">
          Save Billing Profile
        </button>
      </section>

      <section className="mt-5 rounded-lg border border-teal-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-950">AI Usage</h2>
              <p className="mt-1 text-sm text-slate-500">
                Track AI Summary, AI Reply, and AI Recommendation usage for this tenant.
              </p>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-xs font-bold ${
            currentPlanHasAi ? "border-teal-200 bg-teal-50 text-teal-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {currentPlanHasAi ? "AI is included in your current plan" : "AI starts from Growth plan"}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard icon={Sparkles} label="AI Actions This Month" value={formatCredits(aiUsage?.actionsThisMonth)} helper="Successful AI requests only" />
          <MetricCard icon={WalletCards} label="AI Credits Used" value={formatCredits(aiUsage?.creditsUsedThisMonth)} helper={`${aiUsage?.pointsUsedThisMonth || 0} points this month`} />
          <MetricCard icon={ShieldCheck} label="AI Rate" value="0.25" helper="credits per successful AI action" />
        </div>
        {!currentPlanHasAi && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Upgrade to Growth or higher to unlock AI Summary, AI Reply, and AI Recommendation tools.
          </div>
        )}
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm" style={{ minWidth: "680px" }}>
            <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Actions This Month</th>
                <th className="px-4 py-3">Credits Used</th>
                <th className="px-4 py-3">Last AI Action</th>
              </tr>
            </thead>
            <tbody>
              {(aiUsage?.usageByUser || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No agent AI usage this month.</td>
                </tr>
              )}
              {(aiUsage?.usageByUser || []).map((entry) => (
                <tr key={entry.userId || entry.userEmail} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-slate-800">{entry.userEmail || `User ${entry.userId}`}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCredits(entry.actionsThisMonth)}</td>
                  <td className="px-4 py-3 font-extrabold text-red-600">{formatCredits(entry.creditsUsedThisMonth)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.lastActionAt ? new Date(entry.lastActionAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950">AI Action History</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Filter usage by date and review charges page by page.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[560px]">
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              From
              <input
                type="date"
                value={aiUsageDateFrom}
                onChange={(event) => setAiUsageDateFrom(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-teal-400"
              />
            </label>
            <label className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              To
              <input
                type="date"
                value={aiUsageDateTo}
                onChange={(event) => setAiUsageDateTo(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none focus:border-teal-400"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAiUsageDateFrom("");
                setAiUsageDateTo("");
              }}
              className="mt-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 sm:mt-6"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm" style={{ minWidth: "720px" }}>
            <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">AI Action</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {aiUsagePageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No AI actions found for this date range.</td>
                </tr>
              )}
              {aiUsagePageRows.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{aiPurposeLabel(entry.referenceId)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.userId || "-"}</td>
                  <td className="px-4 py-3 font-extrabold text-red-600">{formatCredits(Math.abs(Number(entry.creditsChange || 0)))}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCredits(entry.balanceAfterCredits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-500">
            Showing {filteredAiActions.length === 0 ? 0 : safeAiUsagePage * aiUsagePageSize + 1}
            -{Math.min((safeAiUsagePage + 1) * aiUsagePageSize, filteredAiActions.length)} of {filteredAiActions.length} AI actions
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={aiUsagePageSize}
              onChange={(event) => setAiUsagePageSize(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <button
              type="button"
              disabled={safeAiUsagePage <= 0}
              onClick={() => setAiUsagePage((page) => Math.max(0, page - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 text-sm font-bold text-slate-500">
              Page {filteredAiActions.length === 0 ? 0 : safeAiUsagePage + 1} of {filteredAiActions.length === 0 ? 0 : aiUsageTotalPages}
            </span>
            <button
              type="button"
              disabled={safeAiUsagePage + 1 >= aiUsageTotalPages || filteredAiActions.length === 0}
              onClick={() => setAiUsagePage((page) => Math.min(aiUsageTotalPages - 1, page + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-950">Usage Pricing</h2>
          <p className="mt-1 text-sm text-slate-500">Rules can be changed later for offers without code changes.</p>
          <div className="mt-4 space-y-2">
            {pricingRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{rule.eventType}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-teal-700">{formatCredits(rule.credits)} credits</span>
                </div>
                {rule.description && <p className="mt-1 text-xs text-slate-500">{rule.description}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <DataTable
            title="Payment History"
            empty="No payments yet"
            minWidth="760px"
            headers={["Date", "Type", "Cycle", "Package / Plan", "Amount", "Entitlement", "Status", "Payment"]}
            rows={payments.map((payment) => [
              payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "-",
              payment.orderType || "-",
              payment.billingCycle || "-",
              payment.packageKey || "-",
              formatCurrency(payment.amountPaise),
              paymentEntitlement(payment),
              <StatusPill key="status" status={payment.status} />,
              <div key="payment" className="space-y-2">
                <div>{payment.razorpayPaymentId || payment.razorpayOrderId || "-"}</div>
                {payment.status === "PAID" && (
                  <button type="button" onClick={() => setSelectedReceipt(payment)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-teal-700 hover:bg-teal-50">
                    <FileText size={13} /> Receipt
                  </button>
                )}
              </div>,
            ])}
          />

          <DataTable
            title="Receipts"
            empty="No paid receipts yet"
            minWidth="760px"
            headers={["Receipt", "Date", "Item", "Invoice", "Original", "Discount", "Paid", "Payment"]}
            rows={paidPayments.map((payment) => [
              `CRM-${payment.id}`,
              payment.updatedAt ? new Date(payment.updatedAt).toLocaleString() : "-",
              receiptItemName(payment),
              payment.invoiceNumber || "-",
              formatCurrency(payment.originalAmountPaise || payment.amountPaise),
              payment.discountAmountPaise ? `${formatCurrency(payment.discountAmountPaise)}${payment.promoCode ? ` (${payment.promoCode})` : ""}` : "-",
              formatCurrency(payment.amountPaise),
              <button key="receipt" type="button" onClick={() => setSelectedReceipt(payment)} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-800">
                <FileText size={13} /> View
              </button>,
            ])}
          />

          <DataTable
            title="Credit Ledger"
            empty="No usage yet"
            minWidth="720px"
            headers={["Date", "Reason", "Change", "Balance", "Reference"]}
            rows={ledgerPageRows.map((entry) => [
              entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-",
              entry.reason,
              <span key="change" className={`font-extrabold ${Number(entry.creditsChange) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                {Number(entry.creditsChange) > 0 ? "+" : ""}{formatCredits(entry.creditsChange)}
              </span>,
              formatCredits(entry.balanceAfterCredits),
              entry.referenceId || "-",
            ])}
          />
          <div className="-mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-slate-500">
              Showing {ledger.length === 0 ? 0 : safeLedgerPage * ledgerPageSize + 1}
              -{Math.min((safeLedgerPage + 1) * ledgerPageSize, ledger.length)} of {ledger.length} ledger entries
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ledgerPageSize}
                onChange={(event) => {
                  setLedgerPageSize(Number(event.target.value));
                  setLedgerPage(0);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
              <button
                type="button"
                disabled={safeLedgerPage <= 0}
                onClick={() => setLedgerPage((page) => Math.max(0, page - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 text-sm font-bold text-slate-500">
                Page {ledger.length === 0 ? 0 : safeLedgerPage + 1} of {ledger.length === 0 ? 0 : ledgerTotalPages}
              </span>
              <button
                type="button"
                disabled={safeLedgerPage + 1 >= ledgerTotalPages || ledger.length === 0}
                onClick={() => setLedgerPage((page) => Math.min(ledgerTotalPages - 1, page + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
      {selectedReceipt && <ReceiptModal payment={selectedReceipt} billingProfile={billingProfile} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
}

function normalizedPromoCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function aiPurposeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const labels = {
    contact_summary: "Contact Summary",
    contact_recommendation: "Lead Score / Follow-up Recommendation",
    ai_reply: "AI Reply",
    manual_test: "Manual Test Prompt",
    connection_test: "Connection Test",
  };
  return labels[normalized] || value || "AI Action";
}

function usageWarnings(summary, usage, subscription) {
  const warnings = [];
  const credits = Number(summary?.balanceCredits || 0);
  if (credits > 0 && credits <= 100) {
    warnings.push({ key: "credits-low", title: "Credits are running low", body: `${formatCredits(credits)} credits left. Top up before campaigns or automation stop.` });
  }
  if (credits <= 0) {
    warnings.push({ key: "credits-empty", title: "No credits available", body: "Add credits to send paid WhatsApp actions, campaigns, and flows." });
  }

  [
    ["Seats", usage?.seatsUsed, usage?.seatsLimit],
    ["Contacts", usage?.contactsUsed, usage?.contactsLimit],
    ["Pipelines", usage?.pipelinesUsed, usage?.pipelinesLimit],
    ["Storage", usage?.storageUsedBytes, usage?.storageLimitBytes, formatStorage],
    ["Call minutes", usage?.callMinutesUsedThisMonth, usage?.callMinutesLimit],
  ].forEach(([label, used, limit, formatter]) => {
    const safeUsed = Number(used || 0);
    const safeLimit = Number(limit || 0);
    const display = formatter || formatCredits;
    if (safeLimit > 0 && safeUsed >= safeLimit) {
      warnings.push({ key: `${label}-full`, title: `${label} limit reached`, body: `${display(safeUsed)} of ${display(safeLimit)} used. Upgrade to continue adding more.` });
    } else if (safeLimit > 0 && safeUsed / safeLimit >= 0.8) {
      warnings.push({ key: `${label}-near`, title: `${label} near limit`, body: `${display(safeUsed)} of ${display(safeLimit)} used. Plan ahead before the limit blocks work.` });
    }
  });

  const daysUntilEnd = Number(subscription?.daysUntilPeriodEnd);
  if ((subscription?.status === "ACTIVE" || subscription?.status === "TRIAL") && Number.isFinite(daysUntilEnd) && daysUntilEnd >= 0 && daysUntilEnd <= 7) {
    warnings.push({ key: "renewal", title: "Renewal coming soon", body: `${subscription.status === "TRIAL" ? "Trial" : "Plan"} expires on ${formatDate(subscription.currentPeriodEnd)}.` });
  }
  return warnings;
}

function UsageWarnings({ warnings }) {
  if (!warnings.length) return null;
  return (
    <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {warnings.map((warning) => (
        <article key={warning.key} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-extrabold">{warning.title}</p>
              <p className="mt-1 text-sm font-semibold leading-6">{warning.body}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ReceiptModal({ payment, billingProfile, onClose }) {
  const hasBillingProfile = Boolean(
    billingProfile?.billingCompanyName
      || billingProfile?.billingGstin
      || billingProfile?.billingAddress
      || billingProfile?.billingCity
      || billingProfile?.billingState
      || billingProfile?.billingPincode
  );

  return (
    <div className="receipt-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body * {
            visibility: hidden !important;
          }
          .receipt-print-area,
          .receipt-print-area * {
            visibility: visible !important;
          }
          .receipt-modal {
            position: static !important;
            inset: auto !important;
            display: block !important;
            padding: 0 !important;
            background: white !important;
          }
          .receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .receipt-no-print {
            display: none !important;
          }
          .receipt-print-content {
            padding: 0 !important;
          }
          .receipt-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="receipt-print-area max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-teal-700">Receipt</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-950">{payment.invoiceNumber || `CRM-${payment.id}`}</h2>
            <p className="mt-1 text-sm text-slate-500">{payment.updatedAt ? new Date(payment.updatedAt).toLocaleString() : "-"}</p>
          </div>
          <button type="button" onClick={onClose} className="receipt-no-print rounded-lg border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50">Close</button>
        </div>
        <div className="receipt-print-content p-5">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="receipt-print-card rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Billed To</p>
              {hasBillingProfile ? (
                <div className="mt-2 space-y-1 text-sm font-semibold leading-6 text-slate-800">
                  <p className="text-base font-extrabold text-slate-950">{billingProfile.billingCompanyName || "Billing profile"}</p>
                  {billingProfile.billingGstin && <p>GSTIN: {billingProfile.billingGstin}</p>}
                  {billingProfile.billingAddress && <p>{billingProfile.billingAddress}</p>}
                  <p>
                    {[billingProfile.billingCity, billingProfile.billingState, billingProfile.billingPincode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-amber-700">
                  Billing profile not saved. Add company/GST details before printing invoice PDF.
                </p>
              )}
            </div>
            <div className="receipt-print-card rounded-lg border border-teal-100 bg-teal-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-teal-700">Invoice Note</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-teal-900">
                The details in “Billed To” come from Invoice Billing Profile and will appear when using Print / Save PDF.
              </p>
            </div>
          </div>
          <div className="receipt-print-card rounded-lg border border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReceiptRow label="Item" value={receiptItemName(payment)} />
              <ReceiptRow label="Invoice number" value={payment.invoiceNumber || "-"} />
              <ReceiptRow label="Invoice issued" value={payment.invoiceIssuedAt ? new Date(payment.invoiceIssuedAt).toLocaleString() : "-"} />
              <ReceiptRow label="Status" value={payment.status} />
              <ReceiptRow label="Billing cycle" value={payment.billingCycle || "-"} />
              <ReceiptRow label="Entitlement" value={paymentEntitlement(payment)} />
              <ReceiptRow label="Razorpay order" value={payment.razorpayOrderId || "-"} />
              <ReceiptRow label="Razorpay payment" value={payment.razorpayPaymentId || "-"} />
            </div>
          </div>
          <div className="receipt-print-card mt-4 rounded-lg border border-slate-200 p-4">
            <ReceiptAmount label="Original amount" value={formatCurrency(payment.originalAmountPaise || payment.amountPaise)} />
            <ReceiptAmount label={payment.promoCode ? `Discount (${payment.promoCode})` : "Discount"} value={payment.discountAmountPaise ? `-${formatCurrency(payment.discountAmountPaise)}` : "-"} />
            <ReceiptAmount label="Taxable value" value={formatCurrency(payment.taxableAmountPaise || 0)} />
            <ReceiptAmount label={`GST ${payment.gstPercent || 18}%`} value={formatCurrency(payment.taxAmountPaise || 0)} />
            <div className="mt-3 border-t border-slate-200 pt-3">
              <ReceiptAmount label="Paid amount" value={formatCurrency(payment.amountPaise)} strong />
            </div>
          </div>
          {payment.errorMessage && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{payment.errorMessage}</div>}
          <button type="button" onClick={() => window.print()} className="receipt-no-print mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800">
            <FileText size={16} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }) {
  return <div><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-900">{value || "-"}</p></div>;
}

function ReceiptAmount({ label, value, strong = false }) {
  return <div className="flex items-center justify-between gap-4 py-1"><span className="text-sm font-bold text-slate-500">{label}</span><span className={`${strong ? "text-xl" : "text-sm"} font-extrabold text-slate-950`}>{value}</span></div>;
}

function receiptItemName(payment) {
  if (payment.orderType === "PLAN_SUBSCRIPTION") {
    return `${payment.packageKey || "Plan"} plan`;
  }
  if (payment.orderType === "STORAGE_ADDON") {
    return `${payment.packageKey || "Storage"} add-on`;
  }
  return payment.packageKey || "Credit top-up";
}

function paymentEntitlement(payment) {
  if (payment?.orderType === "STORAGE_ADDON") {
    return `${formatStorage(payment.storageBytes)} storage`;
  }
  return `${formatCredits(payment?.credits)} credits`;
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function ProfileInput({ label, value, onChange }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-400" />
    </label>
  );
}

function SubscriptionBanner({ subscription }) {
  const status = subscription?.status;
  if (!status) return null;
  const daysUntilEnd = Number(subscription.daysUntilPeriodEnd);
  const daysUntilGraceEnd = Number(subscription.daysUntilGraceEnd);
  const periodEnd = formatDate(subscription.currentPeriodEnd);
  const graceEnd = formatDate(subscription.graceEndsAt);

  if (status === "EXPIRED") {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        <div className="flex gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>Your plan expired on {periodEnd}. Renew your plan to create new records or run paid actions.</span>
        </div>
      </div>
    );
  }

  if (status === "GRACE") {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        <div className="flex gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>Your plan expired on {periodEnd}. Grace period ends on {graceEnd}. Renew before then to avoid interruption.</span>
        </div>
      </div>
    );
  }

  if (status === "ACTIVE" && Number.isFinite(daysUntilEnd) && daysUntilEnd >= 0 && daysUntilEnd <= 7) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        <div className="flex gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>Plan expires on {periodEnd}. {daysUntilEnd === 0 ? "Renew today to stay uninterrupted." : `${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"} remaining.`}</span>
        </div>
      </div>
    );
  }

  if (status === "TRIAL") {
    return (
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
        <div className="flex gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <span>Trial mode: you can switch plans to test features until {periodEnd}. Trial credits are capped and will not be added again when switching plans.</span>
        </div>
      </div>
    );
  }

  return null;
}

function UsageMeter({ label, used = 0, limit = 0, helper, formatter = formatCredits }) {
  const safeUsed = Number(used || 0);
  const safeLimit = Number(limit || 0);
  const hasLimit = safeLimit > 0;
  const percent = hasLimit ? Math.min(100, Math.round((safeUsed / safeLimit) * 100)) : 0;
  const warning = percent >= 80 && percent < 100;
  const full = percent >= 100;
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-slate-950">{label}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${full ? "bg-red-50 text-red-700" : warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          {formatter(safeUsed)} / {hasLimit ? formatter(safeLimit) : "Unlimited"}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${full ? "bg-red-500" : warning ? "bg-amber-500" : "bg-teal-600"}`} style={{ width: `${percent}%` }} />
      </div>
      <p className={`mt-2 text-xs font-semibold ${full ? "text-red-600" : warning ? "text-amber-700" : "text-slate-500"}`}>
        {!hasLimit ? "Reporting only. Provider billing is separate." : full ? "Limit reached. Upgrade to continue." : warning ? "Near limit. Plan upgrade may be needed soon." : `${percent}% used`}
      </p>
    </article>
  );
}

function DataTable({ title, empty, minWidth, headers, rows }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="bg-slate-50 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-400">{empty}</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const value = status || "CREATED";
  const paid = value === "PAID";
  const failed = value === "FAILED";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${
      paid ? "bg-emerald-50 text-emerald-700" : failed ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
    }`}>
      {paid && <CheckCircle2 size={13} />}
      {value}
    </span>
  );
}
