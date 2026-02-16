import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import {
  barChartOutline,
  checkmarkCircleOutline,
  compassOutline,
  flashOutline,
  phonePortraitOutline,
  searchOutline,
  shieldCheckmarkOutline,
  walletOutline
} from 'ionicons/icons';
import { useOnboardingStore } from '../store/onboarding';

const steps = [
  {
    icon: compassOutline,
    title: 'Own Every\nEvent Moment',
    body: 'Track RSVP activity, check-ins, media, and revenue from one clean owner workspace.',
    features: [
      { icon: barChartOutline, text: 'Real-time event insights' },
      { icon: checkmarkCircleOutline, text: 'Smooth guest approvals' },
    ]
  },
  {
    icon: flashOutline,
    title: 'Move Fast\nDuring Live Events',
    body: 'Get the right numbers quickly so approvals, decisions, and follow-up happen without friction.',
    features: [
      { icon: phonePortraitOutline, text: 'Mobile-first operations' },
      { icon: searchOutline, text: 'Instant search and filters' },
    ]
  },
  {
    icon: walletOutline,
    title: 'Get Paid\nwith Confidence',
    body: 'Manage payout-ready balances and wallet settings in a focused, low-stress flow.',
    features: [
      { icon: walletOutline, text: 'Wallet-ready payouts' },
      { icon: shieldCheckmarkOutline, text: 'Secure transactions' },
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

          <div className="onboarding-step-icon">
            <IonIcon icon={current.icon} />
          </div>
          <h1 style={{ whiteSpace: 'pre-line' }}>{current.title}</h1>
          <p className="body">{current.body}</p>

          <div className="surface-card onboarding-feature-card">
            {current.features.map((feature, i) => (
              <div key={i} className="onboarding-feature-row">
                <div className="feature-icon">
                  <IonIcon icon={feature.icon} />
                </div>
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
