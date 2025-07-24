import React, { useState, useRef } from 'react';
import { Mic, MicOff, Play, Square, Download, Languages } from 'lucide-react';
import { useToast } from './ToastContainer';

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { addToast } = useToast();

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'हिंदी' },
    { value: 'marathi', label: 'मराठी' },
    { value: 'gujarati', label: 'ગુજરાતી' }
  ];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      addToast({
        type: 'success',
        title: 'Recording Started',
        message: `Recording in ${selectedLanguage} language`
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      addToast({
        type: 'error',
        title: 'Recording Failed',
        message: 'Please allow microphone access and try again'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
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
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.wav');
      formData.append('language', selectedLanguage);

      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setConvertedText(result.text);
        addToast({
          type: 'success',
          title: 'Speech Converted',
          message: 'Text converted successfully'
        });
        
        // Generate ISL video based on converted text
        await generateISLVideo(result.text);
      } else {
        throw new Error('Failed to convert speech to text');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      addToast({
        type: 'error',
        title: 'Conversion Failed',
        message: 'Failed to convert speech to text'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateISLVideo = async (text: string) => {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/generate-isl-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          announcement_text: text,
          language: selectedLanguage
        })
      });

      if (response.ok) {
        const result = await response.json();
        setVideoUrl(result.video_url);
        addToast({
          type: 'success',
          title: 'ISL Video Generated',
          message: 'Video created successfully'
        });
      } else {
        throw new Error('Failed to generate ISL video');
      }
    } catch (error) {
      console.error('Error generating ISL video:', error);
      addToast({
        type: 'error',
        title: 'Video Generation Failed',
        message: 'Failed to generate ISL video'
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
                  disabled={isProcessing}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
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

              {/* Action Buttons */}
              {(convertedText || englishText) && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => generateISLVideo(englishText || convertedText)}
                    disabled={!englishText && !convertedText}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4" />
                    <span>Generate ISL Video</span>
                  </button>
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
              {videoUrl && (
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = videoUrl;
                    link.download = 'isl-video.mp4';
                    link.click();
                  }}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              )}
            </div>

            <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video">
              {videoUrl ? (
                <video
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
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
          </div>
        </div>
      </div>
    </div>
  );
} 