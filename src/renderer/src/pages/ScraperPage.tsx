/**
 * 题源管理页面 — 爬虫任务管理、题源配置
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Spin,
  Empty,
  Tooltip,
  Descriptions,
  Timeline,
} from 'antd';
import {
  SyncOutlined,
  PlusOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

interface ScrapingSource {
  id: string;
  name: string;
  url: string;
  type: 'web' | 'api' | 'file';
  parser: string;
  enabled: boolean;
  lastSyncAt?: string;
}

interface ScrapingTask {
  id: string;
  sourceId: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  startedAt?: string;
  completedAt?: string;
  errorSummary?: string;
}

interface FailLog {
  id: string;
  url: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  failedAt: string;
}

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
  running: { color: 'processing', icon: <SyncOutlined spin />, text: '运行中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
  cancelled: { color: 'warning', icon: <PauseCircleOutlined />, text: '已取消' },
};

const TYPE_MAP: Record<string, string> = {
  web: '网页',
  api: 'API',
  file: '文件',
};

export default function ScraperPage() {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [tasks, setTasks] = useState<ScrapingTask[]>([]);
  const [selectedSource, setSelectedSource] = useState<ScrapingSource | null>(null);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<ScrapingTask | null>(null);
  const [failLogs, setFailLogs] = useState<FailLog[]>([]);

  // 加载题源
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.scraperSources();
      setSources(data);
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载任务
  const loadTasks = useCallback(async (sourceId?: string) => {
    setLoading(true);
    try {
      const data = await window.api.scraperTasks(sourceId);
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
    loadTasks();
  }, [loadSources, loadTasks]);

  // 创建并启动任务
  const handleSync = async (source: ScrapingSource) => {
    Modal.confirm({
      title: '确认同步',
      content: `确定要从 "${source.name}" 抓取题目吗？`,
      onOk: async () => {
        setLoading(true);
        try {
          // 创建任务
          const task = await window.api.scraperCreateTask(source.id);
          message.success('任务已创建');

          // 启动任务
          await window.api.scraperStartTask(task.id);
          message.info('任务已启动');

          // 刷新任务列表
          loadTasks();
        } catch (error) {
          message.error('操作失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 取消任务
  const handleCancel = async (taskId: string) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消这个任务吗？',
      onOk: async () => {
        try {
          await window.api.scraperCancelTask(taskId);
          message.success('任务已取消');
          loadTasks();
        } catch (error) {
          message.error('取消失败');
        }
      },
    });
  };

  // 查看任务详情
  const viewTaskDetail = async (task: ScrapingTask) => {
    setCurrentTask(task);
    setTaskDetailVisible(true);

    // 加载失败日志
    if (task.failedItems > 0) {
      try {
        const logs = await window.api.scraperFailLogs(task.id);
        setFailLogs(logs);
      } catch (error) {
        console.error('Failed to load fail logs:', error);
      }
    }
  };

  // 题源列
  const sourceColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => TYPE_MAP[type] || type,
    },
    {
      title: '解析器',
      dataIndex: 'parser',
      key: 'parser',
      render: (parser: string) => <Tag>{parser}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) =>
        enabled ? <Tag color="success">启用</Tag> : <Tag color="default">禁用</Tag>,
    },
    {
      title: '上次同步',
      dataIndex: 'lastSyncAt',
      key: 'lastSyncAt',
      render: (time?: string) =>
        time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '从未同步',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ScrapingSource) => (
        <Space>
          <Tooltip title="同步">
            <Button
              type="primary"
              icon={<SyncOutlined />}
              size="small"
              disabled={!record.enabled}
              onClick={() => handleSync(record)}
            >
              同步
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 任务列
  const taskColumns = [
    {
      title: '题源',
      dataIndex: 'sourceId',
      key: 'sourceId',
      render: (sourceId: string) => {
        const source = sources.find(s => s.id === sourceId);
        return source ? source.name : sourceId;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const info = STATUS_MAP[status] || { color: 'default', icon: null, text: status };
        return <Tag color={info.color} icon={info.icon}>{info.text}</Tag>;
      },
    },
    {
      title: '进度',
      key: 'progress',
      render: (_: unknown, record: ScrapingTask) => {
        const percent = record.totalItems > 0
          ? Math.round((record.completedItems / record.totalItems) * 100)
          : 0;
        return `${record.completedItems}/${record.totalItems} (${percent}%)`;
      },
    },
    {
      title: '失败',
      dataIndex: 'failedItems',
      key: 'failedItems',
      render: (count: number) =>
        count > 0 ? <Tag color="error">{count}</Tag> : <Tag>0</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (time?: string) =>
        time ? dayjs(time).format('HH:mm:ss') : '-',
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (time?: string) =>
        time ? dayjs(time).format('HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ScrapingTask) => (
        <Space>
          {record.status === 'running' && (
            <Tooltip title="取消">
              <Button
                type="link"
                danger
                icon={<PauseCircleOutlined />}
                onClick={() => handleCancel(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="详情">
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={() => viewTaskDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 题源列表 */}
      <Card title="题源列表" style={{ marginBottom: 16 }}>
        <Table
          dataSource={sources}
          columns={sourceColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 任务历史 */}
      <Card
        title="任务历史"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => loadTasks()}>
            刷新
          </Button>
        }
      >
        <Table
          dataSource={tasks}
          columns={taskColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 任务详情弹窗 */}
      <Modal
        title="任务详情"
        open={taskDetailVisible}
        onCancel={() => setTaskDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentTask && (
          <div>
            <Descriptions column={2}>
              <Descriptions.Item label="任务ID">
                <Tag>{currentTask.id.substring(0, 8)}...</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[currentTask.status]?.color}>
                  {STATUS_MAP[currentTask.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="题源">
                {sources.find(s => s.id === currentTask.sourceId)?.name || currentTask.sourceId}
              </Descriptions.Item>
              <Descriptions.Item label="进度">
                {currentTask.completedItems}/{currentTask.totalItems}
              </Descriptions.Item>
              <Descriptions.Item label="失败数">
                {currentTask.failedItems}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {currentTask.startedAt ? dayjs(currentTask.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {currentTask.completedAt ? dayjs(currentTask.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {failLogs.length > 0 && (
              <Card title="失败日志" size="small" style={{ marginTop: 16 }}>
                <Timeline
                  items={failLogs.map(log => ({
                    color: 'red',
                    children: (
                      <div>
                        <div style={{ color: '#ff4d4f' }}>{log.errorCode}: {log.errorMessage}</div>
                        <div style={{ color: '#999', fontSize: 12 }}>{log.url}</div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                          重试 {log.retryCount} 次 - {dayjs(log.failedAt).format('HH:mm:ss')}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
