import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Shell-level navigation + header wiring.
 *
 * The web app keeps a single `currentPage` string in App.jsx and swaps the
 * body, rather than using router URLs. We keep that model so page keys,
 * permission rules and the "Go to Task" / "Create Sub Task" handoffs port
 * across unchanged.
 *
 * The web's `sessionStorage.setItem('ajwainSubTaskData', ...)` handoff is
 * replaced with in-memory `pageParams`.
 */

const ShellContext = createContext(null);

export function ShellProvider({ initialPage, children }) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageParams, setPageParams] = useState({});
  const [history, setHistory] = useState([]);
  const [headerActions, setHeaderActions] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const stateRef = useRef({ currentPage, pageParams });
  stateRef.current = { currentPage, pageParams };

  /** Navigate, pushing the current page onto an internal back stack. */
  const navigate = useCallback((pageKey, params = {}) => {
    const { currentPage: cp, pageParams: pp } = stateRef.current;
    setHistory((h) => [...h, { page: cp, params: pp }]);
    setHeaderActions([]);
    setPageParams(params);
    setCurrentPage(pageKey);
  }, []);

  /** Switch page without keeping a back stack (drawer taps). */
  const replace = useCallback((pageKey, params = {}) => {
    setHistory([]);
    setHeaderActions([]);
    setPageParams(params);
    setCurrentPage(pageKey);
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setHeaderActions([]);
      setCurrentPage(last.page);
      setPageParams(last.params || {});
      return h.slice(0, -1);
    });
  }, []);

  /* ---- Web parity helpers (App.jsx handleGoToTask / handleCreateSubTask) ---- */
  const goToTask = useCallback(
    (taskId) => {
      if (!taskId) return;
      navigate('taskView', { taskId });
    },
    [navigate],
  );

  const createSubTask = useCallback(
    (parentTask) => {
      navigate('createTask', { subTaskData: parentTask || null });
    },
    [navigate],
  );

  const value = useMemo(
    () => ({
      currentPage,
      pageParams,
      canGoBack: history.length > 0,
      navigate,
      replace,
      goBack,
      goToTask,
      createSubTask,
      headerActions,
      setHeaderActions,
      drawerOpen,
      setDrawerOpen,
    }),
    [currentPage, pageParams, history.length, navigate, replace, goBack, goToTask, createSubTask, headerActions, drawerOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}

/**
 * Register header icon buttons for the active page.
 *   useHeaderActions([{ key:'refresh', icon:'refresh-cw', onPress: reload }], [reload]);
 * Handlers are read through a ref so they are always current.
 */
export function useHeaderActions(actions, deps = []) {
  const { setHeaderActions } = useShell();
  const ref = useRef(actions);
  ref.current = actions;
  const sig = (actions || []).filter(Boolean).map((a) => `${a.key}:${a.icon}:${a.badge || ''}:${a.tint || ''}:${a.hidden ? 1 : 0}`).join('|');
  useEffect(() => {
    setHeaderActions(
      (ref.current || [])
        .filter((a) => a && !a.hidden)
        .map((a) => ({ ...a, onPress: () => (ref.current || []).find((x) => x && x.key === a.key)?.onPress?.() })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ...deps]);
  useEffect(() => () => setHeaderActions([]), [setHeaderActions]);
}
