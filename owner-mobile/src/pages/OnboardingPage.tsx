import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import {
  flashOutline,
  peopleOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import { useOnboardingStore } from '../store/onboarding';

const steps = [
  {
    title: 'Run Every Event\nFrom One Place',
    subtitle: 'Live visibility across RSVPs, check-ins, media, and revenue.',
    focusIcon: peopleOutline,
    focusTitle: 'Real-time owner command center',
    focusBody: 'Stay in control before, during, and after the event.',
    stats: ['RSVP flow', 'Check-in ready', 'Live updates']
  },
  {
    title: 'Move Faster\nOn Event Day',
    subtitle: 'Short actions, bold layouts, and clear controls built for mobile speed.',
    focusIcon: flashOutline,
    focusTitle: 'Fast actions with less friction',
    focusBody: 'Approve, review, and share in seconds.',
    stats: ['Touch optimized', 'Readable UI', 'Clear actions']
  },
  {
    title: 'Deliver Premium\nGuest Experience',
    subtitle: 'Use invite links, secure access, and payout tools in one polished app.',
    focusIcon: qrCodeOutline,
    focusTitle: 'Professional event operations',
    focusBody: 'Designed to look premium while staying practical.',
    stats: ['Share links', 'Secure access', 'Payout tracking']
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
        <div className="onboarding-wrap">
          <button className="skip-btn" onClick={onSkip}>Skip</button>

          <section className="onboarding-visual">
            <div className="onboarding-hero">
              <p className="eyebrow">EventPeepo owner app</p>
              <h1 style={{ whiteSpace: 'pre-line' }}>{current.title}</h1>
              <p className="onboarding-subtitle">{current.subtitle}</p>
            </div>

            <div className="onboarding-orb-grid" aria-hidden="true">
              <span className="onboarding-orb accent" />
              <span className="onboarding-orb" />
              <span className="onboarding-orb" />
            </div>
          </section>

          <section className="onboarding-panel">
            <div className="onboarding-stat-row">
              {current.stats.map((stat) => (
                <span key={stat} className="onboarding-stat">{stat}</span>
              ))}
            </div>

            <div className="onboarding-focus">
              <IonIcon icon={current.focusIcon} />
              <div>
                <strong>{current.focusTitle}</strong>
                <span>{current.focusBody}</span>
              </div>
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
                {index < steps.length - 1 ? 'Continue' : 'Start now'}
              </IonButton>
            </div>
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnboardingPage;
