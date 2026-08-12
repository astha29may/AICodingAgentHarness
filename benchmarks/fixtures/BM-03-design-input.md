# DESIGN — Clickstream Analytics Ingestion

## 1. Overview
An event-driven ingestion pipeline that validates and aggregates retail
clickstream events using Azure-native services.

## 2. Architecture
- **Ingress:** Azure Event Hubs receives raw clickstream events.
- **Processing:** Azure Functions validate and normalize each event.
- **Storage:** Azure Cosmos DB stores normalized events.
- **Aggregation:** A scheduled Function computes rollup metrics.

## 3. Data model
- `ClickEvent { event_id, user_id, url, ts, event_type }`
- Aggregates keyed by `event_type` and time window.

## 4. Security & identity
- Managed identity for all service-to-service calls.
- No secrets in code; configuration via app settings / Key Vault references.

## 5. Observability
- Structured logs and metrics to Application Insights with correlation ids.

## 6. Failure modes
- Malformed events are dead-lettered with a reason.
- Transient downstream failures use bounded retry with backoff.
