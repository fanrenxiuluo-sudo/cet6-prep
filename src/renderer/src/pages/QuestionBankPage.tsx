import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Select, Input, Space, Button, Tooltip, message, Modal, Card, Collapse, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined, ImportOutlined, InfoCircleOutlined, FolderOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import useThemeStore from '../stores/useThemeStore';

const { Option } = Select;

interface QuestionRecord {
  id: string;
  questionType: string;
  section: string;
  subSection?: string;
  difficulty: number;
  sourceExam?: string;
  examYear?: number;
  examSession?: string;
  dataSource: string;
  qualityStatus: string;
  createdAt: string;
}

interface ExamGroup {
  label: string;
  examYear: number | null;
  examSession: string | null;
  sourceExam: string | null;
  count: number;
}

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

const DIFFICULTY_LABELS = ['', '\u2B50', '\u2B50\u2B50', '\u2B50\u2B50\u2B50', '\u2B50\u2B50\u2B50\u2B50', '\u2B50\u2B50\u2B50\u2B50\u2B50'];

const DATA_SOURCE_LABELS: Record<string, string> = {
  builtin: '内置',
  import: '导入',
  scraper: '爬虫',
};

const EXAM_SESSION_LABELS: Record<string, string> = {
  '06': '6月',
  '12': '12月',
};

const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionRecord[]>([]);
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'exam' | 'type'>('exam');
  const [expandedExams, setExpandedExams] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    section: undefined as string | undefined,
    questionType: undefined as string | undefined,
    examYear: undefined as number | undefined,
    difficulty: undefined as number | undefined,
    sourceExam: undefined as string | undefined,
    search: '',
  });

  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showTotal: (t) => `\u5171 ${t} \u9053\u9898`,
  });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, unknown> = {
        limit: 500,
      };
      if (filters.section) filterParams.section = filters.section;
      if (filters.questionType) filterParams.questionType = filters.questionType;
      if (filters.examYear) filterParams.examYear = filters.examYear;
      if (filters.difficulty) filterParams.difficulty = filters.difficulty;

      const data = await window.api.questionList(filterParams);
setAllQuestions(data as unknown as QuestionRecord[]);
      setQuestions(data as unknown as QuestionRecord[]);
      setTotal(data.length);

      const groups: Record<string, ExamGroup> = {};
      for (const q of data as unknown as QuestionRecord[]) {
        const key = q.sourceExam || 'other';
        if (!groups[key]) {
          groups[key] = {
            label: q.sourceExam
              ? `${q.examYear || ''}\u5E74${EXAM_SESSION_LABELS[q.examSession || ''] || (q.examSession || '')}`
              : '\u5176\u4ED6\u9898\u76EE',
            examYear: q.examYear || null,
            examSession: q.examSession || null,
            sourceExam: q.sourceExam,
            count: 0,
          };
        }
        groups[key].count++;
      }
      setExamGroups(Object.values(groups).sort((a, b) => {
        if (!a.examYear) return 1;
        if (!b.examYear) return -1;
        if (a.examYear !== b.examYear) return b.examYear - a.examYear;
        const sa = a.examSession === '12' ? 1 : 0;
        const sb = b.examSession === '12' ? 1 : 0;
        return sb - sa;
      }));
    } catch (err) {
      message.error('\u52A0\u8F7D\u9898\u5E93\u5931\u8D25');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const resetFilters = () => {
    setFilters({ section: undefined, questionType: undefined, examYear: undefined, difficulty: undefined, sourceExam: undefined, search: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const filteredQuestions = filters.search
    ? allQuestions.filter(q =>
        (q.sourceExam || '').toLowerCase().includes(filters.search.toLowerCase()) ||
        QUESTION_TYPE_LABELS[q.questionType]?.includes(filters.search) ||
        SECTION_LABELS[q.section]?.includes(filters.search)
      )
    : questions;

  const columns: ColumnsType<QuestionRecord> = [
    {
      title: '\u9898\u578B',
      dataIndex: 'questionType',
      key: 'questionType',
      width: 110,
      render: (type: string) => (
        <Tag>{QUESTION_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: '\u677F\u5757',
      dataIndex: 'section',
      key: 'section',
      width: 80,
      render: (section: string) => (
        <Tag color={SECTION_COLORS[section]}>{SECTION_LABELS[section] || section}</Tag>
      ),
    },
    {
      title: '\u96BE\u5EA6',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 100,
      sorter: (a, b) => a.difficulty - b.difficulty,
      render: (d: number) => (
        <Tooltip title={`\u96BE\u5EA6 ${d}/5`}>
          <span>{DIFFICULTY_LABELS[d] || d}</span>
        </Tooltip>
      ),
    },
    {
      title: '\u6765\u6E90\u8003\u8BD5',
      dataIndex: 'sourceExam',
      key: 'sourceExam',
      width: 130,
      render: (v: string, record: QuestionRecord) => {
        if (!v) return '-';
        const sessionLabel = EXAM_SESSION_LABELS[record.examSession || ''] || record.examSession || '';
        return `${record.examYear || ''}\u5E74${sessionLabel}`;
      },
    },
    {
      title: '\u6570\u636E\u6765\u6E90',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 90,
      render: (v: string) => (
        <Tag>{DATA_SOURCE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '\u72B6\u6001',
      dataIndex: 'qualityStatus',
      key: 'qualityStatus',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'validated' ? 'success' : v === 'rejected' ? 'error' : 'processing'}>
          {v === 'validated' ? '\u5DF2\u9A8C\u8BC1' : v === 'rejected' ? '\u5DF2\u62D2\u7EDD' : '\u5F85\u5BA1'}
        </Tag>
      ),
    },
    {
      title: '\u64CD\u4F5C',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: QuestionRecord) => (
        <Tooltip title="\u67E5\u770B\u8BE6\u60C5">
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => showDetail(record)}
          />
        </Tooltip>
      ),
    },
  ];

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);

  const showDetail = async (record: QuestionRecord) => {
    try {
      const data = await window.api.questionGet(record.id);
setDetailData(data as unknown as Record<string, unknown>);
      setDetailVisible(true);
    } catch {
      message.error('\u83B7\u53D6\u9898\u76EE\u8BE6\u60C5\u5931\u8D25');
    }
  };

  const renderExamView = () => {
    if (examGroups.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          \u6682\u65E0\u9898\u76EE\uFF0C\u8BF7\u901A\u8FC7\u9898\u6E90\u7BA1\u7406\u5BFC\u5165\u9898\u76EE
        </div>
      );
    }

    return (
      <Collapse
        activeKey={expandedExams}
        onChange={(keys) => setExpandedExams(keys as string[])}
        style={{ marginTop: 16 }}
      >
        {examGroups.map((group) => {
          const examQuestions = group.sourceExam
            ? allQuestions.filter(q => q.sourceExam === group.sourceExam)
            : allQuestions.filter(q => !q.sourceExam);

          const sectionsMap: Record<string, number> = {};
          for (const q of examQuestions) {
            const sectionLabel = SECTION_LABELS[q.section] || q.section;
            sectionsMap[sectionLabel] = (sectionsMap[sectionLabel] || 0) + 1;
          }

          return (
            <Collapse.Panel
              key={group.sourceExam || 'other'}
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FolderOutlined />
                  <span style={{ fontWeight: 'bold' }}>{group.label}</span>
                  <Tag color="blue">{group.count} \u9898</Tag>
                  {Object.entries(sectionsMap).map(([section, count]) => (
                    <Tag key={section}>{section} {count}</Tag>
                  ))}
                </div>
              }
            >
              <Table
                columns={columns}
                dataSource={examQuestions}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="small"
              />
            </Collapse.Panel>
          );
        })}
      </Collapse>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>\uD83D\uDCDA \u9898\u5E93\u6D4F\u89C8</h2>

      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type={viewMode === 'exam' ? 'primary' : 'default'}
          onClick={() => setViewMode('exam')}
        >
          \u6309\u771F\u9898\u5206\u7EC4
        </Button>
        <Button
          type={viewMode === 'type' ? 'primary' : 'default'}
          onClick={() => setViewMode('type')}
        >
          \u6309\u9898\u578B\u6D4F\u89C8
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="\u677F\u5757"
          allowClear
          style={{ width: 120 }}
          value={filters.section}
          onChange={(v) => handleFilterChange('section', v)}
        >
          <Option value="LISTENING">\u542C\u529B</Option>
          <Option value="READING">\u9605\u8BFB</Option>
          <Option value="WRITING">\u5199\u4F5C</Option>
          <Option value="TRANSLATION">\u7FFB\u8BD1</Option>
        </Select>

        <Select
          placeholder="\u9898\u578B"
          allowClear
          style={{ width: 130 }}
          value={filters.questionType}
          onChange={(v) => handleFilterChange('questionType', v)}
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>

        <Select
          placeholder="\u96BE\u5EA6"
          allowClear
          style={{ width: 100 }}
          value={filters.difficulty}
          onChange={(v) => handleFilterChange('difficulty', v)}
        >
          {[1, 2, 3, 4, 5].map(d => (
            <Option key={d} value={d}>\u96BE\u5EA6 {d}</Option>
          ))}
        </Select>

        <Input
          placeholder="\u641C\u7D22..."
          prefix={<SearchOutlined />}
          allowClear
          style={{ width: 200 }}
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />

        <Button icon={<ReloadOutlined />} onClick={resetFilters}>\u91CD\u7F6E</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchQuestions}>\u5237\u65B0</Button>
      </Space>

      {viewMode === 'exam' ? (
        renderExamView()
      ) : (
        <Table
          columns={columns}
          dataSource={filteredQuestions}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: filteredQuestions.length,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
          }}
          size="middle"
        />
      )}

      <Modal
        title="\u9898\u76EE\u8BE6\u60C5"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailData && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 500,
            overflow: 'auto',
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
          }}>
            {JSON.stringify(detailData, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
};

export default QuestionBankPage;