import { useEffect, useId, useRef } from 'react';
import { GUIDE_STEP_COUNT, type GuideStep } from '../hooks/useGuide';

const GUIDE_COPY: Record<GuideStep, { title: string; body: string }> = {
  1: {
    title: 'Enter your name',
    body: 'Use the name your group knows you by. Coming back later? Type the same name to edit your times. Add an email if you’d like the confirmed time sent to you.',
  },
  2: {
    title: 'Pick the times you’re free',
    body: 'Tap a slot, or drag across several at once. Darker green means more people are free. Use Earlier and Later to see other days, or “Add times without dragging” below.',
  },
  3: {
    title: 'Submit your availability',
    body: 'Nothing is shared until you submit. You can come back and update your times any time.',
  },
};

interface GuideTipProps {
  step: GuideStep;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// A coach mark that sits just above the part of the page it explains.
export const GuideTip = ({ step, onBack, onNext, onSkip }: GuideTipProps) => {
  const id = useId();
  const tipRef = useRef<HTMLElement>(null);
  const { title, body } = GUIDE_COPY[step];
  const isLast = step === GUIDE_STEP_COUNT;

  // Bring each step into view as the guide moves along.
  useEffect(() => {
    tipRef.current?.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step]);

  return (
    <section className="guide-tip" aria-labelledby={`${id}-title`} ref={tipRef}>
      <span className="guide-step">Step {step} of {GUIDE_STEP_COUNT}</span>
      <h3 id={`${id}-title`}>{title}</h3>
      <p>{body}</p>
      <div className="guide-actions">
        <button type="button" className="text-button" onClick={onSkip}>Skip tutorial</button>
        <span className="guide-nav">
          {step > 1 && (
            <button type="button" className="button button-secondary button-small" onClick={onBack}>Back</button>
          )}
          <button type="button" className="button button-primary button-small" onClick={onNext}>
            {isLast ? 'Got it' : 'Next'}
          </button>
        </span>
      </div>
    </section>
  );
};
