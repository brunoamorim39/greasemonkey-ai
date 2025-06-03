// API client utility for handling authenticated requests

const API_KEY = process.env.NEXT_PUBLIC_CLIENT_API_KEY

interface ApiOptions extends RequestInit {
  requireAuth?: boolean
}

export async function apiRequest(
  url: string,
  options: ApiOptions = {}
): Promise<Response> {
  const { requireAuth = true, headers = {}, ...fetchOptions } = options

  const requestHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  }

  // Add API key if available and auth is required
  if (requireAuth && API_KEY) {
    requestHeaders['x-api-key'] = API_KEY
  }

  // Add Content-Type for JSON requests
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    requestHeaders['Content-Type'] = 'application/json'
  }

  return fetch(url, {
    ...fetchOptions,
    headers: requestHeaders,
  })
}

export async function apiGet(url: string, requireAuth = true): Promise<Response> {
  return apiRequest(url, { method: 'GET', requireAuth })
}

export async function apiPost(
  url: string,
  data?: unknown,
  requireAuth = true
): Promise<Response> {
  const body = data ? JSON.stringify(data) : undefined
  return apiRequest(url, { method: 'POST', body, requireAuth })
}

export async function apiPut(
  url: string,
  data?: unknown,
  requireAuth = true
): Promise<Response> {
  const body = data ? JSON.stringify(data) : undefined
  return apiRequest(url, { method: 'PUT', body, requireAuth })
}

export async function apiDelete(url: string, requireAuth = true): Promise<Response> {
  return apiRequest(url, { method: 'DELETE', requireAuth })
}

// Specialized function for form data (file uploads)
export async function apiPostFormData(
  url: string,
  formData: FormData,
  requireAuth = true
): Promise<Response> {
  return apiRequest(url, {
    method: 'POST',
    body: formData,
    requireAuth
  })
}
