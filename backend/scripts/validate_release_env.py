"""Fail-fast validation for a Perfurm staging or production environment file."""
import argparse
from pathlib import Path
from urllib.parse import urlparse


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("env_file", type=Path)
    parser.add_argument("--require-commerce-providers", action="store_true")
    args = parser.parse_args(); env = read_env(args.env_file); errors: list[str] = []
    mode = env.get("APP_ENV")
    if mode not in {"staging", "production"}: errors.append("APP_ENV must be staging or production")
    if env.get("USE_MOCK_DB", "").lower() != "false": errors.append("USE_MOCK_DB must be false")
    if env.get("ENABLE_DEMO_OTP", "").lower() != "false": errors.append("ENABLE_DEMO_OTP must be false")
    if env.get("COOKIE_SECURE", "").lower() != "true": errors.append("COOKIE_SECURE must be true")
    if env.get("COOKIE_SAMESITE", "").lower() not in {"lax", "strict", "none"}: errors.append("COOKIE_SAMESITE must be lax, strict or none")
    for key in ("WEB_CONCURRENCY", "UVICORN_LIMIT_CONCURRENCY", "UVICORN_BACKLOG", "MAX_INFLIGHT_REQUESTS", "REQUEST_QUEUE_TIMEOUT_MS", "MONGO_MAX_POOL_SIZE", "MONGO_WAIT_QUEUE_TIMEOUT_MS"):
        try:
            if int(env.get(key, "0")) < 1: errors.append(f"{key} must be a positive integer")
        except ValueError: errors.append(f"{key} must be a positive integer")
    if env.get("RUN_BACKGROUND_WORKERS", "").lower() != "false": errors.append("RUN_BACKGROUND_WORKERS must be false on scaled web services; use the dedicated worker service")
    for key in ("CONSENT_POLICY_VERSION", "COOKIE_POLICY_VERSION", "PRIVACY_POLICY_VERSION"):
        if not env.get(key): errors.append(f"{key} is required")
    try:
        if not 1 <= int(env.get("CONSENT_EXPIRY_DAYS", "0")) <= 365: errors.append("CONSENT_EXPIRY_DAYS must be between 1 and 365")
    except ValueError: errors.append("CONSENT_EXPIRY_DAYS must be an integer")
    secret = env.get("JWT_SECRET_KEY", "")
    if len(secret) < 32 or "GENERATE_" in secret or "replace" in secret.lower(): errors.append("JWT_SECRET_KEY must be a real random secret of 32+ characters")
    metrics = env.get("METRICS_TOKEN", "")
    if len(metrics) < 24 or "GENERATE_" in metrics: errors.append("METRICS_TOKEN must be a separate real secret")
    for key in ("PUBLIC_SITE_URL", "PUBLIC_API_URL"):
        parsed = urlparse(env.get(key, ""))
        if parsed.scheme != "https" or not parsed.netloc: errors.append(f"{key} must be an HTTPS URL")
    cors = [item.strip() for item in env.get("CORS_ORIGINS", "").split(",") if item.strip()]
    if not cors or "*" in cors or any(not item.startswith("https://") for item in cors): errors.append("CORS_ORIGINS must contain explicit HTTPS origins and no wildcard")
    if not env.get("MONGO_URL") or "replicaSet=" not in env.get("MONGO_URL", ""): errors.append("MONGO_URL must target a MongoDB replica set")
    if not env.get("BUSINESS_LEGAL_NAME") or not env.get("BUSINESS_ADDRESS"): errors.append("BUSINESS_LEGAL_NAME and BUSINESS_ADDRESS are required")
    if mode == "production" and not env.get("BUSINESS_GSTIN"): errors.append("BUSINESS_GSTIN is required for production invoicing")
    if not env.get("OPERATING_SELLER_ID"): errors.append("OPERATING_SELLER_ID must identify the approved Perfurm business record")
    if env.get("NOTIFICATION_DELIVERY_ENABLED", "").lower() == "true" and not ((env.get("SMTP_HOST") and env.get("SMTP_FROM_EMAIL")) or env.get("SMS_WEBHOOK_URL")): errors.append("Enable at least one notification provider")
    reverse_url = env.get("REVERSE_GEOCODING_URL", "")
    if "{latitude}" not in reverse_url or "{longitude}" not in reverse_url: errors.append("REVERSE_GEOCODING_URL must include {latitude} and {longitude} placeholders")
    for key in ("REVERSE_GEOCODING_URL", "SMS_WEBHOOK_URL", "SHIPPING_PROVIDER_API_URL"):
        value = env.get(key, "")
        if value and mode == "production" and urlparse(value).scheme != "https": errors.append(f"{key} must use HTTPS in production")
    if env.get("SMTP_USE_SSL", "false").lower() == "true" and env.get("SMTP_USE_TLS", "false").lower() == "true": errors.append("Choose SMTP_USE_SSL or SMTP_USE_TLS, not both")
    if args.require_commerce_providers:
        for key in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "SHIPPING_PROVIDER_API_URL", "SHIPPING_PROVIDER_API_TOKEN", "SHIPPING_PROVIDER_WEBHOOK_SECRET"):
            if not env.get(key): errors.append(f"{key} is required for commerce-provider qualification")
    provider_groups = {
        "Cloudinary": ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"),
        "Brevo": ("BREVO_API_KEY", "BREVO_SENDER_EMAIL"),
        "Turnstile": ("TURNSTILE_SECRET_KEY", "REACT_APP_TURNSTILE_SITE_KEY"),
    }
    for provider, keys in provider_groups.items():
        populated = [key for key in keys if env.get(key)]
        if populated and len(populated) != len(keys):
            errors.append(f"{provider} configuration is partial; set all of: {', '.join(keys)}")
    if errors:
        print("Release environment is NOT ready:")
        for error in errors: print(f"- {error}")
        return 1
    print(f"Release environment is structurally ready for {mode} qualification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
