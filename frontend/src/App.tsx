import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StationManagement from './components/StationManagement';
import TrainRouteManagement from './components/TrainRouteManagement';
import AnnouncementTemplates from './components/AnnouncementTemplates';
import AudioAnnouncementFiles from './components/AudioAnnouncementFiles';
import AnnouncementAudios from './components/AnnouncementAudios';
import ISLDictionary from './components/ISLDictionary';
import ToastContainer, { useToast } from './components/ToastContainer';
import { User, Station, TrainRoute } from './types';
import { apiService } from './services/api';

function AppContent() {
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [routes, setRoutes] = useState<TrainRoute[]>([]);
  const [dashboardKey, setDashboardKey] = useState(0); // Force dashboard refresh
  const [audioFilesKey, setAudioFilesKey] = useState(0); // Force audio files refresh

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        fetchDashboardData();
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [stationsData, routesData] = await Promise.all([
        apiService.getStations(1, 1000), // Get all stations for count
        apiService.getTrainRoutes(1, 1000) // Get all routes for count
      ]);
      setStations(stationsData.stations);
      setRoutes(routesData.routes);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setLoginError(null);
      
      const response = await apiService.login(username, password);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      
      await fetchDashboardData();
      addToast({
        type: 'success',
        title: 'Login Successful',
        message: `Welcome back, ${response.user.username}!`
      });
    } catch (error: any) {
      setLoginError(error.message);
      addToast({
        type: 'error',
        title: 'Login Failed',
        message: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('dashboard');
  };

  const refreshDashboard = () => {
    setDashboardKey(prev => prev + 1);
    fetchDashboardData();
  };

  const refreshAudioFiles = () => {
    setAudioFilesKey(prev => prev + 1);
  };

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        isLoading={isLoading}
        error={loginError}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stationCount={stations.length} routeCount={routes.length} />;
      case 'stations':
        return <StationManagement onDataChange={refreshDashboard} onAudioChange={refreshAudioFiles} />;
      case 'routes':
        return <TrainRouteManagement onDataChange={refreshDashboard} onAudioChange={refreshAudioFiles} />;
      case 'templates':
        return <AnnouncementTemplates />;
      case 'audio-files':
        return <AudioAnnouncementFiles key={audioFilesKey} onDataChange={refreshDashboard} />;
      case 'announcement-audios':
        return <AnnouncementAudios />;
      case 'isl-dictionary':
        return <ISLDictionary />;
      default:
        return <Dashboard stationCount={stations.length} routeCount={routes.length} />;
    }
  };

  return (
    <Layout
      user={user}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
}

function App() {
  return (
    <ToastContainer>
      <AppContent />
    </ToastContainer>
  );
}

export default App;