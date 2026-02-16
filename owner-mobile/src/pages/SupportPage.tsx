import { useCallback, useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { ownerDashboardApi } from '../api/client';
import { getErrorMessage } from '../utils/error';

interface FAQ { question: string; answer: string }

const SupportPage = () => {
  const [present] = useIonToast();
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [whatsApp, setWhatsApp] = useState<string | null>(null);
  const [faq, setFaq] = useState<FAQ[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ownerDashboardApi.supportContent();
      setSupportEmail(res.data.supportEmail);
      setWhatsApp(res.data.supportWhatsAppNumber);
      setFaq(res.data.faq || []);
    } catch (error: unknown) {
      present({ message: getErrorMessage(error, 'Failed to load support info'), duration: 2200, color: 'danger' });
    }
  }, [present]);

  useIonViewWillEnter(() => { void load(); });

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/app/more" /></IonButtons>
          <IonTitle>Help & Support</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(r) => load().finally(() => r.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          <section className="surface-card">
            <h3>Contact Us</h3>
            {supportEmail && (
              <a className="more-menu-item" href={'mailto:' + supportEmail}>
                <span>Email: {supportEmail}</span>
              </a>
            )}
            {whatsApp && (
              <a className="more-menu-item" href={'https://wa.me/' + whatsApp.replace(/\D/g, '')} target="_blank" rel="noreferrer">
                <span>WhatsApp: {whatsApp}</span>
              </a>
            )}
            {!supportEmail && !whatsApp && (
              <p className="event-subline">No contact information available yet.</p>
            )}
          </section>

          {faq.length > 0 && (
            <section className="surface-card">
              <h3>Frequently Asked Questions</h3>
              <div className="event-list">
                {faq.map((item, i) => (
                  <button
                    key={i}
                    className="event-list-item stack"
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    style={{ textAlign: 'left' }}
                  >
                    <p className="event-title">{item.question}</p>
                    {expanded === i && <p className="event-subline" style={{ marginTop: 6 }}>{item.answer}</p>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default SupportPage;
