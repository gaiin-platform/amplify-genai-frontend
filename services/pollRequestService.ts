/**
 * Dynamic Polling Request Service
 *
 * Integrates with your existing doRequestOp infrastructure to provide polling
 * support for long-running backend operations that exceed API Gateway timeout limits.
 *
 * Works with ANY @validated function that has support_polling=True in the backend.
 *
 * Features:
 * - Seamless integration with doRequestOp
 * - Adaptive polling with exponential backoff
 * - Real-time progress callbacks
 * - Automatic retry on transient failures
 * - Cancellation support via AbortController
 * - TypeScript type safety with generics
 * - Memory-safe with automatic cleanup
 * - Concurrent poll tracking
 *
 * @example
 * ```typescript
 * // Instead of:
 * const result = await doRequestOp({
 *   method: 'POST',
 *   path: '/assistant',
 *   op: '/create',
 *   data: { name: 'My Assistant' },
 *   service: 'assistant'
 * });
 *
 * // Use:
 * const result = await doRequestOpWithPolling({
 *   method: 'POST',
 *   path: '/assistant',
 *   op: '/create',
 *   data: { name: 'My Assistant' },
 *   service: 'assistant',
 *   onProgress: (status) => console.log(status.lastLog)
 * });
 * ```
 */

import React from 'react';
import { doRequestOp } from './doRequestOp';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Status of a polling operation as returned by the backend
 */
export enum PollStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Log level from backend logger
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Poll status response from GET /utilities/poll-status
 */
export interface PollStatusResponse {
  requestId: string;
  operation: string;
  status: PollStatus;
  lastLog: string;
  lastLogLevel: LogLevel;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: {
    success: boolean;
    data: any;
  };
  error?: string;
}

/**
 * Extended opData for polling operations
 */
export interface PollOpData {
  method: string;
  path: string;
  op: string;
  data?: any;
  queryParams?: { [key: string]: string };
  service?: string;
  url?: string;

  // Polling-specific options
  onProgress?: (status: PollStatusResponse) => void;
  initialInterval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
  maxDuration?: number;
  maxRetries?: number;
  statusService?: string;
  abortController?: AbortController;
}

/**
 * Result of a successful poll request
 */
export interface PollRequestResult<TResponse = any> {
  success: true;
  data: TResponse;
  duration: number;
  pollCount: number;
}

/**
 * Error from a failed poll request
 */
export interface PollRequestError {
  success: false;
  error: string;
  message?: string;
  status?: PollStatus;
  duration: number;
  pollCount: number;
  lastLog?: string;
}

/**
 * Internal state for tracking active polls
 */
interface ActivePoll {
  pollRequestId: string;
  startTime: number;
  pollCount: number;
  intervalId?: NodeJS.Timeout;
  abortController?: AbortController;
}

// ============================================================================
// ACTIVE POLLS REGISTRY
// ============================================================================

const activePolls = new Map<string, ActivePoll>();

/**
 * Generate a unique poll request ID
 * Format: timestamp-random (matches backend expectations)
 */
function generatePollRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Clean up an active poll
 */
function cleanupPoll(pollRequestId: string): void {
  const poll = activePolls.get(pollRequestId);
  if (poll) {
    if (poll.intervalId) {
      clearInterval(poll.intervalId);
    }
    activePolls.delete(pollRequestId);
  }
}

/**
 * Get all active poll IDs (useful for debugging)
 */
export function getActivePolls(): string[] {
  return Array.from(activePolls.keys());
}

/**
 * Cancel a specific poll by ID
 */
export function cancelPoll(pollRequestId: string): boolean {
  const poll = activePolls.get(pollRequestId);
  if (poll) {
    if (poll.abortController) {
      poll.abortController.abort();
    }
    cleanupPoll(pollRequestId);
    return true;
  }
  return false;
}

/**
 * Cancel all active polls (useful for cleanup on unmount)
 */
export function cancelAllPolls(): void {
  activePolls.forEach((poll) => {
    if (poll.abortController) {
      poll.abortController.abort();
    }
    if (poll.intervalId) {
      clearInterval(poll.intervalId);
    }
  });
  activePolls.clear();
}

// ============================================================================
// CORE POLLING LOGIC
// ============================================================================

/**
 * Check poll status from the backend using doRequestOp
 */
async function checkPollStatus(
  pollRequestId: string,
  statusService?: string
): Promise<PollStatusResponse> {
  const result = await doRequestOp({
    method: 'GET',
    path: '/utilities',
    op: '/poll-status',
    queryParams: { requestId: pollRequestId },
    service: statusService || 'lambda', // Poll status endpoint is in amplify-lambda
  });

  if (!result.success) {
    throw new Error(result.message || 'Failed to check poll status');
  }

  return result.data;
}

/**
 * Calculate next polling interval with exponential backoff
 */
function calculateNextInterval(
  currentInterval: number,
  backoffMultiplier: number,
  maxInterval: number
): number {
  const nextInterval = currentInterval * backoffMultiplier;
  return Math.min(nextInterval, maxInterval);
}

/**
 * Main polling function - makes the initial request and polls for completion
 * This is the core function that integrates with your doRequestOp pattern
 */
export async function doRequestOpWithPolling<TResponse = any>(
  opData: PollOpData
): Promise<PollRequestResult<TResponse> | PollRequestError> {
  // Apply defaults
  const {
    method,
    path,
    op,
    data,
    queryParams,
    service,
    url,
    onProgress,
    initialInterval = 1000,
    maxInterval = 5000,
    backoffMultiplier = 1.5,
    maxDuration = 900000, // 15 minutes
    maxRetries = 3,
    statusService,
    abortController,
  } = opData;

  // Generate unique poll request ID
  const pollRequestId = generatePollRequestId();
  const startTime = Date.now();

  // Register active poll
  const activePoll: ActivePoll = {
    pollRequestId,
    startTime,
    pollCount: 0,
    abortController,
  };
  activePolls.set(pollRequestId, activePoll);

  try {
    console.log(`[PollRequest] Starting polling operation: ${pollRequestId}`);
    console.log(`[PollRequest] Endpoint: ${method} ${path}${op}`);

    // Make initial request with pollRequestId
    // The backend @validated decorator expects pollRequestId at the BODY level,
    // same level as "data", NOT inside data.
    //
    // doRequestOp sends: { data: opData }
    // Backend receives and extracts: body.get("pollRequestId") and body.get("data")
    //
    // So we need to inject pollRequestId into the opData that gets wrapped
    const requestOpData: any = {
      method,
      path,
      op,
      data,
      queryParams,
      service,
      url,
    };

    // Add pollRequestId at the root level (same level as data, method, path, etc.)
    // When doRequestOp wraps this as { data: opData }, the backend will see:
    // { data: { method, path, op, data: {...}, pollRequestId: "..." } }
    // Then the backend's /api/requestOp extracts and forwards it properly
    (requestOpData as any).pollRequestId = pollRequestId;

    const initialResult = await doRequestOp(requestOpData, abortController?.signal as any);

    // If initial request fails, abort
    if (!initialResult.success) {
      throw new Error(initialResult.message || 'Initial request failed');
    }

    // Now poll for completion
    return await new Promise<PollRequestResult<TResponse> | PollRequestError>(
      (resolve) => {
        let currentInterval = initialInterval;
        let consecutiveErrors = 0;

        const poll = async () => {
          // Check if we've exceeded max duration
          const elapsed = Date.now() - startTime;
          if (elapsed > maxDuration) {
            cleanupPoll(pollRequestId);
            resolve({
              success: false,
              error: `Operation timed out after ${Math.round(maxDuration / 1000)}s`,
              duration: elapsed,
              pollCount: activePoll.pollCount,
            });
            return;
          }

          // Check if cancelled
          if (abortController?.signal.aborted) {
            cleanupPoll(pollRequestId);
            resolve({
              success: false,
              error: 'Operation cancelled by user',
              duration: elapsed,
              pollCount: activePoll.pollCount,
            });
            return;
          }

          // Increment poll count
          activePoll.pollCount++;

          try {
            // Check status
            const status = await checkPollStatus(pollRequestId, statusService);

            // Reset consecutive errors on success
            consecutiveErrors = 0;

            // Notify progress callback
            if (onProgress) {
              try {
                onProgress(status);
              } catch (progressError) {
                console.error('[PollRequest] Progress callback error:', progressError);
              }
            }

            console.log(
              `[PollRequest] Poll #${activePoll.pollCount}: ${status.status} - ${status.lastLog}`
            );

            // Check if completed
            if (status.status === PollStatus.COMPLETED) {
              cleanupPoll(pollRequestId);
              resolve({
                success: true,
                data: status.result?.data,
                duration: elapsed,
                pollCount: activePoll.pollCount,
              });
              return;
            }

            // Check if failed
            if (status.status === PollStatus.FAILED) {
              cleanupPoll(pollRequestId);
              resolve({
                success: false,
                error: status.error || 'Operation failed',
                message: status.error || 'Operation failed',
                status: status.status,
                duration: elapsed,
                pollCount: activePoll.pollCount,
                lastLog: status.lastLog,
              });
              return;
            }

            // Still processing - continue polling with backoff
            currentInterval = calculateNextInterval(
              currentInterval,
              backoffMultiplier,
              maxInterval
            );
          } catch (error: any) {
            consecutiveErrors++;

            console.warn(
              `[PollRequest] Status check error (${consecutiveErrors}/${maxRetries}):`,
              error.message
            );

            // If we've exceeded max retries, fail
            if (consecutiveErrors >= maxRetries) {
              cleanupPoll(pollRequestId);
              resolve({
                success: false,
                error: `Failed to check status after ${maxRetries} retries: ${error.message}`,
                message: `Failed to check status after ${maxRetries} retries: ${error.message}`,
                duration: Date.now() - startTime,
                pollCount: activePoll.pollCount,
              });
              return;
            }

            // Otherwise, retry on next interval
          }

          // Schedule next poll
          activePoll.intervalId = setTimeout(poll, currentInterval);
        };

        // Start polling
        activePoll.intervalId = setTimeout(poll, initialInterval);
      }
    );
  } catch (error: any) {
    cleanupPoll(pollRequestId);

    // Handle cancellation
    if (error.name === 'AbortError' || abortController?.signal.aborted) {
      return {
        success: false,
        error: 'Operation cancelled',
        message: 'Operation cancelled',
        duration: Date.now() - startTime,
        pollCount: activePoll.pollCount,
      };
    }

    // Handle other errors
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: error.message || 'Unknown error',
      duration: Date.now() - startTime,
      pollCount: activePoll.pollCount,
    };
  }
}

// ============================================================================
// REACT HOOK (OPTIONAL)
// ============================================================================

/**
 * React hook for managing poll requests with state
 */
export function usePollRequest<TResponse = any>() {
  const [isPolling, setIsPolling] = React.useState(false);
  const [progress, setProgress] = React.useState<PollStatusResponse | null>(null);
  const [result, setResult] = React.useState<PollRequestResult<TResponse> | null>(null);
  const [error, setError] = React.useState<PollRequestError | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const execute = React.useCallback(
    async (opData: Omit<PollOpData, 'onProgress' | 'abortController'>) => {
      // Reset state
      setIsPolling(true);
      setProgress(null);
      setResult(null);
      setError(null);

      // Create abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Execute poll request
      const outcome = await doRequestOpWithPolling<TResponse>({
        ...opData,
        onProgress: setProgress,
        abortController: controller,
      });

      // Update state based on outcome
      if (outcome.success) {
        setResult(outcome);
      } else {
        setError(outcome);
      }

      setIsPolling(false);
    },
    []
  );

  const cancel = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    isPolling,
    progress,
    result,
    error,
    execute,
    cancel,
  };
}

// Export everything
export default {
  doRequestOpWithPolling,
  usePollRequest,
  getActivePolls,
  cancelPoll,
  cancelAllPolls,
  PollStatus,
  LogLevel,
};
