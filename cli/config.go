package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

const (
	// Default Supabase project (overridable via config file or env var).
	defaultSupabaseURL = "https://uxaxgrdxikvligkjyyxz.supabase.co"

	envSupabaseURL   = "SOCLI_SUPABASE_URL"
	envSessionToken  = "SOCLI_SESSION_TOKEN"
	envServiceRoleKey = "SOCLI_SERVICE_ROLE_KEY"
)

// Config is persisted to ~/.config/socli/config.json. Both fields can also
// be supplied via the matching env vars, which take precedence.
type Config struct {
	SupabaseURL  string `json:"supabase_url"`
	SessionToken string `json:"session_token"`
}

func configPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "socli", "config.json"), nil
}

func loadConfig() (Config, error) {
	cfg := Config{SupabaseURL: defaultSupabaseURL}
	path, err := configPath()
	if err != nil {
		return cfg, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return cfg, nil
		}
		return cfg, fmt.Errorf("read config: %w", err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse config: %w", err)
	}
	if cfg.SupabaseURL == "" {
		cfg.SupabaseURL = defaultSupabaseURL
	}
	return cfg, nil
}

func saveConfig(cfg Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// resolveConfig merges the saved config with env-var overrides.
func resolveConfig() (Config, error) {
	cfg, err := loadConfig()
	if err != nil {
		return cfg, err
	}
	if v := os.Getenv(envSupabaseURL); v != "" {
		cfg.SupabaseURL = v
	}
	if v := os.Getenv(envSessionToken); v != "" {
		cfg.SessionToken = v
	}
	return cfg, nil
}
