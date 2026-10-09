interface ResponseStatusProps {
  submittedNames: string[];
  waitingNames: string[];
  rosterSize: number;
}

// Organizer-only: who has answered and who still needs a nudge.
export const ResponseStatus = ({ submittedNames, waitingNames, rosterSize }: ResponseStatusProps) => (
  <section className="response-status" aria-labelledby="responses-heading">
    <h2 className="panel-title" id="responses-heading">
      Responses <span className="tabular">{submittedNames.length} of {rosterSize}</span>
    </h2>
    <div className="response-group">
      <h3>Responded</h3>
      {submittedNames.length > 0 ? (
        <ul>{submittedNames.map((name) => <li key={name}>{name}</li>)}</ul>
      ) : <p>No responses yet.</p>}
    </div>
    <div className="response-group">
      <h3>Waiting on</h3>
      {waitingNames.length > 0 ? (
        <ul>{waitingNames.map((name) => <li className="is-waiting" key={name}>{name}</li>)}</ul>
      ) : <p>{rosterSize === 0 ? 'Add names when you create an event to track who’s missing.' : 'Everyone has responded.'}</p>}
    </div>
  </section>
);
