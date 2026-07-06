use base64::Engine;
use base64::engine::general_purpose::STANDARD;

const SYSTEM_PROMPT: &str = "You are an AI assistant integrated into ENVEIL, a secure desktop .env vault manager. Answer questions about ENVEIL, environment variables, DevOps secrets management, and related topics. For simple acknowledgments or test prompts, respond naturally.";

const TEMPLATE_PROMPT: &str = "You generate .env templates. Given a project description, return ONLY a raw JSON array of objects with these exact fields: key (uppercase env var name), value (sensible default or placeholder), description (short explanation). Example: [{\"key\":\"PORT\",\"value\":\"3000\",\"description\":\"Server port\"}]. Do NOT include markdown, code fences, or any text outside the JSON array.";

fn build_ai_config_url() -> String {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;
    const A: &str = "aHR0cHM6Ly8="; 
    const B: &str = "YWktaW50ZWdyYXRpb24t";
    const C: &str = "YXBpLnZlcmNlbA==";
    const D: &str = "LmFwcC9lbnZlaWw=";
    let mut url = String::with_capacity(48);
    url.push_str(&STANDARD.decode(A).ok().and_then(|b| String::from_utf8(b).ok()).unwrap_or_default());
    url.push_str(&STANDARD.decode(B).ok().and_then(|b| String::from_utf8(b).ok()).unwrap_or_default());
    url.push_str(&STANDARD.decode(C).ok().and_then(|b| String::from_utf8(b).ok()).unwrap_or_default());
    url.push_str(&STANDARD.decode(D).ok().and_then(|b| String::from_utf8(b).ok()).unwrap_or_default());
    url
}

#[derive(serde::Serialize)]
pub struct AIConfig {
    pub configured: bool,
}

struct AiCredentials {
    api_key: String,
    base_url: String,
    model: String,
}

fn fetch_ai_credentials() -> Result<AiCredentials, String> {
    let url = build_ai_config_url();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Failed to fetch AI config: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("AI config API returned status {}", status.as_u16()));
    }

    let data: serde_json::Value = response
        .json()
        .map_err(|e| format!("Failed to parse AI config: {}", e))?;

    let model_b64 = data["m"].as_str().ok_or("Missing 'm' field in AI config")?;
    let base_url_b64 = data["b"].as_str().ok_or("Missing 'b' field in AI config")?;
    let api_key_b64 = data["a"].as_str().ok_or("Missing 'a' field in AI config")?;

    let model = String::from_utf8(
        STANDARD.decode(model_b64).map_err(|e| format!("Failed to decode model: {}", e))?
    ).map_err(|e| format!("Invalid UTF-8 in model: {}", e))?;

    let base_url = String::from_utf8(
        STANDARD.decode(base_url_b64).map_err(|e| format!("Failed to decode base_url: {}", e))?
    ).map_err(|e| format!("Invalid UTF-8 in base_url: {}", e))?;

    let api_key = String::from_utf8(
        STANDARD.decode(api_key_b64).map_err(|e| format!("Failed to decode api_key: {}", e))?
    ).map_err(|e| format!("Invalid UTF-8 in api_key: {}", e))?;

    Ok(AiCredentials { api_key, base_url, model })
}

fn call_ai_api(prompt: &str, system_prompt: &str) -> Result<String, String> {
    let creds = fetch_ai_credentials()?;
    let url = format!("{}/chat/completions", creds.base_url);

    let body = serde_json::json!({
        "model": creds.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 4096,
    });
    let body_str = serde_json::to_string(&body)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", creds.api_key))
        .header("HTTP-Referer", "https://github.com/kyawsoe-dev/enveil")
        .header("X-Title", "ENVEIL")
        .body(body_str)
        .send()
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = response.status();
    let body_text = response
        .text()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(format!("API error ({}): {}", status.as_u16(), body_text));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("Failed to parse response: {}", e))?;

    parsed["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "AI returned empty response".to_string())
}

#[tauri::command]
pub fn get_ai_config() -> AIConfig {
    AIConfig {
        configured: fetch_ai_credentials().is_ok(),
    }
}

#[tauri::command]
pub fn call_ai(prompt: String, _model: String) -> Result<String, String> {
    call_ai_api(&prompt, SYSTEM_PROMPT)
}

#[tauri::command]
pub fn generate_env_template(description: String, _model: String) -> Result<String, String> {
    call_ai_api(&description, TEMPLATE_PROMPT)
}

const VALIDATE_PROMPT: &str = "You validate .env values for security and correctness. Given a JSON object of env vars, analyze each value and return ONLY a raw JSON array of issues. Each issue has: key (the env var name), issue (description of the problem), severity (\"error\" or \"warning\"). Check for: placeholder passwords, hardcoded secrets, default development values, invalid URLs, credentials that should not be committed, and values that don't match the expected format. Example: [{\"key\":\"DB_PASSWORD\",\"issue\":\"Placeholder password - change before production\",\"severity\":\"error\"}]. Do NOT include markdown, code fences, or any text outside the JSON array.";

#[tauri::command]
pub fn validate_env_vars(env_vars_json: String, _model: String) -> Result<String, String> {
    call_ai_api(&env_vars_json, VALIDATE_PROMPT)
}

const DOCSTRING_PROMPT: &str = "You explain environment variables. Given a JSON object of env vars, return ONLY a raw JSON object where each key is an env var name and the value is a short plain-text description (max 100 chars) of what that variable does. Assume common frameworks and conventions. Example: {\"PORT\":\"TCP port the web server listens on\",\"DATABASE_URL\":\"PostgreSQL connection string\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn generate_env_docstrings(env_vars_json: String, _model: String) -> Result<String, String> {
    call_ai_api(&env_vars_json, DOCSTRING_PROMPT)
}

const DIFF_PROMPT: &str = "You summarize changes to a .env file. Given a JSON object describing changes between two versions, return a short paragraph in plain text explaining the changes. Focus on patterns and implications. Example: 'Added DATABASE_URL and REDIS_URL for the new production infrastructure, removed DEV_API_KEY as part of the security cleanup, and rotated the JWT_SECRET.' Do NOT include markdown, code fences, labels, or prefixes. Just the paragraph.";

#[tauri::command]
pub fn explain_diff(diff_json: String, _model: String) -> Result<String, String> {
    call_ai_api(&diff_json, DIFF_PROMPT)
}

const SUGGEST_PROJECT_PROMPT: &str = "You suggest project names and descriptions for ENVEIL, a .env vault manager. Given a rough project description from the user, return ONLY a raw JSON object with two fields: name (a short kebab-case or title-case name, max 40 chars) and description (a one-sentence description, max 120 chars). Example: {\"name\":\"Next.js Blog\",\"description\":\"A Next.js blog application with Prisma ORM and NextAuth authentication\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn suggest_project(description: String, _model: String) -> Result<String, String> {
    call_ai_api(&description, SUGGEST_PROJECT_PROMPT)
}

const SUGGEST_ENV_VAR_PROMPT: &str = "You suggest environment variable names and values. Given a user's description of what they need and a JSON array of existing env var keys, return ONLY a raw JSON object with two fields: key (uppercase snake_case name matching convention of existing keys) and value (a sensible default or placeholder). Example: {\"key\":\"DATABASE_URL\",\"value\":\"postgresql://user:password@localhost:5432/mydb\"}. Do NOT include markdown, code fences, or any text outside the JSON object.";

#[tauri::command]
pub fn suggest_env_var(prompt: String, existing_keys: String, _model: String) -> Result<String, String> {
    let user_content = format!("User request: {}\n\nExisting keys: {}", prompt, existing_keys);
    call_ai_api(&user_content, SUGGEST_ENV_VAR_PROMPT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_ai_config_url_produces_correct_url() {
        let url = build_ai_config_url();
        let mut expected = String::new();
        for part in [
            "aHR0cHM6Ly8=",
            "YWktaW50ZWdyYXRpb24t",
            "YXBpLnZlcmNlbA==",
            "LmFwcC9lbnZlaWw=",
        ] {
            expected.push_str(
                &String::from_utf8(STANDARD.decode(part).unwrap()).unwrap(),
            );
        }
        assert_eq!(url, expected);
    }

    #[test]
    fn build_ai_config_url_is_https() {
        let url = build_ai_config_url();
        assert!(url.starts_with("https://"));
    }
}
