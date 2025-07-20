import React from 'react';
import { Train, MapPin, Route, Users } from 'lucide-react';

interface DashboardProps {
  stationCount: number;
  routeCount: number;
}

export default function Dashboard({ stationCount, routeCount }: DashboardProps) {
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

      {/* System Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
                          <h4 className="font-medium text-gray-900 mb-2">About WRAS-DHH</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              The Western Railway Announcement System for Deaf and Hard of Hearing is designed to provide 
              accessible railway information management. This system helps manage station data and train 
              route information efficiently.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Features</h4>
            <ul className="text-gray-600 text-sm space-y-1">
              <li>• Station Management with codes</li>
              <li>• Train Route Configuration</li>
              <li>• User Authentication</li>
              <li>• Responsive Design</li>
              <li>• Real-time Data Updates</li>
            </ul>
          </div>
        </div>
      </div>


    </div>
  );
}