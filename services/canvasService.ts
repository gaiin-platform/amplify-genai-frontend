// Canvas LMS Integration Service
// Connects directly to the LLM Router Canvas API

const CANVAS_API_BASE = process.env.NEXT_PUBLIC_CANVAS_API_URL || '';
const CANVAS_TOKEN_KEY = 'canvas_access_token';
const CANVAS_REFRESH_TOKEN_KEY = 'canvas_refresh_token';
const CANVAS_USER_KEY = 'canvas_user';
const CANVAS_EXPIRES_KEY = 'canvas_expires_at';

export interface CanvasStatus {
  connected: boolean;
  canvas_user_id?: string;
  canvas_user_name?: string;
  expires_at?: number;
  canvas_base_url?: string;
}

export interface CanvasOAuthResponse {
  auth_url: string;
  state: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  course_id: number;
  course_name: string;
  name: string;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  has_submitted: boolean;
  days_until_due?: number;
}

export interface CanvasGrade {
  course_id: number;
  course_name: string;
  current_score: string;
  current_grade: string;
  final_score: string;
  final_grade: string;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  course_name: string;
}

// Helper to get stored token
const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(CANVAS_TOKEN_KEY);
  const expiresAt = localStorage.getItem(CANVAS_EXPIRES_KEY);

  // Check if token is expired
  if (token && expiresAt) {
    const expiry = parseInt(expiresAt, 10);
    if (Date.now() / 1000 > expiry) {
      // Token expired, clear it
      clearStoredTokens();
      return null;
    }
  }

  return token;
};

// Helper to store tokens
const storeTokens = (accessToken: string, refreshToken: string, expiresIn: number, user: any) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(CANVAS_TOKEN_KEY, accessToken);
  localStorage.setItem(CANVAS_REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(CANVAS_EXPIRES_KEY, String(Math.floor(Date.now() / 1000) + expiresIn));
  localStorage.setItem(CANVAS_USER_KEY, JSON.stringify(user));
};

// Helper to clear stored tokens
const clearStoredTokens = () => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(CANVAS_TOKEN_KEY);
  localStorage.removeItem(CANVAS_REFRESH_TOKEN_KEY);
  localStorage.removeItem(CANVAS_EXPIRES_KEY);
  localStorage.removeItem(CANVAS_USER_KEY);
};

// Helper to get stored user
const getStoredUser = (): any | null => {
  if (typeof window === 'undefined') return null;

  const userStr = localStorage.getItem(CANVAS_USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const canvasService = {
  // Get the access token for use in chat requests
  getAccessToken(): string | null {
    return getStoredToken();
  },

  // Check Canvas connection status via backend
  async getStatus(): Promise<CanvasStatus> {
    const token = getStoredToken();
    if (!token) {
      return { connected: false };
    }

    try {
      const response = await fetch(`${CANVAS_API_BASE}/api/canvas/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredTokens();
          return { connected: false };
        }
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        connected: data.connected ?? true,
        canvas_user_id: data.canvas_user_id,
        canvas_user_name: data.canvas_user_name,
        expires_at: data.expires_at,
        canvas_base_url: data.canvas_base_url
      };
    } catch (error) {
      console.error('Canvas status check error:', error);
      // Fall back to local storage check
      const user = getStoredUser();
      const expiresAt = localStorage.getItem(CANVAS_EXPIRES_KEY);
      return {
        connected: true,
        canvas_user_id: user?.id?.toString(),
        canvas_user_name: user?.name,
        expires_at: expiresAt ? parseInt(expiresAt, 10) : undefined,
      };
    }
  },

  // Initiate OAuth flow - returns URL to redirect to
  async initiateOAuth(): Promise<CanvasOAuthResponse> {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${CANVAS_API_BASE}/api/canvas/oauth/initiate`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Failed to initiate Canvas OAuth: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return {
        auth_url: data.auth_url,
        state: data.state || 'canvas_auth'
      };
    } catch (error) {
      console.error('Canvas OAuth initiation error:', error);
      throw error;
    }
  },

  // Handle OAuth callback - store tokens from URL parameters
  handleOAuthCallback(params: URLSearchParams): boolean {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    const userStr = params.get('user');

    // Also check for JSON response in body (direct callback)
    if (accessToken && refreshToken && expiresIn) {
      let user = {};
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch {
          user = {};
        }
      }

      storeTokens(accessToken, refreshToken, parseInt(expiresIn, 10), user);
      return true;
    }

    return false;
  },

  // Store tokens directly (for callback page)
  storeTokensFromCallback(accessToken: string, refreshToken: string, expiresIn: number, user: any) {
    storeTokens(accessToken, refreshToken, expiresIn, user);
  },

  // Disconnect Canvas - revoke on backend and clear stored tokens
  async disconnect(): Promise<boolean> {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(`${CANVAS_API_BASE}/api/canvas/disconnect`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error revoking Canvas token on backend:', error);
      }
    }
    clearStoredTokens();
    return true;
  },

  // Make authenticated request to Canvas API through our Lambda
  async canvasApiRequest(endpoint: string): Promise<any> {
    const token = getStoredToken();
    if (!token) {
      throw new Error('Not connected to Canvas');
    }

    const response = await fetch(`${CANVAS_API_BASE}/api/canvas/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredTokens();
        throw new Error('Canvas session expired - please reconnect');
      }
      throw new Error(`Canvas API error: ${response.statusText}`);
    }

    return response.json();
  },

  // Get user's Canvas context for chat
  async getContextForChat(): Promise<string> {
    const token = getStoredToken();
    if (!token) {
      return '';
    }

    try {
      const response = await fetch(`${CANVAS_API_BASE}/api/canvas/context`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return '';
      }

      const data = await response.json();
      return data.context || '';
    } catch (error) {
      console.error('Error getting Canvas context:', error);
      return '';
    }
  },

  // Get user's courses
  async getCourses(): Promise<CanvasCourse[]> {
    const result = await this.canvasApiRequest('user');
    return result.courses || [];
  },

  // Get assignments (placeholder - would need Lambda update)
  async getAssignments(courseId?: number): Promise<CanvasAssignment[]> {
    // Would need to add this endpoint to Lambda
    return [];
  },

  // Get upcoming assignments (placeholder)
  async getUpcomingAssignments(days: number = 7): Promise<CanvasAssignment[]> {
    return [];
  },

  // Get grades (placeholder)
  async getGrades(courseId?: number): Promise<CanvasGrade[]> {
    return [];
  },

  // Get announcements (placeholder)
  async getAnnouncements(limit: number = 10): Promise<CanvasAnnouncement[]> {
    return [];
  }
};
