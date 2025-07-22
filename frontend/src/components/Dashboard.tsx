import React, { useState, useEffect } from 'react';
import { Train, MapPin, Route, Users, Search, X, Volume2, Square } from 'lucide-react';
import { apiService } from '../services/api';
import { useToast } from './ToastContainer';

interface DashboardProps {
  stationCount: number;
  routeCount: number;
}

interface TrainRoute {
  id: number;
  train_number: string;
  train_name: string;
  start_station_name: string;
  end_station_name: string;
  start_station_code: string;
  end_station_code: string;
  platform_number?: number;
  announcement_category?: string;
}

export default function Dashboard({ stationCount, routeCount }: DashboardProps) {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<TrainRoute[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<number | null>(null);
  const [platformValues, setPlatformValues] = useState<{ [key: number]: number }>({});
  const [categoryValues, setCategoryValues] = useState<{ [key: number]: string }>({});
  const [generatingAudio, setGeneratingAudio] = useState<Set<number>>(new Set());
  const [availableTemplates, setAvailableTemplates] = useState<{ [key: string]: number }>({});
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<TrainRoute | null>(null);
  const [announcementTexts, setAnnouncementTexts] = useState<{
    english: string;
    hindi: string;
    marathi: string;
    gujarati: string;
  }>({
    english: '',
    hindi: '',
    marathi: '',
    gujarati: ''
  });
  const [isGeneratingMergedAudio, setIsGeneratingMergedAudio] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [mergedAudioPath, setMergedAudioPath] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [showPickTrainModal, setShowPickTrainModal] = useState(false);
  const [allTrainRoutes, setAllTrainRoutes] = useState<TrainRoute[]>([]);
  const [selectedTrains, setSelectedTrains] = useState<Set<number>>(new Set());
  const [isLoadingTrains, setIsLoadingTrains] = useState(false);

  const announcementCategories = [
    'arrival',
    'delay', 
    'platform_change',
    'cancellation'
  ];

  const getCategoryDisplayName = (category: string) => {
    const displayNames: { [key: string]: string } = {
      'arrival': 'Arrival',
      'delay': 'Delay',
      'platform_change': 'Platform Change',
      'cancellation': 'Cancellation'
    };
    return displayNames[category] || category;
  };

  // Load available templates on component mount
  useEffect(() => {
    const loadAvailableTemplates = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/final-announcement/available-templates');
        if (response.ok) {
          const data = await response.json();
          const templateMap: { [key: string]: number } = {};
          data.templates.forEach((template: any) => {
            templateMap[template.category.toLowerCase()] = template.id;
          });
          setAvailableTemplates(templateMap);
        }
      } catch (error) {
        console.error('Error loading available templates:', error);
      }
    };
    
    loadAvailableTemplates();
  }, []);

  // Load all train routes for pick train modal
  const loadAllTrainRoutes = async () => {
    try {
      setIsLoadingTrains(true);
      const response = await fetch('http://localhost:3001/api/train-routes/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('API response data:', data);
        setAllTrainRoutes(data.routes || []);
      } else {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error('Failed to load train routes');
      }
    } catch (error) {
      console.error('Error loading train routes:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load train routes'
      });
    } finally {
      setIsLoadingTrains(false);
    }
  };

  const handlePickTrainClick = () => {
    setShowPickTrainModal(true);
    loadAllTrainRoutes();
  };

  const handleTrainSelection = (trainId: number) => {
    setSelectedTrains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trainId)) {
        newSet.delete(trainId);
      } else {
        newSet.add(trainId);
      }
      return newSet;
    });
  };

  const handleAddSelectedTrains = () => {
    const selectedTrainData = allTrainRoutes.filter(train => selectedTrains.has(train.id));
    console.log('Selected train data:', selectedTrainData);
    
    setSearchResults(prev => {
      const existingIds = new Set(prev.map(train => train.id));
      const newTrains = selectedTrainData.filter(train => !existingIds.has(train.id));
      const updatedResults = [...prev, ...newTrains];
      console.log('Updated search results:', updatedResults);
      return updatedResults;
    });
    
    setHasSearched(true); // Ensure results are shown
    setSelectedTrains(new Set());
    setShowPickTrainModal(false);
    addToast({
      type: 'success',
      title: 'Trains Added',
      message: `${selectedTrainData.length} train(s) added to search results`
    });
  };

  const stats = [
    {
      title: 'Total Stations',
      count: stationCount,
      icon: MapPin,
          color: 'bg-[#337ab7]',
    bgColor: 'bg-[#f0f4f8]',
    textColor: 'text-[#337ab7]',
    },
    {
      title: 'Train Routes',
      count: routeCount,
      icon: Route,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
  ];

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      addToast({
        type: 'warning',
        title: 'Search Required',
        message: 'Please enter a train number or train name to search'
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await apiService.getTrainRoutes(1, 1000, searchTerm.trim());
      setSearchResults(response.routes || []);
      
      if (response.routes.length === 0) {
        addToast({
          type: 'info',
          title: 'No Results Found',
          message: `No train routes found matching "${searchTerm}"`
        });
      } else {
        addToast({
          type: 'success',
          title: 'Search Results',
          message: `Found ${response.routes.length} train route(s) matching "${searchTerm}"`
        });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      addToast({
        type: 'error',
        title: 'Search Failed',
        message: error.message || 'Failed to search train routes'
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePlatformEdit = (routeId: number) => {
    setEditingPlatform(routeId);
    if (!platformValues[routeId]) {
      setPlatformValues(prev => ({ ...prev, [routeId]: 1 }));
    }
  };

  const handlePlatformSave = (routeId: number) => {
    setEditingPlatform(null);
    addToast({
      type: 'success',
      title: 'Platform Updated',
      message: `Platform number updated to ${platformValues[routeId]}`
    });
  };

  const handlePlatformChange = (routeId: number, value: string) => {
    const numValue = parseInt(value) || 1;
    setPlatformValues(prev => ({ ...prev, [routeId]: numValue }));
  };

  const handlePlatformKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, routeId: number) => {
    if (e.key === 'Enter') {
      handlePlatformSave(routeId);
    } else if (e.key === 'Escape') {
      setEditingPlatform(null);
    }
  };

  const handleCategoryChange = (routeId: number, category: string) => {
    setCategoryValues(prev => ({ ...prev, [routeId]: category }));
    addToast({
      type: 'success',
      title: 'Category Updated',
      message: `Announcement category updated to "${category}"`
    });
  };

  const handleAnnouncementClick = async (route: TrainRoute) => {
    setSelectedRoute(route);
    
    // Get the category and platform from the search results table
    const category = categoryValues[route.id] || 'arrival';
    const platform = platformValues[route.id] || 1;
    
    // Get the actual route data from search results
    const searchResultRoute = searchResults.find(r => r.id === route.id);
    if (!searchResultRoute) {
      setShowProgressModal(false);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Route not found in search results'
      });
      return;
    }
    
    try {
      // Show progress modal
      setShowProgressModal(true);
      setProgressMessage('Loading announcement template...');
      
      // Fetch template for the category
      const templateResponse = await fetch(`http://localhost:5001/api/templates?category=${category}`);
      if (templateResponse.ok) {
        const templates = await templateResponse.json();
        if (!templates || templates.length === 0) {
          setShowProgressModal(false);
          addToast({
            type: 'error',
            title: 'Template Not Found',
            message: `No template found for category: ${getCategoryDisplayName(category)}`
          });
          return;
        }
        const template = templates[0]; // Get the first template for this category
        
        // Replace placeholders with actual data from search results
        const replacePlaceholders = (text: string) => {
          // Add spaces between each digit of train number for individual pronunciation
          const spacedTrainNumber = searchResultRoute.train_number.split('').join(' ');
          
          return text
            .replace(/\{train_number\}/g, spacedTrainNumber)
            .replace(/\{train_name\}/g, searchResultRoute.train_name)
            .replace(/\{start_station_name\}/g, searchResultRoute.start_station_name)
            .replace(/\{end_station_name\}/g, searchResultRoute.end_station_name)
            .replace(/\{platform_number\}/g, platform.toString())
            .replace(/\{start_station_code\}/g, searchResultRoute.start_station_code)
            .replace(/\{end_station_code\}/g, searchResultRoute.end_station_code);
        };
        
        // Generate announcement texts for all languages
        const texts = {
          english: replacePlaceholders(template.english_text || ''),
          hindi: replacePlaceholders(template.hindi_text || ''),
          marathi: replacePlaceholders(template.marathi_text || ''),
          gujarati: replacePlaceholders(template.gujarati_text || '')
        };
        
        setAnnouncementTexts(texts);
        
        // Check for existing audio files first, then generate if needed
        setProgressMessage('Checking for existing audio files...');
        
        const audioPromises = [];
        const languages = [
          { key: 'english', text: texts.english },
          { key: 'hindi', text: texts.hindi },
          { key: 'marathi', text: texts.marathi },
          { key: 'gujarati', text: texts.gujarati }
        ];
        
        for (const lang of languages) {
          // First check if audio file already exists
          const checkResponse = await fetch('http://localhost:5001/api/audio-files/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              english_text: lang.text
            })
          });
          
          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            if (checkResult.has_duplicates && checkResult.duplicates.length > 0) {
              // Use existing audio file
              const existingAudio = checkResult.duplicates[0];
              const audioPath = existingAudio[`${lang.key}_audio_path`];
              
              if (audioPath) {
                audioPromises.push(Promise.resolve({
                  audio_path: audioPath,
                  language: lang.key,
                  is_existing: true
                }));
                setProgressMessage(`Using existing ${lang.key} audio...`);
                continue;
              }
            }
          }
          
          // Generate new audio file if not found
          setProgressMessage(`Generating ${lang.key} audio...`);
          const generateResponse = await fetch('http://localhost:5001/api/audio-files/single-language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: lang.text,
              language: lang.key
            })
          });
          
          if (generateResponse.ok) {
            const newAudio = await generateResponse.json();
            audioPromises.push(Promise.resolve({
              ...newAudio,
              language: lang.key,
              is_existing: false
            }));
          } else {
            throw new Error(`Failed to generate ${lang.key} audio`);
          }
        }
        
        setProgressMessage('Processing audio files...');
        const audioFiles = await Promise.all(audioPromises);
        
        // Merge the audio files
        setProgressMessage('Merging audio files...');
        const mergeResponse = await fetch('http://localhost:5001/api/audio-files/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_files: audioFiles.map(file => `/var/www${file.audio_path}`),
            output_filename: `merged_announcement_${searchResultRoute.train_number}_${category}_${Date.now()}.wav`
          })
        });
        
        if (mergeResponse.ok) {
          const mergedAudio = await mergeResponse.json();
          setProgressMessage('Playing merged announcement...');
          
          // Store the merged audio path for the modal
          setMergedAudioPath(mergedAudio.audio_path);
          
          // Calculate reuse statistics
          const existingCount = audioFiles.filter(file => file.is_existing).length;
          const newCount = audioFiles.filter(file => !file.is_existing).length;
          
          // Close progress modal and show success
          setShowProgressModal(false);
          addToast({
            type: 'success',
            title: 'Success',
            message: `Merged announcement audio generated successfully (${existingCount} reused, ${newCount} new)`
          });
          
          // Show the announcement modal with texts
          setShowAnnouncementModal(true);
        } else {
          throw new Error('Failed to merge audio files');
        }
      } else {
        setShowProgressModal(false);
        addToast({
          type: 'error',
          title: 'Template Not Found',
          message: `No template found for category: ${getCategoryDisplayName(category)}`
        });
      }
    } catch (error) {
      console.error('Error in announcement process:', error);
      setShowProgressModal(false);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to generate announcement audio'
      });
    }
  };



  const handlePlayAnnouncement = () => {
    if (mergedAudioPath) {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      
      const audio = new Audio(`http://localhost:5001${mergedAudioPath}`);
      setCurrentAudio(audio);
      audio.play();
    }
  };

  const handleStopAnnouncement = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  };

  const handleGenerateAudio = async (route: TrainRoute) => {
    try {
      setGeneratingAudio(prev => new Set(prev).add(route.id));
      
      const platformNumber = platformValues[route.id] || 1;
      const category = categoryValues[route.id] || 'Arrival';
      
      // Get template ID from available templates
      const templateId = availableTemplates[category.toLowerCase()];
      if (!templateId) {
        throw new Error(`No template found for category: ${category}. Please generate audio segments for this category first.`);
      }
      
      // Prepare train data for the final announcement
      const trainData = {
        train_number: route.train_number,
        train_name: route.train_name,
        start_station_name: route.start_station_name,
        end_station_name: route.end_station_name,
        platform_number: platformNumber
      };

      // Generate final announcement using template segments
      const response = await fetch('http://localhost:5001/api/final-announcement/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          train_data: trainData
        }),
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'Final Announcement Generation Started',
          message: `Final announcement audio generation started for ${route.train_name} (${route.train_number}) using ${category} template`
        });
      } else {
        const errorData = await response.json();
        if (response.status === 400 && 'No audio segments found' in errorData.detail) {
          addToast({
            type: 'warning',
            title: 'Audio Segments Required',
            message: `Please generate audio segments for the ${category} template first in the Announcement Templates section`
          });
        } else {
          throw new Error(errorData.detail || 'Failed to generate final announcement');
        }
      }
    } catch (error: any) {
      console.error('Error generating final announcement:', error);
      addToast({
        type: 'error',
        title: 'Final Announcement Generation Failed',
        message: error.message || 'Failed to generate final announcement audio'
      });
    } finally {
      setGeneratingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(route.id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600 text-xs">Welcome to the Western Railway Announcement System for Deaf and Hard of Hearing</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => (
          <div key={stat.title} className={`${stat.bgColor} rounded-xl p-6 border border-gray-100`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.count}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-none`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Train Route Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Train Routes</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by train number or train name..."
                              className="block w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-[#337ab7]"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-2 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
                          className="px-4 py-2 bg-[#337ab7] text-white text-sm rounded-none hover:bg-[#2e6da4] focus:ring-2 focus:ring-[#337ab7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </button>
          <button
            onClick={handlePickTrainClick}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-none hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center gap-2"
          >
            <Route className="h-4 w-4" />
            Pick Train Route
          </button>
        </div>
      </div>

      {/* Search Results */}
      {(hasSearched || searchResults.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {searchResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                      Train No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Train Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      From Station
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      To Station
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchResults.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {route.train_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {route.train_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{route.start_station_name}</div>
                          <div className="text-gray-500 text-xs">({route.start_station_code})</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{route.end_station_name}</div>
                          <div className="text-gray-500 text-xs">({route.end_station_code})</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingPlatform === route.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={platformValues[route.id] || 1}
                              onChange={(e) => handlePlatformChange(route.id, e.target.value)}
                              onKeyPress={(e) => handlePlatformKeyPress(e, route.id)}
                              onBlur={() => handlePlatformSave(route.id)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-[#337ab7]"
                              autoFocus
                            />
                            <button
                              onClick={() => handlePlatformSave(route.id)}
                              className="text-[#337ab7] hover:text-[#2e6da4] text-xs font-medium px-2 py-1 border border-[#337ab7] rounded-none hover:bg-[#f0f4f8]"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{platformValues[route.id] || 1}</span>
                            <button
                              onClick={() => handlePlatformEdit(route.id)}
                              className="text-[#337ab7] hover:text-[#2e6da4] text-xs font-medium px-2 py-1 border border-[#337ab7] rounded-none hover:bg-[#f0f4f8]"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <select
                          value={categoryValues[route.id] || 'arrival'}
                          onChange={(e) => handleCategoryChange(route.id, e.target.value)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-[#337ab7] bg-white"
                        >
                          {announcementCategories.map((category) => (
                            <option key={category} value={category}>
                              {getCategoryDisplayName(category)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleGenerateAudio(route)}
                            disabled={generatingAudio.has(route.id)}
                            className="hidden inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-[#337ab7] rounded-none hover:bg-[#2e6da4] focus:ring-2 focus:ring-[#337ab7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingAudio.has(route.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                Generate Audio
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleAnnouncementClick(route)}
                            className="inline-flex items-center justify-center p-1 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            title="Announcement"
                          >
                            <Volume2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Route className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No train routes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try searching with a different train number or train name.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && selectedRoute && (
        <div className="fixed inset-0 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-3 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
            <div className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  Announcement for {selectedRoute.train_name} ({selectedRoute.train_number})
                </h3>
                <button
                  onClick={() => {
                    if (currentAudio) {
                      currentAudio.pause();
                      currentAudio.currentTime = 0;
                      setCurrentAudio(null);
                    }
                    setShowAnnouncementModal(false);
                    setMergedAudioPath(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Panel - Announcement Text */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Announcement Text</h4>
                  
                  {/* English */}
                  <div className="border border-gray-200 rounded-none p-2">
                    <h5 className="font-medium text-gray-900 mb-1 text-xs">English</h5>
                    <p className="text-gray-700 text-xs">{announcementTexts.english}</p>
                  </div>
                  
                  {/* Hindi */}
                  <div className="border border-gray-200 rounded-none p-2">
                    <h5 className="font-medium text-gray-900 mb-1 text-xs">हिंदी</h5>
                    <p className="text-gray-700 text-xs">{announcementTexts.hindi}</p>
                  </div>
                  
                  {/* Marathi */}
                  <div className="border border-gray-200 rounded-none p-2">
                    <h5 className="font-medium text-gray-900 mb-1 text-xs">मराठी</h5>
                    <p className="text-gray-700 text-xs">{announcementTexts.marathi}</p>
                  </div>
                  
                  {/* Gujarati */}
                  <div className="border border-gray-200 rounded-none p-2">
                    <h5 className="font-medium text-gray-900 mb-1 text-xs">ગુજરાતી</h5>
                    <p className="text-gray-700 text-xs">{announcementTexts.gujarati}</p>
                  </div>
                  
                  {/* Play Button */}
                  <div className="flex justify-end gap-2 mt-2">
                    {mergedAudioPath && (
                      <>
                        <button
                          onClick={handlePlayAnnouncement}
                          className="px-3 py-1 text-xs font-medium text-white bg-[#337ab7] rounded-none hover:bg-[#2e6da4] focus:ring-2 focus:ring-[#f0f4f8]0 focus:ring-offset-2 flex items-center gap-1"
                        >
                          <Volume2 className="h-3 w-3" />
                          Play Announcement
                        </button>
                        <button
                          onClick={handleStopAnnouncement}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-none hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center gap-1"
                        >
                          <Square className="h-3 w-3" />
                          Stop Announcement
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (currentAudio) {
                          currentAudio.pause();
                          currentAudio.currentTime = 0;
                          setCurrentAudio(null);
                        }
                        setShowAnnouncementModal(false);
                        setMergedAudioPath(null);
                      }}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Close
                    </button>
                  </div>
                </div>
                
                {/* Right Panel - ISL Video Area */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">ISL Announcement</h4>
                  
                  <div className="border border-gray-200 rounded-none p-2 bg-gray-50">
                    <div className="aspect-video bg-black rounded-none flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-2xl mb-1">👋</div>
                        <p className="text-xs">ISL Video Player</p>
                        <p className="text-xs text-gray-400">Indian Sign Language</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">ISL Video Status:</span>
                        <span className="text-xs text-gray-500">Ready to Play</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Duration:</span>
                        <span className="text-xs text-gray-500">--:--</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    <button
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-none hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-1"
                    >
                      <Volume2 className="h-3 w-3" />
                      Play ISL Video
                    </button>
                    <button
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Pause
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/3 lg:w-1/4 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#337ab7]"></div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generating Announcement
                </h3>
                <p className="text-sm text-gray-600">
                  {progressMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pick Train Route Modal */}
      {showPickTrainModal && (
        <div className="fixed inset-0 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Pick Train Routes
              </h3>
              <button
                onClick={() => {
                  setShowPickTrainModal(false);
                  setSelectedTrains(new Set());
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Select multiple train routes to add to your search results. You can select/deselect by clicking on the checkboxes.
              </p>
            </div>

            {isLoadingTrains ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#337ab7]"></div>
                <span className="ml-3 text-gray-600">Loading train routes...</span>
              </div>
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedTrains.size === allTrainRoutes.length && allTrainRoutes.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTrains(new Set(allTrainRoutes.map(train => train.id)));
                              } else {
                                setSelectedTrains(new Set());
                              }
                            }}
                            className="rounded border-gray-300 text-[#337ab7] focus:ring-[#f0f4f8]0"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Train Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Train Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Route
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allTrainRoutes.map((train) => (
                        <tr key={train.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedTrains.has(train.id)}
                              onChange={() => handleTrainSelection(train.id)}
                              className="rounded border-gray-300 text-[#337ab7] focus:ring-[#f0f4f8]0"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {train.train_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {train.train_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {train.start_station_name} → {train.end_station_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-600">
                    {selectedTrains.size} of {allTrainRoutes.length} trains selected
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPickTrainModal(false);
                        setSelectedTrains(new Set());
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddSelectedTrains}
                      disabled={selectedTrains.size === 0}
                      className="px-4 py-2 text-sm font-medium text-white bg-[#337ab7] rounded-none hover:bg-[#2e6da4] focus:ring-2 focus:ring-[#f0f4f8]0 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Selected Trains ({selectedTrains.size})
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}


    </div>
  );
}