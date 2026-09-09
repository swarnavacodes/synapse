import {
  ApiErrorSchema,
  type Concept,
  type ConceptDetails,
  type ConceptQARequest,
  type ConceptQAResponse,
  type ConnectRequest,
  type ConnectResponse,
  type ChallengeRequest,
  type ChallengeResponse,
  type CompareRequest,
  type CompareResponse,
  type CreateConceptRequest,
  type CreateRelationshipRequest,
  type ExpandRequest,
  type ExpandResponse,
  type Graph,
  type Relationship,
  type Session,
  type SavePositionsRequest,
  type TrailEvent,
  type WebSearchRequest,
  type WebSearchResponse,
} from "@thinking-explorer/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }
  const parsed = ApiErrorSchema.safeParse(payload);
  if (parsed.success) {
    const rawMessage = parsed.data.error.message;
    const message =
      res.status === 429 || parsed.data.error.code === "llm_upstream_error"
        ? "The AI providers are busy or rate-limited. Try again shortly."
        : rawMessage;
    return new ApiError(
      res.status,
      parsed.data.error.code,
      message,
      parsed.data.error.details
    );
  }
  return new ApiError(res.status, "http_error", `HTTP ${res.status}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listSessions: () => request<Session[]>("/api/sessions"),
  createSession: (title?: string) =>
    request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getGraph: (id: string) => request<Graph>(`/api/sessions/${id}`),
  deleteSession: (id: string) =>
    request<void>(`/api/sessions/${id}`, { method: "DELETE" }),
  savePositions: (sessionId: string, positions: SavePositionsRequest) =>
    request<void>(`/api/sessions/${sessionId}/positions`, {
      method: "PUT",
      body: JSON.stringify(positions),
    }),
  createConcept: (sessionId: string, body: CreateConceptRequest) =>
    request<Concept>(`/api/sessions/${sessionId}/concepts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteConcept: (sessionId: string, conceptId: string) =>
    request<void>(`/api/sessions/${sessionId}/concepts/${conceptId}`, {
      method: "DELETE",
    }),
  getConceptDetails: (sessionId: string, conceptId: string) =>
    request<ConceptDetails>(`/api/sessions/${sessionId}/concepts/${conceptId}/details`),
  askConceptQuestion: (sessionId: string, conceptId: string, body: ConceptQARequest) =>
    request<ConceptQAResponse>(`/api/sessions/${sessionId}/concepts/${conceptId}/qa`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createRelationship: (sessionId: string, body: CreateRelationshipRequest) =>
    request<Relationship>(`/api/sessions/${sessionId}/relationships`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  expand: (sessionId: string, body: ExpandRequest) =>
    request<ExpandResponse>(`/api/sessions/${sessionId}/expand`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  connect: (sessionId: string, body: ConnectRequest) =>
    request<ConnectResponse>(`/api/sessions/${sessionId}/connect`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  challenge: (sessionId: string, body: ChallengeRequest) =>
    request<ChallengeResponse>(`/api/sessions/${sessionId}/challenge`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  compare: (sessionId: string, body: CompareRequest) =>
    request<CompareResponse>(`/api/sessions/${sessionId}/compare`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getTrail: (sessionId: string) =>
    request<{ events: TrailEvent[] }>(`/api/sessions/${sessionId}/trail`),
  search: (sessionId: string, body: WebSearchRequest) =>
    request<WebSearchResponse>(`/api/sessions/${sessionId}/search`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};