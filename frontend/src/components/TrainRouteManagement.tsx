import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, Route, Search, ArrowRight, Upload, FileSpreadsheet, X, Trash } from 'lucide-react';
import { TrainRoute, Station } from '../types';
import { apiService } from '../services/api';
import { useToast } from './ToastContainer';
import * as XLSX from 'xlsx';

interface TrainRouteManagementProps {
  onDataChange?: () => void;
}

export default function TrainRouteManagement({ onDataChange }: TrainRouteManagementProps) {
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
    start_station_id: '',
    end_station_id: ''
  });
  const [error, setError] = useState<string | null>(null);
  
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
      setFormData({ train_number: '', train_name: '', start_station_id: '', end_station_id: '' });
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
      start_station_id: route.start_station_id.toString(),
      end_station_id: route.end_station_id.toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this train route?')) {
      try {
        await apiService.deleteTrainRoute(id);
        await fetchData();
        onDataChange?.();
        addToast({
          type: 'success',
          title: 'Train Route Deleted',
          message: 'Train route has been deleted successfully'
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
    if (window.confirm('Are you sure you want to clear ALL train routes? This action cannot be undone.')) {
      try {
        setError(null);
        await apiService.clearAllTrainRoutes();
        await fetchData();
        onDataChange?.();
        addToast({
          type: 'success',
          title: 'All Train Routes Cleared',
          message: 'All train routes have been cleared successfully'
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Train Route Management</h2>
          <p className="text-gray-600">Manage train routes and their connections</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setEditingRoute(null);
              setFormData({ train_number: '', train_name: '', start_station_id: '', end_station_id: '' });
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
          >
            <Plus className="h-3 w-3" />
            <span>Add Route</span>
          </button>
          <button
            onClick={() => {
              console.log('Import button clicked');
              setShowImportModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
          >
            <Upload className="h-3 w-3" />
            <span>Import</span>
          </button>
          {routes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-none flex items-center space-x-1 transition-colors text-sm"
            >
              <Trash className="h-3 w-3" />
              <span>Clear All</span>
            </button>
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

      {/* Routes Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Train Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route
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
              {filteredRoutes.map((route) => (
                <tr key={route.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Route className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{route.train_name}</div>
                        <div className="text-sm text-gray-500">#{route.train_number}</div>
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
                        onClick={() => handleEdit(route)}
                        className="text-blue-600 hover:text-blue-900 p-0.5"
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

        {filteredRoutes.length === 0 && (
          <div className="text-center py-12">
            <Route className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No routes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating a new train route'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-3 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} routes
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter train name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Station
                </label>
                <select
                  value={formData.start_station_id}
                  onChange={(e) => setFormData({ ...formData, start_station_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-none hover:bg-blue-700 text-sm"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-none inline-flex items-center space-x-1 text-sm"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Choose Excel File</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    Upload an Excel file with columns: Train Number, Train Name, Start Station, Start Station Code, End Station, End Station Code
                  </p>
                </div>
              </div>

              {/* Required Format */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Required Excel Format:</h4>
                <div className="text-sm text-blue-800">
                  <p className="mb-2">Your Excel file must have these exact column headers:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Train Number</strong> - Unique identifier for the train</li>
                    <li><strong>Train Name</strong> - Name of the train</li>
                    <li><strong>Start Station</strong> - Starting station name</li>
                    <li><strong>Start Station Code</strong> - Starting station code (e.g., NDLS)</li>
                    <li><strong>End Station</strong> - Destination station name</li>
                    <li><strong>End Station Code</strong> - Destination station code (e.g., MMCT)</li>
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