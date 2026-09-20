import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL, SITE_NAME, BIBLE_TRANSLATION, CHARITY_PERCENT, CHARITY } from '@/lib/site';

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="[SET DATE]">
      <p>
        These terms govern your use of {SITE_NAME}. By placing an order you agree to them.
      </p>

      <h2>What you are buying</h2>
      <p>
        You are purchasing a <strong>personalized certificate of dedication</strong>. The Digital tier
        is delivered by email as a PDF. The Heirloom tier includes the digital certificate plus a
        printed copy mailed to the shipping address you provide.
      </p>

      <h2>Scripture text</h2>
      <p>
        Verse text is quoted from the {BIBLE_TRANSLATION}, which is in the public domain. Verse
        references and book names are the property of their respective rights holders where applicable;
        we use them only to identify the passage.
      </p>

      <h2>Your content</h2>
      <p>
        You are responsible for the names and messages you enter. You confirm you have the right to use
        the recipient&rsquo;s name and any details you provide, and that your message is not unlawful,
        hateful, harassing, or infringing. We may refuse or remove any dedication that violates this.
      </p>

      <h2>Public feed</h2>
      <p>
        If you opt in, a short entry (name or &ldquo;Someone&rdquo;, verse reference, recipient name)
        may be shown publicly on the site. You can opt out at checkout, and you can ask us to remove an
        entry at any time by contacting us.
      </p>

      <h2>Pricing and payment</h2>
      <p>
        Prices are shown at checkout in US dollars. Payments are processed by Stripe. We may change
        prices at any time, but changes never affect an order already placed.
      </p>

      <h2>Delivery</h2>
      <p>
        Digital certificates are typically emailed within minutes. Printed Heirloom certificates ship
        within 3–5 business days and are subject to carrier timeframes.
      </p>

      <h2>Refunds</h2>
      <p>
        See our <a href="/refunds">Refund Policy</a>.
      </p>

      <h2>Charitable share</h2>
      <p>
        {CHARITY_PERCENT}% of each purchase is given to {CHARITY.name} ({CHARITY.location}, EIN{' '}
        {CHARITY.ein}), an organisation that translates Scripture into languages that do not yet have
        it. This is our business contribution; it is not a donation made on your behalf and is not
        tax-deductible for you.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        The site and its content are provided &ldquo;as is.&rdquo; To the fullest extent permitted by law,
        our total liability for any claim relating to an order is limited to the amount you paid for that
        order.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Continued use of the site after an update means you accept the new
        terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
