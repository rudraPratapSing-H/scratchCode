# Exam Platform Backend

A distributed, theoretically infinitely scalable backend system designed to securely compile and execute untrusted user code across multiple programming languages. Built with a decoupled architecture, it uses message queues to handle high-volume code submissions asynchronously. This mirrors the exact infrastructure of production-grade competitive programming platforms, allowing the execution engine to scale horizontally without bottlenecks.

---

## System Architecture

The system is divided into two main isolated components that communicate exclusively via a message broker. This architecture is infinitely scalable: to handle increased load, additional worker nodes can be provisioned and attached to the queue without any modifications to the core API or database.

### Components

**Express API (Producer)**
- The user-facing web server
- Handles HTTP requests and user authentication
- Writes initial submission states to PostgreSQL
- Pushes execution jobs to the Redis queue
- Does not execute code, ensuring the API remains lightning-fast and responsive under heavy traffic

**Worker Nodes (Consumers)**
- Independent execution servers that continuously poll the Redis queue
- Upon receiving a job, spins up an isolated Docker container
- Injects user code and executes it against test cases
- Updates the database with the final verdict
- Horizontally scalable: run 1 or 1,000 workers simultaneously

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend Framework** | Node.js with Express and TypeScript |
| **Database** | PostgreSQL managed via Prisma ORM |
| **Message Broker** | Redis with BullMQ |
| **Execution Sandbox** | Docker (Containerized Environments) |

---

## Core Features

### Multi-Language Support
Fully configured to execute:
- Python 3
- Node.js (JavaScript)
- C++ (GCC)
- Java 17 (Eclipse Temurin)

### Secure Isolation
- Untrusted code is executed inside ephemeral Docker containers (`--rm`)
- Network access is disabled (`--network none`)
- Read-only filesystem to prevent malicious file operations

### Resource Constraints
- Hard limits on CPU execution time (preventing infinite loops/TLE)
- Memory allocation limits (preventing memory leaks/MLE)
- Process limits to prevent resource exhaustion

### Asynchronous Processing
- Long-running compilation and execution tasks do not block the main API thread
- Enables rapid response times even under high submission volume
- JVM cold starts and heavy compilations handled gracefully by worker pool

---

## The Execution Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. SUBMIT                                                       │
│     Client sends source code and problem ID to the API           │
│                          ↓                                       │
│  2. QUEUE                                                        │
│     API creates a Pending record in PostgreSQL                   │
│     Pushes submissionId to Redis/BullMQ                          │
│                          ↓                                       │
│  3. PROCESS                                                      │
│     Worker picks up the job from the queue                       │
│     Fetches problem's boilerplate and test cases from DB         │
│                          ↓                                       │
│  4. SANDBOX                                                      │
│     Worker writes code to a temporary file                       │
│     Triggers docker run with strict memory and time limits       │
│                          ↓                                       │
│  5. GRADE                                                        │
│     Container stdout and stderr are parsed                       │
│     Worker catches compilation errors, runtime crashes, TLE      │
│                          ↓                                       │
│  6. RESOLVE                                                      │
│     Worker updates PostgreSQL record with final verdict          │
│     Status: Accepted, Runtime Error, TLE, Wrong Answer, etc.     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

The backend is mounted at `/api` for core application routes and `/api/auth` for authentication routes.

### Problem Routes

#### GET `/api/problems/grouped`

Returns all problems grouped by `questionTypes`.

Problems with no `questionTypes` value are grouped under `unknown`.

**Response example:**
```json
{
  "success": true,
  "message": "Problems grouped by question type",
  "data": {
    "array": [{ "id": "two-sum", "title": "Two Sum" }],
    "dynamic-programming": [{ "id": "climbing-stairs", "title": "Climbing Stairs" }],
    "unknown": [{ "id": "misc-problem", "title": "Misc Problem" }]
  }
}
```

#### GET `/api/problems/titles`

Returns the problem cards metadata: `id`, `title`, and `difficulty`.

This endpoint is used to populate problem lists and search/autocomplete UI.

#### GET `/api/problems/search?q=...`

Searches problems by title.

Returns exact matches first, then fuzzy matches if no exact match is found.

#### GET `/api/problems/:problemId`

Returns a single problem by ID, including its language configurations.

Example: `/api/problems/two-sum`

### Submission Routes

#### POST `/api/execute`

Submits code for full evaluation against the **private test cases**.

**Authentication:** Required

**Request Body:**
```json
{
  "problemId": "two-sum",
  "language": "javascript",
  "code": "function twoSum(nums, target) { ... }"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Code submitted successfully! Execution in progress.",
  "submissionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Pending"
}
```

#### POST `/api/execute-public`

Submits code for evaluation against the **public test cases only**.

**Authentication:** Required

**Request Body:**
```json
{
  "problemId": "two-sum",
  "language": "javascript",
  "code": "function twoSum(nums, target) { ... }"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Code submitted successfully! Public test execution in progress.",
  "submissionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Pending"
}
```

#### GET `/api/status/:id`

Polls the execution status of a specific submission.

**Authentication:** Not required

**Path Parameters:**
- `id` (string): The submission ID returned from `/execute` or `/execute-public`

**Possible Status Values:**
- `Pending` - Job is queued and waiting for a worker
- `Running` - Worker is currently executing the code
- `Accepted` - All test cases passed
- `Wrong Answer` - Output does not match expected result
- `Time Limit Exceeded` - Execution took longer than allowed
- `Memory Limit Exceeded` - Memory usage exceeded the limit
- `Runtime Error` - Code crashed during execution
- `Compilation Error` - Code failed to compile

#### GET `/api/submissions/latest?problemId=...&language=...`

Returns the latest submission for the authenticated user for a specific problem and language.

**Authentication:** Required

### Dashboard Routes

#### GET `/api/dashboard/submissions/latest/:problemId`

Returns the authenticated user’s latest submission for a specific problem.

#### GET `/api/dashboard/submissions/all/:problemId`

Returns all submissions made by the authenticated user for a specific problem.

#### GET `/api/dashboard/user-data`

Returns dashboard summary data for the authenticated user.

### Admin / Problem Creation

#### POST `/api/addProblem`

Creates a new problem with public/private test cases and language configs.

**Authentication:** Not enforced in code right now, but this should be restricted to admins in production.

### Auth Routes

Authentication routes are mounted at `/api/auth`.

#### POST `/api/auth/register`

Starts registration by generating an OTP and sending it to the user’s email.

> Note: `/api/register` also exists in `setupRoutes()` in the current codebase, but `/api/auth/register` is the cleaner auth route to use.

#### POST `/api/auth/verify-email`

Verifies the OTP and completes account creation.

#### POST `/api/auth/resend-otp`

Resends the verification OTP to the email address.

#### POST `/api/auth/login`

Logs the user in with email and password.

#### POST `/api/auth/logout`

Clears the refresh token cookie and logs the user out.

#### GET `/api/auth/me`

Returns the authenticated user profile using the current session/token.

**Authentication:** Required

#### GET `/api/auth/google`

Starts the Google OAuth flow by redirecting the user to Google.

#### GET `/api/auth/google/callback`

Handles the Google OAuth redirect, creates or updates the user, then redirects to the frontend with tokens.

#### POST `/api/auth/google/callback-json`

Handles the Google OAuth callback and returns JSON instead of redirecting.

This is useful for Postman, mobile clients, or manual testing.

### Notes

- `GET /api/problems/titles` returns `id`, `title`, and `difficulty`, not only titles.
- `POST /api/execute` uses private test cases.
- `POST /api/execute-public` uses public test cases only.
- `GET /api/problems/grouped` groups problems by every value in `questionTypes`, and places missing values under `unknown`.

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Docker

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd backenddd

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis URLs

# Run migrations
npx prisma migrate dev

# Seed initial problems (optional)
npm run seed
```

### Running the API

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

### Running Worker(s)

```bash
# In a separate terminal, start one or more workers
npx ts-node src/worker/index.ts

# Or use nodemon for development
nodemon src/worker/index.ts
```

---

## Deployment

### Horizontal Scaling

To handle increased load:

1. **Scale Workers:** Deploy additional worker containers pointing to the same Redis queue and PostgreSQL database
2. **Load Balance API:** Use a reverse proxy (Nginx, HAProxy) to distribute client requests across multiple API instances
3. **Database:** Ensure PostgreSQL and Redis can handle increased concurrent connections

### Docker Compose (Optional)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: exam_platform
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/exam_platform
      REDIS_URL: redis://redis:6379

  worker:
    build: .
    command: npx ts-node src/worker/index.ts
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/exam_platform
      REDIS_URL: redis://redis:6379

volumes:
  postgres_data:
```

---

## Monitoring & Debugging

### View Queue Status
```bash
# Connect to Redis and inspect the queue
redis-cli
> LLEN bull:CodeSubmissions:
> LRANGE bull:CodeSubmissions: 0 -1
```

### Database Insights
```bash
# View all submissions
npx prisma studio

# Query submissions directly
SELECT id, status, userId, problemId FROM Submission ORDER BY createdAt DESC LIMIT 10;
```

### Worker Logs
Workers output detailed logs including:
- Job received/processing start
- Compilation and execution events
- Verdicts and final status updates

---

## License

MIT
