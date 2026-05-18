import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { UserProvider } from './src/context/UserContext';
import { LanguageProvider } from './src/context/LanguageContext';
import AppUpdatePrompt from './src/components/AppUpdatePrompt';

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
          <AppUpdatePrompt />
        </NavigationContainer>
      </UserProvider>
    </LanguageProvider>
  );
}

