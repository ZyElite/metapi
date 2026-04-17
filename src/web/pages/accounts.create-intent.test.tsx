import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import ModernSelect from '../components/ModernSelect.js';
import { ToastProvider } from '../components/Toast.js';
import Accounts from './Accounts.js';
import { installAccountsSnapshotCompat } from './testApiCompat.js';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getAccounts: vi.fn(),
    getAccountsSnapshot: vi.fn(),
    getSites: vi.fn(),
    getAccountTokens: vi.fn(),
  },
}));

vi.mock('../api.js', () => ({
  api: apiMock,
}));

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderAccounts(
  initialEntry: string,
  sites: Array<{ id: number; name: string; url?: string; platform: string; status: string }> = [
    { id: 10, name: 'Demo Site', platform: 'new-api', status: 'active' },
  ],
) {
  apiMock.getAccounts.mockResolvedValue([]);
  apiMock.getSites.mockResolvedValue(sites);
  apiMock.getAccountTokens.mockResolvedValue([]);

  let root!: WebTestRenderer;
  await act(async () => {
    root = create(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ToastProvider>
          <Accounts />
        </ToastProvider>
      </MemoryRouter>,
    );
  });
  await flushMicrotasks();
  return root!;
}

describe('Accounts create intent handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installAccountsSnapshotCompat(apiMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the session add modal and preselects the site for session create intent', async () => {
    const root = await renderAccounts('/accounts?create=1&siteId=10');
    try {
      const rendered = JSON.stringify(root.toJSON());
      expect(rendered).toContain('添加 Session 连接');
      expect(rendered).not.toContain('添加 API Key 连接');

      const selects = root.root.findAllByType(ModernSelect);
      expect(selects[1]?.props.value).toBe('10');
    } finally {
      root?.unmount();
    }
  });

  it('opens the apikey add modal and preselects the site for apikey create intent', async () => {
    const root = await renderAccounts('/accounts?segment=apikey&create=1&siteId=10');
    try {
      const rendered = JSON.stringify(root.toJSON());
      expect(rendered).toContain('添加 API Key 连接');

      const selects = root.root.findAllByType(ModernSelect);
      expect(selects[1]?.props.value).toBe('10');
    } finally {
      root?.unmount();
    }
  });

  it('refreshes the snapshot before opening create intent when the requested site is missing from the first payload', async () => {
    const staleSites = [
      { id: 9, name: 'Existing Site', platform: 'new-api', status: 'active' },
    ];
    const freshSites = [
      ...staleSites,
      { id: 12, name: 'Fresh Site', url: 'https://fresh.example.com', platform: 'openai', status: 'active' },
    ];

    apiMock.getAccountsSnapshot.mockReset();
    apiMock.getAccountsSnapshot
      .mockImplementationOnce(async (options?: { refresh?: boolean }) => {
        expect(options).toBeUndefined();
        return {
          generatedAt: '2026-04-09T00:00:00.000Z',
          accounts: [],
          sites: staleSites,
        };
      })
      .mockImplementationOnce(async (options?: { refresh?: boolean }) => {
        expect(options).toEqual({ refresh: true });
        return {
          generatedAt: '2026-04-09T00:00:01.000Z',
          accounts: [],
          sites: freshSites,
        };
      });

    const root = await renderAccounts('/accounts?segment=apikey&create=1&siteId=12', freshSites);
    try {
      await flushMicrotasks();

      const rendered = JSON.stringify(root.toJSON());
      expect(rendered).toContain('添加 API Key 连接');

      const selects = root.root.findAllByType(ModernSelect);
      expect(selects[1]?.props.value).toBe('12');
      expect(selects[1]?.props.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: '12',
            label: 'Fresh Site (openai)',
            description: 'https://fresh.example.com',
          }),
        ]),
      );

      expect(apiMock.getAccountsSnapshot).toHaveBeenCalledTimes(2);
      expect(apiMock.getAccountsSnapshot).toHaveBeenNthCalledWith(1, undefined);
      expect(apiMock.getAccountsSnapshot).toHaveBeenNthCalledWith(2, { refresh: true });
    } finally {
      root?.unmount();
    }
  });

  it('uses searchable site selectors for manual connection creation', async () => {
    const root = await renderAccounts('/accounts', [
      { id: 10, name: 'Demo Site', url: 'https://demo.example.com', platform: 'new-api', status: 'active' },
      { id: 11, name: 'Codex Workspace', url: 'https://workspace.example.com', platform: 'codex', status: 'active' },
    ]);
    try {
      const addButton = root.root.find((node) => (
        node.type === 'button'
        && typeof node.props.onClick === 'function'
        && typeof node.props.className === 'string'
        && node.props.className.includes('btn btn-primary')
      ));

      await act(async () => {
        addButton.props.onClick();
      });
      await flushMicrotasks();

      const selects = root.root.findAllByType(ModernSelect);
      expect(selects[1]?.props.searchable).toBe(true);
      expect(selects[1]?.props.searchPlaceholder).toBe('筛选站点（名称 / 平台 / URL）');
      expect(selects[1]?.props.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: '11',
            label: 'Codex Workspace (codex)',
            description: 'https://workspace.example.com',
          }),
        ]),
      );
    } finally {
      root?.unmount();
    }
  });

  it('ignores create intent in the tokens segment', async () => {
    const root = await renderAccounts('/accounts?segment=tokens&create=1&siteId=10');
    try {
      const rendered = JSON.stringify(root.toJSON());
      expect(rendered).not.toContain('添加 Session 连接');
      expect(rendered).not.toContain('添加 API Key 连接');
    } finally {
      root?.unmount();
    }
  });
});
