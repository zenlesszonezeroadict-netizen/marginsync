import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – MarginSync",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 11, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
        <p>
          By installing or using MarginSync you agree to these Terms of Service. If you do not
          agree, do not use the app.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
        <p>
          MarginSync is a Shopify application that reads supplier price lists (CSV/XLSX), matches
          them to your Shopify products, and updates prices on your behalf. You remain solely
          responsible for reviewing price changes before applying them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Your Responsibilities</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You are responsible for verifying prices before syncing them to your live store.</li>
          <li>You must not use MarginSync to set prices that violate applicable law.</li>
          <li>You are responsible for keeping your account credentials secure.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Limitation of Liability</h2>
        <p>
          MarginSync is provided &ldquo;as is&rdquo;. We are not liable for any loss of revenue,
          pricing errors, or consequential damages arising from use of the app. You should always
          review the price preview before applying a sync.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Billing</h2>
        <p>
          Paid plans are billed through Shopify&rsquo;s native billing system. Charges appear on
          your Shopify invoice. Subscription fees are non-refundable except where required by law.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Termination</h2>
        <p>
          You can uninstall MarginSync at any time from your Shopify admin. We may suspend access
          if these terms are violated. On termination, your data is deleted within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Changes</h2>
        <p>
          We reserve the right to update these terms. Continued use of MarginSync after changes are
          posted constitutes acceptance of the updated terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:hughez.1839073@bpkpenabur.sch.id" className="text-blue-600 underline">
            hughez.1839073@bpkpenabur.sch.id
          </a>
          .
        </p>
      </section>
    </main>
  );
}
