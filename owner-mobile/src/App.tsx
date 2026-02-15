import { IonApp } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, Switch } from 'react-router-dom';
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import LaunchGate from './pages/LaunchGate';
import AppShell from './components/AppShell';
import { useOnboardingStore } from './store/onboarding';
import { useSessionStore } from './store/session';
import { useOwnerBootstrap } from './hooks/useOwnerBootstrap';

const App = () => {
  const onboardingComplete = useOnboardingStore((state) => state.complete);
  const onboardingHydrated = useOnboardingStore((state) => state.hydrated);
  const token = useSessionStore((state) => state.token);
  const sessionHydrated = useSessionStore((state) => state.hydrated);
  const { bootstrapping } = useOwnerBootstrap();

  const ready = onboardingHydrated && sessionHydrated && !bootstrapping;
  const launchPath = !onboardingComplete ? '/onboarding' : token ? '/app/home' : '/auth';

  if (!ready) {
    return (
      <IonApp>
        <LaunchGate />
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <Switch>
          <Route
            path="/onboarding"
            render={() => (onboardingComplete ? <Redirect to={token ? '/app/home' : '/auth'} /> : <OnboardingPage />)}
          />
          <Route
            path="/auth"
            render={() =>
              !onboardingComplete ? <Redirect to="/onboarding" /> : token ? <Redirect to="/app/home" /> : <AuthPage />
            }
          />
          <Route
            path="/app"
            render={() =>
              !onboardingComplete ? <Redirect to="/onboarding" /> : token ? <AppShell /> : <Redirect to="/auth" />
            }
          />
          <Route path="*" render={() => <Redirect to={launchPath} />} />
        </Switch>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
