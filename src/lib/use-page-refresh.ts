// 页面数据刷新 Hook: 标签页重新激活时自动刷新
// 用于保证所有页面展示的信息都是最新的
// skipInitial: 是否跳过挂载时的首次刷新 (默认 false, 即挂载时也刷新)
import { useEffect, useRef, useCallback } from 'react';

export function usePageRefresh(refresh: () => void, deps: any[] = [], skipInitial = false) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const skippedRef = useRef(false);

  const stableRefresh = useCallback(() => {
    refreshRef.current();
  }, []);

  useEffect(() => {
    // 是否跳过本次挂载时的刷新
    if (!skipInitial || skippedRef.current) {
      stableRefresh();
    }
    skippedRef.current = true;

    // 标签页重新可见时刷新
    const onVisibility = () => {
      if (document.visibilityState === 'visible') stableRefresh();
    };
    // 窗口重新获得焦点时刷新
    const onFocus = () => stableRefresh();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
