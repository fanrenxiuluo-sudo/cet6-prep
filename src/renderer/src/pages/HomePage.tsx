import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button, List, Tag, Space, Spin, Empty } from 'antd';
import {
  BookOutlined,
  TrophyOutlined,
  FireOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  RightOutlined,
  ImportOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface TodayTask {
  type: 'practice' | 'review' | 'wrongbook' | 'import';
  title: string;
  description: string;
  count: number;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

interface QuickStats {
  totalQuestions: number;
  todayPracticed: number;
  accuracy: number;
  streakDays: number;
  dueForReview: number;
  wrongCount: number;
}

interface RecentActivity {
  id: string;
  type: 'practice' | 'review' | 'import';
  title: string;
  description: string;
  time: string;
}

interface HomeData {
  tasks: TodayTask[];
  stats: QuickStats;
  recentActivity: RecentActivity[];
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const TASK_ICON: Record<string, React.ReactNode> = {
  practice: <BookOutlined />,
  review: <ClockCircleOutlined />,
  wrongbook: <AlertOutlined />,
  import: <ImportOutlined />,
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HomeData | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.homeData();
      setData(result);
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTaskAction = (task: TodayTask) => {
    switch (task.type) {
      case 'practice':
        navigate('/practice');
        break;
      case 'review':
      case 'wrongbook':
        navigate('/wrongbook');
        break;
      case 'import':
        navigate('/bank');
        break;
      default:
        break;
    }
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          {getGreeting()}\uFF0C\u51C6\u5907\u5F00\u59CB\u5B66\u4E60\u4E86\u5417\uFF1F
        </h2>
        <p style={{ color: '#8c8c8c', margin: '8px 0 0' }}>
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u9898\u5E93\u603B\u91CF"
              value={data.stats.totalQuestions}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u4ECA\u65E5\u5DF2\u7EC3"
              value={data.stats.todayPracticed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: data.stats.todayPracticed > 0 ? '#3f8600' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u6B63\u786E\u7387"
              value={data.stats.accuracy * 100}
              precision={1}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: data.stats.accuracy >= 0.6 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u8FDE\u7EED\u5B66\u4E60"
              value={data.stats.streakDays}
              suffix="\u5929"
              prefix={<FireOutlined />}
              valueStyle={{ color: data.stats.streakDays > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u5F85\u590D\u4E60"
              value={data.stats.dueForReview}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: data.stats.dueForReview > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="\u9519\u9898\u603B\u6570"
              value={data.stats.wrongCount}
              prefix={<AlertOutlined />}
              valueStyle={{ color: data.stats.wrongCount > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="\u4ECA\u65E5\u4EFB\u52A1" extra={<a onClick={() => navigate('/practice')}>\u67E5\u770B\u5168\u90E8</a>}>
            {data.tasks.length > 0 ? (
              <List
                dataSource={data.tasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      <Button
                        type="primary"
                        size="small"
                        icon={<RightOutlined />}
                        onClick={() => handleTaskAction(task)}
                      >
                        {task.action}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: PRIORITY_COLOR[task.priority] === 'red' ? '#ff4d4f20' :
                                     PRIORITY_COLOR[task.priority] === 'orange' ? '#fa8c1620' : '#1890ff20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: PRIORITY_COLOR[task.priority] === 'red' ? '#ff4d4f' :
                                 PRIORITY_COLOR[task.priority] === 'orange' ? '#fa8c16' : '#1890ff',
                          fontSize: 24,
                        }}>
                          {TASK_ICON[task.type]}
                        </div>
                      }
                      title={
                        <Space>
                          {task.title}
                          <Tag color={PRIORITY_COLOR[task.priority]}>
                            {task.priority === 'high' ? '\u91CD\u8981' : task.priority === 'medium' ? '\u5EFA\u8BAE' : '\u53EF\u9009'}
                          </Tag>
                        </Space>
                      }
                      description={task.description}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="\u4ECA\u65E5\u4EFB\u52A1\u5DF2\u5B8C\u6210" />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="\u6700\u8FD1\u6D3B\u52A8" extra={<a onClick={() => navigate('/review')}>\u67E5\u770B\u5168\u90E8</a>}>
            {data.recentActivity.length > 0 ? (
              <List
                dataSource={data.recentActivity.slice(0, 5)}
                renderItem={(activity) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: activity.description === '\u56DE\u7B54\u6B63\u786E' ? '#52c41a20' : '#ff4d4f20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: activity.description === '\u56DE\u7B54\u6B63\u786E' ? '#52c41a' : '#ff4d4f',
                        }}>
                          {activity.description === '\u56DE\u7B54\u6B63\u786E' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        </div>
                      }
                      title={activity.title}
                      description={
                        <Space>
                          <span style={{ color: activity.description === '\u56DE\u7B54\u6B63\u786E' ? '#52c41a' : '#ff4d4f' }}>
                            {activity.description}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="\u6682\u65E0\u6D3B\u52A8\u8BB0\u5F55" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="\u5FEB\u6377\u5165\u53E3" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<BookOutlined />}
              onClick={() => navigate('/practice')}
            >
              \u5F00\u59CB\u7EC3\u4E60
            </Button>
          </Col>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<AlertOutlined />}
              onClick={() => navigate('/wrongbook')}
              danger={data.stats.dueForReview > 0}
            >
              \u9519\u9898\u590D\u4E60 {data.stats.dueForReview > 0 && `(${data.stats.dueForReview})`}
            </Button>
          </Col>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<TrophyOutlined />}
              onClick={() => navigate('/stats')}
            >
              \u67E5\u770B\u7EDF\u8BA1
            </Button>
          </Col>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<ImportOutlined />}
              onClick={() => navigate('/bank')}
            >
              \u5BFC\u5165\u9898\u76EE
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '\u591C\u6DF1\u4E86';
  if (hour < 9) return '\u65E9\u4E0A\u597D';
  if (hour < 12) return '\u4E0A\u5348\u597D';
  if (hour < 14) return '\u4E2D\u5348\u597D';
  if (hour < 18) return '\u4E0B\u5348\u597D';
  if (hour < 22) return '\u665A\u4E0A\u597D';
  return '\u591C\u6DF1\u4E86';
}