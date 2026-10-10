<?php
// Non-secret installation fixtures, bundled for Git deployment.
return [
'schema' => <<<'ACADEMY_SCHEMA'
CREATE TABLE IF NOT EXISTS academy_users (
 id VARCHAR(64) PRIMARY KEY,
 name VARCHAR(150) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('student','admin') NOT NULL DEFAULT 'student',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS academy_courses (
 id VARCHAR(64) PRIMARY KEY,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS academy_enrollments (
 user_id VARCHAR(64) NOT NULL,
 course_id VARCHAR(64) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,course_id),
 FOREIGN KEY(user_id) REFERENCES academy_users(id) ON DELETE CASCADE,
 FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS academy_exam_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL,
 course_id VARCHAR(64) NOT NULL,
 score INT NOT NULL,
 total INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES academy_users(id) ON DELETE CASCADE,
 FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS academy_login_limits (
 throttle_key CHAR(64) PRIMARY KEY,
 attempts INT NOT NULL,
 updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ACADEMY_SCHEMA,
'courses' => json_decode(<<<'ACADEMY_COURSES'
[
  {
    "id": "design",
    "title": "The fundamentals of UI design",
    "category": "Design",
    "level": "Beginner",
    "price": 49,
    "instructor": "Sarah Mitchell",
    "description": "Turn your ideas into intuitive digital experiences. Learn visual hierarchy, typography, and the principles behind interfaces people love.",
    "color": "#e9e9e6",
    "art": "design",
    "duration": "8 hours",
    "lessons": [
      {
        "title": "Seeing like a designer",
        "video": "",
        "notes": "Welcome! Start by observing the interfaces you use every day. Identify hierarchy, spacing, and contrast.",
        "files": []
      }
    ],
    "exam": [
      {
        "question": "What helps establish visual hierarchy?",
        "options": [
          "Contrast and scale",
          "Using every color",
          "Removing all spacing"
        ],
        "answer": 0
      }
    ]
  },
  {
    "id": "code",
    "title": "Python for curious minds",
    "category": "Technology",
    "level": "Beginner",
    "price": 39,
    "instructor": "Omar Hassan",
    "description": "Build a practical foundation in programming, one small project at a time. No previous experience needed.",
    "color": "#e4e8e6",
    "art": "code",
    "duration": "12 hours",
    "lessons": [
      {
        "title": "Your first lines of Python",
        "video": "",
        "notes": "Python uses print() to display text. Try print(\"Hello, world!\") in a Python interpreter.",
        "files": []
      }
    ],
    "exam": [
      {
        "question": "Which function displays output in Python?",
        "options": [
          "print()",
          "show()",
          "echo()"
        ],
        "answer": 0
      }
    ]
  },
  {
    "id": "business",
    "title": "Build a business that lasts",
    "category": "Business",
    "level": "All levels",
    "price": 59,
    "instructor": "Daniel Brooks",
    "description": "From finding your audience to shaping your first offer, develop the confidence to start something of your own.",
    "color": "#ede8e0",
    "art": "business",
    "duration": "6 hours",
    "lessons": [
      {
        "title": "Start with a real problem",
        "video": "",
        "notes": "Interview potential customers before designing your solution. Listen for repeated problems.",
        "files": []
      }
    ],
    "exam": [
      {
        "question": "What should you validate first?",
        "options": [
          "Customer needs",
          "Your logo",
          "Office furniture"
        ],
        "answer": 0
      }
    ]
  },
  {
    "id": "photo",
    "title": "Photography beyond the basics",
    "category": "Creative",
    "level": "Intermediate",
    "price": 45,
    "instructor": "Lina Ahmed",
    "description": "Find your perspective. Master light, composition, and storytelling to create photographs with intention.",
    "color": "#e6e6e8",
    "art": "photo",
    "duration": "10 hours",
    "lessons": [
      {
        "title": "Learning to read light",
        "video": "",
        "notes": "Compare soft window light with direct sunlight. Notice how shadows change the mood.",
        "files": []
      }
    ],
    "exam": [
      {
        "question": "Which produces softer shadows?",
        "options": [
          "A large diffused light source",
          "A small direct light",
          "No light"
        ],
        "answer": 0
      }
    ]
  }
]
ACADEMY_COURSES, true, 512, JSON_THROW_ON_ERROR),
];
