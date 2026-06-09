import React from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme, App as AntApp } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  EditOutlined,
  BarChartOutlined,
  SettingOutlined,
  TrophyOutlined,
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

const { Content, Sider } = Layout;

// Wrapper to pass defaultTab prop
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

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            theme="dark"
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
              color: '#fff',
              fontWeight: 'bold',
              fontSize: collapsed ? 14 : 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              {collapsed ? 'C6' : '📚 CET6备考助手'}
            </div>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
            />
          </Sider>
          <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
            <Content style={{ margin: 0, padding: 0, overflow: 'auto' }}>
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
