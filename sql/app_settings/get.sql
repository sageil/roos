SELECT
  openai_api_key,
  openai_base_url,
  llm_model,
  llm_api_style,
  embedding_api_key,
  embedding_base_url,
  embedding_model,
  embedding_dimensions,
  smtp_host,
  smtp_port,
  smtp_secure,
  smtp_user,
  smtp_pass,
  email_from,
  email_from_name,
  updated_at
FROM app_settings
WHERE id = TRUE;
