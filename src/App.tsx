import './App.css';
import { CreateEventPage } from './components/CreateEventPage';
import { EditEventPage } from './components/EditEventPage';
import { EventPage } from './components/EventPage';
import { JoinEventPage } from './components/JoinEventPage';
import { Link } from './components/Link';
import { PageShell } from './components/PageShell';
import { PrivacyPage } from './components/PrivacyPage';
import { RoleSelect } from './components/RoleSelect';
import { TermsPage } from './components/TermsPage';
import { usePathname } from './hooks/useRoute';
import { normalizeEventCode } from './services/events';

// Routes: /  ·  /create  ·  /join  ·  /e/:code (invite links land here)  ·  /e/:code/edit  ·  /privacy  ·  /terms
const renderPage = (pathname: string) => {
  if (pathname === '/') return <RoleSelect />;
  if (pathname === '/create') return <CreateEventPage />;
  if (pathname === '/join') return <JoinEventPage />;
  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/terms') return <TermsPage />;
  const eventMatch = /^\/e\/([^/]+)(\/edit)?\/?$/.exec(pathname);
  if (eventMatch) {
    const code = normalizeEventCode(decodeURIComponent(eventMatch[1]));
    return eventMatch[2] ? <EditEventPage code={code} key={`${code}-edit`} /> : <EventPage code={code} key={code} />;
  }
  return (
    <section className="narrow-page">
      <h1>Page not found</h1>
      <p className="lede">This address doesn’t match anything in Goodtime.</p>
      <Link to="/" className="button button-primary">Go home</Link>
    </section>
  );
};

const App = () => {
  const pathname = usePathname();
  return <PageShell pathname={pathname}>{renderPage(pathname)}</PageShell>;
};

export default App;
