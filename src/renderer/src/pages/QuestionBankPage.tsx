import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Select, Input, Space, Button, Tooltip, message, Modal } from 'antd';
import { SearchOutlined, ReloadOutlined, ImportOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

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

// ═══════════════════ 常量 ═══════════════════

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

const DIFFICULTY_LABELS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

const DATA_SOURCE_LABELS: Record<string, string> = {
  builtin: '内置',
  import: '导入',
  scraper: '爬虫',
};

// ═══════════════════ 组件 ═══════════════════

const QuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 筛选状态
  const [filters, setFilters] = useState({
    section: undefined as string | undefined,
    questionType: undefined as string | undefined,
    examYear: undefined as number | undefined,
    difficulty: undefined as number | undefined,
    search: '',
  });

  // 分页
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    showTotal: (t) => `共 ${t} 道题`,
  });

  // ═══════════════════ 数据加载 ═══════════════════

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, unknown> = {
        limit: pagination.pageSize || 20,
      };
      if (filters.section) filterParams.section = filters.section;
      if (filters.questionType) filterParams.questionType = filters.questionType;
      if (filters.examYear) filterParams.examYear = filters.examYear;
      if (filters.difficulty) filterParams.difficulty = filters.difficulty;

      const data = await window.api.questionList(filterParams);
      setQuestions(data);
      setTotal(data.length);
    } catch (err) {
      message.error('加载题库失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ═══════════════════ 列定义 ═══════════════════

  const columns: ColumnsType<QuestionRecord> = [
    {
      title: '题型',
      dataIndex: 'questionType',
      key: 'questionType',
      width: 120,
      render: (type: string) => (
        <Tag>{QUESTION_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: '板块',
      dataIndex: 'section',
      key: 'section',
      width: 80,
      render: (section: string) => (
        <Tag color={SECTION_COLORS[section]}>{SECTION_LABELS[section] || section}</Tag>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 120,
      sorter: (a, b) => a.difficulty - b.difficulty,
      render: (d: number) => (
        <Tooltip title={`难度 ${d}/5`}>
          <span>{DIFFICULTY_LABELS[d] || d}</span>
        </Tooltip>
      ),
    },
    {
      title: '来源考试',
      dataIndex: 'sourceExam',
      key: 'sourceExam',
      width: 130,
      render: (v: string) => v || '-',
    },
    {
      title: '年份',
      dataIndex: 'examYear',
      key: 'examYear',
      width: 80,
      sorter: (a, b) => (a.examYear || 0) - (b.examYear || 0),
      render: (v: number) => v || '-',
    },
    {
      title: '数据来源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 90,
      render: (v: string) => (
        <Tag>{DATA_SOURCE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'qualityStatus',
      key: 'qualityStatus',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'validated' ? 'success' : v === 'rejected' ? 'error' : 'processing'}>
          {v === 'validated' ? '已验证' : v === 'rejected' ? '已拒绝' : '待审'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: QuestionRecord) => (
        <Tooltip title="查看详情">
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

  // ═══════════════════ 详情弹窗 ═══════════════════

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);

  const showDetail = async (record: QuestionRecord) => {
    try {
      const data = await window.api.questionGet(record.id);
      setDetailData(data);
      setDetailVisible(true);
    } catch {
      message.error('获取题目详情失败');
    }
  };

  // ═══════════════════ 筛选变更 ═══════════════════

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const resetFilters = () => {
    setFilters({ section: undefined, questionType: undefined, examYear: undefined, difficulty: undefined, search: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // ═══════════════════ 渲染 ═══════════════════

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>📚 题库浏览</h2>

      {/* 筛选栏 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="板块"
          allowClear
          style={{ width: 120 }}
          value={filters.section}
          onChange={(v) => handleFilterChange('section', v)}
        >
          <Option value="LISTENING">听力</Option>
          <Option value="READING">阅读</Option>
          <Option value="WRITING">写作</Option>
          <Option value="TRANSLATION">翻译</Option>
        </Select>

        <Select
          placeholder="题型"
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
          placeholder="难度"
          allowClear
          style={{ width: 100 }}
          value={filters.difficulty}
          onChange={(v) => handleFilterChange('difficulty', v)}
        >
          {[1, 2, 3, 4, 5].map(d => (
            <Option key={d} value={d}>难度 {d}</Option>
          ))}
        </Select>

        <Input
          placeholder="搜索来源考试..."
          prefix={<SearchOutlined />}
          allowClear
          style={{ width: 200 }}
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />

        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </Space>

      {/* 题目表格 */}
      <Table
        columns={columns}
        dataSource={questions}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
        size="middle"
      />

      {/* 详情弹窗 */}
      <Modal
        title="题目详情"
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
            background: '#1a1a2e',
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
