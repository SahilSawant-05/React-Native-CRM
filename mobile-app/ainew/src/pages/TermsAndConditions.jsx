import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import logo from "../assets/vistaar-flow-logo.png";

const sections = [
  {
    title: "1. Acceptance Of Terms",
    body: [
      "By accessing or using Vistaar Flow, you agree to these Terms & Conditions and any policies referenced here, including our Privacy Policy.",
      "If you use Vistaar Flow on behalf of a business, you confirm that you are authorised to accept these Terms for that business.",
      "If you do not agree with these Terms, you should not use the application or services.",
    ],
  },
  {
    title: "2. Product And Company",
    body: [
      "Vistaar Flow is a CRM and growth platform owned and operated by Techoceanhub Private Limited.",
      "References to “Company”, “we”, “us”, or “our” mean Techoceanhub Private Limited.",
      "References to “App”, “Platform”, “Product”, or “Vistaar Flow” mean the CRM software, website, APIs, integrations, widgets, and related services provided by us.",
    ],
  },
  {
    title: "3. Account Registration And Access",
    body: [
      "You must provide accurate account, business, billing, and contact information.",
      "You are responsible for keeping login credentials secure and for all activity under your account.",
      "Owners and admins are responsible for creating users, assigning roles, controlling access, and removing users who no longer need access.",
    ],
  },
  {
    title: "4. Permitted Use",
    body: [
      "You may use Vistaar Flow for lawful business CRM activities, including lead capture, contact management, pipeline management, communication, campaigns, automation, reporting, and billing.",
      "You must not use Vistaar Flow for unlawful, fraudulent, abusive, harmful, misleading, spam, harassment, or unauthorised communication activities.",
      "You must not attempt to disrupt, reverse engineer, overload, bypass security controls, or gain unauthorised access to the platform or another customer’s data.",
    ],
  },
  {
    title: "5. Customer Data And Consent",
    body: [
      "You remain responsible for the data you upload, import, collect, or process through Vistaar Flow, including leads, contacts, messages, files, and campaign data.",
      "You must obtain required consent and permissions from your customers, leads, users, and website visitors before collecting or contacting them through WhatsApp, email, phone, Meta Lead Ads, forms, or other channels.",
      "You must ensure your communications follow applicable Indian laws, platform policies, telecom rules, anti-spam expectations, and any other rules applicable to your business.",
    ],
  },
  {
    title: "6. Integrations And Third-Party Services",
    body: [
      "Vistaar Flow may connect with third-party services such as Meta, WhatsApp Cloud API, Gmail, email providers, payment gateways, hosting, storage, AI providers, and website tools.",
      "Your use of third-party services is also governed by their own terms, pricing, permissions, limits, and policies.",
      "We are not responsible for failures, suspensions, policy changes, pricing changes, downtime, rejected templates, API limits, or account restrictions caused by third-party platforms.",
    ],
  },
  {
    title: "7. Payments, Credits, Plans, And Billing",
    body: [
      "Subscription plans, included credits, add-ons, storage limits, user limits, and feature availability may vary by plan.",
      "Credits may be consumed for billable platform actions such as WhatsApp messages, campaigns, flows, AI actions, or other usage-based events shown in the product or pricing page.",
      "Fees are payable in advance unless otherwise agreed. Taxes, gateway charges, refunds, renewals, cancellations, and invoices will follow the plan and billing rules applicable at the time of purchase.",
    ],
  },
  {
    title: "8. AI Features",
    body: [
      "AI features are provided to assist with summaries, replies, recommendations, mapping suggestions, campaign copy, lead scoring, and similar productivity use cases.",
      "AI output may be incomplete, inaccurate, or unsuitable for a particular situation. You must review and approve AI-generated content before using it with customers.",
      "You are responsible for ensuring AI usage complies with your business policies, consent obligations, and applicable laws.",
    ],
  },
  {
    title: "9. Service Availability And Changes",
    body: [
      "We aim to provide a reliable service, but we do not guarantee uninterrupted, error-free, or always-available access.",
      "We may update, improve, suspend, limit, or discontinue features for maintenance, security, legal compliance, platform changes, or business reasons.",
      "We may modify these Terms from time to time. Continued use after updates means you accept the revised Terms.",
    ],
  },
  {
    title: "10. Suspension And Termination",
    body: [
      "We may suspend or terminate access if we believe there is misuse, non-payment, legal risk, security risk, policy violation, or breach of these Terms.",
      "You may stop using the service or request account closure, subject to billing obligations, data retention requirements, backup cycles, and applicable law.",
    ],
  },
  {
    title: "11. Limitation Of Liability",
    body: [
      "To the maximum extent permitted by law, Techoceanhub Private Limited will not be liable for indirect, incidental, special, consequential, punitive, or loss-of-profit damages.",
      "Our aggregate liability for claims relating to Vistaar Flow will be limited to the amount paid by you for the service during the three months before the event giving rise to the claim, unless applicable law requires otherwise.",
    ],
  },
  {
    title: "12. Governing Law And Disputes",
    body: [
      "These Terms are governed by the laws of India.",
      "Subject to applicable law, courts in India having appropriate jurisdiction over Techoceanhub Private Limited will have jurisdiction for disputes relating to these Terms or Vistaar Flow.",
      "Before filing a formal dispute, both parties should try to resolve the issue in good faith through written communication.",
    ],
  },
];

export default function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Vistaar Flow" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <div className="font-black text-slate-950">Vistaar Flow</div>
              <div className="text-xs font-semibold text-slate-500">An app by Techoceanhub Private Limited</div>
            </div>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={16} /> Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <FileText size={28} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-teal-700">Terms & Conditions</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Terms & Conditions for Vistaar Flow
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
            These Terms & Conditions govern your access to and use of Vistaar Flow, a CRM and growth platform owned and operated by Techoceanhub Private Limited.
          </p>
          <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 sm:grid-cols-2">
            <div><span className="font-black text-slate-950">App:</span> Vistaar Flow</div>
            <div><span className="font-black text-slate-950">Parent company:</span> Techoceanhub Private Limited</div>
            <div><span className="font-black text-slate-950">Effective date:</span> 03 July 2026</div>
            <div><span className="font-black text-slate-950">Website:</span> techoceanhub.com</div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.body.map((item) => (
                  <li key={item} className="flex gap-3 text-sm font-semibold leading-7 text-slate-600">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-950">13. Contact</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
              For questions about these Terms, contact Techoceanhub Private Limited at{" "}
              <a href="mailto:support@techoceanhub.com" className="font-black text-teal-700 hover:text-teal-800">
                support@techoceanhub.com
              </a>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-900">
          </section>
        </div>
      </section>
    </main>
  );
}
