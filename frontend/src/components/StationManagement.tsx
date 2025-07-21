import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, Upload, FileSpreadsheet, X, Trash, FileAudio, Flag } from 'lucide-react';
import { Station } from '../types';
import { apiService } from '../services/api';
import { useToast } from './ToastContainer';
import { API_ENDPOINTS } from '../config/api';
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
    station_code: ''
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
      setFormData({ station_name: '', station_code: '' });
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
      station_code: station.station_code
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
      
      // Create audio file using the station name
      const response = await fetch(API_ENDPOINTS.audioFiles.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          english_text: station.station_name
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle duplicate error specifically
        if (response.status === 409) {
          addToast({
            type: 'warning',
            title: 'Audio Already Exists',
            message: `Audio for station "${station.station_name}" already exists in the database`
          });
          return;
        }
        
        throw new Error(errorData.detail || 'Failed to generate audio');
      }

      const result = await response.json();
      
      // Add station to the set of stations with audio
      setStationsWithAudio(prev => new Set(prev).add(station.id));
      
      addToast({
        type: 'success',
        title: 'Audio Generation Started',
        message: `Audio generation started for station "${station.station_name}" in all languages`
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
        message: `${stationsToProcess.length} stations added to audio generation queue`
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
    if (importErrors.length > 0) {
      setError('Please fix all validation errors before importing');
      return;
    }

    try {
      setError(null);
      const importPromises = importData.map(async (row) => {
        return apiService.createStation({
          station_name: row['Station Name'].toString(),
          station_code: row['Station Code'].toString().toUpperCase()
        });
      });

      await Promise.all(importPromises);
      await fetchStations();
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
      onDataChange?.();
      addToast({
        type: 'success',
        title: 'Import Successful',
        message: `${importData.length} stations have been imported successfully`
      });
    } catch (error: any) {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Station Management</h2>
          <p className="text-gray-600">Manage railway stations and their codes</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setEditingStation(null);
              setFormData({ station_name: '', station_code: '' });
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
          >
            <Plus className="h-3 w-3" />
            <span>Add Station</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
          >
            <Upload className="h-3 w-3" />
            <span>Import</span>
          </button>
          {stations.length > 0 && (
            <>
              <button
                onClick={handleGenerateAudioForAll}
                disabled={generatingAudio.size > 0 || isGeneratingAllAudio || queueProgress.isProcessing}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAllAudio ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <FileAudio className="h-3 w-3" />
                )}
                <span>
                  {isGeneratingAllAudio 
                    ? (setupProgress.isSettingUp 
                        ? `Setting up... (${setupProgress.currentStep}/${setupProgress.totalSteps})`
                        : 'Setting up queue...'
                      )
                    : 'Generate Audio for All Stations'
                  }
                </span>
              </button>
              {queueProgress.isProcessing && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-none text-sm">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>Queue: {queueProgress.current}/{queueProgress.total}</span>
                </div>
              )}
              <button
                onClick={handleClearAll}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
              >
                <Trash className="h-3 w-3" />
                <span>Clear All</span>
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
            className="pl-10 pr-4 py-1.5 w-full border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search className="h-3 w-3" />
          <span>Search</span>
        </button>
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 px-3 py-1.5 transition-colors text-sm"
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-900">Audio Generation Queue</h4>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-blue-700">
                {queueProgress.current} / {queueProgress.total} stations
              </span>
              {queueProgress.isProcessing && !queuePaused && (
                <button
                  onClick={pauseQueue}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Pause
                </button>
              )}
              {queuePaused && (
                <button
                  onClick={resumeQueue}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-blue-700 mt-2">
            {queuePaused 
              ? 'Queue is paused. Click Resume to continue.' 
              : 'Processing stations in batches... Please wait.'
            }
          </p>
        </div>
      )}

      {/* Stations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
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
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                        className="text-blue-600 hover:text-blue-900 p-0.5"
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

        {filteredStations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating a new station'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-3 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} stations
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={5}>5 per page</option>
              <option value={7}>7 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-none hover:bg-blue-700 text-sm"
                >
                  {editingStation ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import Stations from Excel</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData([]);
                  setImportErrors([]);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-4 w-4" />
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
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-none inline-flex items-center space-x-1 text-sm"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Choose Excel File</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    Upload an Excel file with columns: Station Name, Station Code
                  </p>
                </div>
              </div>

              {/* Required Format */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Required Excel Format:</h4>
                <div className="text-sm text-blue-800">
                  <p className="mb-2">Your Excel file must have these exact column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Station Name</strong> - Full name of the railway station</li>
                    <li><strong>Station Code</strong> - Unique code for the station</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Note: Station codes must be unique and will be automatically converted to uppercase
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