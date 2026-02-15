import { useState } from 'react';
import { IonButton, IonContent, IonPage, useIonRouter } from '@ionic/react';
import { useOnboardingStore } from '../store/onboarding';

const steps = [
  {
    title: 'Own Every Event Moment',
    body: 'Track RSVP activity, check-ins, media, and revenue from one clean owner workspace.'
  },
  {
    title: 'Move Fast During Live Events',
    body: 'Get the right numbers quickly so approvals, decisions, and follow-up happen without friction.'
  },
  {
    title: 'Get Paid with Confidence',
    body: 'Manage payout-ready balances and wallet settings in a focused, low-stress flow.'
  }
];

const OnboardingPage = () => {
  const [index, setIndex] = useState(0);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const router = useIonRouter();
  const current = steps[index];

  const onNext = () => {
    if (index < steps.length - 1) {
      setIndex((prev) => prev + 1);
      return;
    }
    completeOnboarding();
    router.push('/auth', 'root');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="onboarding-screen">
        <div className="onboarding-wrap">
          <div className="brand-mark">E</div>
          <p className="eyebrow">Owner App</p>
          <h1>{current.title}</h1>
          <p className="body">{current.body}</p>

          <div className="steps-row" aria-label="Onboarding progress">
            {steps.map((_, i) => (
              <span key={i} className={'step-dot' + (i === index ? ' is-active' : '')} />
            ))}
          </div>

          <div className="onboarding-actions">
            {index > 0 ? (
              <IonButton fill="clear" onClick={() => setIndex((prev) => prev - 1)}>
                Back
              </IonButton>
            ) : (
              <span />
            )}
            <IonButton className="solid-cta" onClick={onNext}>
              {index < steps.length - 1 ? 'Continue' : 'Start'}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingPage;
