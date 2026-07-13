# CaseLens API Specification

## Authentication Endpoints

### 1. Register User
* **Method**: `POST`
* **Path**: `/api/v1/auth/register`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123",
    "full_name": "John Doe"
  }
  ```
* **Response**: `TokenResponse` (returns JWT access and refresh token pair)

### 2. Login User
* **Method**: `POST`
* **Path**: `/api/v1/auth/login`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword123"
  }
  ```
* **Response**: `TokenResponse`

---

## Matter Endpoints

### 1. Create Matter
* **Method**: `POST`
* **Path**: `/api/v1/matters`
* **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
* **Request Body**:
  ```json
  {
    "title": "Breach of Contract - ACME Corp",
    "description": "Breach of contract litigation",
    "matter_number": "MTR-2026-001"
  }
  ```

### 2. List Matters
* **Method**: `GET`
* **Path**: `/api/v1/matters`

---

## Document Endpoints

### 1. Upload Document
* **Method**: `POST`
* **Path**: `/api/v1/matters/{matter_id}/documents`
* **Request Body**: Multipart form data with `file` key (must be a PDF).

### 2. Get Document Status
* **Method**: `GET`
* **Path**: `/api/v1/documents/{document_id}/status`

---

## RAG & Search Endpoints

### 1. Search Matter Documents
* **Method**: `POST`
* **Path**: `/api/v1/matters/{matter_id}/search`
* **Request Body**:
  ```json
  {
    "query": "liability limit",
    "top_k": 5,
    "search_type": "hybrid"
  }
  ```

### 2. RAG Ask Question
* **Method**: `POST`
* **Path**: `/api/v1/matters/{matter_id}/ask`
* **Request Body**:
  ```json
  {
    "question": "What is the liability limit in the contract?",
    "top_k": 5,
    "conversation_id": "optional-uuid"
  }
  ```
