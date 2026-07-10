import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import logo from "../assets/vistaar-flow-logo.png";

const sections = [
  {
    title: "1. Information We Collect",
    body: [
      "Account information such as name, business name, email address, mobile number, billing details, user role, and login activity.",
      "CRM data uploaded or created by customers, including contacts, leads, opportunities, tasks, notes, emails, WhatsApp messages, campaign records, forms, files, and media.",
      "Integration data required to connect services such as WhatsApp Cloud API, Meta Lead Ads, Gmail, email providers, payment gateways, website widgets, and similar business tools.",
      "Technical information such as IP address, device/browser details, cookies, session data, logs, usage events, error reports, and security audit records.",
    ],
  },
  {
    title: "2. How We Use Information",
    body: [
      "To provide, operate, secure, and improve Vistaar Flow CRM and related services.",
      "To create and manage leads, contacts, opportunities, campaigns, tasks, automations, reports, billing, and customer support requests.",
      "To send service notifications, security alerts, product updates, invoices, payment confirmations, and important account messages.",
      "To detect abuse, prevent fraud, troubleshoot issues, maintain logs, and comply with applicable legal and regulatory requirements.",
    ],
  },
  {
    title: "3. Legal Basis And Indian Compliance",
    body: [
      "We process personal data in accordance with applicable Indian laws, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023, as and when applicable.",
      "Where consent is required, customers are responsible for obtaining valid consent from their leads, contacts, users, and end customers before uploading or processing such data in the CRM.",
      "Customers must ensure that WhatsApp, email, Meta, website form, and campaign communications comply with applicable consent, anti-spam, platform, and telecom rules.",
    ],
  },
  {
    title: "4. Data Sharing",
    body: [
      "We do not sell customer data.",
      "We may share data with trusted service providers only when required to operate the CRM, such as hosting, storage, email delivery, WhatsApp/Meta APIs, payment processing, analytics, security, and customer support tools.",
      "We may disclose information if required by law, court order, government authority, or to protect the rights, safety, and security of Techoceanhub Private Limited, Vistaar Flow, customers, or the public.",
    ],
  },
  {
    title: "5. Data Storage, Security, And Retention",
    body: [
      "We use reasonable security practices, access controls, encryption where appropriate, audit logs, and operational safeguards to protect customer data.",
      "Customer data is retained for as long as the account is active, as needed to provide services, or as required for legal, tax, audit, dispute, and security purposes.",
      "Customers may request deletion or export of their data, subject to applicable law, account ownership verification, outstanding obligations, backups, and legitimate retention requirements.",
    ],
  },
  {
    title: "6. Cookies And Tracking",
    body: [
      "We may use cookies and similar technologies for login sessions, security, preferences, analytics, performance, and product improvement.",
      "Customers using the Vistaar Flow website widget on their own websites are responsible for disclosing such tracking and obtaining required visitor consent on their website.",
    ],
  },
  {
    title: "7. Customer Responsibilities",
    body: [
      "Customers are responsible for the accuracy, legality, consent, and permitted use of all contact, lead, campaign, and communication data uploaded into the CRM.",
      "Customers must not use Vistaar Flow to send unlawful, misleading, abusive, unsolicited, or non-compliant communications.",
      "Customers should configure user access carefully and remove access for users who no longer require it.",
    ],
  },
  {
    title: "8. Your Rights And Requests",
    body: [
      "Depending on applicable law, individuals may request access, correction, deletion, withdrawal of consent, or grievance redressal regarding personal data.",
      "Because Vistaar Flow is primarily a business CRM, many requests relating to lead/contact data may need to be handled by the customer business that collected that data.",
    ],
  },
];

export default function PrivacyPolicy() {
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
            <ShieldCheck size={28} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-teal-700">Privacy Policy</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Privacy Policy for Vistaar Flow
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
            This Privacy Policy explains how Techoceanhub Private Limited collects, uses, stores, protects, and shares personal data when customers use Vistaar Flow CRM, our websites, applications, integrations, and related services.
          </p>
          <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 sm:grid-cols-2">
            <div><span className="font-black text-slate-950">App:</span> Vistaar Flow CRM</div>
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
            <h2 className="text-xl font-black text-slate-950">9. Contact And Grievance Redressal</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
              For privacy questions, data requests, or grievance redressal, contact Techoceanhub Private Limited at{" "}
              <a href="mailto:support@techoceanhub.com" className="font-black text-teal-700 hover:text-teal-800">
                support@techoceanhub.com
              </a>
              . Please include your account email, business name, and request details so we can verify and respond appropriately.
            </p>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-900">
            This page is a general privacy policy template for product use and Indian compliance readiness. Techoceanhub Private Limited should have final legal review before publishing for production or app marketplace submissions.
          </section>
        </div>
      </section>
    </main>
  );
}
