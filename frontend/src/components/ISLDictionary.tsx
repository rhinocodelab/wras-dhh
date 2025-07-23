import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, Search, Hand, X, RefreshCw } from 'lucide-react';
import { useToast } from './ToastContainer';
import { apiService } from '../services/api';

interface ISLVideo {
  id: string;
  name: string;
  category: string;
  path: string;
  size: string;
}

export default function ISLDictionary() {
  const { addToast } = useToast();
  const [videos, setVideos] = useState<ISLVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<ISLVideo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState<string | null>(null);
  const [currentVideoPath, setCurrentVideoPath] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(7);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cleanupFiles = async () => {
    try {
      await apiService.cleanupFiles();
      console.log('Cleanup completed successfully');
      
      // Also cleanup publish ISL directory
      try {
        await apiService.cleanupPublishISL();
        console.log('Publish ISL cleanup completed successfully');
      } catch (error: any) {
        console.warn('Publish ISL cleanup failed:', error);
      }
    } catch (error: any) {
      console.error('Cleanup failed:', error);
      addToast({
        type: 'error',
        title: 'Cleanup Failed',
        message: error.message || 'Failed to cleanup temporary files'
      });
    }
  };

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'numbers', name: 'Numbers' },
    { id: 'railway-terms', name: 'Railway Terms' },
    { id: 'stations', name: 'Station Names' },
  ];

  const fetchISLVideos = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('http://localhost:5001/api/scan-isl-dataset');
      
      if (!response.ok) {
        throw new Error('Failed to fetch ISL videos');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
        setFilteredVideos(data.videos);
      } else {
        throw new Error(data.message || 'Failed to scan ISL dataset');
      }
    } catch (error: any) {
      console.error('Error fetching ISL videos:', error);
      addToast({
        type: 'error',
        title: 'Scan Failed',
        message: error.message || 'Failed to scan ISL dataset'
      });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchISLVideos();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupFiles();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    let filtered = videos;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(video => 
        video.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(video => video.category === selectedCategory);
    }
    
    setFilteredVideos(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedCategory, videos]);

  const handlePlayVideo = (videoId: string, videoPath: string) => {
    setCurrentVideoPath(`http://localhost:5001${videoPath}`);
    setCurrentPlayingVideo(videoId);
    setShowVideoModal(true);
  };

  const handleStopVideo = () => {
    setCurrentPlayingVideo(null);
    setCurrentVideoPath(null);
    setShowVideoModal(false);
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'numbers': 'Numbers',
      'railway-terms': 'Railway Terms',
      'stations': 'Station Names'
    };
    return categoryMap[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      'numbers': 'bg-blue-100 text-blue-800',
      'railway-terms': 'bg-green-100 text-green-800',
      'stations': 'bg-purple-100 text-purple-800'
    };
    return colorMap[category] || 'bg-gray-100 text-gray-800';
  };

  // Pagination functions
  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVideos = filteredVideos.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#337ab7]"></div>
        <span className="ml-3 text-gray-600">Loading ISL Dictionary...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ISL Dictionary</h1>
          <p className="text-gray-600 text-xs">
            Indian Sign Language videos for railway announcements. Click on any video to play the ISL sign.
          </p>
        </div>
        <button
          onClick={fetchISLVideos}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#337ab7] rounded-none hover:bg-[#2e6da4] focus:ring-2 focus:ring-[#337ab7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ISL videos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent text-sm"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent text-sm"
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

            {/* Videos Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <Hand className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No videos found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedCategory !== 'all' ? 'Try adjusting your search terms or category filter' : 'No ISL videos available'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                Video Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                Size
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentVideos.map((video) => (
              <tr key={video.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Hand className="h-5 w-5 text-gray-400 mr-3" />
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{video.name}</div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-none ${getCategoryColor(video.category)}`}>
                    {getCategoryDisplayName(video.category)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {video.size}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handlePlayVideo(video.id, video.path)}
                      className="text-[#337ab7] hover:text-[#2e6da4] p-0.5"
                      title="Play ISL Video"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredVideos.length)} of {filteredVideos.length} videos
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1 text-sm border ${
                      currentPage === page
                        ? 'bg-[#337ab7] text-white border-[#337ab7]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>

      {/* Video Player Modal */}
      {showVideoModal && currentVideoPath && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-none max-w-2xl w-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Playing ISL Video
                </h3>
                <button
                  onClick={handleStopVideo}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-center">
                <video
                  src={currentVideoPath}
                  controls
                  autoPlay
                  muted
                  className="w-full max-w-lg"
                  onEnded={handleStopVideo}
                  onError={() => {
                    addToast({
                      type: 'error',
                      title: 'Video Error',
                      message: 'Failed to load video. Please check if the ISL videos are properly mounted.'
                    });
                    handleStopVideo();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 