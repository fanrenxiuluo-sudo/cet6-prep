import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Switch,
  InputNumber,
  Select,
  Button,
  Space,
  message,
  Modal,
  Divider,
  Descriptions,
  Tag,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import useThemeStore from '../stores/useThemeStore';

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  autoPlayAudio: boolean;
  showExplanation: boolean;
  dailyGoal: number;
  reviewRemind: boolean;
  soundEffect: boolean;
  exportPath: string;
}

interface AppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  databasePath: string;
  dataSize: string;
}

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await window.api.settingsGet();
      form.setFieldsValue(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const loadAppInfo = useCallback(async () => {
    try {
      const info = await window.api.settingsAppInfo();
      setAppInfo(info);
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadAppInfo();
  }, [loadSettings, loadAppInfo]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const success = await window.api.settingsSave(values);
      if (success) {
        message.success('设置已保存');
        if (values.theme) {
          useThemeStore.getState().setTheme(values.theme);
        }
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const values = form.getFieldsValue();
    const exportPath = values.exportPath || '';

    if (!exportPath) {
      message.warning('请先设置导出路径');
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.settingsExport(exportPath);
      if (result.success) {
        message.success(`数据已导出到：${result.path}`);
      } else {
        message.error(`导出失败：${result.error}`);
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    Modal.confirm({
      title: '确认导入',
      content: '导入将覆盖现有数据，确定继续？',
      onOk: async () => {
        const values = form.getFieldsValue();
        const exportPath = values.exportPath || '';

        if (!exportPath) {
          message.warning('请先设置导出路径（用作导入路径）');
          return;
        }

        setLoading(true);
        try {
          message.info('请通过命令行导入数据文件');
        } catch (error) {
          message.error('导入失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleClear = (type: 'studyRecords' | 'wrongQuestions' | 'all') => {
    const titles = {
      studyRecords: '学习记录',
      wrongQuestions: '错题记录',
      all: '所有数据',
    };

    Modal.confirm({
      title: `确认清除${titles[type]}`,
      content: `确定要清除${titles[type]}吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const result = await window.api.settingsClear({ [type]: true });
          if (result.success) {
            message.success(`已清除 ${result.deleted} 条记录`);
          } else {
            message.error(`清除失败：${result.error}`);
          }
        } catch (error) {
          message.error('清除失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (loading && !appInfo) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          theme: 'dark',
          fontSize: 14,
          autoPlayAudio: true,
          showExplanation: true,
          dailyGoal: 20,
          reviewRemind: true,
          soundEffect: true,
          exportPath: '',
        }}
      >
        <Card title="显示设置" style={{ marginBottom: 16 }}>
          <Form.Item label="主题" name="theme">
            <Select
              style={{ width: 200 }}
              onChange={(value) => {
                useThemeStore.getState().setTheme(value);
              }}
            >
              <Select.Option value="light">浅色模式</Select.Option>
              <Select.Option value="dark">深色模式</Select.Option>
              <Select.Option value="system">跟随系统</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="字体大小" name="fontSize">
            <InputNumber min={12} max={24} addonAfter="px" style={{ width: 200 }} />
          </Form.Item>
        </Card>

        <Card title="练习设置" style={{ marginBottom: 16 }}>
          <Form.Item label="自动播放音频" name="autoPlayAudio" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="显示解析" name="showExplanation" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="每日练习目标" name="dailyGoal">
            <InputNumber min={5} max={100} addonAfter="题" style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="错题复习提醒" name="reviewRemind" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="音效" name="soundEffect" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        <Card title="数据管理" style={{ marginBottom: 16 }}>
          <Form.Item label="导出/导入路径" name="exportPath">
            <input type="text" placeholder="选择文件夹路径" style={{ width: '100%' }} />
          </Form.Item>

          <Space>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出数据
            </Button>
            <Button icon={<ImportOutlined />} onClick={handleImport}>
              导入数据
            </Button>
          </Space>

          <Divider />

          <Space>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleClear('studyRecords')}
            >
              清除学习记录
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleClear('wrongQuestions')}
            >
              清除错题记录
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleClear('all')}
            >
              清除所有数据
            </Button>
          </Space>
        </Card>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
          size="large"
        >
          保存设置
        </Button>
      </Form>

      {appInfo && (
        <Card title="应用信息" style={{ marginTop: 16 }}>
          <Descriptions column={2}>
            <Descriptions.Item label="版本">
              <Tag color="blue">{appInfo.version}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Electron">
              <Tag>{appInfo.electronVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Chrome">
              <Tag>{appInfo.chromeVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Node.js">
              <Tag>{appInfo.nodeVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数据库路径" span={2}>
              {appInfo.databasePath}
            </Descriptions.Item>
            <Descriptions.Item label="数据库大小">
              <Tag color="green">{appInfo.dataSize}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}