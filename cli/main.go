// socli — admin CLI for the Source of Clarity Supabase project.
//
// Wraps the four edge functions an admin needs to operate the ingest
// pipeline:
//
//   admin-whitelist   → list / add / remove whitelist entries
//   ingest-nostr      → manually trigger a Nostr relay poll
//   ingest-atproto    → manually trigger a Bluesky Jetstream poll
//
// Plus a thin `login` helper that stores an atproto session token in
// ~/.config/socli/config.json.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

func envLookup(key string) string { return os.Getenv(key) }

func main() {
	if len(os.Args) < 2 {
		printUsage(os.Stderr)
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "login":
		run(loginCmd(args))
	case "logout":
		run(logoutCmd())
	case "whoami":
		run(whoamiCmd())
	case "whitelist":
		run(whitelistCmd(args))
	case "ingest":
		run(ingestCmd(args))
	case "help", "-h", "--help":
		printUsage(os.Stdout)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", cmd)
		printUsage(os.Stderr)
		os.Exit(1)
	}
}

func run(err error) {
	if err == nil {
		return
	}
	fmt.Fprintf(os.Stderr, "error: %v\n", err)
	os.Exit(1)
}

func printUsage(w *os.File) {
	fmt.Fprintln(w, `socli — admin CLI for Source of Clarity

Usage:
  socli login [--token <token>] [--supabase-url <url>]
      Store an atproto session token in ~/.config/socli/config.json.
      If --token is omitted, opens the web app in the browser and
      prompts you to paste the token (from localStorage.atproto_session_token).

  socli logout
      Clear the stored session token.

  socli whoami
      Show the currently configured Supabase URL and whether a token is set.

  socli whitelist list
  socli whitelist add    <atproto|nostr> <identifier> [--note "..."]
  socli whitelist remove <atproto|nostr> <identifier>
      Manage ingest_whitelist entries. Requires an admin session.

  socli ingest nostr
  socli ingest atproto
      Manually trigger a single ingestor run. Uses SOCLI_SERVICE_ROLE_KEY
      as the bearer (set in Supabase dashboard → Settings → API).

Environment:
  SOCLI_SUPABASE_URL      overrides the saved Supabase URL
  SOCLI_SESSION_TOKEN     overrides the saved session token
  SOCLI_SERVICE_ROLE_KEY  service_role JWT for ingest-* triggers`)
}

/* ---------------------------------------------------------------------- */
/* login / logout / whoami                                                */
/* ---------------------------------------------------------------------- */

func loginCmd(args []string) error {
	var token, supabaseURL string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--token":
			if i+1 >= len(args) {
				return fmt.Errorf("--token needs a value")
			}
			token = args[i+1]
			i++
		case "--supabase-url":
			if i+1 >= len(args) {
				return fmt.Errorf("--supabase-url needs a value")
			}
			supabaseURL = args[i+1]
			i++
		default:
			return fmt.Errorf("unknown flag: %s", args[i])
		}
	}

	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	if supabaseURL != "" {
		cfg.SupabaseURL = supabaseURL
	}

	if token == "" {
		token, err = promptForToken(cfg.SupabaseURL)
		if err != nil {
			return err
		}
	}
	cfg.SessionToken = strings.TrimSpace(token)
	if cfg.SessionToken == "" {
		return fmt.Errorf("empty token")
	}

	if err := saveConfig(cfg); err != nil {
		return err
	}
	fmt.Printf("saved session token to %s\n", mustConfigPath())
	return nil
}

func logoutCmd() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	cfg.SessionToken = ""
	if err := saveConfig(cfg); err != nil {
		return err
	}
	fmt.Println("session token cleared")
	return nil
}

func whoamiCmd() error {
	cfg, err := resolveConfig()
	if err != nil {
		return err
	}
	fmt.Printf("supabase URL: %s\n", cfg.SupabaseURL)
	if cfg.SessionToken != "" {
		fmt.Printf("session token: %s… (%d chars)\n", cfg.SessionToken[:min(8, len(cfg.SessionToken))], len(cfg.SessionToken))
	} else {
		fmt.Println("session token: (not set)")
	}
	if v := os.Getenv(envServiceRoleKey); v != "" {
		fmt.Printf("service role key: set (%d chars)\n", len(v))
	} else {
		fmt.Printf("service role key: (set %s to enable `socli ingest`)\n", envServiceRoleKey)
	}
	return nil
}

func promptForToken(supabaseURL string) (string, error) {
	// The app doesn't expose a CLI-friendly OAuth path. Simplest flow:
	// have the admin sign in through the web app, open devtools, copy
	// `localStorage.atproto_session_token`, and paste it here.
	appURL := deriveAppURL(supabaseURL)
	fmt.Println("1. Sign in to the app in your browser:")
	fmt.Printf("   %s\n", appURL)
	fmt.Println("2. Open devtools → Application → Local Storage")
	fmt.Println("3. Copy the value of `atproto_session_token`.")
	fmt.Println()
	openBrowser(appURL)
	fmt.Print("Paste the token: ")
	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

// Best-effort guess at the deployed app URL given the Supabase URL.
// Users can override by passing the app URL directly in the prompt.
func deriveAppURL(supabaseURL string) string {
	if strings.Contains(supabaseURL, "uxaxgrdxikvligkjyyxz") {
		return "https://code-love-social.lovable.app"
	}
	return supabaseURL
}

func openBrowser(rawURL string) {
	var cmd string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
	case "windows":
		cmd = "rundll32"
	default:
		cmd = "xdg-open"
	}
	_ = exec.Command(cmd, rawURL).Start()
}

func mustConfigPath() string {
	p, _ := configPath()
	return p
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

/* ---------------------------------------------------------------------- */
/* whitelist                                                              */
/* ---------------------------------------------------------------------- */

func whitelistCmd(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("whitelist: expected list|add|remove")
	}
	cfg, err := resolveConfig()
	if err != nil {
		return err
	}
	c := newClient(cfg)
	sub := args[0]
	rest := args[1:]

	switch sub {
	case "list":
		return whitelistList(c)
	case "add":
		return whitelistAdd(c, rest)
	case "remove", "rm", "delete":
		return whitelistRemove(c, rest)
	default:
		return fmt.Errorf("whitelist: unknown subcommand %q", sub)
	}
}

func whitelistList(c *client) error {
	status, body, err := c.do(adminRequest{
		method: "GET",
		path:   "/functions/v1/admin-whitelist",
		auth:   "session",
	})
	if err != nil {
		return err
	}
	if status >= 400 {
		return fmt.Errorf("list failed (%d): %s", status, string(body))
	}
	var parsed struct {
		Entries []map[string]any `json:"entries"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		fmt.Println(string(body))
		return nil
	}
	if len(parsed.Entries) == 0 {
		fmt.Println("(whitelist is empty)")
		return nil
	}
	fmt.Printf("%-8s  %-64s  %s\n", "TYPE", "IDENTIFIER", "NOTE")
	for _, e := range parsed.Entries {
		fmt.Printf("%-8v  %-64v  %v\n", e["author_type"], e["identifier"], stringOrEmpty(e["note"]))
	}
	return nil
}

func whitelistAdd(c *client, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("whitelist add: expected <atproto|nostr> <identifier> [--note TEXT]")
	}
	authorType := args[0]
	identifier := args[1]
	var note string
	for i := 2; i < len(args); i++ {
		if args[i] == "--note" {
			if i+1 >= len(args) {
				return fmt.Errorf("--note needs a value")
			}
			note = args[i+1]
			i++
		} else {
			return fmt.Errorf("unknown flag: %s", args[i])
		}
	}
	if authorType != "atproto" && authorType != "nostr" {
		return fmt.Errorf("author_type must be 'atproto' or 'nostr'")
	}

	body := map[string]string{
		"author_type": authorType,
		"identifier":  identifier,
	}
	if note != "" {
		body["note"] = note
	}

	status, resp, err := c.do(adminRequest{
		method: "POST",
		path:   "/functions/v1/admin-whitelist",
		body:   body,
		auth:   "session",
	})
	if err != nil {
		return err
	}
	if status >= 400 {
		return fmt.Errorf("add failed (%d): %s", status, string(resp))
	}
	fmt.Printf("added %s %s\n", authorType, identifier)
	return nil
}

func whitelistRemove(c *client, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("whitelist remove: expected <atproto|nostr> <identifier>")
	}
	authorType := args[0]
	identifier := args[1]
	if authorType != "atproto" && authorType != "nostr" {
		return fmt.Errorf("author_type must be 'atproto' or 'nostr'")
	}

	q := map[string][]string{
		"author_type": {authorType},
		"identifier":  {identifier},
	}
	status, resp, err := c.do(adminRequest{
		method: "DELETE",
		path:   "/functions/v1/admin-whitelist",
		query:  q,
		auth:   "session",
	})
	if err != nil {
		return err
	}
	if status >= 400 {
		return fmt.Errorf("remove failed (%d): %s", status, string(resp))
	}
	fmt.Printf("removed %s %s\n", authorType, identifier)
	return nil
}

func stringOrEmpty(v any) string {
	if v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

/* ---------------------------------------------------------------------- */
/* ingest                                                                 */
/* ---------------------------------------------------------------------- */

func ingestCmd(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("ingest: expected nostr|atproto")
	}
	cfg, err := resolveConfig()
	if err != nil {
		return err
	}
	c := newClient(cfg)

	var path string
	switch args[0] {
	case "nostr":
		path = "/functions/v1/ingest-nostr"
	case "atproto":
		path = "/functions/v1/ingest-atproto"
	default:
		return fmt.Errorf("ingest: unknown source %q", args[0])
	}

	status, resp, err := c.do(adminRequest{
		method: "POST",
		path:   path,
		body:   map[string]any{},
		auth:   "service-role",
	})
	if err != nil {
		return err
	}
	if status >= 400 {
		return fmt.Errorf("ingest %s failed (%d): %s", args[0], status, string(resp))
	}
	var pretty map[string]any
	if err := json.Unmarshal(resp, &pretty); err == nil {
		enc, _ := json.MarshalIndent(pretty, "", "  ")
		fmt.Println(string(enc))
		return nil
	}
	fmt.Println(string(resp))
	return nil
}
