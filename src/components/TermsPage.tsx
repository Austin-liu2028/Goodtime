import { CONTACT_URL, LEGAL_EFFECTIVE_DATE } from '../utilities/legal';
import { Link } from './Link';

// Terms of Use, including the platform's disclaimers. Agreed to via the consent banner.
export const TermsPage = () => (
  <article className="legal-page" aria-labelledby="terms-heading">
    <Link to="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
    <h1 id="terms-heading">Terms of Use</h1>
    <p className="legal-meta">Effective {LEGAL_EFFECTIVE_DATE}</p>

    <p>
      These terms are an agreement between you and the Goodtime project team. By selecting Accept on the site, or by using
      Goodtime, you agree to these terms and to our <Link to="/privacy">Privacy Policy</Link>. If you don’t agree, please
      don’t use Goodtime.
    </p>

    <h2>1. What Goodtime is</h2>
    <p>
      Goodtime is a free tool for finding a meeting time: an organizer creates an event, people mark when they’re free,
      and the organizer can confirm a time and share it. It is a student course project, provided without any fee,
      account, or guarantee of continued availability. It is not an official service of any university.
    </p>

    <h2>2. Who can use it</h2>
    <p>
      You must be at least 13 years old to use Goodtime. You don’t need an account; signing in with Google is optional,
      and you’re responsible for activity on your account.
    </p>

    <h2>3. Your content and who can see it</h2>
    <ul>
      <li>
        You keep ownership of what you enter. You let us store it and show it to people as the service requires, for
        example showing event details and responses to anyone with the event’s link or code.
      </li>
      <li>
        <strong>Event links work like an unlisted link:</strong> anyone who has one can open the event, see what people
        have entered, and add a response. Only share links with people you intend to invite.
      </li>
      <li>You’re responsible for what you enter. Don’t enter sensitive personal information, or anyone else’s information without their permission.</li>
    </ul>

    <h2>4. Acceptable use</h2>
    <p>Please don’t use Goodtime to:</p>
    <ul>
      <li>break any law or anyone else’s rights;</li>
      <li>harass, threaten, impersonate or mislead others;</li>
      <li>add email addresses of people who don’t expect to hear from you, or send spam;</li>
      <li>try to access data you aren’t allowed to see, test or bypass our security, or overload the service;</li>
      <li>scrape the service or use it in an automated way.</li>
    </ul>
    <p>We may remove content or events that break these rules.</p>

    <h2>5. Emails and calendar entries</h2>
    <p>
      Goodtime drafts confirmation emails, but it never sends them: the organizer reviews each draft and sends it from
      their own email account, and is responsible for that message and its recipients. Calendar links and .ics files are
      provided for convenience; check the date, time and time zone before relying on them.
    </p>

    <h2>6. Third-party services and trademarks</h2>
    <p>
      Goodtime runs on Google Firebase and uses Google Fonts. Buttons for Google Calendar, Gmail, Outlook and Apple Mail
      open those services, which have their own terms. Google, Gmail, Google Calendar, Outlook, Apple Mail and When2Meet
      are trademarks of their respective owners. Goodtime isn’t affiliated with, endorsed by, or sponsored by any of them.
    </p>

    <h2>7. Changes and availability</h2>
    <p>
      Dated events expire a week after their last day; weekly events expire one year after creation. Because Goodtime is a course project, we may also
      change, pause or shut it down at any time. Keep your own copy of anything important, such as the confirmed
      meeting time, for example by adding it to your calendar.
    </p>

    <h2>8. Disclaimer of warranties</h2>
    <p className="legal-caps">
      Goodtime is provided “as is” and “as available”, without warranties of any kind, whether express or implied,
      including warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. We don’t
      guarantee that the service will be uninterrupted, secure or error-free, that recommended meeting times, time zone
      conversions or calendar entries will be correct, or that your data will be preserved.
    </p>

    <h2>9. Limitation of liability</h2>
    <p className="legal-caps">
      To the fullest extent permitted by law, the Goodtime project team will not be liable for any indirect, incidental,
      special, consequential or punitive damages, or for any lost data, missed meetings or lost opportunities, arising
      from your use of Goodtime. Our total liability for any claim relating to Goodtime is limited to US $50.
    </p>
    <p>
      Some states don’t allow certain warranties to be excluded or liability to be limited, so some of the limits above may
      not apply to you. Nothing in these terms limits rights you have under laws that can’t be waived.
    </p>

    <h2>10. Your responsibility</h2>
    <p>
      If you misuse Goodtime or break these terms, you agree to be responsible for the resulting claims against the project
      team, to the extent the law allows.
    </p>

    <h2>11. Governing law</h2>
    <p>
      These terms are governed by the laws of the State of Illinois, without regard to its conflict-of-laws rules, except
      where the law of the state you live in requires otherwise.
    </p>

    <h2>12. Changes to these terms</h2>
    <p>
      We may update these terms. We’ll change the effective date above and, for material changes, ask you to accept the
      new version on your next visit. If one part of these terms can’t be enforced, the rest still applies.
    </p>

    <h2>13. Contact</h2>
    <p>
      Questions: open an issue at <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">our project page</a>,
      without personal details.
    </p>
  </article>
);
