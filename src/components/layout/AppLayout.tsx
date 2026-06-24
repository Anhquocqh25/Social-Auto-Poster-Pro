import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

type SidebarMode = 'full' | 'compact' | 'hidden';

function getSidebarMode(width: number): SidebarMode {
  if (width < 960) {
    return 'hidden';
  }

  if (width < 1280) {
    return 'compact';
  }

  return 'full';
}

export function AppLayout() {
  const location = useLocation();
  const contentScrollRef = useRef<HTMLElement | null>(null);
  const scrollResetFrameRef = useRef<number | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() =>
    typeof window === 'undefined' ? 'full' : getSidebarMode(window.innerWidth)
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const resetMainScrollPosition = useCallback(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const content = contentScrollRef.current;

    if (!content) {
      return;
    }

    content.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
    content.scrollTop = 0;
    content.scrollLeft = 0;
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    resetMainScrollPosition();

    if (scrollResetFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollResetFrameRef.current);
    }

    scrollResetFrameRef.current = window.requestAnimationFrame(() => {
      resetMainScrollPosition();
      scrollResetFrameRef.current = null;
    });

    return () => {
      if (scrollResetFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollResetFrameRef.current);
        scrollResetFrameRef.current = null;
      }
    };
  }, [location.key, resetMainScrollPosition]);

  useEffect(() => {
    const handleResize = () => {
      const nextMode = getSidebarMode(window.innerWidth);
      setSidebarMode(nextMode);

      if (nextMode !== 'hidden') {
        setMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  const showMobileSidebar = sidebarMode === 'hidden' && mobileSidebarOpen;

  return (
    <div className="so9-shell so9-app-gradient bg-background text-foreground">
      {sidebarMode === 'hidden' ? (
        <>
          <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
          {showMobileSidebar ? (
            <button
              type="button"
              aria-label="Close navigation"
              className="fixed inset-0 z-30 bg-[#081120]/60 backdrop-blur-[2px]"
              onClick={() => setMobileSidebarOpen(false)}
            />
          ) : null}
        </>
      ) : (
        <Sidebar compact={sidebarMode === 'compact'} />
      )}

      <div className="so9-main">
        <Topbar
          onToggleSidebar={() => setMobileSidebarOpen((current) => !current)}
          showMenuButton={sidebarMode !== 'full'}
          isSidebarOpen={mobileSidebarOpen}
        />
        <main ref={contentScrollRef} className="so9-content">
          <div className="mx-auto w-full max-w-[1480px]">
            <div className="space-y-6">
              <div className="so9-subtle-panel hidden xl:block">
                <div className="so9-responsive-stack">
                  <div>
                    <p className="so9-muted-label">Social Auto Poster Pro</p>
                    <p className="mt-2 text-sm font-semibold text-[#17233b]">
                      Personal Facebook Page publishing workspace
                    </p>
                    <p className="mt-1 text-sm text-[#62728b]">
                      Safe daily UI for channels, posts, diagnostics, and controlled publishing review.
                    </p>
                  </div>
                  <div className="so9-inline-meta">
                    <span className="so9-filter-pill">Facebook-first workflow</span>
                    <span className="so9-filter-pill">Video / Image / Text</span>
                    <span className="so9-filter-pill">Safe local review</span>
                  </div>
                </div>
              </div>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
