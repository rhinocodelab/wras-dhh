import React, { useState, useRef } from 'react';
import { Mic, MicOff, Play, Square, Download, Languages, X } from 'lucide-react';
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

interface SpeechToISLProps {
  onDataChange?: () => void;
}

export default function SpeechToISL({ onDataChange }: SpeechToISLProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [convertedText, setConvertedText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  
  // Progress modal state
  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    progress: 0,
    isError: false
  });
  
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { addToast } = useToast();

  // Check browser compatibility on component mount
  React.useEffect(() => {
    const checkBrowserSupport = () => {
      // Check if MediaDevices API exists
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      
      // Check if running on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      const isSupported = hasMediaDevices && isSecure;
      setIsBrowserSupported(isSupported);
      
      if (!hasMediaDevices) {
        addToast({
          type: 'warning',
          title: 'Browser Not Supported',
          message: 'Audio recording is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.'
        });
      } else if (!isSecure) {
        addToast({
          type: 'warning',
          title: 'HTTPS Required',
          message: 'Audio recording requires HTTPS. Please use HTTPS or localhost for development.'
        });
      }
    };
    
    checkBrowserSupport();
  }, [addToast]);

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'हिंदी' },
    { value: 'marathi', label: 'मराठी' },
    { value: 'gujarati', label: 'ગુજરાતી' }
  ];

  const startRecording = async () => {
    try {
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser');
      }

      // Check if running on HTTPS (required for getUserMedia)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        addToast({
          type: 'warning',
          title: 'HTTPS Required',
          message: 'Microphone access requires HTTPS. Please use HTTPS or localhost.'
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });
      
      // Check for supported MIME types
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      let selectedMimeType = null;
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('No supported audio format found');
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      // Toast removed - user can see recording status from the UI
    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      let errorMessage = 'Please allow microphone access and try again';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Your browser does not support audio recording. Please try a different browser.';
      } else if (error.message.includes('MediaDevices API')) {
        errorMessage = 'Your browser does not support audio recording. Please use a modern browser.';
      }
      
      addToast({
        type: 'error',
        title: 'Recording Failed',
        message: errorMessage
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      const recordingDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
      
      if (recordingDuration < 1000) { // Less than 1 second
        setProgressModal({
          isOpen: true,
          title: 'Recording Too Short',
          message: 'Please record for at least 1 second',
          progress: 0,
          isError: true
        });
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }
      
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingStartTime(null);
      
      // Progress modal will be shown in processAudio function
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    // Show progress modal for speech processing
    setProgressModal({
      isOpen: true,
      title: 'Processing Speech',
      message: 'Converting speech to text and translating to English...',
      progress: 10,
      isError: false
    });

    try {
      // Check audio file size
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      if (audioBlob.size < 1000) { // Less than 1KB
        setProgressModal({
          isOpen: true,
          title: 'Recording Too Short',
          message: 'Your recording is too short. Please record for at least 2-3 seconds with clear speech.',
          progress: 0,
          isError: true
        });
        return;
      }
      
      // Check if audio file is too large (more than 10MB)
      if (audioBlob.size > 10 * 1024 * 1024) {
        setProgressModal({
          isOpen: true,
          title: 'Recording Too Large',
          message: 'Your recording is too large. Please record a shorter message (under 30 seconds).',
          progress: 0,
          isError: true
        });
        return;
      }
      
      // Update progress
      setProgressModal(prev => ({
        ...prev,
        message: 'Preparing audio file for upload...',
        progress: 30
      }));
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Determine the correct filename based on the MIME type
      let filename = 'speech.webm';
      if (audioBlob.type.includes('mp4')) {
        filename = 'speech.mp4';
      } else if (audioBlob.type.includes('wav')) {
        filename = 'speech.wav';
      }
      
      console.log('Audio blob type:', audioBlob.type);
      console.log('Using filename:', filename);
      
      formData.append('audio', audioBlob, filename);
      formData.append('language', selectedLanguage);

      // Update progress
      setProgressModal(prev => ({
        ...prev,
        message: 'Uploading audio file to server...',
        progress: 50
      }));

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/speech-to-text`, {
        method: 'POST',
        body: formData
      });

      // Update progress
      setProgressModal(prev => ({
        ...prev,
        message: 'Processing speech and translating to English...',
        progress: 80
      }));

      if (response.ok) {
        const result = await response.json();
        console.log('Speech-to-text API response:', result);
        
        if (result.success === false) {
          // Handle specific error cases
          if (result.message === 'No speech detected in the audio') {
            setProgressModal({
              isOpen: true,
              title: 'No Speech Detected',
              message: 'No speech was detected in your recording. Please try again with:\n\n• Speak louder and more clearly\n• Ensure your microphone is working\n• Record in a quieter environment\n• Speak for at least 2-3 seconds\n• Check if your browser has microphone permission',
              progress: 0,
              isError: true
            });
            return; // Don't throw error, just show the modal
          } else {
            throw new Error(result.message || 'Speech recognition failed');
          }
        }
        
        setConvertedText(formatTextWithSpaces(result.spoken_text || ''));
        setEnglishText(convertDigitsToWords(removePunctuation(formatTextWithSpaces(result.english_text || ''))));
        
        console.log('Setting converted text:', result.spoken_text);
        console.log('Setting English text:', result.english_text);
        
        // Show success in modal
        setProgressModal({
          isOpen: true,
          title: 'Speech Converted Successfully',
          message: 'Text converted and translated successfully',
          progress: 100,
          isError: false
        });

        // Close modal after 2 seconds
        setTimeout(() => {
          setProgressModal(prev => ({ ...prev, isOpen: false }));
        }, 2000);
      } else {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.detail || 'Failed to convert speech to text');
      }
    } catch (error: any) {
      console.error('Error processing audio:', error);
      
      // Show error in modal
      setProgressModal({
        isOpen: true,
        title: 'Conversion Failed',
        message: error.message || 'Failed to convert speech to text',
        progress: 0,
        isError: true
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const [resultData, setResultData] = useState<{
    videoUrl: string;
    audioUrl: string;
    success: boolean;
    message: string;
  } | null>(null);

  const [generatedFiles, setGeneratedFiles] = useState<{
    videoFile?: string;
    audioFile?: string;
  }>({});

  const generateISLVideo = async (text: string) => {
    try {
      // Show progress modal
      setProgressModal({
        isOpen: true,
        title: 'Generating ISL Video',
        message: 'Initializing video generation and searching for existing audio files...',
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

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/speech-to-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spoken_text: convertedText,
          english_text: englishText || convertedText, // Use English text or fallback to spoken text
          language: selectedLanguage
        })
      });

      clearInterval(progressInterval);

      if (response.ok) {
        const result = await response.json();
        console.log('Speech-to-ISL result:', result);
        
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
          
          // Store generated file paths for cleanup
          setGeneratedFiles({
            videoFile: result.video_url ? result.video_url.split('/').pop() : undefined,
            audioFile: result.audio_url ? result.audio_url.split('/').pop() : undefined
          });
          
          // Show success in modal
          setProgressModal({
            isOpen: true,
            title: 'ISL Video Generated Successfully',
            message: 'Video and audio created successfully using existing audio files where available',
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

      // Use the original URLs from the API - the backend will convert them to static file paths
      const videoUrl = resultData.videoUrl;
      const audioUrl = resultData.audioUrl;

      console.log('Publishing with original URLs:', { videoUrl, audioUrl });
      console.log('Publishing with data:', {
        video_url: videoUrl,
        audio_url: audioUrl,
        english_text: englishText || convertedText
      });

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/publish-speech-isl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_url: videoUrl,
          audio_url: audioUrl,
          english_text: englishText || convertedText
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Publish ISL result:', result);
        
        if (result.success) {
          // Show success in modal
          setProgressModal({
            isOpen: true,
            title: 'ISL Video Published Successfully',
            message: 'HTML page created successfully. Opening in new tab...',
            progress: 100,
            isError: false
          });

          // Close modal after 2 seconds
          setTimeout(() => {
            setProgressModal(prev => ({ ...prev, isOpen: false }));
          }, 2000);

          // Open the HTML page in a new tab
          // Use the direct translation API URL for opening the HTML file
          const translationApiUrl = import.meta.env.DEV ? 'http://localhost:5001' : 'http://localhost:5001';
          const htmlUrl = `${translationApiUrl}${result.html_url}`;
          console.log('Opening HTML URL:', htmlUrl);
          
          // Try to open the URL in a new tab
          const newWindow = window.open(htmlUrl, '_blank');
          
          // Also try to fetch the HTML content to verify it's accessible
          try {
            const htmlResponse = await fetch(htmlUrl);
            if (!htmlResponse.ok) {
              console.error('HTML file not accessible:', htmlResponse.status, htmlResponse.statusText);
              addToast({
                type: 'warning',
                title: 'HTML File Not Accessible',
                message: 'The published HTML file may not be accessible. Please check the URL: ' + htmlUrl
              });
            } else {
              console.log('HTML file is accessible');
            }
          } catch (error) {
            console.error('Error checking HTML file accessibility:', error);
          }
          
          // If the window is blocked or fails, show a message
          if (!newWindow) {
            addToast({
              type: 'warning',
              title: 'Popup Blocked',
              message: 'Please allow popups and try again, or copy this URL: ' + htmlUrl
            });
          } else {
            // Add a small delay to check if the window loaded successfully
            setTimeout(() => {
              if (newWindow.closed) {
                addToast({
                  type: 'error',
                  title: 'Page Failed to Load',
                  message: 'The published page failed to load. Please check the URL: ' + htmlUrl
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

      addToast({
        type: 'error',
        title: 'Publishing Failed',
        message: error.message || 'Failed to publish ISL video'
      });
    }
  };

  const formatTextWithSpaces = (text: string) => {
    // Add spaces between digits when there are more than 2 consecutive digits
    return text.replace(/(\d{3,})/g, (match) => {
      return match.split('').join(' ');
    });
  };

  const removePunctuation = (text: string) => {
    return text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const convertDigitsToWords = (text: string) => {
    const digitMapping: { [key: string]: string } = {
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
    
    // Replace individual digits with their word equivalents
    return text.replace(/\d/g, (digit) => digitMapping[digit] || digit);
  };

  const testMicrophone = async () => {
    try {
      setIsTestingMic(true);
      setMicTestResult('Testing microphone...');
      
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicTestResult('❌ MediaDevices API not supported in this browser');
        return;
      }

      // Check if running on HTTPS
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setMicTestResult('❌ Microphone access requires HTTPS');
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });
      
      // Stop the stream immediately after testing
      stream.getTracks().forEach(track => track.stop());
      
      setMicTestResult('✅ Microphone is working properly');
      
      // Clear the result after 3 seconds
      setTimeout(() => {
        setMicTestResult('');
      }, 3000);
      
    } catch (error: any) {
      console.error('Microphone test error:', error);
      
      let errorMessage = '❌ Microphone test failed';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '❌ Microphone access denied. Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '❌ No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '❌ Your browser does not support microphone access.';
      }
      
      setMicTestResult(errorMessage);
    } finally {
      setIsTestingMic(false);
    }
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
              file_path: `/var/www/final_speech_isl_vid/${generatedFiles.videoFile}`
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
              file_path: `/var/www/audio_files/merged_speech_to_isl/${generatedFiles.audioFile}`
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

      await fetch(`${TRANSLATION_API_BASE_URL}/api/cleanup-publish-speech-isl`, {
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
      setConvertedText('');
      setEnglishText('');
      setVideoUrl('');
      setIsVideoPlaying(false);
      setResultData(null);
      setMicTestResult(''); // Clear microphone test result
      setGeneratedFiles({}); // Clear generated files tracking
      
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Speech to ISL</h1>
        <p className="text-gray-600 text-xs">
          Convert speech to Indian Sign Language videos. Select your spoken language and record to generate ISL videos.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Speech Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Language Selection and Recording */}
            <div>
              <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
                <Languages className="inline h-4 w-4 mr-2" />
                Select Spoken Language
              </label>
              <div className="flex items-center space-x-3">
                <select
                  id="language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent bg-white text-gray-900 text-sm"
                >
                  {languages.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing || !isBrowserSupported}
                  className={`flex items-center justify-center px-3 py-1.5 rounded-none font-medium transition-colors text-sm ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#337ab7] hover:bg-[#2e6da4] text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={!isBrowserSupported ? 'Audio recording not supported in this browser' : (isRecording ? 'Stop Recording' : 'Start Recording')}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Recording Tips and Microphone Test */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-blue-800">📝 Recording Tips:</h4>
                <button
                  onClick={testMicrophone}
                  disabled={isTestingMic}
                  className="px-3 py-1.5 bg-[#337ab7] hover:bg-[#2e6da4] text-white rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingMic ? 'Testing...' : 'Test Mic'}
                </button>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Speak clearly and at a normal pace</li>
                <li>• Record in a quiet environment</li>
                <li>• Keep microphone close to your mouth</li>
                <li>• Record for at least 2-3 seconds</li>
                <li>• Avoid background noise and echo</li>
              </ul>
              {micTestResult && (
                <div className="mt-2 p-2 bg-white rounded text-xs">
                  {micTestResult}
                </div>
              )}
            </div>

            {/* Status Indicators */}
            {(isRecording || isProcessing) && (
              <div className="space-y-2">
                {isRecording && (
                  <div className="flex items-center space-x-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">Recording...</span>
                  </div>
                )}

                {isProcessing && (
                  <div className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-xs font-medium">Processing...</span>
                  </div>
                )}
              </div>
            )}

            {/* Text Areas */}
            <div className="space-y-4">
              {/* Spoken Language Text Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spoken Language Text ({languages.find(lang => lang.value === selectedLanguage)?.label || selectedLanguage})
                </label>
                <textarea
                  value={convertedText}
                  onChange={(e) => setConvertedText(formatTextWithSpaces(e.target.value))}
                  placeholder={`Enter or record text in ${selectedLanguage}...`}
                  className="w-full h-24 px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent bg-white text-gray-900 text-sm resize-none"
                  disabled={isProcessing}
                />
              </div>

              {/* English Text Area for ISL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English Text for ISL Generation
                </label>
                <textarea
                  value={englishText}
                  onChange={(e) => setEnglishText(convertDigitsToWords(removePunctuation(formatTextWithSpaces(e.target.value))))}
                  placeholder="Enter English text for ISL video generation..."
                  className="w-full h-24 px-3 py-1.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent bg-white text-gray-900 text-sm resize-none"
                />
              </div>

              {/* Clear All Button */}
              {(convertedText || englishText || resultData) && (
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
                    <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No video available</p>
                    <p className="text-xs mt-1">Record speech to generate ISL video</p>
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
            {englishText && (
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => generateISLVideo(englishText || convertedText)}
                  disabled={!englishText}
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