import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.js';
import OAuthManagement from './OAuthManagement.js';

const { apiMock, openMock, focusMock, confirmMock, promptMock } = vi.hoisted(() => ({
  apiMock: {
    getOAuthProviders: vi.fn(),
    getOAuthConnections: vi.fn(),
    startOAuthProvider: vi.fn(),
    getOAuthSession: vi.fn(),
    rebindOAuthConnection: vi.fn(),
    deleteOAuthConnection: vi.fn(),
  },
  openMock: vi.fn(),
  focusMock: vi.fn(),
  confirmMock: vi.fn(),
  promptMock: vi.fn(),
}));

vi.mock('../api.js', () => ({
  api: apiMock,
}));

function collectText(node: any): string {
  const children = node?.children || [];
  return children.map((child: any) => {
    if (typeof child === 'string') return child;
    return collectText(child);
  }).join('');
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('OAuthManagement page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    openMock.mockReturnValue({ focus: focusMock });
    confirmMock.mockReturnValue(true);
    promptMock.mockReturnValue('project-demo');
    vi.stubGlobal('window', {
      open: openMock,
      confirm: confirmMock,
      prompt: promptMock,
      setTimeout,
      clearTimeout,
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders available oauth providers and existing oauth connections', async () => {
    apiMock.getOAuthProviders.mockResolvedValue({
      providers: [
        {
          provider: 'codex',
          label: 'Codex',
          platform: 'codex',
          enabled: true,
          loginType: 'oauth',
          requiresProjectId: false,
          supportsDirectAccountRouting: true,
          supportsCloudValidation: true,
          supportsNativeProxy: true,
        },
        {
          provider: 'gemini-cli',
          label: 'Gemini CLI',
          platform: 'gemini-cli',
          enabled: true,
          loginType: 'oauth',
          requiresProjectId: true,
          supportsDirectAccountRouting: true,
          supportsCloudValidation: true,
          supportsNativeProxy: true,
        },
      ],
    });
    apiMock.getOAuthConnections.mockResolvedValue({
      items: [
        {
          accountId: 7,
          provider: 'codex',
          email: 'codex-user@example.com',
          planType: 'plus',
          modelCount: 3,
          modelsPreview: ['gpt-5', 'gpt-5-mini', 'gpt-5.2-codex'],
          status: 'healthy',
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    });

    let root: ReturnType<typeof create> | null = null;
    try {
      await act(async () => {
        root = create(
          <ToastProvider>
            <MemoryRouter>
              <OAuthManagement />
            </MemoryRouter>
          </ToastProvider>,
        );
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
        const text = collectText(root!.root);
        expect(text).toContain('OAuth 管理');
        expect(text).toContain('Codex');
        expect(text).toContain('Gemini CLI');
        expect(text).toContain('codex-user@example.com');
        expect(text).toContain('plus');
        expect(text).toContain('3 个模型');
      });
    } finally {
      root?.unmount();
    }
  });

  it('starts oauth, opens popup, polls status, and refreshes connection list after success', async () => {
    apiMock.getOAuthProviders.mockResolvedValue({
      providers: [
        {
          provider: 'codex',
          label: 'Codex',
          platform: 'codex',
          enabled: true,
          loginType: 'oauth',
          requiresProjectId: false,
          supportsDirectAccountRouting: true,
          supportsCloudValidation: true,
          supportsNativeProxy: true,
        },
        {
          provider: 'gemini-cli',
          label: 'Gemini CLI',
          platform: 'gemini-cli',
          enabled: true,
          loginType: 'oauth',
          requiresProjectId: true,
          supportsDirectAccountRouting: true,
          supportsCloudValidation: true,
          supportsNativeProxy: true,
        },
      ],
    });
    apiMock.getOAuthConnections
      .mockResolvedValueOnce({ items: [], total: 0, limit: 100, offset: 0 })
      .mockResolvedValueOnce({
        items: [
          {
            accountId: 7,
            provider: 'codex',
            email: 'codex-user@example.com',
            planType: 'plus',
            modelCount: 3,
            modelsPreview: ['gpt-5', 'gpt-5-mini', 'gpt-5.2-codex'],
            status: 'healthy',
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      });
    apiMock.startOAuthProvider.mockResolvedValue({
      provider: 'codex',
      state: 'oauth-state-123',
      authorizationUrl: 'https://auth.openai.com/oauth/authorize?state=oauth-state-123',
    });
    apiMock.getOAuthSession
      .mockResolvedValueOnce({
        provider: 'codex',
        state: 'oauth-state-123',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        provider: 'codex',
        state: 'oauth-state-123',
        status: 'success',
        accountId: 7,
      });

    let root: ReturnType<typeof create> | null = null;
    try {
      await act(async () => {
        root = create(
          <ToastProvider>
            <MemoryRouter>
              <OAuthManagement />
            </MemoryRouter>
          </ToastProvider>,
        );
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
      });

      const startButton = root!.root.find((node) => (
        node.type === 'button'
        && typeof node.props.onClick === 'function'
        && collectText(node).includes('连接 Codex')
      ));

      await act(async () => {
        await startButton.props.onClick();
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
      });

      expect(apiMock.startOAuthProvider).toHaveBeenCalledWith('codex', { projectId: undefined });
      expect(openMock).toHaveBeenCalledWith(
        'https://auth.openai.com/oauth/authorize?state=oauth-state-123',
        'oauth-codex',
        expect.stringContaining('width=540'),
      );

      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
      });

      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
      });

      expect(apiMock.getOAuthSession).toHaveBeenCalledWith('oauth-state-123');
      expect(apiMock.getOAuthConnections).toHaveBeenCalledTimes(2);
      const text = collectText(root!.root);
      expect(text).toContain('授权成功');
      expect(text).toContain('codex-user@example.com');
    } finally {
      root?.unmount();
    }
  });

  it('shows oauth connection status metadata and allows deleting a connection', async () => {
    apiMock.getOAuthProviders.mockResolvedValue({
      providers: [
        {
          provider: 'codex',
          label: 'Codex',
          platform: 'codex',
          enabled: true,
          loginType: 'oauth',
          requiresProjectId: false,
          supportsDirectAccountRouting: true,
          supportsCloudValidation: true,
          supportsNativeProxy: true,
        },
      ],
    });
    apiMock.getOAuthConnections
      .mockResolvedValueOnce({
        items: [
          {
            accountId: 7,
            provider: 'codex',
            email: 'codex-user@example.com',
            planType: 'team',
            modelCount: 11,
            modelsPreview: ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex'],
            status: 'abnormal',
            routeChannelCount: 1,
            lastModelSyncAt: '2026-03-17T08:00:00.000Z',
            lastModelSyncError: 'Codex 模型获取失败（HTTP 403: forbidden）',
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      })
      .mockResolvedValueOnce({ items: [], total: 0, limit: 100, offset: 0 });
    apiMock.deleteOAuthConnection.mockResolvedValue({ success: true });

    let root: ReturnType<typeof create> | null = null;
    try {
      await act(async () => {
        root = create(
          <ToastProvider>
            <MemoryRouter>
              <OAuthManagement />
            </MemoryRouter>
          </ToastProvider>,
        );
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
        const text = collectText(root!.root);
        expect(text).toContain('异常');
        expect(text).toContain('1 条路由');
        expect(text).toContain('Codex 模型获取失败');
      });

      const deleteButton = root!.root.find((node) => (
        node.type === 'button'
        && typeof node.props.onClick === 'function'
        && collectText(node).includes('删除连接')
      ));

      await act(async () => {
        await deleteButton.props.onClick();
      });
      await vi.waitFor(async () => {
        await flushMicrotasks();
      });

      expect(confirmMock).toHaveBeenCalled();
      expect(apiMock.deleteOAuthConnection).toHaveBeenCalledWith(7);
      expect(apiMock.getOAuthConnections).toHaveBeenCalledTimes(2);
    } finally {
      root?.unmount();
    }
  });
});
