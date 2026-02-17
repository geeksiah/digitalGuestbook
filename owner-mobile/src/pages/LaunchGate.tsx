import { IonContent, IonPage } from '@ionic/react';

const LaunchGate = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="launch-screen">
        <div className="launch-wrap">
          <img className="brand-logo" src="/img/logo-light.svg" alt="EventPeepo" />
          <div className="pulse-loader">
            <span />
            <span />
            <span />
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LaunchGate;
