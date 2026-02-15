import { Suspense, lazy } from 'react';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/react';
import {
  homeOutline,
  calendarOutline,
  cashOutline,
  personCircleOutline
} from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';

const HomePage = lazy(() => import('../pages/HomePage'));
const EventsPage = lazy(() => import('../pages/EventsPage'));
const EventDetailsPage = lazy(() => import('../pages/EventDetailsPage'));
const PayoutsPage = lazy(() => import('../pages/PayoutsPage'));
const AccountPage = lazy(() => import('../pages/AccountPage'));

const AppShell = () => {
  return (
    <IonTabs>
      <Suspense fallback={<div className="screen-content"><p className="muted-text">Loading...</p></div>}>
        <IonRouterOutlet>
          <Route path="/app/home" component={HomePage} exact />
          <Route path="/app/events" component={EventsPage} exact />
          <Route path="/app/events/:eventId" component={EventDetailsPage} exact />
          <Route path="/app/payouts" component={PayoutsPage} exact />
          <Route path="/app/account" component={AccountPage} exact />
          <Route exact path="/app/profile">
            <Redirect to="/app/account" />
          </Route>
          <Route exact path="/app/wallet">
            <Redirect to="/app/payouts" />
          </Route>
          <Route exact path="/app">
            <Redirect to="/app/home" />
          </Route>
        </IonRouterOutlet>
      </Suspense>

      <IonTabBar slot="bottom" className="owner-tab-bar">
        <IonTabButton tab="home" href="/app/home">
          <IonIcon aria-hidden="true" icon={homeOutline} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>

        <IonTabButton tab="events" href="/app/events">
          <IonIcon aria-hidden="true" icon={calendarOutline} />
          <IonLabel>Events</IonLabel>
        </IonTabButton>

        <IonTabButton tab="payouts" href="/app/payouts">
          <IonIcon aria-hidden="true" icon={cashOutline} />
          <IonLabel>Payouts</IonLabel>
        </IonTabButton>

        <IonTabButton tab="account" href="/app/account">
          <IonIcon aria-hidden="true" icon={personCircleOutline} />
          <IonLabel>Account</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default AppShell;
