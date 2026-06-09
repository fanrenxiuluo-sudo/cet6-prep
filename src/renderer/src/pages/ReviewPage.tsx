/**
 * 复盘页面 — 练习记录、错题本、学习统计
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Select,
  Tooltip,
  Modal,
  Input,
  message,
  Progress,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BookOutlined,
  TrophyOutlined,
  EditOutlined,
  StarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface StudyHistoryItem {
  date: string;
  records: Array<{
    id: string;
    questionId: string;
    rating: number;
    responseTimeMs: number;
    isCorrect: boolean;
    studiedAt: string;
    question: {
      questionType: string;
      section: string;
      content: string;
      correctAnswer: string;
      explanation: string | null;
    };
  }>;
  totalCount: number;
  correctCount: number;
  accuracy: number;
}

interface WrongQuestionItem {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  mastered: boolean;
  notes: string | null;
  question: {
    questionType: string;
    section: string;
    difficulty: number;
    content: string;
    options: string | null;
    correctAnswer: string;
    explanation: string | null;
  };
}

interface OverviewStats {
  totalSessions: number;
  totalQuestions: number;
  overallAccuracy: number;
  avgTimeMs: number;
  sectionStats: Array<{
    section: string;
    totalCount: number;
    correctCount: number;
    accuracy: number;
    avgTimeMs: number;
  }>;
  recentTrend: Array<{
    date: string;
    count: number;
    accuracy: number;
  }>;
}

const SECTION_MAP: Record<string, string> = {
  LISTENING: '听力',
  READING: '阅读',
  WRITING: '写作',
  TRANSLATION: '翻译',
};

const TYPE_MAP: Record<string, string> = {
  LISTENING_MCQ: '听力选择',
  BANKED_CLOZE: '选词填空',
  CAREFUL_READING: '仔细阅读',
  INFO_MATCHING: '信息匹配',
  ESSAY: '写作',
  TRANSLATION: '翻译',
};

interface ReviewPageProps {
  defaultTab?: 'history' | 'wrongbook' | 'stats';
}

type ReviewTab = NonNullable<ReviewPageProps['defaultTab']>;

export default function ReviewPage({ defaultTab = 'history' }: ReviewPageProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);

  // 练习记录
  const [history, setHistory] = useState<StudyHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);

  // 错题本
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionItem[]>([]);
  const [wrongFilter, setWrongFilter] = useState<{ section?: string; mastered?: boolean }>({});
  const [wrongPage, setWrongPage] = useState(1);

  // 统计
  const [stats, setStats] = useState<OverviewStats | null>(null);

  // 笔记弹窗
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [currentWrongId, setCurrentWrongId] = useState<string>('');
  const [noteContent, setNoteContent] = useState('');
  const historyRecords = history.flatMap(group => group.records);

  // 加载练习记录
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.reviewHistory({ limit: 20, offset: (historyPage - 1) * 20 });
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, [historyPage]);

  // 加载错题
  const loadWrongQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.reviewWrongQuestions({
        ...wrongFilter,
        limit: 20,
        offset: (wrongPage - 1) * 20,
      });
      setWrongQuestions(data);
    } catch (error) {
      console.error('Failed to load wrong questions:', error);
    } finally {
      setLoading(false);
    }
  }, [wrongFilter, wrongPage]);

  // 加载统计
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.reviewStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 根据 tab 加载数据
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'wrongbook') {
      loadWrongQuestions();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, loadHistory, loadWrongQuestions, loadStats]);

  // 标记已掌握
  const handleMaster = async (id: string) => {
    try {
      await window.api.reviewMaster(id);
      message.success('已标记为掌握');
      loadWrongQuestions();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 打开笔记弹窗
  const openNoteModal = (id: string, currentNotes: string | null) => {
    setCurrentWrongId(id);
    setNoteContent(currentNotes || '');
    setNoteModalVisible(true);
  };

  // 保存笔记
  const saveNote = async () => {
    try {
      await window.api.reviewAddNote({ wrongQuestionId: currentWrongId, notes: noteContent });
      message.success('笔记已保存');
      setNoteModalVisible(false);
      loadWrongQuestions();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 练习记录列
  const historyColumns = [
    {
      title: '题型',
      dataIndex: ['question', 'questionType'],
      key: 'questionType',
      render: (type: string) => TYPE_MAP[type] || type,
    },
    {
      title: '分类',
      dataIndex: ['question', 'section'],
      key: 'section',
      render: (section: string) => SECTION_MAP[section] || section,
    },
    {
      title: '结果',
      dataIndex: 'isCorrect',
      key: 'isCorrect',
      render: (correct: boolean) =>
        correct ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            正确
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            错误
          </Tag>
        ),
    },
    {
      title: '用时',
      dataIndex: 'responseTimeMs',
      key: 'time',
      render: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
    },
    {
      title: '时间',
      dataIndex: 'studiedAt',
      key: 'time',
      render: (time: string) => dayjs(time).format('HH:mm:ss'),
    },
  ];

  // 错题列
  const wrongColumns = [
    {
      title: '题型',
      dataIndex: ['question', 'questionType'],
      key: 'questionType',
      render: (type: string) => TYPE_MAP[type] || type,
    },
    {
      title: '分类',
      dataIndex: ['question', 'section'],
      key: 'section',
      render: (section: string) => SECTION_MAP[section] || section,
    },
    {
      title: '难度',
      dataIndex: ['question', 'difficulty'],
      key: 'difficulty',
      render: (d: number) => `${d}/5`,
    },
    {
      title: '错误次数',
      dataIndex: 'wrongCount',
      key: 'wrongCount',
      render: (count: number) => (
        <Tag color={count >= 3 ? 'red' : count >= 2 ? 'orange' : 'default'}>{count}次</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'mastered',
      key: 'mastered',
      render: (mastered: boolean) =>
        mastered ? <Tag color="success">已掌握</Tag> : <Tag color="warning">未掌握</Tag>,
    },
    {
      title: '最近错误',
      dataIndex: 'lastWrongAt',
      key: 'lastWrongAt',
      render: (time: string) => dayjs(time).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: WrongQuestionItem) => (
        <Space>
          {!record.mastered && (
            <Tooltip title="标记为掌握">
              <Button
                type="link"
                icon={<StarOutlined />}
                onClick={() => handleMaster(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="添加笔记">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => openNoteModal(record.id, record.notes)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 统计面板
  const renderStats = () => {
    if (!stats) return <Empty description="暂无数据" />;

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总练习题数"
                value={stats.totalQuestions}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="整体正确率"
                value={stats.overallAccuracy * 100}
                precision={1}
                suffix="%"
                prefix={<TrophyOutlined />}
                valueStyle={{ color: stats.overallAccuracy >= 0.6 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均用时"
                value={stats.avgTimeMs / 1000}
                precision={1}
                suffix="秒"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="连续学习" value={0} suffix="天" prefix={<TrophyOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card title="分项统计" style={{ marginTop: 16 }}>
          <Table
            dataSource={stats.sectionStats}
            rowKey="section"
            pagination={false}
            columns={[
              {
                title: '分类',
                dataIndex: 'section',
                render: (s: string) => SECTION_MAP[s] || s,
              },
              {
                title: '练习数',
                dataIndex: 'totalCount',
              },
              {
                title: '正确数',
                dataIndex: 'correctCount',
              },
              {
                title: '正确率',
                dataIndex: 'accuracy',
                render: (a: number) => (
                  <Progress
                    percent={Math.round(a * 100)}
                    status={a >= 0.6 ? 'success' : 'exception'}
                    size="small"
                  />
                ),
              },
              {
                title: '平均用时',
                dataIndex: 'avgTimeMs',
                render: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
              },
            ]}
          />
        </Card>

        <Card title="最近7天趋势" style={{ marginTop: 16 }}>
          <Table
            dataSource={stats.recentTrend}
            rowKey="date"
            pagination={false}
            columns={[
              {
                title: '日期',
                dataIndex: 'date',
                render: (d: string) => dayjs(d).format('MM-DD'),
              },
              {
                title: '练习数',
                dataIndex: 'count',
              },
              {
                title: '正确率',
                dataIndex: 'accuracy',
                render: (a: number) =>
                  a > 0 ? (
                    <Progress
                      percent={Math.round(a * 100)}
                      status={a >= 0.6 ? 'success' : 'exception'}
                      size="small"
                    />
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        </Card>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as ReviewTab)}>
        <TabPane tab="练习记录" key="history">
          <Card>
            <Table
              dataSource={historyRecords}
              columns={historyColumns}
              loading={loading}
              rowKey="id"
              pagination={{
                current: historyPage,
                onChange: setHistoryPage,
                pageSize: 20,
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: 8 }}>
                    <p>
                      <strong>题目：</strong>
                      {record.question.content.substring(0, 100)}...
                    </p>
                    <p>
                      <strong>正确答案：</strong>
                      {record.question.correctAnswer}
                    </p>
                    {record.question.explanation && (
                      <p>
                        <strong>解析：</strong>
                        {record.question.explanation}
                      </p>
                    )}
                  </div>
                ),
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="错题本" key="wrongbook">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Select
                placeholder="按分类筛选"
                allowClear
                style={{ width: 120 }}
                onChange={(value) => setWrongFilter((prev) => ({ ...prev, section: value }))}
              >
                <Select.Option value="LISTENING">听力</Select.Option>
                <Select.Option value="READING">阅读</Select.Option>
                <Select.Option value="WRITING">写作</Select.Option>
                <Select.Option value="TRANSLATION">翻译</Select.Option>
              </Select>
              <Select
                placeholder="按状态筛选"
                allowClear
                style={{ width: 120 }}
                onChange={(value) => setWrongFilter((prev) => ({ ...prev, mastered: value }))}
              >
                <Select.Option value={false}>未掌握</Select.Option>
                <Select.Option value={true}>已掌握</Select.Option>
              </Select>
            </Space>

            <Table
              dataSource={wrongQuestions}
              columns={wrongColumns}
              loading={loading}
              rowKey="id"
              pagination={{
                current: wrongPage,
                onChange: setWrongPage,
                pageSize: 20,
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: 8 }}>
                    <p>
                      <strong>题目：</strong>
                      {record.question.content.substring(0, 150)}...
                    </p>
                    {record.question.options && (
                      <p>
                        <strong>选项：</strong>
                        {record.question.options}
                      </p>
                    )}
                    <p>
                      <strong>正确答案：</strong>
                      {record.question.correctAnswer}
                    </p>
                    {record.question.explanation && (
                      <p>
                        <strong>解析：</strong>
                        {record.question.explanation}
                      </p>
                    )}
                    {record.notes && (
                      <p>
                        <strong>笔记：</strong>
                        {record.notes}
                      </p>
                    )}
                  </div>
                ),
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="学习统计" key="stats">
          {renderStats()}
        </TabPane>
      </Tabs>

      <Modal
        title="添加笔记"
        open={noteModalVisible}
        onOk={saveNote}
        onCancel={() => setNoteModalVisible(false)}
      >
        <TextArea
          rows={4}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="记录错误原因、解题思路等..."
        />
      </Modal>
    </div>
  );
}
