use std::process::{Command, Stdio};

const SYSTEM_PROMPT: &str = "You are an AI assistant integrated into ENVEIL, a secure desktop .env vault manager. Answer questions about ENVEIL, environment variables, DevOps secrets management, and related topics. For simple acknowledgments or test prompts, respond naturally.";

const TEMPLATE_PROMPT: &str = "You generate .env templates. Given a project description, return ONLY a raw JSON array of objects with these exact fields: key (uppercase env var name), value (sensible default or placeholder), description (short explanation). Example: [{\"key\":\"PORT\",\"value\":\"3000\",\"description\":\"Server port\"}]. Do NOT include markdown, code fences, or any text outside the JSON array.";

#[derive(serde::Serialize)]
pub struct AIConfig {
    pub configured: bool,
}

fn env_var(key: &str) -> Option<String> {
    std::env::var(key).ok()
}

fn prepare_request(system_prompt: &str, user_content: &str, model: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "max_tokens": 4096,
    });
    serde_json::to_string(&body).map_err(|e| format!("Failed to serialize request: {}", e))
}

#[cfg(target_os = "macos")]
fn call_curl(body_str: &str) -> Result<String, String> {
    let api_key =
        env_var("OPENROUTER_API_KEY").ok_or_else(|| "OPENROUTER_API_KEY env var not set".to_string())?;
    let base_url =
        env_var("OPENROUTER_BASE_URL").ok_or_else(|| "OPENROUTER_BASE_URL env var not set".to_string())?;

    let output = Command::new("curl")
        .args([
            "-s",
            "-w",
            "\n%{http_code}",
            "-X",
            "POST",
            &base_url,
            "-H",
            "Content-Type: application/json",
            "-H",
            &format!("Authorization: Bearer {}", api_key),
            "-H",
            "X-Title: enveil",
            "-d",
            &body_str,
            "--max-time",
            "60",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run curl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl failed ({}): {}", output.status.code().unwrap_or(-1), stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stdout = stdout.trim();

    let last_newline = stdout.rfind('\n');
    let (body_text, status_str) = match last_newline {
        Some(pos) => (stdout[..pos].trim(), stdout[pos + 1..].trim()),
        None => return Err("Empty response from API".to_string()),
    };

    let status: u16 = status_str
        .parse()
        .map_err(|_| format!("Invalid HTTP status: {}", status_str))?;

    if status != 200 {
        return Err(format!("API error ({}): {}", status, body_text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(body_text).map_err(|e| format!("Failed to parse response: {}", e))?;

    parsed["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "AI returned empty response".to_string())
}

#[cfg(not(target_os = "macos"))]
fn call_curl(_body_str: &str) -> Result<String, String> {
    Err("AI calls are only supported on macOS currently".to_string())
}

#[tauri::command]
pub fn get_ai_config() -> AIConfig {
    AIConfig {
        configured: env_var("OPENROUTER_API_KEY").is_some()
            && env_var("OPENROUTER_MODEL").is_some()
            && env_var("OPENROUTER_BASE_URL").is_some(),
    }
}

#[tauri::command]
pub fn call_ai(prompt: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(SYSTEM_PROMPT, &prompt, &model)?;
    call_curl(&body_str)
}

#[tauri::command]
pub fn generate_env_template(description: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(TEMPLATE_PROMPT, &description, &model)?;
    call_curl(&body_str)
}

const VALIDATE_PROMPT: &str = "You validate .env values for security and correctness. Given a JSON object of env vars, analyze each value and return ONLY a raw JSON array of issues. Each issue has: key (the env var name), issue (description of the problem), severity (\"error\" or \"warning\"). Check for: placeholder passwords, hardcoded secrets, default development values, invalid URLs, credentials that should not be committed, and values that don't match the expected format. Example: [{\"key\":\"DB_PASSWORD\",\"issue\":\"Placeholder password - change before production\",\"severity\":\"error\"}]. Do NOT include markdown, code fences, or any text outside the JSON array.";

#[tauri::command]
pub fn validate_env_vars(env_vars_json: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(VALIDATE_PROMPT, &env_vars_json, &model)?;
    call_curl(&body_str)
}

const DOCSTRING_PROMPT: &str = "You explain environment variables. Given a JSON object of env vars, return ONLY a raw JSON object where each key is an env var name and the value is a short plain-text description (max 100 chars) of what that variable does. Assume common frameworks and conventions. Example: {\"PORT\":\"TCP port the web server listens on\",\"DATABASE_URL\":\"PostgreSQL connection string\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn generate_env_docstrings(env_vars_json: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(DOCSTRING_PROMPT, &env_vars_json, &model)?;
    call_curl(&body_str)
}

const DIFF_PROMPT: &str = "You summarize changes to a .env file. Given a JSON object describing changes between two versions, return a short paragraph in plain text explaining the changes. Focus on patterns and implications. Example: 'Added DATABASE_URL and REDIS_URL for the new production infrastructure, removed DEV_API_KEY as part of the security cleanup, and rotated the JWT_SECRET.' Do NOT include markdown, code fences, labels, or prefixes. Just the paragraph.";

#[tauri::command]
pub fn explain_diff(diff_json: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(DIFF_PROMPT, &diff_json, &model)?;
    call_curl(&body_str)
}

const SUGGEST_PROJECT_PROMPT: &str = "You suggest project names and descriptions for ENVEIL, a .env vault manager. Given a rough project description from the user, return ONLY a raw JSON object with two fields: name (a short kebab-case or title-case name, max 40 chars) and description (a one-sentence description, max 120 chars). Example: {\"name\":\"Next.js Blog\",\"description\":\"A Next.js blog application with Prisma ORM and NextAuth authentication\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn suggest_project(description: String, model: String) -> Result<String, String> {
    let body_str = prepare_request(SUGGEST_PROJECT_PROMPT, &description, &model)?;
    call_curl(&body_str)
}

const SUGGEST_ENV_VAR_PROMPT: &str = "You suggest environment variable names and values. Given a user's description of what they need and a JSON array of existing env var keys, return ONLY a raw JSON object with two fields: key (uppercase snake_case name matching convention of existing keys) and value (a sensible default or placeholder). Example: {\"key\":\"DATABASE_URL\",\"value\":\"postgresql://user:password@localhost:5432/mydb\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn suggest_env_var(prompt: String, existing_keys: String, model: String) -> Result<String, String> {
    let user_content = format!("User request: {}\n\nExisting keys: {}", prompt, existing_keys);
    let body_str = prepare_request(SUGGEST_ENV_VAR_PROMPT, &user_content, &model)?;
    call_curl(&body_str)
}
