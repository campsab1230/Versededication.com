import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/site';

export default function Refunds() {
  return (
    <LegalPage title="Refund Policy" updated="October 18, 2026">
      <h2>Digital certificates</h2>
      <p>
        Because a digital certificate is personalized and delivered instantly, it is generally
        non-refundable once it has been emailed. If something is wrong with it — a misspelled name, a
        delivery failure, or a technical problem — contact us and we will make it right, including a full
        refund where appropriate.
      </p>

      <h2>Printed Heirloom certificates</h2>
      <p>
        If your printed certificate arrives damaged, defective, or never arrives, contact us within 30
        days of the order date and we will reprint or refund it. Because each certificate is personalized,
        we cannot accept returns for change of mind once printing has begun — but if you contact us
        before it ships, we can usually cancel it.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your order details. We aim to
        respond within 2 business days. Approved refunds are returned to your original payment method
        through Stripe.
      </p>

      <h2>Statutory rights</h2>
      <p>
        Nothing here removes any rights you have under the consumer law that applies to you.
      </p>
    </LegalPage>
  );
}
