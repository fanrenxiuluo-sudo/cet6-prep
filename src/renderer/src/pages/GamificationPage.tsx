/**
 * 成就系统页面 — 等级、经验值、成就展示
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  List,
  Badge,
  Spin,
  Empty,
  Tooltip,
  Statistic,
} from 'antd';
import {
  TrophyOutlined,
  StarOutlined,
  FireOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  reward: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

interface UserProfile {
  level: number;
  experience: number;
  nextLevelExp: number;
  totalPoints: number;
  streakDays: number;
  achievements: Achievement[];
  recentAchievements: Achievement[];
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  practice: { label: '练习', color: 'blue' },
  accuracy: { label: '正确率', color: 'green' },
  wrongbook: { label: '错题', color: 'orange' },
  streak: { label: '连续', color: 'red' },
  special: { label: '特殊', color: 'purple' },
};

export default function GamificationPage() {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.gameProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading || !profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 计算升级进度
  const levelProgress = ((profile.experience / profile.nextLevelExp) * 100).toFixed(0);

  // 过滤成就
  const filteredAchievements = filterCategory === 'all'
    ? profile.achievements
    : profile.achievements.filter(a => a.category === filterCategory);

  // 已解锁成就数
  const unlockedCount = profile.achievements.filter(a => a.unlocked).length;

  return (
    <div style={{ padding: 24 }}>
      {/* 用户等级卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[24, 24]} align="middle">
          <Col>
            <div style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              color: '#fff',
              fontWeight: 'bold',
            }}>
              {profile.level}
            </div>
          </Col>
          <Col flex="auto">
            <h2 style={{ margin: 0 }}>
              <CrownOutlined style={{ marginRight: 8, color: '#faad14' }} />
              等级 {profile.level}
            </h2>
            <div style={{ color: '#999', marginBottom: 16 }}>
              距离下一级还需 {profile.nextLevelExp - profile.experience} 经验值
            </div>
            <Progress
              percent={Math.min(Number(levelProgress), 100)}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Col>
          <Col>
            <Statistic
              title="总经验值"
              value={profile.experience}
              prefix={<StarOutlined />}
              suffix={`/ ${profile.nextLevelExp}`}
            />
          </Col>
        </Row>
      </Card>

      {/* 统计概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总积分"
              value={profile.totalPoints}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="连续学习"
              value={profile.streakDays}
              suffix="天"
              prefix={<FireOutlined />}
              valueStyle={{ color: profile.streakDays > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已解锁成就"
              value={unlockedCount}
              suffix={`/ ${profile.achievements.length}`}
              prefix={<StarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="解锁率"
              value={(unlockedCount / profile.achievements.length * 100).toFixed(0)}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近解锁 */}
      {profile.recentAchievements.length > 0 && (
        <Card title="最近解锁" style={{ marginBottom: 24 }}>
          <List
            dataSource={profile.recentAchievements}
            renderItem={(achievement) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}>
                      {achievement.icon}
                    </div>
                  }
                  title={
                    <Space>
                      {achievement.name}
                      <Tag color={CATEGORY_MAP[achievement.category]?.color}>
                        {CATEGORY_MAP[achievement.category]?.label}
                      </Tag>
                      <Tag color="gold">+{achievement.reward} EXP</Tag>
                    </Space>
                  }
                  description={
                    <span style={{ color: '#999' }}>
                      {achievement.description}
                      {achievement.unlockedAt && (
                        <span style={{ marginLeft: 8 }}>
                          - {dayjs(achievement.unlockedAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      )}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 成就列表 */}
      <Card
        title="全部成就"
        extra={
          <Tag color={filterCategory === 'all' ? 'blue' : undefined}>
            {filterCategory === 'all' ? '全部' : CATEGORY_MAP[filterCategory]?.label}
          </Tag>
        }
      >
        <List
          dataSource={filteredAchievements}
          renderItem={(achievement) => (
            <List.Item
              style={{
                opacity: achievement.unlocked ? 1 : 0.6,
              }}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: achievement.unlocked ? '#f6ffed' : '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    border: achievement.unlocked ? '2px solid #52c41a' : '2px solid #d9d9d9',
                  }}>
                    {achievement.icon}
                  </div>
                }
                title={
                  <Space>
                    {achievement.name}
                    <Tag color={CATEGORY_MAP[achievement.category]?.color}>
                      {CATEGORY_MAP[achievement.category]?.label}
                    </Tag>
                    {achievement.unlocked ? (
                      <Tag color="success">已解锁</Tag>
                    ) : (
                      <Tag>未解锁</Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>{achievement.description}</div>
                    {!achievement.unlocked && (
                      <Progress
                        percent={Math.round((achievement.progress / achievement.target) * 100)}
                        size="small"
                        style={{ width: 200 }}
                      />
                    )}
                    <span style={{ color: '#999', fontSize: 12 }}>
                      进度：{achievement.progress}/{achievement.target} | 奖励：+{achievement.reward} EXP
                    </span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
