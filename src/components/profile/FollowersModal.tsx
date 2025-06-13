import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  followers_count: number;
}

interface FollowersModalProps {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

const FollowersModal: React.FC<FollowersModalProps> = ({ userId, type, onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        let query;
        if (type === 'followers') {
          query = supabase
            .from('followers')
            .select(`
              follower_id,
              follower:profiles!followers_follower_id_fkey (
                id,
                username,
                avatar_url,
                bio,
                followers_count
              )
            `)
            .eq('following_id', userId);
        } else {
          query = supabase
            .from('followers')
            .select(`
              following_id,
              following:profiles!followers_following_id_fkey (
                id,
                username,
                avatar_url,
                bio,
                followers_count
              )
            `)
            .eq('follower_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const formattedUsers = data.map((item: any) => {
          const userData = type === 'followers' ? item.follower : item.following;
          return {
            id: userData.id,
            username: userData.username,
            avatar_url: userData.avatar_url,
            bio: userData.bio,
            followers_count: userData.followers_count
          };
        });

        setUsers(formattedUsers);
        setFilteredUsers(formattedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [userId, type]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No {type} found
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredUsers.map((user) => (
                <Link
                  key={user.id}
                  to={`/profile/${user.id}`}
                  onClick={onClose}
                  className="block p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                        <User size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">@{user.username}</p>
                      {user.bio && (
                        <p className="text-sm text-gray-400 truncate">{user.bio}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {user.followers_count} followers
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersModal;