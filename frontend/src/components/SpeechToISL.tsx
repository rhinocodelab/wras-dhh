import React, { useState, useRef } from 'react';
import { Mic, MicOff, Play, Square, Download, Languages } from 'lucide-react';
import { useToast } from './ToastContainer';
import { TRANSLATION_API_BASE_URL } from '../config/api';

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
      addToast({
        type: 'success',
        title: 'Recording Started',
        message: `Recording in ${selectedLanguage} language`
      });
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
        addToast({
          type: 'warning',
          title: 'Recording Too Short',
          message: 'Please record for at least 1 second'
        });
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }
      
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingStartTime(null);
      addToast({
        type: 'info',
        title: 'Recording Stopped',
        message: 'Processing audio...'
      });
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Check audio file size
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      if (audioBlob.size < 1000) { // Less than 1KB
        throw new Error('Audio file is too small. Please record for longer.');
      }
      
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

      const response = await fetch(`${TRANSLATION_API_BASE_URL}/api/speech-to-text`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Speech-to-text API response:', result);
        
        if (result.success === false && result.message === 'No speech detected in the audio') {
          throw new Error('No speech detected. Please speak clearly and try again.');
        }
        
        setConvertedText(result.spoken_text || '');
        setEnglishText(result.english_text || '');
        
        console.log('Setting converted text:', result.spoken_text);
        console.log('Setting English text:', result.english_text);
        
        addToast({
          type: 'success',
          title: 'Speech Converted',
          message: 'Text converted successfully'
        });
      } else {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.detail || 'Failed to convert speech to text');
      }
    } catch (error: any) {
      console.error('Error processing audio:', error);
      addToast({
        type: 'error',
        title: 'Conversion Failed',
        message: error.message || 'Failed to convert speech to text'
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

  const generateISLVideo = async (text: string) => {
    try {
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

              if (response.ok) {
          const result = await response.json();
          console.log('Speech-to-ISL result:', result);
          
          if (result.success) {
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
            
            addToast({
              type: 'success',
              title: 'ISL Video Generated',
              message: 'Video and audio created successfully'
            });
          } else {
            throw new Error(result.message || 'Failed to generate ISL video');
          }
        } else {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to generate ISL video');
        }
    } catch (error: any) {
      console.error('Error generating ISL video:', error);
      addToast({
        type: 'error',
        title: 'Video Generation Failed',
        message: error.message || 'Failed to generate ISL video'
      });
    }
  };

  const clearAll = () => {
    setConvertedText('');
    setEnglishText('');
    setVideoUrl('');
    setIsVideoPlaying(false);
    addToast({
      type: 'info',
      title: 'Cleared',
      message: 'All data cleared'
    });
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-xs"
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
                  className={`flex items-center justify-center w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                  onChange={(e) => setConvertedText(e.target.value)}
                  placeholder={`Enter or record text in ${selectedLanguage}...`}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm resize-none"
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
                  onChange={(e) => setEnglishText(e.target.value)}
                  placeholder="Enter English text for ISL video generation..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm resize-none"
                />

              </div>

              {/* Clear All Button */}
              {(convertedText || englishText) && (
                <div className="flex space-x-2">
                  <button
                    onClick={clearAll}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
                  >
                    <Square className="h-4 w-4" />
                    <span>Clear All</span>
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
                  <source src={videoUrl} type="video/mp4" />
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
                    <source src={resultData.audioUrl} type="audio/wav" />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              </div>
            )}

            {/* Generate ISL Video Button */}
            {englishText && (
              <div className="flex justify-center">
                                  <button
                    onClick={() => generateISLVideo(englishText || convertedText)}
                    disabled={!englishText}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                  <Play className="h-5 w-5" />
                  <span>Generate ISL Video</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
} 