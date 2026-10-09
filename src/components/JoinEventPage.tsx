import { JoinForm } from './JoinForm';
import { Link } from './Link';

export const JoinEventPage = () => (
  <section className="narrow-page" aria-labelledby="join-heading">
    <Link to="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
    <h1 id="join-heading">Join an event</h1>
    <p className="lede">Enter the 6-character code from your organizer, or paste the invite link they sent.</p>
    <JoinForm />
  </section>
);
