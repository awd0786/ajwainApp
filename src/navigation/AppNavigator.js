import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import MainShell from './MainShell';
import { useTheme } from '../theme/theme';

/**
 * Login ⇄ app shell switch. The web app swaps pages through a single
 * `currentPage` string (App.jsx) instead of URL routing; MainShell keeps
 * that model so page keys and role rules map 1:1.
 */
export default function AppNavigator() {
  const { isAuthenticated, bootstrapping } = useAuth();
  const { c } = useTheme();

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }
  return isAuthenticated ? <MainShell /> : <LoginScreen />;
}
