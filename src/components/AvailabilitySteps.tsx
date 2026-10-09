interface AvailabilityStepsProps {
  hasName: boolean;
  hasTimes: boolean;
  isSubmitted: boolean;
  // The step the guide is pointing at, if it's running.
  guideStep: number | null;
  onShowGuide: () => void;
}

const STEPS = ['Your name', 'Pick times', 'Submit'];

// Always-visible progress through responding: done steps get a check, the next one is highlighted.
export const AvailabilitySteps = ({ hasName, hasTimes, isSubmitted, guideStep, onShowGuide }: AvailabilityStepsProps) => {
  const done = [hasName, hasTimes, isSubmitted];
  const firstOpen = done.indexOf(false);
  const current = guideStep !== null ? guideStep - 1 : firstOpen;

  return (
    <div className="availability-steps">
      <ol aria-label="Steps to respond">
        {STEPS.map((label, index) => {
          const state = done[index] ? 'done' : index === current ? 'current' : 'upcoming';
          return (
            <li
              key={label}
              className={`step is-${state}${index === current ? ' is-highlighted' : ''}`}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="step-marker" aria-hidden="true">{done[index] ? '✓' : index + 1}</span>
              <span>
                <span className="visually-hidden">Step {index + 1}: </span>
                {label}
                {done[index] && <span className="visually-hidden"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {guideStep === null && (
        <button type="button" className="text-button" onClick={onShowGuide}>Show me how</button>
      )}
    </div>
  );
};
