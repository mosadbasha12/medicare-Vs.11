import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { UserProvider } from './src/context/UserContext';

export default function App() {
  return (
    <UserProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </UserProvider>
  );
}
