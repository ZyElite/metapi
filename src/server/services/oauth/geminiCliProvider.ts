import { fetch } from 'undici';
import { config } from '../../config.js';
import type { OAuthProviderDefinition } from './providers.js';

export const GEMINI_CLI_OAUTH_PROVIDER = 'gemini-cli';
export const GEMINI_CLI_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GEMINI_CLI_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GEMINI_CLI_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';
export const GEMINI_CLI_PROJECTS_URL = 'https://cloudresourcemanager.googleapis.com/v1/projects';
export const GEMINI_CLI_SERVICE_USAGE_URL = 'https://serviceusage.googleapis.com/v1';
export const GEMINI_CLI_CLIENT_ID = config.geminiCliClientId;
export const GEMINI_CLI_CLIENT_SECRET = config.geminiCliClientSecret;
export const GEMINI_CLI_LOOPBACK_CALLBACK_PORT = 8085;
export const GEMINI_CLI_LOOPBACK_CALLBACK_PATH = '/oauth2callback';
export const GEMINI_CLI_LOOPBACK_REDIRECT_URI = `http://localhost:${GEMINI_CLI_LOOPBACK_CALLBACK_PORT}${GEMINI_CLI_LOOPBACK_CALLBACK_PATH}`;
export const GEMINI_CLI_UPSTREAM_BASE_URL = 'https://cloudcode-pa.googleapis.com';
export const GEMINI_CLI_GOOGLE_API_CLIENT = 'google-genai-sdk/1.41.0 gl-node/v22.19.0';
export const GEMINI_CLI_USER_AGENT = 'GeminiCLI/0.31.0/unknown (win32; x64)';
export const GEMINI_CLI_REQUIRED_SERVICE = 'cloudaicompanion.googleapis.com';

function requireGeminiCliOAuthConfig() {
  if (!GEMINI_CLI_CLIENT_ID) {
    throw new Error('GEMINI_CLI_CLIENT_ID is not configured');
  }
  if (!GEMINI_CLI_CLIENT_SECRET) {
    throw new Error('GEMINI_CLI_CLIENT_SECRET is not configured');
  }
  return {
    clientId: GEMINI_CLI_CLIENT_ID,
    clientSecret: GEMINI_CLI_CLIENT_SECRET,
  };
}

const GEMINI_CLI_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

type GeminiOAuthTokenPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  expiry?: unknown;
};

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseExpiresAt(payload: GeminiOAuthTokenPayload): number | undefined {
  if (typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in) && payload.expires_in > 0) {
    return Date.now() + Math.trunc(payload.expires_in) * 1000;
  }
  if (typeof payload.expires_in === 'string') {
    const parsed = Number.parseInt(payload.expires_in.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Date.now() + parsed * 1000;
    }
  }
  if (typeof payload.expiry === 'string') {
    const parsed = Date.parse(payload.expiry);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

async function postGeminiToken(body: URLSearchParams) {
  const response = await fetch(GEMINI_CLI_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `gemini token exchange failed with status ${response.status}`);
  }
  const payload = await response.json() as GeminiOAuthTokenPayload;
  const accessToken = asTrimmedString(payload.access_token);
  if (!accessToken) {
    throw new Error('gemini token exchange response missing access token');
  }
  return {
    accessToken,
    refreshToken: asTrimmedString(payload.refresh_token),
    tokenExpiresAt: parseExpiresAt(payload),
    providerData: {
      tokenType: asTrimmedString(payload.token_type),
      scope: asTrimmedString(payload.scope),
    },
  };
}

async function fetchGeminiUserEmail(accessToken: string): Promise<string | undefined> {
  const response = await fetch(GEMINI_CLI_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return undefined;
  const payload = await response.json() as { email?: unknown };
  return asTrimmedString(payload.email);
}

async function fetchGcpProjects(accessToken: string): Promise<string[]> {
  const response = await fetch(GEMINI_CLI_PROJECTS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `project list request failed with status ${response.status}`);
  }
  const payload = await response.json() as { projects?: Array<{ projectId?: unknown }> };
  return (payload.projects || [])
    .map((project) => asTrimmedString(project.projectId))
    .filter((projectId): projectId is string => !!projectId);
}

async function ensureGeminiProjectEnabled(accessToken: string, projectId: string): Promise<void> {
  const response = await fetch(
    `${GEMINI_CLI_SERVICE_USAGE_URL}/projects/${encodeURIComponent(projectId)}/services/${encodeURIComponent(GEMINI_CLI_REQUIRED_SERVICE)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `service usage lookup failed with status ${response.status}`);
  }
  const payload = await response.json() as { state?: unknown };
  const state = asTrimmedString(payload.state);
  if ((state || '').toUpperCase() !== 'ENABLED') {
    throw new Error(`Cloud AI API not enabled for project ${projectId}`);
  }
}

async function resolveGeminiProjectId(accessToken: string, requestedProjectId?: string): Promise<string> {
  const explicitProject = asTrimmedString(requestedProjectId);
  if (explicitProject) {
    await ensureGeminiProjectEnabled(accessToken, explicitProject);
    return explicitProject;
  }

  const projects = await fetchGcpProjects(accessToken);
  if (projects.length === 1 && projects[0]) {
    await ensureGeminiProjectEnabled(accessToken, projects[0]);
    return projects[0];
  }

  if (projects.length <= 0) {
    throw new Error('no Google Cloud projects available for this account');
  }

  throw new Error('gemini cli: project selection required');
}

export const geminiCliOauthProvider: OAuthProviderDefinition = {
  metadata: {
    provider: GEMINI_CLI_OAUTH_PROVIDER,
    label: 'Gemini CLI',
    platform: 'gemini-cli',
    enabled: true,
    loginType: 'oauth',
    requiresProjectId: true,
    supportsDirectAccountRouting: true,
    supportsCloudValidation: true,
    supportsNativeProxy: true,
  },
  site: {
    name: 'Google Gemini CLI OAuth',
    url: GEMINI_CLI_UPSTREAM_BASE_URL,
    platform: 'gemini-cli',
  },
  loopback: {
    host: '127.0.0.1',
    port: GEMINI_CLI_LOOPBACK_CALLBACK_PORT,
    path: GEMINI_CLI_LOOPBACK_CALLBACK_PATH,
    redirectUri: GEMINI_CLI_LOOPBACK_REDIRECT_URI,
  },
  buildAuthorizationUrl: async ({ state, redirectUri }) => {
    const oauthConfig = requireGeminiCliOAuthConfig();
    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: GEMINI_CLI_SCOPES.join(' '),
      state,
    });
    return `${GEMINI_CLI_AUTH_URL}?${params.toString()}`;
  },
  exchangeAuthorizationCode: async ({ code, redirectUri, projectId }) => {
    const oauthConfig = requireGeminiCliOAuthConfig();
    const token = await postGeminiToken(new URLSearchParams({
      code,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }));
    const resolvedProjectId = await resolveGeminiProjectId(token.accessToken, projectId);
    const email = await fetchGeminiUserEmail(token.accessToken);
    return {
      ...token,
      email,
      accountKey: email,
      accountId: email,
      projectId: resolvedProjectId,
    };
  },
  refreshAccessToken: async ({ refreshToken, oauth }) => {
    const oauthConfig = requireGeminiCliOAuthConfig();
    const token = await postGeminiToken(new URLSearchParams({
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }));
    if (oauth?.projectId) {
      await ensureGeminiProjectEnabled(token.accessToken, oauth.projectId);
    }
    const email = await fetchGeminiUserEmail(token.accessToken);
    return {
      ...token,
      email,
      accountKey: email,
      accountId: email,
      projectId: oauth?.projectId,
    };
  },
  buildProxyHeaders: () => ({
    'User-Agent': GEMINI_CLI_USER_AGENT,
    'X-Goog-Api-Client': GEMINI_CLI_GOOGLE_API_CLIENT,
  }),
};
