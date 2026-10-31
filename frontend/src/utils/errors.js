// Every API error has the shape { message, errors? } (see ErrorHandlingMiddleware.cs).
// These helpers turn an axios error into something a page can show.

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.response) {
    const { status, data } = error.response;
    if (data?.message) return data.message;
    if (status === 403) return 'You do not have permission to do that.';
    if (status === 404) return 'We could not find that record.';
    if (status >= 500) return 'The server had a problem. Please try again shortly.';
    return fallback;
  }
  if (error.request) {
    return 'Cannot reach the RentEase server. Check that the API is running and try again.';
  }
  return error.message || fallback;
}

/**
 * Field-level validation errors from a 400 response, keyed by camelCase field
 * name: { monthlyRent: 'Monthly rent must be…' }.
 */
export function getFieldErrors(error) {
  const errors = error?.response?.data?.errors;
  if (!errors) return {};
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : messages]),
  );
}

export function isNotFound(error) {
  return error?.response?.status === 404;
}
