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
  { label: '\u5168\u90E8', value: '' },
  { label: '\u542C\u529B', value: 'LISTENING' },
  { label: '\u9605\u8BFB', value: 'READING' },
  { label: '\u5199\u4F5C', value: 'WRITING' },
  { label: '\u7FFB\u8BD1', value: 'TRANSLATION' },
];

const COUNT_OPTIONS = [5, 10, 15, 20];

const DIFFICULTY_OPTIONS = [
  { label: '\u5165\u95E8', value: 1, icon: <SafetyOutlined />, desc: '\u57FA\u7840\u9898\uFF0C\u9002\u5408\u96F6\u57FA\u7840\u7528\u6237' },
  { label: '\u57FA\u7840', value: 2, icon: <BookOutlined />, desc: '\u6838\u5FC3\u77E5\u8BC6\u70B9\uFF0C\u9002\u5408\u521D\u5B66\u8005' },
  { label: '\u8FDB\u9636', value: 3, icon: <ThunderboltOutlined />, desc: '\u7EFC\u5408\u5E94\u7528\uFF0C\u9002\u5408\u6709\u4E00\u5B9A\u57FA\u7840\u7684\u7528\u6237' },
  { label: '\u4E0D\u9650', value: 0, icon: <ClockCircleOutlined />, desc: '\u968F\u673A\u62BD\u53D6\u6240\u6709\u96BE\u5EA6' },
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
        message.warning('\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u9898\u76EE');
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
      message.error('\u5F00\u59CB\u7EC3\u4E60\u5931\u8D25: ' + (err as Error).message);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSubmit = async () => {
    if (!state.sessionId || !state.currentQuestion) return;
    if (!userAnswer.trim() && !state.currentQuestion.options) {
      message.warning('\u8BF7\u5148\u4F5C\u7B54');
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
      message.error('\u63D0\u4EA4\u5931\u8D25');
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
      message.error('\u52A0\u8F7D\u4E0B\u4E00\u9898\u5931\u8D25');
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
            title={content.passage ? '\u6587\u7AE0\u539F\u6587' : '\u9898\u76EE'}
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
                <Text strong>\u8BCD\u5E93\uFF1A</Text>
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
                <Text strong>\u586B\u7A7A\u4F4D\u7F6E\uFF1A</Text>
                <Text> {JSON.stringify(content.blanks)}</Text>
              </div>
            )}
          </Card>
        )}

        {content.minWords && content.maxWords && (
          <Alert
            message={`\u5B57\u6570\u8981\u6C42\uFF1A${content.minWords} - ${content.maxWords} \u8BCD`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {content.keyPhrases && (
          <Card title="\u5173\u952E\u8BCD\u7EC4\u63D0\u793A" size="small" style={{ marginBottom: 16 }}>
            <Space wrap>
              {(content.keyPhrases as string[]).map((phrase: string, i: number) => (
                <Tag key={i} color="orange">{phrase}</Tag>
              ))}
            </Space>
          </Card>
        )}

        <Card title="\u4F5C\u7B54" style={{ marginBottom: 16 }}>
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
              placeholder={q.questionType === 'TRANSLATION' ? '\u8F93\u5165\u4F60\u7684\u7FFB\u8BD1...' : q.questionType === 'ESSAY' ? '\u5728\u6B64\u5199\u4F5C\u6587...' : '\u8F93\u5165\u4F60\u7684\u7B54\u6848...'}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showFeedback}
            />
          )}
        </Card>

        {practiceMode === 'learning' && !showFeedback && (
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={() => setShowHint(!showHint)}>
              {showHint ? '\u9690\u85CF\u63D0\u793A' : '\u663E\u793A\u63D0\u793A'}
            </Button>
          </Space>
        )}

        {showHint && !showFeedback && q.explanation && (
          <Card size="small" title="\u53C2\u8003\u63D0\u793A" style={{ marginBottom: 16, borderLeft: '3px solid #faad14' }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</Paragraph>
          </Card>
        )}
      </>
    );
  };

  if (state.phase === 'config') {
    return (
      <div style={{ padding: 24 }}>
        <h2>\uD83D\uDCDD \u7EC3\u4E60</h2>

        <Row gutter={[24, 24]}>
          <Col span={14}>
            <Card title="\u9009\u62E9\u7EC3\u4E60\u914D\u7F6E" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong style={{ fontSize: 15 }}>\u7EC3\u4E60\u6A21\u5F0F</Text>
                  <div style={{ marginTop: 8 }}>
                    <Segmented
                      options={[
                        { label: <span><SafetyOutlined /> \u5B66\u4E60\u6A21\u5F0F</span>, value: 'learning' },
                        { label: <span><ThunderboltOutlined /> \u8003\u8BD5\u6A21\u5F0F</span>, value: 'exam' },
                      ]}
                      value={practiceMode}
                      onChange={(v) => setPracticeMode(v as 'learning' | 'exam')}
                      style={{ marginBottom: 4 }}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 13 }}>
                    {practiceMode === 'learning'
                      ? '\u5B66\u4E60\u6A21\u5F0F\uFF1A\u4E0D\u8BA1\u65F6\uFF0C\u53EF\u67E5\u770B\u63D0\u793A\uFF0C\u9002\u5408\u96F6\u57FA\u7840\u7528\u6237'
                      : '\u8003\u8BD5\u6A21\u5F0F\uFF1A\u8BA1\u65F6\u505A\u9898\uFF0C\u65E0\u63D0\u793A\uFF0C\u6A21\u62DF\u771F\u5B9E\u8003\u573A'}
                  </div>
                </div>

                <div>
                  <Text strong style={{ fontSize: 15 }}>\u8003\u8BD5\u677F\u5757</Text>
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
                  <Text strong style={{ fontSize: 15 }}>\u96BE\u5EA6\u7EA7\u522B</Text>
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
                  <Text strong style={{ fontSize: 15 }}>\u9898\u76EE\u6570\u91CF</Text>
                  <Space style={{ marginTop: 8 }}>
                    {COUNT_OPTIONS.map(c => (
                      <Button
                        key={c}
                        type={count === c ? 'primary' : 'default'}
                        onClick={() => setCount(c)}
                      >
                        {c} \u9898
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
                  \u5F00\u59CB\u7EC3\u4E60
                </Button>
              </Space>
            </Card>
          </Col>

          <Col span={10}>
            <Card title="\u7EC3\u4E60\u8BF4\u660E" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ color: '#1677ff' }}><SafetyOutlined /> \u5B66\u4E60\u6A21\u5F0F</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>\u4E0D\u8BA1\u65F6\uFF0C\u8F7B\u677E\u5B66\u4E60</li>
                    <li>\u53EF\u968F\u65F6\u67E5\u770B\u53C2\u8003\u63D0\u793A</li>
                    <li>\u9002\u5408\u96F6\u57FA\u7840\u6216\u521D\u5B66\u8005</li>
                    <li>\u5EFA\u8BAE\u4ECE\u201C\u5165\u95E8\u201D\u96BE\u5EA6\u5F00\u59CB</li>
                  </ul>
                </div>
                <div>
                  <Text strong style={{ color: '#ff4d4f' }}><ThunderboltOutlined /> \u8003\u8BD5\u6A21\u5F0F</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>\u8BA1\u65F6\u505A\u9898\uFF0C\u6A21\u62DF\u771F\u5B9E\u8003\u573A</li>
                    <li>\u4E0D\u63D0\u4F9B\u63D0\u793A</li>
                    <li>\u9002\u5408\u6709\u57FA\u7840\u7684\u7528\u6237</li>
                    <li>\u63A8\u8350\u9009\u62E9\u201C\u8FDB\u9636\u201D\u6216\u201C\u4E0D\u9650\u201D\u96BE\u5EA6</li>
                  </ul>
                </div>
                <div>
                  <Text strong>\u96BE\u5EA6\u7B49\u7EA7\u8BF4\u660E</Text>
                  <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13 }}>
                    <li>\u2605 \u5165\u95E8\uFF081\u7EA7\uFF09\uFF1A\u57FA\u7840\u8BCD\u6C47\u4E0E\u53E5\u578B</li>
                    <li>\u2605\u2605 \u57FA\u7840\uFF082\u7EA7\uFF09\uFF1A\u6838\u5FC3\u77E5\u8BC6\u70B9\u7406\u89E3</li>
                    <li>\u2605\u2605\u2605 \u8FDB\u9636\uFF083\u7EA7\uFF09\uFF1A\u7EFC\u5408\u5E94\u7528\u4E0E\u63A8\u7406</li>
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
            <Tag>\u96BE\u5EA6 {q.difficulty}/5</Tag>
            <Tag color={practiceMode === 'learning' ? 'green' : 'red'}>
              {practiceMode === 'learning' ? '\u5B66\u4E60' : '\u8003\u8BD5'}
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
              ? <Text style={{ color: '#52c41a' }}><CheckCircleOutlined /> \u56DE\u7B54\u6B63\u786E\uFF01</Text>
              : <Text style={{ color: '#ff4d4f' }}><CloseCircleOutlined /> \u56DE\u7B54\u9519\u8BEF</Text>
            }
          >
            <Text strong>\u6B63\u786E\u7B54\u6848\uFF1A</Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{lastResult.correctAnswer}</Paragraph>
            {q.explanation && (
              <>
                <Text strong>\u89E3\u6790\uFF1A</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{q.explanation}</Paragraph>
              </>
            )}
          </Card>
        )}

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          {!showFeedback ? (
            <Button type="primary" size="large" onClick={handleSubmit}>
              \u63D0\u4EA4\u7B54\u6848
            </Button>
          ) : (
            <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={handleNext}>
              {state.currentIndex + 1 >= state.questions.length ? '\u67E5\u770B\u7ED3\u679C' : '\u4E0B\u4E00\u9898'}
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
        <h2>\uD83C\uDF89 \u7EC3\u4E60\u5B8C\u6210</h2>
        <Card>
          <Row gutter={16} style={{ textAlign: 'center' }}>
            <Col span={8}>
              <Statistic title="\u603B\u9898\u6570" value={total} />
            </Col>
            <Col span={8}>
              <Statistic title="\u6B63\u786E\u6570" value={correctCount} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={8}>
              <Statistic title="\u6B63\u786E\u7387" value={accuracy} suffix="%" valueStyle={{ color: accuracy >= 60 ? '#52c41a' : '#ff4d4f' }} />
            </Col>
          </Row>
          {state.timerMs > 0 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Statistic title="\u603B\u7528\u65F6" value={formatTime(state.timerMs)} />
            </div>
          )}
        </Card>

        {state.results.filter(r => !r.isCorrect).length > 0 && (
          <Card title="\u274C \u9519\u9898\u56DE\u987E" style={{ marginTop: 16 }}>
            {state.results.filter(r => !r.isCorrect).map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, borderRadius: 6 }}>
                <Text>\u4F60\u7684\u7B54\u6848\uFF1A<Text type="danger">{String(r.userAnswer)}</Text></Text>
                <br />
                <Text>\u6B63\u786E\u7B54\u6848\uFF1A<Text style={{ color: '#52c41a' }}>{r.correctAnswer}</Text></Text>
              </div>
            ))}
          </Card>
        )}

        <Button type="primary" size="large" block style={{ marginTop: 16 }} onClick={() => {
          setState({ phase: 'config', sessionId: null, questions: [], currentIndex: 0, currentQuestion: null, results: [], startTime: 0, timerMs: 0, loading: false });
          setUserAnswer('');
          setShowFeedback(false);
        }}>
          \u518D\u6765\u4E00\u8F6E
        </Button>
      </div>
    );
  }

  return <Spin spinning={state.loading} />;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  LISTENING_MCQ: '\u542C\u529B\u9009\u62E9',
  BANKED_CLOZE: '\u9009\u8BCD\u586B\u7A7A',
  CAREFUL_READING: '\u4ED4\u7EC6\u9605\u8BFB',
  INFO_MATCHING: '\u4FE1\u606F\u5339\u914D',
  ESSAY: '\u5199\u4F5C',
  TRANSLATION: '\u7FFB\u8BD1',
};

const SECTION_LABELS: Record<string, string> = {
  LISTENING: '\u542C\u529B',
  READING: '\u9605\u8BFB',
  WRITING: '\u5199\u4F5C',
  TRANSLATION: '\u7FFB\u8BD1',
};

const SECTION_COLORS: Record<string, string> = {
  LISTENING: 'blue',
  READING: 'green',
  WRITING: 'orange',
  TRANSLATION: 'purple',
};

export default PracticePage;