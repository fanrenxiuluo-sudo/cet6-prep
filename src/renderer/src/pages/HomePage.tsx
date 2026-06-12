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
          {getGreeting()}，准备开始学习了吗？
        </h2>
        <p style={{ color: '#8c8c8c', margin: '8px 0 0' }}>
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="题库总量"
              value={data.stats.totalQuestions}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日已练"
              value={data.stats.todayPracticed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: data.stats.todayPracticed > 0 ? '#3f8600' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="正确率"
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
              title="连续学习"
              value={data.stats.streakDays}
              suffix="天"
              prefix={<FireOutlined />}
              valueStyle={{ color: data.stats.streakDays > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待复习"
              value={data.stats.dueForReview}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: data.stats.dueForReview > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="错题总数"
              value={data.stats.wrongCount}
              prefix={<AlertOutlined />}
              valueStyle={{ color: data.stats.wrongCount > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="今日任务" extra={<a onClick={() => navigate('/practice')}>查看全部</a>}>
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
                            {task.priority === 'high' ? '重要' : task.priority === 'medium' ? '建议' : '可选'}
                          </Tag>
                        </Space>
                      }
                      description={task.description}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="今日任务已完成" />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="最近活动" extra={<a onClick={() => navigate('/review')}>查看全部</a>}>
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
                          background: activity.description === '回答正确' ? '#52c41a20' : '#ff4d4f20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: activity.description === '回答正确' ? '#52c41a' : '#ff4d4f',
                        }}>
                          {activity.description === '回答正确' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        </div>
                      }
                      title={activity.title}
                      description={
                        <Space>
                          <span style={{ color: activity.description === '回答正确' ? '#52c41a' : '#ff4d4f' }}>
                            {activity.description}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无活动记录" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="快捷入口" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<BookOutlined />}
              onClick={() => navigate('/practice')}
            >
              开始练习
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
              错题复习 {data.stats.dueForReview > 0 && `(${data.stats.dueForReview})`}
            </Button>
          </Col>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<TrophyOutlined />}
              onClick={() => navigate('/stats')}
            >
              查看统计
            </Button>
          </Col>
          <Col span={6}>
            <Button
              block
              size="large"
              icon={<ImportOutlined />}
              onClick={() => navigate('/bank')}
            >
              导入题目
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
}