import { useState } from 'react';
import { IonButton, IonContent, IonPage, useIonRouter } from '@ionic/react';
import { useOnboardingStore } from '../store/onboarding';

const steps = [
  {
    title: 'Run Every Event\nFrom One Place',
    subtitle: 'Live visibility across RSVPs, check-ins, media, and revenue.',
    cards: [
      '/onboarding/card-1.svg',
      '/onboarding/card-2.svg',
      '/onboarding/card-3.svg'
    ]
  },
  {
    title: 'Move Faster\nOn Event Day',
    subtitle: 'Short actions, bold layouts, and clear controls built for mobile speed.',
    cards: [
      '/onboarding/card-1.svg',
      '/onboarding/card-2.svg',
      '/onboarding/card-3.svg'
    ]
  },
  {
    title: 'Deliver Premium\nGuest Experience',
    subtitle: 'Use invite links, secure access, and payout tools in one polished app.',
    cards: [
      '/onboarding/card-1.svg',
      '/onboarding/card-2.svg',
      '/onboarding/card-3.svg'
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
        <div className="onboarding-wrap">
          <button className="skip-btn" onClick={onSkip}>Skip</button>

          <section className="onboarding-visual">
            <div className="onboarding-hero">
              <h1 style={{ whiteSpace: 'pre-line' }}>{current.title}</h1>
              <p className="onboarding-subtitle">{current.subtitle}</p>
            </div>

            <div className="onboarding-image-grid" aria-hidden="true">
              {current.cards.map((src, cardIndex) => (
                <span
                  key={src}
                  className={'onboarding-image-card' + (cardIndex === 1 ? ' is-featured' : '')}
                  style={{
                    backgroundImage: `linear-gradient(160deg, rgba(3,33,28,0.2), rgba(3,33,28,0.42)), url('${src}')`
                  }}
                />
              ))}
            </div>
          </section>

          <section className="onboarding-panel">
            <div className="steps-row" aria-label="Onboarding progress">
              {steps.map((_, i) => (
                <span key={i} className={'step-dot' + (i === index ? ' is-active' : '')} />
              ))}
            </div>

            <div className="onboarding-actions">
              {index > 0 ? <button className="onboarding-back-btn" onClick={() => setIndex((prev) => prev - 1)}>Back</button> : null}
              <IonButton className="solid-cta onboarding-cta" expand="block" onClick={onNext}>
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
