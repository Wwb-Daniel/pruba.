export interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  category?: string;
  tags?: string[];
  duration?: number;
  status: 'processing' | 'ready' | 'error';
  user: {
    id: string;
    username: string;
    avatar_url: string;
    bio?: string;
    followers_count: number;
  };
  is_liked?: boolean;
  is_following?: boolean;
} 