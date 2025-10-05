const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());


// Rate limiting store
const rateLimitStore = new Map();

// Initialize Database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('learner', 'creator', 'admin')) DEFAULT 'learner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('draft', 'pending', 'published', 'rejected')) DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE lessons (
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
  )`);

  db.run(`CREATE TABLE enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE lesson_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    UNIQUE(user_id, lesson_id)
  )`);

  db.run(`CREATE TABLE certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    serial_hash TEXT UNIQUE NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE idempotency_keys (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed data
  const adminPass = bcrypt.hashSync('admin123', 10);
  const creatorPass = bcrypt.hashSync('creator123', 10);
  const learnerPass = bcrypt.hashSync('learner123', 10);

  db.run(`INSERT INTO users (email, password, name, role) VALUES 
    ('admin@test.com', ?, 'Admin User', 'admin'),
    ('creator@test.com', ?, 'Creator User', 'creator'),
    ('learner@test.com', ?, 'Learner User', 'learner')`,
    [adminPass, creatorPass, learnerPass]
  );

  // Sample course
  db.run(`INSERT INTO courses (title, description, creator_id, status) VALUES 
    ('Introduction to Web Development', 'Learn the basics of HTML, CSS, and JavaScript', 2, 'published')`);

  // Sample lessons
  db.run(`INSERT INTO lessons (course_id, title, content, video_url, transcript, order_index) VALUES 
    (1, 'HTML Basics', 'Learn the fundamentals of HTML including tags, elements, and structure.', 'https://example.com/video1', 'Welcome to HTML Basics. In this lesson we will cover the fundamental building blocks of web pages.', 1),
    (1, 'CSS Styling', 'Discover how to style your web pages with CSS.', 'https://example.com/video2', 'CSS allows you to control the visual presentation of your HTML elements.', 2),
    (1, 'JavaScript Introduction', 'Get started with programming using JavaScript.', 'https://example.com/video3', 'JavaScript brings interactivity to your web pages.', 3)`);
});

// Middleware: Rate limiting
const rateLimit = (req, res, next) => {
  if (!req.user) return next();
  
  const key = `${req.user.id}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key).filter(time => now - time < windowMs);
  
  if (requests.length >= 60) {
    return res.status(429).json({
      error: { code: 'RATE_LIMIT', message: 'Too many requests' }
    });
  }
  
  requests.push(now);
  rateLimitStore.set(key, requests);
  next();
};

// Middleware: Idempotency
const idempotency = (req, res, next) => {
  if (req.method !== 'POST') return next();
  
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  
  db.get('SELECT response FROM idempotency_keys WHERE key = ?', [key], (err, row) => {
    if (row) {
      return res.json(JSON.parse(row.response));
    }
    
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      db.run('INSERT INTO idempotency_keys (key, response) VALUES (?, ?)',
        [key, JSON.stringify(data)]);
      originalJson(data);
    };
    next();
  });
};

// Middleware: Authentication
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    db.get('SELECT id, email, name, role FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (!user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
    });
  }
};

// Middleware: Role check
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    next();
  };
};

// Helper: Error response
const errorResponse = (res, code, message, field = null) => {
  const error = { code, message };
  if (field) error.field = field;
  return res.status(400).json({ error });
};

// Health & Meta endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/_meta', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: [
      '/api/auth/register',
      '/api/auth/login',
      '/api/courses',
      '/api/courses/:id',
      '/api/courses/:id/lessons',
      '/api/lessons/:id/complete',
      '/api/enrollments',
      '/api/progress',
      '/api/creator/courses',
      '/api/courses/:id/submit',
      '/api/admin/courses',
      '/api/admin/courses/:id/review'
    ]
  });
});

app.get('/.well-known/hackathon.json', (req, res) => {
  res.json({
    problem_id: 4,
    team_name: 'MicroCourses Team',
    contact_email: 'team@microcourses.dev'
  });
});

// Auth endpoints
app.post('/api/auth/register', idempotency, (req, res) => {
  const { email, password, name, role = 'learner' } = req.body;
  
  if (!email) return errorResponse(res, 'FIELD_REQUIRED', 'Email is required', 'email');
  if (!password) return errorResponse(res, 'FIELD_REQUIRED', 'Password is required', 'password');
  if (!name) return errorResponse(res, 'FIELD_REQUIRED', 'Name is required', 'name');
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
    [email, hashedPassword, name, role],
    function(err) {
      if (err) {
        return res.status(400).json({
          error: { code: 'EMAIL_EXISTS', message: 'Email already exists' }
        });
      }
      
      const token = jwt.sign({ id: this.lastID }, JWT_SECRET);
      res.json({
        token,
        user: { id: this.lastID, email, name, role }
      });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email) return errorResponse(res, 'FIELD_REQUIRED', 'Email is required', 'email');
  if (!password) return errorResponse(res, 'FIELD_REQUIRED', 'Password is required', 'password');
  
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  });
});

// Course endpoints
app.get('/api/courses', authenticate, rateLimit, (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM courses WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  } else if (req.user.role === 'learner') {
    query += ' AND status = ?';
    params.push('published');
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, courses) => {
    if (err) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch courses' }
      });
    }
    
    res.json({
      items: courses,
      next_offset: courses.length === parseInt(limit) ? parseInt(offset) + parseInt(limit) : null
    });
  });
});

app.get('/api/courses/:id', authenticate, rateLimit, (req, res) => {
  db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, course) => {
    if (!course) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Course not found' }
      });
    }
    
    if (course.status !== 'published' && req.user.role === 'learner') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Course not available' }
      });
    }
    
    res.json(course);
  });
});

app.post('/api/courses', authenticate, requireRole('creator'), idempotency, rateLimit, (req, res) => {
  const { title, description } = req.body;
  
  if (!title) return errorResponse(res, 'FIELD_REQUIRED', 'Title is required', 'title');
  if (!description) return errorResponse(res, 'FIELD_REQUIRED', 'Description is required', 'description');
  
  db.run(
    'INSERT INTO courses (title, description, creator_id) VALUES (?, ?, ?)',
    [title, description, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to create course' }
        });
      }
      
      db.get('SELECT * FROM courses WHERE id = ?', [this.lastID], (err, course) => {
        res.json(course);
      });
    }
  );
});

app.put('/api/courses/:id', authenticate, requireRole('creator'), rateLimit, (req, res) => {
  const { title, description } = req.body;
  
  db.get('SELECT * FROM courses WHERE id = ? AND creator_id = ?',
    [req.params.id, req.user.id],
    (err, course) => {
      if (!course) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Course not found or unauthorized' }
        });
      }
      
      if (course.status !== 'draft') {
        return res.status(400).json({
          error: { code: 'INVALID_STATE', message: 'Can only edit draft courses' }
        });
      }
      
      db.run(
        'UPDATE courses SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, description, req.params.id],
        (err) => {
          if (err) {
            return res.status(500).json({
              error: { code: 'DATABASE_ERROR', message: 'Failed to update course' }
            });
          }
          
          db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, updated) => {
            res.json(updated);
          });
        }
      );
    }
  );
});

app.post('/api/courses/:id/submit', authenticate, requireRole('creator'), idempotency, rateLimit, (req, res) => {
  db.get('SELECT * FROM courses WHERE id = ? AND creator_id = ?',
    [req.params.id, req.user.id],
    (err, course) => {
      if (!course) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Course not found' }
        });
      }
      
      if (course.status !== 'draft') {
        return res.status(400).json({
          error: { code: 'INVALID_STATE', message: 'Course already submitted' }
        });
      }
      
      db.run('UPDATE courses SET status = ? WHERE id = ?', ['pending', req.params.id], (err) => {
        if (err) {
          return res.status(500).json({
            error: { code: 'DATABASE_ERROR', message: 'Failed to submit course' }
          });
        }
        
        res.json({ message: 'Course submitted for review' });
      });
    }
  );
});

// Lesson endpoints
app.get('/api/courses/:id/lessons', authenticate, rateLimit, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  db.all(
    'SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index LIMIT ? OFFSET ?',
    [req.params.id, parseInt(limit), parseInt(offset)],
    (err, lessons) => {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to fetch lessons' }
        });
      }
      
      res.json({
        items: lessons,
        next_offset: lessons.length === parseInt(limit) ? parseInt(offset) + parseInt(limit) : null
      });
    }
  );
});

app.post('/api/lessons/:id/complete', authenticate, requireRole('learner'), idempotency, rateLimit, (req, res) => {
  db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id], (err, lesson) => {
    if (!lesson) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lesson not found' }
      });
    }
    
    // Check enrollment
    db.get(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [req.user.id, lesson.course_id],
      (err, enrollment) => {
        if (!enrollment) {
          return res.status(403).json({
            error: { code: 'NOT_ENROLLED', message: 'Not enrolled in this course' }
          });
        }
        
        db.run(
          'INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id) VALUES (?, ?)',
          [req.user.id, req.params.id],
          (err) => {
            if (err) {
              return res.status(500).json({
                error: { code: 'DATABASE_ERROR', message: 'Failed to complete lesson' }
              });
            }
            
            // Check if all lessons completed
            db.get(
              `SELECT COUNT(*) as total FROM lessons WHERE course_id = ?`,
              [lesson.course_id],
              (err, totalResult) => {
                db.get(
                  `SELECT COUNT(*) as completed FROM lesson_completions lc
                   JOIN lessons l ON l.id = lc.lesson_id
                   WHERE lc.user_id = ? AND l.course_id = ?`,
                  [req.user.id, lesson.course_id],
                  (err, completedResult) => {
                    if (totalResult.total === completedResult.completed) {
                      // Issue certificate
                      const serialHash = crypto.createHash('sha256')
                        .update(`${req.user.id}-${lesson.course_id}-${Date.now()}`)
                        .digest('hex');
                      
                      db.run(
                        'INSERT OR IGNORE INTO certificates (user_id, course_id, serial_hash) VALUES (?, ?, ?)',
                        [req.user.id, lesson.course_id, serialHash]
                      );
                    }
                    
                    res.json({ message: 'Lesson completed' });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Enrollment endpoints
app.get('/api/enrollments', authenticate, rateLimit, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  db.all(
    'SELECT * FROM enrollments WHERE user_id = ? LIMIT ? OFFSET ?',
    [req.user.id, parseInt(limit), parseInt(offset)],
    (err, enrollments) => {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to fetch enrollments' }
        });
      }
      
      res.json({
        items: enrollments,
        next_offset: enrollments.length === parseInt(limit) ? parseInt(offset) + parseInt(limit) : null
      });
    }
  );
});

app.post('/api/enrollments', authenticate, requireRole('learner'), idempotency, rateLimit, (req, res) => {
  const { course_id } = req.body;
  
  if (!course_id) return errorResponse(res, 'FIELD_REQUIRED', 'Course ID is required', 'course_id');
  
  db.get('SELECT * FROM courses WHERE id = ? AND status = ?', [course_id, 'published'], (err, course) => {
    if (!course) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Course not found or not published' }
      });
    }
    
    db.run(
      'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [req.user.id, course_id],
      function(err) {
        if (err) {
          return res.status(500).json({
            error: { code: 'DATABASE_ERROR', message: 'Failed to enroll' }
          });
        }
        
        res.json({ message: 'Enrolled successfully', course_id });
      }
    );
  });
});

// Progress endpoint
app.get('/api/progress', authenticate, rateLimit, (req, res) => {
  db.all(
    `SELECT 
      e.course_id,
      COUNT(DISTINCT l.id) as total_lessons,
      COUNT(DISTINCT lc.lesson_id) as completed_lessons,
      CAST(COUNT(DISTINCT lc.lesson_id) * 100.0 / COUNT(DISTINCT l.id) AS INTEGER) as progress_percentage,
      c.serial_hash,
      CASE WHEN c.serial_hash IS NOT NULL THEN '/api/certificates/' || c.serial_hash ELSE NULL END as certificate_url,
      GROUP_CONCAT(lc.lesson_id) as completed_lessons_ids
     FROM enrollments e
     JOIN lessons l ON l.course_id = e.course_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.user_id = e.user_id
     LEFT JOIN certificates c ON c.course_id = e.course_id AND c.user_id = e.user_id
     WHERE e.user_id = ?
     GROUP BY e.course_id`,
    [req.user.id],
    (err, progress) => {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to fetch progress' }
        });
      }
      
      const formatted = progress.map(p => ({
        course_id: p.course_id,
        total_lessons: p.total_lessons,
        completed_lessons: p.completed_lessons_ids ? p.completed_lessons_ids.split(',').map(Number) : [],
        progress_percentage: p.progress_percentage,
        certificate_url: p.certificate_url
      }));
      
      res.json({ items: formatted });
    }
  );
});

// Creator endpoints
app.get('/api/creator/courses', authenticate, requireRole('creator'), rateLimit, (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  db.all(
    'SELECT * FROM courses WHERE creator_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [req.user.id, parseInt(limit), parseInt(offset)],
    (err, courses) => {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to fetch courses' }
        });
      }
      
      res.json({
        items: courses,
        next_offset: courses.length === parseInt(limit) ? parseInt(offset) + parseInt(limit) : null
      });
    }
  );
});

// Admin endpoints
app.get('/api/admin/courses', authenticate, requireRole('admin'), rateLimit, (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM courses WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, courses) => {
    if (err) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch courses' }
      });
    }
    
    res.json({
      items: courses,
      next_offset: courses.length === parseInt(limit) ? parseInt(offset) + parseInt(limit) : null
    });
  });
});

app.post('/api/admin/courses/:id/review', authenticate, requireRole('admin'), idempotency, rateLimit, (req, res) => {
  const { status } = req.body;
  
  if (!['published', 'rejected'].includes(status)) {
    return errorResponse(res, 'INVALID_VALUE', 'Status must be published or rejected', 'status');
  }
  
  db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, course) => {
    if (!course) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Course not found' }
      });
    }
    
    if (course.status !== 'pending') {
      return res.status(400).json({
        error: { code: 'INVALID_STATE', message: 'Course is not pending review' }
      });
    }
    
    db.run('UPDATE courses SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
      if (err) {
        return res.status(500).json({
          error: { code: 'DATABASE_ERROR', message: 'Failed to review course' }
        });
      }
      
      res.json({ message: `Course ${status}` });
    });
  });
});
app.use(express.static('public'));
// Start server
app.listen(PORT, () => {
  console.log(`MicroCourses API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});