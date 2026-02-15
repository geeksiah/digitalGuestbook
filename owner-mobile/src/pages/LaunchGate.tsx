import { IonContent, IonPage, IonSpinner } from '@ionic/react';

const LaunchGate = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="launch-screen">
        <div className="launch-wrap">
          <div className="brand-mark">E</div>
          <h1>EventPeepo Owner</h1>
          <p>Preparing your workspace</p>
          <IonSpinner name="crescent" />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LaunchGate;
