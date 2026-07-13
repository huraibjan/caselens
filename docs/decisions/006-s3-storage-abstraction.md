# Architectural Decision Record: ADR-006 — S3 Storage Abstraction

## Status
Approved

## Context
Uploaded PDF documents must be stored in a persistent, scalable object storage system. Storing documents directly on the web server's local file system makes scaling horizontal API servers impossible.

## Decision
We will define an abstract `StorageBackend` interface and implement a local `MinIOBackend` using S3-compatible protocols.

## Consequences
* **Pros**: Identical interface between dev environment and production AWS S3/GCS buckets; easy migration by swapping configuration settings.
* **Cons**: MinIO container must be running in the local environment.
