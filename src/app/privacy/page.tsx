import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – MarginSync",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 11, 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
        <p>
          MarginSync (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a Shopify application that
          helps store owners automatically update product prices when supplier price lists change.
          This Privacy Policy explains how we collect, use, and protect your data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Shopify store data:</strong> Your store URL, access token (encrypted), and
            product catalog (SKUs, titles, prices, variants) fetched via the Shopify API.
          </li>
          <li>
            <strong>Supplier price files:</strong> CSV or Excel files you upload to MarginSync.
            These are processed to match SKUs and compute new prices, then deleted after processing.
          </li>
          <li>
            <strong>Account information:</strong> Your email address used to authenticate and send
            run notifications.
          </li>
          <li>
            <strong>Usage data:</strong> Pricing run history, match results, and margin calculations
            stored so you can review and roll back changes.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How We Use Your Data</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>To sync your supplier prices to Shopify on your behalf.</li>
          <li>To show you a preview of price changes before they are applied.</li>
          <li>To send you email notifications about completed pricing runs.</li>
          <li>To calculate supplier reliability scores based on your upload history.</li>
          <li>To maintain a rollback history so you can undo any price update.</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> sell your data to third parties. We do not use your product or
          pricing data for any purpose other than operating MarginSync for your store.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Shopify:</strong> We access your store via the official Shopify API under the
            permissions you grant during installation.
          </li>
          <li>
            <strong>Supabase:</strong> We use Supabase (hosted PostgreSQL) to store your account,
            run history, and encrypted Shopify credentials.
          </li>
          <li>
            <strong>Vercel:</strong> MarginSync is deployed on Vercel, which handles our hosting
            infrastructure.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
        <p>
          We retain your data for as long as your MarginSync account is active. Uploaded supplier
          files are deleted from our storage after processing. If you uninstall MarginSync from your
          Shopify store, we will anonymise and delete your shop data within 30 days in accordance
          with Shopify&rsquo;s GDPR webhook requirements.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal data at any time. To
          exercise these rights, contact us at the email below. EU/EEA residents may also lodge a
          complaint with their local data protection authority.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Security</h2>
        <p>
          Shopify access tokens are stored encrypted at rest. We use HTTPS for all data in transit.
          Access to your store is limited to the specific Shopify API scopes required to read
          products and write prices.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant
          changes by updating the date at the top of this page.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
        <p>
          Questions about this policy? Email us at{" "}
          <a href="mailto:hughez.1839073@bpkpenabur.sch.id" className="text-blue-600 underline">
            hughez.1839073@bpkpenabur.sch.id
          </a>
          .
        </p>
      </section>
    </main>
  );
}
