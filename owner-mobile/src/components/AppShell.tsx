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

import HomePage from '../pages/HomePage';
import EventsPage from '../pages/EventsPage';
import EventDetailsPage from '../pages/EventDetailsPage';
import PayoutsPage from '../pages/PayoutsPage';
import AccountPage from '../pages/AccountPage';

const AppShell = () => {
  return (
    <IonTabs>
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
