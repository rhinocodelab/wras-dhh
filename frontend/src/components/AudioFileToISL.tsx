import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Play, Pause, Volume2, VolumeX, RotateCcw, Languages, Trash2 } from 'lucide-react';
import { TRANSLATION_API_BASE_URL } from '../config/api';
import { useToast } from './ToastContainer';

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
        <div className="text-center">
          <h3 className={`text-lg font-semibold mb-2 ${isError ? 'text-red-600' : 'text-gray-900'}`}>
            {title}
          </h3>
          <p className="text-gray-600 mb-4">{message}</p>
          
          {progress !== undefined && !isError && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
          
          {isError && (
            <button
              onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface AudioFileToISLProps {
  onDataChange?: () => void;
}

export default function AudioFileToISL({ onDataChange }: AudioFileToISLProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [transcribedText, setTranscribedText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    progress: number;
    isError: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    progress: 0,
    isError: false
  });
  const [generatedFiles, setGeneratedFiles] = useState<{
    videoFile?: string;
    audioFile?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { addToast } = useToast();

  const languages = [
    { value: 'en-IN', label: 'English' },
    { value: 'hi-IN', label: 'हिंदी' },
    { value: 'mr-IN', label: 'मराठी' },
    { value: 'gu-IN', label: 'ગુજરાતી' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.mp3') && !file.name.toLowerCase().endsWith('.wav')) {
        addToast({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please select an MP3 or WAV file'
        });
        return;
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: 'File Too Large',
          message: 'Please select a file smaller than 50MB'
        });
        return;
      }

      setSelectedFile(file);
      addToast({
        type: 'success',
        title: 'File Selected',
        message: `Selected: ${file.name}`
      });
    }
  };

  const processAudioFile = async () => {
    if (!selectedFile) {
      addToast({
        type: 'error',
        title: 'No File Selected',
        message: 'Please select an audio file first'
      });
      return;
    }

    setIsProcessing(true);
    
    // Show progress modal for transcription
    setProgressModal({
      isOpen: true,
      title: 'Transcribing Audio File',
      message: 'Converting audio to text using GCP Speech-to-Text...',
      progress: 10,
      isError: false
    });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio_file', selectedFile);
      formData.append('language', selectedLanguage);

      // Update progress
      setProgressModal(prev => ({
        ...prev,
        message: 'Uploading audio file...',
        progress: 20
      }));

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/audio-file-to-isl`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to transcribe audio file');
      }

      setProgressModal(prev => ({
        ...prev,
        message: 'Transcription completed successfully!',
        progress: 100
      }));

      const result = await response.json();
      
      if (result.success) {
        // Convert digits to words in the transcribed text
        const processedText = convertDigitsToWords(result.transcribed_text);
        setTranscribedText(processedText);
        setVideoUrl(result.video_url);
        setResultData(result);
        
        // Track generated files for cleanup
        setGeneratedFiles({
          videoFile: result.video_url ? result.video_url.split('/').pop() : undefined,
          audioFile: result.audio_url ? result.audio_url.split('/').pop() : undefined
        });

        addToast({
          type: 'success',
          title: 'Transcription Complete!',
          message: 'Audio file transcribed successfully. You can now generate ISL video.'
        });

        // Call onDataChange if provided
        if (onDataChange) {
          onDataChange();
        }
      } else {
        throw new Error(result.message || 'Failed to transcribe audio file');
      }

      // Wait a moment to show completion
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 1000);

    } catch (error: any) {
      console.error('Error transcribing audio file:', error);
      
      setProgressModal(prev => ({
        ...prev,
        title: 'Transcription Error',
        message: error.message || 'Failed to transcribe audio file. Please try again.',
        progress: 0,
        isError: true
      }));

      // Wait a moment to show error
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 3000);

      addToast({
        type: 'error',
        title: 'Transcription Failed',
        message: error.message || 'Failed to transcribe audio file. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateISLVideo = async () => {
    if (!transcribedText) {
      addToast({
        type: 'error',
        title: 'No Text Available',
        message: 'Please transcribe an audio file first'
      });
      return;
    }

    setIsProcessing(true);
    
    // Show progress modal for ISL generation
    setProgressModal({
      isOpen: true,
      title: 'Generating ISL Video',
      message: 'Creating Indian Sign Language video from transcribed text...',
      progress: 10,
      isError: false
    });

    try {
      // Create request body for ISL generation
      const requestBody = {
        text: transcribedText,
        language: selectedLanguage
      };

      // Update progress
      setProgressModal(prev => ({
        ...prev,
        message: 'Processing text and generating ISL video...',
        progress: 30
      }));

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/text-to-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate ISL video');
      }

      setProgressModal(prev => ({
        ...prev,
        message: 'ISL video generated successfully!',
        progress: 100
      }));

      const result = await response.json();
      
      if (result.success) {
        setVideoUrl(result.video_url);
        setResultData(result);
        
        // Track generated files for cleanup
        setGeneratedFiles({
          videoFile: result.video_url ? result.video_url.split('/').pop() : undefined,
          audioFile: result.audio_url ? result.audio_url.split('/').pop() : undefined
        });

        addToast({
          type: 'success',
          title: 'ISL Video Generated!',
          message: 'Indian Sign Language video created successfully.'
        });

        // Call onDataChange if provided
        if (onDataChange) {
          onDataChange();
        }
      } else {
        throw new Error(result.message || 'Failed to generate ISL video');
      }

      // Wait a moment to show completion
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 1000);

    } catch (error: any) {
      console.error('Error generating ISL video:', error);
      
      setProgressModal(prev => ({
        ...prev,
        title: 'ISL Generation Error',
        message: error.message || 'Failed to generate ISL video. Please try again.',
        progress: 0,
        isError: true
      }));

      // Wait a moment to show error
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 3000);

      addToast({
        type: 'error',
        title: 'ISL Generation Failed',
        message: error.message || 'Failed to generate ISL video. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const publishISLVideo = async () => {
    if (!resultData || !videoUrl) {
      addToast({
        type: 'error',
        title: 'No Video Available',
        message: 'Please generate an ISL video first'
      });
      return;
    }

    setProgressModal({
      isOpen: true,
      title: 'Publishing ISL Video',
      message: 'Creating HTML page...',
      progress: 10,
      isError: false
    });

    try {
      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/publish-audio-file-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_url: videoUrl,
          audio_url: resultData.audio_url,
          text: transcribedText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to publish ISL video');
      }

      const result = await response.json();
      
      if (result.success) {
        setProgressModal(prev => ({
          ...prev,
          message: 'HTML page created successfully!',
          progress: 100
        }));

        // Open the published HTML page in a new tab
        const translationApiUrl = 'http://localhost:5001';
        const fullUrl = `${translationApiUrl}${result.html_url}`;
        
        setTimeout(() => {
          setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
          window.open(fullUrl, '_blank');
        }, 1000);

        addToast({
          type: 'success',
          title: 'Published Successfully',
          message: 'ISL video published and opened in new tab'
        });
      } else {
        throw new Error(result.message || 'Failed to publish ISL video');
      }

    } catch (error: any) {
      console.error('Error publishing ISL video:', error);
      
      setProgressModal(prev => ({
        ...prev,
        title: 'Publishing Error',
        message: error.message || 'Failed to publish ISL video. Please try again.',
        progress: 0,
        isError: true
      }));

      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 3000);

      addToast({
        type: 'error',
        title: 'Publishing Failed',
        message: error.message || 'Failed to publish ISL video. Please try again.'
      });
    }
  };

  const toggleVideoPlayback = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (audioRef.current.muted) {
        audioRef.current.muted = false;
        audioRef.current.play();
      } else {
        audioRef.current.muted = true;
        audioRef.current.pause();
      }
    }
  };

  const resetVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  // Function to convert digits to words
  const convertDigitsToWords = (text: string): string => {
    const digitToWord: { [key: string]: string } = {
      '0': 'zero',
      '1': 'one',
      '2': 'two',
      '3': 'three',
      '4': 'four',
      '5': 'five',
      '6': 'six',
      '7': 'seven',
      '8': 'eight',
      '9': 'nine'
    };

    // Replace any sequence of digits with individual digit words
    // This will convert 100 to "one zero zero", 12345 to "one two three four five", etc.
    let result = text.replace(/\b\d+\b/g, (match) => {
      return match.split('').map(digit => digitToWord[digit] || digit).join(' ');
    });

    return result;
  };

  const clearAll = async () => {
    // Show progress modal during cleanup
    setProgressModal({
      isOpen: true,
      title: 'Clearing All Data',
      message: 'Cleaning up generated files and published HTML pages...',
      progress: 10,
      isError: false
    });

    try {
      // Clean up generated files on server if they exist
      if (generatedFiles.videoFile || generatedFiles.audioFile) {
        setProgressModal(prev => ({
          ...prev,
          message: 'Cleaning up video and audio files...',
          progress: 30
        }));

        // Clean up video file
        if (generatedFiles.videoFile) {
          await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-file`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file_path: `/var/www/final_audio_file_isl_vid/${generatedFiles.videoFile}`
            })
          });
        }
        
        // Clean up audio file
        if (generatedFiles.audioFile) {
          await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-file`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file_path: `/var/www/audio_files/merged_audio_file_isl/${generatedFiles.audioFile}`
            })
          });
        }
        
        console.log('Generated files cleaned up successfully');
      }

      // Clean up published HTML files
      setProgressModal(prev => ({
        ...prev,
        message: 'Cleaning up published HTML pages...',
        progress: 60
      }));

      await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-publish-audio-file-isl`, {
        method: 'DELETE'
      });

      setProgressModal(prev => ({
        ...prev,
        message: 'Cleanup completed successfully!',
        progress: 100
      }));

      // Wait a moment to show completion
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 1000);

      // Clear UI state
      setSelectedFile(null);
      setTranscribedText('');
      setVideoUrl('');
      setIsVideoPlaying(false);
      setResultData(null);
      setGeneratedFiles({});
      
      addToast({
        type: 'success',
        title: 'Cleared Successfully',
        message: 'All data, generated video, audio, and published HTML pages cleared from server'
      });

    } catch (error) {
      console.error('Error during cleanup:', error);
      
      setProgressModal(prev => ({
        ...prev,
        title: 'Cleanup Error',
        message: 'Some files could not be cleaned up. Please try again.',
        progress: 0,
        isError: true
      }));

      // Wait a moment to show error
      setTimeout(() => {
        setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false });
      }, 2000);

      addToast({
        type: 'error',
        title: 'Cleanup Failed',
        message: 'Some files could not be cleaned up. Please try again.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Audio File to ISL</h1>
        <p className="text-gray-600 text-xs">
          Step 1: Upload an audio file (MP3 or WAV) to transcribe it to text using GCP Speech-to-Text<br />
          Step 2: Generate Indian Sign Language videos from the transcribed text
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - File Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Language Selection */}
            <div>
              <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
                <Languages className="inline h-4 w-4 mr-2" />
                Select Audio Language
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

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileAudio className="inline h-4 w-4 mr-2" />
                Upload Audio File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept=".mp3,.wav"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="audio-file-input"
                />
                <label htmlFor="audio-file-input" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    MP3 or WAV files only, max 50MB
                  </p>
                </label>
              </div>
              {selectedFile && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-800">
                    <strong>Selected:</strong> {selectedFile.name}
                  </p>
                  <p className="text-xs text-green-600">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

                         {/* Transcribed Text */}
            {transcribedText && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Transcribed Text</h4>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-gray-800 text-xs leading-relaxed">{transcribedText}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={processAudioFile}
                disabled={!selectedFile || isProcessing}
                className="w-full bg-[#337ab7] hover:bg-[#2e6da4] text-white px-4 py-2 rounded-none font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isProcessing ? 'Transcribing...' : 'Transcribe Audio'}
              </button>

              <button
                onClick={clearAll}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-none font-medium transition-colors text-sm"
              >
                <Trash2 className="inline h-4 w-4 mr-2" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
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
                  ref={videoRef}
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
                    <FileAudio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No video available</p>
                    <p className="text-xs mt-1">Upload audio file to generate ISL video</p>
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
            {transcribedText && (
              <div className="flex justify-center space-x-2">
                <button
                  onClick={generateISLVideo}
                  disabled={!transcribedText || isProcessing}
                  className="px-3 py-1.5 bg-[#337ab7] hover:bg-[#2e6da4] text-white rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Generating...' : 'Generate ISL Video'}
                </button>
                {resultData && resultData.success && (
                  <button
                    onClick={publishISLVideo}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-none transition-colors text-sm"
                  >
                    Publish ISL Video
                  </button>
                )}
              </div>
            )}

            {/* Audio Player */}
            {resultData && resultData.audio_url && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Announcement Audio</h4>
                <div className="bg-gray-100 rounded-lg p-4">
                  <audio
                    ref={audioRef}
                    className="w-full"
                    controls
                    autoPlay
                  >
                    <source src={`${TRANSLATION_API_BASE_URL}${resultData.audio_url}`} type="audio/mpeg" />
                    <source src={`${TRANSLATION_API_BASE_URL}${resultData.audio_url}`} type="audio/wav" />
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
        onClose={() => setProgressModal({ isOpen: false, title: '', message: '', progress: 0, isError: false })}
        title={progressModal.title}
        message={progressModal.message}
        progress={progressModal.progress}
        isError={progressModal.isError}
      />
    </div>
  );
} 