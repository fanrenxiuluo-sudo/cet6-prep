/**
 * 数据统计页面 — ECharts 图表展示学习数据
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Tabs, Select } from 'antd';
import {
  TrophyOutlined,
  BookOutlined,
  ClockCircleOutlined,
  FireOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
  PieChartOutlined,
  HeatMapOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

const { TabPane } = Tabs;

interface ComprehensiveStats {
  overview: {
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number;
    avgTimeMs: number;
    totalDays: number;
    studyDays: number;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    todayStudied: number;
    todayAccuracy: number;
  };
  trend: Array<{ date: string; count: number; accuracy: number; avgTime: number }>;
  sectionAccuracy: Array<{ section: string; accuracy: number; total: number; correct: number }>;
  difficultyDistribution: Array<{ difficulty: number; count: number; accuracy: number }>;
  timeDistribution: Array<{ range: string; count: number; accuracy: number }>;
  masteryProgress: Array<{ date: string; mastered: number; total: number; masteryRate: number }>;
  heatmap: Array<{ date: string; count: number }>;
  wrongTrend: Array<{ date: string; newWrong: number; mastered: number; total: number }>;
}

const SECTION_MAP: Record<string, string> = {
  LISTENING: '听力',
  READING: '阅读',
  WRITING: '写作',
  TRANSLATION: '翻译',
};

export default function StatsPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [trendDays, setTrendDays] = useState(30);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.statsComprehensive();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  // 学习趋势折线图
  const trendOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['练习数量', '正确率', '平均用时(秒)'],
      textStyle: { color: '#999' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.trend.map(t => dayjs(t.date).format('MM-DD')),
      axisLabel: { color: '#999' },
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        axisLabel: { color: '#999' },
      },
      {
        type: 'value',
        name: '正确率/用时',
        axisLabel: { color: '#999', formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '练习数量',
        type: 'bar',
        data: stats.trend.map(t => t.count),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '正确率',
        type: 'line',
        yAxisIndex: 1,
        data: stats.trend.map(t => (t.accuracy * 100).toFixed(1)),
        smooth: true,
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '平均用时(秒)',
        type: 'line',
        yAxisIndex: 1,
        data: stats.trend.map(t => t.avgTime.toFixed(1)),
        smooth: true,
        itemStyle: { color: '#faad14' },
      },
    ],
  };

  // 分项正确率雷达图
  const radarOption = {
    tooltip: {},
    radar: {
      indicator: stats.sectionAccuracy.map(s => ({
        name: SECTION_MAP[s.section] || s.section,
        max: 100,
      })),
      axisName: { color: '#999' },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: stats.sectionAccuracy.map(s => (s.accuracy * 100).toFixed(1)),
            name: '正确率',
            areaStyle: { opacity: 0.3 },
          },
        ],
      },
    ],
  };

  // 难度分布饼图
  const difficultyOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}题 ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: '#999' },
    },
    series: [
      {
        type: 'pie',
        radius: '50%',
        data: stats.difficultyDistribution.map(d => ({
          value: d.count,
          name: `难度${d.difficulty}`,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  // 答题时间分布
  const timeOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.timeDistribution.map(t => t.range),
      axisLabel: { color: '#999' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
    },
    series: [
      {
        type: 'bar',
        data: stats.timeDistribution.map(t => ({
          value: t.count,
          itemStyle: { color: t.accuracy >= 0.6 ? '#52c41a' : '#ff4d4f' },
        })),
      },
    ],
  };

  // 掌握进度折线图
  const masteryOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['已掌握', '总数', '掌握率'],
      textStyle: { color: '#999' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.masteryProgress.map(m => dayjs(m.date).format('MM-DD')),
      axisLabel: { color: '#999' },
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        axisLabel: { color: '#999' },
      },
      {
        type: 'value',
        name: '掌握率',
        axisLabel: { color: '#999', formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '已掌握',
        type: 'bar',
        stack: 'total',
        data: stats.masteryProgress.map(m => m.mastered),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '总数',
        type: 'bar',
        stack: 'total',
        data: stats.masteryProgress.map(m => m.total - m.mastered),
        itemStyle: { color: '#ff4d4f' },
      },
      {
        name: '掌握率',
        type: 'line',
        yAxisIndex: 1,
        data: stats.masteryProgress.map(m => (m.masteryRate * 100).toFixed(1)),
        smooth: true,
        itemStyle: { color: '#1890ff' },
      },
    ],
  };

  // 错题趋势
  const wrongTrendOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['新增错题', '已掌握', '当前错题数'],
      textStyle: { color: '#999' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.wrongTrend.map(w => dayjs(w.date).format('MM-DD')),
      axisLabel: { color: '#999' },
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        axisLabel: { color: '#999' },
      },
    ],
    series: [
      {
        name: '新增错题',
        type: 'bar',
        data: stats.wrongTrend.map(w => w.newWrong),
        itemStyle: { color: '#ff4d4f' },
      },
      {
        name: '已掌握',
        type: 'bar',
        data: stats.wrongTrend.map(w => w.mastered),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '当前错题数',
        type: 'line',
        data: stats.wrongTrend.map(w => w.total),
        smooth: true,
        itemStyle: { color: '#faad14' },
      },
    ],
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 概览统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总练习"
              value={stats.overview.totalQuestions}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="正确率"
              value={stats.overview.accuracy * 100}
              precision={1}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: stats.overview.accuracy >= 0.6 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均用时"
              value={stats.overview.avgTimeMs / 1000}
              precision={1}
              suffix="秒"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="学习天数"
              value={stats.overview.studyDays}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="连续学习"
              value={stats.streak.currentStreak}
              suffix="天"
              prefix={<FireOutlined />}
              valueStyle={{ color: stats.streak.currentStreak > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日练习"
              value={stats.streak.todayStudied}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Tabs defaultActiveKey="trend">
        <TabPane tab="学习趋势" key="trend">
          <Card>
            <ReactECharts option={trendOption} style={{ height: 400 }} />
          </Card>
        </TabPane>

        <TabPane tab="分项正确率" key="radar">
          <Card>
            <ReactECharts option={radarOption} style={{ height: 400 }} />
          </Card>
        </TabPane>

        <TabPane tab="难度分布" key="difficulty">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="题目难度分布">
                <ReactECharts option={difficultyOption} style={{ height: 400 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="答题时间分布">
                <ReactECharts option={timeOption} style={{ height: 400 }} />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="掌握进度" key="mastery">
          <Card>
            <ReactECharts option={masteryOption} style={{ height: 400 }} />
          </Card>
        </TabPane>

        <TabPane tab="错题趋势" key="wrongTrend">
          <Card>
            <ReactECharts option={wrongTrendOption} style={{ height: 400 }} />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
