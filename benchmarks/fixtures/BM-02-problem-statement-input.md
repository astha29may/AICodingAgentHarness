# PROBLEMSTATEMENT — Clickstream Analytics Ingestion

## Problem
A retail web platform emits raw clickstream events that must be ingested,
validated, and stored for downstream analytics. Events currently arrive with
inconsistent schemas and no validation.

## Goals
- Ingest clickstream events reliably at scale.
- Validate and normalize each event before storage.
- Expose aggregated metrics for analytics consumers.

## Constraints
- Azure-native services only.
- Human-in-the-loop for any destructive operation.

## In scope
- Event ingestion, validation, normalization, and aggregation.

## Out of scope
- Front-end dashboards.
- Machine-learning models over the event stream.

## Acceptance criteria
- Malformed events are rejected with a clear reason.
- Valid events are persisted and queryable.
