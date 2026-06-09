import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme, App as AntApp } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  EditOutlined,
  BarChartOutlined,
  SettingOutlined,
  TrophyOutlined,
  StarOutlined,
  FileSearchOutlined,
  CloudDownloadOutlined,
  StarOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import type { MenuProps } from 'antd';
import HomePage from './pages/HomePage';
import QuestionBankPage from './pages/QuestionBankPage';
import PracticePage from './pages/PracticePage';
import ReviewPage from './pages/ReviewPage';
import WrongBookPage from './pages/WrongBookPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import ScraperPage from './pages/ScraperPage';
import GamificationPage from './pages/GamificationPage';
import useThemeStore from './stores/useThemeStore';

const { Content, Sider } = Layout;

const ReviewHistory = () => <ReviewPage defaultTab="history" />;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/bank', icon: <BookOutlined />, label: '题库' },
  { key: '/practice', icon: <EditOutlined />, label: '练习' },
  { key: '/review', icon: <FileSearchOutlined />, label: '复盘' },
  { key: '/wrongbook', icon: <TrophyOutlined />, label: '错题本' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计' },
  { key: '/achievements', icon: <StarOutlined />, label: '成就' },
  { type: 'divider' },
  { key: '/scraper', icon: <CloudDownloadOutlined />, label: '题源管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const themeMode = useThemeStore((s) => s.theme);

  const resolvedTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    window.api.settingsGet().then((settings) => {
      useThemeStore.getState().setTheme(settings.theme);
    });
  }, []);

  useEffect(() => {
    if (themeMode === 'system' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => useThemeStore.getState().setTheme('system');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [themeMode]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontSize: 14,
        },
        components: {
          Layout: {
            siderBg: isDark ? '#001529' : '#f0f2f5',
            bodyBg: isDark ? '#141414' : '#f5f5f5',
          },
          Menu: {
            darkItemBg: isDark ? '#001529' : undefined,
          },
        },
      }}
    >
      <AntApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            theme={isDark ? 'dark' : 'light'}
            style={{
              overflow: 'auto',
              height: '100vh',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
            }}
          >
            <div style={{
              height: 48,
              margin: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#fff' : '#333',
              fontWeight: 'bold',
              fontSize: collapsed ? 14 : 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              {collapsed ? 'C6' : '\uD83D\uDCDA CET6\u5907\u8003\u52A9\u624B'}
            </div>
            <Menu
              theme={isDark ? 'dark' : 'light'}
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
            />
          </Sider>
          <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
            <Content style={{ margin: 0, padding: 0, overflow: 'auto', minHeight: '100vh' }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/bank" element={<QuestionBankPage />} />
                <Route path="/practice" element={<PracticePage />} />
                <Route path="/review" element={<ReviewHistory />} />
                <Route path="/wrongbook" element={<WrongBookPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/achievements" element={<GamificationPage />} />
                <Route path="/scraper" element={<ScraperPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
};

export default App;