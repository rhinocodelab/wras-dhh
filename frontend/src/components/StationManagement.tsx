import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, Upload, FileSpreadsheet, X, Trash, FileAudio, Flag } from 'lucide-react';
import { Station } from '../types';
import { apiService } from '../services/api';
import { useToast } from './ToastContainer';
import { API_ENDPOINTS, TRANSLATION_API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';

interface StationManagementProps {
  onDataChange?: () => void;
  onAudioChange?: () => void;
}

export default function StationManagement({ onDataChange, onAudioChange }: StationManagementProps) {
  const { addToast } = useToast();
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    station_name: '',
    station_code: '',
    station_name_hi: '',
    station_name_mr: '',
    station_name_gu: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState<Set<number>>(new Set());
  const [stationsWithAudio, setStationsWithAudio] = useState<Set<number>>(new Set());
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [audioQueue, setAudioQueue] = useState<any[]>([]);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0, isProcessing: false });
  const [queuePaused, setQueuePaused] = useState(false);
  const [setupProgress, setSetupProgress] = useState({ 
    isSettingUp: false, 
    message: '', 
    currentStep: 0, 
    totalSteps: 3 
  });
  
  // Translation progress state
  const [translationProgress, setTranslationProgress] = useState({
    isTranslating: false,
    currentStation: 0,
    totalStations: 0,
    currentStationName: '',
    message: ''
  });
  
  // Cancel translation flag
  const [cancelTranslation, setCancelTranslation] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    console.log('useEffect triggered with:', { currentPage, pageSize, searchQuery });
    fetchStations();
  }, [currentPage, pageSize, searchQuery]);

  // Check audio status for current stations
  useEffect(() => {
    if (stations.length > 0) {
      checkStationsWithAudio(stations.map(s => s.station_name));
    }
  }, [stations]);

  // Monitor translation progress
  useEffect(() => {
    console.log('Translation progress changed:', translationProgress);
  }, [translationProgress]);



  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchStations = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching stations with:', { currentPage, pageSize, searchQuery });
      const data = await apiService.getStations(currentPage, pageSize, searchQuery);
      console.log('Stations data received:', data);
      setStations(data.stations);
      setPagination(data.pagination);
    } catch (error) {
      setError('Failed to fetch stations');
      console.error('Error fetching stations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingStation) {
        await apiService.updateStation(editingStation.id, formData);
      } else {
        await apiService.createStation(formData);
      }
      await fetchStations();
      setShowModal(false);
      setEditingStation(null);
      setFormData({ station_name: '', station_code: '', station_name_hi: '', station_name_mr: '', station_name_gu: '' });
      onDataChange?.();
      addToast({
        type: 'success',
        title: editingStation ? 'Station Updated' : 'Station Created',
        message: editingStation 
          ? `Station "${formData.station_name}" has been updated successfully`
          : `Station "${formData.station_name}" has been created successfully`
      });
    } catch (error: any) {
      setError(error.message);
      addToast({
        type: 'error',
        title: 'Operation Failed',
        message: error.message
      });
    }
  };

  const handleEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      station_name: station.station_name,
      station_code: station.station_code,
      station_name_hi: station.station_name_hi || station.station_name,
      station_name_mr: station.station_name_mr || station.station_name,
      station_name_gu: station.station_name_gu || station.station_name
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this station? This will also delete any audio files generated for this station.')) {
      try {
        // Find the station to get its name for audio file deletion
        const station = stations.find(s => s.id === id);
        
        // Delete the station first
        await apiService.deleteStation(id);
        
        // Delete audio file for this station if it exists
        if (station) {
          try {
            const response = await fetch(API_ENDPOINTS.audioFiles.deleteByText, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                english_text: station.station_name
              }),
            });
            
            if (response.ok) {
              console.log(`Audio file deleted for station: ${station.station_name}`);
            }
          } catch (error) {
            console.error(`Error deleting audio for station ${station.station_name}:`, error);
            // Continue even if audio deletion fails
          }
        }
        
        await fetchStations();
        onDataChange?.();
        
        // Notify that audio files have changed
        onAudioChange?.();
        
        addToast({
          type: 'success',
          title: 'Station Deleted',
          message: 'Station has been deleted successfully along with its audio files'
        });
      } catch (error: any) {
        setError(error.message);
        addToast({
          type: 'error',
          title: 'Delete Failed',
          message: error.message
        });
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear ALL stations? This action cannot be undone and will also clear any train routes that use these stations. This will also delete all audio files generated for these stations.')) {
      try {
        setError(null);
        
        // First, get all stations to get their names for audio file deletion
        const allStationsResponse = await apiService.getAllStations();
        const allStations = allStationsResponse.stations || [];
        
        // Delete audio files for all stations using bulk deletion
        let audioFilesDeleted = 0;
        if (allStations.length > 0) {
          try {
            const stationNames = allStations.map((station: any) => station.station_name);
            const response = await fetch(API_ENDPOINTS.audioFiles.deleteByTexts, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                english_texts: stationNames
              }),
            });
            
            if (response.ok) {
              const result = await response.json();
              audioFilesDeleted = result.total_files_deleted;
              console.log(`Deleted ${result.total_records_deleted} audio records and ${result.total_files_deleted} physical files for stations:`, result.matched_texts);
              
              // If no files were deleted, try aggressive cleanup
              if (result.total_files_deleted === 0) {
                console.log('No files deleted by text matching, trying aggressive cleanup...');
                const cleanupResponse = await fetch(API_ENDPOINTS.audioFiles.cleanupStations, {
                  method: 'DELETE',
                });
                
                if (cleanupResponse.ok) {
                  const cleanupResult = await cleanupResponse.json();
                  audioFilesDeleted = cleanupResult.total_files_deleted;
                  console.log(`Aggressive cleanup deleted ${cleanupResult.total_records_deleted} audio records and ${cleanupResult.total_files_deleted} physical files`);
                }
              }
            }
          } catch (error) {
            console.error('Error deleting audio files for stations:', error);
            // Continue with clearing stations even if audio deletion fails
          }
        }
        
        // Now clear all stations
        await apiService.clearAllStations();
        await fetchStations();
        onDataChange?.();
        
        // Notify that audio files have changed
        if (audioFilesDeleted > 0) {
          onAudioChange?.();
        }
        
        addToast({
          type: 'success',
          title: 'All Stations Cleared',
          message: `All stations have been cleared successfully. ${audioFilesDeleted} audio files were also deleted.`
        });
      } catch (error: any) {
        setError(error.message);
        addToast({
          type: 'error',
          title: 'Clear Failed',
          message: error.message
        });
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('Search input changed to:', value);
    setSearchTerm(value);
  };

  const handleSearch = () => {
    console.log('Search triggered with term:', searchTerm);
    setSearchQuery(searchTerm);
    setCurrentPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchQuery('');
    setCurrentPage(1);
    searchInputRef.current?.focus();
  };

  const handleGenerateAudio = async (station: Station) => {
    try {
      setGeneratingAudio(prev => new Set(prev).add(station.id));
      
      console.log('Generating audio for station:', station.station_name);
      console.log('Station multilingual names:', {
        english: station.station_name,
        hindi: station.station_name_hi,
        marathi: station.station_name_mr,
        gujarati: station.station_name_gu
      });

      // Prepare station names in all four languages
      const stationNames = {
        en: station.station_name,
        hi: station.station_name_hi || station.station_name,
        mr: station.station_name_mr || station.station_name,
        gu: station.station_name_gu || station.station_name
      };

      interface AudioResult {
        text: string;
        audio_base64?: string;
        file_name?: string;
        success: boolean;
        error?: string;
      }

      interface AudioResults {
        [key: string]: AudioResult | number | string;
      }

      const audioResults: AudioResults = {};
      const fastApiUrl = `${TRANSLATION_API_BASE_URL}/text-to-speech-multi-language/`;

      // Generate audio for each language
      for (const [langCode, stationName] of Object.entries(stationNames)) {
        try {
          console.log(`Generating audio for ${langCode}: ${stationName}`);
          
          const response = await fetch(fastApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: stationName,
              source_language: langCode
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              audioResults[langCode] = {
                text: stationName,
                audio_base64: result.audio_base64,
                file_name: result.file_name,
                success: true
              };
              console.log(`✅ Audio generated for ${langCode}`);
            } else {
              audioResults[langCode] = {
                text: stationName,
                success: false,
                error: 'Failed to generate audio'
              };
              console.log(`❌ Audio generation failed for ${langCode}`);
            }
          } else {
            const errorData = await response.json();
            audioResults[langCode] = {
              text: stationName,
              success: false,
              error: errorData.detail || 'API request failed'
            };
            console.log(`❌ API error for ${langCode}:`, errorData);
          }
        } catch (error: any) {
          console.error(`Error generating audio for ${langCode}:`, error);
          audioResults[langCode] = {
            text: stationName,
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      }

      // Create audio file record in the FastAPI database
      try {
        const audioFileResponse = await fetch(API_ENDPOINTS.audioFiles.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            english_text: station.station_name,
            marathi_translation: station.station_name_mr || station.station_name,
            hindi_translation: station.station_name_hi || station.station_name,
            gujarati_translation: station.station_name_gu || station.station_name
          }),
        });

        if (audioFileResponse.ok) {
          const audioFileResult = await audioFileResponse.json();
          console.log('✅ Audio file record created in FastAPI database');
          audioResults.audio_file_id = audioFileResult.id;
        } else {
          console.error('Error creating audio file record:', await audioFileResponse.text());
          audioResults.audio_file_error = 'Failed to create audio file record';
        }
             } catch (error: any) {
         console.error('Error creating audio file record:', error);
         audioResults.audio_file_error = error.message || 'Failed to create audio file record';
       }

      // Add station to the set of stations with audio
      setStationsWithAudio(prev => new Set(prev).add(station.id));
      
      // Count successful audio generations
      const successfulCount = Object.values(audioResults).filter(result => 
        typeof result === 'object' && result.success
      ).length;

      addToast({
        type: 'success',
        title: 'Audio Generation Completed',
        message: `Generated audio for station "${station.station_name}" in ${successfulCount} languages`
      });
      
    } catch (error: any) {
      console.error('Audio generation error:', error);
      addToast({
        type: 'error',
        title: 'Audio Generation Failed',
        message: error.message || 'Failed to generate audio for station'
      });
    } finally {
      setGeneratingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(station.id);
        return newSet;
      });
    }
  };

  const checkStationsWithAudio = async (stationNames: string[]) => {
    const stationsWithAudioSet = new Set<number>();
    
    for (let i = 0; i < stationNames.length; i++) {
      try {
        const response = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            english_text: stationNames[i]
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.has_duplicates) {
            // Find the station ID by name
            const station = stations.find(s => s.station_name === stationNames[i]);
            if (station) {
              stationsWithAudioSet.add(station.id);
            }
          }
        }
      } catch (error) {
        console.error(`Error checking audio for station ${stationNames[i]}:`, error);
      }
    }
    
    setStationsWithAudio(stationsWithAudioSet);
  };

  const processAudioQueueWithStations = async (stationsToProcess: any[]) => {
    if (stationsToProcess.length === 0) {
      return;
    }
    
    if (queueProgress.isProcessing) {
      return;
    }

    setQueueProgress(prev => ({ ...prev, isProcessing: true }));
    setQueuePaused(false);
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    const batchSize = 5; // Process 5 stations at a time
    const totalStations = stationsToProcess.length;
    
    for (let i = 0; i < totalStations; i += batchSize) {
      const batch = stationsToProcess.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (station) => {
        try {
          // Check if audio already exists
          const checkResponse = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: station.station_name
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            if (checkResult.has_duplicates) {
              return { status: 'skipped', station };
            }
          }

          // Create audio file
          const response = await fetch(API_ENDPOINTS.audioFiles.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: station.station_name
            }),
          });

          if (response.ok) {
            return { status: 'success', station };
          } else {
            return { status: 'error', station };
          }
        } catch (error) {
          console.error(`Error processing station ${station.station_name}:`, error);
          return { status: 'error', station };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Update counts
      batchResults.forEach(result => {
        if (result.status === 'success') successCount++;
        else if (result.status === 'skipped') skippedCount++;
        else errorCount++;
      });

      // Update progress
      setQueueProgress(prev => ({ 
        ...prev, 
        current: Math.min(i + batchSize, totalStations),
        total: totalStations
      }));

      // Add delay between batches to prevent overwhelming the server
      if (i + batchSize < totalStations) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if queue is paused
        if (queuePaused) {
          setQueueProgress(prev => ({ ...prev, isProcessing: false }));
          return;
        }
      }
    }

    // Update stations with audio state
    await checkStationsWithAudio(stationsToProcess.map(s => s.station_name));

    // Show completion message
    let message = '';
    if (successCount > 0) {
      message += `Successfully started audio generation for ${successCount} stations. `;
    }
    if (skippedCount > 0) {
      message += `Skipped ${skippedCount} stations (audio already exists). `;
    }
    if (errorCount > 0) {
      message += `${errorCount} stations failed to generate audio.`;
    }

    addToast({
      type: successCount > 0 ? 'success' : 'warning',
      title: 'Queue Processing Complete',
      message: message.trim()
    });

    // Clear queue and reset progress
    setAudioQueue([]);
    setQueueProgress({ current: 0, total: 0, isProcessing: false });
    setQueuePaused(false);
    setGeneratingAudio(new Set());
    setIsGeneratingAllAudio(false);
  };

  const processAudioQueue = async () => {
    if (audioQueue.length === 0) {
      return;
    }
    
    if (queueProgress.isProcessing) {
      return;
    }

    setQueueProgress(prev => ({ ...prev, isProcessing: true }));
    setQueuePaused(false);
    
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    const batchSize = 5; // Process 5 stations at a time
    const totalStations = audioQueue.length;
    
    for (let i = 0; i < totalStations; i += batchSize) {
      const batch = audioQueue.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (station) => {
        try {
          // Check if audio already exists
          const checkResponse = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: station.station_name
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            if (checkResult.has_duplicates) {
              return { status: 'skipped', station };
            }
          }

          // Create audio file
          const response = await fetch(API_ENDPOINTS.audioFiles.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: station.station_name
            }),
          });

          if (response.ok) {
            return { status: 'success', station };
          } else {
            return { status: 'error', station };
          }
        } catch (error) {
          console.error(`Error processing station ${station.station_name}:`, error);
          return { status: 'error', station };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Update counts
      batchResults.forEach(result => {
        if (result.status === 'success') successCount++;
        else if (result.status === 'skipped') skippedCount++;
        else errorCount++;
      });

      // Update progress
      setQueueProgress(prev => ({ 
        ...prev, 
        current: Math.min(i + batchSize, totalStations),
        total: totalStations
      }));

      // Add delay between batches to prevent overwhelming the server
      if (i + batchSize < totalStations) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if queue is paused
        if (queuePaused) {
          setQueueProgress(prev => ({ ...prev, isProcessing: false }));
          return;
        }
      }
    }

    // Update stations with audio state
    await checkStationsWithAudio(audioQueue.map(s => s.station_name));

    // Show completion message
    let message = '';
    if (successCount > 0) {
      message += `Successfully started audio generation for ${successCount} stations. `;
    }
    if (skippedCount > 0) {
      message += `Skipped ${skippedCount} stations (audio already exists). `;
    }
    if (errorCount > 0) {
      message += `${errorCount} stations failed to generate audio.`;
    }

    addToast({
      type: successCount > 0 ? 'success' : 'warning',
      title: 'Queue Processing Complete',
      message: message.trim()
    });

    // Clear queue and reset progress
    setAudioQueue([]);
    setQueueProgress({ current: 0, total: 0, isProcessing: false });
    setQueuePaused(false);
    setGeneratingAudio(new Set());
    setIsGeneratingAllAudio(false);
  };

  const pauseQueue = () => {
    setQueuePaused(true);
    setQueueProgress(prev => ({ ...prev, isProcessing: false }));
    addToast({
      type: 'info',
      title: 'Queue Paused',
      message: 'Audio generation queue has been paused'
    });
  };

  const resumeQueue = () => {
    setQueuePaused(false);
    processAudioQueue();
    addToast({
      type: 'info',
      title: 'Queue Resumed',
      message: 'Audio generation queue has been resumed'
    });
  };



  const handleGenerateAudioForAll = async () => {
    // Add timeout to prevent getting stuck
    const setupTimeout = setTimeout(() => {
      console.error('Setup timeout reached');
      addToast({
        type: 'error',
        title: 'Setup Timeout',
        message: 'Setup process took too long. Please try again.'
      });
      setIsGeneratingAllAudio(false);
      setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
    }, 30000); // 30 second timeout

    try {
      setIsGeneratingAllAudio(true);
      setSetupProgress({ 
        isSettingUp: true, 
        message: 'Initializing bulk audio generation...', 
        currentStep: 1, 
        totalSteps: 3 
      });
      
      // Get all stations from all pages
      setSetupProgress(prev => ({ 
        ...prev, 
        message: 'Fetching all stations from database...', 
        currentStep: 2 
      }));
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let allStations;
      
      try {
        const allStationsResponse = await apiService.getAllStations();
        
        if (!allStationsResponse || !allStationsResponse.stations) {
          throw new Error('Invalid response from server: missing stations data');
        }
        
        allStations = allStationsResponse.stations;
      } catch (error) {
        console.error('Failed to fetch all stations, falling back to current page stations:', error);
        // Fallback to current page stations if getAllStations fails
        allStations = stations;
        
        // Add a toast to inform user about fallback
        addToast({
          type: 'info',
          title: 'Using Current Page',
          message: 'Could not fetch all stations, using current page stations instead'
        });
      }
      
      if (allStations.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Stations Found',
          message: 'There are no stations to generate audio for'
        });
        setIsGeneratingAllAudio(false);
        return;
      }

      // For now, let's add all stations to the queue and let the queue processor handle duplicates
      // This is more efficient and avoids potential timeout issues during setup
      setSetupProgress(prev => ({ 
        ...prev, 
        message: `Preparing queue with ${allStations.length} stations...`, 
        currentStep: 3 
      }));
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stationsToProcess = allStations;

      if (stationsToProcess.length === 0) {
        addToast({
          type: 'info',
          title: 'No New Stations',
          message: 'All stations already have audio files generated'
        });
        setIsGeneratingAllAudio(false);
        setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
        return;
      }

      // Add stations to queue
      setAudioQueue(stationsToProcess);
      setQueueProgress({ 
        current: 0, 
        total: stationsToProcess.length, 
        isProcessing: false 
      });

      addToast({
        type: 'success',
        title: 'Queue Created',
        message: `${stationsToProcess.length} stations added to audio generation queue. Each station will generate audio in English, Hindi, Marathi, and Gujarati.`
      });

      // Clear setup progress and start processing the queue
      setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
      
      // Use a longer delay and pass the stations directly to avoid state timing issues
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Pass stations directly to avoid state timing issues
      processAudioQueueWithStations(stationsToProcess);
      
      // Clear timeout on success
      clearTimeout(setupTimeout);
      
    } catch (error: any) {
      console.error('Error setting up audio queue:', error);
      addToast({
        type: 'error',
        title: 'Queue Setup Failed',
        message: error.message || 'Failed to set up audio generation queue'
      });
      setIsGeneratingAllAudio(false);
      setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
      clearTimeout(setupTimeout);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        setImportData(jsonData);
        validateImportData(jsonData);
      } catch (error) {
        setError('Failed to read Excel file. Please ensure it\'s a valid Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateImportData = (data: any[]) => {
    const errors: string[] = [];
    const requiredColumns = ['Station Name', 'Station Code'];
    
    if (data.length === 0) {
      errors.push('Excel file is empty');
      setImportErrors(errors);
      return;
    }

    // Check if all required columns exist
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Validate each row
    const existingCodes = stations.map(s => s.station_code.toLowerCase());
    const newCodes = new Set();
    
    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we skip header
      
      if (!row['Station Name']) {
        errors.push(`Row ${rowNumber}: Station Name is required`);
      }
      if (!row['Station Code']) {
        errors.push(`Row ${rowNumber}: Station Code is required`);
      } else {
        const code = row['Station Code'].toString().toLowerCase();
        if (existingCodes.includes(code)) {
          errors.push(`Row ${rowNumber}: Station Code "${row['Station Code']}" already exists`);
        }
        if (newCodes.has(code)) {
          errors.push(`Row ${rowNumber}: Duplicate Station Code "${row['Station Code']}" in import data`);
        }
        newCodes.add(code);
      }
    });

    setImportErrors(errors);
  };

  const handleImport = async () => {
    console.log('handleImport called with', importData.length, 'stations');
    
    if (importErrors.length > 0) {
      setError('Please fix all validation errors before importing');
      return;
    }

    try {
      setError(null);
      
      // Show translation progress modal
      console.log('Starting import process with', importData.length, 'stations');
      const progressState = {
        isTranslating: true,
        currentStation: 0,
        totalStations: importData.length,
        currentStationName: '',
        message: 'Starting import and translation process...'
      };
      console.log('Setting progress state:', progressState);
      setTranslationProgress(progressState);
      
      // Force a small delay to ensure modal shows
      await new Promise(resolve => setTimeout(resolve, 100));

      // Process stations one by one to show progress
      const results = [];
      setCancelTranslation(false);
      
      for (let i = 0; i < importData.length; i++) {
        // Check if user cancelled
        if (cancelTranslation) {
          break;
        }
        
        const row = importData[i];
        const stationName = row['Station Name'].toString();
        
        // Update progress
        setTranslationProgress(prev => ({
          ...prev,
          currentStation: i + 1,
          currentStationName: stationName,
          message: `Processing station ${i + 1} of ${importData.length}: ${stationName} (translating to multiple languages)`
        }));

        try {
          const result = await apiService.createStation({
            station_name: stationName,
            station_code: row['Station Code'].toString().toUpperCase(),
            // Let the backend handle translation if multilingual names are not provided
            station_name_hi: row['Station Name (Hindi)']?.toString() || '',
            station_name_mr: row['Station Name (Marathi)']?.toString() || '',
            station_name_gu: row['Station Name (Gujarati)']?.toString() || ''
          });
          results.push(result);
          
          // Small delay to make progress visible and give API time
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          console.error(`Error importing station ${stationName}:`, error);
          // Continue with other stations even if one fails
        }
      }

      // Hide progress modal
      setTranslationProgress({
        isTranslating: false,
        currentStation: 0,
        totalStations: 0,
        currentStationName: '',
        message: ''
      });

      await fetchStations();
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
      onDataChange?.();
      
      if (cancelTranslation) {
        addToast({
          type: 'info',
          title: 'Import Cancelled',
          message: `${results.length} stations were imported before cancellation`
        });
      } else {
        addToast({
          type: 'success',
          title: 'Import Successful',
          message: `${results.length} stations have been imported and translated to multiple languages`
        });
      }
    } catch (error: any) {
      // Hide progress modal on error
      setTranslationProgress({
        isTranslating: false,
        currentStation: 0,
        totalStations: 0,
        currentStationName: '',
        message: ''
      });
      
      setError(error.message);
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: error.message
      });
    }
  };

  // Stations are now filtered server-side based on search term
  const filteredStations = stations;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#337ab7]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Station Management</h2>
          <p className="text-gray-600 text-xs">Manage railway stations and their codes</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setEditingStation(null);
              setFormData({ station_name: '', station_code: '', station_name_hi: '', station_name_mr: '', station_name_gu: '' });
              setShowModal(true);
            }}
            className="bg-[#337ab7] hover:bg-[#2e6da4] text-white px-3 py-1.5 rounded-none transition-colors text-sm"
            title="Add a new railway station to the database. You can enter the station name, code, and optional multilingual names in Hindi, Marathi, and Gujarati."
          >
            Add Station
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-none transition-colors text-sm"
            title="Import multiple stations from an Excel file. The file should have columns for Station Name and Station Code. Optional columns for multilingual names (Hindi, Marathi, Gujarati) are also supported."
          >
            Import
          </button>
          {stations.length > 0 && (
            <>
              <button
                onClick={handleGenerateAudioForAll}
                disabled={generatingAudio.size > 0 || isGeneratingAllAudio || queueProgress.isProcessing}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate audio files for all stations in the database. This will create audio announcements for each station in multiple languages (English, Marathi, Hindi, Gujarati). The process runs in the background and you can monitor progress in the queue below."
              >
                {isGeneratingAllAudio 
                  ? (setupProgress.isSettingUp 
                      ? `Setting up... (${setupProgress.currentStep}/${setupProgress.totalSteps})`
                      : 'Setting up queue...'
                    )
                  : 'Generate Audio'
                }
              </button>
              {queueProgress.isProcessing && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#e1e9f2] text-[#2e6da4] rounded-none text-sm">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#337ab7]"></div>
                  <span>Queue: {queueProgress.current}/{queueProgress.total}</span>
                </div>
              )}
              <button
                onClick={handleClearAll}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-none transition-colors text-sm"
                title="Delete all stations from the database. This action cannot be undone. All station data, including multilingual names and associated audio files, will be permanently removed."
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by station name or station code..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyPress={handleKeyPress}
                            className="pl-10 pr-4 py-1.5 w-full border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-[#337ab7] hover:bg-[#2e6da4] text-white px-3 py-1.5 rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Search for stations by name or station code. The search is case-insensitive and will match partial text."
        >
          Search
        </button>
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 px-3 py-1.5 transition-colors text-sm"
            title="Clear the search field and show all stations in the database."
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Search Status */}
      {searchQuery && (
        <div className="text-sm text-gray-600">
          Searching for: "{searchQuery}" • Found {pagination.total} results
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Setup Progress */}
      {setupProgress.isSettingUp && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-purple-900">Setting Up Audio Generation</h4>
            <span className="text-sm text-purple-700">
              Step {setupProgress.currentStep} of {setupProgress.totalSteps}
            </span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(setupProgress.currentStep / setupProgress.totalSteps) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-purple-700 mt-2">
            {setupProgress.message}
          </p>
        </div>
      )}

      {/* Queue Progress */}
      {(queueProgress.isProcessing || queuePaused) && (
        <div className="bg-[#f0f4f8] border border-[#c3d4e5] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-[#1e4a6b]">Audio Generation Queue</h4>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-[#337ab7]">
                {queueProgress.current} / {queueProgress.total} stations
              </span>
              {queueProgress.isProcessing && !queuePaused && (
                <button
                  onClick={pauseQueue}
                  className="text-[#337ab7] hover:text-[#2e6da4] text-sm font-medium"
                >
                  Pause
                </button>
              )}
              {queuePaused && (
                <button
                  onClick={resumeQueue}
                  className="text-[#337ab7] hover:text-[#2e6da4] text-sm font-medium"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-[#c3d4e5] rounded-full h-2">
            <div 
              className="bg-[#337ab7] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-[#337ab7] mt-2">
            {queuePaused 
              ? 'Queue is paused. Click Resume to continue.' 
              : 'Processing stations in batches... Please wait.'
            }
          </p>
        </div>
      )}

      {/* Stations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredStations.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating a new station'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Station
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStations.map((station) => (
                    <tr key={station.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{station.station_name}</div>
                            {stationsWithAudio.has(station.id) && (
                              <div title="Audio files available">
                                <Flag className="h-3 w-3 text-green-600 ml-2" />
                              </div>
                            )}
                          </div>
                          {(station.station_name_hi || station.station_name_mr || station.station_name_gu) && (
                            <div className="ml-2 text-xs text-gray-500">
                              <span title={`Hindi: ${station.station_name_hi || 'Not set'}\nMarathi: ${station.station_name_mr || 'Not set'}\nGujarati: ${station.station_name_gu || 'Not set'}`}>
                                🌐
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e1e9f2] text-[#2e6da4]">
                          {station.station_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(station.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleGenerateAudio(station)}
                            disabled={generatingAudio.has(station.id)}
                            className="text-purple-600 hover:text-purple-900 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate Audio"
                          >
                            {generatingAudio.has(station.id) ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                            ) : (
                              <FileAudio className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(station)}
                            className="text-[#337ab7] hover:text-[#1e4a6b] p-0.5"
                            title="Edit Station"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(station.id)}
                            className="text-red-600 hover:text-red-900 p-0.5"
                            title="Delete Station"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} stations
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
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
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!pagination.hasNext}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-2 border-gray-200 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingStation ? 'Edit Station' : 'Add New Station'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  value={formData.station_name}
                  onChange={(e) => setFormData({ ...formData, station_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent"
                  placeholder="Enter station name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Station Code
                </label>
                <input
                  type="text"
                  value={formData.station_code}
                  onChange={(e) => setFormData({ ...formData, station_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent"
                  placeholder="Enter station code"
                  maxLength={10}
                  required
                />
              </div>
              

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#337ab7] text-white rounded-none hover:bg-[#2e6da4] text-sm"
                >
                  {editingStation ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Translation Progress Modal */}
      {translationProgress.isTranslating && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-md w-full p-6 border-2 border-gray-200 shadow-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#337ab7] mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Importing and Translating Stations</h3>
              <p className="text-sm text-gray-600 mb-4">{translationProgress.message}</p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-[#337ab7] h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${translationProgress.totalStations > 0 ? (translationProgress.currentStation / translationProgress.totalStations) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              
              {/* Progress Text */}
              <div className="text-sm text-gray-700">
                <p>Progress: {translationProgress.currentStation} of {translationProgress.totalStations} stations</p>
                {translationProgress.currentStationName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {translationProgress.currentStationName}
                  </p>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-4 mb-4">
                Please wait while stations are being imported and translated to multiple languages...
              </p>
              
              <button
                onClick={() => setCancelTranslation(true)}
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-none hover:bg-red-50"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border-2 border-gray-200 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import Stations from Excel</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData([]);
                  setImportErrors([]);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Close import modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="station-excel-upload"
                  />
                  <label
                    htmlFor="station-excel-upload"
                    className="cursor-pointer bg-[#337ab7] hover:bg-[#2e6da4] text-white px-3 py-1.5 rounded-none inline-flex items-center space-x-1 text-sm"
                    title="Select an Excel file to import stations"
                  >
                    Choose Excel File
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    Upload an Excel file with station information<br/>
                    <strong>Required:</strong> Station Name, Station Code<br/>
                    <em>Note: English station names will be automatically translated to Hindi, Marathi, and Gujarati</em>
                  </p>
                </div>
              </div>

              {/* Required Format */}
              <div className="bg-[#f0f4f8] border border-[#c3d4e5] rounded-lg p-4">
                <h4 className="font-medium text-[#1e4a6b] mb-2">Required Excel Format:</h4>
                <div className="text-sm text-[#2e6da4]">
                  <p className="mb-2">Your Excel file must have these exact column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Station Name</strong> - Full name of the railway station (English)</li>
                    <li><strong>Station Code</strong> - Unique code for the station</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Note: Station codes must be unique and will be automatically converted to uppercase.<br/>
                    English station names will be automatically translated to Hindi, Marathi, and Gujarati.
                  </p>
                  <p className="mt-2 text-xs">
                    <strong>Download sample file:</strong> <a 
                      href="/sample_docs/sample_stations.xlsx" 
                      download 
                      className="text-[#337ab7] hover:underline"
                    >
                      sample_stations.xlsx
                    </a>
                  </p>
                </div>
              </div>

              {/* Validation Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">Validation Errors:</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    {importErrors.map((error, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Data */}
              {importData.length > 0 && importErrors.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">
                    Preview ({importData.length} stations ready to import)
                  </h4>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-green-200">
                          <th className="text-left py-1">Station Name</th>
                          <th className="text-left py-1">Station Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, index) => (
                          <tr key={index} className="border-b border-green-100">
                            <td className="py-1">{row['Station Name']}</td>
                            <td className="py-1">{row['Station Code']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 5 && (
                      <p className="text-xs text-green-600 mt-2">
                        ... and {importData.length - 5} more stations
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData([]);
                    setImportErrors([]);
                  }}
                  className="px-3 py-1.5 text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importData.length === 0 || importErrors.length > 0}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-none hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  Import {importData.length} Stations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}