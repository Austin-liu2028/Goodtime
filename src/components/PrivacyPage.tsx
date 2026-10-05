import { CONTACT_URL, LEGAL_EFFECTIVE_DATE } from '../utilities/legal';
import { Link } from './Link';

// Plain-language privacy notice. Written to describe what the app actually does; keep it in step
// with the code (services/, firestore.rules, ConsentBanner) whenever data handling changes.
export const PrivacyPage = () => (
  <article className="legal-page" aria-labelledby="privacy-heading">
    <Link to="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
    <h1 id="privacy-heading">Privacy Policy</h1>
    <p className="legal-meta">Effective {LEGAL_EFFECTIVE_DATE}</p>

    <div className="legal-summary">
      <h2>The short version</h2>
      <ul>
        <li>Anyone with an event’s link or code can see the event details and the names and times people submit.</li>
        <li>Email addresses are optional and only the event’s organizer can see them.</li>
        <li>No ads, no tracking cookies, no analytics, and we never sell or share your personal information.</li>
        <li>You can ask us to delete your information at any time.</li>
      </ul>
    </div>

    <h2>Who we are</h2>
    <p>
      Goodtime is a free scheduling tool built by a student team as a course project. It is not a commercial service and
      is not an official service of any university. “We” and “us” in this policy mean the Goodtime project team.
    </p>

    <h2>Information we collect</h2>
    <h3>Information you enter</h3>
    <ul>
      <li>
        <strong>Event details:</strong> the title, note, location, dates, hours, time zone and invitee names an organizer
        enters. Anyone with the event’s link or code can see these.
      </li>
      <li>
        <strong>Availability:</strong> the name you type and the times you select. Anyone with the event’s link or code can
        see them, so use a first name or nickname if you prefer.
      </li>
      <li>
        <strong>Email addresses (optional):</strong> an email you leave with your response, or one an organizer adds next
        to an invitee’s name. These are stored separately from the event and only the event’s organizer can read them. They
        are used for one thing: letting the organizer send you the confirmed meeting time.
      </li>
    </ul>
    <h3>Information collected automatically</h3>
    <ul>
      <li>
        <strong>An anonymous account ID.</strong> The first time you use Goodtime, your browser gets a random anonymous ID
        so we can tell which device created an event. It isn’t linked to your name, email or any other account.
      </li>
      <li>
        <strong>Technical data for security.</strong> Our hosting and sign-in provider processes your IP address and browser
        type to deliver the site and prevent abuse. Google, which runs that service, keeps sign-in IP logs for several weeks.
      </li>
      <li>
        <strong>Font requests.</strong> The site loads its typeface from Google Fonts, which receives your IP address and
        browser details to send the font file. Google Fonts does not set cookies.
      </li>
    </ul>

    <h2>Cookies and browser storage</h2>
    <p>
      Goodtime does not use advertising cookies, tracking cookies, analytics or tracking pixels. It stores a small amount
      of data in your browser that the site needs to work:
    </p>
    <ul>
      <li>your anonymous sign-in session (kept by Firebase in your browser’s storage),</li>
      <li>whether you accepted these terms, and which version (<code>goodtime:consent</code>),</li>
      <li>the email service you last chose when sending a confirmation (<code>goodtime:mail-service</code>).</li>
    </ul>
    <p>Clearing your browser’s site data removes all of it. If you do, Goodtime will treat you as a new visitor and you
      won’t be recognized as the organizer of events you created on that browser.</p>

    <h2>How we use information</h2>
    <p>
      Only to run Goodtime: to save events and responses, show the group’s availability, recommend meeting times,
      recognize an event’s organizer, keep the service secure, and let organizers draft confirmation emails. We do not
      sell personal information, share it for cross-context behavioral advertising, show ads, build profiles, or use it to
      train AI models.
    </p>

    <h2>Who we share information with</h2>
    <ul>
      <li>
        <strong>Google Firebase</strong> (hosting, anonymous sign-in and database) stores and processes data on our behalf
        as a service provider, in data centers in the United States. See{' '}
        <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Privacy and Security in Firebase</a>.
      </li>
      <li>
        <strong>Google Fonts</strong> delivers the site’s typeface. See the{' '}
        <a href="https://developers.google.com/fonts/faq/privacy" target="_blank" rel="noopener noreferrer">Google Fonts privacy FAQ</a>.
      </li>
      <li>
        <strong>Services you choose to open.</strong> “Add to my Google Calendar”, the .ics download, and the Gmail,
        Outlook or Apple Mail buttons hand the meeting details to that service or app. Goodtime itself never sends email;
        organizers send it from their own accounts. Those services’ own privacy policies apply.
      </li>
      <li>
        <strong>When required by law,</strong> or to protect the safety and security of users and the service.
      </li>
    </ul>

    <h2>How long we keep information</h2>
    <p>
      We keep events, responses and saved emails while the project is running, and delete them when you ask us to.
      Organizers can remove an invitee’s email from the event’s edit page at any time, and participants can clear their
      own email by submitting their response again with the email field empty.
    </p>

    <h2>Your rights and choices</h2>
    <p>
      Whatever state or country you live in, you can ask us to tell you what information we have about you, correct it, or
      delete it. We will respond within 45 days and won’t treat you differently for asking. To make a request, open an issue
      at <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">our project page</a> with only the event code and
      what you’d like us to do. Please don’t post your email address or other personal details there; we’ll reply with a
      private way to verify the request.
    </p>

    <h2>Notices for U.S. state residents</h2>
    <p>
      Many states give residents specific privacy rights, including California, Colorado, Connecticut, Delaware, Indiana,
      Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee,
      Texas, Utah and Virginia. These comprehensive laws generally apply to organizations above certain size or revenue
      thresholds, which a student project doesn’t meet, but we honor the core rights they describe for everyone:
    </p>
    <ul>
      <li><strong>Access, correction and deletion</strong> of your personal information, as described above.</li>
      <li>
        <strong>Opting out of sale, “sharing” for targeted advertising, and profiling.</strong> We don’t do any of these,
        so there is nothing to opt out of. We still treat a Global Privacy Control signal from your browser as a valid
        opt-out request.
      </li>
      <li><strong>Sensitive information.</strong> We don’t ask for it. Please don’t put sensitive details, such as health or financial information, in event titles, notes or names.</li>
    </ul>
    <p>
      <strong>California.</strong> Under the California Online Privacy Protection Act, this policy lists the categories of
      personally identifiable information we collect (names, email addresses and IP addresses, described above), the third
      parties we share it with, how you can review and request changes to it, and its effective date. We don’t disclose
      personal information to third parties for their own direct marketing (California “Shine the Light” law).
    </p>
    <p>
      <strong>Do Not Track.</strong> Goodtime doesn’t track you across other websites or over time, and doesn’t allow third
      parties to do so, so it works the same whether or not your browser sends a Do Not Track signal.
    </p>
    <p>
      <strong>Nevada.</strong> We don’t sell covered information as defined by Nevada law.
    </p>
    <p>
      <strong>Illinois.</strong> We don’t collect biometric information.
    </p>

    <h2>Children</h2>
    <p>
      Goodtime isn’t directed to children under 13, and we don’t knowingly collect personal information from them, as
      required by the Children’s Online Privacy Protection Act (COPPA). If you believe a child under 13 has given us
      personal information, contact us and we’ll delete it.
    </p>

    <h2>Security</h2>
    <p>
      Data travels over encrypted HTTPS connections and is stored with Google Firebase, and our database rules stop anyone
      but an event’s organizer from reading saved email addresses. No system is perfectly secure, though, which is one
      more reason not to enter sensitive information. If a security breach affects your personal information, we’ll notify
      you as required by applicable state breach-notification laws.
    </p>

    <h2>Visitors outside the United States</h2>
    <p>Goodtime is operated from the United States and stores data there. By using it, you understand your information will be processed in the U.S.</p>

    <h2>Changes to this policy</h2>
    <p>
      If we change this policy, we’ll update the effective date above. For material changes, we’ll ask you to accept the
      updated version the next time you visit.
    </p>

    <h2>Contact</h2>
    <p>
      Questions or requests: open an issue at{' '}
      <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">our project page</a>, without personal details.
      See also our <Link to="/terms">Terms of Use</Link>.
    </p>
  </article>
);
