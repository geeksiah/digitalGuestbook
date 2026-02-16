import { IonContent, IonPage } from '@ionic/react';

const LaunchGate = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="launch-screen">
        <div className="launch-wrap">
          <div className="brand-mark">E</div>
          <h1>EventPeepo</h1>
          <p>Owner workspace</p>
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
