export interface User {
  id: number;
  username: string;
  role: string;
}

export interface Station {
  id: number;
  station_name: string;
  station_code: string;
  created_at: string;
}

export interface TrainRoute {
  id: number;
  train_number: string;
  train_name: string;
  start_station_id: number;
  end_station_id: number;
  start_station_name: string;
  start_station_code: string;
  end_station_name: string;
  end_station_code: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}