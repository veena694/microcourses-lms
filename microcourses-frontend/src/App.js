import React, { useState, useEffect } from 'react';
import { Book, User, CheckCircle, Clock, Award, Users, FileText, AlertCircle } from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:3000/api';

// Utility function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

// Login/Register Component
const AuthForm = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'learner'
  });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;
      
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.error?.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Book className="w-12 h-12 text-indigo-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-900">MicroCourses LMS</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded ${isLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded ${!isLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
              >
                <option value="learner">Learner</option>
                <option value="creator">Creator</option>
              </select>
            </>
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
          />
          
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
          />

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>Test Credentials:</p>
          <p>Admin: admin@test.com / admin123</p>
          <p>Creator: creator@test.com / creator123</p>
          <p>Learner: learner@test.com / learner123</p>
        </div>
      </div>
    </div>
  );
};

// Learner Dashboard
const LearnerDashboard = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    loadCourses();
    loadEnrollments();
    loadProgress();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await apiCall('/courses?status=published');
      setCourses(data.items || data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const loadEnrollments = async () => {
    try {
      const data = await apiCall('/enrollments');
      setEnrollments(data.items || data);
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    }
  };

  const loadProgress = async () => {
    try {
      const data = await apiCall('/progress');
      const progressMap = {};
      (data.items || data).forEach(p => {
        progressMap[p.course_id] = p;
      });
      setProgress(progressMap);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const enrollInCourse = async (courseId) => {
    try {
      await apiCall('/enrollments', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId })
      });
      loadEnrollments();
      loadProgress();
    } catch (err) {
      alert(err.error?.message || 'Failed to enroll');
    }
  };

  const viewCourse = async (courseId) => {
    try {
      const course = await apiCall(`/courses/${courseId}`);
      const lessons = await apiCall(`/courses/${courseId}/lessons`);
      setSelectedCourse({ ...course, lessons: lessons.items || lessons });
    } catch (err) {
      console.error('Failed to load course:', err);
    }
  };

  const startLesson = async (lesson) => {
    setCurrentLesson(lesson);
  };

  const completeLesson = async () => {
    try {
      await apiCall(`/lessons/${currentLesson.id}/complete`, {
        method: 'POST'
      });
      alert('Lesson completed!');
      setCurrentLesson(null);
      loadProgress();
      if (selectedCourse) {
        viewCourse(selectedCourse.id);
      }
    } catch (err) {
      alert(err.error?.message || 'Failed to complete lesson');
    }
  };

  const isEnrolled = (courseId) => {
    return enrollments.some(e => e.course_id === courseId);
  };

  if (currentLesson) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <button
            onClick={() => setCurrentLesson(null)}
            className="mb-4 text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Course
          </button>
          
          <h1 className="text-3xl font-bold mb-4">{currentLesson.title}</h1>
          
          <div className="prose max-w-none mb-6">
            <p className="text-gray-700 whitespace-pre-wrap">{currentLesson.content}</p>
          </div>

          {currentLesson.video_url && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Video Content</h3>
              <div className="bg-gray-100 p-4 rounded">
                <p className="text-sm text-gray-600">Video: {currentLesson.video_url}</p>
              </div>
            </div>
          )}

          {currentLesson.transcript && (
            <div className="mb-6 bg-gray-50 p-4 rounded">
              <h3 className="font-semibold mb-2">Transcript</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentLesson.transcript}</p>
            </div>
          )}

          <button
            onClick={completeLesson}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Mark as Complete
          </button>
        </div>
      </div>
    );
  }

  if (selectedCourse) {
    const courseProgress = progress[selectedCourse.id];
    const completedLessons = courseProgress?.completed_lessons || [];
    
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedCourse(null)}
            className="mb-4 text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Courses
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h1 className="text-3xl font-bold mb-2">{selectedCourse.title}</h1>
            <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
            
            {courseProgress && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-gray-600">{courseProgress.progress_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full"
                    style={{ width: `${courseProgress.progress_percentage}%` }}
                  />
                </div>
              </div>
            )}

            {courseProgress?.progress_percentage === 100 && courseProgress.certificate_url && (
              <div className="bg-green-50 border border-green-200 rounded p-4 flex items-center gap-3">
                <Award className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Certificate Available!</p>
                  <a
                    href={courseProgress.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline text-sm"
                  >
                    View Certificate
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Lessons</h2>
            {selectedCourse.lessons?.map((lesson, idx) => (
              <div
                key={lesson.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-sm font-medium">
                        Lesson {lesson.order_index}
                      </span>
                      {completedLessons.includes(lesson.id) && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{lesson.title}</h3>
                    <p className="text-gray-600 text-sm">{lesson.content?.substring(0, 100)}...</p>
                  </div>
                  <button
                    onClick={() => startLesson(lesson)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 ml-4"
                  >
                    {completedLessons.includes(lesson.id) ? 'Review' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Available Courses</h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const enrolled = isEnrolled(course.id);
            const courseProgress = progress[course.id];
            
            return (
              <div key={course.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{course.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                  
                  {enrolled && courseProgress && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${courseProgress.progress_percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {courseProgress.progress_percentage}% complete
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!enrolled ? (
                      <button
                        onClick={() => enrollInCourse(course.id)}
                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                      >
                        Enroll
                      </button>
                    ) : (
                      <button
                        onClick={() => viewCourse(course.id)}
                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                      >
                        Continue Learning
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Creator Dashboard
const CreatorDashboard = ({ user }) => {
  const [courses, setCourses] = useState([]);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '' });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await apiCall('/creator/courses');
      setCourses(data.items || data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingCourse) {
        await apiCall(`/courses/${editingCourse.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await apiCall('/courses', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowCourseForm(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '' });
      loadCourses();
    } catch (err) {
      alert(err.error?.message || 'Failed to save course');
    }
  };

  const submitForReview = async (courseId) => {
    try {
      await apiCall(`/courses/${courseId}/submit`, {
        method: 'POST'
      });
      loadCourses();
      alert('Course submitted for review!');
    } catch (err) {
      alert(err.error?.message || 'Failed to submit course');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Courses</h1>
          <button
            onClick={() => setShowCourseForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Create Course
          </button>
        </div>

        {showCourseForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">
              {editingCourse ? 'Edit Course' : 'New Course'}
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Course Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Course Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500 h-32"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowCourseForm(false);
                    setEditingCourse(null);
                    setFormData({ title: '', description: '' });
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {courses.map(course => (
            <div key={course.id} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{course.title}</h3>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    course.status === 'published' ? 'bg-green-100 text-green-800' :
                    course.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {course.status}
                  </span>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">{course.description}</p>
              
              <div className="flex gap-2">
                {course.status === 'draft' && (
                  <>
                    <button
                      onClick={() => {
                        setEditingCourse(course);
                        setFormData({ title: course.title, description: course.description });
                        setShowCourseForm(true);
                      }}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => submitForReview(course.id)}
                      className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                    >
                      Submit for Review
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    loadPendingCourses();
  }, []);

  const loadPendingCourses = async () => {
    try {
      const data = await apiCall('/admin/courses?status=pending');
      setCourses(data.items || data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const reviewCourse = async (courseId, status) => {
    try {
      await apiCall(`/admin/courses/${courseId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      loadPendingCourses();
      alert(`Course ${status}!`);
    } catch (err) {
      alert(err.error?.message || 'Failed to review course');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Pending Course Reviews</h1>
        
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course.id} className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-2">{course.title}</h3>
              <p className="text-gray-600 mb-4">{course.description}</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => reviewCourse(course.id, 'published')}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => reviewCourse(course.id, 'rejected')}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          
          {courses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No pending courses to review
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <AuthForm onLogin={setUser} />;
  }

  return (
    <div>
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Book className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-lg">MicroCourses</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name} ({user.role})
            </span>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {user.role === 'learner' && <LearnerDashboard user={user} />}
      {user.role === 'creator' && <CreatorDashboard user={user} />}
      {user.role === 'admin' && <AdminDashboard />}
    </div>
  );
}