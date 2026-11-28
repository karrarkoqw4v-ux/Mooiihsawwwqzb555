import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';
// التصميم مبني على اتجاه ثابت (يسار→يمين) حتى لا تنقلب الواجهة على هواتف العربي
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
import App from './App';
registerRootComponent(App);
