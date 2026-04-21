package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// client wraps the two auth modes the admin uses:
//   - `session`: an atproto session token from `atproto_sessions`. Required
//     by admin-whitelist. Obtained by signing in through the web app and
//     copying `localStorage.atproto_session_token` from devtools.
//   - `serviceRoleKey`: the project's service_role JWT. Required if you
//     want to trigger the two ingestors manually (they're otherwise only
//     called by pg_cron). Get from Supabase dashboard → Settings → API.
type client struct {
	baseURL       string
	sessionToken  string
	serviceRoleKey string
	http          *http.Client
}

func newClient(cfg Config) *client {
	return &client{
		baseURL:        strings.TrimRight(cfg.SupabaseURL, "/"),
		sessionToken:   cfg.SessionToken,
		serviceRoleKey: firstNonEmpty(getEnv(envServiceRoleKey)),
		http:           &http.Client{Timeout: 60 * time.Second},
	}
}

type adminRequest struct {
	method string
	path   string
	query  url.Values
	body   any
	// auth:
	//   "session"     → Authorization: Bearer <session token>   (required for admin-whitelist)
	//   "service-role" → Authorization: Bearer <service_role>    (ingest-nostr, ingest-atproto)
	//   "none"        → no Authorization header
	auth string
}

func (c *client) do(req adminRequest) (int, []byte, error) {
	if c.baseURL == "" {
		return 0, nil, fmt.Errorf("supabase URL not configured")
	}
	u, err := url.Parse(c.baseURL + req.path)
	if err != nil {
		return 0, nil, err
	}
	if req.query != nil {
		u.RawQuery = req.query.Encode()
	}

	var body io.Reader
	if req.body != nil {
		b, err := json.Marshal(req.body)
		if err != nil {
			return 0, nil, err
		}
		body = bytes.NewReader(b)
	}

	httpReq, err := http.NewRequest(req.method, u.String(), body)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		httpReq.Header.Set("Content-Type", "application/json")
	}

	switch req.auth {
	case "session":
		if c.sessionToken == "" {
			return 0, nil, fmt.Errorf("no session token — run `socli login` first")
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.sessionToken)
	case "service-role":
		if c.serviceRoleKey == "" {
			return 0, nil, fmt.Errorf("no service role key — set %s env var", envServiceRoleKey)
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	case "none", "":
		// no auth header
	default:
		return 0, nil, fmt.Errorf("unknown auth mode: %s", req.auth)
	}

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	return resp.StatusCode, respBody, err
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func getEnv(key string) string {
	return strings.TrimSpace(envLookup(key))
}
