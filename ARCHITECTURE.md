# 🏗️ LeadForge Architecture

## Database Schema (Supabase PostgreSQL)

### `profiles`
Extends `auth.users` with plan tiers and usage limits.

| Column | Type | Default |
|--------|------|---------|
| `id` | uuid (PK) | auth.users.id |
| `full_name` | text | — |
| `company_name` | text | — |
| `plan` | text | `'free'` |
| `monthly_url_limit` | int | `10` |
| `monthly_url_used` | int | `0` |
| `reset_date` | date | `current_date + 1 month` |

### `campaigns`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | auto |
| `user_id` | uuid (FK) | → profiles.id |
| `name` | text | campaign name |
| `niche` | text | target niche |
| `location` | text | optional |
| `status` | text | draft/processing/completed/failed |
| `total_urls` | int | submitted count |
| `processed_urls` | int | successfully parsed |

### `leads`
Parsed website data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | auto |
| `campaign_id` | uuid (FK) | → campaigns.id |
| `url` | text | full URL |
| `domain` | text | extracted domain |
| `company_name` | text | from title/meta |
| `page_title` | text | `<title>` tag |
| `meta_description` | text | meta tag |
| `emails` | text[] | extracted emails |
| `phones` | text[] | extracted phones |
| `ssl_valid` | boolean | HTTPS check |
| `load_time_ms` | int | response time |
| `has_mobile_friendly` | boolean | viewport check |
| `detected_pains` | text[] | audit findings |
| `status` | text | pending/analyzing/completed/failed |

### `generated_emails`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | auto |
| `lead_id` | uuid (FK) | → leads.id |
| `campaign_id` | uuid (FK) | → campaigns.id |
| `user_id` | uuid (FK) | → profiles.id |
| `subject` | text | AI-generated |
| `body` | text | email body |
| `personalized_hook` | text | opening line |
| `tone` | text | professional/casual |
| `ai_model` | text | gemini/groq |
| `is_edited` | boolean | user modified? |
| `is_sent` | boolean | sent to outreach? |

## Row Level Security (RLS)

- `profiles`: user sees only own row (`auth.uid() = id`)
- `campaigns`: user sees only own campaigns
- `leads`: visible through campaign ownership
- `generated_emails`: user sees only own emails

## API Flow

## Pain Detection Rules

| Pain | Trigger |
|------|---------|
| `no_ssl` | URL starts with `http://` |
| `slow_speed` | `load_time_ms > 3000` |
| `not_mobile_friendly` | No `viewport` meta tag |
| `no_analytics` | No GA/GTM/YM scripts in HTML |
| `no_chat_widget` | No chat scripts (Intercom, Crisp, etc.) |
| `outdated_stack` | Old jQuery, Bootstrap 3, etc. |
| `poor_social_presence` | No social links found |
| `site_unavailable` | HTTP error or timeout |

## Auth Flow

1. User signs up via Supabase Auth (email+password)
2. Trigger `on_auth_user_created` auto-creates `profiles` row
3. Frontend gets JWT session, stores in memory
4. All DB queries include `user_id` filter via RLS
