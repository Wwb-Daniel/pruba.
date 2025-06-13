import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusSquare, User, LogOut, Menu, X, Compass, Users, Settings, MessageCircle, Music } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useVideoStore } from '../../store/videoStore';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '../notifications/NotificationBell';
import ChatButton from '../chat/ChatButton';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { feedType, setFeedType } = useVideoStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Función para determinar si una ruta está activa
  const isRouteActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Función para determinar si el feed está activo
  const isFeedActive = (type: string) => {
    return feedType === type;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-black border-b border-gray-800 z-50 px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <img src="/logo (2).png" alt="OmniPlay Logo" className="h-8 w-8 mr-2" />
          <span className="text-xl font-bold bg-gradient-brand text-transparent bg-clip-text">OmniPlay</span>
        </Link>
        
        <div className="flex items-center space-x-2">
          <NotificationBell />
          <ChatButton />
          <button
            onClick={toggleMenu}
            className="p-2 hover:bg-gray-800 rounded-lg text-white"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 w-64 bg-black border-r border-gray-800 z-40 pt-16"
          >
            <div className="p-4">
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Feed</h3>
                <button
                  onClick={() => {
                    setFeedType('all');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
                    isFeedActive('all') 
                      ? 'bg-blue-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Compass size={20} className="mr-3" />
                  For You
                </button>
                <button
                  onClick={() => {
                    setFeedType('following');
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 rounded-lg mt-1 transition-colors duration-200 ${
                    isFeedActive('following') 
                      ? 'bg-blue-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Users size={20} className="mr-3" />
                  Following
                </button>
              </div>

              <div className="space-y-1">
                <NavItem
                  to="/"
                  icon={<Home size={20} />}
                  label="Home"
                  isActive={isRouteActive('/')}
                  onClick={() => setIsMenuOpen(false)}
                />
                <NavItem
                  to="/search"
                  icon={<Search size={20} />}
                  label="Search"
                  isActive={isRouteActive('/search')}
                  onClick={() => setIsMenuOpen(false)}
                />
                <NavItem
                  to="/upload"
                  icon={<PlusSquare size={20} />}
                  label="Upload"
                  isActive={isRouteActive('/upload')}
                  onClick={() => setIsMenuOpen(false)}
                />
                <NavItem
                  to="/audio"
                  icon={<Music size={20} />}
                  label="Audio Library"
                  isActive={isRouteActive('/audio')}
                  onClick={() => setIsMenuOpen(false)}
                />
                <NavItem
                  to={`/profile/${user?.id}`}
                  icon={<User size={20} />}
                  label="Profile"
                  isActive={isRouteActive('/profile')}
                  onClick={() => setIsMenuOpen(false)}
                />
                <button
                  onClick={() => {
                    navigate('/settings');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  <Settings size={20} className="mr-3" />
                  <span>Settings</span>
                </button>
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                <button
                  onClick={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-red-500 hover:bg-gray-800 rounded-lg transition-colors duration-200"
                >
                  <LogOut size={20} className="mr-3" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-14" /> {/* Spacer for fixed navbar */}
    </>
  );
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive, onClick }) => {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
        isActive 
          ? 'bg-blue-700 text-white' 
          : 'text-gray-300 hover:bg-gray-800'
      }`}
    >
      <div className="mr-3">{icon}</div>
      <span>{label}</span>
    </Link>
  );
};

export default Navbar;