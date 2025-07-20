import React, { useState, useEffect } from 'react';
import { Volume2, Search, Play, Download, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from './ToastContainer';

interface AudioFile {
  id: number;
  english_text: string;
  english_audio_path?: string;
  marathi_audio_path?: string;
  hindi_audio_path?: string;
  gujarati_audio_path?: string;
  created_at: string;
  is_active: boolean;
}

interface AnnouncementAudioSegment {
  id: number;
  template_id: number;
  category: string;
  segment_text: string;
  language: string;
  segment_order: number;
  audio_path?: string;
  file_size?: number;
  created_at: string;
  is_active: boolean;
}

interface TemplateSegments {
  template_id: number;
  category: string;
  languages: {
    [language: string]: AnnouncementAudioSegment[];
  };
}

export default function AnnouncementAudios() {
  const { addToast } = useToast();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAudioFiles, setFilteredAudioFiles] = useState<AudioFile[]>([]);
  const [announcementSegments, setAnnouncementSegments] = useState<TemplateSegments[]>([]);
  const [finalAnnouncements, setFinalAnnouncements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'audio-files' | 'announcement-segments' | 'final-announcements'>('audio-files');

  useEffect(() => {
    fetchAudioFiles();
    fetchAnnouncementSegments();
    fetchFinalAnnouncements();
  }, []);

  useEffect(() => {
    // Filter audio files based on search term
    const filtered = audioFiles.filter(audio => 
      audio.english_text.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAudioFiles(filtered);
  }, [audioFiles, searchTerm]);

  const fetchAudioFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5001/api/audio-files');
      if (response.ok) {
        const data = await response.json();
        setAudioFiles(data.audio_files || []);
      } else {
        throw new Error('Failed to fetch audio files');
      }
    } catch (error: any) {
      console.error('Error fetching audio files:', error);
      addToast({
        type: 'error',
        title: 'Fetch Failed',
        message: error.message || 'Failed to fetch audio files'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnnouncementSegments = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/announcement-audio/all-segments');
      if (response.ok) {
        const data = await response.json();
        setAnnouncementSegments(data.segments || []);
      } else {
        throw new Error('Failed to fetch announcement segments');
      }
    } catch (error: any) {
      console.error('Error fetching announcement segments:', error);
      addToast({
        type: 'error',
        title: 'Fetch Failed',
        message: error.message || 'Failed to fetch announcement segments'
      });
    }
  };

  const fetchFinalAnnouncements = async () => {
    try {
      // List files in the final_announcements directory
      const response = await fetch('http://localhost:5001/api/final-announcement/list');
      if (response.ok) {
        const data = await response.json();
        setFinalAnnouncements(data.announcements || []);
      } else {
        // If the endpoint doesn't exist yet, we'll handle it gracefully
        console.log('Final announcements endpoint not available yet');
        setFinalAnnouncements([]);
      }
    } catch (error: any) {
      console.error('Error fetching final announcements:', error);
      // Don't show error toast for this as it might not be implemented yet
      setFinalAnnouncements([]);
    }
  };

  const handlePlayAudio = (audioPath: string, language: string) => {
    if (!audioPath) {
      addToast({
        type: 'warning',
        title: 'Audio Not Available',
        message: `${language} audio file not found`
      });
      return;
    }

    const audioUrl = `http://localhost:5001${audioPath}`;
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      addToast({
        type: 'error',
        title: 'Playback Failed',
        message: 'Failed to play audio file'
      });
    });
  };

  const handleDownloadAudio = (audioPath: string, language: string, text: string) => {
    if (!audioPath) {
      addToast({
        type: 'warning',
        title: 'Download Failed',
        message: `${language} audio file not available for download`
      });
      return;
    }

    const audioUrl = `http://localhost:5001${audioPath}`;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${text.replace(/[^a-zA-Z0-9]/g, '_')}_${language}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Download Started',
      message: `${language} audio file download started`
    });
  };

  const handleDeleteAudio = async (audioId: number, text: string) => {
    if (!window.confirm(`Are you sure you want to delete the audio file for "${text}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/audio-files/${audioId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'Audio Deleted',
          message: 'Audio file deleted successfully'
        });
        fetchAudioFiles(); // Refresh the list
      } else {
        throw new Error('Failed to delete audio file');
      }
    } catch (error: any) {
      console.error('Error deleting audio file:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Failed to delete audio file'
      });
    }
  };

  const handleDeleteSegment = async (segmentId: number) => {
    if (!window.confirm('Are you sure you want to delete this audio segment?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/announcement-audio/segments/${segmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'Segment Deleted',
          message: 'Audio segment deleted successfully'
        });
        fetchAnnouncementSegments(); // Refresh the list
      } else {
        throw new Error('Failed to delete audio segment');
      }
    } catch (error: any) {
      console.error('Error deleting audio segment:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Failed to delete audio segment'
      });
    }
  };

  const clearAllFinalAnnouncements = async () => {
    if (!window.confirm('Are you sure you want to delete ALL final announcements? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5001/api/final-announcement/clear-all', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        addToast({
          type: 'success',
          title: 'Cleared Successfully',
          message: `Cleared ${result.deleted_files_count} files successfully`
        });
        fetchFinalAnnouncements();
      } else {
        const error = await response.json();
        addToast({
          type: 'error',
          title: 'Clear Failed',
          message: error.detail || 'Failed to clear all final announcements'
        });
      }
    } catch (error: any) {
      console.error('Error clearing all final announcements:', error);
      addToast({
        type: 'error',
        title: 'Clear Failed',
        message: error.message || 'Failed to clear all final announcements'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearDynamicContent = async () => {
    if (!window.confirm('Are you sure you want to delete all dynamic content files? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:5001/api/final-announcement/clear-dynamic-content', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        addToast({
          type: 'success',
          title: 'Dynamic Content Cleared',
          message: `Cleared ${result.deleted_files_count} dynamic content files`
        });
      } else {
        const error = await response.json();
        addToast({
          type: 'error',
          title: 'Clear Failed',
          message: error.detail || 'Failed to clear dynamic content'
        });
      }
    } catch (error: any) {
      console.error('Error clearing dynamic content:', error);
      addToast({
        type: 'error',
        title: 'Clear Failed',
        message: error.message || 'Failed to clear dynamic content'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading announcement audios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcement Audios</h1>
          <p className="text-gray-600 mt-1">Manage and play announcement audio files and segments</p>
        </div>
        <button
          onClick={() => {
            fetchAudioFiles();
            fetchAnnouncementSegments();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('audio-files')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'audio-files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audio Files ({audioFiles.length})
          </button>
          <button
            onClick={() => setActiveTab('announcement-segments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'announcement-segments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Announcement Segments ({announcementSegments.length})
          </button>
          <button
            onClick={() => setActiveTab('final-announcements')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'final-announcements'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Final Announcements ({finalAnnouncements.length})
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'audio-files' ? "Search announcement text..." : "Search segment text..."}
            className="block w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Audio Files Tab */}
      {activeTab === 'audio-files' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredAudioFiles.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No announcement audios found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'No audio files have been generated yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Announcement Text
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Languages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAudioFiles.map((audio) => (
                    <tr key={audio.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                          {audio.english_text}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {audio.english_audio_path && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              English
                            </span>
                          )}
                          {audio.marathi_audio_path && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Marathi
                            </span>
                          )}
                          {audio.hindi_audio_path && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Hindi
                            </span>
                          )}
                          {audio.gujarati_audio_path && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Gujarati
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(audio.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {audio.english_audio_path && (
                            <button
                              onClick={() => handlePlayAudio(audio.english_audio_path!, 'English')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Play English"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {audio.english_audio_path && (
                            <button
                              onClick={() => handleDownloadAudio(audio.english_audio_path!, 'English', audio.english_text)}
                              className="text-green-600 hover:text-green-900"
                              title="Download English"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAudio(audio.id, audio.english_text)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Audio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Announcement Segments Tab */}
      {activeTab === 'announcement-segments' && (
        <div className="space-y-4">
          {announcementSegments.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No announcement segments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate audio segments from announcement templates first.
              </p>
            </div>
          ) : (
            announcementSegments.map((templateSegment) => (
              <div key={templateSegment.template_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Template ID: {templateSegment.template_id} - {templateSegment.category}
                  </h3>
                </div>
                <div className="p-6">
                  {Object.entries(templateSegment.languages).map(([language, segments]) => (
                    <div key={language} className="mb-6 last:mb-0">
                      <h4 className="text-md font-medium text-gray-900 mb-3 capitalize">{language}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {segments.map((segment) => (
                          <div key={segment.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-medium text-gray-500">Segment {segment.segment_order}</span>
                              <span className="text-xs text-gray-500">{segment.file_size ? `${Math.round(segment.file_size / 1024)}KB` : 'N/A'}</span>
                            </div>
                            <p className="text-sm text-gray-900 mb-3 line-clamp-2">{segment.segment_text}</p>
                            <div className="flex items-center gap-2">
                              {segment.audio_path && (
                                <>
                                  <button
                                    onClick={() => handlePlayAudio(segment.audio_path!, language)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title={`Play ${language}`}
                                  >
                                    <Play className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadAudio(segment.audio_path!, language, segment.segment_text)}
                                    className="text-green-600 hover:text-green-900"
                                    title={`Download ${language}`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteSegment(segment.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete Segment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Final Announcements Tab */}
      {activeTab === 'final-announcements' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {finalAnnouncements.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No final announcements found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate final announcements from the Dashboard to see them here.
              </p>
            </div>
          ) : (
            <>
              {/* Clear All Button */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Final Announcements ({finalAnnouncements.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={clearDynamicContent}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Legacy Files
                  </button>
                  <button
                    onClick={clearAllFinalAnnouncements}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Language
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Template ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {finalAnnouncements.map((announcement) => (
                      <tr key={announcement.filename} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {announcement.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {announcement.language}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {announcement.template_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(announcement.file_size / 1024)}KB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(announcement.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePlayAudio(announcement.audio_path, announcement.language)}
                              className="text-blue-600 hover:text-blue-900"
                              title={`Play ${announcement.language}`}
                            >
                              <Play className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadAudio(announcement.audio_path, announcement.language, `${announcement.category} announcement`)}
                              className="text-green-600 hover:text-green-900"
                              title={`Download ${announcement.language}`}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600">
        {activeTab === 'audio-files' && (
          <>
            Showing {filteredAudioFiles.length} of {audioFiles.length} announcement audios
            {searchTerm && ` matching "${searchTerm}"`}
          </>
        )}
        {activeTab === 'announcement-segments' && (
          <>
            Showing {announcementSegments.length} template segments
            {searchTerm && ` matching "${searchTerm}"`}
          </>
        )}
        {activeTab === 'final-announcements' && (
          <>
            Showing {finalAnnouncements.length} final announcements
            {searchTerm && ` matching "${searchTerm}"`}
          </>
        )}
      </div>
    </div>
  );
} 