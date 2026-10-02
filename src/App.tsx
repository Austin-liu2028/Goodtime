import './App.css';
import { CreateEventPage } from './components/CreateEventPage';
import { EventPage } from './components/EventPage';
import { JoinEventPage } from './components/JoinEventPage';
import { Link } from './components/Link';
import { PageShell } from './components/PageShell';
import { RoleSelect } from './components/RoleSelect';
import { usePathname } from './hooks/useRoute';
import { normalizeEventCode } from './services/events';

// Routes: /  ·  /create  ·  /join  ·  /e/:code (invite links land here)
const renderPage = (pathname: string) => {
  if (pathname === '/') return <RoleSelect />;
  if (pathname === '/create') return <CreateEventPage />;
  if (pathname === '/join') return <JoinEventPage />;
  const eventMatch = /^\/e\/([^/]+)\/?$/.exec(pathname);
  if (eventMatch) {
    const code = normalizeEventCode(decodeURIComponent(eventMatch[1]));
    return <EventPage code={code} key={code} />;
  }
  return (
    <section className="narrow-page page-message">
      <h1>Page not found</h1>
      <Link to="/" className="submit-button link-button">Go home</Link>
    </section>
  );
};

const App = () => <PageShell>{renderPage(usePathname())}</PageShell>;

export default App;
