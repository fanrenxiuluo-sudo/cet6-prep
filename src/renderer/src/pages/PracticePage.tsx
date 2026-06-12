import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, Radio, Input, Tag, Progress, Typography, Statistic, Row, Col, message, Spin, Segmented, Alert } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowRightOutlined, BookOutlined, ThunderboltOutlined, SafetyOutlined } from '@ant-design/icons';
import useThemeStore from '../stores/useThemeStore';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

interface Question {
  id: string;
  questionType: string;
  section: string;
  difficulty: number;
  content: string;
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

const SECTION_OPTIONS = [
  { label: '全部', value: '' },
  { label: '听力', value: 'LISTENING' },
  { label: '阅读', value: 'READING' },
  { label: '写作', value: 'WRITING' },
  { label: '翻译', value: 'TRANSLATION' },
];

const COUNT_OPTIONS = [5, 10, 15, 20];

const DIFFICULTY_OPTIONS = [
  { label: '入门', value: 1, icon: <SafetyOutlined />, desc: '基础题，适合零基础用户' },
  { label: '基础', value: 2, icon: <BookOutlined />, desc: '核心知识点，适合初学者' },
  { label: '进阶', value: 3, icon: <ThunderboltOutlined />, desc: '综合应用，适合有一定基础的用户' },
  { label: '不限', value: 0, icon: <ClockCircleOutlined />, desc: '随机抽取所有难度' },
];

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

  const [section, setSection] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState(0);
  const [practiceMode, setPracticeMode] = useState<'learning' | 'exam'>('learning');

  const [userAnswer, setUserAnswer] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(0);

  const isDark = useThemeStore((s) => s.theme) === 'dark' ? true :
    (useThemeStore((s) => s.theme) === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true) : false);

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

  const handleStart = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const config: Record<string, unknown> = {
        mode: 'quick',
        count,
      };
      if (section) config.section = section;
      if (difficulty > 0) config.difficulty = difficulty;

      const session = await window.api.practiceStart(config);

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
      setShowHint(false);
      setLastResult(null);

      if (practiceMode === 'exam') {
        startTimer();
      }
    } catch (err) {
      message.error('开始练习失败: ' + (err as Error).message);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSubmit = async () => {
    if (!state.sessionId || !state.currentQuestion) return;
    if (!userAnswer.trim() && !state.currentQuestion.options) {
      message.warning('请先作答');
      return;
    }

    if (practiceMode === 'exam') {
      stopTimer();
    }
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
      if (practiceMode === 'exam') {
        startTimer();
      }
    }
  };

  const handleNext = async () => {
    if (!state.sessionId) return;

    const nextIndex = state.currentIndex + 1;

    if (nextIndex >= state.questions.length) {
      stopTimer();
      setState(prev => ({ ...prev, phase: 'result', loading: true }));
      try {
        await window.api.practiceComplete(state.sessionId);
        setState(prev => ({ ...prev, loading: false }));
      } catch {
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

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
      setShowHint(false);
      setLastResult(null);
      if (practiceMode === 'exam') {
        startTimer();
      }
    } catch (err) {
      message.error('加载下一题失败');
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const parseContent = (q: Question) => {
    try {
      return JSON.parse(q.content);
    } catch {
      return { stem: q.content };
    }
  };

  const renderQuestionContent = (q: Question) => {
    const content = parseContent(q);
    const options = q.options ? JSON.parse(q.options) : null;

    return (
      <>
        {(content.passage || content.stem) && (
          <Card
            title={content.passage ? '文章原文' : '题目'}
            style={{ marginBottom: 16 }}
          >
            {content.passage && (
              <Paragraph style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: content.stem ? 12 : 0 }}>
                {content.passage}
              </Paragraph>
            )}
            {content.stem && (
              <Paragraph strong style={{ fontSize: 15, marginTop: content.passage ? 16 : 0 }}>
                {content.stem}
              </Paragraph>
            )}
            {content.questionText && (
              <Paragraph strong style={{ marginTop: 12, fontSize: 15 }}>
                {content.questionText}
              </Paragraph>
            )}
            {content.chineseText && (
              <Paragraph style={{
                padding: 12,
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                marginTop: 12,
                fontSize: 15,
                lineHeight: 1.8,
              }}>
                {content.chineseText}
              </Paragraph>
            )}
            {content.passageWithBlanks && (
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 15 }}>
                {content.passageWithBlanks}
              </Paragraph>
            )}
            {content.prompt && (
              <Paragraph style={{ fontStyle: 'italic', marginTop: 12 }}>
                {content.prompt}
              </Paragraph>
            )}
            {content.wordBank && (
              <div style={{ marginTop: 12 }}>
                <Text strong>词库：</Text>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(content.wordBank as string[]).map((word: string, i: number) => (
                    <Tag key={i} color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {i + 1}. {word}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            {content.blanks && (
              <div style={{ marginTop: 12 }}>
                <Text strong>填空位置：</Text>
                <Text> {JSON.stringify(content.blanks)}</Text>
              </div>
            )}
          </Card>
        )}

        {content.minWords && content.maxWords && (
          <Alert
            message={`字数要求：${content.minWords} - ${content.maxWords} 词`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {content.keyPhrases && (
          <Card title="关键词组提示" size="small" style={{ marginBottom: 16 }}>
            <Space wrap>
              {(content.keyPhrases as string[]).map((phrase: string, i: number) => (
                <Tag key={i} color="orange">{phrase}</Tag>
              ))}
            </Space>
          </Card>
        )}

        <Card title="作答" style={{ marginBottom: 16 }}>
          {options ? (
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
          ) : (
            <TextArea
              rows={q.questionType === 'TRANSLATION' || q.questionType === 'ESSAY' ? 6 : 3}
              placeholder={q.questionType === 'TRANSLATION' ? '输入你的翻译...' : q.questionType === 'ESSAY' ? '在此写作文...' : '输入你的答案...'}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
            />
          )}
        </Card>

        {practiceMode === 'learning' && !showFeedback && (
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={() => setShowHint(!showHint)}>
              {showHint ? '隐藏提示' : '显示提示'}
            </Button>
          </Space>
        )}

        {showHint && !showFeedback && q.explanation && (
          <Card size="small" title="参考提示" style={{ marginBottom: 16, borderLeft: '3px solid #faad14' }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</Paragraph>
          </Card>
        )}
      </>
    );
  };

  if (state.phase === 'config') {
    return (
      <div style={{ padding: 24 }}>
        <h2>📝 练习</h2>

        <Row gutter={[24, 24]}>
          <Col span={14}>
            <Card title="选择练习配置" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong style={{ fontSize: 15 }}>练习模式</Text>
                  <div style={{ marginTop: 8 }}>
                    <Segmented
                      options={[
                        { label: <span><SafetyOutlined /> 学习模式</span>, value: 'learning' },
                        { label: <span><ThunderboltOutlined /> 考试模式</span>, value: 'exam' },
                      ]}
                      value={practiceMode}
                      onChange={(v) => setPracticeMode(v as 'learning' | 'exam')}
                      style={{ marginBottom: 4 }}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 13 }}>
                    {practiceMode === 'learning'
                      ? '学习模式：不计时，可查看提示，适合零基础用户'
                      : '考试模式：计时做题，无提示，模拟真实考场'}
                  </div>
                </div>

                <div>
                  <Text strong style={{ fontSize: 15 }}>考试板块</Text>
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
                  <Text strong style={{ fontSize: 15 }}>难度级别</Text>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <Card
                        key={opt.value}
                        hoverable
                        size="small"
                        style={{
                          cursor: 'pointer',
                          border: difficulty === opt.value ? '2px solid #1677ff' : '1px solid #d9d9d9',
                          background: difficulty === opt.value ? '#e6f4ff' : undefined,
                        }}
                        onClick={() => setDifficulty(opt.value)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {opt.icon}
                          <div>
                            <Text strong>{opt.label}</Text>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{opt.desc}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <Text strong style={{ fontSize: 15 }}>题目数量</Text>
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
          </Col>

          <Col span={10}>
            <Card title="练习说明" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ color: '#1677ff' }}><SafetyOutlined /> 学习模式</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>不计时，轻松学习</li>
                    <li>可随时查看参考提示</li>
                    <li>适合零基础或初学者</li>
                    <li>建议从“入门”难度开始</li>
                  </ul>
                </div>
                <div>
                  <Text strong style={{ color: '#ff4d4f' }}><ThunderboltOutlined /> 考试模式</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>计时做题，模拟真实考场</li>
                    <li>不提供提示</li>
                    <li>适合有基础的用户</li>
                    <li>推荐选择“进阶”或“不限”难度</li>
                  </ul>
                </div>
                <div>
                  <Text strong>难度等级说明</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>★ 入门（1级）：基础词汇与句型</li>
                    <li>★★ 基础（2级）：核心知识点理解</li>
                    <li>★★★ 进阶（3级）：综合应用与推理</li>
                  </ul>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  if (state.phase === 'doing' && state.currentQuestion) {
    const q = state.currentQuestion;
    const progress = ((state.currentIndex + 1) / state.questions.length) * 100;

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Tag color="blue">{state.currentIndex + 1} / {state.questions.length}</Tag>
            <Tag>{QUESTION_TYPE_LABELS[q.questionType] || q.questionType}</Tag>
            <Tag color={SECTION_COLORS[q.section] || 'default'}>{SECTION_LABELS[q.section] || q.section}</Tag>
            <Tag>难度 {q.difficulty}/5</Tag>
            <Tag color={practiceMode === 'learning' ? 'green' : 'red'}>
              {practiceMode === 'learning' ? '学习' : '考试'}
            </Tag>
          </Space>
          {practiceMode === 'exam' && (
            <Space>
              <ClockCircleOutlined />
              <Text strong>{formatTime(state.timerMs)}</Text>
            </Space>
          )}
        </div>
        <Progress percent={progress} showInfo={false} style={{ marginBottom: 16 }} />

        {renderQuestionContent(q)}

        {showFeedback && lastResult && (
          <Card
            style={{ marginBottom: 16, border: lastResult.isCorrect ? '1px solid #52c41a' : '1px solid #ff4d4f' }}
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

  if (state.phase === 'result') {
    const correctCount = state.results.filter(r => r.isCorrect).length;
    const total = state.results.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
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
          {state.timerMs > 0 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Statistic title="总用时" value={formatTime(state.timerMs)} />
            </div>
          )}
        </Card>

        {state.results.filter(r => !r.isCorrect).length > 0 && (
          <Card title="❌ 错题回顾" style={{ marginTop: 16 }}>
            {state.results.filter(r => !r.isCorrect).map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, borderRadius: 6 }}>
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

const QUESTION_TYPE_LABELS: Record<string, string> = {
  LISTENING_MCQ: '听力选择',
  BANKED_CLOZE: '选词填空',
  CAREFUL_READING: '仔细阅读',
  INFO_MATCHING: '信息匹配',
  ESSAY: '写作',
  TRANSLATION: '翻译',
};

const SECTION_LABELS: Record<string, string> = {
  LISTENING: '听力',
  READING: '阅读',
  WRITING: '写作',
  TRANSLATION: '翻译',
};

const SECTION_COLORS: Record<string, string> = {
  LISTENING: 'blue',
  READING: 'green',
  WRITING: 'orange',
  TRANSLATION: 'purple',
};

export default PracticePage;