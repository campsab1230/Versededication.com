import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL, SITE_NAME, CHARITY_PERCENT, CHARITY } from '@/lib/site';

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 18, 2026">
      <p>
        {SITE_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy. This policy explains what
        we collect when you use this site and how we use it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Dedication details</strong> — the recipient&rsquo;s name, your name (if given), and any
          personal message you write. If you leave your name blank, the dedication is recorded as
          anonymous.
        </li>
        <li>
          <strong>Contact details</strong> — your email address, so we can send your certificate.
        </li>
        <li>
          <strong>Shipping details</strong> — name and address, only if you choose the printed Heirloom
          certificate.
        </li>
        <li>
          <strong>Payment details</strong> — handled entirely by Stripe. We never see or store your card
          number.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To generate and deliver your certificate.</li>
        <li>To fulfil and ship printed certificates.</li>
        <li>To send you information related to your purchase.</li>
        <li>
          If you tick &ldquo;show my dedication in the public feed,&rdquo; to display a short public
          entry (first name or &ldquo;Someone&rdquo;, the verse reference, and the recipient&rsquo;s
          name). Untick it and nothing is shown publicly.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We share data only with the service providers needed to run the site:</p>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Supabase</strong> — secure data storage.</li>
        <li><strong>Resend</strong> — email delivery.</li>
        <li><strong>Vercel</strong> — website hosting.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Children</h2>
      <p>This site is not directed at children under 13, and we do not knowingly collect their data.</p>

      <h2>Your choices</h2>
      <p>
        You can request a copy of your data, correct it, or ask us to delete it by emailing{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. A dedication that has already been
        delivered cannot always be recalled from a recipient, but we will remove it from our systems on
        request.
      </p>

      <h2>Charitable share</h2>
      <p>
        {CHARITY_PERCENT}% of each purchase is given to {CHARITY.name} ({CHARITY.location}, EIN{' '}
        {CHARITY.ein}), a tax-exempt organisation that translates Scripture into languages that do not
        yet have it. That is a business contribution, not a charitable donation made on your behalf, so
        it is not tax-deductible for you.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
