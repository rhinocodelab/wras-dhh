import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, Route, Search, ArrowRight, Upload, FileSpreadsheet, X, Trash, FileAudio, Flag } from 'lucide-react';
import { TrainRoute, Station } from '../types';
import { apiService } from '../services/api';
import { useToast } from './ToastContainer';
import { API_ENDPOINTS } from '../config/api';
import * as XLSX from 'xlsx';

interface TrainRouteManagementProps {
  onDataChange?: () => void;
  onAudioChange?: () => void;
}

export default function TrainRouteManagement({ onDataChange, onAudioChange }: TrainRouteManagementProps) {
  const { addToast } = useToast();
  const [routes, setRoutes] = useState<TrainRoute[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TrainRoute | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    train_number: '',
    train_name: '',
    train_name_hi: '',
    train_name_mr: '',
    train_name_gu: '',
    start_station_id: '',
    end_station_id: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState<Set<number>>(new Set());
  const [routesWithAudio, setRoutesWithAudio] = useState<Set<number>>(new Set());
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
    fetchData();
  }, [currentPage, pageSize, searchQuery]);



  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Fetching train routes and stations...');
      const [routesData, stationsData] = await Promise.all([
        apiService.getTrainRoutes(currentPage, pageSize, searchQuery),
        apiService.getStations(1, 1000) // Get all stations for dropdowns
      ]);
      console.log('Routes data:', routesData);
      console.log('Stations data:', stationsData);
      setRoutes(routesData.routes);
      setPagination(routesData.pagination);
      setStations(stationsData.stations);
    } catch (error) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const submitData = {
        ...formData,
        start_station_id: parseInt(formData.start_station_id),
        end_station_id: parseInt(formData.end_station_id)
      };

      if (editingRoute) {
        await apiService.updateTrainRoute(editingRoute.id, submitData);
      } else {
        await apiService.createTrainRoute(submitData);
      }
      await fetchData();
      setShowModal(false);
      setEditingRoute(null);
      setFormData({ train_number: '', train_name: '', train_name_hi: '', train_name_mr: '', train_name_gu: '', start_station_id: '', end_station_id: '' });
      onDataChange?.();
      addToast({
        type: 'success',
        title: editingRoute ? 'Train Route Updated' : 'Train Route Created',
        message: editingRoute 
          ? `Train route "${formData.train_name}" has been updated successfully`
          : `Train route "${formData.train_name}" has been created successfully`
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

  const handleEdit = (route: TrainRoute) => {
    setEditingRoute(route);
    setFormData({
      train_number: route.train_number,
      train_name: route.train_name,
      train_name_hi: route.train_name_hi || route.train_name,
      train_name_mr: route.train_name_mr || route.train_name,
      train_name_gu: route.train_name_gu || route.train_name,
      start_station_id: route.start_station_id.toString(),
      end_station_id: route.end_station_id.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this train route? This will also delete any audio files generated for this train route.')) {
      try {
        // Find the route to get its name for audio file deletion
        const route = routes.find(r => r.id === id);
        
        // Delete the train route first
        await apiService.deleteTrainRoute(id);
        
        // Delete audio file for this train route if it exists
        if (route) {
          try {
            console.log(`Attempting to delete audio for train route: ${route.train_name}`);
            const response = await fetch(API_ENDPOINTS.audioFiles.deleteByText, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                english_text: route.train_name
              }),
            });
            
            if (response.ok) {
              console.log(`Audio file deleted for train route: ${route.train_name}`);
            } else {
              console.log(`Failed to delete audio for train route: ${route.train_name}, status: ${response.status}`);
            }
          } catch (error) {
            console.error(`Error deleting audio for train route ${route.train_name}:`, error);
            // Continue even if audio deletion fails
          }
        }
        
        await fetchData();
        onDataChange?.();
        
        // Notify that audio files have changed
        onAudioChange?.();
        
        addToast({
          type: 'success',
          title: 'Train Route Deleted',
          message: 'Train route has been deleted successfully along with its audio files'
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
    if (window.confirm('Are you sure you want to clear ALL train routes? This action cannot be undone. This will also delete all audio files generated for these train routes.')) {
      try {
        setError(null);
        
        // First, get all train routes to get their names for audio file deletion
        const allRoutesResponse = await apiService.getAllTrainRoutes();
        console.log('All routes response:', allRoutesResponse);
        const allRoutes = allRoutesResponse.routes || [];
        console.log('All routes:', allRoutes);
        
        // Delete audio files for all train routes using bulk deletion
        let audioFilesDeleted = 0;
        if (allRoutes.length > 0) {
          try {
            const trainNames = allRoutes.map((route: any) => route.train_name);
            console.log('Train names for audio deletion:', trainNames);
            const response = await fetch(API_ENDPOINTS.audioFiles.deleteByTexts, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                english_texts: trainNames
              }),
            });
            
            if (response.ok) {
              const result = await response.json();
              audioFilesDeleted = result.total_files_deleted;
              console.log(`Deleted ${result.total_records_deleted} audio records and ${result.total_files_deleted} physical files for train routes:`, result.matched_texts);
              
              // If no files were deleted, try aggressive cleanup
              if (result.total_files_deleted === 0) {
                console.log('No files deleted by text matching, trying aggressive cleanup...');
                const cleanupResponse = await fetch(API_ENDPOINTS.audioFiles.deleteAll, {
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
            console.error('Error deleting audio files for train routes:', error);
            // Continue with clearing train routes even if audio deletion fails
          }
        }
        
        // Now clear all train routes
        await apiService.clearAllTrainRoutes();
        await fetchData();
        onDataChange?.();
        
        // Notify that audio files have changed
        onAudioChange?.();
        
        addToast({
          type: 'success',
          title: 'All Train Routes Cleared',
          message: `All train routes have been cleared successfully. ${audioFilesDeleted} audio files were also deleted.`
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

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchQuery('');
    setCurrentPage(1);
    searchInputRef.current?.focus();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  const handleSearch = () => {
    setSearchQuery(searchTerm);
    setCurrentPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Check which routes have audio files
  const checkRoutesWithAudio = async (trainNames: string[]) => {
    try {
      const routesWithAudioSet = new Set<number>();
      
      for (const trainName of trainNames) {
        try {
          const checkResponse = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: trainName
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            if (checkResult.has_duplicates) {
              // Find the route with this train name and mark it as having audio
              const route = routes.find(r => r.train_name === trainName);
              if (route) {
                routesWithAudioSet.add(route.id);
              }
            }
          }
        } catch (error) {
          console.error(`Error checking audio for train ${trainName}:`, error);
        }
      }
      
      setRoutesWithAudio(routesWithAudioSet);
    } catch (error) {
      console.error('Error checking routes with audio:', error);
    }
  };

  // Check audio status for current routes
  useEffect(() => {
    if (routes.length > 0) {
      checkRoutesWithAudio(routes.map(r => r.train_name));
    }
  }, [routes]);

  const handleGenerateAudio = async (route: TrainRoute) => {
    try {
      setGeneratingAudio(prev => new Set(prev).add(route.id));
      
      // Create audio file using the train name
      const response = await fetch(API_ENDPOINTS.audioFiles.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          english_text: route.train_name
        }),
      });

      if (response.ok) {
        addToast({
          type: 'success',
          title: 'Audio Generation Started',
          message: `Audio generation started for train "${route.train_name}"`
        });
        
        // Update the routes with audio state
        setRoutesWithAudio(prev => new Set(prev).add(route.id));
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          addToast({
            type: 'warning',
            title: 'Audio Already Exists',
            message: `Audio for train "${route.train_name}" already exists`
          });
          setRoutesWithAudio(prev => new Set(prev).add(route.id));
        } else {
          throw new Error(errorData.error || 'Failed to generate audio');
        }
      }
    } catch (error: any) {
      console.error('Error generating audio:', error);
      addToast({
        type: 'error',
        title: 'Audio Generation Failed',
        message: error.message || 'Failed to generate audio for train'
      });
    } finally {
      setGeneratingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(route.id);
        return newSet;
      });
    }
  };

  const processAudioQueueWithStations = async (routesToProcess: any[]) => {
    if (routesToProcess.length === 0) {
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
    
    const batchSize = 5; // Process 5 routes at a time
    const totalRoutes = routesToProcess.length;
    
    for (let i = 0; i < totalRoutes; i += batchSize) {
      const batch = routesToProcess.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (route) => {
        try {
          // Check if audio already exists
          const checkResponse = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: route.train_name
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            if (checkResult.has_duplicates) {
              return { status: 'skipped', route };
            }
          }

          // Create audio file
          const response = await fetch(API_ENDPOINTS.audioFiles.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: route.train_name
            }),
          });

          if (response.ok) {
            return { status: 'success', route };
          } else {
            return { status: 'error', route };
          }
        } catch (error) {
          console.error(`Error processing route ${route.train_name}:`, error);
          return { status: 'error', route };
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
        current: Math.min(i + batchSize, totalRoutes),
        total: totalRoutes
      }));

      // Add delay between batches to prevent overwhelming the server
      if (i + batchSize < totalRoutes) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if queue is paused
        if (queuePaused) {
          setQueueProgress(prev => ({ ...prev, isProcessing: false }));
          return;
        }
      }
    }

    // Update routes with audio state
    await checkRoutesWithAudio(routesToProcess.map(r => r.train_name));

    // Show completion message
    let message = '';
    if (successCount > 0) {
      message += `Successfully started audio generation for ${successCount} trains. `;
    }
    if (skippedCount > 0) {
      message += `Skipped ${skippedCount} trains (audio already exists). `;
    }
    if (errorCount > 0) {
      message += `${errorCount} trains failed to generate audio.`;
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
    
    const batchSize = 5; // Process 5 routes at a time
    const totalRoutes = audioQueue.length;
    
    for (let i = 0; i < totalRoutes; i += batchSize) {
      const batch = audioQueue.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (route) => {
        try {
          // Check if audio already exists
          const checkResponse = await fetch(API_ENDPOINTS.audioFiles.checkDuplicate, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: route.train_name
            }),
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            
            if (checkResult.has_duplicates) {
              return { status: 'skipped', route };
            }
          }

          // Create audio file
          const response = await fetch(API_ENDPOINTS.audioFiles.create, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              english_text: route.train_name
            }),
          });

          if (response.ok) {
            return { status: 'success', route };
          } else {
            return { status: 'error', route };
          }
        } catch (error) {
          console.error(`Error processing route ${route.train_name}:`, error);
          return { status: 'error', route };
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
        current: Math.min(i + batchSize, totalRoutes),
        total: totalRoutes
      }));

      // Add delay between batches to prevent overwhelming the server
      if (i + batchSize < totalRoutes) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if queue is paused
        if (queuePaused) {
          setQueueProgress(prev => ({ ...prev, isProcessing: false }));
          return;
        }
      }
    }

    // Update routes with audio state
    await checkRoutesWithAudio(audioQueue.map(r => r.train_name));

    // Show completion message
    let message = '';
    if (successCount > 0) {
      message += `Successfully started audio generation for ${successCount} trains. `;
    }
    if (skippedCount > 0) {
      message += `Skipped ${skippedCount} trains (audio already exists). `;
    }
    if (errorCount > 0) {
      message += `${errorCount} trains failed to generate audio.`;
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
      
      // Get all routes from all pages
      setSetupProgress(prev => ({ 
        ...prev, 
        message: 'Fetching all train routes from database...', 
        currentStep: 2 
      }));
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let allRoutes;
      
      try {
        console.log('Fetching all train routes from all pages...');
        console.log('Current page routes count:', routes.length);
        const allRoutesResponse = await apiService.getAllTrainRoutes();
        console.log('API Response:', allRoutesResponse);
        
        if (!allRoutesResponse || !allRoutesResponse.routes) {
          throw new Error('Invalid response from server: missing routes data');
        }
        
        allRoutes = allRoutesResponse.routes;
        console.log(`Successfully fetched ${allRoutes.length} train routes from all pages`);
        console.log('First few routes:', allRoutes.slice(0, 3));
      } catch (error) {
        console.error('Failed to fetch all routes, falling back to current page routes:', error);
        // Fallback to current page routes if getAllTrainRoutes fails
        allRoutes = routes;
        console.log(`Using fallback: ${allRoutes.length} routes from current page`);
        
        // Add a toast to inform user about fallback
        addToast({
          type: 'info',
          title: 'Using Current Page',
          message: 'Could not fetch all routes, using current page routes instead'
        });
      }
      
      if (allRoutes.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Routes Found',
          message: 'There are no train routes to generate audio for'
        });
        setIsGeneratingAllAudio(false);
        setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
        return;
      }

      // For now, let's add all routes to the queue and let the queue processor handle duplicates
      // This is more efficient and avoids potential timeout issues during setup
      setSetupProgress(prev => ({ 
        ...prev, 
        message: `Preparing queue with ${allRoutes.length} train routes from all pages...`, 
        currentStep: 3 
      }));
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const routesToProcess = allRoutes;

      if (routesToProcess.length === 0) {
        addToast({
          type: 'info',
          title: 'No New Routes',
          message: 'All routes already have audio files generated'
        });
        setIsGeneratingAllAudio(false);
        setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
        return;
      }

      // Add routes to queue
      setAudioQueue(routesToProcess);
      setQueueProgress({ 
        current: 0, 
        total: routesToProcess.length, 
        isProcessing: false 
      });

      addToast({
        type: 'success',
        title: 'Queue Created',
        message: `${routesToProcess.length} train routes from all pages added to audio generation queue`
      });

      // Clear setup progress and start processing the queue
      setSetupProgress({ isSettingUp: false, message: '', currentStep: 0, totalSteps: 3 });
      
      // Use a longer delay and pass the routes directly to avoid state timing issues
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Pass routes directly to avoid state timing issues
      processAudioQueueWithStations(routesToProcess);
      
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
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('File read successfully, processing...');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        console.log('Workbook sheets:', workbook.SheetNames);
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Parsed data:', jsonData);
        setImportData(jsonData);
        validateImportData(jsonData);
      } catch (error) {
        console.error('Error processing Excel file:', error);
        setError('Failed to read Excel file. Please ensure it\'s a valid Excel file.');
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      setError('Error reading file. Please try again.');
    };
    
    reader.readAsArrayBuffer(file);
  };

  const validateImportData = (data: any[]) => {
    const errors: string[] = [];
    const requiredColumns = ['Train Number', 'Train Name', 'Start Station', 'Start Station Code', 'End Station', 'End Station Code'];
    const optionalColumns = ['Train Name (Hindi)', 'Train Name (Marathi)', 'Train Name (Gujarati)'];
    
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
    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we skip header
      
      if (!row['Train Number']) {
        errors.push(`Row ${rowNumber}: Train Number is required`);
      }
      if (!row['Train Name']) {
        errors.push(`Row ${rowNumber}: Train Name is required`);
      }
      if (!row['Start Station']) {
        errors.push(`Row ${rowNumber}: Start Station is required`);
      }
      if (!row['Start Station Code']) {
        errors.push(`Row ${rowNumber}: Start Station Code is required`);
      }
      if (!row['End Station']) {
        errors.push(`Row ${rowNumber}: End Station is required`);
      }
      if (!row['End Station Code']) {
        errors.push(`Row ${rowNumber}: End Station Code is required`);
      }
      if (row['Start Station'] === row['End Station']) {
        errors.push(`Row ${rowNumber}: Start and End stations cannot be the same`);
      }
    });

    setImportErrors(errors);
  };

  const findStationByNameOrCode = (stationName: string, stationCode: string): Station | undefined => {
    // Trim whitespace from station name and code
    const trimmedName = stationName.trim();
    const trimmedCode = stationCode.trim();
    return stations.find(station => 
      station.station_name.toLowerCase() === trimmedName.toLowerCase() ||
      station.station_code.toLowerCase() === trimmedCode.toLowerCase()
    );
  };

  const handleImport = async () => {
    if (importErrors.length > 0) {
      setError('Please fix all validation errors before importing');
      return;
    }

    try {
      setError(null);
      const importPromises = importData.map(async (row) => {
        const startStation = findStationByNameOrCode(row['Start Station'], row['Start Station Code']);
        const endStation = findStationByNameOrCode(row['End Station'], row['End Station Code']);

        if (!startStation) {
          throw new Error(`Start station "${row['Start Station'].trim()}" (${row['Start Station Code'].trim()}) not found in system. Available stations: ${stations.map(s => `${s.station_name} (${s.station_code})`).join(', ')}`);
        }
        if (!endStation) {
          throw new Error(`End station "${row['End Station'].trim()}" (${row['End Station Code'].trim()}) not found in system. Available stations: ${stations.map(s => `${s.station_name} (${s.station_code})`).join(', ')}`);
        }

        return apiService.createTrainRoute({
          train_number: row['Train Number'].toString(),
          train_name: row['Train Name'].toString(),
          train_name_hi: row['Train Name (Hindi)']?.toString() || row['Train Name'].toString(),
          train_name_mr: row['Train Name (Marathi)']?.toString() || row['Train Name'].toString(),
          train_name_gu: row['Train Name (Gujarati)']?.toString() || row['Train Name'].toString(),
          start_station_id: startStation.id,
          end_station_id: endStation.id
        });
      });

      await Promise.all(importPromises);
      await fetchData();
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
      onDataChange?.();
      addToast({
        type: 'success',
        title: 'Import Successful',
        message: `${importData.length} train routes have been imported successfully`
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

  // Routes are now filtered server-side based on search term
  const filteredRoutes = routes;

  console.log('Routes state:', routes);
  console.log('Filtered routes:', filteredRoutes);
  console.log('Search term:', searchTerm);

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
          <h2 className="text-2xl font-bold text-gray-900">Train Route Management</h2>
          <p className="text-gray-600 text-xs">Manage train routes and their connections</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setEditingRoute(null);
              setFormData({ train_number: '', train_name: '', train_name_hi: '', train_name_mr: '', train_name_gu: '', start_station_id: '', end_station_id: '' });
              setShowModal(true);
            }}
            className="bg-[#337ab7] hover:bg-[#2e6da4] text-white px-3 py-1.5 rounded-none transition-colors text-sm"
            title="Add a new train route to the database. You can enter the train number, name, optional multilingual names, and select start and end stations."
          >
            Add Route
          </button>
          <button
            onClick={() => {
              console.log('Import button clicked');
              setShowImportModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-none transition-colors text-sm"
            title="Import multiple train routes from an Excel file. The file should have columns for Train Number, Train Name, Start Station Name, and End Station Name. Optional columns for multilingual names (Hindi, Marathi, Gujarati) are also supported."
          >
            Import
          </button>
          {routes.length > 0 && (
            <>
              <button
                onClick={handleGenerateAudioForAll}
                disabled={generatingAudio.size > 0 || isGeneratingAllAudio || queueProgress.isProcessing}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-none transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate audio files for all train routes in the database. This will create audio announcements for each train route in multiple languages (English, Marathi, Hindi, Gujarati). The process runs in the background and you can monitor progress in the queue below."
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
                title="Delete all train routes from the database. This action cannot be undone. All route data, including multilingual names and associated audio files, will be permanently removed."
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
            placeholder="Search by train number or train name..."
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
          title="Search for train routes by train number or train name. The search is case-insensitive and will match partial text."
        >
          Search
        </button>
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="text-gray-700 border border-gray-300 rounded-none hover:bg-gray-50 px-3 py-1.5 transition-colors text-sm"
            title="Clear the search field and show all train routes in the database."
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
            <div className="flex items-center space-x-2">
              <span className="text-sm text-purple-700">
                Step {setupProgress.currentStep} of {setupProgress.totalSteps}
              </span>
              {setupProgress.isSettingUp && !queuePaused && (
                <button
                  onClick={pauseQueue}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Pause
                </button>
              )}
              {queuePaused && (
                <button
                  onClick={resumeQueue}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Resume
                </button>
              )}
            </div>
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
                {queueProgress.current} / {queueProgress.total} trains
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
              : 'Processing trains in batches... Please wait.'
            }
          </p>
        </div>
      )}

      {/* Routes Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredRoutes.length === 0 ? (
          <div className="text-center py-12">
            <Route className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No routes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating a new train route'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Train Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Route className="h-5 w-5 text-gray-400 mr-3" />
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{route.train_name}</div>
                              <div className="text-sm text-gray-500">#{route.train_number}</div>
                            </div>
                            {(route.train_name_hi || route.train_name_mr || route.train_name_gu) && (
                              <div className="ml-2 text-xs text-gray-500">
                                <span title={`Hindi: ${route.train_name_hi || 'Not set'}\nMarathi: ${route.train_name_mr || 'Not set'}\nGujarati: ${route.train_name_gu || 'Not set'}`}>
                                  🌐
                                </span>
                              </div>
                            )}
                            {routesWithAudio.has(route.id) && (
                              <div title="Audio generated">
                                <Flag className="h-4 w-4 text-green-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium text-gray-900">{route.start_station_name}</div>
                            <div className="text-xs text-gray-500">{route.start_station_code}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <div className="text-center">
                            <div className="font-medium text-gray-900">{route.end_station_name}</div>
                            <div className="text-xs text-gray-500">{route.end_station_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(route.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleGenerateAudio(route)}
                            disabled={generatingAudio.has(route.id)}
                            className="text-[#337ab7] hover:text-[#2e6da4] p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Generate Audio"
                          >
                            {generatingAudio.has(route.id) ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#337ab7]"></div>
                            ) : (
                              <FileAudio className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(route)}
                            className="text-[#337ab7] hover:text-[#1e4a6b] p-0.5"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(route.id)}
                            className="text-red-600 hover:text-red-900 p-0.5"
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
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} routes
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
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingRoute ? 'Edit Train Route' : 'Add New Train Route'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Train Number
                </label>
                <input
                  type="text"
                  value={formData.train_number}
                  onChange={(e) => setFormData({ ...formData, train_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent"
                  placeholder="Enter train number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Train Name
                </label>
                <input
                  type="text"
                  value={formData.train_name}
                  onChange={(e) => setFormData({ ...formData, train_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent"
                  placeholder="Enter train name"
                  required
                />
              </div>
              
              {/* Multilingual Train Names */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Multilingual Train Names (Optional)</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Train Name (Hindi)
                    </label>
                    <input
                      type="text"
                      value={formData.train_name_hi}
                      onChange={(e) => setFormData({ ...formData, train_name_hi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent text-sm"
                      placeholder="Enter Hindi train name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Train Name (Marathi)
                    </label>
                    <input
                      type="text"
                      value={formData.train_name_mr}
                      onChange={(e) => setFormData({ ...formData, train_name_mr: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent text-sm"
                      placeholder="Enter Marathi train name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Train Name (Gujarati)
                    </label>
                    <input
                      type="text"
                      value={formData.train_name_gu}
                      onChange={(e) => setFormData({ ...formData, train_name_gu: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent text-sm"
                      placeholder="Enter Gujarati train name"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Station
                </label>
                <select
                  value={formData.start_station_id}
                  onChange={(e) => setFormData({ ...formData, start_station_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent"
                  required
                >
                  <option value="">Select start station</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.station_name} ({station.station_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Station
                </label>
                <select
                  value={formData.end_station_id}
                  onChange={(e) => setFormData({ ...formData, end_station_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#f0f4f8]0 focus:border-transparent"
                  required
                >
                  <option value="">Select end station</option>
                  {stations
                    .filter(station => station.id.toString() !== formData.start_station_id)
                    .map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.station_name} ({station.station_code})
                      </option>
                    ))}
                </select>
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
                  {editingRoute ? 'Update' : 'Create'}
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
              <h3 className="text-lg font-medium text-gray-900">Import Train Routes from Excel</h3>
              <button
                onClick={() => {
                  console.log('Closing import modal');
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
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="cursor-pointer bg-[#337ab7] hover:bg-[#2e6da4] text-white px-3 py-1.5 rounded-none inline-flex items-center space-x-1 text-sm"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Choose Excel File</span>
                  </label>
                                  <p className="text-sm text-gray-500 mt-2">
                  Upload an Excel file with required columns: Train Number, Train Name, Start Station, Start Station Code, End Station, End Station Code<br/>
                  Optional columns: Train Name (Hindi), Train Name (Marathi), Train Name (Gujarati)
                </p>
                </div>
              </div>

              {/* Required Format */}
              <div className="bg-[#f0f4f8] border border-[#c3d4e5] rounded-lg p-4">
                <h4 className="font-medium text-[#1e4a6b] mb-2">Required Excel Format:</h4>
                <div className="text-sm text-[#2e6da4]">
                  <p className="mb-2">Your Excel file must have these exact column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Train Number</strong> - Unique identifier for the train</li>
                    <li><strong>Train Name</strong> - Name of the train</li>
                    <li><strong>Start Station</strong> - Starting station name</li>
                    <li><strong>Start Station Code</strong> - Starting station code (e.g., NDLS)</li>
                    <li><strong>End Station</strong> - Destination station name</li>
                    <li><strong>End Station Code</strong> - Destination station code (e.g., MMCT)</li>
                  </ul>
                  <p className="mt-2 text-xs font-medium text-[#337ab7]">Optional columns:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Train Name (Hindi)</strong> - Train name in Hindi</li>
                    <li><strong>Train Name (Marathi)</strong> - Train name in Marathi</li>
                    <li><strong>Train Name (Gujarati)</strong> - Train name in Gujarati</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Note: Station names must match existing stations in the system
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
                    Preview ({importData.length} routes ready to import)
                  </h4>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-green-200">
                          <th className="text-left py-1">Train Number</th>
                          <th className="text-left py-1">Train Name</th>
                          <th className="text-left py-1">Start Station</th>
                          <th className="text-left py-1">Start Code</th>
                          <th className="text-left py-1">End Station</th>
                          <th className="text-left py-1">End Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, index) => (
                          <tr key={index} className="border-b border-green-100">
                            <td className="py-1">{row['Train Number']}</td>
                            <td className="py-1">{row['Train Name']}</td>
                            <td className="py-1">{row['Start Station']}</td>
                            <td className="py-1">{row['Start Station Code']}</td>
                            <td className="py-1">{row['End Station']}</td>
                            <td className="py-1">{row['End Station Code']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 5 && (
                      <p className="text-xs text-green-600 mt-2">
                        ... and {importData.length - 5} more routes
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
                  Import {importData.length} Routes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}