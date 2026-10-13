import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { PermissionProvider } from '../context/PermissionContext';
import { ShellProvider, useShell } from './ShellContext';
import { getDefaultPage, isPageAllowed, PAGE_META } from '../auth/navigationMap';
import AppHeader from './AppHeader';
import AppDrawer from './AppDrawer';
import ChangePasswordSheet from '../components/ChangePasswordSheet';
import BiometricSheet from '../components/BiometricSheet';
import { PAGES } from './pages';
import PushBridge from '../push/PushBridge';
import { Empty } from '../ui';
import { useTheme } from '../theme/theme';

function ShellBody() {
  const { session, logout } = useAuth();
  const { c } = useTheme();
  const { currentPage, replace, canGoBack, goBack, headerActions, drawerOpen, setDrawerOpen } = useShell();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  // Android hardware back: close drawer → go back → default
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (canGoBack) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [drawerOpen, canGoBack, goBack, setDrawerOpen]);

  const meta = PAGE_META[currentPage] || { label: 'Ajwain' };
  const allowed = isPageAllowed(session.role, currentPage);
  const PageComponent = PAGES[currentPage];

  const body = useMemo(() => {
    if (!allowed) return <Empty icon="lock" title="No access" subtitle="Your role does not have access to this page." />;
    if (!PageComponent) return <Empty icon="tool" title="Coming soon" subtitle="This page is not available on mobile yet." />;
    return <PageComponent key={currentPage} />;
  }, [allowed, PageComponent, currentPage]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppHeader
        title={meta.label}
        groupLabel={meta.groupLabel}
        accent={meta.color}
        onMenu={() => setDrawerOpen(true)}
        onBack={canGoBack ? goBack : undefined}
        actions={headerActions}
      />
      <View style={{ flex: 1 }}>{body}</View>
      <AppDrawer
        visible={drawerOpen}
        currentPage={currentPage}
        role={session.role}
        realName={session.realName}
        loginName={session.loginName}
        onNavigate={(key) => replace(key)}
        onClose={() => setDrawerOpen(false)}
        onChangePassword={() => setPwdOpen(true)}
        onBiometric={() => setBioOpen(true)}
        onLogout={logout}
      />
      <ChangePasswordSheet visible={pwdOpen} onClose={() => setPwdOpen(false)} />
      <BiometricSheet visible={bioOpen} onClose={() => setBioOpen(false)} />
    </View>
  );
}

export default function MainShell() {
  const { session } = useAuth();
  return (
    <PermissionProvider>
      <ShellProvider initialPage={getDefaultPage(session.role)}>
        <PushBridge />
        <ShellBody />
      </ShellProvider>
    </PermissionProvider>
  );
}
