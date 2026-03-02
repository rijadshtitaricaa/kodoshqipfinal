// Pjesa e Rijadit
class CourseProgress {
    constructor() {
        this.user = this.getCurrentUser();
        this.serverUrl = window.BACKEND_URL || 'http://localhost:3000';
    }

    getCurrentUser() {
        const userData = localStorage.getItem('loggedInUser');
        return userData ? JSON.parse(userData) : null;
    }

    async saveCourseProgress(courseName, completedLessons, totalLessons, points = 0) {
        if (!this.user) {
            console.log('❌ User not logged in');
            return false;
        }
  
        try {
            const payload = {
                email: this.user.email,
                course_name: courseName,
                completed_lessons: completedLessons,
                total_lessons: totalLessons,
                points: points
            };
            
            console.log('📤 Sending progress:', payload);
            
            const res = await fetch(`${this.serverUrl}/save-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log('✅ Progress saved:', data);
            return data;
        } catch (err) {
            console.error('❌ Error saving progress:', err);
            return false;
        }
    }

    async getCourseProgress(courseName) {
        if (!this.user) {
            return null;
        }

        try {
            const res = await fetch(`${this.serverUrl}/progress/${this.user.email}/${courseName}`);
            if (!res.ok) {
                throw new Error('Failed to fetch progress');
            }
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Error fetching progress:', err);
            return null;
        }
    }

    // Get all courses progress
    async getAllCoursesProgress() {
        if (!this.user) {
            console.log('❌ User not logged in');
            return [];
        }

        try {
            const url = `${this.serverUrl}/user-progress/${this.user.email}`;
            console.log('📥 Fetching from:', url);
            
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            
            const data = await res.json();
            console.log('✅ User progress received:', data);
            return data;
        } catch (err) {
            console.error('❌ Error fetching user progress:', err);
            return [];
        }
    }

    // Update progress UI for a course
    async updateCourseUI(courseName) {
        const progress = await this.getCourseProgress(courseName);
        if (!progress) return;

        // Find course card and update it
        const courseCard = document.querySelector(`[data-course="${courseName}"]`);
        if (courseCard) {
            const progressBar = courseCard.querySelector('.progress-bar');
            const progressText = courseCard.querySelector('.progress-text');

            if (progressBar) {
                progressBar.style.width = progress.completion_percentage + '%';
            }
            if (progressText) {
                progressText.textContent = `${progress.completion_percentage}% përfunduar`;
            }
        }
    }

    // Load all course progress on page
    async loadAllCourseProgress() {
        const progressList = await this.getAllCoursesProgress();
        
        // Create a map for easy lookup
        const progressMap = {};
        progressList.forEach(p => {
            progressMap[p.course_name] = p;
        });

        // Update all course cards
        document.querySelectorAll('[data-course]').forEach(courseCard => {
            const courseName = courseCard.dataset.course;
            const progress = progressMap[courseName];

            if (progress) {
                const progressBar = courseCard.querySelector('.progress-bar');
                const progressText = courseCard.querySelector('.progress-text');

                if (progressBar) {
                    progressBar.style.width = progress.completion_percentage + '%';
                }
                if (progressText) {
                    progressText.textContent = `${progress.completion_percentage}% përfunduar`;
                }
            }
        });
    }
}

// Create global instance
const courseProgress = new CourseProgress();

// Load progress when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (courseProgress.user) {
        courseProgress.loadAllCourseProgress();
    }
});
