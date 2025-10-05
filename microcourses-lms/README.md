# MicroCourses LMS - Mini Learning Management System

A comprehensive Learning Management System with multi-role support (Learner, Creator, Admin), course management, progress tracking, and automatic certificate generation.

## 🚀 Features

- **Multi-role Authentication**: Learner, Creator, and Admin roles
- **Course Management**: Create, submit, review, and publish courses
- **Lesson System**: Structured lessons with video URLs and auto-generated transcripts
- **Progress Tracking**: Real-time progress monitoring for learners
- **Certificate Generation**: Automatic certificate issuance upon 100% completion
- **Enrollment System**: Learners can enroll in published courses
- **Admin Review**: Course approval workflow
- **Rate Limiting**: 60 requests/minute per user
- **Idempotency**: Safe retry mechanism for POST requests
- **Pagination**: All list endpoints support limit/offset

## 📋 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (in-memory for demo)
- **Frontend**: React, Tailwind CSS
- **Authentication**: JWT tokens
- **Security**: bcrypt password hashing

## 🛠️ Installation

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Setup

1. **Clone and install dependencies**:
```bash
npm install express sqlite3 bcryptjs jsonwebtoken cors
```

2. **Start the backend server**:
```bash
node server.js
```

3. **Access the application**:
   - Backend API: `http://localhost:3000`
   - Frontend: Open the React component in your browser

## 🔐 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | admin123 |
| Creator | creator@test.com | creator123 |
| Learner | learner@test.com | learner123 |

## 📚 API Documentation

### Health & Meta Endpoints

#### GET /api/health
Check API health status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-05T12:00:00.000Z"
}
```

#### GET /api/_meta
Get API metadata and available endpoints.

**Response**:
```json
{
  "version": "1.0.0",
  "endpoints": [...]
}
```

#### GET /.well-known/hackathon.json
Hackathon manifest file.

**Response**:
```json
{
  "problem_id": 4,
  "team_name": "MicroCourses Team",
  "contact_email": "team@microcourses.dev"
}
```

### Authentication Endpoints

#### POST /api/auth/register
Register a new user.

**Headers**:
- `Idempotency-Key`: (optional) Unique key for idempotent requests

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "role": "learner"
}
```

**Response** (201):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 4,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "learner"
  }
}
```

**Error Response** (400):
```json
{
  "error": {
    "code": "FIELD_REQUIRED",
    "field": "email",
    "message": "Email is required"
  }
}
```

#### POST /api/auth/login
Login with existing credentials.

**Request Body**:
```json
{
  "email": "learner@test.com",
  "password": "learner123"
}
```

**Response** (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 3,
    "email": "learner@test.com",
    "name": "Learner User",
    "role": "learner"
  }
}
```

### Course Endpoints

#### GET /api/courses
List courses (learners see only published courses).

**Headers**:
- `Authorization`: Bearer {token}

**Query Parameters**:
- `status`: Filter by status (draft, pending, published, rejected)
- `limit`: Number of items per page (default: 20)
- `offset`: Starting position (default: 0)

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "title": "Introduction to Web Development",
      "description": "Learn the basics of HTML, CSS, and JavaScript",
      "creator_id": 2,
      "status": "published",
      "created_at": "2025-10-01T10:00:00.000Z",
      "updated_at": "2025-10-01T10:00:00.000Z"
    }
  ],
  "next_offset": 20
}
```

#### GET /api/courses/:id
Get a specific course by ID.

**Headers**:
- `Authorization`: Bearer {token}

**Response** (200):
```json
{
  "id": 1,
  "title": "Introduction to Web Development",
  "description": "Learn the basics of HTML, CSS, and JavaScript",
  "creator_id": 2,
  "status": "published",
  "created_at": "2025-10-01T10:00:00.000Z",
  "updated_at": "2025-10-01T10:00:00.000Z"
}
```

#### POST /api/courses
Create a new course (Creator only).

**Headers**:
- `Authorization`: Bearer {token}
- `Idempotency-Key`: (optional) Unique key

**Request Body**:
```json
{
  "title": "Advanced JavaScript",
  "description": "Deep dive into JavaScript concepts"
}
```

**Response** (200):
```json
{
  "id": 2,
  "title": "Advanced JavaScript",
  "description": "Deep dive into JavaScript concepts",
  "creator_id": 2,
  "status": "draft",
  "created_at": "2025-10-05T12:00:00.000Z",
  "updated_at": "2025-10-05T12:00:00.000Z"
}
```

#### PUT /api/courses/:id
Update a draft course (Creator only).

**Headers**:
- `Authorization`: Bearer {token}

**Request Body**:
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

**Response** (200):
```json
{
  "id": 2,
  "title": "Updated Title",
  "description": "Updated description",
  "creator_id": 2,
  "status": "draft",
  "created_at": "2025-10-05T12:00:00.000Z",
  "updated_at": "2025-10-05T12:05:00.000Z"
}
```

#### POST /api/courses/:id/submit
Submit a course for admin review (Creator only).

**Headers**:
- `Authorization`: Bearer {token}
- `Idempotency-Key`: (optional) Unique key

**Response** (200):
```json
{
  "message": "Course submitted for review"
}
```

### Lesson Endpoints

#### GET /api/courses/:id/lessons
Get all lessons for a course.

**Headers**:
- `Authorization`: Bearer {token}

**Query Parameters**:
- `limit`: Number of items (default: 50)
- `offset`: Starting position (default: 0)

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "course_id": 1,
      "title": "HTML Basics",
      "content": "Learn the fundamentals of HTML...",
      "video_url": "https://example.com/video1",
      "transcript": "Welcome to HTML Basics...",
      "order_index": 1,
      "created_at": "2025-10-01T10:00:00.000Z"
    }
  ],
  "next_offset": null
}
```

#### POST /api/lessons/:id/complete
Mark a lesson as complete (Learner only).

**Headers**:
- `Authorization`: Bearer {token}
- `Idempotency-Key`: (optional) Unique key

**Response** (200):
```json
{
  "message": "Lesson completed"
}
```

**Note**: When all lessons are completed, a certificate is automatically issued.

### Enrollment Endpoints

#### GET /api/enrollments
Get user's enrollments.

**Headers**:
- `Authorization`: Bearer {token}

**Query Parameters**:
- `limit`: Number of items (default: 50)
- `offset`: Starting position (default: 0)

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "user_id": 3,
      "course_id": 1,
      "enrolled_at": "2025-10-05T12:00:00.000Z"
    }
  ],
  "next_offset": null
}
```

#### POST /api/enrollments
Enroll in a course (Learner only).

**Headers**:
- `Authorization`: Bearer {token}
- `Idempotency-Key`: (optional) Unique key

**Request Body**:
```json
{
  "course_id": 1
}
```

**Response** (200):
```json
{
  "message": "Enrolled successfully",
  "course_id": 1
}
```

### Progress Endpoints

#### GET /api/progress
Get progress for all enrolled courses.

**Headers**:
- `Authorization`: Bearer {token}

**Response** (200):
```json
{
  "items": [
    {
      "course_id": 1,
      "total_lessons": 3,
      "completed_lessons": [1, 2],
      "progress_percentage": 66,
      "certificate_url": null
    },
    {
      "course_id": 2,
      "total_lessons": 5,
      "completed_lessons": [1, 2, 3, 4, 5],
      "progress_percentage": 100,
      "certificate_url": "/api/certificates/a1b2c3d4..."
    }
  ]
}
```

### Creator Endpoints

#### GET /api/creator/courses
Get all courses created by the authenticated creator.

**Headers**:
- `Authorization`: Bearer {token}

**Query Parameters**:
- `limit`: Number of items (default: 20)
- `offset`: Starting position (default: 0)

**Response** (200):
```json
{
  "items": [
    {
      "id": 2,
      "title": "Advanced JavaScript",
      "description": "Deep dive into JavaScript concepts",
      "creator_id": 2,
      "status": "draft",
      "created_at": "2025-10-05T12:00:00.000Z",
      "updated_at": "2025-10-05T12:00:00.000Z"
    }
  ],
  "next_offset": null
}
```

### Admin Endpoints

#### GET /api/admin/courses
Get all courses (Admin only).

**Headers**:
- `Authorization`: Bearer {token}

**Query Parameters**:
- `status`: Filter by status (optional)
- `limit`: Number of items (default: 20)
- `offset`: Starting position (default: 0)

**Response** (200):
```json
{
  "items": [
    {
      "id": 2,
      "title": "Advanced JavaScript",
      "description": "Deep dive into JavaScript concepts",
      "creator_id": 2,
      "status": "pending",
      "created_at": "2025-10-05T12:00:00.000Z",
      "updated_at": "2025-10-05T12:00:00.000Z"
    }
  ],
  "next_offset": null
}
```

#### POST /api/admin/courses/:id/review
Review and approve/reject a course (Admin only).

**Headers**:
- `Authorization`: Bearer {token}
- `Idempotency-Key`: (optional) Unique key

**Request Body**:
```json
{
  "status": "published"
}
```

**Note**: Status must be either "published" or "rejected".

**Response** (200):
```json
{
  "message": "Course published"
}
```

## 🔄 Error Handling

All errors follow a uniform format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "field": "fieldName"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `FIELD_REQUIRED` | Required field is missing | 400 |
| `EMAIL_EXISTS` | Email already registered | 400 |
| `INVALID_CREDENTIALS` | Invalid email or password | 401 |
| `UNAUTHORIZED` | Authentication required or invalid token | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT` | Too many requests (60/min exceeded) | 429 |
| `INVALID_STATE` | Operation not allowed in current state | 400 |
| `NOT_ENROLLED` | User not enrolled in course | 403 |
| `DATABASE_ERROR` | Server error | 500 |

## 🎯 Rate Limiting

All authenticated endpoints are rate-limited to **60 requests per minute per user**.

When exceeded, the API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests"
  }
}
```

HTTP Status: `429 Too Many Requests`

## 🔁 Idempotency

All POST endpoints support idempotent requests using the `Idempotency-Key` header:

```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Authorization: Bearer {token}" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Course","description":"Course description"}'
```

If the same key is used again, the original response is returned without creating a duplicate.

## 📄 Pagination

All list endpoints support pagination via query parameters:

- `limit`: Number of items to return (default varies by endpoint)
- `offset`: Number of items to skip (default: 0)

**Response includes**:
- `items`: Array of results
- `next_offset`: Next offset value, or `null` if no more items

**Example**:
```bash
GET /api/courses?limit=10&offset=0
GET /api/courses?limit=10&offset=10
```

## 🏗️ Architecture

The MicroCourses LMS follows a three-tier architecture:

**Presentation Layer**: React-based frontend with role-specific dashboards for learners, creators, and admins. Uses JWT tokens stored in localStorage for authentication.

**Application Layer**: Express.js REST API with middleware for authentication, rate limiting, and idempotency. Enforces role-based access control (RBAC) at the endpoint level.

**Data Layer**: SQLite database with normalized schema supporting users, courses, lessons, enrollments, completions, and certificates. Implements unique constraints for lesson ordering and enrollment deduplication.

Key design decisions include in-memory SQLite for rapid prototyping, bcrypt for password security, and automatic certificate generation using SHA-256 hashes upon 100% course completion.

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('learner', 'creator', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Courses Table
```sql
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  creator_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'published', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
)
```

### Lessons Table
```sql
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  transcript TEXT,
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE(course_id, order_index)
)
```

### Enrollments Table
```sql
CREATE TABLE enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE(user_id, course_id)
)
```

### Lesson Completions Table
```sql
CREATE TABLE lesson_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  UNIQUE(user_id, lesson_id)
)
```

### Certificates Table
```sql
CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  serial_hash TEXT UNIQUE NOT NULL,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE(user_id, course_id)
)
```

## 🧪 Testing with cURL

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "learner"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "learner@test.com",
    "password": "learner123"
  }'
```

### Get published courses
```bash
curl http://localhost:3000/api/courses?status=published \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Enroll in a course
```bash
curl -X POST http://localhost:3000/api/enrollments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id": 1}'
```

### Complete a lesson
```bash
curl -X POST http://localhost:3000/api/lessons/1/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: unique-completion-key-123"
```

### Check progress
```bash
curl http://localhost:3000/api/progress \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔐 Security Features

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control (RBAC)**: Endpoint-level permissions
- **Rate Limiting**: Prevents abuse (60 req/min/user)
- **Idempotency**: Prevents duplicate operations
- **Input Validation**: All inputs validated before processing

## 🎓 User Flows

### Learner Flow
1. Register/Login as learner
2. Browse published courses
3. Enroll in a course
4. Complete lessons sequentially
5. Receive certificate upon 100% completion

### Creator Flow
1. Register/Login as creator
2. Create a new course (status: draft)
3. Add lessons with content, videos, and auto-transcripts
4. Submit course for review (status: pending)
5. Wait for admin approval

### Admin Flow
1. Login as admin
2. View pending courses
3. Review course content
4. Approve (publish) or reject courses

## 📦 Seed Data

The system comes pre-populated with:
- 3 test users (admin, creator, learner)
- 1 published course: "Introduction to Web Development"
- 3 lessons with transcripts

## 🚀 Deployment Considerations

For production deployment:

1. **Database**: Replace in-memory SQLite with persistent file or PostgreSQL
2. **Environment Variables**: Store JWT secret and other configs in `.env`
3. **HTTPS**: Enable SSL/TLS encryption
4. **CORS**: Configure allowed origins properly
5. **Rate Limiting**: Consider Redis for distributed rate limiting
6. **File Storage**: Implement video/file upload with S3 or similar
7. **Logging**: Add Winston or similar logging framework
8. **Monitoring**: Implement health checks and metrics

## 📝 License

MIT License - feel free to use for your projects!

## 🤝 Contributing

Contributions welcome! Please follow standard Git workflow.

---

**Built with ❤️ for the MicroCourses Hackathon**