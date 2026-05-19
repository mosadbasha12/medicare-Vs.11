import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';

import HomeScreen from '../screens/HomeScreen';
import DoctorsScreen from '../screens/DoctorsScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import PaymentScreen from '../screens/PaymentScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import LanguageScreen from '../screens/LanguageScreen';
import ThemeScreen from '../screens/ThemeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import PrescriptionsScreen from '../screens/PrescriptionsScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import AdminDashboard from '../screens/AdminDashboard';
import DoctorDashboard from '../screens/DoctorDashboard';
import DoctorScheduleScreen from '../screens/DoctorScheduleScreen';
import BookingScreen from '../screens/BookingScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import DoctorProfileScreen from '../screens/DoctorProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: 'bold' },
        tabBarLabel:
          route.name === 'الرئيسية'
            ? t('home')
            : route.name === 'الأطباء'
              ? t('doctors')
              : route.name === 'المواعيد'
                ? t('appointments')
                : t('account'),
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarIcon: ({ focused }) => {
          let iconName = 'home';
          if (route.name === 'الرئيسية') iconName = 'home';
          else if (route.name === 'الأطباء') iconName = 'user-md';
          else if (route.name === 'المواعيد') iconName = 'calendar-alt';
          else if (route.name === 'حسابي') iconName = 'user';

          return (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <FontAwesome5 name={iconName as any} size={18} color={focused ? COLORS.primaryLight : COLORS.textSecondary} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="الرئيسية" component={HomeScreen} />
      <Tab.Screen name="الأطباء" component={DoctorsScreen} />
      <Tab.Screen name="المواعيد" component={AppointmentsScreen} />
      <Tab.Screen name="حسابي" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default function AppNavigator() {
  const { user, isLoading } = useUser();
  const navKey = user ? `auth-${user.uid}` : 'no-auth';
  const initialRouteName = user?.role === 'doctor'
      ? 'DoctorDashboard'
      : user
        ? 'MainTabs'
        : 'Onboarding';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgBase, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primaryLight} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={navKey}
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRouteName}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="ChatList" component={ChatListScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
          <Stack.Screen name="Payment" component={PaymentScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Language" component={LanguageScreen} />
          <Stack.Screen name="Theme" component={ThemeScreen} />
          <Stack.Screen name="Transactions" component={TransactionsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} />
          <Stack.Screen name="Emergency" component={EmergencyScreen} />
          <Stack.Screen name="Admin" component={AdminDashboard} />
          <Stack.Screen name="DoctorDashboard" component={DoctorDashboard} />
          <Stack.Screen name="DoctorSchedule" component={DoctorScheduleScreen} />
          <Stack.Screen name="Booking" component={BookingScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.bgSidebar,
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    elevation: 0,
    borderRadius: 30,
    height: 70,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 20,
  },
  iconContainerFocused: {
    backgroundColor: COLORS.primarySoft,
  },
});
