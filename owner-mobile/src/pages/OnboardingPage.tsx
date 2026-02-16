import { useState } from 'react';
import { IonButton, IonContent, IonPage, useIonRouter } from '@ionic/react';
import { useOnboardingStore } from '../store/onboarding';

const steps = [
  {
    icon: '\u{1F3AF}',
    title: 'Own Every\nEvent Moment',
    body: 'Track RSVP activity, check-ins, media, and revenue from one clean owner workspace.',
    features: [
      { icon: '\u{1F4CA}', text: 'Real-time event insights' },
      { icon: '\u{2705}', text: 'Smooth guest approvals' },
    ]
  },
  {
    icon: '\u{26A1}',
    title: 'Move Fast\nDuring Live Events',
    body: 'Get the right numbers quickly so approvals, decisions, and follow-up happen without friction.',
    features: [
      { icon: '\u{1F4F1}', text: 'Mobile-first operations' },
      { icon: '\u{1F50D}', text: 'Instant search and filters' },
    ]
  },
  {
    icon: '\u{1F4B0}',
    title: 'Get Paid\nwith Confidence',
    body: 'Manage payout-ready balances and wallet settings in a focused, low-stress flow.',
    features: [
      { icon: '\u{1F3E6}', text: 'Wallet-ready payouts' },
      { icon: '\u{1F512}', text: 'Secure transactions' },
    ]
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

  const onSkip = () => {
    completeOnboarding();
    router.push('/auth', 'root');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="onboarding-screen">
        <div className="onboarding-wrap" style={{ position: 'relative' }}>
          <button className="skip-btn" onClick={onSkip}>Skip</button>

          <div className="onboarding-step-icon">{current.icon}</div>
          <h1 style={{ whiteSpace: 'pre-line' }}>{current.title}</h1>
          <p className="body">{current.body}</p>

          <div className="surface-card" style={{ marginTop: 16 }}>
            {current.features.map((feature, i) => (
              <div key={i} className="onboarding-feature-row">
                <div className="feature-icon">{feature.icon}</div>
                <span className="feature-text">{feature.text}</span>
              </div>
            ))}
          </div>

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
              {index < steps.length - 1 ? 'Continue' : 'Get started'}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingPage;
