export interface ApiMeta {
  requestId?: string;
  durationMs?: number;
  timestamp?: string;
}

export interface ApiError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  ok: false;
  error: ApiError;
  meta?: ApiMeta;
}

export function success<T>(
  data: T,
  meta?: ApiMeta
): ApiSuccess<T> {
  return {
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function failure(
  code: string,
  message: string,
  meta?: ApiMeta,
  retryable = false
): ApiFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
    },
    ...(meta ? { meta } : {}),
  };
}
