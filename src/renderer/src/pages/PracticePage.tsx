import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, Radio, Input, Tag, Progress, Typography, Statistic, Row, Col, message, Spin, Segmented, Alert, Modal } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowRightOutlined, ArrowLeftOutlined, BookOutlined, ThunderboltOutlined, SafetyOutlined, StepForwardOutlined } from '@ant-design/icons';
import useThemeStore from '../stores/useThemeStore';
import { useAppSettingsStore, playFeedbackSound } from '../stores/useAppSettingsStore';

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
  const [structuredAnswer, setStructuredAnswer] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);
  // 缓存历史已加载的题目与答题，用于"上一题"返回
  const [questionCache, setQuestionCache] = useState<Record<number, Question>>({});
  const [answerCache, setAnswerCache] = useState<Record<number, { userAnswer: string; structuredAnswer: Record<string, string>; showFeedback: boolean; lastResult: { isCorrect: boolean; correctAnswer: string } | null }>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(0);

  const isDark = useThemeStore((s) => s.theme) === 'dark' ? true :
    (useThemeStore((s) => s.theme) === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true) : false);

  // 应用全局设置：是否显示解析、每日目标、音效
  const showExplanationSetting = useAppSettingsStore((s) => s.settings.showExplanation);
  const dailyGoal = useAppSettingsStore((s) => s.settings.dailyGoal);

  // 每题独立计时（以 questionStartRef 为基准），避免跨题累加
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, timerMs: Date.now() - (questionStartRef.current || prev.startTime) }));
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

      const firstQuestion = first.question as unknown as Question;
      setState(prev => ({
        ...prev,
        phase: 'doing',
        sessionId: session.sessionId,
        questions: session.questionIds as unknown as Question[],
        currentIndex: 0,
        currentQuestion: firstQuestion,
        results: [],
        startTime: now,
        timerMs: 0,
        loading: false,
      }));
      setQuestionCache({ 0: firstQuestion });
      setAnswerCache({});
      setUserAnswer('');
      setStructuredAnswer({});
      setShowFeedback(false);
      setShowHint(false);
      setLastResult(null);
      setSubmitting(false);

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
    if (submitting) return;

    const q = state.currentQuestion;
    const isObjective = !!q.options;
    const isStructured = q.questionType === 'BANKED_CLOZE' || q.questionType === 'INFO_MATCHING';

    // 拦截空作答：选择题、主观题、结构化填空均需校验
    if (isObjective) {
      if (!userAnswer || !String(userAnswer).trim()) {
        message.warning('请先选择一个选项');
        return;
      }
    } else if (isStructured) {
      const filled = Object.values(structuredAnswer || {}).filter(v => String(v || '').trim()).length;
      if (filled === 0) {
        message.warning('请至少填写一个空');
        return;
      }
    } else if (!userAnswer.trim()) {
      message.warning('请先作答');
      return;
    }

    if (practiceMode === 'exam') {
      stopTimer();
    }
    const timeSpentMs = Date.now() - questionStartRef.current;

    const submittedAnswer: string = isStructured
      ? JSON.stringify(structuredAnswer)
      : userAnswer;

    setSubmitting(true);
    try {
      const result = await window.api.practiceSubmit(state.sessionId, {
        questionId: state.currentQuestion.id,
        answer: submittedAnswer,
        timeSpentMs,
      });

      setLastResult(result);
      setShowFeedback(true);
      playFeedbackSound(result.isCorrect ? 'correct' : 'wrong');

      setState(prev => ({
        ...prev,
        results: [...prev.results, {
          questionId: state.currentQuestion!.id,
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          userAnswer: submittedAnswer,
          timeSpentMs,
        }],
      }));
    } catch (err) {
      message.error('提交失败：' + (err as Error)?.message);
      if (practiceMode === 'exam') {
        startTimer();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 把当前题答题状态写入缓存
  const cacheCurrentAnswerState = useCallback((index: number) => {
    setAnswerCache(prev => ({
      ...prev,
      [index]: {
        userAnswer,
        structuredAnswer,
        showFeedback,
        lastResult,
      },
    }));
  }, [userAnswer, structuredAnswer, showFeedback, lastResult]);

  // 应用某一题的答题状态（从缓存）
  const applyCachedAnswerState = useCallback((index: number) => {
    const cached = answerCache[index];
    if (cached) {
      setUserAnswer(cached.userAnswer || '');
      setStructuredAnswer(cached.structuredAnswer || {});
      setShowFeedback(!!cached.showFeedback);
      setLastResult(cached.lastResult || null);
    } else {
      setUserAnswer('');
      setStructuredAnswer({});
      setShowFeedback(false);
      setLastResult(null);
    }
    setShowHint(false);
  }, [answerCache]);

  const finishSession = async () => {
    if (!state.sessionId) return;
    stopTimer();
    setState(prev => ({ ...prev, phase: 'result', loading: true }));
    try {
      await window.api.practiceComplete(state.sessionId);
    } catch {
      // ignore — 已经结束
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleNext = async () => {
    if (!state.sessionId) return;

    cacheCurrentAnswerState(state.currentIndex);

    const nextIndex = state.currentIndex + 1;

    if (nextIndex >= state.questions.length) {
      await finishSession();
      return;
    }

    try {
      // 若已缓存（曾经看过的题）则直接复用，否则向后端请求新题
      let nextQuestion: Question | null = questionCache[nextIndex] || null;
      if (!nextQuestion) {
        const next = await window.api.practiceQuestion(state.sessionId);
        nextQuestion = next?.question as unknown as Question;
        if (nextQuestion) {
          setQuestionCache(prev => ({ ...prev, [nextIndex]: nextQuestion as Question }));
        }
      }
      if (!nextQuestion) {
        message.warning('无法加载下一题');
        return;
      }
      questionStartRef.current = Date.now();
      setState(prev => ({
        ...prev,
        currentIndex: nextIndex,
        currentQuestion: nextQuestion as Question,
        timerMs: 0,
      }));
      applyCachedAnswerState(nextIndex);
      if (practiceMode === 'exam') {
        startTimer();
      }
    } catch (err) {
      message.error('加载下一题失败');
    }
  };

  const handlePrev = () => {
    if (state.currentIndex <= 0) return;
    cacheCurrentAnswerState(state.currentIndex);
    const prevIndex = state.currentIndex - 1;
    const prevQuestion = questionCache[prevIndex];
    if (!prevQuestion) {
      message.warning('上一题不可用');
      return;
    }
    questionStartRef.current = Date.now();
    setState(prev => ({
      ...prev,
      currentIndex: prevIndex,
      currentQuestion: prevQuestion,
      timerMs: 0,
    }));
    applyCachedAnswerState(prevIndex);
    // 学习/考试模式下都停掉计时器：返回上一题是复盘行为
    stopTimer();
  };

  const handleSkip = async () => {
    if (!state.sessionId || !state.currentQuestion) return;
    if (showFeedback) return; // 已提交不允许跳过
    Modal.confirm({
      title: '跳过本题？',
      content: '跳过后将记录为"未作答"（视为答错），稍后可在错题本中找到。',
      okText: '跳过',
      cancelText: '继续作答',
      onOk: async () => {
        try {
          if (practiceMode === 'exam') stopTimer();
          const timeSpentMs = Date.now() - questionStartRef.current;
          // 提交空答案，后端按题型评分（一般为错）
          const result = await window.api.practiceSubmit(state.sessionId!, {
            questionId: state.currentQuestion!.id,
            answer: '',
            timeSpentMs,
          });
          setState(prev => ({
            ...prev,
            results: [...prev.results, {
              questionId: state.currentQuestion!.id,
              isCorrect: result.isCorrect,
              correctAnswer: result.correctAnswer,
              userAnswer: '',
              timeSpentMs,
            }],
          }));
          setLastResult(result);
          setShowFeedback(true);
          // 自动跳到下一题
          setTimeout(() => { void handleNext(); }, 50);
        } catch (err) {
          message.error('跳过失败');
          if (practiceMode === 'exam') startTimer();
        }
      },
    });
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
          ) : (q.questionType === 'BANKED_CLOZE') ? (
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                按编号从词库中选择对应单词（不区分大小写）。
              </Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {(Array.isArray(content.blanks) ? content.blanks : [1, 2, 3, 4, 5]).map((blankNo: number) => (
                  <Space key={blankNo} align="center">
                    <Tag color="blue">{blankNo}</Tag>
                    <Input
                      placeholder={`第 ${blankNo} 空`}
                      value={structuredAnswer[String(blankNo)] || ''}
                      onChange={(e) => setStructuredAnswer(prev => ({ ...prev, [String(blankNo)]: e.target.value }))}
                      disabled={showFeedback}
                      style={{ width: 220 }}
                    />
                  </Space>
                ))}
              </Space>
            </div>
          ) : (q.questionType === 'INFO_MATCHING') ? (
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                为每个题号选择对应段落（A-F）。
              </Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {(() => {
                  // 从 correctAnswer 推断题号范围（JSON 的 keys）
                  let keys: string[] = [];
                  try {
                    keys = Object.keys(JSON.parse(q.correctAnswer || '{}'));
                  } catch { /* ignore */ }
                  if (keys.length === 0) keys = ['36', '37', '38', '39', '40'];
                  return keys.map((key) => (
                    <Space key={key} align="center">
                      <Tag color="purple">{key}</Tag>
                      <Radio.Group
                        value={structuredAnswer[key] || ''}
                        onChange={(e) => setStructuredAnswer(prev => ({ ...prev, [key]: e.target.value }))}
                        disabled={showFeedback}
                        optionType="button"
                        buttonStyle="solid"
                      >
                        {['A', 'B', 'C', 'D', 'E', 'F'].map(letter => (
                          <Radio.Button key={letter} value={letter}>{letter}</Radio.Button>
                        ))}
                      </Radio.Group>
                    </Space>
                  ));
                })()}
              </Space>
            </div>
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
                  {dailyGoal > 0 && (
                    <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                      💡 每日目标：{dailyGoal} 题（可在「设置」中调整）
                    </div>
                  )}
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
            {q.explanation && showExplanationSetting && (
              <>
                <Text strong>解析：</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</Paragraph>
              </>
            )}
            {q.explanation && !showExplanationSetting && (
              <Button type="link" onClick={() => setShowHint(true)} style={{ padding: 0 }}>
                显示解析
              </Button>
            )}
            {q.explanation && !showExplanationSetting && showHint && (
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{q.explanation}</Paragraph>
            )}
          </Card>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              disabled={state.currentIndex <= 0}
              onClick={handlePrev}
            >
              上一题
            </Button>
            {!showFeedback && (
              <Button
                icon={<StepForwardOutlined />}
                onClick={handleSkip}
                danger
              >
                跳过本题
              </Button>
            )}
          </Space>
          <Space>
            {!showFeedback ? (
              <Button
                type="primary"
                size="large"
                loading={submitting}
                onClick={handleSubmit}
              >
                提交答案
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                onClick={handleNext}
                style={{
                  background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
                  borderColor: '#1677ff',
                  boxShadow: '0 4px 14px rgba(22,119,255,0.45)',
                  fontWeight: 'bold',
                  paddingLeft: 24,
                  paddingRight: 24,
                  height: 44,
                  fontSize: 16,
                }}
                autoFocus
              >
                {state.currentIndex + 1 >= state.questions.length ? '查看结果' : '下一题'}
              </Button>
            )}
          </Space>
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
          stopTimer();
          setState({ phase: 'config', sessionId: null, questions: [], currentIndex: 0, currentQuestion: null, results: [], startTime: 0, timerMs: 0, loading: false });
          setUserAnswer('');
          setStructuredAnswer({});
          setQuestionCache({});
          setAnswerCache({});
          setShowFeedback(false);
          setShowHint(false);
          setLastResult(null);
          setSubmitting(false);
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