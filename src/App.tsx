import { useApp } from './AppContext';
import { HomeScreen } from './screens/HomeScreen';
import { AddBeanScreen } from './screens/AddBeanScreen';
import { ResearchingScreen } from './screens/ResearchingScreen';
import { BeanDetailScreen } from './screens/BeanDetailScreen';
import { EditSettingsScreen } from './screens/EditSettingsScreen';
import { GuidedBrewFlow } from './components/GuidedBrewFlow';
import { DialInTasteScreen } from './screens/DialInTasteScreen';
import { DialInAdjustmentScreen } from './screens/DialInAdjustmentScreen';
import { DialInConvergeScreen } from './screens/DialInConvergeScreen';
import { AppSettingsScreen } from "./screens/AppSettingsScreen";

export function App() {
  const { screen } = useApp();

  switch (screen.id) {
    case 'home':
      return <HomeScreen />;
    case "app-settings":
      return <AppSettingsScreen />;
    case 'add-bean':
      return <AddBeanScreen />;
    case 'researching':
      return <ResearchingScreen beanId={screen.beanId} />;
    case 'bean-detail':
      return <BeanDetailScreen beanId={screen.beanId} />;
    case 'edit-settings':
      return <EditSettingsScreen beanId={screen.beanId} brewSize={screen.brewSize} recipeId={screen.recipeId} />;
    case 'guided-brew':
      return <GuidedBrewFlow recipeId={screen.recipeId} mode={screen.mode} />;
    case 'taste':
      return <DialInTasteScreen sessionId={screen.sessionId} />;
    case 'adjustment':
      return <DialInAdjustmentScreen sessionId={screen.sessionId} eventId={screen.eventId} />;
    case 'converge':
      return <DialInConvergeScreen sessionId={screen.sessionId} />;
    default:
      return <HomeScreen />;
  }
}
