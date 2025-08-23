// course-service/scripts/seedData.js
const mongoose = require('mongoose');

// Define schemas directly (since we can't import TypeScript models)
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  courseCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const LessonSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true },
  order: { type: Number, required: true },
  description: String,
  resources: [String]
});

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: { type: String, required: true },
  instructor: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    avatar: String
  },
  category: { type: String, required: true, index: true },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    required: true 
  },
  duration: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  videoUrl: String,
  materials: [String],
  lessons: [LessonSchema],
  requirements: [String],
  tags: [{ type: String, index: true }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  enrolledCount: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false }
}, {
  timestamps: true
});

const Course = mongoose.model('Course', CourseSchema);
const Category = mongoose.model('Category', CategorySchema);

// Sample data
const sampleCategories = [
  {
    name: 'Web Development',
    description: 'Learn modern web development technologies and frameworks',
    icon: '🌐',
    courseCount: 0,
    isActive: true
  },
  {
    name: 'Data Science',
    description: 'Master data analysis, machine learning, and AI',
    icon: '📊',
    courseCount: 0,
    isActive: true
  },
  {
    name: 'Mobile Development',
    description: 'Build mobile apps for iOS and Android platforms',
    icon: '📱',
    courseCount: 0,
    isActive: true
  },
  {
    name: 'DevOps',
    description: 'Learn deployment, CI/CD, and infrastructure management',
    icon: '⚙️',
    courseCount: 0,
    isActive: true
  },
  {
    name: 'Design',
    description: 'UI/UX design principles and modern design tools',
    icon: '🎨',
    courseCount: 0,
    isActive: true
  },
  {
    name: 'Cybersecurity',
    description: 'Protect systems and data from digital attacks',
    icon: '🔒',
    courseCount: 0,
    isActive: true
  }
];

const sampleCourses = [
  {
    title: 'Complete React Development Bootcamp',
    description: 'Master React.js from basics to advanced concepts. Learn hooks, context API, Redux, and build real-world applications with modern React patterns.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345a',
      name: 'Sarah Johnson',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b2a88bc0?w=150&h=150&fit=crop&crop=face'
    },
    category: 'Web Development',
    difficulty: 'intermediate',
    duration: 2400,
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-react.mp4',
    materials: [
      'Source code repository',
      'Project templates',
      'Cheat sheets',
      'Additional resources'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Introduction to React',
        videoUrl: 'https://example.com/react-intro.mp4',
        duration: 45,
        order: 1,
        description: 'Learn what React is and why it\'s popular',
        resources: ['React documentation', 'Setup guide']
      },
      {
        id: 'lesson-2',
        title: 'JSX and Components',
        videoUrl: 'https://example.com/react-jsx.mp4',
        duration: 60,
        order: 2,
        description: 'Understanding JSX syntax and creating components',
        resources: ['JSX cheat sheet', 'Component examples']
      },
      {
        id: 'lesson-3',
        title: 'State and Props',
        videoUrl: 'https://example.com/react-state.mp4',
        duration: 75,
        order: 3,
        description: 'Managing component state and passing data with props',
        resources: ['State management guide']
      }
    ],
    requirements: [
      'Basic JavaScript knowledge',
      'HTML and CSS fundamentals',
      'Node.js installed'
    ],
    tags: ['React', 'JavaScript', 'Frontend', 'Web Development'],
    rating: 4.8,
    ratingCount: 1247,
    enrolledCount: 3421,
    price: 89.99,
    isPublished: true
  },
  {
    title: 'Python Data Science Masterclass',
    description: 'Complete guide to data science with Python. Learn pandas, numpy, matplotlib, seaborn, and machine learning with scikit-learn.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345b',
      name: 'Dr. Michael Chen',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    category: 'Data Science',
    difficulty: 'beginner',
    duration: 3000,
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-datascience.mp4',
    materials: [
      'Jupyter notebooks',
      'Sample datasets',
      'Python scripts',
      'Reference materials'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Python Basics for Data Science',
        videoUrl: 'https://example.com/python-basics.mp4',
        duration: 90,
        order: 1,
        description: 'Essential Python concepts for data analysis',
        resources: ['Python cheat sheet']
      },
      {
        id: 'lesson-2',
        title: 'Introduction to Pandas',
        videoUrl: 'https://example.com/pandas-intro.mp4',
        duration: 120,
        order: 2,
        description: 'Data manipulation with pandas library',
        resources: ['Pandas documentation', 'Sample CSV files']
      }
    ],
    requirements: [
      'Basic programming knowledge helpful but not required',
      'Python 3.x installed',
      'Jupyter Notebook or Google Colab access'
    ],
    tags: ['Python', 'Data Science', 'Machine Learning', 'Analytics'],
    rating: 4.9,
    ratingCount: 892,
    enrolledCount: 2156,
    price: 79.99,
    isPublished: true
  },
  {
    title: 'iOS App Development with Swift',
    description: 'Build native iOS applications using Swift and Xcode. Learn UI development, data persistence, networking, and publish to the App Store.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345c',
      name: 'Emma Rodriguez',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
    },
    category: 'Mobile Development',
    difficulty: 'intermediate',
    duration: 2700,
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-ios.mp4',
    materials: [
      'Xcode project files',
      'Swift playgrounds',
      'UI design templates',
      'App Store submission guide'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Swift Programming Fundamentals',
        videoUrl: 'https://example.com/swift-basics.mp4',
        duration: 105,
        order: 1,
        description: 'Learn Swift syntax and programming concepts',
        resources: ['Swift documentation']
      },
      {
        id: 'lesson-2',
        title: 'Building Your First iOS App',
        videoUrl: 'https://example.com/first-ios-app.mp4',
        duration: 135,
        order: 2,
        description: 'Create a simple iOS application from scratch',
        resources: ['Xcode tutorial', 'Project template']
      }
    ],
    requirements: [
      'macOS with Xcode installed',
      'Basic programming knowledge',
      'Apple Developer Account (for device testing)'
    ],
    tags: ['iOS', 'Swift', 'Mobile', 'Xcode'],
    rating: 4.7,
    ratingCount: 654,
    enrolledCount: 1789,
    price: 99.99,
    isPublished: true
  },
  {
    title: 'Docker and Kubernetes DevOps',
    description: 'Master containerization with Docker and orchestration with Kubernetes. Learn deployment strategies, monitoring, and scaling applications.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345d',
      name: 'James Wilson',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    category: 'DevOps',
    difficulty: 'advanced',
    duration: 2100,
    thumbnail: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-devops.mp4',
    materials: [
      'Docker configuration files',
      'Kubernetes manifests',
      'CI/CD pipeline templates',
      'Monitoring dashboards'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Docker Fundamentals',
        videoUrl: 'https://example.com/docker-basics.mp4',
        duration: 90,
        order: 1,
        description: 'Understanding containers and Docker basics',
        resources: ['Docker documentation']
      },
      {
        id: 'lesson-2',
        title: 'Kubernetes Introduction',
        videoUrl: 'https://example.com/k8s-intro.mp4',
        duration: 120,
        order: 2,
        description: 'Container orchestration with Kubernetes',
        resources: ['Kubernetes cheat sheet']
      }
    ],
    requirements: [
      'Linux command line experience',
      'Basic networking knowledge',
      'Understanding of web applications'
    ],
    tags: ['Docker', 'Kubernetes', 'DevOps', 'Containerization'],
    rating: 4.6,
    ratingCount: 423,
    enrolledCount: 987,
    price: 109.99,
    isPublished: true
  },
  {
    title: 'UI/UX Design Complete Course',
    description: 'Learn user interface and user experience design principles. Master Figma, Adobe XD, and create stunning digital experiences.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345e',
      name: 'Lisa Park',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b2b6bc0?w=150&h=150&fit=crop&crop=face'
    },
    category: 'Design',
    difficulty: 'beginner',
    duration: 1800,
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-design.mp4',
    materials: [
      'Figma design files',
      'UI component library',
      'Design system templates',
      'Color palette guides'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Design Principles and Theory',
        videoUrl: 'https://example.com/design-theory.mp4',
        duration: 75,
        order: 1,
        description: 'Fundamental design principles and color theory',
        resources: ['Design principles guide']
      },
      {
        id: 'lesson-2',
        title: 'Getting Started with Figma',
        videoUrl: 'https://example.com/figma-basics.mp4',
        duration: 90,
        order: 2,
        description: 'Learn the basics of Figma design tool',
        resources: ['Figma tutorial']
      }
    ],
    requirements: [
      'No prior design experience needed',
      'Computer with internet access',
      'Figma account (free tier available)'
    ],
    tags: ['UI Design', 'UX Design', 'Figma', 'Adobe XD'],
    rating: 4.8,
    ratingCount: 1156,
    enrolledCount: 2743,
    price: 69.99,
    isPublished: true
  },
  {
    title: 'Ethical Hacking and Penetration Testing',
    description: 'Learn cybersecurity fundamentals and ethical hacking techniques. Understand vulnerabilities, security testing, and protection strategies.',
    instructor: {
      id: '64a1b2c3d4e5f6789012345f',
      name: 'Alex Thompson',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face'
    },
    category: 'Cybersecurity',
    difficulty: 'intermediate',
    duration: 2250,
    thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=450&fit=crop',
    videoUrl: 'https://example.com/intro-security.mp4',
    materials: [
      'Virtual lab environments',
      'Security tools collection',
      'Practice scenarios',
      'Legal guidelines'
    ],
    lessons: [
      {
        id: 'lesson-1',
        title: 'Introduction to Cybersecurity',
        videoUrl: 'https://example.com/cybersec-intro.mp4',
        duration: 85,
        order: 1,
        description: 'Understanding cybersecurity landscape and threats',
        resources: ['Security frameworks guide']
      },
      {
        id: 'lesson-2',
        title: 'Network Security Fundamentals',
        videoUrl: 'https://example.com/network-security.mp4',
        duration: 110,
        order: 2,
        description: 'Securing network infrastructure and protocols',
        resources: ['Network security checklist']
      }
    ],
    requirements: [
      'Basic networking knowledge',
      'Understanding of operating systems',
      'Ethical mindset and legal compliance'
    ],
    tags: ['Cybersecurity', 'Ethical Hacking', 'Penetration Testing', 'Security'],
    rating: 4.7,
    ratingCount: 578,
    enrolledCount: 1432,
    price: 119.99,
    isPublished: true
  }
];

async function seedData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/edustream-courses?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await Course.deleteMany({});
    await Category.deleteMany({});

    // Insert categories
    console.log('Inserting categories...');
    const insertedCategories = await Category.insertMany(sampleCategories);
    console.log(`Inserted ${insertedCategories.length} categories`);

    // Insert courses
    console.log('Inserting courses...');
    const insertedCourses = await Course.insertMany(sampleCourses);
    console.log(`Inserted ${insertedCourses.length} courses`);

    // Update category course counts
    console.log('Updating category course counts...');
    for (const category of insertedCategories) {
      const courseCount = await Course.countDocuments({ 
        category: category.name, 
        isPublished: true 
      });
      await Category.findByIdAndUpdate(category._id, { courseCount });
    }

    console.log('✅ Sample data seeded successfully!');
    
    // Print summary
    const totalCourses = await Course.countDocuments();
    const totalCategories = await Category.countDocuments();
    console.log(`\n📊 Summary:`);
    console.log(`- Categories: ${totalCategories}`);
    console.log(`- Courses: ${totalCourses}`);
    console.log(`- Total enrolled students: ${sampleCourses.reduce((sum, course) => sum + course.enrolledCount, 0)}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

seedData();