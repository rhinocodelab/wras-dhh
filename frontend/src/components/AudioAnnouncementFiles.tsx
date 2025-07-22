import React, { useState, useEffect } from 'react';
import { Volume2, Play, Save, Trash2, FileAudio, Languages, X } from 'lucide-react';
import { useToast } from './ToastContainer';
import { API_ENDPOINTS } from '../config/api';

interface AudioFile {
  id: number;
  english_text: string;
  english_audio_path?: string;
  marathi_audio_path?: string;
  hindi_audio_path?: string;
  gujarati_audio_path?: string;
  english_translation?: string;
  marathi_translation?: string;
  hindi_translation?: string;
  gujarati_translation?: string;
  created_at: string;
}

interface AudioAnnouncementFilesProps {
  onDataChange?: () => void;
}

const AudioAnnouncementFiles: React.FC<AudioAnnouncementFilesProps> = ({ onDataChange }) => {
  const { addToast } = useToast();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [englishText, setEnglishText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<AudioFile | null>(null);
  const [currentFile, setCurrentFile] = useState<AudioFile | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  useEffect(() => {
    loadAudioFiles();
  }, []);

  // Reset to first page when audio files change
  useEffect(() => {
    setCurrentPage(1);
  }, [audioFiles.length]);

  const loadAudioFiles = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.audioFiles.list);
      if (response.ok) {
        const files = await response.json();
        setAudioFiles(files);
      }
    } catch (error) {
      console.error('Error loading audio files:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load audio files'
      });
    }
  };

  const createAudioFile = async () => {
    if (!englishText.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Please enter English text'
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      const response = await fetch(API_ENDPOINTS.audioFiles.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          english_text: englishText.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle duplicate error specifically
        if (response.status === 409) {
          addToast({
            type: 'warning',
            title: 'Duplicate Text Found',
            message: errorData.detail || 'This English text already exists in the database'
          });
          return;
        }
        
        throw new Error(errorData.detail || 'Failed to create audio file');
      }

      const result = await response.json();
      setAudioFiles(prev => [result, ...prev]);
      setEnglishText('');
      setShowCreateModal(false);
      
      // Notify parent component about data change
      onDataChange?.();
      
      addToast({
        type: 'success',
        title: 'Audio Generation Started',
        message: 'Audio files are being generated in the background. This may take a few moments.'
      });
      
      // Start polling for status updates
      setProcessingFiles(prev => new Set(prev).add(result.id));
      pollAudioFileStatus(result.id);
      
    } catch (error: any) {
      console.error('Create audio file error:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create audio file'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const pollAudioFileStatus = async (fileId: number) => {
    const maxAttempts = 30; // 30 seconds
    let attempts = 0;
    
    const poll = async () => {
      try {
        // Use the status endpoint instead of getById
        const response = await fetch(`${API_ENDPOINTS.audioFiles.getById(fileId)}/status`);
        if (response.ok) {
          const status = await response.json();
          
          console.log(`Polling file ${fileId}:`, status);
          
          if (status.completed) {
            // Update the audio file in the list with the full data
            const fullResponse = await fetch(API_ENDPOINTS.audioFiles.getById(fileId));
            if (fullResponse.ok) {
              const fullData = await fullResponse.json();
              setAudioFiles(prev => 
                prev.map(file => 
                  file.id === fileId ? fullData : file
                )
              );
            }
            
            // Remove from processing files
            setProcessingFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(fileId);
              return newSet;
            });
            
            addToast({
              type: 'success',
              title: 'Audio Generation Complete',
              message: 'All audio files have been generated successfully!'
            });
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Poll every second
        } else {
          addToast({
            type: 'warning',
            title: 'Processing Timeout',
            message: 'Audio generation is taking longer than expected. Please refresh the page.'
          });
        }
      } catch (error) {
        console.error('Status polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        }
      }
    };
    
    poll();
  };

  const confirmDelete = (file: AudioFile) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const deleteAudioFile = async () => {
    if (!fileToDelete) return;
    
    try {
      const response = await fetch(API_ENDPOINTS.audioFiles.delete(fileToDelete.id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete audio file');
      }

      const result = await response.json();
      setAudioFiles(prev => prev.filter(file => file.id !== fileToDelete.id));
      
      // Notify parent component about data change
      onDataChange?.();
      
      addToast({
        type: 'success',
        title: 'Audio File Deleted',
        message: `Successfully deleted audio file and ${result.total_files_deleted} audio files from storage`
      });
      
    } catch (error: any) {
      console.error('Delete error:', error);
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete audio file'
      });
    } finally {
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL audio files? This action cannot be undone and will permanently delete all audio files from the database and storage.')) {
      try {
        const response = await fetch(API_ENDPOINTS.audioFiles.deleteAll, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to delete all audio files');
        }

        const result = await response.json();
        setAudioFiles([]);
        
        // Notify parent component about data change
        onDataChange?.();
        
        addToast({
          type: 'success',
          title: 'All Audio Files Deleted',
          message: `Successfully deleted ${result.total_records_deleted} audio file records and ${result.total_files_deleted} physical files from storage`
        });
        
      } catch (error: any) {
        console.error('Clear all error:', error);
        addToast({
          type: 'error',
          title: 'Clear All Failed',
          message: error.message || 'Failed to delete all audio files'
        });
      }
    }
  };

  const playAudio = (audioPath: string) => {
    if (audioPath) {
      // Construct the full URL for audio playback
      // audioPath is stored as "/audio_files/filename.mp3"
      // Apache2 serves on port 80, but frontend might be on different port
      
      let fullAudioUrl;
      
      // Check if we're in development (different ports) or production (same port)
      const isDevelopment = window.location.port && window.location.port !== '80';
      
      if (isDevelopment) {
        // In development: frontend on any dev port (3000, 5173, etc.), Apache2 on port 80
        fullAudioUrl = `http://localhost${audioPath}`;
        console.log(`Development mode: Frontend on port ${window.location.port}, using Apache2 port 80 for audio files`);
      } else {
        // In production: same port for both frontend and Apache2
        const baseUrl = window.location.origin;
        fullAudioUrl = `${baseUrl}${audioPath}`;
        console.log('Production mode: Using same port for audio files');
      }
      
      console.log('Playing audio:', fullAudioUrl);
      console.log('Audio path from database:', audioPath);
      console.log('Current location:', window.location.href);
      
      // Test if the URL is accessible before creating Audio object
      const testAudioAccess = async () => {
        try {
          const response = await fetch(fullAudioUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log('✅ Audio file is accessible:', fullAudioUrl);
            console.log('Content-Type:', response.headers.get('Content-Type'));
            return true;
          } else {
            console.warn('⚠️ Audio file not accessible:', fullAudioUrl, 'Status:', response.status);
            return false;
          }
        } catch (error) {
          console.error('❌ Error testing audio access:', error);
          return false;
        }
      };
      
      // Test access and then create Audio object
      testAudioAccess().then(isAccessible => {
        if (!isAccessible) {
          addToast({
            type: 'error',
            title: 'Audio File Not Found',
            message: 'Audio file is not accessible. Please try again later.'
          });
          return;
        }
        
        const audio = new Audio(fullAudioUrl);
        
        // Add error handling for audio loading
        audio.addEventListener('error', (e) => {
          console.error('Audio loading error:', e);
          console.error('Failed URL:', fullAudioUrl);
          addToast({
            type: 'error',
            title: 'Audio Error',
            message: 'Failed to load audio file. Please try again later.'
          });
        });
        
        audio.addEventListener('loadstart', () => {
          console.log('Audio loading started:', fullAudioUrl);
        });
        
        audio.addEventListener('canplay', () => {
          console.log('Audio can play:', fullAudioUrl);
        });
        
        audio.play().catch(error => {
          console.error('Audio playback error:', error);
          console.error('Failed URL:', fullAudioUrl);
          addToast({
            type: 'error',
            title: 'Playback Error',
            message: `Failed to play audio. Error: ${error.message}`
          });
        });
      });
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Pagination calculations
  const totalPages = Math.ceil(audioFiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAudioFiles = audioFiles.slice(startIndex, endIndex);

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audio Files</h1>
          <p className="text-gray-600 mt-1 text-xs">Convert English text to audio files in multiple languages</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadAudioFiles}
            disabled={isLoading}
            className="px-2 py-1 bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
            title="Refresh the list of audio files from the database"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-2 py-1 bg-purple-600 text-white hover:bg-purple-700 text-sm transition-colors"
            title="Create a new audio file by entering English text. This will generate audio files in all supported languages."
          >
            Create New Audio File
          </button>
          {audioFiles.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 text-sm transition-colors"
              title="Delete all audio files from the database and remove all physical audio files. This action cannot be undone."
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Audio Files Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {audioFiles.length === 0 ? (
          <div className="text-center py-12">
            <FileAudio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Audio Files</h3>
            <p className="text-gray-600 mb-4">Create your first audio file to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#337ab7] text-white hover:bg-[#2e6da4] transition-colors"
              title="Create a new audio file by entering English text. This will generate audio files in all supported languages."
            >
              Create Audio File
            </button>
          </div>
        ) : (
          <>
            <div>
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      English Text
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Audio Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentAudioFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-md">
                        <p className="font-mono text-xs bg-gray-50 p-2 border truncate" title={file.english_text}>
                          {file.english_text.length > 100 
                            ? `${file.english_text.substring(0, 100)}...` 
                            : file.english_text
                          }
                        </p>
                        {file.english_text.length > 100 && (
                                                  <button
                          onClick={() => setCurrentFile(file)}
                          className="text-[#337ab7] hover:text-[#2e6da4] text-xs mt-1"
                          title="View the complete English text for this audio file"
                        >
                          View full text
                        </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-4">
                        {[
                          { lang: 'EN', fullName: 'English', audio: file.english_audio_path },
                          { lang: 'MR', fullName: 'Marathi', audio: file.marathi_audio_path },
                          { lang: 'HI', fullName: 'Hindi', audio: file.hindi_audio_path },
                          { lang: 'GU', fullName: 'Gujarati', audio: file.gujarati_audio_path }
                        ].map((item) => (
                          <div key={item.lang} className="flex items-center space-x-1">
                            <span className="text-xs font-medium text-gray-500">{item.lang}:</span>
                            {item.audio ? (
                              <button
                                onClick={() => playAudio(item.audio!)}
                                title={`Play ${item.fullName} audio`}
                                className="flex items-center justify-center w-5 h-5 bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                <Play className="h-2 w-2" />
                              </button>
                            ) : processingFiles.has(file.id) ? (
                              <div className="flex items-center space-x-1">
                                <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-[#337ab7]"></div>
                                <span className="text-[#337ab7] text-xs">...</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => confirmDelete(file)}
                        className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 text-xs transition-colors"
                        title="Delete this audio file and all its associated audio files from the database and server"
                      >
                        Delete
                      </button>
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
                  Showing {startIndex + 1} to {Math.min(endIndex, audioFiles.length)} of {audioFiles.length} audio files
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

      {/* Create Audio File Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create Audio File</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Text
                </label>
                <textarea
                  value={englishText}
                  onChange={(e) => setEnglishText(e.target.value)}
                  placeholder="Enter English text to convert to audio files..."
                  className="w-full h-32 p-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              
              <div className="bg-[#f0f4f8] border border-[#c3d4e5] p-3">
                <p className="text-[#2e6da4] text-sm">
                  <strong>Note:</strong> This will create audio files in English, Marathi, Hindi, and Gujarati languages.
                  The files will be saved with proper naming conventions for later use in full-length announcements.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isGenerating}
                className="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                title="Cancel creating the audio file and close the modal"
              >
                Cancel
              </button>
              <button
                onClick={createAudioFile}
                disabled={isGenerating || !englishText.trim()}
                className="px-4 py-2 bg-[#337ab7] text-white hover:bg-[#2e6da4] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create audio files for the entered English text in all supported languages (English, Marathi, Hindi, Gujarati)"
              >
                {isGenerating ? 'Creating...' : 'Create Audio Files'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Audio File</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setFileToDelete(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 p-3">
                <p className="text-red-800 text-sm">
                  <strong>Warning:</strong> This action will permanently delete:
                </p>
                <ul className="text-red-700 text-sm mt-2 list-disc list-inside">
                  <li>The audio file record from the database</li>
                  <li>All physical audio files (English, Marathi, Hindi, Gujarati)</li>
                </ul>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">English Text</label>
                <p className="text-gray-800 font-mono text-sm bg-gray-50 p-2 border">
                  {fileToDelete.english_text}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setFileToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50"
                title="Cancel deleting the audio file and close the modal"
              >
                Cancel
              </button>
              <button
                onClick={deleteAudioFile}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700"
                title="Permanently delete this audio file and all its associated audio files from the database and server"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Text Modal */}
      {currentFile && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Audio File #{currentFile.id} - Full Text</h3>
              <button
                onClick={() => setCurrentFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">English Text</label>
                <div className="bg-gray-50 p-4 border max-h-60 overflow-y-auto">
                  <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap">
                    {currentFile.english_text}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { lang: 'English', translation: currentFile.english_translation },
                  { lang: 'Marathi', translation: currentFile.marathi_translation },
                  { lang: 'Hindi', translation: currentFile.hindi_translation },
                  { lang: 'Gujarati', translation: currentFile.gujarati_translation }
                ].map((item) => (
                  <div key={item.lang} className="border border-gray-200 p-3">
                    <h4 className="font-medium text-gray-900 text-sm mb-2">{item.lang} Translation</h4>
                    <div className="bg-gray-50 p-2 border max-h-32 overflow-y-auto">
                      <p className="text-gray-800 font-mono text-xs whitespace-pre-wrap">
                        {item.translation || 'Not available'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setCurrentFile(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50"
                title="Close the full text view modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioAnnouncementFiles; 