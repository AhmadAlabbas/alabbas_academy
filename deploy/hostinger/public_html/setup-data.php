<?php
// Non-secret sample content and original fixtures for safe upgrades.
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
    "color": "#e6f5fb",
    "art": "design",
    "duration": "Self-paced",
    "lessons": [
      {
        "title": "Watch: Figma and interface design",
        "video": "https://www.youtube.com/watch?v=c9Wg6Cb_YlU",
        "notes": "Follow the public Figma tutorial, then identify the navigation, main call to action, and supporting information in an interface.\n\nFocus on hierarchy, consistent spacing, readable type, and contrast. The video is third-party educational material; Alabbas Academy does not own it.",
        "source": "freeCodeCamp.org",
        "files": []
      },
      {
        "title": "Practice: design your first course card",
        "video": "",
        "notes": "Create a course card with a title, category, price in SAR, and one clear action. Use an 8-pixel spacing system. Write down why your main action stands out.",
        "files": [
          {
            "name": "design-practice.txt",
            "data": "data:text/plain;base64,Q3JlYXRlIGEgY291cnNlIGNhcmQgd2l0aCBhIHRpdGxlLCBjYXRlZ29yeSwgcHJpY2UgaW4gU0FSLCBhbmQgb25lIGNsZWFyIGFjdGlvbi4gVXNlIGFuIDgtcGl4ZWwgc3BhY2luZyBzeXN0ZW0uIFdyaXRlIGRvd24gd2h5IHlvdXIgbWFpbiBhY3Rpb24gc3RhbmRzIG91dC4KClJlZmxlY3Rpb246IFdoYXQgZGlkIHlvdSBsZWFybj8gV2hhdCB3aWxsIHlvdSB0cnkgbmV4dD8K"
          }
        ]
      }
    ],
    "exam": [
      {
        "question": "What is the main purpose of visual hierarchy?",
        "options": [
          "Make everything equally prominent",
          "Guide attention to the most important information",
          "Use as many font sizes as possible"
        ],
        "answer": 1,
        "explanation": "Hierarchy helps people understand what matters first."
      },
      {
        "question": "Which is the best starting point for readable body text?",
        "options": [
          "Clear type with sufficient contrast",
          "Light gray text on a white background",
          "All text in uppercase"
        ],
        "answer": 0,
        "explanation": "Readable type and adequate contrast make content easier to use."
      },
      {
        "question": "What does a consistent spacing system improve?",
        "options": [
          "Video resolution",
          "Payment processing",
          "Visual rhythm and alignment"
        ],
        "answer": 2,
        "explanation": "Repeated spacing values create predictable relationships between elements."
      },
      {
        "question": "A course card should primarily help someone…",
        "options": [
          "Choose whether to explore the course",
          "Find every lesson transcript",
          "Change the website settings"
        ],
        "answer": 0,
        "explanation": "A card gives enough context for a useful next decision."
      },
      {
        "question": "How should a primary action differ from secondary actions?",
        "options": [
          "It should be hidden",
          "It should be visually more prominent",
          "It should have the smallest text"
        ],
        "answer": 1,
        "explanation": "A prominent primary action makes the next step clear."
      }
    ],
    "preview": "https://www.youtube.com/watch?v=c9Wg6Cb_YlU",
    "sample": true
  },
  {
    "id": "code",
    "title": "Python for curious minds",
    "category": "Technology",
    "level": "Beginner",
    "price": 39,
    "instructor": "Omar Hassan",
    "description": "Build a practical foundation in programming, one small project at a time. No previous experience needed.",
    "color": "#eaf0fb",
    "art": "code",
    "duration": "Self-paced",
    "lessons": [
      {
        "title": "Watch: Python for beginners",
        "video": "https://www.youtube.com/watch?v=rfscVS0vtbw",
        "notes": "Explore the beginner Python tutorial. Start with variables, strings, numbers, print(), and basic conditions.\n\nTry the examples in a local Python interpreter or an online Python playground. Pause the video and write code yourself rather than only watching.",
        "source": "freeCodeCamp.org · Mike Dane",
        "files": []
      },
      {
        "title": "Practice: build a simple course-price calculator",
        "video": "",
        "notes": "Create a variable named price with value 49. Create a variable named quantity with value 2. Print the total price and the text SAR. Add a condition that prints “Discount available” when the total is at least 100.",
        "files": [
          {
            "name": "code-practice.txt",
            "data": "data:text/plain;base64,Q3JlYXRlIGEgdmFyaWFibGUgbmFtZWQgcHJpY2Ugd2l0aCB2YWx1ZSA0OS4gQ3JlYXRlIGEgdmFyaWFibGUgbmFtZWQgcXVhbnRpdHkgd2l0aCB2YWx1ZSAyLiBQcmludCB0aGUgdG90YWwgcHJpY2UgYW5kIHRoZSB0ZXh0IFNBUi4gQWRkIGEgY29uZGl0aW9uIHRoYXQgcHJpbnRzIOKAnERpc2NvdW50IGF2YWlsYWJsZeKAnSB3aGVuIHRoZSB0b3RhbCBpcyBhdCBsZWFzdCAxMDAuCgpSZWZsZWN0aW9uOiBXaGF0IGRpZCB5b3UgbGVhcm4/IFdoYXQgd2lsbCB5b3UgdHJ5IG5leHQ/Cg=="
          }
        ]
      }
    ],
    "exam": [
      {
        "question": "Which function displays output in Python?",
        "options": [
          "show()",
          "print()",
          "displayText()"
        ],
        "answer": 1,
        "explanation": "print() writes output to the console."
      },
      {
        "question": "Which value is a string?",
        "options": [
          "42",
          "True",
          "\"SAR\""
        ],
        "answer": 2,
        "explanation": "Text enclosed in quotes is a string."
      },
      {
        "question": "If price = 49 and quantity = 2, what is price * quantity?",
        "options": [
          "98",
          "492",
          "51"
        ],
        "answer": 0,
        "explanation": "The multiplication operator multiplies numeric values."
      },
      {
        "question": "What does an if statement do?",
        "options": [
          "Repeat code forever",
          "Import every library",
          "Run a block when a condition is true"
        ],
        "answer": 2,
        "explanation": "An if statement allows a program to make a conditional decision."
      },
      {
        "question": "Which comparison checks whether total is at least 100?",
        "options": [
          "total >= 100",
          "total = 100",
          "total < 100"
        ],
        "answer": 0,
        "explanation": ">= means greater than or equal to."
      }
    ],
    "preview": "https://www.youtube.com/watch?v=rfscVS0vtbw",
    "sample": true
  },
  {
    "id": "business",
    "title": "Build a business that lasts",
    "category": "Business",
    "level": "All levels",
    "price": 59,
    "instructor": "Daniel Brooks",
    "description": "From finding your audience to shaping your first offer, develop the confidence to start something of your own.",
    "color": "#fff3dc",
    "art": "business",
    "duration": "Self-paced",
    "lessons": [
      {
        "title": "Watch: the business model canvas",
        "video": "https://www.youtube.com/watch?v=IP0cUBWTgpY",
        "notes": "Watch the public Business Model Canvas introduction from Strategyzer. Identify your customer segment, value proposition, channels, and revenue streams.\n\nUse the canvas to describe assumptions, then choose which assumption to test first with real potential customers.",
        "source": "Strategyzer",
        "files": []
      },
      {
        "title": "Practice: map your first business idea",
        "video": "",
        "notes": "Draft a one-page business model for an online academy. Describe the customer, the problem, the offer, how customers will find it, the revenue stream, and the main costs. Write three open-ended questions for a customer interview.",
        "files": [
          {
            "name": "business-practice.txt",
            "data": "data:text/plain;base64,RHJhZnQgYSBvbmUtcGFnZSBidXNpbmVzcyBtb2RlbCBmb3IgYW4gb25saW5lIGFjYWRlbXkuIERlc2NyaWJlIHRoZSBjdXN0b21lciwgdGhlIHByb2JsZW0sIHRoZSBvZmZlciwgaG93IGN1c3RvbWVycyB3aWxsIGZpbmQgaXQsIHRoZSByZXZlbnVlIHN0cmVhbSwgYW5kIHRoZSBtYWluIGNvc3RzLiBXcml0ZSB0aHJlZSBvcGVuLWVuZGVkIHF1ZXN0aW9ucyBmb3IgYSBjdXN0b21lciBpbnRlcnZpZXcuCgpSZWZsZWN0aW9uOiBXaGF0IGRpZCB5b3UgbGVhcm4/IFdoYXQgd2lsbCB5b3UgdHJ5IG5leHQ/Cg=="
          }
        ]
      }
    ],
    "exam": [
      {
        "question": "What should you understand before building a product?",
        "options": [
          "Your customer’s problem",
          "The final logo animation",
          "The office layout"
        ],
        "answer": 0,
        "explanation": "A meaningful offer begins with understanding a real customer need."
      },
      {
        "question": "A value proposition describes…",
        "options": [
          "Your tax number",
          "The benefit you offer a specific customer",
          "Only the product price"
        ],
        "answer": 1,
        "explanation": "It explains why your offer is useful to a customer segment."
      },
      {
        "question": "Which is a revenue stream for a course academy?",
        "options": [
          "Video storage costs",
          "Instructor expenses",
          "Course enrollment fees"
        ],
        "answer": 2,
        "explanation": "A revenue stream describes how the business earns money."
      },
      {
        "question": "Which interview question is most useful for learning?",
        "options": [
          "Wouldn’t our product be perfect?",
          "Tell me about the last time you had this problem",
          "Do you like our logo?"
        ],
        "answer": 1,
        "explanation": "Specific past behavior gives stronger evidence than a leading question."
      },
      {
        "question": "Why test business assumptions early?",
        "options": [
          "To reduce uncertainty before investing heavily",
          "To avoid talking to customers",
          "To guarantee immediate success"
        ],
        "answer": 0,
        "explanation": "Testing helps you learn what needs to change before spending more."
      }
    ],
    "preview": "https://www.youtube.com/watch?v=IP0cUBWTgpY",
    "sample": true
  },
  {
    "id": "photo",
    "title": "Photography beyond the basics",
    "category": "Creative",
    "level": "Intermediate",
    "price": 45,
    "instructor": "Lina Ahmed",
    "description": "Find your perspective. Master light, composition, and storytelling to create photographs with intention.",
    "color": "#f0effb",
    "art": "photo",
    "duration": "Self-paced",
    "lessons": [
      {
        "title": "Watch: photography fundamentals",
        "video": "https://www.youtube.com/watch?v=LxO-6rlihSg",
        "notes": "Use the public photography video as a starting point, then practice composition, exposure, and noticing light.\n\nCompare an image taken in direct sunlight with one taken near a window. Look at shadow edges, background distractions, and the subject’s position.",
        "source": "YouTube educational reference",
        "files": []
      },
      {
        "title": "Practice: tell a story with three photographs",
        "video": "",
        "notes": "Photograph the same subject with soft window light, outdoors in shade, and in direct sunlight. Choose your strongest image and explain how lighting and composition changed the result. A phone camera is enough for this exercise.",
        "files": [
          {
            "name": "photo-practice.txt",
            "data": "data:text/plain;base64,UGhvdG9ncmFwaCB0aGUgc2FtZSBzdWJqZWN0IHdpdGggc29mdCB3aW5kb3cgbGlnaHQsIG91dGRvb3JzIGluIHNoYWRlLCBhbmQgaW4gZGlyZWN0IHN1bmxpZ2h0LiBDaG9vc2UgeW91ciBzdHJvbmdlc3QgaW1hZ2UgYW5kIGV4cGxhaW4gaG93IGxpZ2h0aW5nIGFuZCBjb21wb3NpdGlvbiBjaGFuZ2VkIHRoZSByZXN1bHQuIEEgcGhvbmUgY2FtZXJhIGlzIGVub3VnaCBmb3IgdGhpcyBleGVyY2lzZS4KClJlZmxlY3Rpb246IFdoYXQgZGlkIHlvdSBsZWFybj8gV2hhdCB3aWxsIHlvdSB0cnkgbmV4dD8K"
          }
        ]
      }
    ],
    "exam": [
      {
        "question": "Which generally produces softer shadows?",
        "options": [
          "A small direct light",
          "A large diffused light source",
          "No light at all"
        ],
        "answer": 1,
        "explanation": "A larger apparent light source spreads light and softens shadow edges."
      },
      {
        "question": "What does shutter speed primarily control?",
        "options": [
          "How long the camera gathers light",
          "The subject’s color",
          "The lens focal length"
        ],
        "answer": 0,
        "explanation": "A longer exposure records more light and can introduce motion blur."
      },
      {
        "question": "The rule of thirds suggests…",
        "options": [
          "Always placing the subject at the center",
          "Using exactly three colors",
          "Placing important elements near third lines or intersections"
        ],
        "answer": 2,
        "explanation": "The grid can help arrange a balanced, intentional composition."
      },
      {
        "question": "Why check the background before taking a photo?",
        "options": [
          "To increase the file size",
          "To avoid distracting elements",
          "To disable exposure"
        ],
        "answer": 1,
        "explanation": "A clean or intentional background helps attention stay on the subject."
      },
      {
        "question": "What is the most effective way to improve your photography?",
        "options": [
          "Buy every lens first",
          "Use the same settings forever",
          "Practice, compare results, and explain your choices"
        ],
        "answer": 2,
        "explanation": "Deliberate practice helps you understand the effects of your decisions."
      }
    ],
    "preview": "https://www.youtube.com/watch?v=LxO-6rlihSg",
    "sample": true
  }
]
ACADEMY_COURSES, true, 512, JSON_THROW_ON_ERROR),
'legacy' => json_decode(<<<'ACADEMY_LEGACY'
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
ACADEMY_LEGACY, true, 512, JSON_THROW_ON_ERROR),
];
