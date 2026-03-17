import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const selectChannelMock = vi.fn();
const selectNextChannelMock = vi.fn();
const recordSuccessMock = vi.fn();
const recordFailureMock = vi.fn();
const refreshModelsAndRebuildRoutesMock = vi.fn();
const reportProxyAllFailedMock = vi.fn();
const reportTokenExpiredMock = vi.fn();
const resolveProxyUsageWithSelfLogFallbackMock = vi.fn(async ({ usage }: any) => ({
  ...usage,
  estimatedCostFromQuota: 0,
  recoveredFromSelfLog: false,
}));
const refreshCodexAccessTokenMock = vi.fn();
const dbInsertMock = vi.fn((_arg?: any) => ({
  values: () => ({
    run: () => undefined,
  }),
}));

vi.mock('undici', () => ({
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('../../services/tokenRouter.js', () => ({
  tokenRouter: {
    selectChannel: (...args: unknown[]) => selectChannelMock(...args),
    selectNextChannel: (...args: unknown[]) => selectNextChannelMock(...args),
    recordSuccess: (...args: unknown[]) => recordSuccessMock(...args),
    recordFailure: (...args: unknown[]) => recordFailureMock(...args),
  },
}));

vi.mock('../../services/modelService.js', () => ({
  refreshModelsAndRebuildRoutes: (...args: unknown[]) => refreshModelsAndRebuildRoutesMock(...args),
}));

vi.mock('../../services/alertService.js', () => ({
  reportProxyAllFailed: (...args: unknown[]) => reportProxyAllFailedMock(...args),
  reportTokenExpired: (...args: unknown[]) => reportTokenExpiredMock(...args),
}));

vi.mock('../../services/alertRules.js', () => ({
  isTokenExpiredError: ({ status }: { status?: number }) => status === 401,
}));

vi.mock('../../services/modelPricingService.js', () => ({
  estimateProxyCost: async () => 0,
  buildProxyBillingDetails: async () => null,
  fetchModelPricingCatalog: async () => null,
}));

vi.mock('../../services/proxyRetryPolicy.js', () => ({
  shouldRetryProxyRequest: () => false,
}));

vi.mock('../../services/proxyUsageFallbackService.js', () => ({
  resolveProxyUsageWithSelfLogFallback: (arg: any) => resolveProxyUsageWithSelfLogFallbackMock(arg),
}));

vi.mock('../../services/oauth/service.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/oauth/service.js')>('../../services/oauth/service.js');
  return {
    ...actual,
    refreshCodexOauthAccessToken: (...args: unknown[]) => refreshCodexAccessTokenMock(...args),
  };
});

vi.mock('../../db/index.js', () => ({
  db: {
    insert: (arg: any) => dbInsertMock(arg),
  },
  hasProxyLogDownstreamApiKeyIdColumn: async () => false,
  schema: {
    proxyLogs: {},
  },
}));

describe('responses proxy codex oauth refresh', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { responsesProxyRoute } = await import('./responses.js');
    app = Fastify();
    await app.register(responsesProxyRoute);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    selectChannelMock.mockReset();
    selectNextChannelMock.mockReset();
    recordSuccessMock.mockReset();
    recordFailureMock.mockReset();
    refreshModelsAndRebuildRoutesMock.mockReset();
    reportProxyAllFailedMock.mockReset();
    reportTokenExpiredMock.mockReset();
    resolveProxyUsageWithSelfLogFallbackMock.mockClear();
    refreshCodexAccessTokenMock.mockReset();
    dbInsertMock.mockClear();

    selectChannelMock.mockReturnValue({
      channel: { id: 11, routeId: 22 },
      site: { name: 'codex-site', url: 'https://chatgpt.com/backend-api/codex', platform: 'codex' },
      account: {
        id: 33,
        username: 'codex-user@example.com',
        extraConfig: JSON.stringify({
          credentialMode: 'session',
          oauth: {
            provider: 'codex',
            accountId: 'chatgpt-account-123',
            email: 'codex-user@example.com',
            planType: 'plus',
          },
        }),
      },
      tokenName: 'default',
      tokenValue: 'expired-access-token',
      actualModel: 'gpt-5.2-codex',
    });
    selectNextChannelMock.mockReturnValue(null);
    refreshCodexAccessTokenMock.mockResolvedValue({
      accessToken: 'fresh-access-token',
      accountId: 33,
      accountKey: 'chatgpt-account-123',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('refreshes codex oauth token and retries the same responses request on 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'expired token', type: 'invalid_request_error' },
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'resp_codex_refreshed',
        object: 'response',
        model: 'gpt-5.2-codex',
        status: 'completed',
        output_text: 'ok after codex token refresh',
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: {
        model: 'gpt-5.2-codex',
        input: 'hello codex',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(refreshCodexAccessTokenMock).toHaveBeenCalledWith(33);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstOptions] = fetchMock.mock.calls[0] as [string, any];
    const [secondUrl, secondOptions] = fetchMock.mock.calls[1] as [string, any];
    expect(firstUrl).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(secondUrl).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(firstOptions.headers.Authorization).toBe('Bearer expired-access-token');
    expect(secondOptions.headers.Authorization).toBe('Bearer fresh-access-token');
    expect(secondOptions.headers.Originator || secondOptions.headers.originator).toBe('codex_cli_rs');
    expect(secondOptions.headers['Chatgpt-Account-Id'] || secondOptions.headers['chatgpt-account-id']).toBe('chatgpt-account-123');
    expect(response.json()?.output_text).toContain('ok after codex token refresh');
  });

  it('sends an explicit empty instructions field to codex responses when downstream body has no system prompt', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: 'resp_codex_no_system',
      object: 'response',
      model: 'gpt-5.2-codex',
      status: 'completed',
      output_text: 'ok without system prompt',
      usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/responses',
      payload: {
        model: 'gpt-5.2-codex',
        input: 'hello codex',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, options] = fetchMock.mock.calls[0] as [string, any];
    const forwardedBody = JSON.parse(options.body);
    expect(forwardedBody.instructions).toBe('');
    expect(forwardedBody.input).toEqual([
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hello codex' }],
      },
    ]);
  });
});
