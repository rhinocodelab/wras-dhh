import React, { useState, useEffect } from 'react';
import { Train, MapPin, Route, Users, Search, X, Volume2 } from 'lucide-react';
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

  const announcementCategories = [
    'Arrival',
    'Delay', 
    'Platform Change',
    'Cancellation'
  ];

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

  const stats = [
    {
      title: 'Total Stations',
      count: stationCount,
      icon: MapPin,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
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
        <p className="text-gray-600">Welcome to the Western Railway Announcement System for Deaf and Hard of Hearing</p>
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
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search by train number or train name..."
              className="block w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="mt-6">
            {searchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Train Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Train Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        From Station
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        To Station
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Platform
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Announcement Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handlePlatformSave(route.id)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{platformValues[route.id] || 1}</span>
                              <button
                                onClick={() => handlePlatformEdit(route.id)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <select
                            value={categoryValues[route.id] || 'Arrival'}
                            onChange={(e) => handleCategoryChange(route.id, e.target.value)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            {announcementCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleGenerateAudio(route)}
                            disabled={generatingAudio.has(route.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>


    </div>
  );
}