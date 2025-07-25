import React, { useState } from 'react';
import { Type, Play, Download, Languages, X } from 'lucide-react';
import { useToast } from './ToastContainer';
import { TRANSLATION_API_BASE_URL } from '../config/api';

interface ProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  progress?: number;
  isError?: boolean;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  progress, 
  isError = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${isError ? 'text-red-600' : 'text-gray-900'}`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-4">
          <div className="text-gray-600 text-sm whitespace-pre-line">{message}</div>
        </div>
        
        {progress !== undefined && !isError && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
          </div>
        )}
        
        {isError && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface TextToISLProps {
  onDataChange?: () => void;
}

export default function TextToISL({ onDataChange }: TextToISLProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  
  // Progress modal state
  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    progress: 0,
    isError: false
  });
  
  const { addToast } = useToast();

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'marathi', label: 'Marathi' },
    { value: 'gujarati', label: 'Gujarati' }
  ];

  const formatTextWithSpaces = (text: string) => {
    return text.replace(/\s+/g, ' ').trim();
  };

  const removePunctuation = (text: string) => {
    return text.replace(/[^\w\s]/g, '');
  };

  const convertDigitsToWords = (text: string) => {
    const digitWords: { [key: string]: string } = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
    };
    
    return text.replace(/\d/g, (match) => digitWords[match] || match);
  };

  const generateISLVideo = async (text: string) => {
    try {
      // Process the text before sending to API
      const processedText = convertDigitsToWords(removePunctuation(formatTextWithSpaces(text)));
      
      // Show progress modal
      setProgressModal({
        isOpen: true,
        title: 'Generating ISL Video',
        message: 'Initializing video generation...',
        progress: 10,
        isError: false
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgressModal(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 1000);

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/text-to-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: processedText,
          language: selectedLanguage
        })
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const result = await response.json();
        console.log('Text-to-ISL result:', result);
        
        if (result.success) {
          console.log('Generated video URLs:', { 
            video_url: result.video_url, 
            audio_url: result.audio_url 
          });
          setResultData({
            videoUrl: result.video_url,
            audioUrl: result.audio_url,
            success: true,
            message: result.message
          });
          
          // Update video URL for the player
          if (result.video_url) {
            setVideoUrl(result.video_url);
          }
          
          // Show success in modal
          setProgressModal({
            isOpen: true,
            title: 'ISL Video Generated Successfully',
            message: 'Video and audio created successfully',
            progress: 100,
            isError: false
          });

          // Close modal after 2 seconds
          setTimeout(() => {
            setProgressModal(prev => ({ ...prev, isOpen: false }));
          }, 2000);
        } else {
          throw new Error(result.message || 'Failed to generate ISL video');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate ISL video');
      }
    } catch (error: any) {
      console.error('Error generating ISL video:', error);
      
      // Show error in modal
      setProgressModal({
        isOpen: true,
        title: 'Video Generation Failed',
        message: error.message || 'Failed to generate ISL video',
        progress: 0,
        isError: true
      });
    }
  };

  const publishISLVideo = async () => {
    if (!resultData || !resultData.success) {
      addToast({
        type: 'error',
        title: 'No Video Available',
        message: 'Please generate an ISL video first before publishing'
      });
      return;
    }

    try {
      // Show progress modal
      setProgressModal({
        isOpen: true,
        title: 'Publishing ISL Video',
        message: 'Creating HTML page with video and audio...',
        progress: 10,
        isError: false
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgressModal(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 15, 90)
        }));
      }, 500);

      // Use the original URLs from the API - the backend will convert them to static file paths
      const videoUrl = resultData.videoUrl;
      const audioUrl = resultData.audioUrl;
      console.log('Publishing with original URLs:', { videoUrl, audioUrl });
      console.log('Publishing with data:', {
        video_url: videoUrl,
        audio_url: audioUrl,
        english_text: inputText
      });

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/publish-text-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_url: videoUrl,
          audio_url: audioUrl,
          text: inputText
        })
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Show success in modal
          setProgressModal({
            isOpen: true,
            title: 'Video Published Successfully',
            message: 'HTML page created and will open in a new tab',
            progress: 100,
            isError: false
          });

          // Close modal after 1 second
          setTimeout(() => {
            setProgressModal(prev => ({ ...prev, isOpen: false }));
          }, 1000);

          // Use the direct translation API URL for opening the HTML file
          const translationApiUrl = import.meta.env.DEV ? 'http://localhost:5001' : 'http://localhost:5001';
          const htmlUrl = `${translationApiUrl}${result.html_url}`;
          console.log('Opening HTML URL:', htmlUrl);
          
          const newWindow = window.open(htmlUrl, '_blank');
          if (!newWindow) {
            addToast({
              type: 'error',
              title: 'Popup Blocked',
              message: 'Please allow popups for this site to open the published video'
            });
          } else {
            // Check if the HTML file is accessible
            try {
              const htmlResponse = await fetch(htmlUrl);
              if (!htmlResponse.ok) {
                addToast({
                  type: 'error',
                  title: 'HTML Not Accessible',
                  message: 'The published HTML page could not be accessed'
                });
              } else {
                console.log('HTML file is accessible');
              }
            } catch (error) {
              console.error('Error checking HTML accessibility:', error);
            }

            // Check if the page loaded successfully
            setTimeout(() => {
              if (newWindow.closed) {
                addToast({
                  type: 'error',
                  title: 'Page Failed to Load',
                  message: 'The published page failed to load properly'
                });
              }
            }, 2000);
          }

          addToast({
            type: 'success',
            title: 'Video Published',
            message: 'ISL video has been published and opened in a new tab'
          });
        } else {
          throw new Error(result.message || 'Failed to publish ISL video');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to publish ISL video');
      }
    } catch (error: any) {
      console.error('Error publishing ISL video:', error);
      
      // Show error in modal
      setProgressModal({
        isOpen: true,
        title: 'Publishing Failed',
        message: error.message || 'Failed to publish ISL video',
        progress: 0,
        isError: true
      });
    }
  };

  const clearAll = async () => {
    try {
      // Show progress modal
      setProgressModal({
        isOpen: true,
        title: 'Clearing Data',
        message: 'Removing generated files...',
        progress: 0,
        isError: false
      });

      // Clean up generated files on the server
      const cleanupPromises = [];

      // Clean up Text-to-ISL videos
      try {
        const videoResponse = await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-text-isl-videos`, {
          method: 'DELETE'
        });
        if (videoResponse.ok) {
          console.log('Text-to-ISL videos cleaned up');
        }
      } catch (error) {
        console.warn('Failed to cleanup videos:', error);
      }

      // Clean up Text-to-ISL audio files
      try {
        const audioResponse = await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-text-isl-audio`, {
          method: 'DELETE'
        });
        if (audioResponse.ok) {
          console.log('Text-to-ISL audio files cleaned up');
        }
      } catch (error) {
        console.warn('Failed to cleanup audio:', error);
      }

      // Clean up published Text-to-ISL HTML files
      try {
        const htmlResponse = await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-publish-text-isl`, {
          method: 'DELETE'
        });
        if (htmlResponse.ok) {
          console.log('Published Text-to-ISL HTML files cleaned up');
        }
      } catch (error) {
        console.warn('Failed to cleanup HTML files:', error);
      }

      // Update progress
      setProgressModal({
        isOpen: true,
        title: 'Clearing Data',
        message: 'Files removed successfully!\nClearing UI...',
        progress: 100,
        isError: false
      });

      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear UI state
      setInputText('');
      setVideoUrl('');
      setIsVideoPlaying(false);
      setResultData(null);
      
      // Close progress modal
      setProgressModal({
        isOpen: false,
        title: '',
        message: '',
        progress: 0,
        isError: false
      });

      addToast({
        type: 'success',
        title: 'Cleared Successfully',
        message: 'All data, generated videos, audio files, and HTML pages have been removed'
      });

    } catch (error) {
      console.error('Error clearing data:', error);
      
      // Close progress modal
      setProgressModal({
        isOpen: false,
        title: '',
        message: '',
        progress: 0,
        isError: false
      });

      addToast({
        type: 'error',
        title: 'Clear Failed',
        message: 'Failed to clear some files. Please try again.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Text to ISL</h1>
        <p className="text-gray-600 text-xs">
          Convert text to Indian Sign Language videos. Enter text in any supported language to generate ISL videos.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Text Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Language Selection */}
            <div>
              <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
                <Languages className="inline h-4 w-4 mr-2" />
                Select Text Language
              </label>
              <select
                id="language-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent bg-white text-gray-900 text-sm"
              >
                {languages.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Type className="inline h-4 w-4 mr-2" />
                Enter Text for ISL Generation
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Enter text in ${selectedLanguage} for ISL video generation...`}
                className="w-full h-32 px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent bg-white text-gray-900 text-sm resize-none"
                disabled={isProcessing}
              />
            </div>

            {/* Clear All Button */}
            {(inputText || resultData) && (
              <div className="flex space-x-2">
                <button
                  onClick={() => clearAll()}
                  className="px-2 py-1 bg-[#337ab7] text-white rounded-none hover:bg-[#2e6da4] text-xs transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Video Player */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">ISL Video Player</h3>
            </div>

            {/* Success Message */}
            {resultData && resultData.success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-800 font-medium">{resultData.message}</span>
                </div>
              </div>
            )}

            <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {videoUrl ? (
                <video
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  muted
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  <source src={`${TRANSLATION_API_BASE_URL}${videoUrl}`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No video available</p>
                    <p className="text-xs mt-1">Enter text to generate ISL video</p>
                  </div>
                </div>
              )}
            </div>

            {videoUrl && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {isVideoPlaying ? 'Video is playing' : 'Video is paused'}
                </p>
              </div>
            )}

            {/* Generate ISL Video Button */}
            {inputText && (
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => generateISLVideo(inputText)}
                  disabled={!inputText}
                  className="px-3 py-1.5 bg-[#337ab7] hover:bg-[#2e6da4] text-white rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate ISL Video
                </button>
                {resultData && resultData.success && (
                  <button
                    onClick={() => publishISLVideo()}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none transition-colors text-sm"
                  >
                    Publish ISL Video
                  </button>
                )}
              </div>
            )}

            {/* Audio Player */}
            {resultData && resultData.audioUrl && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Announcement Audio</h4>
                <div className="bg-gray-100 rounded-lg p-4">
                  <audio
                    className="w-full"
                    controls
                    autoPlay
                  >
                    <source src={`${TRANSLATION_API_BASE_URL}${resultData.audioUrl}`} type="audio/mpeg" />
                    <source src={`${TRANSLATION_API_BASE_URL}${resultData.audioUrl}`} type="audio/wav" />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <ProgressModal
        isOpen={progressModal.isOpen}
        onClose={() => setProgressModal(prev => ({ ...prev, isOpen: false }))}
        title={progressModal.title}
        message={progressModal.message}
        progress={progressModal.progress}
        isError={progressModal.isError}
      />
    </div>
  );
} 