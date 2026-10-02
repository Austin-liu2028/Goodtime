interface ResponseStatusProps {
  submittedNames: string[];
  waitingNames: string[];
  rosterSize: number;
}

// Organizer-only: who has answered and who still needs a nudge.
export const ResponseStatus = ({ submittedNames, waitingNames, rosterSize }: ResponseStatusProps) => (
  <section className="insights-section response-section" aria-labelledby="responses-heading">
    <div className="insights-title-row">
      <div>
        <div className="eyebrow schedule-eyebrow">PARTICIPANT STATUS</div>
        <h2 id="responses-heading">Responses: {submittedNames.length} / {rosterSize}</h2>
      </div>
    </div>
    <div className="response-lists">
      <div>
        <h3>Submitted <span>{submittedNames.length}</span></h3>
        {submittedNames.length > 0 ? (
          <ul>{submittedNames.map((name) => <li key={name}>{name}</li>)}</ul>
        ) : <p>No responses yet.</p>}
      </div>
      <div>
        <h3>Waiting for response <span>{waitingNames.length}</span></h3>
        {waitingNames.length > 0 ? (
          <ul>{waitingNames.map((name) => <li key={name}>{name}</li>)}</ul>
        ) : <p>{rosterSize === 0 ? 'No invite list for this event.' : 'Everyone has responded.'}</p>}
      </div>
    </div>
  </section>
);
