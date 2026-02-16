import { IonContent, IonPage } from '@ionic/react';

const LaunchGate = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="launch-screen">
        <div className="launch-wrap">
          <div className="brand-mark">EP</div>
          <div className="launch-title-wrap">
            <h1>EventPeepo</h1>
            <p>Owner workspace</p>
          </div>
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
