import { getBestRanges, getEveryoneAvailableRanges } from '../utilities/availability';
import { formatDate } from '../utilities/date';
import { formatTime, SLOT_LENGTH_MINUTES } from '../utilities/time';

const BEST_RANGE_LIMIT = 5;

interface GroupResultsProps {
  namesBySlot: Map<string, string[]>;
  submittedNames: string[];
  waitingNames: string[];
  rosterSize: number;
}

// Times everyone can make, or the closest alternatives and who would miss them.
export const GroupResults = ({ namesBySlot, submittedNames, waitingNames, rosterSize }: GroupResultsProps) => {
  const responseCount = submittedNames.length;
  const everyoneAvailableDays = getEveryoneAvailableRanges(namesBySlot, responseCount, SLOT_LENGTH_MINUTES);
  const bestRanges = getBestRanges(namesBySlot, SLOT_LENGTH_MINUTES, BEST_RANGE_LIMIT);
  const highestCount = bestRanges[0]?.names.length ?? 0;

  return (
    <>
      <section className="insights-section" aria-labelledby="everyone-heading">
        <div className="insights-title-row">
          <div>
            <div className="eyebrow schedule-eyebrow">EVERYONE&apos;S FREE</div>
            <h2 id="everyone-heading">Works for Everyone</h2>
          </div>
          {everyoneAvailableDays.length > 0 && (
            <span className="everyone-count">{responseCount}/{responseCount} available</span>
          )}
        </div>
        {responseCount === 0 ? (
          <p className="insight-empty">Submit availability to see when everyone is free.</p>
        ) : everyoneAvailableDays.length === 0 ? (
          <p className="insight-summary no-perfect-overlap">
            No time works for all {responseCount} {responseCount === 1 ? 'person' : 'people'} yet. See the best alternatives below.
          </p>
        ) : (
          <ul className="everyone-list">
            {everyoneAvailableDays.map(({ date, ranges }) => (
              <li key={date}>
                <strong>{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                <span className="everyone-ranges">
                  {ranges.map(({ start, end }) => (
                    <span className="everyone-range" key={start}>
                      {formatTime(start)} – {formatTime(end)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {responseCount > 0 && waitingNames.length > 0 && (
          <p className="insight-empty">
            Based on {responseCount} of {rosterSize} responses. Still waiting on {waitingNames.join(', ')}.
          </p>
        )}
      </section>

      {responseCount > 0 && everyoneAvailableDays.length === 0 && (
        <section className="insights-section" aria-labelledby="best-times-heading">
          <div className="insights-title-row">
            <div>
              <div className="eyebrow schedule-eyebrow">GROUP AVAILABILITY</div>
              <h2 id="best-times-heading">Best Alternatives</h2>
            </div>
            {highestCount > 0 && <span className="best-count">{highestCount}/{responseCount} available</span>}
          </div>
          {bestRanges.length === 0 ? (
            <p className="insight-empty">No availability selected yet. Add times to find a match.</p>
          ) : (
            <ul className="best-times-list">
              {bestRanges.map(({ date, start, end, names }) => {
                const missingNames = submittedNames.filter((name) => names.indexOf(name) === -1);
                return (
                  <li key={`${date}|${start}`}>
                    <strong>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                    <span>{formatTime(start)} – {formatTime(end)}</span>
                    <span className="best-time-count">{names.length} of {responseCount} available</span>
                    <span className="best-time-missing">Missing: {missingNames.join(', ')}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
};
