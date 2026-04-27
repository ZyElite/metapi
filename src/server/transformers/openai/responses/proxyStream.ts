import { createProxyStreamLifecycle } from '../../shared/protocolLifecycle.js';
import { type ParsedSseEvent } from '../../shared/normalized.js';
import { completeResponsesStream, createOpenAiResponsesAggregateState, failResponsesStream, serializeConvertedResponsesEvents } from './aggregator.js';
import {
  openAiResponsesStream,
  preserveMeaningfulResponsesTerminalPayload,
  serializeResponsesUpstreamFinalAsStream,
} from './streamBridge.js';
import { config } from '../../../config.js';

type StreamReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(reason?: unknown): Promise<unknown>;
  releaseLock(): void;
};

type ResponseSink = {
  end(): void;
};

type ResponsesProxyStreamResult = {
  status: 'completed' | 'failed';
  errorMessage: string | null;
};

type ResponsesProxyStreamSessionInput = {
  modelName: string;
  successfulUpstreamPath: string;
  strictTerminalEvents?: boolean;
  getUsage: () => {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    promptTokensIncludeCache: boolean | null;
  };
  onParsedPayload?: (payload: unknown) => void;
  writeLines: (lines: string[]) => void;
  writeRaw: (chunk: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasVisibleContentPart(part: unknown): boolean {
  if (!isRecord(part)) return false;
  const partType = asTrimmedString(part.type).toLowerCase();
  if (partType === 'output_text' || partType === 'text') {
    return hasNonEmptyString(part.text);
  }
  return (
    partType.includes('function_call')
    || partType.includes('tool_call')
    || partType.includes('image')
    || partType.includes('audio')
    || partType.includes('file')
  );
}

function hasVisibleResponsesOutputItem(item: unknown): boolean {
  if (!isRecord(item)) return false;
  const itemType = asTrimmedString(item.type).toLowerCase();
  if (itemType === 'message') {
    return Array.isArray(item.content) && item.content.some((part) => hasVisibleContentPart(part));
  }
  if (itemType === 'reasoning') {
    return false;
  }
  return itemType.length > 0;
}

function hasVisibleResponsesPayloadOutput(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (hasNonEmptyString(payload.output_text)) return true;
  return Array.isArray(payload.output) && payload.output.some((item) => hasVisibleResponsesOutputItem(item));
}

function hasVisibleAggregateOutput(state: ReturnType<typeof createOpenAiResponsesAggregateState>): boolean {
  return state.outputItems.some((item) => hasVisibleResponsesOutputItem(item));
}

function shouldFailEmptyResponsesCompletion(input: {
  payload: unknown;
  state: ReturnType<typeof createOpenAiResponsesAggregateState>;
}): boolean {
  if (!config.proxyEmptyContentFailEnabled) return false;
  const responsePayload = isRecord(input.payload) && isRecord(input.payload.response)
    ? input.payload.response
    : null;
  if (hasVisibleAggregateOutput(input.state)) return false;
  if (responsePayload && hasVisibleResponsesPayloadOutput(responsePayload)) return false;
  return true;
}

function getResponsesStreamFailureMessage(payload: unknown, fallback = 'upstream stream failed'): string {
  if (isRecord(payload)) {
    if (isRecord(payload.error) && typeof payload.error.message === 'string' && payload.error.message.trim()) {
      return payload.error.message.trim();
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    if (isRecord(payload.response) && isRecord(payload.response.error) && typeof payload.response.error.message === 'string' && payload.response.error.message.trim()) {
      return payload.response.error.message.trim();
    }
  }
  return fallback;
}

export function createResponsesProxyStreamSession(input: ResponsesProxyStreamSessionInput) {
  const streamContext = openAiResponsesStream.createContext(input.modelName);
  const responsesState = createOpenAiResponsesAggregateState(input.modelName);
  const requiresExplicitTerminalEvent = input.strictTerminalEvents
    || input.successfulUpstreamPath.endsWith('/responses')
    || input.successfulUpstreamPath.endsWith('/responses/compact');
  let finalized = false;
  let terminalEventSeen = false;
  let terminalResult: ResponsesProxyStreamResult = {
    status: 'completed',
    errorMessage: null,
  };
  let forwardedDownstreamOutput = false;
  const pendingLines: string[] = [];

  const flushPendingLines = () => {
    if (pendingLines.length <= 0) return;
    input.writeLines([...pendingLines]);
    pendingLines.length = 0;
  };

  const emitLines = (lines: string[], options?: { meaningful?: boolean; force?: boolean }) => {
    if (lines.length <= 0) return;
    if (forwardedDownstreamOutput) {
      input.writeLines(lines);
      return;
    }
    if (options?.force) {
      pendingLines.length = 0;
      forwardedDownstreamOutput = true;
      input.writeLines(lines);
      return;
    }
    if (options?.meaningful) {
      forwardedDownstreamOutput = true;
      flushPendingLines();
      input.writeLines(lines);
      return;
    }
    pendingLines.push(...lines);
  };

  const finalize = () => {
    if (finalized) return;
    finalized = true;
    terminalResult = {
      status: 'completed',
      errorMessage: null,
    };
    emitLines(
      completeResponsesStream(responsesState, streamContext, input.getUsage()),
      { meaningful: true },
    );
  };

  const fail = (payload: unknown, fallbackMessage?: string) => {
    if (finalized) return;
    finalized = true;
    const errorMessage = getResponsesStreamFailureMessage(payload, fallbackMessage);
    terminalResult = {
      status: 'failed',
      errorMessage,
    };
    const failureLines = failResponsesStream(responsesState, streamContext, input.getUsage(), payload);
    if (forwardedDownstreamOutput || !/empty content/i.test(errorMessage)) {
      input.writeLines(failureLines);
      return;
    }
    pendingLines.length = 0;
  };

  const complete = () => {
    terminalResult = {
      status: 'completed',
      errorMessage: null,
    };
  };

  const closeOut = () => {
    if (finalized) return;
    if (terminalEventSeen) {
      finalize();
      return;
    }
    if (requiresExplicitTerminalEvent) {
      fail({
        type: 'response.failed',
        error: {
          message: 'stream closed before response.completed',
        },
      }, 'stream closed before response.completed');
      return;
    }
    finalize();
  };

  const handleEventBlock = (eventBlock: ParsedSseEvent): boolean => {
    if (eventBlock.data === '[DONE]') {
      closeOut();
      return true;
    }

    let parsedPayload: unknown = null;
    try {
      parsedPayload = JSON.parse(eventBlock.data);
    } catch {
      parsedPayload = null;
    }

    if (isRecord(parsedPayload)) {
      input.onParsedPayload?.(parsedPayload);
    }

    const payloadType = (isRecord(parsedPayload) && typeof parsedPayload.type === 'string')
      ? parsedPayload.type
      : '';
    const isFailureEvent = (
      eventBlock.event === 'error'
      || eventBlock.event === 'response.failed'
      || payloadType === 'error'
      || payloadType === 'response.failed'
    );
    if (isFailureEvent) {
      fail(parsedPayload);
      return true;
    }
    const isIncompleteEvent = eventBlock.event === 'response.incomplete' || payloadType === 'response.incomplete';

    if (isRecord(parsedPayload)) {
      const normalizedEvent = openAiResponsesStream.normalizeEvent(parsedPayload, streamContext, input.modelName);
      let convertedLines = serializeConvertedResponsesEvents({
        state: responsesState,
        streamContext,
        event: normalizedEvent,
        usage: input.getUsage(),
      });
      if (isIncompleteEvent) {
        convertedLines = preserveMeaningfulResponsesTerminalPayload(convertedLines, 'response.incomplete', parsedPayload);
      } else if (eventBlock.event === 'response.completed' || payloadType === 'response.completed') {
        convertedLines = preserveMeaningfulResponsesTerminalPayload(convertedLines, 'response.completed', parsedPayload);
      }
      if (
        (eventBlock.event === 'response.completed' || payloadType === 'response.completed')
        && shouldFailEmptyResponsesCompletion({
          payload: parsedPayload,
          state: responsesState,
        })
      ) {
        fail({
          type: 'response.failed',
          error: {
            message: 'Upstream returned empty content',
          },
        }, 'Upstream returned empty content');
        return true;
      }
      emitLines(convertedLines, {
        meaningful: hasVisibleAggregateOutput(responsesState),
        force: isFailureEvent,
      });
      if (eventBlock.event === 'response.completed' || payloadType === 'response.completed' || isIncompleteEvent) {
        terminalEventSeen = true;
        complete();
      }
      return false;
    }

    const convertedLines = serializeConvertedResponsesEvents({
      state: responsesState,
      streamContext,
      event: { contentDelta: eventBlock.data },
      usage: input.getUsage(),
    });
    emitLines(convertedLines, {
      meaningful: hasVisibleAggregateOutput(responsesState),
    });
    return false;
  };

  return {
    consumeUpstreamFinalPayload(payload: unknown, fallbackText: string, response?: ResponseSink): ResponsesProxyStreamResult {
      if (payload && typeof payload === 'object') {
        input.onParsedPayload?.(payload);
      }

      const payloadType = (isRecord(payload) && typeof payload.type === 'string')
        ? payload.type
        : '';
      if (payloadType === 'error' || payloadType === 'response.failed') {
        fail(payload);
        response?.end();
        return terminalResult;
      }

      const serializedFinal = serializeResponsesUpstreamFinalAsStream({
        payload,
        modelName: input.modelName,
        fallbackText,
        usage: input.getUsage(),
      });
      const { normalizedFinal, streamPayload, isIncompletePayload, lines } = serializedFinal;
      streamContext.id = normalizedFinal.id;
      streamContext.model = normalizedFinal.model;
      streamContext.created = normalizedFinal.created;
      if (!isIncompletePayload && shouldFailEmptyResponsesCompletion({
        payload: { type: 'response.completed', response: streamPayload },
        state: responsesState,
      })) {
        fail({
          type: 'response.failed',
          error: {
            message: 'Upstream returned empty content',
          },
        }, 'Upstream returned empty content');
        response?.end();
        return terminalResult;
      }

      finalized = true;
      terminalResult = {
        status: 'completed',
        errorMessage: null,
      };
      emitLines(lines, {
        meaningful: hasVisibleResponsesPayloadOutput(streamPayload),
      });
      if (!forwardedDownstreamOutput) {
        forwardedDownstreamOutput = true;
        flushPendingLines();
      }
      response?.end();
      return terminalResult;
    },
    async run(reader: StreamReader | null | undefined, response: ResponseSink): Promise<ResponsesProxyStreamResult> {
      const lifecycle = createProxyStreamLifecycle<ParsedSseEvent>({
        reader,
        response,
        pullEvents: (buffer) => openAiResponsesStream.pullSseEvents(buffer),
        handleEvent: handleEventBlock,
        onEof: closeOut,
      });
      await lifecycle.run();
      return terminalResult;
    },
  };
}
