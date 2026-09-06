/**
 * 物种图鉴 - 动物分类识别 App
 * Animal Classifier App
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BootSplash from 'react-native-bootsplash';
import { AppNavigator } from './src/navigation';
import { AppProvider } from './src/store';

function App(): React.JSX.Element {
  useEffect(() => {
    // 隐藏启动画面
    BootSplash.hide({ fade: true });
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar translucent backgroundColor="transparent" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

export default App;
