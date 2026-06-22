import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  FileText,
  Globe2,
  Languages,
  LayoutDashboard,
  PenSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  Layers,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electronApi';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Button } from '@/components/ui/button';

type NavItem = {
  key: string;
  labelVi: string;
  labelEn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navigationItems: NavItem[] = [
  { key: 'dashboard', labelVi: 'Trang chủ', labelEn: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'create-post', labelVi: 'Đăng bài viết', labelEn: 'Create Post', href: '/create-post', icon: PenSquare },
  { key: 'posts', labelVi: 'Quản lý bài đăng', labelEn: 'Posts', href: '/posts', icon: FileText },
  { key: 'connected-channels', labelVi: 'Kết nối kênh', labelEn: 'Connected Channels', href: '/connected-channels', icon: Globe2 },
  { key: 'bulk-create', labelVi: 'Đăng hàng loạt', labelEn: 'Bulk Create', href: '/bulk-create', icon: Layers },
  { key: 'accounts', labelVi: 'Tài khoản Facebook', labelEn: 'Facebook Accounts', href: '/accounts', icon: Users },
  { key: 'diagnostics', labelVi: 'Chẩn đoán', labelEn: 'Diagnostics', href: '/diagnostics', icon: Activity },
  { key: 'settings', labelVi: 'Cài đặt', labelEn: 'Settings', href: '/settings', icon: Settings },
];

function SidebarNavItem({
  item,
  label,
  compact = false,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-medium text-[#9fb0c8] transition-all duration-150 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]',
          compact && 'justify-center px-2',
          isActive && 'bg-[#1b4fff] text-white shadow-[0_18px_34px_rgba(27,79,255,0.32)]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-[#8ea0be] transition-colors group-hover:bg-white/10 group-hover:text-white',
              isActive && 'border-[#3f7cff] bg-white/14 text-white'
            )}
          >
            <item.icon className="h-5 w-5" />
          </span>
          {!compact ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
          {!compact ? (
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 text-[#70819c] transition-transform group-hover:translate-x-0.5 group-hover:text-white',
                isActive && 'text-white'
              )}
            />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({
  compact = false,
  mobileOpen = false,
  onCloseMobile,
}: {
  compact?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const electronAPI = getElectronAPI();
  const { language, setLanguage } = useLanguageStore();

  const [realPublishingEnabled, setRealPublishingEnabled] = useState(false);
  const [connectionModeLabel, setConnectionModeLabel] = useState<string>('');

  useEffect(() => {
    const loadSidebarStatus = async () => {
      try {
        const status = await electronAPI.accounts.getConnectionStatus();
        setRealPublishingEnabled(Boolean(status.facebook.realPublishingEnabled));
        setConnectionModeLabel(
          status.simulationMode
            ? language === 'vi'
              ? 'Chế độ mô phỏng'
              : 'Simulation mode'
            : language === 'vi'
              ? 'Chế độ an toàn'
              : 'Safe mode'
        );
      } catch {
        setRealPublishingEnabled(false);
        setConnectionModeLabel(language === 'vi' ? 'Chế độ an toàn' : 'Safe mode');
      }
    };

    void loadSidebarStatus();
  }, [electronAPI, language]);

  const currentLabel = useMemo(() => {
    const current = navigationItems.find((item) =>
      item.href === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.href)
    );

    if (!current) {
      return language === 'vi' ? 'Điều hướng' : 'Navigation';
    }

    return language === 'vi' ? current.labelVi : current.labelEn;
  }, [language, location.pathname]);

  return (
    <aside
      className={cn(
        'so9-sidebar fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 md:sticky',
        compact ? 'w-[94px]' : 'w-[292px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}
      aria-hidden={!mobileOpen && !compact}
    >
      <div className={cn('flex h-full flex-col gap-5 px-4 py-5', compact && 'px-3')}>
        <NavLink
          to="/"
          onClick={onCloseMobile}
          className={cn(
            'rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]',
            compact && 'px-3 py-3'
          )}
          title="Social Auto Poster Pro"
        >
          <div className={cn('flex items-center gap-3', compact && 'justify-center')}>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#1b4fff] text-white shadow-[0_12px_28px_rgba(27,79,255,0.34)]">
              <Clapperboard className="h-5 w-5" />
            </div>
            {!compact ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">Social Auto Poster Pro</p>
                <p className="truncate text-xs text-[#8ea0be]">
                  {language === 'vi' ? 'Bảng điều khiển đăng bài cá nhân' : 'Personal publishing workspace'}
                </p>
              </div>
            ) : null}
          </div>

          {!compact ? (
            <div className="mt-4 rounded-[18px] border border-white/10 bg-[#0e1727] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f84a5]">
                {language === 'vi' ? 'Đang xem' : 'Current view'}
              </p>
              <p className="mt-2 truncate text-sm font-medium text-white">{currentLabel}</p>
            </div>
          ) : null}
        </NavLink>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#62748f]">
            {language === 'vi' ? 'Điều hướng chính' : 'Main navigation'}
          </p>
          <nav className="space-y-2">
            {navigationItems.map((item) => (
              <SidebarNavItem
                key={item.key}
                item={item}
                label={language === 'vi' ? item.labelVi : item.labelEn}
                compact={compact}
                onNavigate={onCloseMobile}
              />
            ))}
          </nav>
        </div>

        <div className={cn('mt-auto rounded-[20px] border border-white/10 bg-[#0e1727] px-3 py-3', compact && 'px-2 py-2')}>
          <div className={cn('flex items-center gap-2', compact && 'justify-center')}>
            {realPublishingEnabled ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-[#ff9b90]" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#7db0ff]" />
            )}
            {!compact ? (
              <span className="text-sm font-medium text-white">
                {realPublishingEnabled
                  ? language === 'vi'
                    ? 'Đăng thật: Đang bật'
                    : 'Real publishing: On'
                  : language === 'vi'
                    ? 'Đăng thật: Đang tắt'
                    : 'Real publishing: Off'}
              </span>
            ) : null}
          </div>

          {!compact ? (
            <>
              <p className="mt-3 text-sm font-semibold text-white">Social Auto Poster Pro</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#6f84a5]">
                {connectionModeLabel}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={language === 'vi' ? 'default' : 'outline'}
                  className={cn(
                    'rounded-[14px] border text-xs',
                    language === 'vi'
                      ? 'border-[#3f7cff] bg-[#1b4fff] text-white hover:bg-[#1847d9]'
                      : 'border-white/10 bg-white/5 text-[#c7d4e8] hover:bg-white/10 hover:text-white'
                  )}
                  onClick={() => setLanguage('vi')}
                >
                  <Languages className="mr-1 h-3.5 w-3.5" />
                  VI
                </Button>
                <Button
                  type="button"
                  variant={language === 'en' ? 'default' : 'outline'}
                  className={cn(
                    'rounded-[14px] border text-xs',
                    language === 'en'
                      ? 'border-[#3f7cff] bg-[#1b4fff] text-white hover:bg-[#1847d9]'
                      : 'border-white/10 bg-white/5 text-[#c7d4e8] hover:bg-white/10 hover:text-white'
                  )}
                  onClick={() => setLanguage('en')}
                >
                  <Languages className="mr-1 h-3.5 w-3.5" />
                  EN
                </Button>
              </div>

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-[16px] border border-white/10 bg-[#111b2d] px-3 py-2.5 text-left text-sm text-[#d7e1ef] transition-colors hover:bg-[#14213a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1220]"
                onClick={() => {
                  onCloseMobile?.();
                  navigate('/settings');
                }}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[#7ea7ff]" />
                  {language === 'vi' ? 'Cài đặt' : 'Settings'}
                </span>
                <ChevronRight className="h-4 w-4 text-[#7b8aa2]" />
              </button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full rounded-[14px] border-white/10 bg-white/5 px-0 text-[#c7d4e8] hover:bg-white/10 hover:text-white"
              onClick={() => {
                onCloseMobile?.();
                navigate('/settings');
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
