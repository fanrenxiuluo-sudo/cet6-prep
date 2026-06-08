import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, Radio, Input, Tag, Progress, Typography, Statistic, Row, Col, message, Spin } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, FlagOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// ═══════════════════ 类型 ═══════════════════

interface Question {
  id: string;
  questionType: string;
  section: string;
  difficulty: number;
  content: string;   // JSON string
  options?: string | null;
  correctAnswer: string;
  explanation?: string | null;
}

interface PracticeState {
  phase: 'config' | 'doing' | 'result';
  sessionId: string | null;
  questions: Question[];
  currentIndex: number;
  currentQuestion: Question | null;
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string | string[];
    timeSpentMs: number;
  }>;
  startTime: number;
  timerMs: number;
  loading: boolean;
}

// ═══════════════════ 配置选项 ═══════════════════

const SECTION_OPTIONS = [
  { label: '全部', value: '' },
  { label: '听力', value: 'LISTENING' },
  { label: '阅读', value: 'READING' },
  { label: '写作', value: 'WRITING' },
  { label: '翻译', value: 'TRANSLATION' },
];

const COUNT_OPTIONS = [5, 10, 15, 20];

// ═══════════════════ 组件 ═══════════════════

const PracticePage: React.FC = () => {
  const [state, setState] = useState<PracticeState>({
    phase: 'config',
    sessionId: null,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    results: [],
    startTime: 0,
    timerMs: 0,
    loading: false,
  });

  // 配置参数
  const [section, setSection] = useState('');
  const [count, setCount] = useState(10);

  // 当前答题
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);

  // 计时器
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(0);

  // ═══════════════════ 计时器 ═══════════════════

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, timerMs: Date.now() - prev.startTime }));
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // ═══════════════════ 开始练习 ═══════════════════

  const handleStart = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const session = await window.api.practiceStart({
        mode: 'quick',
        section: section || undefined,
        count,
      });

      // 获取第一题
      const first = await window.api.practiceQuestion(session.sessionId);
      if (!first?.question) {
        message.warning('没有符合条件的题目');
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      questionStartRef.current = Date.now();
      const now = Date.now();

      setState(prev => ({
        ...prev,
        phase: 'doing',
        sessionId: session.sessionId,
        questions: session.questionIds as unknown as Question[],
        currentIndex: 0,
        currentQuestion: first.question as unknown as Question,
        results: [],
        startTime: now,
        timerMs: 0,
        loading: false,
      }));
      setUserAnswer('');
      setShowFeedback(false);
      startTimer();
    } catch (err) {
      message.error('开始练习失败: ' + (err as Error).message);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // ═══════════════════ 提交当前题 ═══════════════════

  const handleSubmit = async () => {
    if (!state.sessionId || !state.currentQuestion) return;
    if (!userAnswer.trim()) {
      message.warning('请先作答');
      return;
    }

    stopTimer();
    const timeSpentMs = Date.now() - questionStartRef.current;

    try {
      const result = await window.api.practiceSubmit(state.sessionId, {
        questionId: state.currentQuestion.id,
        answer: userAnswer,
        timeSpentMs,
      });

      setLastResult(result);
      setShowFeedback(true);

      setState(prev => ({
        ...prev,
        results: [...prev.results, {
          questionId: state.currentQuestion!.id,
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          userAnswer: userAnswer,
          timeSpentMs,
        }],
      }));
    } catch (err) {
      message.error('提交失败');
      startTimer();
    }
  };

  // ═══════════════════ 下一题 ═══════════════════

  const handleNext = async () => {
    if (!state.sessionId) return;

    const nextIndex = state.currentIndex + 1;

    // 全部做完 → 完成会话
    if (nextIndex >= state.questions.length) {
      stopTimer();
      setState(prev => ({ ...prev, phase: 'result', loading: true }));
      try {
        const summary = await window.api.practiceComplete(state.sessionId);
        setState(prev => ({ ...prev, loading: false }));
      } catch {
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

    // 加载下一题
    try {
      const next = await window.api.practiceQuestion(state.sessionId);
      questionStartRef.current = Date.now();
      setState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        currentQuestion: next?.question as unknown as Question,
      }));
      setUserAnswer('');
      setShowFeedback(false);
      startTimer();
    } catch (err) {
      message.error('加载下一题失败');
    }
  };

  // ═══════════════════ 格式化时间 ═══════════════════

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // ═══════════════════ 渲染：配置阶段 ═══════════════════

  if (state.phase === 'config') {
    return (
      <div style={{ padding: 24 }}>
        <h2>📝 练习</h2>
        <Card title="选择练习配置" style={{ maxWidth: 500 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>考试板块</Text>
              <Radio.Group
                options={SECTION_OPTIONS}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                style={{ marginTop: 8, display: 'block' }}
              />
            </div>
            <div>
              <Text strong>题目数量</Text>
              <Space style={{ marginTop: 8 }}>
                {COUNT_OPTIONS.map(c => (
                  <Button
                    key={c}
                    type={count === c ? 'primary' : 'default'}
                    onClick={() => setCount(c)}
                  >
                    {c} 题
                  </Button>
                ))}
              </Space>
            </div>
            <Button
              type="primary"
              size="large"
              block
              loading={state.loading}
              onClick={handleStart}
            >
              开始练习
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  // ═══════════════════ 渲染：答题阶段 ═══════════════════

  if (state.phase === 'doing' && state.currentQuestion) {
    const q = state.currentQuestion;
    const content = JSON.parse(q.content);
    const options = q.options ? JSON.parse(q.options) : null;
    const progress = ((state.currentIndex + 1) / state.questions.length) * 100;

    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        {/* 顶部状态栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Tag color="blue">{state.currentIndex + 1} / {state.questions.length}</Tag>
            <Tag>{q.questionType}</Tag>
          </Space>
          <Space>
            <ClockCircleOutlined />
            <Text strong>{formatTime(state.timerMs)}</Text>
          </Space>
        </div>
        <Progress percent={progress} showInfo={false} style={{ marginBottom: 16 }} />

        {/* 题目内容 */}
        <Card>
          <Paragraph style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>
            {content.stem || content.passage || ''}
          </Paragraph>

          {content.questionText && (
            <Paragraph strong style={{ marginTop: 12 }}>{content.questionText}</Paragraph>
          )}

          {content.chineseText && (
            <Paragraph style={{ background: '#1a1a2e', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              {content.chineseText}
            </Paragraph>
          )}

          {content.passageWithBlanks && (
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{content.passageWithBlanks}</Paragraph>
          )}

          {content.prompt && (
            <Paragraph style={{ fontStyle: 'italic' }}>{content.prompt}</Paragraph>
          )}
        </Card>

        {/* 作答区域 */}
        <Card style={{ marginTop: 16 }} title="作答">
          {/* 选择题 */}
          {options && (
            <Radio.Group
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {options.map((opt: { label: string; text: string }) => (
                <Radio key={opt.label} value={opt.label} style={{ fontSize: 14 }}>
                  <Text strong>{opt.label}.</Text> {opt.text}
                </Radio>
              ))}
            </Radio.Group>
          )}

          {/* 翻译/写作/选词填空 */}
          {!options && (
            <TextArea
              rows={6}
              placeholder={q.questionType === 'TRANSLATION' ? '输入你的翻译...' : '输入你的答案...'}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
            />
          )}
        </Card>

        {/* 反馈 */}
        {showFeedback && lastResult && (
          <Card
            style={{ marginTop: 16, border: lastResult.isCorrect ? '1px solid #52c41a' : '1px solid #ff4d4f' }}
            title={lastResult.isCorrect
              ? <Text style={{ color: '#52c41a' }}><CheckCircleOutlined /> 回答正确！</Text>
              : <Text style={{ color: '#ff4d4f' }}><CloseCircleOutlined /> 回答错误</Text>
            }
          >
            <Text strong>正确答案：</Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{lastResult.correctAnswer}</Paragraph>
            {q.explanation && (
              <>
                <Text strong>解析：</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</Paragraph>
              </>
            )}
          </Card>
        )}

        {/* 操作按钮 */}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          {!showFeedback ? (
            <Button type="primary" size="large" onClick={handleSubmit}>
              提交答案
            </Button>
          ) : (
            <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={handleNext}>
              {state.currentIndex + 1 >= state.questions.length ? '查看结果' : '下一题'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════ 渲染：结果阶段 ═══════════════════

  if (state.phase === 'result') {
    const correctCount = state.results.filter(r => r.isCorrect).length;
    const total = state.results.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <h2>🎉 练习完成</h2>
        <Card>
          <Row gutter={16} style={{ textAlign: 'center' }}>
            <Col span={8}>
              <Statistic title="总题数" value={total} />
            </Col>
            <Col span={8}>
              <Statistic title="正确数" value={correctCount} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={8}>
              <Statistic title="正确率" value={accuracy} suffix="%" valueStyle={{ color: accuracy >= 60 ? '#52c41a' : '#ff4d4f' }} />
            </Col>
          </Row>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Statistic title="总用时" value={formatTime(state.timerMs)} />
          </div>
        </Card>

        {/* 错题回顾 */}
        {state.results.filter(r => !r.isCorrect).length > 0 && (
          <Card title="❌ 错题回顾" style={{ marginTop: 16 }}>
            {state.results.filter(r => !r.isCorrect).map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, background: '#1a1a2e', borderRadius: 6 }}>
                <Text>你的答案：<Text type="danger">{String(r.userAnswer)}</Text></Text>
                <br />
                <Text>正确答案：<Text style={{ color: '#52c41a' }}>{r.correctAnswer}</Text></Text>
              </div>
            ))}
          </Card>
        )}

        <Button type="primary" size="large" block style={{ marginTop: 16 }} onClick={() => {
          setState({ phase: 'config', sessionId: null, questions: [], currentIndex: 0, currentQuestion: null, results: [], startTime: 0, timerMs: 0, loading: false });
          setUserAnswer('');
          setShowFeedback(false);
        }}>
          再来一轮
        </Button>
      </div>
    );
  }

  return <Spin spinning={state.loading} />;
};

export default PracticePage;
