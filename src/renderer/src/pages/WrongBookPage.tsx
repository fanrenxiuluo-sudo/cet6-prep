/**
 * 错题本页面 — FSRS 间隔重复复习、错题管理
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
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
  Radio,
  Badge,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  DeleteOutlined,
  EditOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  BookOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface DueQuestion {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  mastered: boolean;
  notes: string | null;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  state: string;
  due: string;
  question: {
    questionType: string;
    section: string;
    difficulty: number;
    content: string;
    options: string | null;
    correctAnswer: string;
    explanation: string | null;
    knowledgePoints: string;
  };
}

interface ReviewResult {
  card: { id: string; stability: number; difficulty: number; due: Date };
  previousStability: number;
  newStability: number;
  previousDifficulty: number;
  newDifficulty: number;
  nextReview: Date;
}

interface WrongBookStats {
  totalWrong: number;
  mastered: number;
  dueForReview: number;
  averageStability: number;
  averageDifficulty: number;
  bySection: Array<{ section: string; count: number; mastered: number; dueForReview: number }>;
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

const RATING_MAP: Record<number, { label: string; color: string; description: string }> = {
  1: { label: 'Again', color: '#ff4d4f', description: '完全不会，需要重新学习' },
  2: { label: 'Hard', color: '#fa8c16', description: '很吃力，勉强答对' },
  3: { label: 'Good', color: '#52c41a', description: '想了想能答对' },
  4: { label: 'Easy', color: '#1890ff', description: '很轻松，直接答对' },
};

/**
 * 把题目的 JSON content/options 字符串解析为可读 React 节点。
 */
function safeParseJSON<T = unknown>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

interface ParsedContent {
  stem?: string;
  passage?: string;
  questionText?: string;
  chineseText?: string;
  passageWithBlanks?: string;
  wordBank?: string[];
  prompt?: string;
  keyPhrases?: string[];
  minWords?: number;
  maxWords?: number;
  blanks?: number[];
}

function renderQuestionBody(question: {
  content: string;
  options: string | null;
}): React.ReactNode {
  const content = safeParseJSON<ParsedContent>(question.content, { stem: question.content });
  const options = safeParseJSON<Array<{ label: string; text: string }> | null>(question.options, null);

  return (
    <div style={{ fontSize: 14, lineHeight: 1.8 }}>
      {content.passage && (
        <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap', padding: 10, background: 'rgba(127,127,127,0.06)', borderRadius: 6 }}>
          {content.passage}
        </div>
      )}
      {content.chineseText && (
        <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap', padding: 10, background: 'rgba(127,127,127,0.06)', borderRadius: 6 }}>
          {content.chineseText}
        </div>
      )}
      {content.passageWithBlanks && (
        <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          {content.passageWithBlanks}
        </div>
      )}
      {content.stem && <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{content.stem}</div>}
      {content.questionText && <div style={{ marginBottom: 8 }}>{content.questionText}</div>}
      {content.prompt && (
        <div style={{ marginBottom: 8, fontStyle: 'italic' }}>题目：{content.prompt}</div>
      )}
      {content.minWords && content.maxWords && (
        <div style={{ marginBottom: 8, color: '#fa8c16' }}>字数要求：{content.minWords}-{content.maxWords} 词</div>
      )}
      {content.wordBank && content.wordBank.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold' }}>词库：</span>
          <Space wrap size={[6, 6]}>
            {content.wordBank.map((w, i) => (
              <Tag key={i} color="blue">{i + 1}. {w}</Tag>
            ))}
          </Space>
        </div>
      )}
      {content.keyPhrases && content.keyPhrases.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold' }}>关键短语：</span>
          <Space wrap size={[6, 6]}>
            {content.keyPhrases.map((p, i) => <Tag key={i} color="orange">{p}</Tag>)}
          </Space>
        </div>
      )}
      {options && options.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>选项：</div>
          {options.map(opt => (
            <div key={opt.label} style={{ marginBottom: 2 }}>
              <Tag>{opt.label}</Tag> {opt.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WrongBookPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'review' | 'manage'>('review');

  // 待复习题目
  const [dueQuestions, setDueQuestions] = useState<DueQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // 统计
  const [stats, setStats] = useState<WrongBookStats | null>(null);

  // 管理模式
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // 加载待复习题目
  const loadDueQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.wrongbookDue(20);
      setDueQuestions(data);
      setCurrentIndex(0);
      setShowAnswer(false);
      setSelectedRating(null);
    } catch (error) {
      console.error('Failed to load due questions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载统计
  const loadStats = useCallback(async () => {
    try {
      const data = await window.api.wrongbookStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    loadDueQuestions();
    loadStats();
  }, [loadDueQuestions, loadStats]);

  // 提交复习结果
  const handleReview = async (rating: number) => {
    if (currentIndex >= dueQuestions.length) return;

    const current = dueQuestions[currentIndex];
    setLoading(true);

    try {
      await window.api.wrongbookReview({
        wrongQuestionId: current.id,
        rating,
      });

      message.success(`已记录：${RATING_MAP[rating].label}`);

      // 下一题
      if (currentIndex < dueQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
        setSelectedRating(null);
      } else {
        message.info('今日复习完成！');
        loadDueQuestions();
        loadStats();
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量标记已掌握
  const handleBatchMaster = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择题目');
      return;
    }

    Modal.confirm({
      title: '确认批量掌握',
      content: `确定将 ${selectedRows.length} 道题标记为已掌握？`,
      onOk: async () => {
        try {
          await window.api.wrongbookBatchMaster(selectedRows);
          message.success('操作成功');
          setSelectedRows([]);
          loadDueQuestions();
          loadStats();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  // 批量删除
  const handleBatchRemove = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择题目');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定删除 ${selectedRows.length} 道错题？此操作不可恢复。`,
      onOk: async () => {
        try {
          await window.api.wrongbookBatchRemove(selectedRows);
          message.success('删除成功');
          setSelectedRows([]);
          loadDueQuestions();
          loadStats();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 打开笔记弹窗
  const openNoteModal = (id: string, currentNotes: string | null) => {
    setCurrentNoteId(id);
    setNoteContent(currentNotes || '');
    setNoteModalVisible(true);
  };

  // 保存笔记
  const saveNote = async () => {
    try {
      await window.api.wrongbookNote({ wrongQuestionId: currentNoteId, notes: noteContent });
      message.success('笔记已保存');
      setNoteModalVisible(false);
      loadDueQuestions();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 管理模式列
  const manageColumns = [
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
      title: '稳定性',
      dataIndex: 'stability',
      key: 'stability',
      render: (s: number) => `${s.toFixed(2)}天`,
    },
    {
      title: '下次复习',
      dataIndex: 'due',
      key: 'due',
      render: (due: string) => {
        const isPast = dayjs(due).isBefore(dayjs());
        return (
          <Tag color={isPast ? 'red' : 'default'}>
            {isPast ? '已到期' : dayjs(due).format('MM-DD')}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'mastered',
      key: 'mastered',
      render: (mastered: boolean) =>
        mastered ? <Tag color="success">已掌握</Tag> : <Tag color="warning">未掌握</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DueQuestion) => (
        <Space>
          <Tooltip title="标记为掌握">
            <Button
              type="link"
              icon={<StarOutlined />}
              onClick={async () => {
                await window.api.wrongbookMaster(record.id);
                message.success('已标记');
                loadDueQuestions();
                loadStats();
              }}
            />
          </Tooltip>
          <Tooltip title="添加笔记">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => openNoteModal(record.id, record.notes)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: '确定删除这道错题？',
                  onOk: async () => {
                    await window.api.wrongbookRemove(record.id);
                    message.success('已删除');
                    loadDueQuestions();
                    loadStats();
                  },
                });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 统计面板
  const renderStats = () => {
    if (!stats) return null;

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="错题总数"
              value={stats.totalWrong}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已掌握"
              value={stats.mastered}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复习"
              value={stats.dueForReview}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: stats.dueForReview > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均稳定性"
              value={stats.averageStability}
              precision={2}
              suffix="天"
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // 复习模式
  const renderReviewMode = () => {
    if (dueQuestions.length === 0) {
      return (
        <Empty
          description="暂无待复习错题"
          style={{ padding: 48 }}
        >
          <Button type="primary" onClick={loadDueQuestions}>
            刷新
          </Button>
        </Empty>
      );
    }

    const current = dueQuestions[currentIndex];
    const progress = ((currentIndex + 1) / dueQuestions.length) * 100;

    return (
      <div>
        <Progress
          percent={progress}
          status="active"
          style={{ marginBottom: 16 }}
          format={() => `${currentIndex + 1}/${dueQuestions.length}`}
        />

        <Card>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <Tag color="blue">{TYPE_MAP[current.question.questionType]}</Tag>
                <Tag color="purple">{SECTION_MAP[current.question.section]}</Tag>
                <Tag>难度 {current.question.difficulty}/5</Tag>
                <Tag>错误 {current.wrongCount}次</Tag>
              </div>

              <div style={{ marginBottom: 16 }}>
                {renderQuestionBody(current.question)}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, color: '#999' }}>
                  根据掌握程度自评（FSRS 算法将据此安排下次复习）：
                </div>
                <Radio.Group
                  value={selectedRating}
                  onChange={(e) => setSelectedRating(e.target.value)}
                >
                  <Space direction="vertical">
                    {Object.entries(RATING_MAP).map(([rating, info]) => (
                      <Radio key={rating} value={Number(rating)}>
                        <Tag color={info.color}>{info.label}</Tag>
                        <span style={{ color: '#999' }}>{info.description}</span>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>

              <Space>
                <Button
                  type="primary"
                  disabled={!selectedRating}
                  loading={loading}
                  onClick={() => selectedRating && handleReview(selectedRating)}
                >
                  确认复习
                </Button>
                <Button onClick={() => setShowAnswer(!showAnswer)}>
                  {showAnswer ? '隐藏答案' : '查看答案'}
                </Button>
              </Space>
            </Col>

            <Col span={12}>
              {showAnswer && (
                <Card title="答案与解析" type="inner">
                  <div style={{ marginBottom: 12 }}>
                    <strong>正确答案：</strong>
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      {current.question.correctAnswer}
                    </Tag>
                  </div>

                  {current.question.explanation && (
                    <div style={{ color: '#999', lineHeight: 1.8 }}>
                      <strong>解析：</strong>
                      {current.question.explanation}
                    </div>
                  )}

                  <div style={{ marginTop: 16, color: '#666' }}>
                    <div>稳定性：{current.stability.toFixed(2)}天</div>
                    <div>难度：{current.difficulty.toFixed(2)}</div>
                    <div>已复习：{current.reps}次</div>
                    <div>下次复习：{dayjs(current.due).format('YYYY-MM-DD')}</div>
                  </div>
                </Card>
              )}

              {current.notes && (
                <Card title="我的笔记" type="inner" style={{ marginTop: 16 }}>
                  {current.notes}
                </Card>
              )}
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {renderStats()}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="review">复习模式</Radio.Button>
            <Radio.Button value="manage">管理模式</Radio.Button>
          </Radio.Group>

          {mode === 'review' && (
            <Button icon={<ReloadOutlined />} onClick={loadDueQuestions}>
              刷新
            </Button>
          )}

          {mode === 'manage' && (
            <>
              <Button
                icon={<StarOutlined />}
                disabled={selectedRows.length === 0}
                onClick={handleBatchMaster}
              >
                批量掌握 ({selectedRows.length})
              </Button>
              <Button
                icon={<DeleteOutlined />}
                danger
                disabled={selectedRows.length === 0}
                onClick={handleBatchRemove}
              >
                批量删除 ({selectedRows.length})
              </Button>
            </>
          )}
        </Space>

        {mode === 'review' ? (
          renderReviewMode()
        ) : (
          <Table
            dataSource={dueQuestions}
            columns={manageColumns}
            loading={loading}
            rowKey="id"
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: (keys) => setSelectedRows(keys as string[]),
            }}
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: 8 }}>
                  {renderQuestionBody(record.question)}
                  <div style={{ marginTop: 8 }}>
                    <strong>正确答案：</strong>
                    <Tag color="green">{record.question.correctAnswer}</Tag>
                  </div>
                  {record.question.explanation && (
                    <div style={{ marginTop: 4, color: '#999' }}>
                      <strong>解析：</strong>{record.question.explanation}
                    </div>
                  )}
                </div>
              ),
            }}
          />
        )}
      </Card>

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
