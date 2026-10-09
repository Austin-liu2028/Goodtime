import { useState } from 'react';

// The first-visit walkthrough of responding: 1 name, 2 pick times, 3 submit.
export const GUIDE_STEP_COUNT = 3;
export type GuideStep = 1 | 2 | 3;

const GUIDE_SEEN_KEY = 'goodtime:guide-seen';

const hasSeenGuide = () => {
  try {
    return window.localStorage.getItem(GUIDE_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
};

const rememberSeen = () => {
  try {
    window.localStorage.setItem(GUIDE_SEEN_KEY, 'true');
  } catch {
    // Storage is blocked: the guide simply shows again next visit.
  }
};

// Shows once per browser. Finishing or skipping both count as seen; "Show me how" replays it.
export const useGuide = () => {
  const [step, setStep] = useState<GuideStep | null>(() => (hasSeenGuide() ? null : 1));

  const finish = () => {
    rememberSeen();
    setStep(null);
  };

  const next = () => {
    if (step === null || step === GUIDE_STEP_COUNT) finish();
    else setStep((step + 1) as GuideStep);
  };

  const back = () => {
    if (step !== null && step > 1) setStep((step - 1) as GuideStep);
  };

  return { step, start: () => setStep(1), goTo: setStep, next, back, finish };
};
