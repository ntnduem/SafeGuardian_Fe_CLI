import 'react-native-gesture-handler';
import React from 'react';
import { ImageBackground, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { EmergencyProvider } from './src/context/EmergencyContext';
import AppNavigator from './src/navigation/AppNavigator';
import appBackground from './src/image/background.png';
import { appNavigationTheme } from './src/config/navigationTheme';
import { styles } from './App.styles';
import LockScreenPermissionPrompt from './src/components/LockScreenPermissionPrompt';

export default function App() {
  return (
    <ImageBackground source={appBackground} style={styles.background} resizeMode="cover">
      <SafeAreaProvider style={styles.overlay}>
        <NavigationContainer theme={appNavigationTheme}>
          <EmergencyProvider>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <AppNavigator />
            <LockScreenPermissionPrompt />
          </EmergencyProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </ImageBackground>
  );
}
