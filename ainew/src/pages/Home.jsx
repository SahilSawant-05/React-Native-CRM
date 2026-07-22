import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  GitBranch,
  Globe2,
  Mail,
  MessageCircle,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import logo from "../assets/vistaar-flow-logo.png";

const packages = [
  {
    name: "Starter",
    price: "₹499",
    note: "for lean teams",
    credits: "500 credits / month",
    limits: ["1 owner + agent seat", "500 contacts", "1 pipeline", "Website lead capture"],
    ai: false,
  },
  {
    name: "Growth",
    price: "₹999",
    note: "most small businesses",
    credits: "2,000 credits / month",
    limits: ["3 seats", "5,000 contacts", "5 pipelines", "Automation + WhatsApp Flows"],
    ai: true,
    featured: true,
  },
  {
    name: "Pro",
    price: "₹1,999",
    note: "high-volume sales",
    credits: "7,500 credits / month",
    limits: ["10 seats", "25,000 contacts", "15 pipelines", "Reports and advanced workflows"],
    ai: true,
  },
  {
    name: "Agency",
    price: "₹4,999",
    note: "multi-team operations",
    credits: "25,000 credits / month",
    limits: ["25 seats", "100,000 contacts", "50 pipelines", "Priority support"],
    ai: true,
  },
];

const workflows = [
  ["Capture", "Website forms, WhatsApp, CSV import, manual leads, and Meta Flow submissions enter one CRM."],
  ["Qualify", "Assign leads by source, city, pipeline, round-robin rules, or owner action."],
  ["Convert", "Move opportunities across pipelines, book visits or demos, send email and WhatsApp follow-ups."],
  ["Measure", "Track source performance, campaign delivery, agent work, appointment outcome, and billing usage."],
];

const useCases = [
  {
    title: "Real estate teams",
    body: "Manage buyers, budgets, site visits, property catalog items, multiple property interests, and follow-up tasks from one opportunity timeline.",
  },
  {
    title: "Education institutes",
    body: "Capture course enquiries, map interest, assign counsellors, schedule demos, and automate reminders across email and WhatsApp.",
  },
  {
    title: "Bike, car, and product sales",
    body: "Track test rides, inventory/catalog items, customer intent, quotation follow-ups, and deal stages without forcing one rigid industry setup.",
  },
  {
    title: "Generic small business CRM",
    body: "Create your own pipelines, catalog type, custom fields, lead sources, templates, flows, and automation rules as your business grows.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Vistaar Flow" className="h-11 w-11 rounded-lg object-contain" />
            <div>
              <div className="text-lg font-black tracking-tight text-slate-950">Vistaar Flow</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">CRM & Growth Platform</div>
            </div>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#platform" className="hover:text-teal-700">Platform</a>
            <a href="#industries" className="hover:text-teal-700">Industries</a>
            <a href="#pricing" className="hover:text-teal-700">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Login</Link>
            <Link to="/signup" className="hidden rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-800 sm:inline-flex">Start Free</Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-white pt-24">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
          <img src={logo} alt="" className="absolute right-10 top-20 h-[560px] w-[560px] object-contain opacity-10" />
        </div>
        <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-teal-800">
              <Sparkles size={14} /> AI-powered CRM & growth platform
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Vistaar Flow
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-semibold leading-8 text-slate-700">
              AI-Powered CRM & Growth Platform for Modern Businesses.
            </p>
            <p className="mt-3 max-w-2xl text-2xl font-black leading-8 text-slate-950">
              Expand. Automate. Grow. Where Every Lead Moves Forward.
            </p>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">
              Turn website leads, WhatsApp chats, email, appointments, campaigns, and opportunities into one simple sales flow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 py-3 text-base font-extrabold text-white shadow-lg shadow-teal-900/10 hover:bg-teal-800">
                Start your CRM <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-extrabold text-slate-800 hover:bg-slate-50">
                Open dashboard <ChevronRight size={18} />
              </Link>
            </div>
            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              <Proof label="Lead response" value="Faster" />
              <Proof label="Pipeline setup" value="Flexible" />
              <Proof label="Channels" value="WhatsApp + Email" />
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-2xl shadow-slate-950/20">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-bold text-slate-400">vistaarflow.app/dashboard</span>
              </div>
              <div className="rounded-lg bg-white p-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <img src={logo} alt="Vistaar Flow" className="h-12 w-12 rounded-lg object-contain" />
                  <div>
                    <div className="text-sm font-black text-slate-950">Today’s sales flow</div>
                    <div className="text-xs font-semibold text-slate-500">Real-time CRM summary</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniMetric icon={Users} label="New leads" value="128" tone="teal" />
                  <MiniMetric icon={MessageCircle} label="Unread chats" value="34" tone="blue" />
                  <MiniMetric icon={CalendarCheck} label="Visits booked" value="18" tone="emerald" />
                  <MiniMetric icon={BarChart3} label="Won pipeline" value="₹8.4L" tone="slate" />
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">Opportunity pipeline</span>
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-extrabold text-teal-700">Live</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {["New", "Qualified", "Visit", "Won"].map((stage, index) => (
                      <div key={stage} className="rounded-lg bg-slate-50 p-2">
                        <div className="text-xs font-extrabold text-slate-500">{stage}</div>
                        <div className="mt-2 h-16 rounded-md bg-white p-2 shadow-sm">
                          <div className="h-2 w-3/4 rounded-full bg-teal-500" />
                          <div className="mt-2 h-2 w-1/2 rounded-full bg-slate-200" />
                          <div className="mt-2 text-[10px] font-bold text-slate-400">{[42, 31, 17, 9][index]} deals</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-slate-200 bg-[#eef7fb] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="One CRM, every flow" title="Everything your team needs after a lead says hello." body="Vistaar Flow keeps conversations, tasks, appointments, opportunities, campaigns, and billing in one connected workspace." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Feature icon={MessageCircle} title="WhatsApp-first inbox" body="Receive, reply, send templates, use media, and connect every chat to contact and opportunity history." />
            <Feature icon={Mail} title="Email workspace" body="Sync Gmail/domain inbox, compose from templates, and keep email activity visible inside the sales timeline." />
            <Feature icon={GitBranch} title="Multiple pipelines" body="Use separate pipelines for sales, site visits, admissions, test rides, or any process your business needs." />
            <Feature icon={Workflow} title="Automation builder" body="Use triggers, conditions, assignments, tasks, stage movement, notifications, and workflow rules." />
            <Feature icon={Globe2} title="Website lead widget" body="Paste one script on any website and capture forms into the correct tenant, source, owner, and pipeline." />
            <Feature icon={MousePointerClick} title="WhatsApp Flows" body="Build or sync Meta flows, map submissions into contacts and opportunities, and follow up instantly." />
            <Feature icon={Database} title="Flexible catalog" body="Create properties, courses, vehicles, products, or any custom catalog type and map it to opportunities." />
            <Feature icon={FileText} title="Billing and credits" body="Plans, credits, Razorpay payments, receipts, GST profile, coupons, and super-admin controls are included." />
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="How it works" title="A cleaner path from enquiry to revenue." body="Your team does not need to remember where each lead came from. The flow keeps moving." />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {workflows.map(([title, body], index) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">{index + 1}</div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="industries" className="bg-[#07152f] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle dark eyebrow="Industry-ready, not industry-locked" title="Start fast with templates. Adapt freely as you grow." body="Vistaar Flow gives structure for common businesses while keeping pipelines, fields, catalogs, and templates flexible." />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {useCases.map((item) => (
              <div key={item.title} className="rounded-lg border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle eyebrow="Simple packages" title="Low-cost CRM plans for small businesses." body="Customer pays Meta directly for WhatsApp usage. Vistaar Flow credits cover CRM automation, campaigns, flows, and platform usage." />
          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {packages.map((plan) => (
              <article key={plan.name} className={`rounded-lg border p-5 shadow-sm ${plan.featured ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}>
                {plan.featured && <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-teal-700">Recommended</div>}
                <h3 className="text-xl font-black text-slate-950">{plan.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{plan.note}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-black text-slate-950">{plan.price}</span>
                  <span className="pb-1 text-sm font-bold text-slate-500">/month</span>
                </div>
                <p className="mt-2 text-sm font-extrabold text-teal-700">{plan.credits}</p>
                <div className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${
                  plan.ai
                    ? "border-teal-200 bg-white text-teal-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={15} />
                    {plan.ai ? "AI Summary & AI Reply included" : "AI tools available from Growth plan"}
                  </span>
                </div>
                <ul className="mt-5 space-y-3">
                  {plan.limits.map((item) => (
                    <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-slate-700">
                      <Check size={16} className="mt-1 shrink-0 text-teal-700" /> {item}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-extrabold ${plan.featured ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
                  Choose {plan.name}
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-sm font-semibold text-slate-500">Yearly plans can include discount offers through Vistaar Flow promo codes.</p>
        </div>
      </section>

      <section className="bg-[#eef7fb] py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-white shadow-sm">
            <Bot className="text-teal-700" size={30} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">Ready to make your sales flow visible?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">
            Start with a simple setup, import your leads, connect WhatsApp and email, then let your team work from one CRM.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 py-3 text-base font-extrabold text-white hover:bg-teal-800">
              Create account <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-extrabold text-slate-800 hover:bg-slate-50">
              Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Vistaar Flow" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <div className="font-black text-slate-950">Vistaar Flow</div>
              <div className="text-xs font-semibold text-slate-500">Expand. Automate. Grow. Where Every Lead Moves Forward.</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Vistaar Flow is an app by{" "}
                <a
                  href="https://techoceanhub.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-extrabold text-teal-700 hover:text-teal-800"
                >
                  Techoceanhub Private Limited
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-500">
            <a href="#platform" className="hover:text-teal-700">Platform</a>
            <a href="#industries" className="hover:text-teal-700">Industries</a>
            <a href="#pricing" className="hover:text-teal-700">Pricing</a>
            <Link to="/privacy-policy" className="hover:text-teal-700">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-teal-700">Terms</Link>
            <Link to="/login" className="hover:text-teal-700">Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({ eyebrow, title, body, dark = false }) {
  return (
    <div className="max-w-3xl">
      <p className={`text-sm font-black uppercase tracking-[0.22em] ${dark ? "text-teal-300" : "text-teal-700"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight sm:text-5xl ${dark ? "text-white" : "text-slate-950"}`}>{title}</h2>
      <p className={`mt-4 text-lg font-semibold leading-8 ${dark ? "text-slate-300" : "text-slate-600"}`}>{body}</p>
    </div>
  );
}

function Proof({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, tone }) {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold text-slate-500">{label}</span>
        <span className={`rounded-lg p-1.5 ${colors[tone] || colors.teal}`}><Icon size={15} /></span>
      </div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{body}</p>
    </article>
  );
}
