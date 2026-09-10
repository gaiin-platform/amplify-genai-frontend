import { transformPayload } from "@/utils/app/data";

interface opData {
    // env base api url is used if not provided
    url?: string; // used for running localhost or sending request to another url
    method: string,
    path: string;
    op: string;
    data?: any;
    queryParams?: queryParams;
    service?: string // pass in .env.local file as "LOCAL_SERVICES" to run entire service locally
    enablePolling?: boolean; // Enable polling for long-running operations
    onProgress?: (status: any) => void; // Progress callback for polling
    pollingConfig?: {
        initialInterval?: number;
        maxInterval?: number;
        backoffMultiplier?: number;
        maxDuration?: number;
        statusService?: string;
    };
}

interface queryParams {
    [key: string]: string;
}

export const doRequestOp = async (opData: opData, abortSignal: AbortSignal | null = null) => {
    const request = `${opData.method} - ${opData.path + opData.op}`;

    // Obfuscate data and query params (do this for BOTH normal and polling requests)
    if (opData.data) opData.data = transformPayload.encode(opData.data);
    if (opData.queryParams) Object.entries(opData.queryParams).map(([k, v]) => {
        if (opData.queryParams) opData.queryParams[k] = transformPayload.encode(v)
    });

    // If polling is enabled, handle it inline (no delegation to avoid re-processing)
    if (opData.enablePolling) {
        // Generate unique poll request ID
        const pollRequestId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Make initial request (uses local URL if configured above, with obfuscation already done)
        console.log(`[Polling] Starting long-running operation with pollRequestId: ${pollRequestId}`);

        try {
            // Add pollRequestId at TOP level (same level as "data"), NOT inside opData
            const response = await fetch('/api/requestOp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: abortSignal,
                body: JSON.stringify({
                    data: opData,
                    pollRequestId: pollRequestId  // Top level, not in opData!
                }),
            });

            // If request failed (500, etc), backend might have still created polling record
            // So we should start polling instead of giving up immediately
            if (!response.ok) {
                console.log(`[Polling] Initial request failed with ${response.status}, but polling record may exist - starting polling`);
                // Don't return error here - fall through to polling logic below
            } else {
                // Try to parse response
                try {
                    const encodedResult = await response.json();
                    const initialResult = transformPayload.decode(encodedResult.data);

                    // Check if we got a COMPLETE response (with success field)
                    if (initialResult.hasOwnProperty('success')) {
                        // Got immediate result (success=true or success=false)
                        console.log(`[Polling] Operation completed immediately with success=${initialResult.success}`);
                        return initialResult;
                    }
                } catch (e) {
                    console.log(`[Polling] Failed to parse initial response, will start polling`);
                }
            }

            // No success field OR request failed - Lambda probably timed out or errored, start polling!
            console.log(`[Polling] Starting status polling for requestId: ${pollRequestId}`);

            // Now poll for completion using the DEPLOYED backend (never localhost for status checks!)
            const startTime = Date.now();
            const maxDuration = opData.pollingConfig?.maxDuration || 480000; // 8 min polling max (after 3 min API Gateway timeout)
            let currentInterval = opData.pollingConfig?.initialInterval || 1000;
            const maxInterval = opData.pollingConfig?.maxInterval || 5000;
            const backoffMultiplier = opData.pollingConfig?.backoffMultiplier || 1.5;

            // Error retry limit - stop polling after 3 consecutive errors
            let consecutiveErrors = 0;
            const MAX_CONSECUTIVE_ERRORS = 3;

            return await new Promise((resolve) => {
                const poll = async () => {
                    // Check timeout
                    const elapsed = Date.now() - startTime;
                    if (elapsed > maxDuration) {
                        resolve({ success: false, message: `Operation timed out after ${Math.round(maxDuration / 1000)}s` });
                        return;
                    }

                    // Check cancellation
                    if (abortSignal?.aborted) {
                        resolve({ success: false, message: 'Operation cancelled by user' });
                        return;
                    }

                    try {
                        // Check poll status (ALWAYS uses deployed backend, never localhost!)
                        let statusResult = await doRequestOp({
                            method: 'GET',
                            path: '/poll',
                            op: '/status',
                            queryParams: { requestId: pollRequestId },
                            service: 'lambda', // Force deployed backend for status checks
                        });

                        // Handle Lambda {statusCode, body} format from poll endpoint
                        if (statusResult.body && typeof statusResult.body === 'string') {
                            statusResult = JSON.parse(statusResult.body);
                        }

                        if (!statusResult.success) {
                            console.error(`[Polling] Status check failed:`, statusResult);
                            throw new Error(statusResult.message || 'Failed to check status');
                        }

                        // Reset error counter on successful poll
                        consecutiveErrors = 0;

                        const status = statusResult.data;

                        // Check if completed
                        if (status.status === 'completed') {
                            console.log(`[Polling] Operation completed successfully`);
                            // Note: Backend automatically deletes the record after returning it
                            resolve({
                                success: true,
                                data: status.result?.data,
                                message: status.lastLog
                            });
                            return;
                        }

                        // Check if failed
                        if (status.status === 'failed') {
                            console.log(`[Polling] Operation failed:`, status.error);
                            resolve({
                                success: false,
                                message: status.error || 'Operation failed',
                            });
                            return;
                        }

                        // Still in progress, continue polling with backoff
                        currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);
                        setTimeout(poll, currentInterval);

                    } catch (error) {
                        consecutiveErrors++;
                        console.error(`[Polling] Error checking status (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);

                        // Stop polling after too many consecutive errors
                        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                            console.error(`[Polling] Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
                            resolve({
                                success: false,
                                message: `Polling failed after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${error}`
                            });
                            return;
                        }

                        // Retry after interval
                        setTimeout(poll, currentInterval);
                    }
                };

                // Start polling after initial interval
                setTimeout(poll, currentInterval);
            });

        } catch (error) {
            console.log(`Network Error calling ${request}: ${error}.`);
            return { success: false, message: `Network Error calling ${request}: ${error}.` };
        }
    }

    // Normal (non-polling) request
    try {
        const response = await fetch('/api/requestOp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: abortSignal,
            body: JSON.stringify({ data: opData }),
        });

        if (response.ok) {
            try {
                const encodedResult = await response.json();
                // Decode response
                return transformPayload.decode(encodedResult.data);
            } catch (e) {
                return { success: false, message: `Error parsing response from ${request}.` };
            }
        } else {
            console.log(`Error calling.\n ${request}: ${response.statusText}.`);
            return { success: false, message: `Error calling ${request}: ${response.statusText}.` }
        }
    } catch (error) {
        console.log(`Network Error calling ${request}: ${error}.`);
        return { success: false, message: `Network Error calling ${request}: ${error}.` }
    }
}

